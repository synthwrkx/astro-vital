from __future__ import annotations

from .. import stats
from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num
from .base import HealthRule, sd_note
from .bone import InFlightRule

FOOD_RISK = "NASA risk: Inadequate Food and Nutrition Causing Decrements in In-Mission Health and Performance and Long-term Health."


class GlucoseRule(HealthRule):
    """Fasting blood glucose. Clinical cut-offs follow the American Diabetes Association:
    < 70 mg/dL hypoglycaemia (< 54 clinically significant); fasting ≥ 126 mg/dL is in the diabetic range."""
    domain = "nutrition"
    evidence = (FOOD_RISK + " CSA notes that the effects of weightlessness resemble a sedentary lifestyle and are relevant "
                "to Type-2 diabetes research. Thresholds: American Diabetes Association (hypoglycaemia < 70 / < 54 mg/dL; "
                "fasting ≥ 126 mg/dL).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        g = ctx.latest.get("glucose")
        if not is_num(g):
            return []
        z = ctx.z("glucose", g)
        if g < 54:
            return [self.finding("act", "Blood sugar dangerously low", f"Fasting glucose {g:.0f} mg/dL.",
                                 ["Take 15 g of fast carbohydrate now (juice, glucose tabs), re-check in 15 min",
                                  "Don't do EVA or safety-critical tasks until above 70 mg/dL", "Notify a crewmate and the flight surgeon"], True)]
        if g < 70:
            return [self.finding("watch", "Blood sugar low", f"Fasting glucose {g:.0f} mg/dL.",
                                 ["Eat a carbohydrate snack and re-check in 15 min", "Review whether meals were skipped"])]
        if g >= 200:
            return [self.finding("act", "Blood sugar very high", f"Fasting glucose {g:.0f} mg/dL{sd_note(z)}.",
                                 ["Re-measure with a fresh sample", "Hydrate; report symptoms (thirst, frequent urination)",
                                  "Report to the flight surgeon"], True)]
        if g >= 126 or (z is not None and z >= 2.5):
            return [self.finding("watch", "Blood sugar above normal", f"Fasting glucose {g:.0f} mg/dL{sd_note(z)}.",
                                 ["Re-test fasting tomorrow morning", "Keep exercise sessions up; they improve insulin sensitivity",
                                  "Review sugary snacks and drinks"])]
        return []


class IntakeRule(InFlightRule):
    """Energy and protein intake vs. targets (7-day, flight days only)."""
    domain = "nutrition"
    evidence = (FOOD_RISK + " Astronauts often under-eat in flight. An energy deficit speeds muscle and bone loss, and protein "
                "(about 1.2 g/kg/day) supports muscle maintenance.")

    def check(self, ctx: EvaluationContext) -> list[Finding]:
        flight = ctx.recent_flight
        if len(flight) < 3:
            return []
        out: list[Finding] = []
        kcal, target = stats.avg(flight, "calories"), ctx.settings.get("calorie_target") or 2800
        if kcal is not None:
            pct = kcal / target
            if pct < 0.65:
                out.append(self.finding("act", "Energy intake far below target",
                    f"7-day average {kcal:.0f} kcal/day vs {target} target ({pct:.0%}).",
                    ["Add calorie-dense snacks between meals", "Tell the crew medical officer about food aversion or nausea",
                     "Request a nutrition consult"], True))
            elif pct < 0.85:
                out.append(self.finding("watch", "Energy intake below target",
                    f"7-day average {kcal:.0f} kcal/day vs {target} target ({pct:.0%}).",
                    ["Add a snack after each exercise session", "Swap in preferred menu items to beat menu fatigue"]))
        prot, w = stats.avg(flight, "protein"), ctx.avg7("weight")
        if prot is not None and w:
            gkg = prot / w
            if gkg < 1.0:
                out.append(self.finding("watch", "Protein intake low",
                    f"7-day average {prot:.0f} g/day ≈ {gkg:.1f} g/kg (aim for about 1.2 g/kg).",
                    ["Add a protein item to each meal", "Pair resistance sessions with a protein snack"]))
        return out
