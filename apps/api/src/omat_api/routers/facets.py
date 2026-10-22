"""Facet counts for the search sidebar.

Planned surface (phase 0):

    GET /v1/facets?fields=elements,property,journal,applications,year

Returns terms aggregations plus min/max/avg for the selected property so the
range slider can be rendered without a second round trip.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/facets", tags=["facets"])
