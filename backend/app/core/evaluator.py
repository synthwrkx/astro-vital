"""HealthEvaluator: runs a list of HealthRule strategies and rolls up the result.

The evaluator knows nothing about specific health checks; rules are injected
(dependency inversion), so tests or future missions can supply a different set.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Optional, Sequence

from .catalog import DOMAINS, LEVELS, METRICS
from .context import EvaluationContext
from .models import Evaluation, worse
from .rules import HealthRule, default_rules, radiation_summary


class HealthEvaluator:
    def __init__(self, rules: Optional[Sequence[HealthRule]] = None):
        self.rules: Sequence[HealthRule] = rules if rules is not None else default_rules()

    def evaluate(self, entries: list[dict], settings: Optional[dict] = None) -> Evaluation:
        ctx = EvaluationContext(entries, settings)
        ev = Evaluation(baseline=ctx.baseline, domains={k: {"level": "ok", "findings": []} for k in DOMAINS})
        if not ctx.entries:
            return ev
        ev.latest, ev.mission_day = ctx.latest, ctx.mission_day

        for rule in self.rules:
            ctx.findings.extend(rule.evaluate(ctx))

        ev.findings = sorted(ctx.findings, key=lambda f: -LEVELS[f.level])  # stable: keeps rule order within a level
        for f in ev.findings:
            d = ev.domains[f.domain]
            d["findings"].append(asdict(f))
            d["level"] = worse(f.level, d["level"])
            ev.overall = worse(f.level, ev.overall)

        rad = radiation_summary(ctx)
        ev.radiation = {k: v for k, v in rad.items() if k != "typical_daily"} if rad else None
        ev.drift = self._drift(ctx)
        return ev

    @staticmethod
    def _drift(ctx: EvaluationContext) -> list[dict]:
        """7-day mean of each metric vs. personal baseline, largest deviation first."""
        out = []
        for k in METRICS:
            if k == "dose":
                continue
            v = ctx.avg7(k)
            z = ctx.z(k, v)
            if z is not None:
                out.append({"key": k, "recent": v, "baseline": ctx.base(k)["mean"], "z": z})
        return sorted(out, key=lambda d: -abs(d["z"]))
