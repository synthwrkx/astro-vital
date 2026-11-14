from datetime import date


def test_catalog(client):
    r = client.get("/api/catalog").json()
    assert "hr" in r["metrics"] and len(r["symptoms"]) == 20 and "glucose" in r["guides"] and len(r["hazards"]) == 5 and "radiation" in r["domains"]


def test_first_checkin_sets_mission_start_and_evaluates(client):
    d = "2026-11-10"
    r = client.put(f"/api/entries/{d}", json={"date": d, "hr": 64, "temp": 38.3, "symptoms": ["sore_throat"]})
    assert r.status_code == 200, r.text
    ev = r.json()
    assert ev["overall"] == "act" and ev["findings"][0]["title"] == "Fever"
    assert client.get("/api/settings").json()["mission_start"] == d


def test_validation_rejects_implausible_values(client):
    d = "2026-11-10"
    r = client.put(f"/api/entries/{d}", json={"date": d, "hr": 900})
    assert r.status_code == 422
    r = client.put(f"/api/entries/{d}", json={"date": d, "symptoms": ["made_up"]})
    assert r.status_code == 422


def test_patch_merges_pvt(client):
    d = "2026-11-10"
    client.put(f"/api/entries/{d}", json={"date": d, "hr": 60})
    r = client.patch(f"/api/entries/{d}", json={"pvt": 280, "lapses": 2})
    assert r.json()["hr"] == 60 and r.json()["pvt"] == 280


def test_demo_status_report_export_import_clear(client):
    assert client.post("/api/demo").json()["imported"] == 138
    st = client.get("/api/status").json()
    assert st["overall"] == "act" and st["mission_day"] == 124
    assert "OVERALL STATUS" in client.get("/api/report").text
    dump = client.get("/api/export").json()
    assert len(dump["entries"]) == 138
    client.delete("/api/data")
    assert client.get("/api/entries").json() == []
    assert client.post("/api/import", json=dump).json()["imported"] == 138
    assert client.get("/api/status").json()["mission_day"] == 124


def test_delete_entry(client):
    d = date.today().isoformat()
    client.put(f"/api/entries/{d}", json={"date": d, "hr": 60})
    assert client.delete(f"/api/entries/{d}").status_code == 204
    assert client.get(f"/api/entries/{d}").status_code == 404


def test_ai_status_reports_offline_model(client):
    r = client.get("/api/ai/status").json()
    assert r == {"enabled": True, "model": "astrovital-onboard-v1", "version": "1.0.0", "offline": True, "reason": ""}


def test_ai_endpoints(client):
    assert client.post("/api/ai/briefing").status_code == 400  # no data yet
    client.post("/api/demo")
    b = client.post("/api/ai/briefing").json()
    assert b["priorities"] and b["contact_flight_surgeon"] is True
    r = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "How is my sleep?"}]}).json()
    assert "Sleep" in r["reply"] and r["sources"][0].startswith("intent: sleep")
    d = client.post("/api/ai/parse-checkin", json={"text": "slept 6 hours, HR 61, headache"}).json()
    assert d["sleep"] == 6 and d["hr"] == 61 and d["symptoms"] == ["headache"]
    md = client.post("/api/ai/surgeon-report").json()["markdown"]
    assert md.startswith("## Summary") and "## Radiation" in md


def test_ai_disabled_null_object(client, monkeypatch):
    from app.ai import get_assistant
    from app.ai.disabled import DisabledHealthAssistant
    client.app.dependency_overrides[get_assistant] = lambda: DisabledHealthAssistant("off for test")
    client.post("/api/demo")
    assert client.get("/api/ai/status").json()["enabled"] is False
    r = client.post("/api/ai/briefing")
    assert r.status_code == 503 and r.json()["detail"] == "off for test"


def test_profiles_in_catalog_and_settings(client):
    cat = client.get("/api/catalog").json()
    assert cat["profiles"]["mars_transit"]["dose_msv_day"] == 1.84
    s = client.get("/api/settings").json()
    assert s["mission_profile"] == "iss"
    s["mission_profile"] = "mars_transit"
    assert client.put("/api/settings", json=s).json()["mission_profile"] == "mars_transit"
    s["mission_profile"] = "jupiter"
    assert client.put("/api/settings", json=s).status_code == 422


def test_timeline_endpoint(client):
    client.post("/api/demo")
    t = client.get("/api/timeline").json()
    assert t["summary"]["days"] == 138 and t["events"]


def test_migration_adds_missing_column(tmp_path):
    import sqlite3
    from app.persistence.db import make_engine
    db = tmp_path / "old.db"
    con = sqlite3.connect(db)   # a settings table from before mission_profile existed
    con.execute("CREATE TABLE missionsettings (id INTEGER PRIMARY KEY, crew_name VARCHAR, mission_start VARCHAR, "
                "mission_length INTEGER, prior_career_dose FLOAT, career_limit FLOAT, aerobic_target INTEGER, "
                "resistance_target INTEGER, fluid_target FLOAT)")
    con.execute("INSERT INTO missionsettings VALUES (1,'Old',NULL,180,0,600,60,60,2.0)")
    con.commit(); con.close()
    make_engine(f"sqlite:///{db}")
    cols = [r[1] for r in sqlite3.connect(db).execute("PRAGMA table_info(missionsettings)")]
    assert "mission_profile" in cols
    assert sqlite3.connect(db).execute("SELECT mission_profile FROM missionsettings").fetchone()[0] == "iss"


def test_routine_endpoint(client):
    client.post("/api/demo")
    r = client.get("/api/routine").json()
    assert r["total"] >= 9 and r["tasks"][0]["id"] == "vitals" and "badges" in r


def test_photo_upload_list_get_delete(client):
    import base64
    png = base64.b64encode(bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6300010000050001"
        "0d0a2db40000000049454e44ae426082")).decode()
    r = client.post("/api/photos", json={"date": "2026-11-10", "tag": "rash", "data_url": f"data:image/png;base64,{png}"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert client.get("/api/photos?day=2026-11-10").json()[0]["tag"] == "rash"
    img = client.get(f"/api/photos/{pid}")
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    assert "PHOTOS ATTACHED: 1" in client.get("/api/report").text
    client.post("/api/demo")                       # replacing all data also clears photos
    assert client.get("/api/photos").json() == []
    r = client.post("/api/photos", json={"date": "2026-11-10", "tag": "rash", "data_url": f"data:image/png;base64,{png}"})
    pid = r.json()["id"]
    bad = client.post("/api/photos", json={"date": "2026-11-10", "data_url": "data:text/plain;base64,aGk="})
    assert bad.status_code == 422
    assert client.delete(f"/api/photos/{pid}").status_code == 204
