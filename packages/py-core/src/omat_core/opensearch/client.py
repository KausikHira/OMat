"""Thin OpenSearch client wrapper: index lifecycle + bulk helpers.

Only operations the app actually performs live here; anything fancier stays in
opensearch-py land at the call site.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk

from .mapping import ALIAS, index_name, papers_mapping

logger = logging.getLogger(__name__)


def make_client(url: str, timeout: int = 30) -> OpenSearch:
    return OpenSearch(
        hosts=[url],
        use_ssl=url.startswith("https"),
        verify_certs=False,
        timeout=timeout,
        max_retries=3,
        retry_on_timeout=True,
    )


def ensure_index(client: OpenSearch, version: str | None = None) -> str:
    """Create papers_v<version> if absent and point the alias at it. Returns
    the concrete index name."""
    concrete = index_name(version) if version else index_name()
    if not client.indices.exists(index=concrete):
        mapping = papers_mapping()
        client.indices.create(index=concrete, body=mapping)
        logger.info("created index %s", concrete)
    _point_alias(client, concrete)
    return concrete


def _point_alias(client: OpenSearch, concrete: str) -> None:
    actions: list[dict[str, Any]] = []
    if client.indices.exists_alias(name=ALIAS):
        current = list(client.indices.get_alias(name=ALIAS).keys())
        for existing in current:
            if existing != concrete:
                actions.append({"remove": {"index": existing, "alias": ALIAS}})
    actions.append({"add": {"index": concrete, "alias": ALIAS}})
    client.indices.update_aliases(body={"actions": actions})


def bulk_index(
    client: OpenSearch,
    docs: Iterable[dict[str, Any]],
    chunk: int = 800,
) -> tuple[int, int]:
    """Index docs against the alias. Returns (ok, failed)."""
    actions = ({"_index": ALIAS, "_id": doc["record_id"], "_source": doc} for doc in docs)
    ok, failed = bulk(client, actions, chunk_size=chunk, raise_on_error=False, refresh=False)
    return ok, len(failed) if isinstance(failed, list) else failed


def count_all(client: OpenSearch) -> int:
    return int(client.count(index=ALIAS)["count"])
