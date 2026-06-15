from app.core.config import settings
from app.services.context_manager import ContextManager


def test_buffer_add_tokens_snapshot_clear():
    cm = ContextManager()
    sid = "sess-a"
    assert cm.tokens(sid) == 0
    cm.add(sid, "speech", "x" * 40)  # ~10 tokens
    assert cm.tokens(sid) >= 10
    snap = cm.snapshot_text(sid)
    assert "[speech]" in snap
    cm.clear(sid)
    assert cm.tokens(sid) == 0
    assert cm.snapshot_text(sid) == ""


def test_should_compress(monkeypatch):
    monkeypatch.setattr(settings, "compression_token_limit", 5)
    cm = ContextManager()
    sid = "sess-b"
    assert not cm.should_compress(sid)
    cm.add(sid, "speech", "z" * 40)
    assert cm.should_compress(sid)
