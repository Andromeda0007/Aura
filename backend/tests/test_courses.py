from tests.util import admin_token, auth, client, make_batch, make_hierarchy


def test_duplicate_batch_rejected():
    h = auth(admin_token())
    b = make_batch(h)
    dup = client.post(
        "/batches", json={"start_year": b["start_year"], "end_year": b["end_year"]}, headers=h
    )
    assert dup.status_code == 409


def test_hierarchy_crud_and_counts():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    assert hier["course"]["semester_id"] == hier["semester"]["id"]
    assert hier["session"]["unit_id"] == hier["unit"]["id"]

    # batch list shows department + session counts
    batches = client.get("/batches", headers=h).json()
    row = next(b for b in batches if b["id"] == hier["batch"]["id"])
    assert row["departments"] >= 1 and row["sessions"] >= 1

    # department auto-created 8 semesters
    depts = client.get(f"/departments?batch_id={hier['batch']['id']}", headers=h).json()
    drow = next(d for d in depts if d["id"] == hier["department"]["id"])
    assert drow["semesters"] == 8

    # semester page lists its courses with counts
    sem = client.get(f"/semesters/{hier['semester']['id']}", headers=h).json()
    assert sem["courses"][0]["id"] == hier["course"]["id"]
    assert "tokensUsed" in sem["courses"][0]

    # course detail returns units with session counts
    detail = client.get(f"/courses/{hier['course']['id']}", headers=h).json()
    assert detail["units"][0]["sessions"] == 1


def test_scoped_stats_ok():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    for path in (
        f"/semesters/{hier['semester']['id']}/stats",
        f"/courses/{hier['course']['id']}/stats",
        f"/departments/{hier['department']['id']}/stats",
        f"/batches/{hier['batch']['id']}/stats",
    ):
        body = client.get(path, headers=h).json()
        assert body["totalSessions"] >= 1
        assert "tokensUsed" in body and "hardestConcepts" in body
