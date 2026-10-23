"""Canonical domain models.

One source row becomes one ``Record``. A row with an empty composition or an
empty property tuple is still a record — the flags ``has_composition`` /
``has_property`` say which halves are present, and only golden rows (both
halves) participate in composition-property analytics.

Keep raw strings next to normalized ones. Source labels are evidence; never
overwrite them during cleanup.
"""

from __future__ import annotations

import hashlib
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# v2: documents now carry `title` (mapped from the CSV's Title column via
# PII/Crossref). The index mapping is unchanged — the field was declared from
# the start — but v2 forces a fresh papers_v2 build + alias swap so the old
# index stays as a rollback.
SCHEMA_VERSION = "2"


class SpeciesAmount(BaseModel):
    """One ``(symbol, value, unit)`` entry from the Composition cell.

    ``symbol`` may be an element (``Ti``) or a compound species (``B2O3``);
    ``Elements`` holds the expanded atoms.
    """

    model_config = ConfigDict(frozen=True)

    symbol: str
    value: float
    unit: str  # "mol" | "wt" (mol% is at%; wt% is converted at parse time)


class ElementalAmount(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    at_pct: float


class Composition(BaseModel):
    """Parsed composition. ``label`` is the source display string (may be None)."""

    label: str | None = None
    species: list[SpeciesAmount] = Field(default_factory=list)
    elements: list[ElementalAmount] = Field(default_factory=list)
    canonical: str | None = None  # "Al95.89-Cr1.37-N1.37-Ti1.37"
    vector: list[float] | None = None  # 118 dims, periodic-table order

    @property
    def element_symbols(self) -> list[str]:
        return [e.symbol for e in self.elements]


class PropertyValue(BaseModel):
    """One measured property. ``value_si`` enables cross-unit range queries."""

    raw: str
    name: str  # display name, e.g. "Young's modulus"
    slug: str  # "youngs_modulus"
    value: float
    unit: str | None = None  # None -> "dimensionless"
    value_si: float | None = None


class Journal(BaseModel):
    raw: str
    name: str
    slug: str


class Application(BaseModel):
    raw: str
    slug: str


class Record(BaseModel):
    """The canonical index document: one measurement property per doc."""

    model_config = ConfigDict(populate_by_name=True)

    record_id: str
    row_index: int
    article_pii: str
    doi: str  # normalized: lowercase, no https://doi.org/ prefix
    paper_link: str | None = None

    has_composition: bool = False
    has_property: bool = False

    composition: Composition | None = None
    property: PropertyValue | None = None

    elements: list[str] = Field(default_factory=list)  # expanded atoms, sorted
    species: list[str] = Field(default_factory=list)  # as-written, e.g. B2O3

    journal: Journal | None = None
    year: int | None = None
    applications: list[Application] = Field(default_factory=list)

    # Paper-level enrichment: populated by the ingest pipeline from the CSV's
    # Title column (PII -> Crossref title). Absent for unenriched sources.
    title: str | None = None
    abstract: str | None = None

    search_text: str = ""

    def group_key(self) -> tuple[str, str]:
        """Paper-level grouping key: (PII, DOI)."""
        return (self.article_pii, self.doi)


class Paper(BaseModel):
    """Grouping view returned by GET /v1/papers/{doi_or_pii}."""

    article_pii: str
    doi: str
    paper_link: str | None = None
    journal: Journal | None = None
    year: int | None = None
    applications: list[Application] = Field(default_factory=list)
    records: list[Record] = Field(default_factory=list)

    @property
    def record_count(self) -> int:
        return len(self.records)


class Rejection(BaseModel):
    """A validation failure written to data/rejects/ instead of dropped."""

    row_index: int
    reason: str
    detail: str = ""
    row_preview: dict[str, Any] = Field(default_factory=dict)


def make_record_id(article_pii: str, doi: str, row_index: int) -> str:
    """Stable row identity. The CSV has no Proxy_ID/Table No. columns, so the
    row index within the source file is the only per-row discriminator."""
    key = f"{article_pii}|{doi}|{row_index}"
    return hashlib.sha1(key.encode()).hexdigest()[:16]


class SearchEnvelope(BaseModel):
    """Search response envelope. Facets are served by `/v1/facets`."""

    data: list[Any] = Field(default_factory=list)
    total: int = 0
    took_ms: int = 0
    cursor: str | None = None
