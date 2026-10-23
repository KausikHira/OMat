"""Autocomplete: composition prefix, property names, journals.

Backed by a search_as_you_type-style prefix query over search_text and the
keyword facets; kept cheap by a 300s Redis cache since vocab is small.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from opensearchpy import AsyncOpenSearch
from redis.asyncio import Redis

from omat_core.opensearch import ALIAS, build_suggest_body, reduce_suggest_response

from ..cache import cache_get, cache_set
from ..deps import get_opensearch, get_redis
from ..service import SearchBackendUnavailable

router = APIRouter(prefix="/suggest", tags=["suggest"])


@router.get("")
async def suggest(
    q: str = Query(min_length=1),
    limit: int = Query(default=8, ge=1, le=20),
    client: AsyncOpenSearch = Depends(get_opensearch),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    cache_key = f"suggest:{hashlib.sha1(q.lower().encode()).hexdigest()}"
    cached = await cache_get(redis, cache_key)
    if cached:
        return json.loads(cached)

    body = build_suggest_body(q, limit)
    try:
        response = await client.search(index=ALIAS, body=body)
    except Exception as exc:
        raise SearchBackendUnavailable(f"opensearch unreachable: {exc}") from exc
    result = reduce_suggest_response(q, response)
    await cache_set(redis, cache_key, json.dumps(result), 300)
    return result
