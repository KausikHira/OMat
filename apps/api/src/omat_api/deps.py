"""Shared dependencies.

Clients are process-scoped. Do not open a connection per request.
"""

from functools import lru_cache

from opensearchpy import AsyncOpenSearch

from omat_api.settings import get_settings


@lru_cache
def get_opensearch() -> AsyncOpenSearch:
    return AsyncOpenSearch(hosts=[get_settings().opensearch_url])
