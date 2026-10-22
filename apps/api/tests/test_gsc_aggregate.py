from typing import Any

from fastapi.testclient import TestClient

from omat_api.deps import get_opensearch
from omat_api.main import app


def hit(
    pii: str,
    canonical: str,
    elements: list[str],
    slug: str,
    name: str,
    value: float,
    unit: str,
) -> dict[str, Any]:
    return {
        "_id": f"{pii}|{canonical}|{slug}|{value}",
        "_source": {
            "article_pii": pii,
            "composition": {"canonical": canonical, "label": canonical},
            "elements": elements,
            "property": {"slug": slug, "name": name, "value": value, "unit": unit},
        },
        "sort": [f"{pii}|{canonical}|{slug}|{value}"],
    }


class FakeOpenSearch:
    """One page of canned hits is enough: the scan stops before paging."""

    def __init__(self, hits: list[dict[str, Any]]) -> None:
        self._hits = hits

    async def search(self, *, index: str, body: dict[str, Any]) -> dict[str, Any]:
        return {"hits": {"hits": self._hits, "total": {"value": len(self._hits)}}}


HITS = [
    hit("P1", "c1", ["Ag", "S"], "hardness", "Hardness", 1.5, "GPa"),
    hit("P1", "c1", ["Ag", "S"], "density", "Density", 3.7, "g/cm³"),
    hit("P1", "c2", ["Ag", "S"], "hardness", "Hardness", 1.4, "GPa"),
    hit("P1", "c2", ["Ag", "S"], "density", "Density", 3.9, "g/cm³"),
    hit("P1", "c3", ["Ag", "S"], "hardness", "Hardness", 1.3, "GPa"),
    hit("P1", "c3", ["Ag", "S"], "density", "Density", 4.2, "g/cm³"),
    # hardness-only material: never paired
    hit("P3", "c1", ["Cr", "N"], "hardness", "Hardness", 18.0, "GPa"),
]


def test_gsc_aggregate_builds_families() -> None:
    app.dependency_overrides[get_opensearch] = lambda: FakeOpenSearch(HITS)
    try:
        with TestClient(app) as client:
            response = client.get(
                "/v1/aggregates",
                params={
                    "kind": "gsc",
                    "property_a": "hardness",
                    "property_b": "density",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "gsc"
    assert body["property_a"] == {
        "slug": "hardness",
        "name": "Hardness",
        "unit": "GPa",
    }
    assert body["property_b"]["unit"] == "g/cm³"
    assert [family["family"] for family in body["families"]] == ["['Ag', 'S']"]
    assert body["families"][0]["count"] == 3
    assert len(body["families"][0]["hull"]) >= 3
    assert body["total_points"] == 3


def test_gsc_aggregate_validates_params() -> None:
    app.dependency_overrides[get_opensearch] = lambda: FakeOpenSearch([])
    try:
        with TestClient(app) as client:
            missing = client.get(
                "/v1/aggregates", params={"kind": "gsc", "property_a": "hardness"}
            )
            same = client.get(
                "/v1/aggregates",
                params={
                    "kind": "gsc",
                    "property_a": "hardness",
                    "property_b": "hardness",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert missing.status_code == 422
    assert same.status_code == 422