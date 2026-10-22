"""Row -> Record transform and the validate/index pipeline stages.

Source columns (final_data.csv): Article PII, DOI, Composition, Property,
Elements, APL_Group, Paper_Link. Cells are Python literals parsed with
ast.literal_eval.
"""

from __future__ import annotations

import csv
import json
import logging
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from omat_core.composition import (
    CompositionError,
    parse_composition,
    parse_literal,
)
from omat_core.models import (
    Journal,
    Record,
    Rejection,
    make_record_id,
)
from omat_core.normalize import (
    build_search_text,
    make_application,
    make_property_value,
    normalize_doi,
    normalize_pii,
    year_from_doi,
)
from omat_core.taxonomy import Taxonomy, load_taxonomy

logger = logging.getLogger(__name__)

COLUMNS = ["Article PII", "DOI", "Composition", "Property", "Elements", "APL_Group", "Paper_Link"]


@dataclass
class IngestStats:
    total_rows: int = 0
    records_built: int = 0
    golden: int = 0  # composition + property
    property_only: int = 0
    composition_only: int = 0
    duplicates: int = 0
    rejections: int = 0
    warnings: dict[str, int] = field(default_factory=dict)

    def note_warning(self, warning: str) -> None:
        self.warnings[warning] = self.warnings.get(warning, 0) + 1


def _reject(stats: IngestStats, rejects: list[Rejection], row_index: int,
            reason: str, detail: str, row: list[str]) -> None:
    stats.rejections += 1
    rejects.append(
        Rejection(
            row_index=row_index,
            reason=reason,
            detail=detail,
            row_preview={k: v for k, v in zip(COLUMNS, row) if len(row) > 0},
        )
    )


def row_to_record(
    row: list[str], row_index: int, taxonomy: Taxonomy, stats: IngestStats,
    rejects: list[Rejection],
) -> Record | None:
    """One CSV row -> one Record, or None if rejected."""
    if len(row) < len(COLUMNS):
        _reject(stats, rejects, row_index, "short_row", f"{len(row)} columns", row)
        return None

    pii_raw, doi_raw, comp_cell, prop_cell, elements_cell, apl_cell, link = row[:7]

    pii = normalize_pii(pii_raw)
    if pii is None:
        _reject(stats, rejects, row_index, "bad_pii", pii_raw, row)
        return None
    doi = normalize_doi(doi_raw)
    if doi is None:
        _reject(stats, rejects, row_index, "bad_doi", doi_raw, row)
        return None

    try:
        composition, warning = parse_composition(comp_cell, elements_cell, label=None)
    except CompositionError as exc:
        _reject(stats, rejects, row_index, "bad_composition", str(exc), row)
        return None
    if warning:
        stats.note_warning(warning)

    # Property: a 3-tuple (name, value, unit) or the empty tuple.
    property_value = None
    try:
        prop_raw = parse_literal(prop_cell)
    except CompositionError as exc:
        _reject(stats, rejects, row_index, "bad_property", str(exc), row)
        return None
    if isinstance(prop_raw, tuple) and prop_raw:
        if len(prop_raw) != 3:
            _reject(stats, rejects, row_index, "bad_property_shape", repr(prop_raw), row)
            return None
        name, value, unit = prop_raw
        if not isinstance(name, str) or not isinstance(value, (int, float)) or isinstance(value, bool):
            _reject(stats, rejects, row_index, "bad_property_types", repr(prop_raw), row)
            return None
        property_value = make_property_value(name, float(value), unit, taxonomy)
    elif isinstance(prop_raw, (list, tuple)) and not prop_raw:
        pass  # empty tuple: composition-only row
    else:
        _reject(stats, rejects, row_index, "bad_property_shape", repr(prop_raw), row)
        return None

    try:
        apps_raw = parse_literal(apl_cell)
    except CompositionError as exc:
        _reject(stats, rejects, row_index, "bad_apl_group", str(exc), row)
        return None
    applications = [
        make_application(str(a)) for a in (apps_raw or []) if str(a).strip()
    ]

    journal = taxonomy.journal_for_doi(doi)
    year = year_from_doi(doi)

    has_composition = composition is not None
    has_property = property_value is not None
    if has_composition and has_property:
        stats.golden += 1
    elif has_property:
        stats.property_only += 1
    else:
        stats.composition_only += 1

    record = Record(
        record_id=make_record_id(pii, doi, row_index),
        row_index=row_index,
        article_pii=pii,
        doi=doi,
        paper_link=link.strip() or None,
        has_composition=has_composition,
        has_property=has_property,
        composition=composition,
        property=property_value,
        elements=sorted(composition.element_symbols) if composition else [],
        species=sorted({s.symbol for s in composition.species}) if composition else [],
        journal=None
        if journal is None
        else Journal(raw=journal.name, name=journal.name, slug=journal.slug),
        year=year,
        applications=applications,
        search_text=build_search_text(
            label=composition.canonical if composition else None,
            elements=sorted(composition.element_symbols) if composition else [],
            property_name=property_value.name if property_value else None,
            journal_name=journal.name if journal else None,
            applications=[a.raw for a in applications],
        ),
    )
    return record


def iter_records(
    csv_path: Path, taxonomy: Taxonomy, stats: IngestStats, rejects: list[Rejection]
) -> Iterator[Record]:
    seen: set[tuple[str, str, str]] = set()
    with csv_path.open(newline="") as handle:
        reader = csv.reader(handle)
        next(reader)  # header
        for row_index, row in enumerate(reader, start=1):
            stats.total_rows += 1
            record = row_to_record(row, row_index, taxonomy, stats, rejects)
            if record is None:
                continue
            stats.records_built += 1
            dedupe_key = (
                record.doi,
                record.composition.canonical if record.composition else "",
                record.property.slug if record.property else "",
                str(record.property.value) if record.property else "",
            )
            if dedupe_key in seen:
                stats.duplicates += 1
                continue
            seen.add(dedupe_key)
            yield record


def stage_jsonl(records: Iterator[Record], out_path: Path) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with out_path.open("w") as handle:
        for record in records:
            handle.write(record.model_dump_json() + "\n")
            count += 1
    return count


def write_rejects(rejects: list[Rejection], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "rejects.jsonl"
    with out_path.open("w") as handle:
        for rejection in rejects:
            handle.write(rejection.model_dump_json() + "\n")
    return out_path


def run_validate(csv_path: Path, taxonomy: Taxonomy) -> tuple[IngestStats, list[Rejection], list[Record]]:
    stats = IngestStats()
    rejects: list[Rejection] = []
    records = list(iter_records(csv_path, taxonomy, stats, rejects))
    return stats, rejects, records
