"""Facet counts for the filter sidebar and range sliders."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from opensearchpy import AsyncOpenSearch

from ..deps import get_opensearch
from ..service import FACET_FIELDS, facet_counts, parse_multi

router = APIRouter(prefix="/facets", tags=["facets"])


@router.get("")
async def facets(
    q: str | None = None,
    elements: str | None = None,
    property: str | None = None,  # noqa: A002
    journal: str | None = None,
    app: str | None = None,  # noqa: A002
    fields: str = Query(default=",".join(FACET_FIELDS)),
    client: AsyncOpenSearch = Depends(get_opensearch),
) -> dict[str, Any]:
    wanted = tuple(f for f in parse_multi(fields) if f in FACET_FIELDS) or FACET_FIELDS
    filters = {
        "elements": parse_multi(elements),
        "property": parse_multi(property),
        "journal": parse_multi(journal),
        "application": parse_multi(app),
    }
    return facet_counts(client, q=q, filters=filters, fields=wanted)
