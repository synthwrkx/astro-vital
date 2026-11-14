from __future__ import annotations

from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num, parse_date, slope
from .base import HealthRule

SUSTAINED_LOW_MOOD = "Sustained low mood"


class SleepRule(HealthRule):
    domain = "behavior"
    evidence = ("NASA risk: Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload. Crews often average under 6 h "
                "of sleep in flight (Barger et al., Lancet Neurology 2014).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        sl7 = ctx.avg7("sleep")
        if sl7 is None:
            return []
        if sl7 < 5.5:
            return [self.finding("act", "Chronic sleep restriction",
                f"7-day average {sl7:.1f} h. Sustained short sleep impairs judgement, mood and immunity.",
                ["Protect an 8.5 h sleep window; request timeline relief",
                 "Limit screen light 1 h before sleep; use eye mask/earplugs",
                 "Discuss sleep medication with the flight surgeon"], True)]
        if sl7 < 6.5:
            return [self.finding("watch", "Sleep below recommended", f"7-day average {sl7:.1f} h.",
                                 ["Keep a consistent sleep/wake time", "Avoid caffeine within 8 h of sleep",
                                  "Check crew-quarters temperature, noise and light"])]
        return []


class MoodRule(HealthRule):
    """Absolute low mood, drop vs. personal baseline, and gradual decline (e.g. 'third-quarter' effect)."""
    domain = "behavior"
    evidence = ("NASA risk: Adverse Cognitive or Behavioral Changes and Psychiatric Disorders (Behavioral Health Risk). Isolated and confined crews show mood declines, "
                "sometimes peaking past mission midpoint (the 'third-quarter phenomenon', Bechtel & Berning 1991).")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        out: list[Finding] = []
        m7 = ctx.avg7("mood")
        mz = ctx.z("mood", m7)
        if m7 is not None and (m7 <= 2.0 or ctx.symptom_days("low_mood") >= 4):
            out.append(self.finding("act", SUSTAINED_LOW_MOOD,
                f"7-day mood average {m7:.1f}/5. Persistent low mood on a long mission warrants support — this is common and treatable.",
                ["Schedule a private psychological support conference", "Plan a call with family or friends",
                 "Tell a trusted crewmate how you are doing"], True))
        elif m7 is not None and mz is not None and mz <= -2:
            out.append(self.finding("watch", "Mood below your baseline",
                f"7-day average {m7:.1f}/5 vs baseline {ctx.base('mood')['mean']:.1f}.",
                ["Build in leisure time: Earth-viewing, music, hobbies",
                 "Maintain exercise — it is a strong mood buffer", "Consider a private psych conference"]))
        pts = [e for e in ctx.last14 if is_num(e.get("mood"))]
        if len(pts) >= 10 and not any(f.title == SUSTAINED_LOW_MOOD for f in out):
            s = slope([parse_date(e["date"]).toordinal() for e in pts], [e["mood"] for e in pts]) * 7
            if s <= -0.35:
                out.append(self.finding("watch", "Mood gradually declining",
                    f"Mood has dropped ~{abs(s):.2f} points/week over the last 2 weeks — early signs are easiest to address.",
                    ["Reflect on what changed (workload, sleep, crew dynamics)", "Plan something to look forward to this week"]))
        return out


class StressRule(HealthRule):
    domain = "behavior"
    evidence = "NASA risk: Behavioral Health Risk; NASA notes sleep loss and work overload compound the isolation and confinement hazard."

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        st7 = ctx.avg7("stress")
        if st7 is None:
            return []
        if st7 >= 4.5:
            return [self.finding("act", "Very high stress", f"7-day average {st7:.1f}/5.",
                                 ["Ask ground to re-prioritise the task list", "Use breathing / relaxation protocol twice daily",
                                  "Talk to psychological support"], True)]
        if st7 >= 3.8:
            return [self.finding("watch", "Elevated stress", f"7-day average {st7:.1f}/5.",
                                 ["Identify the top stressor and share it at the daily planning conference", "Take short breaks between tasks"])]
        return []


class CrewConflictRule(HealthRule):
    domain = "behavior"
    evidence = ("NASA risk: Inadequate Cooperation, Coordination, Communication, and Psychosocial Adaptation within a Team (Team Risk). Interpersonal tension grows in "
                "isolation analogs.")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        c = ctx.symptom_days("conflict")
        if c >= 2:
            return [self.finding("watch", "Recurring crew tension", f"Reported on {c} of the last {len(ctx.recent)} days.",
                                 ["Address it early and directly, using agreed crew-resource-management practices",
                                  "Request a confidential conference if needed"])]
        return []


class AlertnessRule(HealthRule):
    """Psychomotor vigilance test: reaction time vs. baseline and lapse count."""
    domain = "behavior"
    evidence = ("The Psychomotor Vigilance Test (Dinges & Powell, 1985) is the standard objective fatigue measure and is "
                "part of NASA's Cognition battery (Basner et al., 2015). Lapses are responses over 500 ms.")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        pvt, lp = ctx.latest.get("pvt"), ctx.latest.get("lapses")
        pz = ctx.z("pvt", pvt)
        rt = f"Reaction time {pvt:.0f} ms" if is_num(pvt) else "Reaction time —"
        lapses = f"{lp:.0f}" if is_num(lp) else "—"
        if (pz is not None and pz >= 3) or (is_num(lp) and lp >= 10):
            return [self.finding("act", "Alertness markedly reduced",
                rt + (f" ({pz:.1f} SD slower than baseline)" if pz is not None else "") + f", {lapses} lapses.",
                ["Avoid safety-critical tasks (EVA, robotics, docking) until re-tested",
                 "Take a nap (≤30 min) or rest, then re-test", "Inform the crew and ground of reduced readiness"], True)]
        if (pz is not None and pz >= 2) or (is_num(lp) and lp >= 5):
            return [self.finding("watch", "Alertness below baseline",
                rt + (f" ({pz:.1f} SD slower)" if pz is not None else "") + f", {lapses} lapses.",
                ["Re-test before any critical task", "Check sleep debt and fatigue"])]
        return []
