"""Autocomplete.

Planned surface (phase 0):

    GET /v1/suggest?q=

Covers composition labels, property names, and journals. Backed by a
completion-style or edge-ngram field, with Redis caching.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/suggest", tags=["suggest"])
