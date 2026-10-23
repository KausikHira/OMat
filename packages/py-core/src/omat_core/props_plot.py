"""Three-property scatter plot with percentile and threshold filtering.

Port of ``plot_3_props_ultimate_with_filtering.ipynb``: materials measured
for all three chosen properties are plotted as ``(x, y)`` points colored by
the third property; a material whose value on any axis falls outside the
1st/99th percentile of that axis is dropped entirely ("ultimate
filtering"); materials meeting all three ``>= threshold`` criteria are
highlighted (blue rings in the client).

Like the GSC module this is pure, dependency-light math — no pandas, no
matplotlib — so py-core stays the single owner of chart semantics and the
whole transform stays unit-testable.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .gsc import GscRow

__all__ = ["build_props_scatter", "percentile"]

# The notebook's active criteria set ("criteria 8"): glass-transition
# temperature, activation energy, crystallization temperature, with the
# thresholds used for the highlighted (blue) materials. Kept here so the
# notebook provenance is documented where the math lives.
NOTEBOOK_CRITERIA: tuple[tuple[str, float], ...] = (
    ("glass_transition_temperature", 600.0),
    ("activation_energy", 2.0),
    ("crystallization_temperature", 800.0),
)


def percentile(values: Sequence[float], q: float) -> float:
    """Linear-interpolation quantile, pandas ``quantile`` compatible.

    ``q`` is a fraction (0.01 for the 1st percentile).
    """
    ordered = sorted(values)
    if not ordered:
        raise ValueError("percentile of an empty sequence")
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * q
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _merge_triples(
    rows: Sequence[GscRow], property_a: str, property_b: str, property_c: str
) -> list[dict[str, Any]]:
    """Materials measured for all three properties, keyed (PII, composition)."""
    materials: dict[tuple[str, str], dict[str, GscRow]] = {}
    wanted = (property_a, property_b, property_c)
    for row in rows:
        if row.slug in wanted:
            materials.setdefault((row.article_pii, row.canonical), {})[row.slug] = row

    merged: list[dict[str, Any]] = []
    for by_slug in materials.values():
        a_row = by_slug.get(property_a)
        b_row = by_slug.get(property_b)
        c_row = by_slug.get(property_c)
        if a_row is None or b_row is None or c_row is None:
            continue  # needs all three properties
        if a_row.value <= 0 or b_row.value <= 0 or c_row.value <= 0:
            continue  # notebook drops zero/NaN values before filtering
        merged.append(
            {
                "pii": a_row.article_pii,
                "x": a_row.value,
                "y": b_row.value,
                "z": c_row.value,
                "labels": {
                    property_a: (a_row.name, a_row.unit),
                    property_b: (b_row.name, b_row.unit),
                    property_c: (c_row.name, c_row.unit),
                },
            }
        )
    return merged


def build_props_scatter(
    rows: Sequence[GscRow],
    property_a: str,
    property_b: str,
    property_c: str,
    thresholds: tuple[float, float, float] | None = None,
) -> dict[str, Any]:
    """Merge, outlier-filter, and threshold-flag the three-property scatter.

    Returns the aggregate payload for ``GET /v1/aggregates?kind=props_scatter``:
    axis metadata, the surviving ``[x, y, z, highlighted]`` points, the
    percentile bounds used for filtering, and the counts at each stage.
    ``thresholds`` mirrors the notebook's criteria (``x >= t1 and y >= t2
    and z >= t3``); ``None`` means no criteria were supplied and nothing is
    highlighted.
    """
    merged = _merge_triples(rows, property_a, property_b, property_c)

    xs = [m["x"] for m in merged]
    ys = [m["y"] for m in merged]
    zs = [m["z"] for m in merged]
    bounds = {
        "a": (percentile(xs, 0.01), percentile(xs, 0.99)) if xs else (0.0, 0.0),
        "b": (percentile(ys, 0.01), percentile(ys, 0.99)) if ys else (0.0, 0.0),
        "c": (percentile(zs, 0.01), percentile(zs, 0.99)) if zs else (0.0, 0.0),
    }

    # Notebook: drop the whole material if any of its three values is an
    # outlier on its own axis.
    kept = [
        m
        for m in merged
        if bounds["a"][0] <= m["x"] <= bounds["a"][1]
        and bounds["b"][0] <= m["y"] <= bounds["b"][1]
        and bounds["c"][0] <= m["z"] <= bounds["c"][1]
    ]

    labels: dict[str, dict[str, str]] = {}
    if kept:
        for slug, (name, unit) in kept[0]["labels"].items():
            labels[slug] = {"slug": slug, "name": name, "unit": unit}
    for slug in (property_a, property_b, property_c):
        labels.setdefault(slug, {"slug": slug, "name": slug, "unit": ""})

    highlighted = 0
    points: list[list[float]] = []
    for material in kept:
        flag = 0.0
        if thresholds is not None:
            t_a, t_b, t_c = thresholds
            flag = float(material["x"] >= t_a and material["y"] >= t_b and material["z"] >= t_c)
            highlighted += int(flag)
        points.append([material["x"], material["y"], material["z"], flag])

    return {
        "property_a": labels[property_a],
        "property_b": labels[property_b],
        "property_c": labels[property_c],
        "thresholds": list(thresholds) if thresholds is not None else None,
        # [x, y, z, highlighted] tuples; clients must not read them as objects
        "points": points,
        "bounds": {
            "a": list(bounds["a"]),
            "b": list(bounds["b"]),
            "c": list(bounds["c"]),
        },
        "counts": {
            "merged": len(merged),
            "plotted": len(kept),
            "highlighted": highlighted,
        },
    }
