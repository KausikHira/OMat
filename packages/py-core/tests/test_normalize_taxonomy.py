"""Normalization + taxonomy tests."""

import pytest

from omat_core.normalize import (
    build_search_text,
    make_property_value,
    normalize_doi,
    normalize_pii,
    year_from_doi,
)
from omat_core.taxonomy import load_taxonomy, slugify


@pytest.fixture(scope="module")
def taxonomy():
    return load_taxonomy()


def test_doi_normalization():
    assert normalize_doi("10.1016/j.matlet.2020.129009") == "10.1016/j.matlet.2020.129009"
    assert normalize_doi("https://doi.org/10.1016/J.MATLET.2020.129009") == "10.1016/j.matlet.2020.129009"
    assert normalize_doi("S0167577X2031716X") is None
    assert normalize_doi("") is None


def test_pii_normalization():
    assert normalize_pii("S0167577X2031716X") == "S0167577X2031716X"
    assert normalize_pii("s0167577x2031716x") == "S0167577X2031716X"
    assert normalize_pii("10.1016/j.matlet") is None


def test_year_from_doi():
    assert year_from_doi("10.1016/j.matlet.2020.129009") == 2020
    assert year_from_doi("10.1016/j.ceramint.2005.12.138") == 2005
    assert year_from_doi("10.1016/j.no.year") is None


def test_property_alias_resolution(taxonomy):
    pv = make_property_value("Youngs modulus", 467.0, "GPa", taxonomy)
    assert pv.slug == "youngs_modulus"
    assert pv.name == "Young's modulus"
    assert pv.value_si == pytest.approx(467.0e9)


def test_dimensionless_unit(taxonomy):
    pv = make_property_value("Refractive index", 1.52, None, taxonomy)
    assert pv.unit == "dimensionless"
    assert pv.value_si == pytest.approx(1.52)


def test_all_eight_units_convert(taxonomy):
    cases = [("GPa", 1.0, 1e9), ("K", 300.0, 300.0), ("g/cm³", 2.5, 2500.0),
             ("Ω⁻¹·cm⁻¹", 45.7, 4570.0), ("eV", 1.0, 1.602176634e-19),
             ("K⁻¹", 1e-6, 1e-6), ("MPa⋅m½", 2.0, 2e6), (None, 3.14, 3.14)]
    for unit, value, expected in cases:
        pv = make_property_value("Hardness" if unit else "Refractive index", value, unit, taxonomy)
        assert pv.value_si == pytest.approx(expected), f"unit {unit}"


def test_unknown_property_gets_derived_slug(taxonomy):
    pv = make_property_value("Some New Property", 1.0, "GPa", taxonomy)
    assert pv.slug == "some_new_property"
    assert pv.name == "Some New Property"


def test_journal_resolution(taxonomy):
    journal = taxonomy.journal_for_doi("10.1016/j.ceramint.2020.123456")
    assert journal is not None and journal.name == "Ceramics International"
    assert taxonomy.journal_for_doi("10.1234/unknown.prefix.2020") is None


def test_application_slug():
    from omat_core.normalize import make_application
    app = make_application("Coatings / Barriers")
    assert app.slug == "coatings-barriers"


def test_search_text_shape():
    text = build_search_text(
        label="Al95.89-Cr1.37-N1.37-Ti1.37",
        elements=["Al", "Cr", "N", "Ti"],
        property_name="Young's modulus",
        journal_name="Materials Letters",
        applications=["Coatings / Barriers"],
    )
    assert "Al95.89-Cr1.37-N1.37-Ti1.37" in text
    assert "Ti" in text and "Barriers" in text


def test_slugify():
    assert slugify("Coatings / Barriers") == "coatings-barriers"
    assert slugify("Microelectronic components") == "microelectronic-components"
