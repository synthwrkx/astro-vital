"""Small numeric and date helpers (pure functions)."""
from __future__ import annotations

import math
import statistics
from datetime import date
from typing import Any, Iterable, Optional


def is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def mean(a: list[float]) -> float:
    return sum(a) / len(a)


def sd(a: list[float]) -> float:
    return statistics.stdev(a) if len(a) >= 2 else 0.0


def median(a: list[float]) -> float:
    return statistics.median(a)


def slope(xs: list[float], ys: list[float]) -> float:
    """Least-squares slope of ys over xs (0 when fewer than 3 points)."""
    if len(xs) < 3:
        return 0.0
    mx, my = mean(xs), mean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0


def parse_date(s: str) -> date:
    return date.fromisoformat(s)


def values(entries: Iterable[dict], key: str) -> list[float]:
    return [e[key] for e in entries if is_num(e.get(key))]


def avg(entries: list[dict], key: str) -> Optional[float]:
    v = values(entries, key)
    return mean(v) if v else None


def mission_day(day: str, settings: dict) -> Optional[int]:
    """Launch day = 1; preflight days are <= 0; None when no launch date is set."""
    start = settings.get("mission_start")
    if not start:
        return None
    return (parse_date(day) - parse_date(start)).days + 1
