"""Operational endpoints.

Planned surface (phase 1):

    POST /v1/admin/ingest        enqueue an ingestion job
    GET  /v1/admin/jobs/{id}     job status and reject counts

Everything here requires an admin credential. Do not expose ingestion publicly.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])
