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
    async def generate_quiz(self, context: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Using ONLY the lecture context, create a quiz of "
            "EXACTLY 5 multiple-choice questions grounded in what was taught. "
            'Respond with ONLY JSON of the form: {"questions": [{"question": str, '
            '"options": [str, str, str, str], "answer_index": int (0-3), "explanation": str}]}. '
            "Exactly 5 questions; exactly 4 options each."
        )
        raw = await self._complete("smart", self._with_language(system, language), f"Lecture context:\n{context}")
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

    @staticmethod
    def _with_language(system: str, language: str | None) -> str:
        if language and language.lower() != "english":
            return (
                system
                + f" Write all human-readable text values in {language} "
                "(keep JSON keys and any code/Mermaid syntax in English/ASCII)."
            )
        return system

    async def _generate_json(self, tier: str, system: str, user: str) -> dict[str, Any]:
        raw = await self._complete(tier, system, user)
        data = self._parse_json(raw)
        if not data:
            return {"error": "Generation failed. Please try again."}
        return data

    async def summarize(self, context: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Summarize the lecture context in 200-500 words, "
            "clear and well structured. Respond with ONLY JSON: "
            '{"summary": str, "keyPoints": [str, ...]}.'
        )
        return await self._generate_json("smart", self._with_language(system, language), f"Lecture context:\n{context}")

    async def explain(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Explain the requested concept clearly using the lecture "
            'context. Respond with ONLY JSON: {"explanation": str, "nextTopics": [str, str, str]}.'
        )
        return await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )

    async def generate_example(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Produce ONE worked example relevant to the lecture. "
            'Respond with ONLY JSON: {"problem": str, "solution": str, "correct_answer": str}.'
        )
        return await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )

    async def generate_diagram(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Create a Mermaid diagram (flowchart/sequence/graph) that "
            "illustrates the requested concept from the lecture. Use valid Mermaid syntax. "
            'Respond with ONLY JSON: {"mermaid": str, "title": str}.'
        )
        data = await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )
        if "mermaid" in data and isinstance(data["mermaid"], str):
            data["mermaid"] = data["mermaid"].strip().removeprefix("```mermaid").removeprefix("```").removesuffix("```").strip()
        return data

    async def answer_question(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Answer the question using the lecture context. "
            'Respond with ONLY JSON: {"answer": str, "feedback": str}.'
        )
        return await self._generate_json(
            "smart", self._with_language(system, language), f"Question: {command}\n\nContext:\n{context}"
        )

    # ---- teacher superpowers (on-demand tools) ----
    async def differentiate(self, content: str, audience: str) -> dict[str, Any]:
        system = (
            "You adapt teaching content for a specific audience while preserving every key fact "
            f"and concept. Rewrite the content for: {audience}. Keep it accurate and complete; "
            "adjust vocabulary, sentence length, and scaffolding to fit the audience. "
            'Respond with ONLY JSON: {"content": str, "notes": [str, ...]} where notes lists the '
            "main adaptations you made."
        )
        return await self._generate_json("smart", system, f"Original content:\n{content}")

    async def lesson_plan(self, topic: str, grade: str, minutes: int) -> dict[str, Any]:
        system = (
            "You are a master teacher. Create a complete, classroom-ready lesson plan. "
            'Respond with ONLY JSON: {"title": str, "objectives": [str, ...], '
            '"materials": [str, ...], "activities": [{"name": str, "minutes": int, '
            '"description": str}, ...], "assessment": str, "homework": str}. '
            f"Target grade level: {grade}. Total class time: {minutes} minutes "
            "(activity minutes should sum to about that)."
        )
        return await self._generate_json("smart", system, f"Lesson topic / context:\n{topic}")

    async def worksheet(self, topic: str, count: int) -> dict[str, Any]:
        system = (
            "You are a teacher creating a printable worksheet with an answer key. "
            f"Produce {count} questions of mixed difficulty. "
            'Respond with ONLY JSON: {"title": str, "instructions": str, '
            '"problems": [{"question": str, "answer": str}, ...]}.'
        )
        return await self._generate_json("smart", system, f"Worksheet topic / context:\n{topic}")

    async def rubric(self, assignment: str) -> dict[str, Any]:
        system = (
            "You are a teacher creating a grading rubric with four performance levels "
            '("Excellent", "Proficient", "Developing", "Beginning"). '
            'Respond with ONLY JSON: {"title": str, "levels": [str, str, str, str], '
            '"criteria": [{"name": str, "descriptions": [str, str, str, str]}, ...]} '
            "where each criterion has one description per level, in the same order as levels."
        )
        return await self._generate_json("smart", system, f"Assignment:\n{assignment}")

    async def grade_open(self, question: str, guidance: str, response: str) -> dict[str, Any]:
        system = (
            "You grade an open-ended student response fairly and constructively. "
            'Respond with ONLY JSON: {"score": int, "max": int, "feedback": str, '
            '"strengths": [str, ...], "improvements": [str, ...]}. Use a 0-10 scale (max=10).'
        )
        user = f"Question/prompt:\n{question}\n\nGrading guidance:\n{guidance}\n\nStudent response:\n{response}"
        return await self._generate_json("smart", system, user)

    async def standards(self, content: str) -> dict[str, Any]:
        system = (
            "You align teaching content to academic standards (e.g. Common Core, NGSS). "
            'Respond with ONLY JSON: {"standards": [{"code": str, "description": str}, ...], '
            '"note": str}. Suggest 3-6 plausible standards; if unsure of exact codes, give the '
            "closest standard family and say so in note."
        )
        return await self._generate_json("smart", system, f"Content:\n{content}")

    async def format_board(self, context: str) -> dict[str, Any]:
        system = (
            "You reformat messy whiteboard OCR text into clean, well-structured blocks. "
            'Respond with ONLY JSON: {"blocks": [str, ...]} where each block is a tidy line/heading.'
        )
        return await self._generate_json("fast", system, f"Whiteboard / context:\n{context}")

    async def validate_answer(self, problem: str, correct_answer: str, user_answer: str) -> dict[str, Any]:
        system = (
            "You grade a student's answer. Be lenient on formatting, units, and phrasing; judge "
            'correctness of meaning. Respond with ONLY JSON: {"isCorrect": bool, "feedback": str}.'
        )
        user = f"Problem: {problem}\nExpected: {correct_answer}\nStudent answer: {user_answer}"
        return await self._generate_json("fast", system, user)

    async def compress_context(self, buffer_text: str) -> dict[str, Any]:
        """Compress a lecture buffer into a structured summary segment."""
        system = (
            "Compress this lecture buffer into a structured JSON summary that preserves "
            "continuity for later questions. Respond with ONLY JSON: "
            '{"topicFlow": [str], "keyConcepts": {concept: definition}, '
            '"visualReferences": [str], "dependencies": [str]}.'
        )
        data = await self._generate_json("fast", system, buffer_text[:8000])
        if "topicFlow" in data:
            return data
        # Extractive fallback so compression always produces something usable.
        words: list[str] = []
        for w in buffer_text.split():
            if w.lower() not in words:
                words.append(w.lower())
            if len(words) >= 12:
                break
        return {
            "topicFlow": words,
            "keyConcepts": {},
            "visualReferences": [],
            "dependencies": [],
            "_fallback": True,
        }


ai_service = AIService()
