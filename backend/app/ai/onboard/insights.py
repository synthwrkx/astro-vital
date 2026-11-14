"""Insights: one analysis pass shared by every generator (briefing, copilot, report).

Combines the rule-engine evaluation with the onboard model's anomaly scores, forecasts and
cross-signal correlations, so generators only format — they never recompute.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ...core import Evaluation, EvaluationContext, HealthEvaluator
from .analytics import AnomalyDetector, AnomalyScore, Forecast, TrendForecaster, correlation

# (a, b, lag, sentence when strongly correlated)
CORRELATIONS = [
    ("sleep", "pvt", 0, "shorter sleep has gone with slower reaction times"),
    ("sleep", "mood", 0, "shorter sleep has gone with lower mood"),
    ("stress", "sleep", 0, "higher stress has gone with less sleep"),
    ("resistance", "mood", 0, "more resistance exercise has gone with better mood"),
]


@dataclass
class Insights:
    ctx: EvaluationContext
    ev: Evaluation
    anomaly_today: Optional[AnomalyScore]
    anomalous_days_30: list[AnomalyScore]
    forecasts: list[Forecast]
    links: list[str] = field(default_factory=list)   # data-backed cross-domain statements

    @property
    def has_data(self) -> bool:
        return bool(self.ctx.entries)


class InsightEngine:
    def __init__(self, evaluator: HealthEvaluator, detector: AnomalyDetector, forecaster: TrendForecaster):
        self.evaluator, self.detector, self.forecaster = evaluator, detector, forecaster

    def analyze(self, entries: list[dict], settings: dict) -> Insights:
        ctx = EvaluationContext(entries, settings)
        ev = self.evaluator.evaluate(entries, settings)
        if not ctx.entries:
            return Insights(ctx, ev, None, [], [])
        recent = self.detector.recent(ctx, 30)
        links = []
        for a, b, lag, sentence in CORRELATIONS:
            if (r := correlation(ctx, a, b, lag)) and abs(r[0]) >= 0.4:
                links.append(f"Over the last {r[1]} days, {sentence} (r = {r[0]:+.2f}).")
        return Insights(
            ctx=ctx, ev=ev,
            anomaly_today=self.detector.score(ctx, ctx.latest),
            anomalous_days_30=[s for s in recent if self.detector.is_anomalous(s)],
            forecasts=self.forecaster.forecasts(ctx),
            links=links,
        )

    def is_anomalous(self, s: Optional[AnomalyScore]) -> bool:
        return bool(s) and self.detector.is_anomalous(s)
