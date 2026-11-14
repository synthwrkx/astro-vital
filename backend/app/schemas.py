"""Request/response schemas with validation."""
from __future__ import annotations

import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .core.catalog import METRICS, SYMPTOM_IDS


class EntryIn(BaseModel):
    date: dt.date
    hr: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    spo2: Optional[float] = None
    temp: Optional[float] = None
    weight: Optional[float] = None
    sleep: Optional[float] = None
    aerobic: Optional[float] = None
    resistance: Optional[float] = None
    fluid: Optional[float] = None
    mood: Optional[float] = None
    stress: Optional[float] = None
    fatigue: Optional[float] = None
    pvt: Optional[float] = None
    lapses: Optional[float] = None
    dose: Optional[float] = None
    glucose: Optional[float] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    symptoms: list[str] = Field(default_factory=list)
    notes: Optional[str] = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def _ranges(self):
        for k, m in METRICS.items():
            v = getattr(self, k)
            if v is not None and not (m["min"] <= v <= m["max"]):
                raise ValueError(f"{m['label']}: {v} is outside the plausible range {m['min']}–{m['max']}")
        return self

    @field_validator("symptoms")
    @classmethod
    def _symptoms(cls, v: list[str]) -> list[str]:
        bad = [s for s in v if s not in SYMPTOM_IDS]
        if bad:
            raise ValueError(f"Unknown symptom ids: {bad}")
        return sorted(set(v))


class SettingsIn(BaseModel):
    crew_name: str = Field(min_length=1, max_length=80)
    mission_start: Optional[dt.date] = None
    mission_length: int = Field(ge=1, le=1500)
    prior_career_dose: float = Field(ge=0)
    career_limit: float = Field(gt=0)
    aerobic_target: int = Field(ge=0, le=300)
    resistance_target: int = Field(ge=0, le=300)
    fluid_target: float = Field(ge=0, le=8)
    mission_profile: str = "iss"
    calorie_target: int = Field(2800, ge=1000, le=6000)

    @field_validator("mission_profile")
    @classmethod
    def _profile(cls, v: str) -> str:
        from .core.profiles import PROFILES
        if v not in PROFILES:
            raise ValueError(f"Unknown mission profile '{v}'")
        return v


class ImportPayload(BaseModel):
    settings: Optional[SettingsIn] = None
    entries: list[EntryIn]


# ---------------- AI schemas
class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1, max_length=40)


class ParseRequest(BaseModel):
    text: str = Field(min_length=2, max_length=4000)
    date: Optional[dt.date] = None
