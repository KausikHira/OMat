"""Per-paper chat over SSE.

Context = the paper's measurement rows (5-50 records, no RAG stack). The model
may call one tool: ``search_external_literature`` -> Valency semantic search,
for "how does this compare to recent literature" questions. Every numeric
claim must cite a record_id from the provided table; the prompt forbids
inventing measurement conditions (temperature/method are not in the data).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from opensearchpy import AsyncOpenSearch
from pydantic import BaseModel
from redis.asyncio import Redis

from omat_core.valency import Valency, ValencyClient, ValencyUnavailable

from ..cache import cache_get, cache_set
from ..deps import get_opensearch, get_redis
from ..llm import GeminiProvider, LlmUnavailable
from ..service import get_paper
from ..settings import get_settings

router = APIRouter(tags=["chat"])

MAX_TABLE_CHARS = 24000  # ~6k tokens of compact table


class ChatRequest(BaseModel):
    message: str


def _records_table(paper: dict[str, Any]) -> str:
    header = (
        "record_id | doi | composition_canonical | property | value | unit | elements | application"
    )
    lines = [header]
    for record in paper["records"]:
        prop = record.get("property") or {}
        composition = record.get("composition") or {}
        lines.append(
            " | ".join(
                [
                    record.get("record_id", ""),
                    record.get("doi", ""),
                    composition.get("canonical", ""),
                    prop.get("name", ""),
                    str(prop.get("value", "")),
                    prop.get("unit", "") or "",
                    ",".join(record.get("elements", [])),
                    ",".join(a.get("raw", "") for a in record.get("applications", [])),
                ]
            )
        )
    table = "\n".join(lines)
    return table[:MAX_TABLE_CHARS]


SYSTEM_PROMPT = """You answer questions about one materials-science paper using ONLY
the measurement table provided. Rules:
- Cite record_id for every numeric claim.
- Measurement conditions (temperature, method, sample state) are NOT in the
  data; never imply them.
- If the answer is not in the table, say "not in this dataset".
- If the user asks about related literature or how this compares to the field,
  call the tool search_external_literature with a concise material topic.
"""


def _valency_tool() -> dict[str, Any]:
    return {
        "functionDeclarations": [
            {
                "name": "search_external_literature",
                "description": (
                    "Search external preprint literature (arXiv etc.) for papers about a "
                    "materials topic. Use for 'compare with literature' questions, not "
                    "for facts about this paper's measurements."
                ),
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"query": {"type": "STRING"}},
                    "required": ["query"],
                },
            }
        ]
    }


def _sse(message: str) -> str:
    return f"data: {json.dumps({'delta': message})}\n\n"


@router.post("/papers/{id_or_doi:path}/chat")
async def paper_chat(
    id_or_doi: str,
    request: ChatRequest,
    client: AsyncOpenSearch = Depends(get_opensearch),
    redis: Redis = Depends(get_redis),
) -> StreamingResponse:
    settings = get_settings()
    if not settings.gemini_api_key or not settings.gemini_model:
        raise HTTPException(
            503, "chat not configured: set OMAT_GEMINI_API_KEY and OMAT_GEMINI_MODEL"
        )

    is_doi = id_or_doi.lower().startswith("10.")
    paper = await get_paper(
        client,
        doi=id_or_doi if is_doi else None,
        pii=None if is_doi else id_or_doi.upper(),
    )
    if paper is None:
        raise HTTPException(404, "paper not found")

    provider = GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    user_prompt = (
        f"Paper: DOI {paper['doi']} "
        f"({paper.get('journal', {}).get('name')}, {paper.get('year')}).\n"
        f"Measurements table:\n{_records_table(paper)}\n\n"
        f"Question: {request.message}"
    )

    valency: Valency | None = None
    if settings.valency_enabled and settings.valency_bearer_token:
        valency = Valency(
            ValencyClient(bearer_token=settings.valency_bearer_token, url=settings.valency_mcp_url)
        )

    async def stream():
        yield f"data: {json.dumps({'paper': paper['doi'], 'records': paper['record_count']})}\n\n"
        try:
            reply = await provider.complete(
                SYSTEM_PROMPT,
                user_prompt,
                tool_declarations=[_valency_tool()] if valency else None,
            )
            if reply.tool_call and valency:
                args = reply.tool_call.get("args", {}) or {}
                query = str(args.get("query", ""))[:200]
                try:
                    literature = await valency.semantic_search(query, limit=8)
                except ValencyUnavailable as exc:
                    literature = [{"error": f"literature search unavailable: {exc}"}]
                cache_key = f"valency:chat:{hashlib.sha1(query.encode()).hexdigest()}"
                if not await cache_get(redis, cache_key):
                    await cache_set(redis, cache_key, json.dumps(literature), 900)
                reply = await provider.complete(
                    SYSTEM_PROMPT,
                    user_prompt,
                    tool_result=literature,
                    tool_name=reply.tool_call.get("name"),
                    tool_declarations=None,
                )
            for chunk in _chunks(reply.text):
                yield _sse(chunk)
        except LlmUnavailable as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


def _chunks(text: str, size: int = 80):
    for start in range(0, len(text), size):
        yield text[start : start + size]
