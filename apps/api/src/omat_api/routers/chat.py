"""Per-paper chat.

Planned surface (phase 0):

    POST /v1/papers/{doi_or_pii}/chat   (SSE)

Context is the paper's measurement rows, not PDF chunks. Above the context cap,
the model gets read-only tools (query, aggregate, get_record) instead of a dump.
Every numeric answer must cite a ``proxy_id`` and table number.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/papers", tags=["chat"])
