"""MCP server built on the Python SDK's MCPServer (SDK v2).

Local (stdio):
    python -m omat_mcp.server

Remote (streamable HTTP): ``mcp.run(transport="streamable-http")`` behind the
ALB. Tools delegate to the same py-core builders the FastAPI routers use, so
the agent surface and the REST surface cannot drift.
"""

from __future__ import annotations

import asyncio
import os
from functools import lru_cache
from typing import Any

from mcp.server.mcpserver import MCPServer

from omat_core.gsc import build_gsc
from omat_core.opensearch import (
    ALIAS,
    FACET_AGGS,
    build_search_query,
    build_suggest_body,
    fetch_property_rows,
    reduce_suggest_response,
)
from omat_core.opensearch.client import make_client
from omat_core.props_plot import build_props_scatter
from omat_core.valency import Valency, ValencyClient, ValencyUnavailable

mcp = MCPServer("omat-se")

SEARCH_FIELDS = [
    "record_id",
    "article_pii",
    "doi",
    "paper_link",
    "has_composition",
    "has_property",
    "composition.canonical",
    "composition.elements",
    "property.name",
    "property.slug",
    "property.value",
    "property.unit",
    "property.value_si",
    "elements",
    "species",
    "journal.name",
    "year",
    "applications.raw",
    "title",
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


def _filters(
    elements: list[str] | None,
    journal: list[str] | None,
    applications: list[str] | None,
) -> dict[str, list[str]]:
    """Filter dict shared by every tool: OR within a field, AND across fields."""
    filters: dict[str, list[str]] = {}
    if elements:
        filters["elements"] = elements
    if journal:
        filters["journal"] = journal
    if applications:
        filters["application"] = applications
    return filters


@mcp.tool()
def search_records(
    query: str = "",
    elements: list[str] | None = None,
    property_slug: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    journal: list[str] | None = None,
    applications: list[str] | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search measurement records by composition, property, journal, or application.

    Args:
        query: free-text (composition label, property name, journal words) or a
            full natural-language question, e.g. "I want to build a house near
            a riverbed, what concrete should I use". py-core maps the domain
            words to application/property facets before searching.
        elements: element symbols all of which must be present (e.g. ["Ti", "O"]).
        property_slug: property filter, e.g. youngs_modulus, hardness, density.
        min_value/max_value: numeric range on property value (use with property_slug).
        journal: journal slugs to restrict to, e.g. ["matlet"].
        applications: application slugs to restrict to,
            e.g. ["structural-mechanical", "coatings-barriers"].
        limit: max records returned (1-50).
    """
    body = {
        "query": build_search_query(
            query or None,
            _filters(elements, journal, applications),
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
        "query": {
            "bool": {
                "should": [
                    {"term": {"doi": doi_or_pii.lower() if is_doi else doi_or_pii}},
                    {"term": {"article_pii": doi_or_pii.upper()}},
                ],
                "minimum_should_match": 1,
            }
        },
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
        "title": hits[0]["_source"].get("title"),
        "record_count": len(hits),
        "records": [h["_source"] for h in hits],
    }


@mcp.tool()
def facet_counts(
    field: str = "property",
    query: str = "",
    elements: list[str] | None = None,
    journal: list[str] | None = None,
    applications: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Count records per facet value under optional filters.

    field: property | elements | journal | application | year_histogram |
    property_stats. Without filters this is the corpus-wide vocabulary; with
    a query or filters the counts reflect that slice (e.g. call facet_counts
    with the same query as search_records to see what to filter next).
    """
    agg = FACET_AGGS.get(field)
    if agg is None:
        return [{"error": f"unknown facet {field}"}]
    body = {
        "query": build_search_query(query or None, _filters(elements, journal, applications)),
        "size": 0,
        "aggs": {"facet": agg},
    }
    response = _client().search(index=ALIAS, body=body)
    bucket = response["aggregations"]["facet"]
    if "buckets" not in bucket:
        return [bucket]
    return [{"value": b["key"], "count": b["doc_count"]} for b in bucket["buckets"]]


@mcp.tool()
def suggest(q: str, limit: int = 8) -> dict[str, Any]:
    """Autocomplete a partial word against the corpus vocabulary.

    Returns matching composition formulas, element symbols, property slugs,
    and journal slugs for the prefix, e.g. suggest("ti") -> elements ["Ti"].
    Use it before search_records to resolve user input into exact facet
    values.
    """
    if not q.strip():
        return {"query": q, "formulas": [], "elements": [], "properties": [], "journals": []}
    body = build_suggest_body(q.strip(), max(1, min(limit, 20)))
    response = _client().search(index=ALIAS, body=body)
    return reduce_suggest_response(q, response)


@mcp.tool()
def props_scatter(
    property_a: str,
    property_b: str,
    property_c: str,
    threshold_a: float | None = None,
    threshold_b: float | None = None,
    threshold_c: float | None = None,
    elements: list[str] | None = None,
    journal: list[str] | None = None,
    applications: list[str] | None = None,
) -> dict[str, Any]:
    """Three-property scatter with percentile filtering and criteria highlighting.

    The notebook chart ("plot_3_props_ultimate_with_filtering"): materials
    measured for ALL THREE properties become [x, y, z] points (x =
    property_a, y = property_b, color = property_c). Materials outside the
    1st/99th percentile on any axis are dropped. When all three thresholds
    are given, points satisfying x >= threshold_a AND y >= threshold_b AND
    z >= threshold_c are flagged (highlighted=1) — the notebook's
    blue-ringed "required material" criteria.

    Example: props_scatter("glass_transition_temperature",
    "activation_energy", "crystallization_temperature", 600, 2, 800)
    returns the criteria-8 chart (glass-forming ability map).
    """
    slugs = (property_a, property_b, property_c)
    if len(set(slugs)) != 3:
        return {"error": "props_scatter requires three different property slugs"}
    thresholds_in = (threshold_a, threshold_b, threshold_c)
    thresholds = (
        tuple(float(t) for t in thresholds_in)
        if all(t is not None for t in thresholds_in)
        else None
    )
    rows = fetch_property_rows(
        _client(),
        build_search_query(None, _filters(elements, journal, applications)),
        slugs,
    )
    return build_props_scatter(rows, *slugs, thresholds=thresholds)


@mcp.tool()
def gsc_chart(
    property_a: str,
    property_b: str,
    elements: list[str] | None = None,
    journal: list[str] | None = None,
    applications: list[str] | None = None,
) -> dict[str, Any]:
    """Two-property composition-family hulls (the GSC notebook chart).

    Materials measured for both properties are grouped into families by
    element set; each family carries its points and a smoothed convex-hull
    polygon. Use for "which composition families span this property range".
    """
    if property_a == property_b:
        return {"error": "gsc_chart requires two different property slugs"}
    rows = fetch_property_rows(
        _client(),
        build_search_query(None, _filters(elements, journal, applications)),
        (property_a, property_b),
    )
    return build_gsc(rows, property_a, property_b)


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
