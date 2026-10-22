"""Normalization helpers: DOI/PII, properties with units, journals, years,
application slugs, and the flat ``search_text`` field.

Every function is pure so py-ingest and the API can reuse them.
"""

from __future__ import annotations

import re

from ..models import Application, PropertyValue
from ..taxonomy import Taxonomy, slugify

_DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
_YEAR_RE = re.compile(r"\.(19|20)(\d{2})\.")


def normalize_doi(raw: str | None) -> str | None:
    """Lowercase, strip https://doi.org/ and dx.doi.org prefixes and whitespace.
    Returns None when the value is not a DOI."""
    if not raw:
        return None
    doi = raw.strip().lower()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi)
    doi = doi.rstrip(".")
    if not _DOI_RE.match(doi):
        return None
    return doi


def normalize_pii(raw: str | None) -> str | None:
    """Elsevier PII. Verified against all 119,089 rows of final_data.csv:
    exactly 17 chars, ``S`` + 7 digits + check char + 7 digits + check char
    (check char is a digit or ``X``)."""
    if not raw:
        return None
    pii = raw.strip().upper()
    if not re.match(r"^S\d{7}[0-9X]\d{7}[0-9X]$", pii):
        return None
    return pii


def year_from_doi(doi: str) -> int | None:
    """Elsevier DOIs embed the year: 10.1016/j.matlet.2020.129009 -> 2020.
    Not all prefixes do; returns None and Crossref enrichment fills the gap."""
    match = _YEAR_RE.search(doi)
    if not match:
        return None
    year = int(match.group(1) + match.group(2))
    return year if 1900 <= year <= 2027 else None


def make_property_value(
    raw_name: str, value: float, unit: str | None, taxonomy: Taxonomy
) -> PropertyValue:
    """Raw property tuple -> normalized PropertyValue with SI conversion."""
    definition = taxonomy.property_for(raw_name)
    unit_def = taxonomy.unit_for(unit)
    return PropertyValue(
        raw=raw_name,
        name=definition.display,
        slug=definition.slug,
        value=value,
        unit=unit if unit is not None else "dimensionless",
        value_si=value * unit_def.factor,
    )


def make_application(raw: str) -> Application:
    return Application(raw=raw, slug=slugify(raw))


def build_search_text(
    *,
    label: str | None,
    elements: list[str],
    property_name: str | None,
    journal_name: str | None,
    applications: list[str],
) -> str:
    """One analyzable flat field: label + element symbols + property + journal +
    application words. Powers exact-formula, element-subset, and typo-tolerant
    search from a single standard-analyzer field."""
    parts: list[str] = []
    if label:
        parts.append(label)
    parts.extend(elements)
    if property_name:
        parts.append(property_name)
    if journal_name:
        parts.append(journal_name)
    for app in applications:
        parts.extend(re.split(r"[/,]", app))
    return " ".join(p for p in (s.strip() for s in parts) if p)
