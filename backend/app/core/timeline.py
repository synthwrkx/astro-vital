"""Mission timeline: replays the evaluator over the mission, day by day, to tell its story.

For each day it evaluates only the data known up to that day (no hindsight), then records:
  * the daily overall level (a status ribbon for the whole mission), and
  * episodes: when a finding first appeared and when it cleared.
A finding must be absent for `gap_days` consecutive days before an episode counts as cleared,
so day-to-day flicker doesn't create noise.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .catalog import LEVELS
from .evaluator import HealthEvaluator
from .stats import mission_day

PHASES = [  # (name, first mission day, last mission day or None)
    ("Preflight baseline", None, 0),
    ("Launch & adaptation", 1, 14),
    ("Early mission", 15, 60),
    ("Mid mission", 61, 100),
    ("Late mission", 101, None),
]


def phase_of(md: Optional[int]) -> str:
    if md is None:
        return "Mission"
    for name, lo, hi in PHASES:
        if (lo is None or md >= lo) and (hi is None or md <= hi):
            return name
    return "Mission"


@dataclass
class Episode:
    key: str
    domain: str
    title: str
    level: str
    escalate: bool
    start: str
    start_md: Optional[int]
    detail: str
    end: Optional[str] = None
    end_md: Optional[int] = None
    peak_level: str = "watch"
    days: int = 0
    _last_seen: int = field(default=0, repr=False)

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


def build_timeline(entries: list[dict], settings: dict, evaluator: Optional[HealthEvaluator] = None,
                   gap_days: int = 3) -> dict:
    evaluator = evaluator or HealthEvaluator()
    entries = sorted(entries, key=lambda e: e["date"])
    ribbon: list[dict] = []
    open_eps: dict[str, Episode] = {}
    done: list[Episode] = []

    for i, e in enumerate(entries):
        ev = evaluator.evaluate(entries[: i + 1], settings)
        md = mission_day(e["date"], settings)
        ribbon.append({"date": e["date"], "mission_day": md, "level": ev.overall, "findings": len(ev.findings)})
        seen = set()
        for f in ev.findings:
            key = f"{f.domain}:{f.title}"
            seen.add(key)
            ep = open_eps.get(key)
            if ep is None:
                ep = open_eps[key] = Episode(key, f.domain, f.title, f.level, f.escalate, e["date"], md, f.detail,
                                             peak_level=f.level)
            ep.days += 1
            ep._last_seen = i
            if LEVELS[f.level] > LEVELS[ep.peak_level]:
                ep.peak_level, ep.detail = f.level, f.detail
            ep.escalate = ep.escalate or f.escalate
        for key in [k for k in open_eps if k not in seen]:
            ep = open_eps[key]
            if i - ep._last_seen >= gap_days:
                last = entries[ep._last_seen]
                ep.end, ep.end_md = last["date"], mission_day(last["date"], settings)
                done.append(open_eps.pop(key))

    episodes = sorted([*done, *open_eps.values()], key=lambda ep: (ep.start, -LEVELS[ep.peak_level]))
    events: list[dict] = []
    prev = None
    for r in ribbon:   # status transitions become chapter markers
        if prev is not None and r["level"] != prev:
            events.append({"kind": "status", "date": r["date"], "mission_day": r["mission_day"], "level": r["level"],
                           "from_level": prev, "phase": phase_of(r["mission_day"])})
        prev = r["level"]
    for ep in episodes:
        events.append({"kind": "onset", "date": ep.start, "mission_day": ep.start_md, "phase": phase_of(ep.start_md), **ep.to_dict()})
        if ep.end:
            events.append({"kind": "resolved", "date": ep.end, "mission_day": ep.end_md, "phase": phase_of(ep.end_md),
                           "title": ep.title, "domain": ep.domain, "days": ep.days, "key": ep.key})
    events.sort(key=lambda x: (x["date"], {"status": 0, "onset": 1, "resolved": 2}[x["kind"]]))

    days_by_level = {lvl: sum(1 for r in ribbon if r["level"] == lvl) for lvl in LEVELS}
    return {
        "ribbon": ribbon,
        "episodes": [ep.to_dict() for ep in episodes],
        "events": events,
        "summary": {
            "days": len(ribbon),
            "days_by_level": days_by_level,
            "episodes": len(episodes),
            "act_episodes": sum(1 for ep in episodes if ep.peak_level == "act"),
            "resolved": sum(1 for ep in episodes if ep.end),
            "open": sum(1 for ep in episodes if not ep.end),
        },
        "phases": [{"name": n, "from": lo, "to": hi} for n, lo, hi in PHASES],
    }
