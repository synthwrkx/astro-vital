from datetime import date

from app import core as E
from app.core.demo import generate_demo

END = date(2026, 11, 10)


def _upto(day: int):
    settings, entries = generate_demo(END)
    return settings, [e for e in entries if E.mission_day(e["date"], settings) <= day]


def titles(ev):
    return [f.title for f in ev.findings]


def test_empty():
    ev = E.evaluate([], {})
    assert ev.overall == "ok" and ev.findings == [] and ev.latest is None


def test_baseline_uses_preflight():
    settings, entries = generate_demo(END)
    b = E.compute_baseline(entries, settings)
    assert b["source"] == "preflight" and b["n"] == 14
    assert 60 < b["metrics"]["hr"]["mean"] < 65


def test_demo_end_state_flags_alertness_and_slow_declines():
    settings, entries = generate_demo(END)
    ev = E.evaluate(entries, settings)
    assert ev.overall == "act"
    assert ev.findings[0].title == "Alertness markedly reduced"
    assert ev.mission_day == 124
    t = titles(ev)
    assert "Resistance exercise below target" in t
    assert "Recurring headaches" in t
    assert "Mood gradually declining" in t
    assert ev.radiation and 300 < ev.radiation["career"] < 380 and ev.radiation["expected_rate"] == 1.84


def test_fever_episode_detected():
    settings, entries = _upto(45)
    ev = E.evaluate(entries, settings)
    assert ev.overall == "act"
    assert "Fever" in titles(ev)


def test_solar_particle_event_detected():
    settings, entries = _upto(72)
    ev = E.evaluate(entries, settings)
    assert titles(ev)[0].startswith("Radiation dose spike")
    assert ev.findings[0].escalate


def test_red_flag_symptom_escalates():
    settings, entries = generate_demo(END)
    entries[-1] = {**entries[-1], "symptoms": ["chest_pain"]}
    ev = E.evaluate(entries, settings)
    assert ev.overall == "act"
    f = next(f for f in ev.findings if f.title.startswith("Symptom: Chest"))
    assert f.escalate and f.domain == "cardio"


def test_findings_sorted_most_severe_first():
    settings, entries = generate_demo(END)
    entries[-1] = {**entries[-1], "temp": 38.6}
    ev = E.evaluate(entries, settings)
    levels = [E.LEVELS[f.level] for f in ev.findings]
    assert levels == sorted(levels, reverse=True)


def test_report_mentions_status():
    settings, entries = generate_demo(END)
    r = E.build_report(entries, settings)
    assert "OVERALL STATUS: ACT NOW" in r and "Mission day: 124" in r


def test_custom_rule_set_is_pluggable():
    """Open/closed: the evaluator runs whatever rules it is given."""
    from app.core.rules.base import HealthRule

    class AlwaysWatch(HealthRule):
        domain = "env"

        def evaluate(self, ctx):
            return [self.finding("watch", "Test rule", "fired", ["noop"])]

    settings, entries = generate_demo(END)
    ev = E.HealthEvaluator([AlwaysWatch()]).evaluate(entries, settings)
    assert [f.title for f in ev.findings] == ["Test rule"] and ev.overall == "watch"


def test_every_rule_carries_scientific_evidence():
    from app.core.rules import default_rules
    assert all(r.evidence for r in default_rules() if r.domain != "*")
    settings, entries = generate_demo(END)
    assert all(f.evidence for f in E.evaluate(entries, settings).findings)


def test_profile_sets_expected_dose_and_flags_excess():
    settings, entries = generate_demo(END)
    mars = E.evaluate(entries, settings)
    assert mars.radiation["expected_rate"] == 1.84
    assert not any(f.title == "Background dose above mission profile" for f in mars.findings)
    iss = E.evaluate(entries, {**settings, "mission_profile": "iss"})   # Mars-level dose on an ISS profile is flagged
    assert any(f.title == "Background dose above mission profile" for f in iss.findings)
    # an Earth analog has no expected dose's expectation of 0 → rule skipped, not misfired
    ant = E.evaluate(entries, {**settings, "mission_profile": "antarctic"})
    assert not any(f.title == "Background dose above mission profile" for f in ant.findings)
    lunar_low = [{**e, "dose": 3.0} if e.get("dose") else e for e in entries]   # 3 mSv/day ≫ 1.37 lunar
    hi = E.evaluate(lunar_low, {**settings, "mission_profile": "lunar_surface"})
    assert any(f.title == "Background dose above mission profile" for f in hi.findings)


def test_exercise_rule_ignores_preflight_days():
    settings, entries = generate_demo(END)
    upto_day2 = [e for e in entries if E.mission_day(e["date"], settings) <= 2]
    assert not any("exercise" in f.title.lower() for f in E.evaluate(upto_day2, settings).findings)


def test_timeline_tells_the_demo_story():
    from app.core.timeline import build_timeline
    settings, entries = generate_demo(END)
    t = build_timeline(entries, settings)
    onsets = {(ev["mission_day"], ev["title"]) for ev in t["events"] if ev["kind"] == "onset"}
    assert (45, "Fever") in onsets
    assert (72, "Radiation dose spike — possible solar particle event") in onsets
    fever = next(ep for ep in t["episodes"] if ep["title"] == "Fever")
    assert fever["end"] is not None and fever["peak_level"] == "act"
    assert len(t["ribbon"]) == len(entries) and t["summary"]["days_by_level"]["act"] > 0


def test_glucose_rule_levels():
    settings, entries = generate_demo(END)
    def run(g):
        es = [*entries[:-1], {**entries[-1], "glucose": g}]
        return {f.title: f for f in E.evaluate(es, settings).findings}
    assert run(50)["Blood sugar dangerously low"].escalate
    assert "Blood sugar low" in run(65)
    assert "Blood sugar above normal" in run(130)
    assert run(240)["Blood sugar very high"].level == "act"
    assert not any("Blood sugar" in t for t in run(92))


def test_demo_shows_energy_deficit_behind_mass_loss():
    settings, entries = generate_demo(END)
    t = [f.title for f in E.evaluate(entries, settings).findings]
    assert "Energy intake below target" in t and "Body mass declining" in t


def test_routine_auto_completes_and_gamifies():
    from app.core.routine import build_routine
    settings, entries = generate_demo(END)
    r = build_routine(entries, settings, today=END)
    done = {t["id"]: t["done"] for t in r["tasks"]}
    assert done["vitals"] and done["sleep"] and done["glucose"] and done["meals"]
    assert not done["resistance"]                   # demo's last day is below the exercise target
    assert r["streak"] >= 100 and r["level"] > 1 and 0 <= r["score"] <= 100
    earned = {b["id"] for b in r["badges"] if b["earned"]}
    assert {"first", "baseline", "streak7", "streak30"} <= earned
    analog = build_routine(entries, {**settings, "mission_profile": "antarctic"}, today=END)
    assert "dose" not in {t["id"] for t in analog["tasks"]}     # no dosimeter task on Earth


def test_knowledge_covers_five_hazards_with_sources():
    from app.core.knowledge import HAZARDS, METRIC_GUIDES, SOURCES
    assert [h["letter"] for h in HAZARDS] == list("RIDGE")
    assert all(src in SOURCES for h in HAZARDS for src in h["sources"])
    assert set(METRIC_GUIDES) == set(E.METRICS)
