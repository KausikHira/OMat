"""OpenSearch mapping, DSL builders, and index lifecycle helpers.

Index layout:
- ``papers_vN`` concrete indices behind the ``papers`` alias; reindexing
  builds ``papers_v{n+1}``, smoke-tests, then swaps the alias atomically.
- One document per measurement record (119k docs at current scale).
- ``composition.vector`` is a knn_vector field (l2) for the
  find-similar-composition query; no text embeddings anywhere.
"""

from __future__ import annotations

from typing import Any

from .client import bulk_index, count_all, ensure_index, make_client
from .mapping import ALIAS, INDEX_VERSION, index_name, papers_mapping

__all__ = [
    "ALIAS",
    "INDEX_VERSION",
    "bulk_index",
    "count_all",
    "ensure_index",
    "make_client",
    "papers_mapping",
    "index_name",
    "build_search_query",
    "FACET_AGGS",
    "search_after_cursor",
    "parse_cursor",
]


def build_search_query(
    q: str | None,
    filters: dict[str, list[str]],
    property_range: tuple[float | None, float | None] | None = None,
    property_slug: str | None = None,
) -> dict[str, Any]:
    """BM25 query with the agreed boosts and filter semantics:
    OR within a field, AND across fields. Filters are term-level only."""
    must: list[dict[str, Any]] = []
    if q:
        must.append(
            {
                "multi_match": {
                    "query": q,
                    "fields": [
                        "title^4",
                        "composition.label^3",
                        "search_text^3",
                        "applications.raw^2",
                        "property.name^2",
                        "abstract^1",
                    ],
                    "operator": "and",
                }
            }
        )
    filter_clauses: list[dict[str, Any]] = []
    field_map = {
        "elements": "elements",
        "property": "property.slug",
        "journal": "journal.slug",
        "application": "applications.slug",
        "year": "year",
        "doi": "doi",
        "pii": "article_pii",
    }
    for name, values in filters.items():
        field_name = field_map.get(name)
        if field_name and values:
            filter_clauses.append({"terms": {field_name: values}})
    if property_slug and property_range:
        low, high = property_range
        range_body: dict[str, Any] = {}
        if low is not None:
            range_body["gte"] = low
        if high is not None:
            range_body["lte"] = high
        if range_body:
            filter_clauses.append(
                {"bool": {"must": [{"term": {"property.slug": property_slug}}],
                          "filter": [{"range": {"property.value_si": range_body}}]}}
            )
    elif property_slug:
        filter_clauses.append({"term": {"property.slug": property_slug}})

    return {
        "bool": {
            "must": must or [{"match_all": {}}],
            "filter": filter_clauses,
        }
    }


FACET_AGGS: dict[str, Any] = {
    "elements": {"terms": {"field": "elements", "size": 40}},
    "property": {"terms": {"field": "property.slug", "size": 30}},
    "journal": {"terms": {"field": "journal.slug", "size": 30}},
    "application": {"terms": {"field": "applications.slug", "size": 20}},
    "year_histogram": {
        "histogram": {"field": "year", "interval": 1, "min_doc_count": 0},
    },
    "property_stats": {
        "stats": {"field": "property.value_si"},
    },
}


def search_after_cursor(sort_values: list[Any], record_id: str) -> str:
    """Opaque cursor = base64 of the sort tuple + tiebreaker."""
    import base64
    import json

    payload = json.dumps({"s": sort_values, "id": record_id})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def parse_cursor(cursor: str) -> tuple[list[Any], str]:
    import base64
    import json

    payload = json.loads(base64.urlsafe_b64decode(cursor.encode()))
    return payload["s"], payload["id"]
