"""Domain value objects produced by the evaluator."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal, Optional

from .catalog import LEVEL_LABEL, LEVELS

Level = Literal["ok", "watch", "act"]


@dataclass(frozen=True)
class Finding:
    """One thing the astronaut should know about, with what to do about it."""
    domain: str
    level: Level
    title: str
    detail: str
    actions: list[str]
    escalate: bool = False  # True → recommend flight-surgeon review
    evidence: str = ""      # scientific basis for the rule that produced this finding


@dataclass
class Evaluation:
    overall: Level = "ok"
    findings: list[Finding] = field(default_factory=list)
    domains: dict[str, dict] = field(default_factory=dict)
    latest: Optional[dict] = None
    mission_day: Optional[int] = None
    baseline: dict = field(default_factory=dict)
    radiation: Optional[dict] = None
    drift: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["overall_label"] = LEVEL_LABEL[self.overall]
        return d


def worse(a: Level, b: Level) -> Level:
    return a if LEVELS[a] >= LEVELS[b] else b
