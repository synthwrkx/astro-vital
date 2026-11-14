"""Rule interface (Strategy pattern).

Each HealthRule inspects the EvaluationContext and returns zero or more Findings.
To add a new check, write a new HealthRule subclass and register it in
rules/__init__.py — the evaluator itself never changes (open/closed principle).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..context import EvaluationContext
from ..models import Finding, Level


class HealthRule(ABC):
    domain: str         # key into catalog.DOMAINS
    evidence: str = ""  # scientific basis: the risk addressed and the source of the threshold

    @abstractmethod
    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        """Return findings for this rule (may be empty)."""

    def finding(self, level: Level, title: str, detail: str, actions: list[str], escalate: bool = False) -> Finding:
        return Finding(self.domain, level, title, detail, actions, escalate, self.evidence)


def sd_note(z: float | None, suffix: str = "above baseline") -> str:
    return f" ({z:.1f} SD {suffix})" if z is not None else ""
