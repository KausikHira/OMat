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

from omat_core.opensearch import ALIAS

from ..deps import get_opensearch, get_redis

router = APIRouter(prefix="/suggest", tags=["suggest"])


@router.get("")
async def suggest(
    q: str = Query(min_length=1),
    limit: int = Query(default=8, ge=1, le=20),
    client: AsyncOpenSearch = Depends(get_opensearch),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    cache_key = f"suggest:{hashlib.sha1(q.lower().encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    body = {
        "size": 0,
        "query": {
            "bool": {
                "minimum_should_match": 1,
                "should": [
                    {"match_bool_prefix": {
                        "composition.canonical": {"query": q, "_name": "formula"},
                    }},
                    {"prefix": {"elements": {"value": q.upper(), "_name": "element"}}},
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
    response = await client.search(index=ALIAS, body=body)
    result = {
        "query": q,
        "formulas": [b["key"] for b in response["aggregations"]["formulas"]["buckets"]],
        "elements": [b["key"] for b in response["aggregations"]["elements"]["buckets"]],
        "properties": [b["key"] for b in response["aggregations"]["properties"]["buckets"]],
        "journals": [b["key"] for b in response["aggregations"]["journals"]["buckets"]],
    }
    await redis.set(cache_key, json.dumps(result), ex=300)
    return result
