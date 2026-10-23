"""Ingest pipeline tests with real row shapes (no OpenSearch required)."""

import pytest

from omat_core.taxonomy import load_taxonomy
from omat_ingest.pipeline import (
    COLUMNS,
    MAX_TITLE_LENGTH,
    IngestStats,
    normalize_title,
    row_to_record,
)

HEADER = [
    "Article PII",
    "DOI",
    "Composition",
    "Property",
    "Elements",
    "APL_Group",
    "Paper_Link",
    "Title",
]


@pytest.fixture(scope="module")
def taxonomy():
    return load_taxonomy()


def build(taxonomy, cells: list[str], row_index: int = 1):
    stats = IngestStats()
    rejects: list = []
    record = row_to_record([*cells], row_index, taxonomy, stats, rejects)
    return record, stats, rejects


def test_golden_row(taxonomy):
    record, stats, rejects = build(
        taxonomy,
        [
            "S0167577X2031716X",
            "10.1016/j.matlet.2020.129009",
            "[('Al', 95.89, 'mol'), ('Cr', 1.37, 'mol'), ('N', 1.37, 'mol'), ('Ti', 1.37, 'mol')]",
            "('Youngs modulus', 467.0, 'GPa')",
            "{'Cr', 'N', 'Al', 'Ti'}",
            "['Coatings / Barriers']",
            "https://doi.org/10.1016/j.matlet.2020.129009",
            "Micro-scale impact resistance of coatings on hardened tool steels",
        ],
    )
    assert not rejects
    assert record.has_composition and record.has_property
    assert stats.golden == 1
    assert record.property.slug == "youngs_modulus"
    assert record.journal.slug == "matlet"
    assert record.year == 2020
    assert record.applications[0].slug == "coatings-barriers"
    assert record.record_id and len(record.record_id) == 16
    assert record.title == ("Micro-scale impact resistance of coatings on hardened tool steels")


def test_title_is_paper_level_and_sanitized(taxonomy):
    cells = [
        "S0167577X2031716X",
        "10.1016/j.matlet.2020.129009",
        "[]",
        "('Hardness', 27.5, 'GPa')",
        "set()",
        "[]",
        "",
    ]
    # whitespace is stripped, empty becomes None
    record, _, _ = build(taxonomy, [*cells, "   Amorphous silicon films  "])
    assert record.title == "Amorphous silicon films"
    record, _, _ = build(taxonomy, [*cells, "   "])
    assert record.title is None
    # over-length titles are capped, never indexed whole
    record, _, _ = build(taxonomy, [*cells, "x" * (MAX_TITLE_LENGTH + 50)])
    assert record.title is not None and len(record.title) == MAX_TITLE_LENGTH


def test_normalize_title_unit():
    assert normalize_title(None) is None
    assert normalize_title("") is None
    assert normalize_title("  Hard coatings ") == "Hard coatings"
    assert len(normalize_title("x" * 5000) or "") == MAX_TITLE_LENGTH


def test_row_missing_title_column_is_rejected(taxonomy):
    # 7-column rows (pre-Title CSV shape) must not silently index without
    # the enrichment column.
    record, stats, rejects = build(
        taxonomy,
        [
            "S0167577X2031716X",
            "10.1016/j.matlet.2020.129009",
            "[]",
            "('Hardness', 27.5, 'GPa')",
            "set()",
            "[]",
            "",
        ],
    )
    assert record is None
    assert stats.rejections == 1
    assert rejects[0].reason == "short_row"


def test_property_only_row(taxonomy):
    record, _, _ = build(
        taxonomy,
        [
            "S0167577X14005540",
            "10.1016/j.matlet.2014.03.184",
            "[]",
            "('Electric conductivity', 45.7, 'Ω⁻¹·cm⁻¹')",
            "set()",
            "['Energy']",
            "https://doi.org/x",
            "Amorphous silicon deposited at high growth rates",
        ],
    )
    assert record is not None
    assert not record.has_composition and record.has_property
    assert record.property.slug == "electric_conductivity"
    assert record.property.value_si == pytest.approx(4570.0)
    assert record.elements == []


def test_composition_only_row(taxonomy):
    record, _, _ = build(
        taxonomy,
        [
            "S0167577X21021029",
            "10.1016/j.matlet.2021.131404",
            "[('O', 60.69, 'mol'), ('Ti', 34.85, 'mol')]",
            "()",
            "{'O', 'Ti'}",
            "['Coatings / Barriers', 'Energy']",
            "https://doi.org/x",
            "Titania thin films by sol-gel",
        ],
    )
    assert record is not None
    assert record.has_composition and not record.has_property
    assert len(record.applications) == 2  # multi-label preserved


def test_bad_doi_rejected(taxonomy):
    record, stats, rejects = build(
        taxonomy,
        [
            "S0167577X2031716X",
            "not-a-doi",
            "[]",
            "()",
            "set()",
            "[]",
            "",
            "Some title",
        ],
    )
    assert record is None and stats.rejections == 1
    assert rejects[0].reason == "bad_doi"


def test_record_ids_differ_by_row_index(taxonomy):
    cells = [
        "S0167577X2031716X",
        "10.1016/j.matlet.2020.129009",
        "[]",
        "('Hardness', 27.5, 'GPa')",
        "set()",
        "[]",
        "",
        "Shared title",
    ]
    a, _, _ = build(taxonomy, cells, row_index=1)
    b, _, _ = build(taxonomy, cells, row_index=2)
    assert a.record_id != b.record_id


def test_columns_shape():
    # The CSV header contract: 8 columns, Title last.
    assert COLUMNS == HEADER
    assert len(COLUMNS) == 8
