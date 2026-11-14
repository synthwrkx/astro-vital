from __future__ import annotations

from ..context import EvaluationContext
from .. import stats
from ..models import Finding
from .base import HealthRule


class InFlightRule(HealthRule):
    """Template method: countermeasure rules only apply once the mission has launched."""

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        return self.check(ctx) if ctx.in_flight else []

    def check(self, ctx: EvaluationContext) -> list[Finding]:
        raise NotImplementedError


class ExerciseComplianceRule(InFlightRule):
    domain = "bone"
    evidence = ("NASA risks: Bone Fracture due to Spaceflight-induced Changes to Bone; Reduced Muscle Size, Strength and "
                "Endurance; Reduced Aerobic Capacity. NASA: weight-bearing bone loses on average 1–1.5% of mineral density per month; loaded resistance exercise (ARED) is the main countermeasure.")

    def check(self, ctx: EvaluationContext) -> list[Finding]:
        out: list[Finding] = []
        flight = ctx.recent_flight
        if len(flight) < 3:          # need a few in-flight days before judging compliance
            return []
        res7, aer7 = stats.avg(flight, "resistance"), stats.avg(flight, "aerobic")
        rt, at = ctx.settings["resistance_target"], ctx.settings["aerobic_target"]
        if res7 is not None and rt:
            pct = res7 / rt
            if pct < 0.5:
                out.append(self.finding("act", "Resistance exercise far below target",
                    f"7-day average {res7:.0f} min/day vs {rt} min target ({pct:.0%}). Loaded exercise is the main defence against bone loss.",
                    ["Schedule resistance sessions as non-negotiable timeline blocks",
                     "Focus on hip/spine loading (squat, deadlift, heel raise)",
                     "Discuss schedule conflicts with ground planners"], True))
            elif pct < 0.8:
                out.append(self.finding("watch", "Resistance exercise below target",
                    f"7-day average {res7:.0f} min/day vs {rt} min target ({pct:.0%}).",
                    ["Make up missed sessions this week", "Increase load progressively rather than duration"]))
        if aer7 is not None and at and aer7 / at < 0.6:
            out.append(self.finding("watch", "Aerobic exercise below target",
                f"7-day average {aer7:.0f} min/day vs {at} min target. Aerobic work protects cardiovascular fitness for landing.",
                ["Add interval sessions on the cycle ergometer or treadmill"]))
        return out


class BodyMassRule(InFlightRule):
    domain = "nutrition"
    evidence = ("NASA risk: Inadequate Food and Nutrition Causing Decrements in In-Mission Health and Performance. Body-mass loss on long missions reflects energy deficit "
                "and lean-mass loss.")

    def check(self, ctx: EvaluationContext) -> list[Finding]:
        bw, w7 = ctx.base("weight"), ctx.avg7("weight")
        if not bw or w7 is None:
            return []
        loss = (bw["mean"] - w7) / bw["mean"] * 100
        detail = f"Down {loss:.1f}% from baseline ({bw['mean']:.1f} → {w7:.1f} kg)."
        if loss >= 8:
            return [self.finding("act", "Significant body-mass loss", detail + " Suggests energy deficit and muscle loss.",
                                 ["Increase caloric and protein intake (≥1.2 g/kg/day protein)",
                                  "Review food rejection / menu fatigue", "Request a nutrition consult"], True)]
        if loss >= 5:
            return [self.finding("watch", "Body mass declining", detail,
                                 ["Add a snack after exercise sessions", "Track food intake for 3 days to find the gap"])]
        return []


class HydrationRule(InFlightRule):
    domain = "bone"
    evidence = ("NASA risk: Renal Stone Formation (NASA lists increased kidney-stone risk under the gravity hazard). Bone demineralisation raises urinary calcium, and fluid intake "
                "is the simplest countermeasure.")

    def check(self, ctx: EvaluationContext) -> list[Finding]:
        fl3, target = ctx.avg3("fluid"), ctx.settings["fluid_target"]
        if fl3 is not None and fl3 < target:
            return [self.finding("watch", "Low fluid intake",
                f"3-day average {fl3:.1f} L/day. Bone demineralisation raises urinary calcium — low fluid increases kidney-stone risk.",
                [f"Drink at least {target} L/day", "Set hydration reminders around exercise"])]
        return []
