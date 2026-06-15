"""AIService — intent classification + content generation.

Provider order: Groq (primary, free + fast) -> Google Gemini (fallback).
All generation enforces strict JSON; responses are fence-stripped and parsed
with a single repair retry before falling back to a safe error payload.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.models.enums import CommandIntent

logger = get_logger("aura.ai")

GROQ_FAST = "llama-3.1-8b-instant"
GROQ_SMART = "llama-3.3-70b-versatile"
GEMINI_FAST = "gemini-2.0-flash-lite"
GEMINI_SMART = "gemini-2.0-flash"

_INTENTS = [i.value for i in CommandIntent]


class AIService:
    # ---- low-level providers ----
    async def _groq(self, model: str, system: str, user: str) -> str | None:
        if not settings.groq_api_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=40) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                    json={
                        "model": model,
                        "temperature": 0.4,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                    },
                )
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
            logger.warning("ai.groq_failed", status=r.status_code, model=model)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ai.groq_error", error=str(exc))
        return None

    async def _gemini(self, model: str, system: str, user: str) -> str | None:
        if not settings.gemini_api_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=40) as client:
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                    f"?key={settings.gemini_api_key}",
                    json={
                        "system_instruction": {"parts": [{"text": system}]},
                        "contents": [{"parts": [{"text": user}]}],
                        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
                    },
                )
            if r.status_code == 200:
                return r.json()["candidates"][0]["content"]["parts"][0]["text"]
            logger.warning("ai.gemini_failed", status=r.status_code, model=model)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ai.gemini_error", error=str(exc))
        return None

    async def _complete(self, tier: str, system: str, user: str) -> str | None:
        """tier = 'fast' | 'smart'. Groq first, Gemini fallback."""
        groq_model = GROQ_FAST if tier == "fast" else GROQ_SMART
        gemini_model = GEMINI_FAST if tier == "fast" else GEMINI_SMART
        out = await self._groq(groq_model, system, user)
        if out is None:
            out = await self._gemini(gemini_model, system, user)
        return out

    # ---- json helpers ----
    @staticmethod
    def _parse_json(raw: str | None) -> dict[str, Any] | None:
        if not raw:
            return None
        text = raw.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # salvage the outermost {...}
            start, end = text.find("{"), text.rfind("}")
            if start != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    return None
            return None

    # ---- classification ----
    async def classify_intent(self, command: str) -> CommandIntent:
        system = (
            "You are an intent classifier for a teaching assistant. Map the user's command "
            f"to EXACTLY ONE of these intents: {', '.join(_INTENTS)}. "
            'Respond with ONLY a JSON object: {"intent": "<one_of_the_intents>"}.'
        )
        raw = await self._complete("fast", system, f'Command: "{command}"')
        data = self._parse_json(raw) or {}
        value = str(data.get("intent", "")).strip().lower()
        try:
            return CommandIntent(value)
        except ValueError:
            logger.info("ai.intent_coerced_other", got=value, command=command[:60])
            return CommandIntent.OTHER

    # ---- generation ----
    async def generate_quiz(self, context: str) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Using ONLY the lecture context, create a quiz of "
            "EXACTLY 5 multiple-choice questions grounded in what was taught. "
            'Respond with ONLY JSON of the form: {"questions": [{"question": str, '
            '"options": [str, str, str, str], "answer_index": int (0-3), "explanation": str}]}. '
            "Exactly 5 questions; exactly 4 options each."
        )
        raw = await self._complete("smart", system, f"Lecture context:\n{context}")
        data = self._parse_json(raw)
        if not data or not isinstance(data.get("questions"), list) or not data["questions"]:
            return {"error": "Could not generate a valid quiz. Please try again."}
        # Normalize to exactly 5 well-formed questions.
        questions = []
        for q in data["questions"][:5]:
            opts = q.get("options") or []
            if len(opts) >= 4 and q.get("question"):
                questions.append(
                    {
                        "question": str(q["question"]),
                        "options": [str(o) for o in opts[:4]],
                        "answer_index": int(q.get("answer_index", 0)) % 4,
                        "explanation": str(q.get("explanation", "")),
                    }
                )
        if not questions:
            return {"error": "Could not generate a valid quiz. Please try again."}
        return {"questions": questions}


ai_service = AIService()
