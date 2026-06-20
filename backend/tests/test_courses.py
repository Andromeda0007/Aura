from tests.util import admin_token, auth, client, make_hierarchy


def test_hierarchy_crud_and_counts():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    assert hier["course"]["batch_id"] == hier["batch_id"]
    assert hier["session"]["unit_id"] == hier["unit"]["id"]

    batches = client.get("/batches", headers=h).json()
    row = next(b for b in batches if b["id"] == hier["batch_id"])
    assert row["courses"] >= 1 and row["sessions"] >= 1

    courses = client.get(f"/courses?batch_id={hier['batch_id']}", headers=h).json()
    crow = next(c for c in courses if c["id"] == hier["course"]["id"])
    assert crow["units"] == 1 and crow["sessions"] == 1 and "tokensUsed" in crow

    detail = client.get(f"/courses/{hier['course']['id']}", headers=h).json()
    assert detail["units"][0]["sessions"] == 1

    udetail = client.get(f"/units/{hier['unit']['id']}", headers=h).json()
    assert udetail["sessions"][0]["id"] == hier["session"]["id"]


def test_scoped_stats_ok():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    for path in (
        f"/units/{hier['unit']['id']}/stats",
        f"/courses/{hier['course']['id']}/stats",
        f"/batches/{hier['batch_id']}/stats",
    ):
        body = client.get(path, headers=h).json()
        assert body["totalSessions"] >= 1
        assert "tokensUsed" in body and "hardestConcepts" in body
