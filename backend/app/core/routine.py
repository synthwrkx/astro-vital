"""Daily mission routine and gamification.

Routine tasks are completed automatically from check-in data, so there's nothing extra to tick off:
logging resting HR and BP completes "Morning vitals", a PVT result completes "Alertness test", and so on.
Engagement mechanics reward consistency without ever rewarding hiding symptoms:
  * streak  — consecutive days with a core check-in (vitals + sleep + mood)
  * score   — today's routine completion (0–100)
  * XP / level — 10 XP per task completed, across the mission
  * badges  — milestones (first check-in, 7- and 30-day streaks, countermeasure and hydration streaks…)
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, Optional

from .catalog import DEFAULT_SETTINGS
from .profiles import profile
from .stats import is_num, mission_day

Entry = dict
Check = Callable[[Entry, dict], bool]


def _has(*keys: str) -> Check:
    return lambda e, s: all(is_num(e.get(k)) for k in keys)


TASKS: list[dict] = [
    {"id": "vitals", "title": "Morning vitals", "when": "Morning", "metrics": ["hr", "sbp", "dbp", "spo2", "temp"],
     "how": "Resting heart rate, blood pressure, SpO₂ and temperature after 5 minutes of rest.", "check": _has("hr", "sbp", "spo2", "temp")},
    {"id": "glucose", "title": "Fasting blood sugar", "when": "Before breakfast", "metrics": ["glucose"],
     "how": "Finger-stick glucometer reading before eating.", "check": _has("glucose")},
    {"id": "sleep", "title": "Log last night's sleep", "when": "On waking", "metrics": ["sleep"],
     "how": "Hours actually slept.", "check": _has("sleep")},
    {"id": "pvt", "title": "Alertness test", "when": "Morning / before EVA", "metrics": ["pvt"], "link": "/alertness",
     "how": "The 3-minute psychomotor vigilance test.", "check": _has("pvt")},
    {"id": "resistance", "title": "Resistance exercise", "when": "Daytime", "metrics": ["resistance"],
     "how": "Meet your loaded-exercise target (bone and muscle protection).",
     "check": lambda e, s: is_num(e.get("resistance")) and e["resistance"] >= s["resistance_target"]},
    {"id": "aerobic", "title": "Aerobic exercise", "when": "Daytime", "metrics": ["aerobic"],
     "how": "Treadmill or cycle session to target.",
     "check": lambda e, s: is_num(e.get("aerobic")) and e["aerobic"] >= s["aerobic_target"]},
    {"id": "hydration", "title": "Hydration goal", "when": "All day", "metrics": ["fluid"],
     "how": "Drink at least your fluid target (kidney-stone prevention).",
     "check": lambda e, s: is_num(e.get("fluid")) and e["fluid"] >= s["fluid_target"]},
    {"id": "meals", "title": "Log meals", "when": "End of day", "metrics": ["calories", "protein"],
     "how": "Energy (kcal) and protein from meal labels.", "check": _has("calories", "protein")},
    {"id": "wellbeing", "title": "Mood & stress check", "when": "Evening", "metrics": ["mood", "stress", "fatigue"],
     "how": "Three quick 1–5 ratings, private to you.", "check": _has("mood", "stress", "fatigue")},
    {"id": "dose", "title": "Dosimeter reading", "when": "Daily", "metrics": ["dose"], "space_only": True,
     "how": "Today's dose in mSv from your personal dosimeter.", "check": _has("dose")},
]

XP_PER_TASK = 10
XP_PER_LEVEL = 1000


def _tasks_for(settings: dict) -> list[dict]:
    space = profile(settings.get("mission_profile"))["kind"] == "space"
    return [t for t in TASKS if space or not t.get("space_only")]


def _core_done(e: Optional[Entry]) -> bool:
    return bool(e) and all(is_num(e.get(k)) for k in ("hr", "sleep", "mood"))


def _streak(by_date: dict[str, Entry], end: date, ok: Callable[[Optional[Entry]], bool]) -> int:
    n, d = 0, end
    if not ok(by_date.get(d.isoformat())):   # today not done yet: count back from yesterday
        d -= timedelta(days=1)
    while ok(by_date.get(d.isoformat())):
        n += 1
        d -= timedelta(days=1)
    return n


def _best_streak(entries: list[Entry], ok: Callable[[Optional[Entry]], bool]) -> tuple[int, Optional[str]]:
    best, run, prev, best_end = 0, 0, None, None
    for e in entries:
        d = date.fromisoformat(e["date"])
        run = run + 1 if ok(e) and prev is not None and (d - prev).days == 1 and run > 0 else (1 if ok(e) else 0)
        prev = d
        if run > best:
            best, best_end = run, e["date"]
    return best, best_end


def build_routine(entries: list[Entry], settings_in: dict, today: Optional[date] = None) -> dict:
    settings = {**DEFAULT_SETTINGS, **(settings_in or {})}
    entries = sorted(entries, key=lambda e: e["date"])
    today = today or date.today()
    by_date = {e["date"]: e for e in entries}
    tasks = _tasks_for(settings)
    t_entry = by_date.get(today.isoformat(), {})

    todays = [{k: v for k, v in t.items() if k != "check"} | {"done": bool(t_entry) and t["check"](t_entry, settings)} for t in tasks]
    done = sum(t["done"] for t in todays)
    xp = sum(XP_PER_TASK for e in entries for t in tasks if t["check"](e, settings))

    streak = _streak(by_date, today, _core_done)
    best, _ = _best_streak(entries, _core_done)
    res_ok = lambda e: bool(e) and is_num(e.get("resistance")) and e["resistance"] >= settings["resistance_target"]  # noqa: E731
    fluid_ok = lambda e: bool(e) and is_num(e.get("fluid")) and e["fluid"] >= settings["fluid_target"]  # noqa: E731
    pvt_week = sum(1 for i in range(7) if is_num(by_date.get((today - timedelta(days=i)).isoformat(), {}).get("pvt")))
    last7_sleep = [e["sleep"] for e in entries[-7:] if is_num(e.get("sleep"))]
    preflight = sum(1 for e in entries if (md := mission_day(e["date"], settings)) is not None and md <= 0)

    def badge(id_, title, desc, progress: float, goal: float):
        return {"id": id_, "title": title, "desc": desc, "earned": progress >= goal, "progress": min(progress, goal), "goal": goal}

    badges = [
        badge("first", "First check-in", "Logged your first daily check-in.", len(entries), 1),
        badge("baseline", "Baseline builder", "5 preflight check-ins: AstroVital knows your normal.", preflight, 5),
        badge("streak7", "Week streak", "7 days in a row of core check-ins.", best, 7),
        badge("streak30", "Mission regular", "30 days in a row of core check-ins.", best, 30),
        badge("bones", "Countermeasure champion", "Resistance target met 7 days in a row.", _best_streak(entries, res_ok)[0], 7),
        badge("hydro", "Hydration hero", "Fluid target met 7 days in a row.", _best_streak(entries, fluid_ok)[0], 7),
        badge("sharp", "Sharp mind", "Alertness test 5 times in the last 7 days.", pvt_week, 5),
        badge("sleep", "Sleep guardian", "7-night average of 7 h or more.", (sum(last7_sleep) / len(last7_sleep)) if last7_sleep else 0, 7),
    ]
    return {
        "today": today.isoformat(),
        "mission_day": mission_day(today.isoformat(), settings),
        "tasks": todays,
        "done": done, "total": len(todays),
        "score": round(100 * done / len(todays)) if todays else 0,
        "streak": streak, "best_streak": best,
        "xp": xp, "level": 1 + xp // XP_PER_LEVEL, "level_progress": (xp % XP_PER_LEVEL) / XP_PER_LEVEL,
        "badges": badges,
    }
