"""Best-effort cache helpers shared by all routers.

Redis is an optimization, never a dependency: if it is down, requests are
served without caching instead of failing.
"""

from __future__ import annotations

from redis.asyncio import Redis


async def cache_get(redis: Redis, key: str) -> str | None:
    """Cache read that never fails the request path. Redis down = no cache."""
    try:
        return await redis.get(key)
    except Exception:  # noqa: BLE001 — cache must never break the request
        return None


async def cache_set(redis: Redis, key: str, value: str, ttl: int) -> None:
    """Cache write that never fails the request path."""
    try:
        await redis.set(key, value, ex=ttl)
    except Exception:  # noqa: BLE001
        return
