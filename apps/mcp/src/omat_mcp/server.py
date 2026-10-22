"""MCP server built on the Python SDK's FastMCP.

Local (stdio):
    python -m omat_mcp.server

Remote (streamable HTTP): ``mcp.run(transport="streamable-http")`` behind the
ALB. Tools delegate to the same query builders the FastAPI routers use, so the
agent surface and the REST surface cannot drift.
"""

from __future__ import annotations

import asyncio
import os
from functools import lru_cache
from typing import Any

from mcp.server.fastmcp import FastMCP

from omat_core.opensearch import (
    ALIAS,
    FACET_AGGS,
    build_search_query,
)
from omat_core.opensearch.client import make_client
from omat_core.valency import Valency, ValencyClient, ValencyUnavailable

mcp = FastMCP("omat-se")

SEARCH_FIELDS = [
    "record_id", "article_pii", "doi", "paper_link", "has_composition",
    "has_property", "composition.canonical", "composition.elements",
    "property.name", "property.slug", "property.value", "property.unit",
    "property.value_si", "elements", "species", "journal.name", "year",
    "applications.raw",
]


@lru_cache
def _client():
    url = os.environ.get("OMAT_OPENSEARCH_URL", "http://localhost:9200")
    return make_client(url)


@lru_cache
def _valency() -> Valency | None:
    token = os.environ.get("OMAT_VALENCY_BEARER_TOKEN")
    if not token or os.environ.get("OMAT_VALENCY_ENABLED", "true").lower() != "true":
        return None
    url = os.environ.get("OMAT_VALENCY_MCP_URL", "https://mcp.valency.io/")
    return Valency(ValencyClient(bearer_token=token, url=url))


def _run(coro):
    return asyncio.run(coro)


@mcp.tool()
def search_records(
    query: str = "",
    elements: list[str] | None = None,
    property_slug: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search measurement records by composition, property, journal, or application.

    Args:
        query: free-text (composition label, property name, journal words).
        elements: element symbols all of which must be present (e.g. ["Ti", "O"]).
        property_slug: property filter, e.g. youngs_modulus, hardness, density.
        min_value/max_value: numeric range on property value (use with property_slug).
        limit: max records returned (1-50).
    """
    body = {
        "query": build_search_query(
            query or None,
            {"elements": elements or []},
            (min_value, max_value) if property_slug else None,
            property_slug,
        ),
        "size": max(1, min(limit, 50)),
        "_source": SEARCH_FIELDS,
        "sort": [{"_score": "desc"}],
    }
    response = _client().search(index=ALIAS, body=body)
    return [hit["_source"] for hit in response["hits"]["hits"]]


@mcp.tool()
def get_paper(doi_or_pii: str) -> dict[str, Any]:
    """Return every measurement row for one paper, keyed by DOI or article PII."""
    is_doi = doi_or_pii.lower().startswith("10.")
    body = {
        "query": {"bool": {"should": [
            {"term": {"doi": doi_or_pii.lower() if is_doi else doi_or_pii}},
            {"term": {"article_pii": doi_or_pii.upper()}},
        ], "minimum_should_match": 1}},
        "size": 1000,
        "_source": SEARCH_FIELDS,
    }
    response = _client().search(index=ALIAS, body=body)
    hits = response["hits"]["hits"]
    if not hits:
        return {"error": "paper not found"}
    return {
        "doi": hits[0]["_source"]["doi"],
        "article_pii": hits[0]["_source"]["article_pii"],
        "record_count": len(hits),
        "records": [h["_source"] for h in hits],
    }


@mcp.tool()
def facet_counts(field: str = "property") -> list[dict[str, Any]]:
    """Count records per facet value. field: property | elements | journal | application."""
    agg = FACET_AGGS.get(field)
    if agg is None:
        return [{"error": f"unknown facet {field}"}]
    body = {"query": {"match_all": {}}, "size": 0, "aggs": {"facet": agg}}
    response = _client().search(index=ALIAS, body=body)
    return [
        {"value": b["key"], "count": b["doc_count"]}
        for b in response["aggregations"]["facet"]["buckets"]
    ]


@mcp.tool()
def search_literature(query: str, limit: int = 8) -> dict[str, Any]:
    """Search EXTERNAL preprint literature (arXiv etc.) via Valency.

    Use for 'what is the field publishing about X' questions. This corpus is
    separate from the internal measurement records; results carry external
    ids (arXiv id / DOI), not record_ids.
    """
    valency = _valency()
    if valency is None:
        return {"available": False, "results": []}
    try:
        papers = _run(valency.semantic_search(query, limit=limit))
    except ValencyUnavailable as exc:
        return {"available": False, "results": [], "detail": str(exc)}
    return {"available": True, "results": papers}


@mcp.tool()
def literature_trends(keyword: str, category: str | None = None) -> dict[str, Any]:
    """Publication counts over time for a keyword, via Valency.

    Example: keyword='high-entropy alloy', category='cond-mat.mtrl-sci'.
    """
    valency = _valency()
    if valency is None:
        return {"available": False}
    try:
        trend = _run(valency.keyword_trends(keyword, category))
    except ValencyUnavailable as exc:
        return {"available": False, "detail": str(exc)}
    return {"available": True, "keyword": keyword, "trend": trend}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
