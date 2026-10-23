"""Tests for the three-property scatter (notebook port)."""

import pytest

from omat_core.gsc import GscRow
from omat_core.props_plot import NOTEBOOK_CRITERIA, build_props_scatter, percentile


def row(pii: str, canonical: str, slug: str, value: float, name: str, unit: str) -> GscRow:
    return GscRow(
        article_pii=pii,
        canonical=canonical,
        elements=("Ag", "S"),
        slug=slug,
        name=name,
        value=value,
        unit=unit,
    )


def test_percentile_matches_pandas_semantics() -> None:
    values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    # pandas quantile(0.01) interpolates: 1 + (10-1)*0.01 = 1.09... actually
    # (n-1)*q = 0.09 -> between 1.0 and 2.0 with weight 0.09.
    assert percentile(values, 0.01) == pytest.approx(1.09)
    assert percentile(values, 0.5) == pytest.approx(5.5)
    assert percentile(values, 0.99) == pytest.approx(9.91)
    assert percentile([4.2], 0.01) == 4.2


def test_merges_only_materials_with_all_three_properties() -> None:
    rows = [
        row("P1", "c1", "tg", 650.0, "Glass transition temperature", "K"),
        row("P1", "c1", "ea", 2.5, "Activation energy", "eV"),
        row("P1", "c1", "tx", 820.0, "Crystallization temperature", "K"),
        # only two of three properties: never merged
        row("P2", "c1", "tg", 700.0, "Glass transition temperature", "K"),
        row("P2", "c1", "ea", 3.0, "Activation energy", "eV"),
        # zero value: dropped like the notebook drops zeros
        row("P3", "c1", "tg", 0.0, "Glass transition temperature", "K"),
        row("P3", "c1", "ea", 3.0, "Activation energy", "eV"),
        row("P3", "c1", "tx", 900.0, "Crystallization temperature", "K"),
    ]
    chart = build_props_scatter(rows, "tg", "ea", "tx", thresholds=(600.0, 2.0, 800.0))

    assert chart["counts"]["merged"] == 1
    assert chart["counts"]["plotted"] == 1
    assert chart["counts"]["highlighted"] == 1
    assert chart["points"] == [[650.0, 2.5, 820.0, 1.0]]
    assert chart["property_a"] == {
        "slug": "tg",
        "name": "Glass transition temperature",
        "unit": "K",
    }
    assert chart["property_c"]["unit"] == "K"


def test_outlier_filtering_drops_the_whole_material() -> None:
    rows = []
    for i in range(1, 12):
        rows.append(row(f"P{i}", "c1", "tg", 500.0 + i, "Tg", "K"))
        rows.append(row(f"P{i}", "c1", "ea", 2.0 + i * 0.1, "Ea", "eV"))
        rows.append(row(f"P{i}", "c1", "tx", 800.0 + i, "Tx", "K"))
    # extreme z outlier: its material must vanish from the plot entirely
    rows.append(row("P99", "c1", "tg", 600.0, "Tg", "K"))
    rows.append(row("P99", "c1", "ea", 2.5, "Ea", "eV"))
    rows.append(row("P99", "c1", "tx", 10_000.0, "Tx", "K"))

    chart = build_props_scatter(rows, "tg", "ea", "tx")

    assert chart["counts"]["merged"] == 12
    # At n=12 the 1st/99th percentile interpolation also clips the unique
    # min (P1, below the tg p1 bound) and the unique max (P11, above the ea
    # p99 bound) — the same thing pandas quantile does on small samples.
    # P99's extreme tx makes the whole material vanish.
    assert chart["counts"]["plotted"] == 9
    assert all(point[2] < 10_000.0 for point in chart["points"])
    xs = {point[0] for point in chart["points"]}
    assert 501.0 not in xs  # P1 dropped entirely, not just clamped
    assert 600.0 not in xs  # P99 dropped entirely
    # every survivor lies inside all three bounds
    for axis in ("a", "b", "c"):
        low, high = chart["bounds"][axis]
        index = {"a": 0, "b": 1, "c": 2}[axis]
        assert all(low <= point[index] <= high for point in chart["points"])


def test_thresholds_flag_only_materials_meeting_all_criteria() -> None:
    # Ties at the axis extremes keep every material inside the p1/p99
    # bounds (the bound lands exactly on the tied value), so each "fails
    # one criterion" case survives filtering and only the flags differ.
    materials = [
        ("A", 650.0, 2.5, 820.0),  # meets all three -> highlighted
        ("B", 500.0, 2.5, 820.0),  # fails tg
        ("C", 500.0, 2.5, 820.0),  # twin of B (tie at the tg minimum)
        ("D", 650.0, 2.5, 790.0),  # fails tx
        ("E", 650.0, 2.5, 790.0),  # twin of D
        ("F", 650.0, 1.5, 820.0),  # fails ea
        ("G", 650.0, 1.5, 820.0),  # twin of F
    ]
    rows = []
    for name, tg, ea, tx in materials:
        rows.append(row(name, "c1", "tg", tg, "Tg", "K"))
        rows.append(row(name, "c1", "ea", ea, "Ea", "eV"))
        rows.append(row(name, "c1", "tx", tx, "Tx", "K"))

    chart = build_props_scatter(rows, "tg", "ea", "tx", thresholds=(600.0, 2.0, 800.0))

    assert chart["counts"]["plotted"] == 7
    flags = {tuple(point[:3]): point[3] for point in chart["points"]}
    assert flags[(650.0, 2.5, 820.0)] == 1.0
    assert flags[(500.0, 2.5, 820.0)] == 0.0  # fails tg
    assert flags[(650.0, 2.5, 790.0)] == 0.0  # fails tx
    assert flags[(650.0, 1.5, 820.0)] == 0.0  # fails ea
    assert chart["counts"]["highlighted"] == 1

    # without thresholds nothing is flagged and the field is null
    chart = build_props_scatter(rows, "tg", "ea", "tx")
    assert chart["thresholds"] is None
    assert all(point[3] == 0.0 for point in chart["points"])


def test_notebook_criteria_are_criteria_8() -> None:
    slugs = tuple(slug for slug, _ in NOTEBOOK_CRITERIA)
    thresholds = tuple(value for _, value in NOTEBOOK_CRITERIA)
    assert slugs == (
        "glass_transition_temperature",
        "activation_energy",
        "crystallization_temperature",
    )
    assert thresholds == (600.0, 2.0, 800.0)


def test_empty_input_is_graceful() -> None:
    chart = build_props_scatter([], "tg", "ea", "tx")
    assert chart["counts"] == {"merged": 0, "plotted": 0, "highlighted": 0}
    assert chart["points"] == []
    # axis metadata still resolves so the client can label axes
    assert chart["property_a"]["slug"] == "tg"
