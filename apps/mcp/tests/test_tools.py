"""MCP tool tests: every tool delegates to py-core and needs no live services."""

from typing import Any

import pytest

import omat_mcp.server as server


class FakeOpenSearch:
    """Records the last request and returns canned hits."""

    def __init__(self, hits: list[dict[str, Any]] | None = None) -> None:
        self.hits = hits or []
        self.requests: list[dict[str, Any]] = []

    def search(self, *, index: str, body: dict[str, Any]) -> dict[str, Any]:
        self.requests.append(body)
        if "aggs" in body:
            # aggregation-shaped canned response: echo the agg names
            aggregations: dict[str, Any] = {}
            for name in body["aggs"]:
                agg = body["aggs"][name]
                if "histogram" in agg or "stats" in agg:
                    aggregations[name] = {"count": 0, "min": 0, "max": 0, "avg": None, "sum": 0}
                else:
                    aggregations[name] = {"buckets": [{"key": "fake", "doc_count": 2}]}
            return {"hits": {"hits": [], "total": {"value": 0}}, "aggregations": aggregations}
        return {"hits": {"hits": self.hits, "total": {"value": len(self.hits)}}}


def prop_hit(
    pii: str, canonical: str, slug: str, name: str, value: float, unit: str
) -> dict[str, Any]:
    return {
        "_id": f"{pii}|{canonical}|{slug}",
        "_source": {
            "article_pii": pii,
            "composition": {"canonical": canonical},
            "elements": ["Ag", "S"],
            "property": {"slug": slug, "name": name, "value": value, "unit": unit},
        },
        "sort": [f"{pii}|{canonical}|{slug}"],
    }


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch):
    client = FakeOpenSearch()
    monkeypatch.setattr(server, "_client", lambda: client)
    return client


def test_search_records_passes_filters_and_interpretation(fake_client: FakeOpenSearch) -> None:
    hits = [
        {
            "_id": "r1",
            "_source": {"record_id": "r1", "title": "TiN coatings", "doi": "10.1/x"},
        }
    ]
    fake_client.hits = hits
    result = server.search_records(
        query="TiAlN coating",
        elements=["Ti", "Al"],
        applications=["coatings-barriers"],
        journal=["surfcoat"],
        limit=5,
    )
    assert result == [hits[0]["_source"]]
    body = fake_client.requests[0] if isinstance(fake_client.requests, list) else None
    assert body is not None
    filters = body["query"]["bool"]["filter"]
    assert {"terms": {"elements": ["Ti", "Al"]}} in filters
    assert {"terms": {"applications.slug": ["coatings-barriers"]}} in filters
    assert {"terms": {"journal.slug": ["surfcoat"]}} in filters
    assert "title" in body["_source"]


def test_facet_counts_applies_query_and_filters(fake_client: FakeOpenSearch) -> None:
    result = server.facet_counts(
        field="property", query="stiff coatings", elements=["Ti"], applications=None
    )
    body = fake_client.requests[0]
    assert body["query"] != {"match_all": {}}
    assert {"terms": {"elements": ["Ti"]}} in body["query"]["bool"]["filter"]
    assert result == [{"value": "fake", "count": 2}]
    assert server.facet_counts(field="nonsense") == [{"error": "unknown facet nonsense"}]


def test_suggest_uses_shared_dsl(fake_client: FakeOpenSearch) -> None:
    result = server.suggest("ti")
    body = fake_client.requests[0]
    should = body["query"]["bool"]["should"]
    assert any("match_bool_prefix" in clause for clause in should)
    assert result["elements"] == ["fake"]
    # empty prefix never reaches the backend
    assert server.suggest("  ") == {
        "query": "  ",
        "formulas": [],
        "elements": [],
        "properties": [],
        "journals": [],
    }
    assert len(fake_client.requests) == 1


def test_props_scatter_tool_runs_notebook_math(fake_client: FakeOpenSearch) -> None:
    fake_client.hits = [
        prop_hit("P1", "c1", "tg", "Glass transition temperature", 650.0, "K"),
        prop_hit("P1", "c1", "ea", "Activation energy", 2.5, "eV"),
        prop_hit("P1", "c1", "tx", "Crystallization temperature", 820.0, "K"),
    ]
    result = server.props_scatter("tg", "ea", "tx", 600.0, 2.0, 800.0)
    assert result["counts"] == {"merged": 1, "plotted": 1, "highlighted": 1}
    assert result["points"] == [[650.0, 2.5, 820.0, 1.0]]
    assert result["property_a"]["name"] == "Glass transition temperature"
    # partial thresholds are ignored (all-or-nothing criteria)
    result = server.props_scatter("tg", "ea", "tx", 600.0)
    assert result["thresholds"] is None
    # duplicate properties are rejected without touching the backend
    assert "error" in server.props_scatter("tg", "tg", "tx")


def test_gsc_chart_tool_runs_family_math(fake_client: FakeOpenSearch) -> None:
    fake_client.hits = [
        prop_hit("P1", "c1", "hardness", "Hardness", 1.5, "GPa"),
        prop_hit("P1", "c1", "density", "Density", 3.7, "g/cm³"),
        prop_hit("P1", "c2", "hardness", "Hardness", 1.4, "GPa"),
        prop_hit("P1", "c2", "density", "Density", 3.9, "g/cm³"),
    ]
    result = server.gsc_chart("hardness", "density")
    assert result["total_points"] == 2
    assert "error" in server.gsc_chart("hardness", "hardness")


def test_get_paper_returns_title(fake_client: FakeOpenSearch) -> None:
    fake_client.hits = [
        {
            "_id": "r1",
            "_source": {
                "record_id": "r1",
                "doi": "10.1016/j.matlet.2020.129009",
                "article_pii": "S0167577X2031716X",
                "title": "Micro-scale impact resistance",
            },
        }
    ]
    result = server.get_paper("10.1016/j.matlet.2020.129009")
    assert result["title"] == "Micro-scale impact resistance"
    assert result["record_count"] == 1
