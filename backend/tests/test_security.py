from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    h = hash_password("secret123")
    assert h != "secret123"
    assert verify_password("secret123", h)
    assert not verify_password("wrong", h)


def test_access_token_roundtrip():
    token = create_access_token("user-1")
    payload = decode_token(token, expected_type="access")
    assert payload and payload["sub"] == "user-1" and payload["type"] == "access"


def test_refresh_token_wrong_type_rejected():
    token = create_refresh_token("user-1")
    assert decode_token(token, expected_type="access") is None
    ok = decode_token(token, expected_type="refresh")
    assert ok and ok["sub"] == "user-1"


def test_garbage_token():
    assert decode_token("not-a-token") is None
