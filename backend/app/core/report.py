"""Deterministic plain-text downlink report (no AI). Fixed-width for low-bandwidth links."""
from __future__ import annotations

from typing import Optional

from . import stats
from .catalog import DEFAULT_SETTINGS, DOMAINS, LEVEL_LABEL, METRICS
from .evaluator import HealthEvaluator


def fmt(key: str, v) -> str:
    return f"{v:.{METRICS[key]['dec']}f}" if stats.is_num(v) else "—"


def build_report(entries: list[dict], settings_in: Optional[dict] = None, evaluator: Optional[HealthEvaluator] = None) -> str:
    settings = {**DEFAULT_SETTINGS, **(settings_in or {})}
    entries = sorted(entries, key=lambda e: e["date"])
    r = (evaluator or HealthEvaluator()).evaluate(entries, settings)
    if not r.latest:
        return "No check-ins recorded."
    L = ["ASTROVITAL HEALTH SUMMARY — CREW SELF-ASSESSMENT",
         f"Crew: {settings['crew_name']}   Date: {r.latest['date']}   Mission day: {r.mission_day if r.mission_day is not None else 'n/a'}",
         f"OVERALL STATUS: {LEVEL_LABEL[r.overall].upper()}", "", "DOMAINS"]
    L += [f"  {DOMAINS[k]['name']:<24} {LEVEL_LABEL[d['level']]}" for k, d in r.domains.items()]
    L += ["", "FINDINGS"]
    if not r.findings:
        L.append("  None — all indicators within personal baseline.")
    for i, f in enumerate(r.findings, 1):
        L.append(f"  {i}. [{LEVEL_LABEL[f.level]}]{' [SURGEON REVIEW]' if f.escalate else ''} {DOMAINS[f.domain]['name']}: {f.title}")
        L.append(f"     {f.detail}")
    L += ["", "LATEST READINGS (today | 7-day avg | baseline)"]
    recent = entries[-7:]
    for k, m in METRICS.items():
        v7 = stats.values(recent, k)
        b = r.baseline["metrics"].get(k)
        L.append(f"  {m['short']:<8} {fmt(k, r.latest.get(k)):>7} | {fmt(k, stats.mean(v7)) if v7 else '—':>7} | "
                 f"{fmt(k, b['mean']) if b else '—':>7} {m['unit']}")
    if r.radiation:
        rad = r.radiation
        L += ["", f"RADIATION  mission {rad['mission_dose']:.1f} mSv · career {rad['career']:.1f}/{rad['limit']:.0f} mSv "
                  f"({rad['pct']:.0f}%) · projected {rad['projected']:.0f} mSv"]
    if r.latest.get("notes"):
        L += ["", "CREW NOTES", "  " + r.latest["notes"]]
    L += ["", f"Baseline: {r.baseline['n']} {r.baseline['source']} entries."]
    return "\n".join(L)
