"""Onboard predictive analytics (pure Python, offline).

* AnomalyDetector   — multivariate anomaly score per day: RMS of baseline z-scores across core
                      signals (a diagonal-covariance Mahalanobis distance), calibrated on the
                      astronaut's own preflight data. Catches days where many signals are a bit
                      off at once even if no single rule fires.
* TrendForecaster   — least-squares trend over the last 3 weeks, projected forward to estimate
                      how many days until a metric crosses a rule-engine threshold.
* correlation()     — Pearson r used to back cross-domain explanations with data.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from ...core import EvaluationContext
from ...core.stats import is_num, mean, parse_date, slope

# Body mass is excluded: it drifts slowly by design and is handled by BodyMassRule + the forecaster.
CORE_SIGNALS = ["hr", "sbp", "spo2", "temp", "sleep", "mood", "stress", "fatigue", "pvt", "glucose"]
# Direction that is "bad" for each signal (+1 high is bad, -1 low is bad, 0 both)
BAD_DIRECTION = {"hr": 1, "sbp": 0, "spo2": -1, "temp": 1, "weight": -1, "sleep": -1, "mood": -1, "stress": 1,
                 "fatigue": 1, "pvt": 1, "glucose": 0}


@dataclass
class AnomalyScore:
    date: str
    score: float
    contributors: list[tuple[str, float]]  # (metric, signed z vs baseline), most harmful first


class AnomalyDetector:
    def __init__(self, threshold: float = 2.5):
        self.threshold = threshold

    def score(self, ctx: EvaluationContext, entry: dict) -> Optional[AnomalyScore]:
        harm = []  # (metric, harmful-direction deviation, signed z)
        for k in CORE_SIGNALS:
            z = ctx.z(k, entry.get(k))
            if z is None:
                continue
            d = BAD_DIRECTION[k]
            harm.append((k, abs(z) if d == 0 else max(0.0, z * d), z))  # only count deviation in the harmful direction
        if len(harm) < 4:
            return None
        rms = math.sqrt(sum(h * h for _, h, _ in harm) / len(harm)) * math.sqrt(len(harm) / 4)  # 4 signals at 1σ ≈ 1
        top = sorted(harm, key=lambda x: -x[1])[:3]
        return AnomalyScore(entry["date"], rms, [(k, z) for k, h, z in top if h > 0])

    def recent(self, ctx: EvaluationContext, days: int = 30) -> list[AnomalyScore]:
        return [s for e in ctx.entries[-days:] if (s := self.score(ctx, e))]

    def is_anomalous(self, s: AnomalyScore) -> bool:
        return s.score >= self.threshold


@dataclass
class Forecast:
    metric: str
    description: str   # human sentence
    days: int


class TrendForecaster:
    """Projects current trends to rule-engine thresholds."""

    def __init__(self, horizon_days: int = 45, window: int = 21):
        self.horizon, self.window = horizon_days, window

    def _trend(self, ctx: EvaluationContext, key: str) -> Optional[tuple[float, float, float]]:
        """(current smoothed value, slope per day, r²) over the window, or None."""
        pts = [(parse_date(e["date"]).toordinal(), e[key]) for e in ctx.entries[-self.window:] if is_num(e.get(key))]
        if len(pts) < 10:
            return None
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        b = slope(xs, ys)
        my, mx = mean(ys), mean(xs)
        ss_tot = sum((y - my) ** 2 for y in ys)
        ss_res = sum((y - (my + b * (x - mx))) ** 2 for x, y in zip(xs, ys))
        r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
        current = my + b * (xs[-1] - mx)
        return current, b, r2

    def _days_to(self, current: float, per_day: float, threshold: float) -> Optional[int]:
        if per_day == 0 or (threshold - current) / per_day <= 0:
            return None
        d = math.ceil((threshold - current) / per_day)
        return d if d <= self.horizon else None

    def _targets(self, ctx: EvaluationContext) -> list[tuple[str, list[tuple[float, str]]]]:
        """Per metric: ordered thresholds (value, description) taken from the rule engine."""
        t: list[tuple[str, list[tuple[float, str]]]] = []
        if bw := ctx.base("weight"):
            t.append(("weight", [(bw["mean"] * (1 - p / 100), f"body mass would reach −{p}% from baseline "
                                  f"({bw['mean'] * (1 - p / 100):.1f} kg)") for p in (5, 8)]))
        t.append(("sleep", [(6.5, "7-day sleep would fall below 6.5 h"), (5.5, "7-day sleep would fall below 5.5 h")]))
        t.append(("mood", [(2.0, "mood would reach the 'sustained low mood' level (2/5)")]))
        if bp := ctx.base("pvt"):
            t.append(("pvt", [(bp["mean"] + k * bp["sd"], f"reaction time would pass +{k}σ ({bp['mean'] + k * bp['sd']:.0f} ms)")
                              for k in (2, 3)]))
        return t

    def forecasts(self, ctx: EvaluationContext) -> list[Forecast]:
        out: list[Forecast] = []
        for key, thresholds in self._targets(ctx):
            tr = self._trend(ctx, key)
            if not tr or tr[2] < 0.2:          # require a reasonably consistent trend
                continue
            current, per_day, _ = tr
            # first threshold not yet crossed in the direction of travel
            pending = [(v, d) for v, d in thresholds if (per_day < 0 and current > v) or (per_day > 0 and current < v)]
            if not pending:
                continue
            value, desc = pending[0]
            if days := self._days_to(current, per_day, value):
                out.append(Forecast(key, f"At the current 3-week trend, {desc} in about {days} day{'s' if days != 1 else ''}.", days))
        return sorted(out, key=lambda f: f.days)


def correlation(ctx: EvaluationContext, a: str, b: str, lag: int = 0, days: int = 30) -> Optional[tuple[float, int]]:
    """Pearson r between metric a (day t) and metric b (day t+lag) over the last `days` entries."""
    rows = ctx.entries[-days:]
    pairs = [(rows[i][a], rows[i + lag][b]) for i in range(len(rows) - lag)
             if is_num(rows[i].get(a)) and is_num(rows[i + lag].get(b))]
    if len(pairs) < 10:
        return None
    xs, ys = [p[0] for p in pairs], [p[1] for p in pairs]
    mx, my = mean(xs), mean(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if not sx or not sy:
        return None
    return sum((x - mx) * (y - my) for x, y in pairs) / (sx * sy), len(pairs)
