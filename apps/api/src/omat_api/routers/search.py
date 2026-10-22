"""Record search.

Planned surface (phase 0):

    GET /v1/search
        q, elements, property, min, max, journal, app, year_from, year_to,
        sort, cursor, limit

Filter semantics: OR within a field, AND across fields. Pagination uses
``search_after`` with an opaque cursor, never ``from/size``.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/search", tags=["search"])
