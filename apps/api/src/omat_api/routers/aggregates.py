"""Chart data.

Planned surface (phase 0):

    GET /v1/aggregates?kind=property_hist|year_hist|journal_terms|element_terms

Plotly never receives the full result set. Every chart is backed by a cached
aggregation endpoint.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/aggregates", tags=["aggregates"])
