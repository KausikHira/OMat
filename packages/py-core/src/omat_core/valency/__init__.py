"""Valency MCP client (https://mcp.valency.io/).

Valency exposes 38 paper-search/analysis endpoints over the Model Context
Protocol: Streamable HTTP + JSON-RPC, bearer-token auth. This module wraps it
as a typed async client so the FastAPI routers, the chat tool loop, and the
MCP server all go through one integration point.

Protocol handling (per docs.valency.io/guides/api):
1. ``initialize`` request -> server returns capabilities + ``Mcp-Session-Id``
2. ``notifications/initialized`` notification
3. ``tools/call`` with the session id header on every subsequent request

A session id is reused across calls and re-established on expiry. Raw HTTP is
used instead of the MCP SDK to keep py-core dependency-light; the protocol
surface used here is tiny and frozen (initialize + tools/call only).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

MCP_URL = "https://mcp.valency.io/"
PROTOCOL_VERSION = "2025-11-25"


class ValencyUnavailable(RuntimeError):
    """Valency is down, misconfigured, or the token was rejected."""


class ValencyClient:
    """Async MCP client. Failures raise ValencyUnavailable; callers degrade."""

    def __init__(
        self,
        bearer_token: str,
        url: str = MCP_URL,
        timeout: float = 30.0,
    ) -> None:
        self._token = bearer_token
        self._url = url
        self._timeout = timeout
        self._session_id: str | None = None
        self._next_id = 0

    @property
    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    def _request(
        self,
        method: str,
        params: dict[str, Any] | None,
        notify: bool = False,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            body["params"] = params
        if not notify:
            self._next_id += 1
            body["id"] = self._next_id
        return body

    async def _post(self, payload: dict[str, Any], client: httpx.AsyncClient) -> dict[str, Any]:
        response = await client.post(self._url, json=payload, headers=self._headers)
        new_session = response.headers.get("Mcp-Session-Id")
        if new_session:
            self._session_id = new_session
        if response.status_code in (400, 401, 403):
            raise ValencyUnavailable(f"valency rejected request: HTTP {response.status_code}")
        if response.status_code == 404 and self._session_id:
            # session expired: drop it and let the caller retry once
            self._session_id = None
            raise ValencyUnavailable("session expired")

        # Streamable HTTP may answer with SSE frames; extract the JSON payload.
        text = response.text
        if text.startswith("event:") or text.startswith("data:"):
            for line in text.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[5:].strip())
            raise ValencyUnavailable("empty SSE response from valency")
        if not text:
            return {}  # 202 Accepted for notifications
        return response.json()

    async def _rpc(
        self, method: str, params: dict[str, Any] | None = None, notify: bool = False
    ) -> dict[str, Any]:
        """One JSON-RPC round trip with a single session-retry."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            payload = self._request(method, params, notify)
            result = await self._post(payload, client)
            if not notify and "error" in result:
                raise ValencyUnavailable(f"valency error: {result['error']}")
            return result

    async def initialize(self) -> dict[str, Any]:
        """MCP handshake. Returns serverInfo; call once before tools/call."""
        result = await self._rpc(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "omat-se", "version": "0.1.0"},
            },
        )
        await self._rpc("notifications/initialized", {}, notify=True)
        return result.get("result", {})

    async def call_tool(
        self, name: str, arguments: dict[str, Any] | None = None, _retry: bool = True
    ) -> dict[str, Any]:
        """Invoke a Valency endpoint by name. Retries once on session expiry."""
        if self._session_id is None:
            await self.initialize()
        params: dict[str, Any] = {"name": name}
        if arguments:
            params["arguments"] = arguments
        try:
            response = await self._rpc("tools/call", params)
        except ValencyUnavailable:
            if not _retry:
                raise
            self._session_id = None
            return await self.call_tool(name, arguments, _retry=False)

        result = response.get("result", {})
        if result.get("isError"):
            raise ValencyUnavailable(f"tool {name} failed: {result.get('content')}")
        return result

    @staticmethod
    def tool_text(result: dict[str, Any]) -> str:
        """tools/call results arrive as content blocks; join the text ones."""
        blocks = result.get("content", [])
        texts = [b.get("text", "") for b in blocks if b.get("type") == "text"]
        return "\n".join(t for t in texts if t)

    @staticmethod
    def tool_json(result: dict[str, Any]) -> Any:
        """Parse the first text block as JSON; Valency returns JSON strings."""
        text = ValencyClient.tool_text(result)
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text  # server sent prose; hand it through unchanged


# ---- Typed wrappers for the endpoints OMAT-SE uses -------------------------


class Valency:
    """High-level facade over ValencyClient. Topic-based only: your corpus is
    Elsevier, Valency's is preprint servers, so paper-identity lookups
    (find_similar by THEIR ids, citing) are second-class here. Search by
    material topic, not by your DOI."""

    def __init__(self, client: ValencyClient) -> None:
        self._client = client

    async def semantic_search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        result = await self._client.call_tool(
            "semantic_search_papers", {"query": query, "limit": limit}
        )
        return _as_papers(self._client.tool_json(result))

    async def search_by_title(self, title: str, limit: int = 5) -> list[dict[str, Any]]:
        result = await self._client.call_tool("search_by_title", {"title": title, "limit": limit})
        return _as_papers(self._client.tool_json(result))

    async def keyword_trends(self, keyword: str, category: str | None = None) -> dict[str, Any]:
        arguments: dict[str, Any] = {"keyword": keyword}
        if category:
            arguments["category"] = category
        result = await self._client.call_tool("get_keyword_trends", arguments)
        return _as_json_or_raw(self._client.tool_json(result))

    async def publication_trends(self, category: str) -> dict[str, Any]:
        result = await self._client.call_tool("get_publication_trends", {"category": category})
        return _as_json_or_raw(self._client.tool_json(result))

    async def author_profile(self, name: str) -> dict[str, Any]:
        result = await self._client.call_tool("get_author_profile", {"name": name})
        return _as_json_or_raw(self._client.tool_json(result))

    async def sources(self) -> dict[str, Any]:
        result = await self._client.call_tool("list_sources", {})
        return _as_json_or_raw(self._client.tool_json(result))


def _as_papers(payload: Any) -> list[dict[str, Any]]:
    """Valency's papers payload shape varies by endpoint; normalize to a list."""
    if payload is None:
        return []
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    if isinstance(payload, dict):
        for key in ("papers", "results", "data", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [p for p in value if isinstance(p, dict)]
        return [payload]
    return []


def _as_json_or_raw(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {"raw": payload}
