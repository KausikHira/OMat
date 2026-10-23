"""SSE chat stream regression: every chunk on the wire must be a string.

``_sse`` was once declared ``async def`` but ``yield``-ed without ``await``,
so the response died on the first byte with ``AttributeError: 'coroutine'
object has no attribute 'encode'`` — the browser received zero chunks and
the UI silently fell back to its offline canned replies.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

from omat_api.deps import get_opensearch, get_redis
from omat_api.llm import GeminiProvider, LlmReply
from omat_api.main import app
from omat_api.routers import chat as chat_router
from omat_api.settings import Settings

REPLY = "Hardness peaks at 10 GPa (record r1)."


class FakeOpenSearch:
    async def search(self, *, index: str, body: dict[str, Any]) -> dict[str, Any]:
        source = {
            "record_id": "r1",
            "doi": "10.1234/test.2026.1",
            "article_pii": "S1234",
            "title": "A test paper",
            "composition": {"canonical": "Ti50-Al50"},
            "elements": ["Ti", "Al"],
            "applications": [{"raw": "structural-mechanical"}],
            "property": {"name": "Hardness", "slug": "hardness", "value": 10.0, "unit": "GPa"},
            "journal": {"name": "Journal of Testing"},
            "year": 2026,
        }
        return {"hits": {"hits": [{"_id": "r1", "_source": source}]}}


class FakeRedis:
    async def get(self, key: str) -> None:
        return None

    async def set(self, *args: Any, **kwargs: Any) -> bool:
        return True


def test_chat_streams_text_deltas(monkeypatch: Any) -> None:
    fake_settings = Settings(gemini_api_key="test-key", gemini_model="test-model")

    async def fake_complete(self: GeminiProvider, system: str, user: str, **kwargs: Any):
        return LlmReply(text=REPLY)

    monkeypatch.setattr(chat_router, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(GeminiProvider, "complete", fake_complete)
    app.dependency_overrides[get_opensearch] = lambda: FakeOpenSearch()
    app.dependency_overrides[get_redis] = lambda: FakeRedis()
    try:
        with (
            TestClient(app) as client,
            client.stream(
                "POST",
                "/v1/papers/10.1234/test.2026.1/chat",
                json={"message": "what is the hardness?"},
            ) as response,
        ):
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            body = "".join(response.iter_text())
    finally:
        app.dependency_overrides.clear()

    events = [line for line in body.split("\n\n") if line.startswith("data: ")]
    assert events, f"empty SSE body: {body!r}"
    assert events[-1] == "data: [DONE]"

    meta = json.loads(events[0].removeprefix("data: "))
    assert meta == {"paper": "10.1234/test.2026.1", "records": 1}

    deltas: list[str] = []
    for event in events[1:-1]:
        payload = json.loads(event.removeprefix("data: "))
        assert isinstance(payload.get("delta"), str), f"non-text delta: {payload!r}"
        deltas.append(payload["delta"])
    assert "".join(deltas) == REPLY
