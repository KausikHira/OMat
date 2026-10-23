"""Bounded sync scans the MCP server runs against OpenSearch.

The API has its own async variant in ``omat_api.service``; both reduce hits
through ``omat_core.gsc.gsc_row_from_source`` so the surfaces cannot drift.
The caller builds the base query with :func:`build_search_query` — this
module only owns the scan loop and the document -> row reduction.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from ..gsc import GscRow, gsc_row_from_source
from .mapping import ALIAS

__all__ = ["fetch_property_rows"]

SCAN_SOURCE_FIELDS = [
    "article_pii",
    "composition.canonical",
    "composition.label",
    "elements",
    "property.name",
    "property.slug",
    "property.value",
    "property.unit",
]


def fetch_property_rows(
    client: Any,
    query: dict[str, Any],
    property_slugs: Sequence[str],
    max_docs: int = 4000,
    page: int = 500,
) -> list[GscRow]:
    """search_after scan (never from/size) of docs measuring any slug.

    The query arrives pre-built with the caller's text/facet semantics; the
    property + has_* filters are added here because every caller of this
    scan needs exactly them.
    """
    query["bool"].setdefault("filter", []).extend(
        [
            {"terms": {"property.slug": list(property_slugs)}},
            {"term": {"has_property": True}},
            {"term": {"has_composition": True}},
        ]
    )

    rows: list[GscRow] = []
    search_after: list[Any] | None = None
    while len(rows) < max_docs:
        body: dict[str, Any] = {
            "query": query,
            "size": min(page, max_docs - len(rows)),
            "sort": [{"record_id": "asc"}],
            "_source": SCAN_SOURCE_FIELDS,
        }
        if search_after:
            body["search_after"] = search_after
        response = client.search(index=ALIAS, body=body)
        hits = response["hits"]["hits"]
        for hit in hits:
            rows.append(gsc_row_from_source(hit["_source"]))
        if len(hits) < page:
            break
        search_after = hits[-1]["sort"]
    return rows
