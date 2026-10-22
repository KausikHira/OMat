from omat_core.gsc import (
    GscRow,
    build_gsc,
    chaikin_smooth,
    convex_hull,
    family_name,
)


def row(
    pii: str,
    canonical: str,
    elements: tuple[str, ...],
    slug: str,
    value: float,
    name: str = "Property",
    unit: str = "unit",
) -> GscRow:
    return GscRow(
        article_pii=pii,
        canonical=canonical,
        elements=elements,
        slug=slug,
        name=name,
        value=value,
        unit=unit,
    )


def test_family_name_sorts_and_dedupes() -> None:
    assert family_name(("S", "Ag", "S", "Ge")) == "['Ag', 'Ge', 'S']"
    assert family_name(()) == "[]"


def test_convex_hull_drops_interior_points() -> None:
    square = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.5, 0.5)]
    hull = convex_hull(square)
    assert (0.5, 0.5) not in hull
    assert len(hull) == 4
    assert all(point in square for point in hull)


def test_chaikin_smooth_grows_and_rounds() -> None:
    square = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    smoothed = chaikin_smooth(square, iterations=2)
    assert len(smoothed) == 16  # 4 -> 8 -> 16, closed polygon
    # Every output is a convex combination of hull vertices, so nothing can
    # leave the hull. Points ON an edge stay on it (Chaikin cuts corners, it
    # does not shrink edges), so the bounds are inclusive.
    assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in smoothed)
    # The sharp corners themselves are gone after two rounds of cutting.
    assert all(corner not in smoothed for corner in square)


def test_build_gsc_pairs_materials_and_ranks_families() -> None:
    rows = [
        # family A: three materials with both hardness and density
        row("P1", "c1", ("Ag", "S"), "hardness", 1.5, "Hardness", "GPa"),
        row("P1", "c1", ("Ag", "S"), "density", 3.7, "Density", "g/cm³"),
        row("P1", "c2", ("Ag", "S"), "hardness", 1.4, "Hardness", "GPa"),
        row("P1", "c2", ("Ag", "S"), "density", 3.9, "Density", "g/cm³"),
        row("P1", "c3", ("Ag", "S"), "hardness", 1.3, "Hardness", "GPa"),
        row("P1", "c3", ("Ag", "S"), "density", 4.2, "Density", "g/cm³"),
        # family B: three materials, ranked after A
        row("P2", "c1", ("Ba", "O"), "hardness", 2.0, "Hardness", "GPa"),
        row("P2", "c1", ("Ba", "O"), "density", 5.0, "Density", "g/cm³"),
        row("P2", "c2", ("Ba", "O"), "hardness", 2.5, "Hardness", "GPa"),
        row("P2", "c2", ("Ba", "O"), "density", 5.7, "Density", "g/cm³"),
        row("P2", "c3", ("Ba", "O"), "hardness", 3.0, "Hardness", "GPa"),
        row("P2", "c3", ("Ba", "O"), "density", 6.0, "Density", "g/cm³"),
        # hardness only: never paired
        row("P3", "c1", ("Cr", "N"), "hardness", 18.0, "Hardness", "GPa"),
        # non-positive value: dropped like the notebook drops zeros
        row("P1", "c4", ("Ag", "S"), "hardness", 0.0, "Hardness", "GPa"),
        row("P1", "c4", ("Ag", "S"), "density", 3.0, "Density", "g/cm³"),
    ]

    chart = build_gsc(rows, "hardness", "density")

    assert chart["property_a"] == {
        "slug": "hardness",
        "name": "Hardness",
        "unit": "GPa",
    }
    assert chart["property_b"]["unit"] == "g/cm³"
    # families ranked by material count: A(3 materials) before B(2)
    assert [f["family"] for f in chart["families"]] == ["['Ag', 'S']", "['Ba', 'O']"]
    assert chart["families"][0]["count"] == 3
    assert chart["total_points"] == 6
    # every family carries a closed, smoothed hull polygon
    for family in chart["families"]:
        assert len(family["hull"]) >= 3
        assert family["hull"][0] != family["hull"][-1]


def test_build_gcs_skips_degenerate_families() -> None:
    rows = [
        # two distinct compositions but only two unique (x, y) points
        row("P", "c1", ("Ag", "S"), "hardness", 1.0),
        row("P", "c1", ("Ag", "S"), "density", 2.0),
        row("P", "c2", ("Ag", "S"), "hardness", 1.0),
        row("P", "c2", ("Ag", "S"), "density", 3.0),
        # all points share one x: aligned on an axis
        row("P", "c3", ("Ag", "S"), "hardness", 1.0),
        row("P", "c3", ("Ag", "S"), "density", 2.0),
        row("P", "c4", ("Ag", "S"), "hardness", 1.0),
        row("P", "c4", ("Ag", "S"), "density", 3.0),
    ]

    chart = build_gsc(rows, "hardness", "density")

    assert chart["families"] == []
    assert chart["total_points"] == 4


def test_build_gsc_skips_collinear_family() -> None:
    """A collinear family's hull collapses to 2 vertices: no blob to draw.

    Regression test: scipy's ConvexHull raises on this input, so the family
    must be skipped, never emitted with a degenerate 2-point hull.
    """
    rows = [
        # all three points sit on y = x + 3
        row("P", "c1", ("Ba", "O"), "hardness", 2.0, "Hardness", "GPa"),
        row("P", "c1", ("Ba", "O"), "density", 5.0, "Density", "g/cm³"),
        row("P", "c2", ("Ba", "O"), "hardness", 2.5, "Hardness", "GPa"),
        row("P", "c2", ("Ba", "O"), "density", 5.5, "Density", "g/cm³"),
        row("P", "c3", ("Ba", "O"), "hardness", 3.0, "Hardness", "GPa"),
        row("P", "c3", ("Ba", "O"), "density", 6.0, "Density", "g/cm³"),
    ]

    chart = build_gsc(rows, "hardness", "density")

    assert chart["families"] == []
    assert chart["total_points"] == 3
