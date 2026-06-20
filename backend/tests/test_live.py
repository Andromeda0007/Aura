from tests.util import admin_token, auth, client, make_hierarchy


def test_live_resolve_happy_and_404():
    h = auth(admin_token())
    sess = make_hierarchy(h)["session"]
    code = sess["join_code"]
    assert code and len(code) == 6

    r = client.get(f"/live/{code}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sessionId"] == sess["id"]

    # lowercase still resolves (codes are normalized)
    assert client.get(f"/live/{code.lower()}").status_code == 200
    assert client.get("/live/ZZZZZZ").status_code == 404


def test_ask_tutor_404():
    # invalid code is rejected before any LLM call
    r = client.post("/live/ZZZZZZ/ask", json={"question": "what is photosynthesis?"})
    assert r.status_code == 404
