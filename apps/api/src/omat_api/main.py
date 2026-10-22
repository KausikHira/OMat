"""FastAPI application entry point.

Run locally with:
    uvicorn omat_api.main:app --reload --port 8000
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from omat_api.routers import (
    admin,
    aggregates,
    chat,
    facets,
    literature,
    papers,
    search,
    suggest,
)
from omat_api.service import SearchBackendUnavailable
from omat_api.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Phase 0: validate the index alias and warm shared clients here.
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="OMAT-SE API",
        version="0.1.0",
        description="Faceted search over materials composition and property measurements.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    for module in (search, papers, facets, aggregates, suggest, literature, chat, admin):
        application.include_router(module.router, prefix="/v1")

    @application.get("/healthz", tags=["ops"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok", "env": settings.env, "version": "0.1.0"}

    # OpenSearch down -> 503 with a clear message, never an opaque 500.
    @application.exception_handler(SearchBackendUnavailable)
    async def _search_unavailable(
        _: object, exc: SearchBackendUnavailable
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "search backend unavailable", "reason": str(exc)},
        )

    return application


app = create_app()
