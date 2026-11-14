"""SQLModel tables and engine/session factory (SQLite by default)."""
from __future__ import annotations

import os
import threading
from typing import Iterator, Optional

from sqlalchemy import JSON, Column, LargeBinary, inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import Field, Session, SQLModel, create_engine

from ..core.catalog import DEFAULT_SETTINGS


class MissionSettings(SQLModel, table=True):
    """Single-row table (id=1) holding the crew member's mission configuration."""
    id: int = Field(default=1, primary_key=True)
    crew_name: str = DEFAULT_SETTINGS["crew_name"]
    mission_start: Optional[str] = None
    mission_length: int = DEFAULT_SETTINGS["mission_length"]
    prior_career_dose: float = DEFAULT_SETTINGS["prior_career_dose"]
    career_limit: float = DEFAULT_SETTINGS["career_limit"]
    aerobic_target: int = DEFAULT_SETTINGS["aerobic_target"]
    resistance_target: int = DEFAULT_SETTINGS["resistance_target"]
    fluid_target: float = DEFAULT_SETTINGS["fluid_target"]
    mission_profile: str = DEFAULT_SETTINGS["mission_profile"]
    calorie_target: int = DEFAULT_SETTINGS["calorie_target"]


class Entry(SQLModel, table=True):
    """One daily check-in. `date` (YYYY-MM-DD) is the natural key."""
    date: str = Field(primary_key=True)
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
    symptoms: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=list))
    notes: Optional[str] = None


class Photo(SQLModel, table=True):
    """An image attached to a check-in (e.g. a rash or cold sore) for self-tracking and downlink."""
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True)
    tag: str = "other"            # a symptom id, or "other"
    note: Optional[str] = None
    mime: str = "image/jpeg"
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    created: str = ""


def make_engine(url: Optional[str] = None) -> Engine:
    url = url or os.getenv("ASTROVITAL_DB", "sqlite:///./astrovital.db")
    eng = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
    SQLModel.metadata.create_all(eng)
    _add_missing_columns(eng)
    with Session(eng) as s:  # seed the single settings row so requests never race to create it
        if s.get(MissionSettings, 1) is None:
            s.add(MissionSettings())
            s.commit()
    return eng


def _add_missing_columns(eng: Engine) -> None:
    """Minimal forward-only migration: add any model column missing from an existing table
    (e.g. a database created before `mission_profile` existed). Defaults come from the model."""
    insp = inspect(eng)
    for table in SQLModel.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have:
                continue
            default = col.default.arg if col.default is not None and not callable(col.default.arg) else None
            ddl = f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(eng.dialect)}'
            if default is not None:
                ddl += f" DEFAULT '{default}'" if isinstance(default, str) else f" DEFAULT {default}"
            with eng.begin() as conn:
                conn.execute(text(ddl))


_engine: Optional[Engine] = None
_lock = threading.Lock()


def get_engine() -> Engine:
    """Process-wide engine, created once. Locked because FastAPI runs sync dependencies in a
    thread pool, so concurrent first requests would otherwise race on CREATE TABLE."""
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = make_engine()
    return _engine


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
