from __future__ import annotations

from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num
from .base import HealthRule, sd_note


class HeartRateRule(HealthRule):
    domain = "cardio"
    evidence = ("NASA risk: Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes. Microgravity fluid shifts and deconditioning change "
                "resting HR; a sustained rise vs. your own baseline can signal illness, dehydration or stress.")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        hr = ctx.latest.get("hr")
        z = ctx.z("hr", hr)
        if is_num(hr) and (hr >= 110 or (z is not None and z >= 3)):
            base = ctx.base("hr")
            return [self.finding("act", "Resting heart rate markedly elevated",
                                 f"{hr:.0f} bpm today" + (f" ({z:.1f} SD above your baseline of {base['mean']:.0f})" if z is not None else "") + ".",
                                 ["Re-measure after 5 minutes of quiet seated/restrained rest",
                                  "Check for fever, dehydration, caffeine or stimulant medication",
                                  "Log any palpitations, chest discomfort or breathlessness"], True)]
        hr3 = ctx.avg3("hr")
        z3 = ctx.z("hr", hr3)
        if hr3 is not None and ((z3 is not None and z3 >= 2) or hr3 >= 100):
            return [self.finding("watch", "Resting heart rate trending high", f"3-day average {hr3:.0f} bpm{sd_note(z3)}.",
                                 ["Prioritise sleep and hydration for the next 48 h",
                                  "Measure at the same time each morning before activity",
                                  "Escalate if it keeps rising or symptoms appear"])]
        return []


class BloodPressureRule(HealthRule):
    domain = "cardio"
    evidence = ("NASA risk: Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes; orthostatic intolerance is common after flight. Thresholds follow "
                "standard clinical cut-offs (≥140/90 elevated, ≥160/100 high).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        sbp, dbp = ctx.latest.get("sbp"), ctx.latest.get("dbp")
        bp = f"{sbp if is_num(sbp) else '—'}/{dbp if is_num(dbp) else '—'} mmHg."
        if (is_num(sbp) and sbp >= 160) or (is_num(dbp) and dbp >= 100):
            return [self.finding("act", "Blood pressure high", bp,
                                 ["Repeat the measurement twice, 2 minutes apart", "Rest, reduce sodium and stimulants",
                                  "Report readings to the flight surgeon"], True)]
        if (is_num(sbp) and sbp >= 140) or (is_num(dbp) and dbp >= 90):
            return [self.finding("watch", "Blood pressure above normal range", bp,
                                 ["Re-check tomorrow under the same conditions", "Review sodium intake and stress load"])]
        if is_num(sbp) and sbp <= 85:
            return [self.finding("watch", "Blood pressure low", f"Systolic {sbp:.0f} mmHg — a risk for orthostatic intolerance.",
                                 ["Increase fluid and salt intake per protocol", "Move slowly when changing posture",
                                  "Report fainting or near-fainting immediately"])]
        return []
