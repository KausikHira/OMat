"""Suggest (autocomplete) DSL. Shared by the API router and the MCP server."""

from __future__ import annotations

from typing import Any

__all__ = ["build_suggest_body", "reduce_suggest_response"]


def build_suggest_body(q: str, limit: int = 8) -> dict[str, Any]:
    """Prefix query over the keyword vocabularies + terms aggregations."""
    # `elements` is a case-sensitive keyword field storing element symbols
    # ("Ti"); uppercasing the prefix matched nothing, so the element arm uses
    # symbol case (first letter upper, rest lower) instead.
    symbol_case = q[:1].upper() + q[1:].lower()
    return {
        "size": 0,
        "query": {
            "bool": {
                "minimum_should_match": 1,
                "should": [
                    {
                        "match_bool_prefix": {
                            "composition.canonical": {"query": q, "_name": "formula"},
                        }
                    },
                    {"prefix": {"elements": {"value": symbol_case, "_name": "element"}}},
                    {"match_bool_prefix": {"property.name": {"query": q, "_name": "property"}}},
                    {"match_bool_prefix": {"journal.name": {"query": q, "_name": "journal"}}},
                ],
            }
        },
        "aggs": {
            "formulas": {"terms": {"field": "composition.canonical", "size": limit}},
            "elements": {"terms": {"field": "elements", "size": limit}},
            "properties": {"terms": {"field": "property.slug", "size": limit}},
            "journals": {"terms": {"field": "journal.slug", "size": limit}},
        },
    }


def reduce_suggest_response(q: str, response: dict[str, Any]) -> dict[str, Any]:
    """Aggregation buckets -> the flat suggest payload both surfaces return."""
    aggregations = response["aggregations"]
    return {
        "query": q,
        "formulas": [b["key"] for b in aggregations["formulas"]["buckets"]],
        "elements": [b["key"] for b in aggregations["elements"]["buckets"]],
        "properties": [b["key"] for b in aggregations["properties"]["buckets"]],
        "journals": [b["key"] for b in aggregations["journals"]["buckets"]],
    }
