"""Ingest pipeline tests with real row shapes (no OpenSearch required)."""

import pytest

from omat_core.taxonomy import load_taxonomy
from omat_ingest.pipeline import IngestStats, row_to_record

HEADER = ["Article PII", "DOI", "Composition", "Property", "Elements", "APL_Group", "Paper_Link"]


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
    ]
    a, _, _ = build(taxonomy, cells, row_index=1)
    b, _, _ = build(taxonomy, cells, row_index=2)
    assert a.record_id != b.record_id
