"""AI port: the interface the rest of the app depends on (dependency inversion).

Services and routes only know `HealthAssistant`. Concrete adapters:
  * OnboardHealthAssistant  — the offline AstroVital Onboard Health Model (ai/onboard/)
  * DisabledHealthAssistant — Null Object used when no model bundle is installed
A different onboard model (e.g. a larger on-device language model) is one more adapter
implementing this Protocol; services, routes and UI do not change.
"""
from __future__ import annotations

from typing import Literal, Optional, Protocol

from pydantic import BaseModel, Field

from ..core.catalog import SYMPTOM_IDS


class AIUnavailable(Exception):
    """AI is not configured or the service could not be reached."""


class AIRefused(Exception):
    """The model declined the request."""


# ---------------------------------------------------------------- structured outputs
class Priority(BaseModel):
    title: str = Field(description="Short imperative, e.g. 'Protect tonight's sleep window'")
    why: str = Field(description="One or two sentences citing the specific data behind it")
    action: str = Field(description="Concrete step the astronaut can take on board")
    urgency: Literal["now", "today", "this_week", "keep_monitoring"]


class Briefing(BaseModel):
    headline: str = Field(description="One-line status in plain language")
    summary: str = Field(description="3-5 sentences explaining today's status and how the signals connect")
    priorities: list[Priority] = Field(description="Up to 4, most urgent first")
    going_well: list[str] = Field(description="1-3 things that are on track, grounded in data")
    contact_flight_surgeon: bool
    contact_reason: str = Field(description="Why to contact the flight surgeon, or empty string if not needed")
    forecasts: list[str] = Field(default_factory=list, description="Predicted threshold crossings")
    anomaly_note: str = Field("", description="Multivariate anomaly summary for today, if notable")


SymptomId = Literal[tuple(SYMPTOM_IDS)]  # type: ignore[valid-type]


class CheckinDraft(BaseModel):
    hr: Optional[float] = Field(None, description="Resting heart rate, bpm")
    sbp: Optional[float] = Field(None, description="Systolic blood pressure, mmHg")
    dbp: Optional[float] = Field(None, description="Diastolic blood pressure, mmHg")
    spo2: Optional[float] = Field(None, description="Oxygen saturation, %")
    temp: Optional[float] = Field(None, description="Body temperature in °C (convert from °F if needed)")
    weight: Optional[float] = Field(None, description="Body mass in kg (convert from lb if needed)")
    sleep: Optional[float] = Field(None, description="Hours slept")
    aerobic: Optional[float] = Field(None, description="Aerobic exercise minutes (treadmill, cycle)")
    resistance: Optional[float] = Field(None, description="Resistance exercise minutes (ARED, weights)")
    fluid: Optional[float] = Field(None, description="Fluid intake, litres")
    mood: Optional[int] = Field(None, description="1 very low … 5 great")
    stress: Optional[int] = Field(None, description="1 calm … 5 very high")
    fatigue: Optional[int] = Field(None, description="1 fresh … 5 exhausted")
    dose: Optional[float] = Field(None, description="Radiation dose today, mSv")
    glucose: Optional[float] = Field(None, description="Fasting blood glucose, mg/dL")
    calories: Optional[float] = Field(None, description="Energy intake, kcal")
    protein: Optional[float] = Field(None, description="Protein intake, g")
    symptoms: list[SymptomId] = Field(default_factory=list)  # type: ignore[valid-type]
    notes: Optional[str] = Field(None, description="Anything worth keeping that doesn't fit a field, in the astronaut's words")
    unclear: list[str] = Field(default_factory=list, description="Things mentioned that you could not map confidently")


class ChatReply(BaseModel):
    reply: str
    sources: list[str]


# ---------------------------------------------------------------- port
class HealthAssistant(Protocol):
    enabled: bool
    model: str      # model id, e.g. "astrovital-onboard-v1"
    version: str

    async def briefing(self, entries: list[dict], settings: dict) -> Briefing: ...
    async def chat(self, entries: list[dict], settings: dict, turns: list[dict]) -> ChatReply: ...
    async def parse_checkin(self, text: str) -> CheckinDraft: ...
    async def surgeon_report(self, entries: list[dict], settings: dict) -> str: ...
