"""Static domain catalog: risk domains, metrics, symptoms and status levels.

Pure data with no behaviour. Add a metric or symptom here and the API, UI and AI pick it up
automatically via /api/catalog.
"""
from __future__ import annotations

from typing import Any

DOMAINS: dict[str, dict[str, str]] = {
    "cardio": {"name": "Cardiovascular", "blurb": "Fluid shifts and deconditioning alter heart rate, blood pressure and rhythm."},
    "bone": {"name": "Bone & Muscle", "blurb": "Microgravity drives ~1–1.5% bone loss per month and muscle atrophy without countermeasures."},
    "immune": {"name": "Immune", "blurb": "Spaceflight dysregulates immunity; latent viruses (e.g. herpes) can reactivate."},
    "behavior": {"name": "Behavioral & Cognition", "blurb": "Isolation, confinement and sleep loss erode mood, alertness and crew cohesion."},
    "radiation": {"name": "Radiation", "blurb": "Cumulative dose vs. career limit, and acute spikes from solar particle events."},
    "env": {"name": "Environment & Vision", "blurb": "Closed-loop air (CO₂, O₂) and fluid shifts affecting the eyes (SANS)."},
    "nutrition": {"name": "Nutrition & Metabolism", "blurb": "Energy, protein and blood sugar: under-eating and altered insulin sensitivity speed muscle and bone loss."},
}

METRICS: dict[str, dict[str, Any]] = {
    "hr": dict(label="Resting heart rate", short="HR", unit="bpm", min=30, max=200, step=1, min_sd=3, dec=0),
    "sbp": dict(label="Systolic BP", short="SYS", unit="mmHg", min=60, max=250, step=1, min_sd=5, dec=0),
    "dbp": dict(label="Diastolic BP", short="DIA", unit="mmHg", min=30, max=150, step=1, min_sd=4, dec=0),
    "spo2": dict(label="Oxygen saturation", short="SpO₂", unit="%", min=70, max=100, step=1, min_sd=0.7, dec=0),
    "temp": dict(label="Body temperature", short="Temp", unit="°C", min=34, max=42, step=0.1, min_sd=0.15, dec=1),
    "weight": dict(label="Body mass", short="Mass", unit="kg", min=30, max=200, step=0.1, min_sd=0.4, dec=1),
    "sleep": dict(label="Sleep duration", short="Sleep", unit="h", min=0, max=14, step=0.25, min_sd=0.4, dec=1),
    "aerobic": dict(label="Aerobic exercise", short="Aerobic", unit="min", min=0, max=300, step=5, min_sd=5, dec=0),
    "resistance": dict(label="Resistance exercise", short="Resist.", unit="min", min=0, max=300, step=5, min_sd=5, dec=0),
    "fluid": dict(label="Fluid intake", short="Fluid", unit="L", min=0, max=8, step=0.1, min_sd=0.2, dec=1),
    "mood": dict(label="Mood", short="Mood", unit="/5", min=1, max=5, step=1, min_sd=0.4, dec=1),
    "stress": dict(label="Stress", short="Stress", unit="/5", min=1, max=5, step=1, min_sd=0.4, dec=1),
    "fatigue": dict(label="Fatigue", short="Fatigue", unit="/5", min=1, max=5, step=1, min_sd=0.4, dec=1),
    "pvt": dict(label="Reaction time (median)", short="RT", unit="ms", min=100, max=2000, step=1, min_sd=15, dec=0),
    "lapses": dict(label="Attention lapses", short="Lapses", unit="", min=0, max=100, step=1, min_sd=0.8, dec=0),
    "dose": dict(label="Daily radiation dose", short="Dose", unit="mSv", min=0, max=2000, step=0.01, min_sd=0.05, dec=2),
    "glucose": dict(label="Fasting glucose", short="Glucose", unit="mg/dL", min=20, max=600, step=1, min_sd=6, dec=0),
    "calories": dict(label="Energy intake", short="Energy", unit="kcal", min=0, max=8000, step=50, min_sd=150, dec=0),
    "protein": dict(label="Protein intake", short="Protein", unit="g", min=0, max=500, step=5, min_sd=8, dec=0),
}
METRIC_KEYS = list(METRICS)

SYMPTOMS: list[dict[str, str]] = [
    {"id": "chest_pain", "label": "Chest pain or pressure", "domain": "cardio", "level": "act"},
    {"id": "palpitations", "label": "Palpitations / irregular heartbeat", "domain": "cardio", "level": "act"},
    {"id": "faint", "label": "Fainting or near-fainting", "domain": "cardio", "level": "act"},
    {"id": "dizziness", "label": "Dizziness / lightheadedness", "domain": "cardio", "level": "watch"},
    {"id": "back_pain", "label": "Back pain", "domain": "bone", "level": "watch"},
    {"id": "joint_pain", "label": "Joint or muscle pain", "domain": "bone", "level": "watch"},
    {"id": "flank_pain", "label": "Flank pain / blood in urine", "domain": "bone", "level": "act"},
    {"id": "sore_throat", "label": "Sore throat / cough", "domain": "immune", "level": "watch"},
    {"id": "cold_sore", "label": "Cold sore or shingles-like rash", "domain": "immune", "level": "watch"},
    {"id": "rash", "label": "Skin rash / irritation", "domain": "immune", "level": "watch"},
    {"id": "wound", "label": "Slow-healing cut or infection", "domain": "immune", "level": "watch"},
    {"id": "low_mood", "label": "Persistent low mood / loss of interest", "domain": "behavior", "level": "watch"},
    {"id": "insomnia", "label": "Trouble falling or staying asleep", "domain": "behavior", "level": "watch"},
    {"id": "conflict", "label": "Tension or conflict with crew", "domain": "behavior", "level": "watch"},
    {"id": "nausea", "label": "Nausea / vomiting", "domain": "radiation", "level": "watch"},
    {"id": "headache", "label": "Headache", "domain": "env", "level": "watch"},
    {"id": "congestion", "label": "Head fullness / nasal congestion", "domain": "env", "level": "watch"},
    {"id": "vision", "label": "Blurred or changed vision", "domain": "env", "level": "watch"},
    {"id": "poor_appetite", "label": "Poor appetite / food tastes bland", "domain": "nutrition", "level": "watch"},
    {"id": "shaky", "label": "Shaky, sweaty or confused (possible low sugar)", "domain": "nutrition", "level": "act"},
]
SYMPTOM_BY_ID = {s["id"]: s for s in SYMPTOMS}
SYMPTOM_IDS = list(SYMPTOM_BY_ID)

LEVELS = {"ok": 0, "watch": 1, "act": 2}
LEVEL_LABEL = {"ok": "Nominal", "watch": "Monitor", "act": "Act now"}



DEFAULT_SETTINGS: dict[str, Any] = dict(
    crew_name="Crew member", mission_start=None, mission_length=180, prior_career_dose=0.0,
    career_limit=600.0, aerobic_target=60, resistance_target=60, fluid_target=2.0,
    mission_profile="iss", calorie_target=2800,
)
