from __future__ import annotations

from ..catalog import SYMPTOM_BY_ID
from ..context import EvaluationContext
from ..models import Finding
from .base import HealthRule
from .immune import MULTI_SYMPTOM_TITLE

# Watch-level symptoms that a dedicated rule already reports with better context.
COVERED_BY_OTHER_RULES = {"cold_sore", "vision", "headache", "conflict", "low_mood"}


class SymptomCatchAllRule(HealthRule):
    """Reports any symptom from today not already covered by a specific rule.

    Must run last: it reads findings produced by earlier rules.
    """
    domain = "*"

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        out: list[Finding] = []
        for sid in sorted(ctx.symptoms_today):
            sym = SYMPTOM_BY_ID.get(sid)
            if not sym:
                continue
            if sid in COVERED_BY_OTHER_RULES and sym["level"] != "act":
                continue
            if sym["domain"] == "immune" and ctx.has_finding(MULTI_SYMPTOM_TITLE):
                continue
            is_act = sym["level"] == "act"
            out.append(Finding(sym["domain"], sym["level"], f"Symptom: {sym['label']}", "Reported in today's check-in.",
                               ["Stop strenuous activity and follow the onboard medical checklist",
                                "Notify a crewmate and the flight surgeon now"] if is_act
                               else ["Note onset, duration and triggers", "Escalate if it persists more than 48 h or worsens"],
                               is_act, "Crew self-report. Red-flag symptoms escalate per the crew medical checklist."))
        return out
