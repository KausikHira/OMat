from typing import Any

from fastapi.testclient import TestClient

from omat_api.deps import get_opensearch
from omat_api.main import app


def hit(pii: str, canonical: str, slug: str, name: str, value: float, unit: str) -> dict[str, Any]:
    return {
        "_id": f"{pii}|{canonical}|{slug}|{value}",
        "_source": {
            "article_pii": pii,
            "composition": {"canonical": canonical, "label": canonical},
            "elements": ["Ag", "S"],
            "property": {"slug": slug, "name": name, "value": value, "unit": unit},
        },
        "sort": [f"{pii}|{canonical}|{slug}|{value}"],
    }


class FakeOpenSearch:
    """One page of canned hits is enough: the scan stops before paging."""

    def __init__(self, hits: list[dict[str, Any]]) -> None:
        self._hits = hits
        self.last_body: dict[str, Any] | None = None

    async def search(self, *, index: str, body: dict[str, Any]) -> dict[str, Any]:
        self.last_body = body
        return {"hits": {"hits": self._hits, "total": {"value": len(self._hits)}}}


HITS = [
    hit("P1", "c1", "tg", "Glass transition temperature", 650.0, "K"),
    hit("P1", "c1", "ea", "Activation energy", 2.5, "eV"),
    hit("P1", "c1", "tx", "Crystallization temperature", 820.0, "K"),
    # only two of three: never merged
    hit("P2", "c1", "tg", "Glass transition temperature", 700.0, "K"),
    hit("P2", "c1", "ea", "Activation energy", 3.0, "eV"),
]


def test_props_scatter_builds_points_and_flags_thresholds() -> None:
    fake = FakeOpenSearch(HITS)
    app.dependency_overrides[get_opensearch] = lambda: fake
    try:
        with TestClient(app) as client:
            response = client.get(
                "/v1/aggregates",
                params={
                    "kind": "props_scatter",
                    "property_a": "tg",
                    "property_b": "ea",
                    "property_c": "tx",
                    "threshold_a": 600,
                    "threshold_b": 2,
                    "threshold_c": 800,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "props_scatter"
    assert body["property_a"] == {
        "slug": "tg",
        "name": "Glass transition temperature",
        "unit": "K",
    }
    assert body["property_c"]["unit"] == "K"
    assert body["counts"] == {"merged": 1, "plotted": 1, "highlighted": 1}
    assert body["points"] == [[650.0, 2.5, 820.0, 1.0]]
    assert body["thresholds"] == [600.0, 2.0, 800.0]
    # the scan filtered to exactly the three requested slugs
    assert fake.last_body is not None
    assert fake.last_body["query"]["bool"]["filter"][0] == {
        "terms": {"property.slug": ["tg", "ea", "tx"]}
    }


def test_props_scatter_without_thresholds_highlights_nothing() -> None:
    app.dependency_overrides[get_opensearch] = lambda: FakeOpenSearch(HITS)
    try:
        with TestClient(app) as client:
            response = client.get(
                "/v1/aggregates",
                params={
                    "kind": "props_scatter",
                    "property_a": "tg",
                    "property_b": "ea",
                    "property_c": "tx",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["thresholds"] is None
    assert all(point[3] == 0.0 for point in body["points"])


def test_props_scatter_validates_params() -> None:
    app.dependency_overrides[get_opensearch] = lambda: FakeOpenSearch([])
    try:
        with TestClient(app) as client:
            missing = client.get(
                "/v1/aggregates",
                params={"kind": "props_scatter", "property_a": "tg", "property_b": "ea"},
            )
            same = client.get(
                "/v1/aggregates",
                params={
                    "kind": "props_scatter",
                    "property_a": "tg",
                    "property_b": "tg",
                    "property_c": "tx",
                },
            )
            partial_thresholds = client.get(
                "/v1/aggregates",
                params={
                    "kind": "props_scatter",
                    "property_a": "tg",
                    "property_b": "ea",
                    "property_c": "tx",
                    "threshold_a": 600,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert missing.status_code == 422
    assert same.status_code == 422
    # partial thresholds are ignored (None), not a 422: the notebook's
    # criteria are all-or-nothing
    assert partial_thresholds.status_code == 200
    assert partial_thresholds.json()["thresholds"] is None
