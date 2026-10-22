"""External literature via Valency MCP (mcp.valency.io).

Topic-based, not paper-identity-based: the OMAT corpus is Elsevier ceramics
journals while Valency indexes preprint servers, so queries are seeded from
composition/property topics ("TiAlN coating hardness"), never from our DOIs.

All responses are Redis-cached and the whole feature is behind
``OMAT_VALENCY_ENABLED``; when off or unreachable, endpoints return an empty
payload with ``available: false`` — never a 500.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis

from omat_core.valency import Valency, ValencyClient, ValencyUnavailable

from ..deps import get_redis
from ..settings import get_settings

router = APIRouter(prefix="/literature", tags=["literature"])


def _valency() -> Valency | None:
    """Build the client per call (cheap); None = feature off."""
    settings = get_settings()
    if not settings.valency_enabled or not settings.valency_bearer_token:
        return None
    return Valency(
        ValencyClient(
            bearer_token=settings.valency_bearer_token,
            url=settings.valency_mcp_url,
        )
    )


def _unavailable_detail(exc: Exception) -> dict[str, Any]:
    return {"available": False, "results": [], "detail": f"valency unavailable: {exc}"}


@router.get("/search")
async def literature_search(
    q: str = Query(min_length=2, description="material topic, e.g. 'TiAlN coating hardness'"),
    limit: int = Query(default=10, ge=1, le=50),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    valency = _valency()
    if valency is None:
        return {"available": False, "results": [], "detail": "valency disabled"}

    cache_key = f"valency:search:{hashlib.sha1(f'{q}|{limit}'.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return {**json.loads(cached), "cached": True}

    try:
        papers = await valency.semantic_search(q, limit=limit)
    except ValencyUnavailable as exc:
        return _unavailable_detail(exc)

    payload = {"available": True, "query": q, "results": papers}
    await redis.set(
        cache_key, json.dumps(payload),
        ex=get_settings().valency_search_ttl,
    )
    return payload


@router.get("/trends")
async def literature_trends(
    keyword: str = Query(min_length=2),
    category: str | None = Query(default=None, description="e.g. cond-mat.mtrl-sci"),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    valency = _valency()
    if valency is None:
        return {"available": False, "trend": [], "detail": "valency disabled"}

    cache_key = f"valency:trends:{hashlib.sha1(f'{keyword}|{category}'.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return {**json.loads(cached), "cached": True}

    try:
        trend = await valency.keyword_trends(keyword, category)
    except ValencyUnavailable as exc:
        return _unavailable_detail(exc)

    payload = {"available": True, "keyword": keyword, "trend": trend}
    await redis.set(
        cache_key, json.dumps(payload),
        ex=get_settings().valency_trends_ttl,
    )
    return payload


@router.get("/related")
async def literature_related(
    q: str = Query(min_length=2, description="seed topic derived from a paper or composition"),
    limit: int = Query(default=8, ge=1, le=25),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    """Similar/citing merge. Seeds semantic search with the caller's topic and
    adds title matches as a second signal, then dedupes by arXiv id/DOI."""
    valency = _valency()
    if valency is None:
        return {"available": False, "results": [], "detail": "valency disabled"}

    cache_key = f"valency:related:{hashlib.sha1(f'{q}|{limit}'.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached:
        return {**json.loads(cached), "cached": True}

    try:
        semantic = await valency.semantic_search(q, limit=limit)
        title = await valency.search_by_title(q, limit=3)
    except ValencyUnavailable as exc:
        return _unavailable_detail(exc)

    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for paper in [*semantic, *title]:
        key = str(paper.get("id") or paper.get("doi") or paper.get("title", ""))[:120]
        if key and key not in seen:
            seen.add(key)
            merged.append(paper)

    payload = {"available": True, "query": q, "results": merged[: limit + 3]}
    await redis.set(
        cache_key, json.dumps(payload),
        ex=get_settings().valency_search_ttl,
    )
    return payload
