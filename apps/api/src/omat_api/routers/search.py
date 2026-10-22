"""Record search.

    GET /v1/search
        q, elements, property, min, max, journal, app, year_from, year_to,
        sort, cursor, limit

Filter semantics: OR within a field, AND across fields. Pagination uses
``search_after`` with an opaque cursor, never ``from/size``.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from opensearchpy import AsyncOpenSearch
from redis.asyncio import Redis

from ..cache import cache_get, cache_set
from ..deps import get_opensearch, get_redis
from ..service import parse_multi, search_records

router = APIRouter(prefix="/search", tags=["search"])

CACHE_TTL = 60  # first-page queries only; deep pages go straight through


@router.get("")
async def search(
    q: str | None = None,
    elements: str | None = None,
    property: str | None = None,  # noqa: A002 (query param name)
    min: float | None = None,  # noqa: A002
    max: float | None = None,  # noqa: A002
    journal: str | None = None,
    app: str | None = None,  # noqa: A002
    year_from: int | None = None,
    year_to: int | None = None,
    sort: str = "relevance",
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    client: AsyncOpenSearch = Depends(get_opensearch),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    filters_for_key = {
        "q": q,
        "elements": elements,
        "property": property,
        "min": min,
        "max": max,
        "journal": journal,
        "app": app,
        "year_from": year_from,
        "year_to": year_to,
        "sort": sort,
    }
    cacheable = cursor is None  # cache first-page only
    cache_key = (
        "search:"
        + hashlib.sha1(
            json.dumps(filters_for_key, sort_keys=True, default=str).encode()
        ).hexdigest()
    )

    if cacheable:
        cached = await cache_get(redis, cache_key)
        if cached:
            return json.loads(cached)

    result = await search_records(
        client,
        q=q,
        elements=parse_multi(elements),
        property_slug=property,
        min_value=min,
        max_value=max,
        journal=parse_multi(journal),
        application=parse_multi(app),
        year_from=year_from,
        year_to=year_to,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )

    if cacheable:
        await cache_set(redis, cache_key, json.dumps(result), CACHE_TTL)
    return result
