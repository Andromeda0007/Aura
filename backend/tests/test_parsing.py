import pytest

from app.models.enums import CommandIntent
from app.services.ai_service import AIService


def test_parse_plain_json():
    assert AIService._parse_json('{"a": 1}') == {"a": 1}


def test_parse_fenced_json():
    assert AIService._parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_salvage_outer_braces():
    assert AIService._parse_json('blah blah {"a": 1} trailing') == {"a": 1}


def test_parse_bad_returns_none():
    assert AIService._parse_json("not json at all") is None


def test_parse_none_returns_none():
    assert AIService._parse_json(None) is None


def test_intent_enum_coercion():
    with pytest.raises(ValueError):
        CommandIntent("bogus_intent")  # classify() catches this -> OTHER
    assert CommandIntent("generate_quiz") is CommandIntent.GENERATE_QUIZ
    assert CommandIntent("format_board") is CommandIntent.FORMAT_BOARD


# ---- numeric coercion ----
def test_coerce_number_int_float():
    assert AIService._coerce_number(5) == 5
    assert AIService._coerce_number(9.8) == 9.8


def test_coerce_number_strings():
    assert AIService._coerce_number("1,200") == 1200.0
    assert AIService._coerce_number("3.0e2") == 300.0
    assert AIService._coerce_number("x+1") == "x+1"  # symbolic kept as-is


def test_coerce_tolerance():
    assert AIService._coerce_tolerance(None) is None
    assert AIService._coerce_tolerance("0.5") == 0.5
    assert AIService._coerce_tolerance(-1) is None  # negative -> None
    assert AIService._coerce_tolerance("abc") is None


# ---- pollinations url ----
def test_pollinations_url():
    url = AIService._pollinations_url("a single neuron")
    assert url.startswith("https://image.pollinations.ai/prompt/")
    assert "a%20single%20neuron" in url
    assert "nologo=true" in url


# ---- diagram kind detection ----
def test_diagram_kind_from_src():
    assert AIService._diagram_kind_from_src("sequenceDiagram\nA->>B: hi") == "sequence"
    assert AIService._diagram_kind_from_src("stateDiagram-v2\n[*]-->A") == "state"
    assert AIService._diagram_kind_from_src("erDiagram\nA ||--o{ B : x") == "er"
    assert AIService._diagram_kind_from_src("classDiagram\nA <|-- B") == "class"
    assert AIService._diagram_kind_from_src("mindmap\nroot") == "mindmap"
    assert AIService._diagram_kind_from_src("flowchart LR\nA-->B") == "flowchart"


# ---- mermaid sanitizer (multi-type, trees/graphs) ----
def test_sanitize_prepends_flowchart_when_missing():
    out = AIService._sanitize_mermaid("A --> B")
    assert out.lower().startswith("flowchart")


def test_sanitize_preserves_statediagram():
    src = "stateDiagram-v2\n[*] --> Idle\nIdle --> Running"
    out = AIService._sanitize_mermaid(src)
    assert out.lower().startswith("statediagram")
    assert "[*]" in out  # start/end marker not corrupted
    assert "flowchart" not in out.lower()


def test_sanitize_preserves_sequencediagram():
    out = AIService._sanitize_mermaid("sequenceDiagram\nA->>B: hello")
    assert out.lower().startswith("sequencediagram")


def test_sanitize_quotes_circle_node_labels():
    # tree/graph circle node with a colon (visit order) must get quoted
    out = AIService._sanitize_mermaid('flowchart TD\nn1((1: 8)) --> n2((3))')
    assert '(("1: 8"))' in out
    assert "((3))" in out  # plain number left alone


def test_sanitize_preserves_subgraph_and_classdef():
    src = (
        'flowchart LR\nsubgraph L1["Layer 1"]\nA["x"]\nend\n'
        "classDef hot fill:#f96\nclass A hot"
    )
    out = AIService._sanitize_mermaid(src)
    assert "subgraph" in out
    assert "classDef hot" in out
    assert "class A hot" in out


def test_sanitize_fixes_stray_gt_after_edge_label():
    # `|label|> B` (stray '>') and the resulting double space both break Mermaid.
    out = AIService._sanitize_mermaid('flowchart TD\nA["x"] -->|"push(5)"|> B["y"]')
    assert "|>" not in out
    assert "|  " not in out  # no double space after a pipe


def test_sanitize_collapses_double_space_after_pipe():
    out = AIService._sanitize_mermaid('flowchart TD\nA["x"] -->|"push(5)"|  B["y"]')
    assert "|  " not in out
    assert "| B" in out


def test_sanitize_quotes_unquoted_edge_label_with_parens():
    out = AIService._sanitize_mermaid('flowchart LR\nH["Hash"] -->|hash(key)| B["Bucket"]')
    assert '|"hash(key)"|' in out


def test_sanitize_quotes_multiword_subgraph_title():
    out = AIService._sanitize_mermaid("flowchart LR\nsubgraph Symmetric Key Cryptography\nA-->B\nend")
    assert 'subgraph "Symmetric Key Cryptography"' in out
