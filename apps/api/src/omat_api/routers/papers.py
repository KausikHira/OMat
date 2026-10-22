"""Paper grouping.

Planned surface (phase 0):

    GET /v1/papers/{doi_or_pii}
        All measurement records for one paper, grouped and ordered by table.

One paper maps to many records. This endpoint is the provenance view behind the
chat panel.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/papers", tags=["papers"])
