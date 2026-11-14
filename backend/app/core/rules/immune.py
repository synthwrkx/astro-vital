from __future__ import annotations

from ..catalog import SYMPTOMS
from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num
from .base import HealthRule, sd_note

MULTI_SYMPTOM_TITLE = "Multiple infection-type symptoms"


class TemperatureRule(HealthRule):
    domain = "immune"
    evidence = ("NASA risk: In-Mission Impacts, Adverse Health Events or Long-Term Health Impacts due to Altered Immune Response. Spaceflight dysregulates immunity; fever ≥38 °C is the standard "
                "clinical threshold.")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        t = ctx.latest.get("temp")
        if not is_num(t):
            return []
        z = ctx.z("temp", t)
        if t >= 38.0:
            return [self.finding("act", "Fever", f"{t:.1f} °C.",
                                 ["Rest and hydrate; follow the onboard medical checklist for fever",
                                  "Consider separating from crew to limit spread",
                                  "Report to the flight surgeon with symptom timeline"], True)]
        if t >= 37.5 or (z is not None and z >= 2.5):
            return [self.finding("watch", "Temperature elevated", f"{t:.1f} °C{sd_note(z)}.",
                                 ["Re-check in 4–6 hours", "Watch for sore throat, rash or fatigue"])]
        return []


class InfectionSymptomsRule(HealthRule):
    domain = "immune"
    evidence = ("NASA risk: Altered Immune Response; in closed habitats microbes pass more easily between people. Latent herpesviruses (EBV, VZV, HSV-1) reactivate in a large share "
                "of astronauts during flight (Mehta et al.).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        out: list[Finding] = []
        syms = ctx.symptoms_today
        present = [s for s in SYMPTOMS if s["domain"] == "immune" and s["id"] in syms]
        t = ctx.latest.get("temp")
        if len(present) >= 2 and not (is_num(t) and t >= 38):
            out.append(self.finding("act", MULTI_SYMPTOM_TITLE, ", ".join(s["label"] for s in present) + ".",
                                    ["Photograph any lesions for downlink", "Hand hygiene and surface cleaning in shared areas",
                                     "Report to the flight surgeon"], True))
        if "cold_sore" in syms:
            out.append(self.finding("watch", "Possible latent-virus reactivation",
                "Cold sores or shingles-like rash are a known spaceflight immune effect (herpesvirus reactivation), often stress-linked.",
                ["Photograph the lesion daily", "Use antiviral per onboard formulary if prescribed", "Avoid touching eyes"]))
        return out
