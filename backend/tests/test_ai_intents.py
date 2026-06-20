"""Offline tests for the AI generators + classifier.

No real LLM/HTTP calls — `_complete` (and `_pubchem_lookup`) are monkeypatched
with canned data, so these assert SHAPE and routing, not model quality.
asyncio_mode=auto (pytest.ini) runs the async tests directly.
"""
import json

from app.models.enums import CommandIntent
from app.services.ai_service import AIService, ai_service


def _patch_complete(monkeypatch, payload: dict) -> None:
    async def fake_complete(self, tier, system, user):  # noqa: ANN001
        return json.dumps(payload)

    monkeypatch.setattr(AIService, "_complete", fake_complete)


# ---- classifier ----
async def test_classify_passthrough(monkeypatch):
    _patch_complete(monkeypatch, {"intent": "list_items"})
    assert await ai_service.classify_intent("list applications of CNNs") == CommandIntent.LIST_ITEMS


async def test_classify_coerces_unknown_to_other(monkeypatch):
    _patch_complete(monkeypatch, {"intent": "nonsense_intent"})
    assert await ai_service.classify_intent("blah") == CommandIntent.OTHER


async def test_classify_chemistry_nudge(monkeypatch):
    # model mislabels a molecule as a diagram -> nudged to chemistry
    _patch_complete(monkeypatch, {"intent": "generate_diagram"})
    assert await ai_service.classify_intent("draw benzene") == CommandIntent.GENERATE_CHEMISTRY


async def test_classify_no_nudge_for_non_molecule(monkeypatch):
    _patch_complete(monkeypatch, {"intent": "generate_diagram"})
    assert await ai_service.classify_intent("draw the RNN architecture") == CommandIntent.GENERATE_DIAGRAM


async def test_classify_question_nudges_explain_to_answer(monkeypatch):
    _patch_complete(monkeypatch, {"intent": "explain"})
    assert await ai_service.classify_intent("what is the chain rule") == CommandIntent.ANSWER_QUESTION
    assert await ai_service.classify_intent("why does dropout reduce overfitting") == CommandIntent.ANSWER_QUESTION
    assert await ai_service.classify_intent("is gradient descent convex?") == CommandIntent.ANSWER_QUESTION


async def test_classify_explain_request_stays_explain(monkeypatch):
    _patch_complete(monkeypatch, {"intent": "explain"})
    assert await ai_service.classify_intent("explain gradient descent") == CommandIntent.EXPLAIN
    # phrased as a question but explicitly asks to explain -> stays explain
    assert await ai_service.classify_intent("can you explain backprop") == CommandIntent.EXPLAIN


# ---- fact ----
async def test_generate_fact(monkeypatch):
    _patch_complete(monkeypatch, {"fact": "Light takes ~8 min from the Sun.", "source": "NASA"})
    out = await ai_service.generate_fact("ctx", "fun fact about light")
    assert out["fact"].startswith("Light")
    assert out["source"] == "NASA"


async def test_generate_fact_null_source(monkeypatch):
    _patch_complete(monkeypatch, {"fact": "X is true.", "source": None})
    out = await ai_service.generate_fact("ctx", "cmd")
    assert out["source"] is None


# ---- list ----
async def test_list_items_filters_blanks(monkeypatch):
    _patch_complete(monkeypatch, {"title": "Applications of CNNs", "items": ["Vision", "", "  ", "NLP"]})
    out = await ai_service.list_items("ctx", "list applications of CNNs")
    assert out["title"] == "Applications of CNNs"
    assert out["items"] == ["Vision", "NLP"]


async def test_list_items_empty_errors(monkeypatch):
    _patch_complete(monkeypatch, {"title": "x", "items": []})
    assert "error" in await ai_service.list_items("ctx", "cmd")


# ---- numerical ----
async def test_generate_numerical_numeric(monkeypatch):
    _patch_complete(
        monkeypatch,
        {"problem": "KE of 2kg at 3m/s?", "answer": "9.0", "unit": "J", "tolerance": "0.1", "reasoning": "0.5*m*v^2"},
    )
    out = await ai_service.generate_numerical("ctx", "make a numerical")
    assert out["answer"] == 9.0
    assert out["unit"] == "J"
    assert out["tolerance"] == 0.1
    assert out["reasoning"]


async def test_generate_numerical_symbolic(monkeypatch):
    _patch_complete(monkeypatch, {"problem": "Simplify", "answer": "x+1", "reasoning": "..."})
    out = await ai_service.generate_numerical("ctx", "cmd")
    assert out["answer"] == "x+1"
    assert out["tolerance"] is None


# ---- image ----
async def test_generate_image_builds_url(monkeypatch):
    _patch_complete(monkeypatch, {"prompt": "a single neuron, detailed, textbook"})
    out = await ai_service.generate_image("make an image of a neuron")
    assert out["prompt"] == "a single neuron, detailed, textbook"
    assert "image.pollinations.ai/prompt/" in out["imageUrl"]


# ---- chemistry ----
async def test_generate_chemistry_pubchem(monkeypatch):
    _patch_complete(monkeypatch, {"name": "benzene", "smiles": None, "caption": "aromatic ring"})

    async def fake_pub(self, name):  # noqa: ANN001
        return {"cid": 241, "smiles": "c1ccccc1", "imageUrl": "https://pubchem/cid/241/PNG"}

    monkeypatch.setattr(AIService, "_pubchem_lookup", fake_pub)
    out = await ai_service.generate_chemistry("create benzene")
    assert out["cid"] == 241
    assert out["imageUrl"].endswith("/PNG")
    assert out["smiles"] == "c1ccccc1"


async def test_generate_chemistry_falls_back_to_llm_smiles(monkeypatch):
    _patch_complete(monkeypatch, {"name": "weirdmol", "smiles": "CCO", "caption": "ethanol-ish"})

    async def fake_pub(self, name):  # noqa: ANN001
        return None

    monkeypatch.setattr(AIService, "_pubchem_lookup", fake_pub)
    out = await ai_service.generate_chemistry("draw weirdmol")
    assert out["imageUrl"] is None
    assert out["smiles"] == "CCO"


async def test_generate_chemistry_no_structure_note(monkeypatch):
    _patch_complete(monkeypatch, {"name": "nonsense", "smiles": None, "caption": "x"})

    async def fake_pub(self, name):  # noqa: ANN001
        return None

    monkeypatch.setattr(AIService, "_pubchem_lookup", fake_pub)
    out = await ai_service.generate_chemistry("draw nonsense")
    assert out["imageUrl"] is None and out["smiles"] is None
    assert "note" in out


# ---- diagram ----
async def test_generate_diagram_kind_and_circle_quoting(monkeypatch):
    _patch_complete(
        monkeypatch,
        {"mermaid": "flowchart TD\nn1((1: 8)) --> n2((3))", "title": "BST traversal", "kind": "flowchart"},
    )
    out = await ai_service.generate_diagram("ctx", "draw the BST with inorder visit order")
    assert out["kind"] == "flowchart"
    assert '(("1: 8"))' in out["mermaid"]


# ---- answer ----
async def test_answer_backfills_reasoning_from_feedback(monkeypatch):
    _patch_complete(monkeypatch, {"answer": "42", "feedback": "because the chain rule"})
    out = await ai_service.answer_question("ctx", "why")
    assert out["answer"] == "42"
    assert out["reasoning"] == "because the chain rule"
