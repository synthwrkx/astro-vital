"""Reproducible demo mission: 14 preflight days + N flight days with realistic events."""
from __future__ import annotations

import random
from datetime import date, timedelta

from .catalog import DEFAULT_SETTINGS


def generate_demo(end: date | None = None, flight_days: int = 124) -> tuple[dict, list[dict]]:
    end = end or date.today()
    rng = random.Random(42)
    nrng = random.Random(7)   # separate stream for nutrition fields, so the original story stays reproducible
    gn = lambda: nrng.gauss(0, 1)  # noqa: E731
    g = lambda: rng.gauss(0, 1)  # noqa: E731
    clamp = lambda v, a, b: max(a, min(b, v))  # noqa: E731
    start = end - timedelta(days=flight_days - 1)  # launch = day 1
    settings = {**DEFAULT_SETTINGS, "crew_name": "Demo Astronaut", "mission_start": start.isoformat(),
                "mission_length": 180, "prior_career_dose": 95.0,
                "mission_profile": "mars_transit"}
    entries: list[dict] = []
    for day in range(-13, flight_days + 1):
        d = start + timedelta(days=day - 1)
        f = max(0, day)
        late = (day - (flight_days - 21)) / 21 if day > flight_days - 21 else 0.0  # 0→1 over last 3 weeks
        e: dict = {"date": d.isoformat(), "symptoms": []}
        e["hr"] = round(62 + (6 if 1 <= day <= 5 else 0) + late * 4 + g() * 2.5)
        e["sbp"] = round(118 - (4 if day >= 1 else 0) + g() * 4)
        e["dbp"] = round(76 - (2 if day >= 1 else 0) + g() * 3)
        e["spo2"] = round(clamp(98 + g() * 0.7, 94, 100))
        e["temp"] = round(36.7 + g() * 0.12, 1)
        e["weight"] = round(78.0 - f * 0.028 - late * 0.6 + g() * 0.3, 1)
        e["sleep"] = round(clamp(7.4 - (0.5 if day >= 1 else 0) - late * 1.3 + g() * 0.5, 3, 10), 2)
        e["aerobic"] = round(clamp((62 if day >= 1 else 45) - late * 20 + g() * 10, 0, 120) / 5) * 5
        e["resistance"] = round(clamp((60 if day >= 1 else 40) - late * 22 + g() * 8, 0, 120) / 5) * 5
        e["fluid"] = round(clamp(2.5 + g() * 0.3, 1.2, 4), 1)
        e["mood"] = round(clamp(4.1 - late * 2.0 + g() * 0.5, 1, 5))
        e["stress"] = round(clamp(2.2 + late * 1.1 + g() * 0.5, 1, 5))
        e["fatigue"] = round(clamp(2.2 + late * 1.2 + g() * 0.5, 1, 5))
        e["pvt"] = round(255 + late * 45 + g() * 12)
        e["lapses"] = max(0, round(1 + late * 3 + g()))
        e["dose"] = round(1.84 + g() * 0.08, 2) if day >= 1 else 0.0   # MSL RAD cruise average
        e["glucose"] = round(91 + late * 9 + gn() * 5)                              # fasting mg/dL
        e["calories"] = round(clamp((2900 if day >= 1 else 2700) - late * 750 + gn() * 140, 900, 5000) / 10) * 10
        e["protein"] = round(clamp(112 - late * 32 + gn() * 8, 20, 300))
        if 1 <= day <= 6:  # launch week: fluid shift, spinal elongation
            e["symptoms"].append("congestion")
            if day <= 4:
                e["symptoms"].append("back_pain")
        if 44 <= day <= 47:  # viral reactivation + fever
            e["temp"] = round(37.9 + (0.4 if day == 45 else 0) + g() * 0.1, 1)
            e["hr"] += 9
            e["symptoms"] += ["cold_sore", "sore_throat"]
            e["fatigue"] = 4
        if day == 72:  # solar particle event
            e["dose"] = 24.0
        if day == 73:
            e["dose"] = 6.5
        if day > flight_days - 7 and (day % 2 == 0 or day == flight_days):
            e["symptoms"].append("headache")
        if day > flight_days - 10 and day % 4 == 0:
            e["symptoms"].append("conflict")
        if day in (flight_days - 1, flight_days):
            e["symptoms"].append("insomnia")
        if day == flight_days:
            e["notes"] = "Busy week with payload ops; skipped two ARED sessions. Feeling flat."
        entries.append(e)
    return settings, entries
