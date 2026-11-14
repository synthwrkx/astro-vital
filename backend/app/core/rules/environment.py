from __future__ import annotations

from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num
from .base import HealthRule


class OxygenRule(HealthRule):
    domain = "env"
    evidence = "NASA risk: Reduced Crew Health and Performance Due to Hypoxia. SpO₂ below 95% is clinically low; below 92% warrants action."

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        s = ctx.latest.get("spo2")
        if is_num(s) and s < 92:
            return [self.finding("act", "Low blood oxygen", f"SpO₂ {s:.0f}%.",
                                 ["Re-measure with a warm finger, at rest", "Check cabin O₂/CO₂ and ventilation",
                                  "Report to the flight surgeon"], True)]
        if is_num(s) and s < 95:
            return [self.finding("watch", "Blood oxygen slightly low", f"SpO₂ {s:.0f}%.",
                                 ["Re-measure later today", "Check cabin atmosphere readings"])]
        return []


class HeadacheRule(HealthRule):
    domain = "env"
    evidence = ("NASA risk: Nominal Acute and Chronic Ambient Carbon Dioxide Exposure in Crewed Vehicles (CO2 Risk). Cabin CO₂ on the ISS runs well above Earth levels, and headache prevalence rises with it "
                "(Law et al., 2014).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        h = ctx.symptom_days("headache")
        if h >= 3:
            return [self.finding("watch", "Recurring headaches",
                f"Reported on {h} of the last {len(ctx.recent)} days. Elevated cabin CO₂ is a common cause on spacecraft.",
                ["Check local CO₂ readings; ensure airflow in crew quarters",
                 "Hydrate; note timing relative to sleep and work location"])]
        return []


class VisionRule(HealthRule):
    domain = "env"
    evidence = ("NASA risk: Spaceflight Associated Neuro-ocular Syndrome (SANS Risk); ongoing HRP studies include Brain Fluid Pressure and Thigh Cuff. Optic disc edema and globe flattening "
                "occur in many long-duration crew (Mader et al., 2011).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        if "vision" not in ctx.symptoms_today:
            return []
        return [self.finding("watch", "Vision change reported",
            "Spaceflight-associated neuro-ocular syndrome (SANS) can change near vision on long missions.",
            ["Do the onboard visual-acuity / Amsler grid check", "Use adjustable-focus glasses if issued",
             "Report so ground can schedule an eye exam (OCT/fundoscopy)"], True)]
