"""Composition parsing tests using real shapes from final_data.csv."""

import pytest

from omat_core.composition import (
    CompositionError,
    canonical_formula,
    parse_composition,
    species_to_atoms,
    to_vector,
)


def test_metallic_alloy_row():
    comp, warning = parse_composition(
        "[('Al', 95.89, 'mol'), ('Cr', 1.37, 'mol'), ('N', 1.37, 'mol'), ('Ti', 1.37, 'mol')]",
        "{'Cr', 'N', 'Al', 'Ti'}",
    )
    assert warning is None
    assert comp is not None
    assert {e.symbol for e in comp.elements} == {"Al", "Cr", "N", "Ti"}
    top = comp.elements[0]
    assert top.symbol == "Al" and 95.0 < top.at_pct < 96.0
    assert comp.canonical.startswith("Al95.89")


def test_oxide_species_expands_to_atoms():
    # Real glass row: species are oxides, Elements holds atoms.
    comp, warning = parse_composition(
        "[('B2O3', 14.2, 'mol'), ('Li2O', 20.0, 'mol'),"
        " ('P2O5', 9.0, 'mol'), ('SiO2', 56.8, 'mol')]",
        "{'B', 'Li', 'O', 'P', 'Si'}",
    )
    assert warning is None  # the "mismatch" is expected, not an error
    assert {e.symbol for e in comp.elements} == {"B", "Li", "O", "P", "Si"}
    oxygen = next(e for e in comp.elements if e.symbol == "O")
    assert oxygen.at_pct > 50.0  # dominates glass compositions


def test_empty_composition_is_none_not_error():
    comp, warning = parse_composition("[]")
    assert comp is None and warning is None


def test_malformed_entries_raise():
    with pytest.raises(CompositionError):
        parse_composition("[('Al', 'heavy', 'mol')]")
    with pytest.raises(CompositionError):
        parse_composition("not a literal at all")
    with pytest.raises(CompositionError):
        parse_composition("[('Xx4', 50.0, 'mol')]")


def test_bad_sum_warns_not_rejects():
    comp, warning = parse_composition("[('Fe', 98.5, 'mol'), ('Ti', 1.5, 'mol')]")  # 100.0
    assert comp is not None
    comp2, warning2 = parse_composition("[('Fe', 90.0, 'mol'), ('Ti', 1.5, 'mol')]")
    assert comp2 is not None
    assert warning2 is not None and "sum to" in warning2


def test_wt_percent_converts_via_molar_mass():
    # 50 wt% Fe / 50 wt% Al: Fe is heavier, so Al has more atoms.
    comp, _ = parse_composition("[('Fe', 50.0, 'wt'), ('Al', 50.0, 'wt')]")
    al = next(e for e in comp.elements if e.symbol == "Al")
    fe = next(e for e in comp.elements if e.symbol == "Fe")
    assert al.at_pct > fe.at_pct


def test_species_to_atoms_handles_parentheses():
    assert species_to_atoms("Ca(OH)2") == {"Ca": 1.0, "O": 2.0, "H": 2.0}
    assert species_to_atoms("Ti") == {"Ti": 1.0}


def test_vector_is_118_dims_atomic_number_order():
    comp, _ = parse_composition("[('Fe', 98.5, 'mol'), ('Ti', 1.5, 'mol')]")
    vec = to_vector(comp.elements)
    assert len(vec) == 118
    assert vec[25] == pytest.approx(98.5)  # Fe, Z=26 -> index 25
    assert vec[21] == pytest.approx(1.5)  # Ti, Z=22 -> index 21
    assert sum(vec) == pytest.approx(100.0)


def test_canonical_orders_descending():
    # Row sums to exactly 100, so at% equals the raw mol values.
    comp, _ = parse_composition(
        "[('Al', 95.89, 'mol'), ('Cr', 1.37, 'mol'), ('N', 1.37, 'mol'), ('Ti', 1.37, 'mol')]"
    )
    assert canonical_formula(comp.elements) == "Al95.89-Cr1.37-N1.37-Ti1.37"
