"""Shared dependencies.

Clients are process-scoped. Do not open a connection per request.
"""

from __future__ import annotations

from functools import lru_cache

from opensearchpy import AsyncOpenSearch
from redis.asyncio import Redis

from omat_api.settings import get_settings


@lru_cache
def get_opensearch() -> AsyncOpenSearch:
    return AsyncOpenSearch(hosts=[get_settings().opensearch_url])


@lru_cache
def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)
