"""Provider adapter for the per-paper chat. REST via httpx, no SDK.

The exact Gemini model id lives in OMAT_GEMINI_MODEL — verify it against
Google's current catalog before shipping. Swapping providers means writing
another class with the same ``complete`` signature.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class LlmUnavailable(RuntimeError):
    pass


@dataclass
class LlmReply:
    text: str
    tool_call: dict[str, Any] | None = None  # {"name": ..., "arguments": {...}}


class GeminiProvider:
    def __init__(self, api_key: str, model: str, timeout: float = 60.0) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def complete(
        self,
        system: str,
        user: str,
        tool_result: dict[str, Any] | None = None,
        tool_name: str | None = None,
        tool_declarations: list[dict[str, Any]] | None = None,
    ) -> LlmReply:
        contents: list[dict[str, Any]] = [{"role": "user", "parts": [{"text": user}]}]
        if tool_name and tool_result is not None:
            contents = [
                {"role": "user", "parts": [{"text": user}]},
                {"role": "model", "parts": [{"functionCall": {"name": tool_name, "args": {}}}]},
                {"role": "user", "parts": [{
                    "functionResponse": {"name": tool_name,
                                         "response": {"result": json.dumps(tool_result)[:20000]}}},
                ]},
            ]
        body: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048},
        }
        if tool_declarations:
            body["tools"] = tool_declarations
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{GEMINI_BASE}/models/{self.model}:generateContent",
                params={"key": self.api_key},
                json=body,
            )
        if response.status_code != 200:
            raise LlmUnavailable(f"llm http {response.status_code}: {response.text[:200]}")
        payload = response.json()
        candidates = payload.get("candidates", [])
        if not candidates:
            raise LlmUnavailable("llm returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts)
        call = next((p.get("functionCall") for p in parts if "functionCall" in p), None)
        return LlmReply(text=text, tool_call=call)
