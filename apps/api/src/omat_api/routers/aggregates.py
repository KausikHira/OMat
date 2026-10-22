"""Aggregates for Plotly dashboards. Charts never scan raw results.

kinds:
- property_hist  : value distribution of one property under current filters
- records_by_year: histogram of record counts per year
- top_journals   : horizontal bar data
- element_pairs  : co-occurrence counts (for the heatmap)
- property_by_year: avg property value per year (scatter/trend)
- gsc            : property-vs-property points grouped by composition family
                   with smoothed convex hulls (the notebook chart)
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from opensearchpy import AsyncOpenSearch

from omat_core.gsc import build_gsc
from omat_core.opensearch import ALIAS, build_search_query

from ..deps import get_opensearch
from ..service import SearchBackendUnavailable, fetch_gsc_rows, parse_multi

router = APIRouter(prefix="/aggregates", tags=["aggregates"])

Kind = Literal[
    "property_hist", "records_by_year", "top_journals", "element_pairs",
    "property_by_year", "gsc",
]


def _base_filters(elements: str | None, journal: str | None, app: str | None,
                  property_slug: str | None) -> dict[str, Any]:
    filters: dict[str, list[str]] = {}
    if elements:
        filters["elements"] = parse_multi(elements)
    if journal:
        filters["journal"] = parse_multi(journal)
    if app:
        filters["application"] = parse_multi(app)
    query = build_search_query(None, filters, None, property_slug)
    # Golden rows only: a chart about property values needs both halves.
    query["bool"]["filter"].append({"term": {"has_property": True}})
    if property_slug:
        query["bool"]["filter"].append({"term": {"property.slug": property_slug}})
    return query


@router.get("")
async def aggregates(
    kind: Kind,
    property: str | None = None,  # noqa: A002
    property_a: str | None = None,
    property_b: str | None = None,
    elements: str | None = None,
    journal: str | None = None,
    app: str | None = None,
    size: int = Query(default=30, ge=1, le=100),
    client: AsyncOpenSearch = Depends(get_opensearch),
) -> dict[str, Any]:
    if kind == "gsc":
        if not property_a or not property_b:
            raise HTTPException(
                422, "gsc requires ?property_a=<slug>&property_b=<slug>"
            )
        if property_a == property_b:
            raise HTTPException(422, "gsc requires two different properties")
        filters: dict[str, list[str]] = {}
        if elements:
            filters["elements"] = parse_multi(elements)
        if journal:
            filters["journal"] = parse_multi(journal)
        if app:
            filters["application"] = parse_multi(app)
        rows = await fetch_gsc_rows(
            client,
            filters=filters,
            property_a=property_a,
            property_b=property_b,
        )
        return {"kind": kind, **build_gsc(rows, property_a, property_b)}

    query = _base_filters(elements, journal, app, property)

    if kind == "property_hist":
        if not property:
            raise HTTPException(422, "property_hist requires ?property=<slug>")
        body = {
            "query": query, "size": 0,
            "aggs": {"hist": {
                "histogram": {"field": "property.value_si", "min_doc_count": 0},
            }},
        }
        try:
            response = await client.search(index=ALIAS, body=body)
        except Exception as exc:
            raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
        buckets = response["aggregations"]["hist"]["buckets"]
        return {"kind": kind, "property": property,
                "buckets": [{"x": b["key"], "count": b["doc_count"]} for b in buckets]}

    if kind == "records_by_year":
        body = {
            "query": query, "size": 0,
            "aggs": {"years": {"histogram": {"field": "year", "interval": 1, "min_doc_count": 0}}},
        }
        try:
            response = await client.search(index=ALIAS, body=body)
        except Exception as exc:
            raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
        buckets = response["aggregations"]["years"]["buckets"]
        return {"kind": kind,
                "buckets": [{"x": int(b["key"]), "count": b["doc_count"]} for b in buckets
                            if 1950 <= b["key"] <= 2027]}

    if kind == "top_journals":
        body = {
            "query": query, "size": 0,
            "aggs": {"journals": {"terms": {"field": "journal.slug", "size": size}}},
        }
        try:
            response = await client.search(index=ALIAS, body=body)
        except Exception as exc:
            raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
        buckets = response["aggregations"]["journals"]["buckets"]
        return {"kind": kind,
                "buckets": [{"label": b["key"], "count": b["doc_count"]} for b in buckets]}

    if kind == "element_pairs":
        body = {
            "query": query, "size": 0,
            "aggs": {"pairs": {"terms": {"field": "elements", "size": size}}},
        }
        try:
            response = await client.search(index=ALIAS, body=body)
        except Exception as exc:
            raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
        buckets = response["aggregations"]["pairs"]["buckets"]
        return {"kind": kind,
                "buckets": [{"label": b["key"], "count": b["doc_count"]} for b in buckets]}

    if kind == "property_by_year":
        if not property:
            raise HTTPException(422, "property_by_year requires ?property=<slug>")
        body = {
            "query": query, "size": 0,
            "aggs": {"by_year": {
                "histogram": {"field": "year", "interval": 1, "min_doc_count": 0},
                "aggs": {"avg_si": {"avg": {"field": "property.value_si"}}},
            }},
        }
        try:
            response = await client.search(index=ALIAS, body=body)
        except Exception as exc:
            raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
        buckets = response["aggregations"]["by_year"]["buckets"]
        return {"kind": kind, "property": property,
                "buckets": [{"x": int(b["key"]),
                             "avg": b["avg_si"].get("value"),
                             "count": b["doc_count"]} for b in buckets
                            if 1950 <= b["key"] <= 2027]}

    raise HTTPException(400, f"unknown kind {kind}")  # pragma: no cover
