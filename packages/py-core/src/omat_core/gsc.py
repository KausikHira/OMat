"""Glass-structure-composition (GSC) chart data.

Port of the analysis notebook (final_gsc_3.ipynb): materials that measured
both chosen properties are plotted as ``(x, y)`` points and grouped into
composition *families* by their element set. Each family is rendered as a
smoothed convex hull filled at low opacity.

The notebook used ``scipy.spatial.ConvexHull`` + ``splprep``/``splev``; this
module reproduces the visual with a monotone-chain hull and two rounds of
closed Chaikin corner cutting, so py-core stays dependency-light and the
whole transform stays pure and unit-testable. Axes are clipped to >= 0 the
way the notebook clipped negative spline overshoot.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

Point = tuple[float, float]

MAX_FAMILIES = 12  # notebook: top 12 composition families
MIN_UNIQUE_POINTS = 3  # a hull needs >= 3 non-collinear points


@dataclass(frozen=True)
class GscRow:
    """One indexed measurement document, reduced to what the GSC chart needs."""

    article_pii: str
    canonical: str  # composition identity within the paper (may be "")
    elements: tuple[str, ...]
    slug: str  # property.slug
    name: str  # property.name
    value: float  # property.value in its native unit
    unit: str


def family_name(elements: Iterable[str]) -> str:
    """Sorted element set as the family label, notebook style: "['Ag', 'S']"."""
    return str(sorted({element for element in elements if element}))


def convex_hull(points: Sequence[Point]) -> list[Point]:
    """Andrew monotone chain. Returns hull vertices in CCW order (open loop)."""
    if len(points) < 3:
        return list(points)

    def cross(origin: Point, a: Point, b: Point) -> float:
        return (a[0] - origin[0]) * (b[1] - origin[1]) - (
            a[1] - origin[1]
        ) * (b[0] - origin[0])

    ordered = sorted(set(points))
    lower: list[Point] = []
    for point in ordered:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper: list[Point] = []
    for point in reversed(ordered):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def chaikin_smooth(points: Sequence[Point], iterations: int = 2) -> list[Point]:
    """Closed-polygon Chaikin corner cutting: rounds the hull into a blob."""
    if len(points) < 3:
        return list(points)
    smoothed = list(points)
    for _ in range(iterations):
        nxt: list[Point] = []
        count = len(smoothed)
        for i in range(count):
            current, nxt_point = smoothed[i], smoothed[(i + 1) % count]
            nxt.append(
                (
                    0.75 * current[0] + 0.25 * nxt_point[0],
                    0.75 * current[1] + 0.25 * nxt_point[1],
                )
            )
            nxt.append(
                (
                    0.25 * current[0] + 0.75 * nxt_point[0],
                    0.25 * current[1] + 0.75 * nxt_point[1],
                )
            )
        smoothed = nxt
    return smoothed


def _is_degenerate(points: Sequence[Point]) -> bool:
    """True when all points share an x or y value: no area for a hull."""
    if not points:
        return True
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return max(xs) - min(xs) == 0 or max(ys) - min(ys) == 0


def build_gsc(
    rows: Sequence[GscRow],
    property_a: str,
    property_b: str,
    max_families: int = MAX_FAMILIES,
) -> dict[str, Any]:
    """Group paired measurements into families and compute smoothed hulls.

    Materials are joined across property documents by (PII, canonical
    composition): one source material measured for both properties becomes
    one point. Families are the element sets of those materials, ranked by
    how many materials they cover (notebook: count desc, name asc, top 12).
    """
    materials: dict[tuple[str, str], dict[str, GscRow]] = {}
    for row in rows:
        if row.slug not in (property_a, property_b):
            continue
        materials.setdefault((row.article_pii, row.canonical), {})[row.slug] = row

    points_by_family: dict[str, list[Point]] = {}
    labels: dict[str, dict[str, str]] = {property_a: {}, property_b: {}}
    for by_slug in materials.values():
        a_row = by_slug.get(property_a)
        b_row = by_slug.get(property_b)
        if a_row is None or b_row is None:
            continue  # material measured only one of the two properties
        if a_row.value <= 0 or b_row.value <= 0:
            continue  # notebook: drop rows where either property is 0/NaN
        for row in (a_row, b_row):
            labels.setdefault(row.slug, {"slug": row.slug, "name": row.name, "unit": row.unit})
        if not a_row.elements:
            continue  # no composition: no family to belong to
        family = family_name(a_row.elements)
        points_by_family.setdefault(family, []).append((a_row.value, b_row.value))

    ranked = sorted(
        points_by_family.items(), key=lambda item: (-len(item[1]), item[0])
    )[:max_families]

    families: list[dict[str, Any]] = []
    for name, points in ranked:
        unique = sorted(set(points))
        if len(unique) < MIN_UNIQUE_POINTS or _is_degenerate(unique):
            continue  # notebook: skip families a hull cannot cover
        hull = convex_hull(unique)
        smoothed = [(max(x, 0.0), max(y, 0.0)) for x, y in chaikin_smooth(hull)]
        families.append(
            {
                "family": name,
                "count": len(points),
                "points": [[x, y] for x, y in unique],
                "hull": [[x, y] for x, y in smoothed],
            }
        )

    return {
        "property_a": labels.get(property_a, {"slug": property_a}),
        "property_b": labels.get(property_b, {"slug": property_b}),
        "families": families,
        "total_points": sum(len(points) for points in points_by_family.values()),
    }