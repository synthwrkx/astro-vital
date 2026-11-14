"""AstroVital domain core (framework-free).

Facade over the rule engine so callers need a single import:

    from app.core import evaluate, build_report, METRICS
"""
from .catalog import DEFAULT_SETTINGS, DOMAINS, LEVEL_LABEL, LEVELS, METRICS, SYMPTOM_BY_ID, SYMPTOM_IDS, SYMPTOMS
from .context import EvaluationContext, compute_baseline
from .evaluator import HealthEvaluator
from .models import Evaluation, Finding
from .report import build_report
from .stats import mission_day

_default = HealthEvaluator()


def evaluate(entries: list[dict], settings: dict | None = None) -> Evaluation:
    return _default.evaluate(entries, settings)


__all__ = [
    "DEFAULT_SETTINGS", "DOMAINS", "LEVEL_LABEL", "LEVELS", "METRICS", "SYMPTOMS", "SYMPTOM_BY_ID", "SYMPTOM_IDS",
    "EvaluationContext", "Evaluation", "Finding", "HealthEvaluator", "build_report", "compute_baseline", "evaluate", "mission_day",
]
