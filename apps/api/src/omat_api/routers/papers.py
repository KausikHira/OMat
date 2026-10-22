"""Paper detail: all measurement rows for one DOI or PII."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from opensearchpy import AsyncOpenSearch
from redis.asyncio import Redis

from ..cache import cache_get, cache_set
from ..deps import get_opensearch, get_redis
from ..service import get_paper

router = APIRouter(prefix="/papers", tags=["papers"])


@router.get("/{id_or_doi}")
async def paper_detail(
    id_or_doi: str,
    client: AsyncOpenSearch = Depends(get_opensearch),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    cache_key = f"paper:{hashlib.sha1(id_or_doi.encode()).hexdigest()}"
    cached = await cache_get(redis, cache_key)
    if cached:
        return json.loads(cached)

    # A DOI looks like 10.xxxx/...; anything else is treated as a PII.
    is_doi = id_or_doi.lower().startswith("10.")
    view = await get_paper(  # may raise SearchBackendUnavailable -> global 503
        client,
        doi=id_or_doi if is_doi else None,
        pii=None if is_doi else id_or_doi.upper(),
    )
    if view is None:
        raise HTTPException(status_code=404, detail="paper not found")

    await cache_set(redis, cache_key, json.dumps(view), 300)
    return view
