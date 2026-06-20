"""AIService — intent classification + content generation.

Provider order: Groq (primary, free + fast) -> Google Gemini (fallback).
All generation enforces strict JSON; responses are fence-stripped and parsed
with a single repair retry before falling back to a safe error payload.
"""
from __future__ import annotations

import asyncio
import contextvars
import json
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.models.enums import CommandIntent

logger = get_logger("aura.ai")

# A molecule name + a draw/show verb should render a real structure, not a generic
# diagram/image — used as a small post-classification nudge.
_CHEM_HINTS = (
    "benzene", "glucose", "caffeine", "water", "methane", "ethanol", "aspirin",
    "ammonia", "carbon dioxide", "co2", "h2o", "nacl", "sodium chloride", "ethene",
    "acetic acid", "ethane", "propane", "butane", "sucrose", "fructose", "methanol",
    "cholesterol", "penicillin", "toluene", "phenol", "acetone", "smiles",
    "molecular structure", "chemical structure", "molecule",
)

# A direct question (vs. "explain X") should get answer + reasoning.
_QUESTION_STARTERS = frozenset(
    "what whats what's why how when where who whom which is are was were does do "
    "did can could would should will".split()
)

# Per-coroutine LLM token accumulator. asyncio tasks copy the context at creation,
# so each process_command task counts its own tokens (classify + generate) safely.
_tokens_var: contextvars.ContextVar[int] = contextvars.ContextVar("aura_tokens", default=0)


def _add_tokens(n: int) -> None:
    if n:
        _tokens_var.set(_tokens_var.get() + int(n))

GROQ_FAST = "llama-3.1-8b-instant"
GROQ_SMART = "llama-3.3-70b-versatile"
GEMINI_FAST = "gemini-2.0-flash-lite"
GEMINI_SMART = "gemini-2.0-flash"

_INTENTS = [i.value for i in CommandIntent]


class AIService:
    # ---- token accounting (per coroutine) ----
    @staticmethod
    def reset_tokens() -> None:
        _tokens_var.set(0)

    @staticmethod
    def tokens_used() -> int:
        return _tokens_var.get()

    # ---- low-level providers ----
    async def _groq(self, model: str, system: str, user: str) -> str | None:
        if not settings.groq_api_key:
            return None
        payload = {
            "model": model,
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=40) as client:
                    r = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                        json=payload,
                    )
                if r.status_code == 200:
                    body = r.json()
                    _add_tokens((body.get("usage") or {}).get("total_tokens", 0))
                    return body["choices"][0]["message"]["content"]
                if r.status_code == 429 and attempt < 2:
                    await asyncio.sleep(1.0 + attempt)  # back off on rate limit, then retry
                    continue
                logger.warning("ai.groq_failed", status=r.status_code, model=model)
                return None
            except Exception as exc:  # noqa: BLE001
                logger.warning("ai.groq_error", error=str(exc))
                return None
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
                body = r.json()
                _add_tokens((body.get("usageMetadata") or {}).get("totalTokenCount", 0))
                return body["candidates"][0]["content"]["parts"][0]["text"]
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
    @staticmethod
    def _looks_like_chemistry(command: str) -> bool:
        low = command.lower()
        return any(h in low for h in _CHEM_HINTS)

    @staticmethod
    def _looks_like_question(command: str) -> bool:
        c = command.strip().lower()
        if c.endswith("?"):
            return True
        first = c.split()[0] if c.split() else ""
        return first.rstrip("'s") in _QUESTION_STARTERS

    async def classify_intent(self, command: str) -> CommandIntent:
        system = (
            "You are an intent classifier for a teaching assistant. Map the user's command to "
            f"EXACTLY ONE intent from this list: {', '.join(_INTENTS)}.\n"
            "Definitions:\n"
            "- generate_quiz: make a quiz / MCQs / test questions.\n"
            "- summarize: summarize or recap the lecture.\n"
            "- explain: explain or teach a concept in depth.\n"
            "- generate_example: ONE fully worked example with its solution shown.\n"
            "- generate_numerical: a numeric problem to SOLVE (calculate/compute), answer hidden.\n"
            "- generate_diagram: a schematic of a process, architecture, or DATA STRUCTURE (flowchart, "
            "RNN/CNN/system, states, tree, graph, stack, queue, hash map, linked list) drawn with boxes/arrows.\n"
            "- generate_chemistry: the chemical/molecular structure of a named compound (benzene, glucose, caffeine...).\n"
            "- generate_image: a pictorial/realistic illustration OR a spatial physics figure that needs real "
            "geometry/forces — free-body/friction diagrams, banking of a road, ray/optics diagrams, circuits, "
            "or any photo/picture of something.\n"
            "- list_items: enumerate applications/uses/types/examples as a list.\n"
            "- generate_fact: one interesting fact.\n"
            "- answer_question: answer a direct question.\n"
            "- format_board: clean up / format the whiteboard text.\n"
            "- other: anything else.\n"
            "Disambiguation: 'draw/show structure of <molecule>' -> generate_chemistry (NOT diagram/image); "
            "'draw/diagram <process, model, or data structure like stack/queue/tree>' -> generate_diagram; "
            "spatial PHYSICS figures (free-body/friction, banking of a road, ray diagram, circuit) and "
            "'image/picture/photo of X' -> generate_image; "
            "'list/applications/uses/types of X' -> list_items; 'calculate/numerical/problem' -> generate_numerical.\n"
            "Examples:\n"
            '"draw a stack" -> generate_diagram\n'
            '"draw a queue" -> generate_diagram\n'
            '"draw a hash map" -> generate_diagram\n'
            '"draw the free body diagram of a block on an incline with friction" -> generate_image\n'
            '"draw the banking of a road" -> generate_image\n'
            '"draw a ray diagram for a convex lens" -> generate_image\n'
            '"make a quiz on this lecture" -> generate_quiz\n'
            '"summarize what we covered" -> summarize\n'
            '"explain gradient descent" -> explain\n'
            '"work through an example of integration by parts" -> generate_example\n'
            '"make a numerical on momentum" -> generate_numerical\n'
            '"calculate the kinetic energy of a 2kg ball at 3 m/s" -> generate_numerical\n'
            '"draw the RNN architecture with nodes and edges" -> generate_diagram\n'
            '"make a flow diagram of backpropagation" -> generate_diagram\n'
            '"diagram the TCP handshake" -> generate_diagram\n'
            '"draw benzene" -> generate_chemistry\n'
            '"create benzene" -> generate_chemistry\n'
            '"show me the structure of caffeine" -> generate_chemistry\n'
            '"make an image of a neuron" -> generate_image\n'
            '"generate a picture of a mitochondria" -> generate_image\n'
            '"list the applications of CNNs" -> list_items\n'
            '"what are the uses of recursion" -> list_items\n'
            '"give an interesting fact about backprop" -> generate_fact\n'
            '"fun fact about the speed of light" -> generate_fact\n'
            '"what is the chain rule" -> answer_question\n'
            '"why does dropout reduce overfitting" -> answer_question\n'
            '"clean up the board" -> format_board\n'
            'Respond with ONLY a JSON object: {"intent": "<one_of_the_intents>"}.'
        )
        raw = await self._complete("fast", system, f'Command: "{command}"')
        data = self._parse_json(raw) or {}
        value = str(data.get("intent", "")).strip().lower()
        try:
            intent = CommandIntent(value)
        except ValueError:
            logger.info("ai.intent_coerced_other", got=value, command=command[:60])
            intent = CommandIntent.OTHER
        # Nudge: a molecule name with a draw/show verb is chemistry, not a generic
        # diagram/image. Only redirects those two intents.
        if intent in (CommandIntent.GENERATE_DIAGRAM, CommandIntent.GENERATE_IMAGE) and self._looks_like_chemistry(command):
            intent = CommandIntent.GENERATE_CHEMISTRY
        # A direct question ("what is X", "why does Y") should answer + reason,
        # not give an open-ended explanation — unless it explicitly asks to explain.
        if intent == CommandIntent.EXPLAIN and self._looks_like_question(command) and "explain" not in command.lower():
            intent = CommandIntent.ANSWER_QUESTION
        return intent

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

    async def generate_fact(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Share ONE accurate, genuinely interesting fact relevant to "
            "the request (use the lecture context if helpful). "
            'Respond with ONLY JSON: {"fact": str, "source": str|null}.'
        )
        data = await self._generate_json(
            "fast", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )
        if not data.get("fact"):
            return data if "error" in data else {"error": "Could not generate a fact. Please try again."}
        return {
            "fact": str(data["fact"]).strip(),
            "source": str(data["source"]).strip() if data.get("source") else None,
        }

    async def list_items(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Produce a titled list answering the request "
            "(applications, uses, types, examples, etc.) with 4-12 concise items. "
            'Respond with ONLY JSON: {"title": str, "items": [str, ...]}.'
        )
        data = await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )
        items = [str(i).strip() for i in (data.get("items") or []) if str(i).strip()]
        if not items:
            return data if "error" in data else {"error": "Could not generate a list. Please try again."}
        return {"title": str(data.get("title") or command).strip(), "items": items[:12]}

    async def generate_numerical(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Create ONE numerical problem the student can solve, with a "
            "definite answer. Respond with ONLY JSON: "
            '{"problem": str, "answer": (number or string), "unit": str|null, '
            '"tolerance": (number or null), "reasoning": str}. '
            "reasoning = full step-by-step solution; tolerance = acceptable +/- on the numeric answer."
        )
        data = await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )
        if not data.get("problem"):
            return data if "error" in data else {"error": "Could not generate a numerical. Please try again."}
        answer = data.get("answer")
        return {
            "problem": str(data["problem"]).strip(),
            "answer": self._coerce_number(answer) if answer is not None else "",
            "unit": str(data["unit"]).strip() if data.get("unit") else None,
            "tolerance": self._coerce_tolerance(data.get("tolerance")),
            "reasoning": str(data.get("reasoning", "")).strip(),
        }

    async def generate_image(self, command: str, language: str | None = None) -> dict[str, Any]:
        """Generate a picture via Pollinations (free, keyless). Only the refined
        prompt leaves the machine — never lecture context."""
        if not settings.pollinations_enabled:
            return {"prompt": command, "imageUrl": None, "note": "Image generation is disabled."}
        system = (
            "Rewrite the user's request into a single vivid, concrete image-generation prompt "
            "(subject, setting, style, detail). No preamble. "
            'Respond with ONLY JSON: {"prompt": str}.'
        )
        data = await self._generate_json("fast", system, f"Request: {command}")
        prompt = str(data.get("prompt") or "").strip() or command.strip()
        return {"prompt": prompt, "imageUrl": self._pollinations_url(prompt), "provider": "pollinations"}

    async def generate_chemistry(self, command: str, language: str | None = None) -> dict[str, Any]:
        """Resolve a molecule to a structure: PubChem by name (official 2D image +
        SMILES), falling back to an LLM-emitted SMILES the frontend renders."""
        system = (
            "Identify the chemical the user wants drawn. Respond with ONLY JSON: "
            '{"name": str, "smiles": str|null, "caption": str}. '
            "name = common or IUPAC compound name; smiles = its SMILES if you are confident, else null; "
            "caption = one short line describing it."
        )
        data = await self._generate_json("fast", self._with_language(system, language), f"Request: {command}")
        name = str(data.get("name") or "").strip() or command.strip()
        smiles = str(data["smiles"]).strip() if data.get("smiles") else None
        result: dict[str, Any] = {
            "name": name,
            "smiles": smiles,
            "imageUrl": None,
            "cid": None,
            "caption": str(data.get("caption") or name).strip(),
        }
        pub = await self._pubchem_lookup(name)
        if pub:
            result["cid"] = pub["cid"]
            result["imageUrl"] = pub["imageUrl"]
            result["smiles"] = pub.get("smiles") or smiles
        elif not smiles:
            result["note"] = "Could not resolve a structure; showing description only."
        return result

    # ---- numeric / external helpers ----
    @staticmethod
    def _coerce_number(value: Any) -> float | str:
        """Parse a numeric answer to float (tolerating commas); keep symbolic answers as str."""
        if isinstance(value, (int, float)):
            return value
        s = str(value).strip().replace(",", "")
        try:
            return float(s)
        except ValueError:
            return str(value).strip()

    @staticmethod
    def _coerce_tolerance(value: Any) -> float | None:
        if value is None:
            return None
        try:
            t = float(value)
        except (ValueError, TypeError):
            return None
        return t if t >= 0 else None

    @staticmethod
    def _pollinations_url(prompt: str, width: int = 1024, height: int = 768) -> str:
        return (
            f"https://image.pollinations.ai/prompt/{quote(prompt.strip()[:400])}"
            f"?width={width}&height={height}&nologo=true"
        )

    async def _pubchem_lookup(self, name: str) -> dict[str, Any] | None:
        """PubChem PUG REST: name -> {cid, smiles, imageUrl}. None on miss/error."""
        if not settings.pubchem_enabled or not name.strip():
            return None
        base = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
        try:
            async with httpx.AsyncClient(timeout=settings.external_http_timeout) as client:
                r = await client.get(f"{base}/compound/name/{quote(name.strip())}/property/CanonicalSMILES/JSON")
            if r.status_code != 200:
                return None
            props = ((r.json() or {}).get("PropertyTable") or {}).get("Properties") or []
            if not props or not props[0].get("CID"):
                return None
            cid = props[0]["CID"]
            return {
                "cid": cid,
                "smiles": props[0].get("CanonicalSMILES"),
                "imageUrl": f"{base}/compound/cid/{cid}/PNG",
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("ai.pubchem_error", error=str(exc))
            return None

    async def generate_diagram(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Produce a DETAILED, well-structured Mermaid diagram for the "
            "request. Choose the BEST diagram type for the subject:\n"
            "- processes / algorithms -> flowchart TD\n"
            "- architectures, neural nets (RNN, CNN, transformer), pipelines, systems -> flowchart LR with subgraphs per layer/stage\n"
            "- data structures (binary tree, BST, heap, stack, queue, linked list, hash map, weighted graph) "
            "and traversals (BFS, DFS, inorder/preorder/postorder) -> flowchart TD (trees/stacks) or LR "
            "(graphs/queues/linked lists) drawn as REAL boxes/vertices and edges\n"
            "- interactions over time -> sequenceDiagram\n"
            "- lifecycles / states -> stateDiagram-v2\n"
            "- data models / entities -> erDiagram or classDiagram\n"
            "- concept overviews -> mindmap\n"
            "Rules so it ALWAYS renders:\n"
            "- The FIRST line declares the type (e.g. `flowchart LR`).\n"
            '- Wrap EVERY node label in double quotes for any shape: rectangle A["Input x_t"], '
            'circle n1(("8")), rhombus d{"x>0?"}.\n'
            "- Node IDs use ASCII letters/digits/underscore only.\n"
            "- For TREES and GRAPHS: use CIRCLE nodes for vertices, e.g. n1((\"8\")) --> n2((\"3\")); "
            'put each vertex VALUE/number inside the circle; put edge weights/numbers as edge labels, '
            'e.g. a((\"A\")) ---|\"5\"| b((\"B\")) (use --- for undirected, --> for directed).\n'
            "- Define each node EXACTLY ONCE with its COMPLETE label; never redefine a node ID later.\n"
            "- For TRAVERSALS (BFS/DFS/inorder/...): draw the actual tree/graph and encode the VISIT ORDER "
            'INSIDE each node\'s single label, e.g. n4(("#1=1")) (1st-visited, value 1) and n1(("#4=8")). '
            "Do NOT add extra nodes for the order or list it as text.\n"
            "- Group related nodes in `subgraph`s; for emphasis add a couple of `classDef` styles and apply "
            "them with `class`. classDef styles are comma-separated with NO spaces, e.g. "
            "`classDef hot fill:#f96,stroke:#333,stroke-width:2px`.\n"
            "- Aim for 8-20 nodes and show the REAL structure (loops, branches, layers, children) — never a trivial chain.\n"
            "- No prose, comments, or markdown fences outside the diagram.\n"
            'Respond with ONLY JSON: {"mermaid": str, "title": str, "kind": str} '
            "where kind is one of: flowchart, sequence, state, class, er, mindmap."
        )
        data = await self._generate_json(
            "smart", self._with_language(system, language), f"Request: {command}\n\nContext:\n{context}"
        )
        if "mermaid" in data and isinstance(data["mermaid"], str):
            data["mermaid"] = self._sanitize_mermaid(data["mermaid"])
            data["kind"] = self._diagram_kind_from_src(data["mermaid"])
        return data

    @staticmethod
    def _diagram_kind_from_src(src: str) -> str:
        head = src.strip().lower()
        if head.startswith("sequencediagram"):
            return "sequence"
        if head.startswith("statediagram"):
            return "state"
        if head.startswith("classdiagram"):
            return "class"
        if head.startswith("erdiagram"):
            return "er"
        if head.startswith("mindmap"):
            return "mindmap"
        return "flowchart"

    @staticmethod
    def _sanitize_mermaid(src: str) -> str:
        """Best-effort cleanup of LLM Mermaid: strip fences/prose, canonicalize the
        header, and auto-quote rectangle/rhombus labels that contain chars which
        commonly break the parser. The frontend still validates before rendering."""
        import re

        s = src.strip()
        s = re.sub(r"^```(?:mermaid)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s).strip()

        headers = (
            "flowchart", "graph", "sequencediagram", "classdiagram", "statediagram",
            "erdiagram", "mindmap", "gantt", "pie", "journey",
        )
        lines = s.splitlines()
        start = next(
            (i for i, ln in enumerate(lines) if ln.strip().lower().startswith(headers)), 0
        )
        s = "\n".join(lines[start:]).strip()
        s = re.sub(r"^graph\b", "flowchart", s)  # alias -> canonical
        if not s.lower().startswith(("flowchart", "sequencediagram", "classdiagram",
                                     "statediagram", "erdiagram", "mindmap", "gantt",
                                     "pie", "journey")):
            s = "flowchart TD\n" + s

        def quote_label(m: "re.Match[str]") -> str:
            open_b, inner, close_b = m.group(1), m.group(2).strip(), m.group(3)
            if not inner or (inner.startswith('"') and inner.endswith('"')):
                return m.group(0)
            if re.search(r"""[()\[\]{}<>:;#&|/\\'"]""", inner):
                return f'{open_b}"{inner.replace(chr(34), chr(39))}"{close_b}'
            return m.group(0)

        def quote_circle(m: "re.Match[str]") -> str:
            inner = m.group(1).strip()
            if not inner or (inner.startswith('"') and inner.endswith('"')):
                return m.group(0)
            if re.search(r"""[\[\]{}<>:;#&|/\\'"]""", inner):
                return f'(("{inner.replace(chr(34), chr(39))}"))'
            return m.group(0)

        s = re.sub(r"(\[)([^\[\]\n]*?)(\])", quote_label, s)  # rectangle [..]
        s = re.sub(r"(\{)([^{}\n]*?)(\})", quote_label, s)  # rhombus {..}
        s = re.sub(r"\(\(([^()\n]*?)\)\)", quote_circle, s)  # circle ((..)) for tree/graph nodes
        return s.strip()

    async def answer_question(self, context: str, command: str, language: str | None = None) -> dict[str, Any]:
        system = (
            "You are an expert teacher. Answer the question using the lecture context. "
            "ALWAYS provide BOTH a direct answer AND your reasoning. "
            'Respond with ONLY JSON: {"answer": str, "reasoning": str}.'
        )
        data = await self._generate_json(
            "smart", self._with_language(system, language), f"Question: {command}\n\nContext:\n{context}"
        )
        # Older prompt used "feedback"; keep reasoning always populated.
        if "answer" in data and not data.get("reasoning"):
            data["reasoning"] = str(data.get("feedback", "")).strip()
        return data

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
