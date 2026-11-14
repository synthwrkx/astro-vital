"""EvaluationContext: everything a rule needs, computed once per evaluation.

Rules depend on this read-only view instead of raw lists (dependency inversion), so
windows, baselines and z-scores are defined in exactly one place.
"""
from __future__ import annotations

from functools import cached_property
from typing import Any, Optional

from . import stats
from .catalog import DEFAULT_SETTINGS, METRICS
from .models import Finding


def compute_baseline(entries: list[dict], settings: dict) -> dict:
    """Personal baseline: mean ± SD of preflight check-ins (falls back to the first 14)."""
    base = [e for e in entries if (md := stats.mission_day(e["date"], settings)) is not None and md <= 0]
    source = "preflight"
    if len(base) < 5:
        base, source = entries[:14], "first check-ins"
    metrics = {}
    for k, m in METRICS.items():
        v = stats.values(base, k)
        if len(v) < 3:
            continue
        metrics[k] = {"mean": stats.mean(v), "sd": max(stats.sd(v), m["min_sd"]), "median": stats.median(v), "n": len(v)}
    return {"metrics": metrics, "n": len(base), "source": source}


class EvaluationContext:
    def __init__(self, entries: list[dict], settings: Optional[dict] = None):
        self.settings: dict[str, Any] = {**DEFAULT_SETTINGS, **(settings or {})}
        self.entries: list[dict] = sorted(entries, key=lambda e: e["date"])
        self.findings: list[Finding] = []  # accumulated by the evaluator, readable by later rules

    # ---- windows
    @property
    def latest(self) -> dict:
        return self.entries[-1]

    @property
    def recent(self) -> list[dict]:
        return self.entries[-7:]

    @property
    def recent3(self) -> list[dict]:
        return self.entries[-3:]

    @property
    def last14(self) -> list[dict]:
        return self.entries[-14:]

    @property
    def recent_flight(self) -> list[dict]:
        """Last 7 entries restricted to flight days (countermeasure targets don't apply preflight)."""
        return [e for e in self.recent if (md := stats.mission_day(e["date"], self.settings)) is None or md >= 1]

    @cached_property
    def flight_entries(self) -> list[dict]:
        return [e for e in self.entries if (md := stats.mission_day(e["date"], self.settings)) is None or md >= 1]

    # ---- mission
    @cached_property
    def mission_day(self) -> Optional[int]:
        return stats.mission_day(self.latest["date"], self.settings) if self.entries else None

    @property
    def in_flight(self) -> bool:
        return self.mission_day is None or self.mission_day >= 1

    # ---- baseline & statistics
    @cached_property
    def baseline(self) -> dict:
        return compute_baseline(self.entries, self.settings)

    def base(self, key: str) -> Optional[dict]:
        return self.baseline["metrics"].get(key)

    def z(self, key: str, v: Any) -> Optional[float]:
        b = self.base(key)
        return (v - b["mean"]) / b["sd"] if b and stats.is_num(v) else None

    def avg7(self, key: str) -> Optional[float]:
        return stats.avg(self.recent, key)

    def avg3(self, key: str) -> Optional[float]:
        return stats.avg(self.recent3, key)

    # ---- symptoms
    @cached_property
    def symptoms_today(self) -> set[str]:
        return set(self.latest.get("symptoms") or [])

    def symptom_days(self, sid: str) -> int:
        """Number of days in the last 7 entries on which a symptom was reported."""
        return sum(1 for e in self.recent if sid in (e.get("symptoms") or []))

    def has_finding(self, title: str) -> bool:
        return any(f.title == title for f in self.findings)
