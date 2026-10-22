"""Search service: OpenSearch queries assembled with py-core builders.

All index reads go through here so the MCP server can reuse them by importing
this module — one search implementation, many adapters.
"""

from __future__ import annotations

import time
from typing import Any

from opensearchpy import AsyncOpenSearch

from omat_core.opensearch import (
    ALIAS,
    FACET_AGGS,
    build_search_query,
    parse_cursor,
    search_after_cursor,
)

SORT_OPTIONS = {
    "relevance": [("_score", "desc"), ("record_id", "asc")],
    "year_desc": [("year", "desc"), ("record_id", "asc")],
    "year_asc": [("year", "asc"), ("record_id", "asc")],
    "value_asc": [("property.value_si", "asc"), ("record_id", "asc")],
    "value_desc": [("property.value_si", "desc"), ("record_id", "asc")],
}

FACET_FIELDS = ("elements", "property", "journal", "application")

SOURCE_FIELDS = [
    "record_id", "row_index", "article_pii", "doi", "paper_link",
    "has_composition", "has_property",
    "composition.canonical", "composition.label", "composition.elements",
    "property.name", "property.slug", "property.value", "property.unit",
    "property.value_si", "elements", "species",
    "journal.name", "journal.slug", "year",
    "applications.raw", "applications.slug",
]


def parse_multi(raw: str | None) -> list[str]:
    """Comma-separated query param -> list, dropping empties."""
    if not raw:
        return []
    return [v.strip() for v in raw.split(",") if v.strip()]


def search_records(
    client: AsyncOpenSearch,
    *,
    q: str | None = None,
    elements: list[str] | None = None,
    property_slug: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    journal: list[str] | None = None,
    application: list[str] | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    sort: str = "relevance",
    cursor: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """One page of records + total. Cursor pagination via search_after."""
    filters: dict[str, list[str]] = {}
    if elements:
        filters["elements"] = elements
    if journal:
        filters["journal"] = journal
    if application:
        filters["application"] = application

    property_range = None
    if property_slug and (min_value is not None or max_value is not None):
        property_range = (min_value, max_value)

    body: dict[str, Any] = {
        "query": build_search_query(q, filters, property_range, property_slug),
        "size": limit,
        "_source": SOURCE_FIELDS,
        "track_total_hits": 10000,  # cap: UI shows "about N"
    }
    if year_from is not None or year_to is not None:
        year_range: dict[str, int] = {}
        if year_from is not None:
            year_range["gte"] = year_from
        if year_to is not None:
            year_range["lte"] = year_to
        body["query"]["bool"]["filter"].append({"range": {"year": year_range}})

    sort_name = sort if sort in SORT_OPTIONS else "relevance"
    if sort_name in ("value_asc", "value_desc") and not property_slug:
        sort_name = "relevance"  # value sorts need a property selected

    if cursor:
        sort_values, record_id = parse_cursor(cursor)
        body["search_after"] = [*sort_values, record_id]
        body["sort"] = SORT_OPTIONS[sort_name]
    else:
        body["sort"] = SORT_OPTIONS[sort_name]

    start = time.perf_counter()
    response = client.search(index=ALIAS, body=body)
    took_ms = int((time.perf_counter() - start) * 1000)

    hits = response["hits"]
    total = hits["total"]["value"] if isinstance(hits["total"], dict) else hits["total"]
    records = [hit["_source"] for hit in hits["hits"]]

    next_cursor = None
    if records and len(records) == limit:
        last = hits["hits"][-1]
        sort_values = last.get("sort", [])[:-1]
        next_cursor = search_after_cursor(sort_values, last["_source"]["record_id"])

    return {"data": records, "total": total, "took_ms": took_ms, "cursor": next_cursor}


def facet_counts(
    client: AsyncOpenSearch,
    *,
    q: str | None = None,
    filters: dict[str, list[str]] | None = None,
    fields: tuple[str, ...] = FACET_FIELDS,
) -> dict[str, Any]:
    """Aggregation-only query: facet counts + property stats for sliders."""
    aggs = {name: FACET_AGGS[name] for name in fields if name in FACET_AGGS}
    aggs["property_stats"] = FACET_AGGS["property_stats"]
    body = {
        "query": build_search_query(q, filters or {}),
        "size": 0,
        "aggs": aggs,
    }
    response = client.search(index=ALIAS, body=body)
    facets: dict[str, Any] = {}
    for name, bucket in response["aggregations"].items():
        if "buckets" in bucket:
            facets[name] = [
                {"value": b["key"], "count": b["doc_count"]} for b in bucket["buckets"]
            ]
    facets["property_stats"] = response["aggregations"].get("property_stats", {})
    return facets


def get_paper(
    client: AsyncOpenSearch, *, doi: str | None = None, pii: str | None = None,
    size: int = 1000,
) -> dict[str, Any] | None:
    """All records for one paper, grouped view built by the router."""
    clauses: list[dict[str, Any]] = []
    if doi:
        clauses.append({"term": {"doi": doi}})
    if pii:
        clauses.append({"term": {"article_pii": pii}})
    body = {
        "query": {"bool": {"should": clauses, "minimum_should_match": 1}},
        "size": size,
        "sort": [{"row_index": "asc"}],
        "_source": SOURCE_FIELDS,
    }
    response = client.search(index=ALIAS, body=body)
    hits = response["hits"]["hits"]
    if not hits:
        return None
    paper_view = {
        "article_pii": hits[0]["_source"]["article_pii"],
        "doi": hits[0]["_source"]["doi"],
        "paper_link": hits[0]["_source"].get("paper_link"),
        "journal": hits[0]["_source"].get("journal"),
        "year": hits[0]["_source"].get("year"),
        "record_count": len(hits),
        "records": [h["_source"] for h in hits],
    }
    return paper_view
