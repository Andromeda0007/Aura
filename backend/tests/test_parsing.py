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
