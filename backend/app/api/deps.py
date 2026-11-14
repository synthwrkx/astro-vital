"""Dependency-injection wiring (composition root for request-scoped objects).

Override any of these with `app.dependency_overrides` in tests.
"""
from __future__ import annotations

from fastapi import Depends
from sqlmodel import Session

from ..ai import HealthAssistant, get_assistant
from ..core import HealthEvaluator
from ..persistence.db import get_session
from ..persistence.repositories import SqlEntryRepository, SqlPhotoRepository, SqlSettingsRepository
from ..services.health import AIService, DataService, HealthService, PhotoService

_evaluator = HealthEvaluator()


def get_evaluator() -> HealthEvaluator:
    return _evaluator


def get_health_service(session: Session = Depends(get_session), evaluator: HealthEvaluator = Depends(get_evaluator)) -> HealthService:
    return HealthService(SqlEntryRepository(session), SqlSettingsRepository(session), evaluator, SqlPhotoRepository(session))


def get_data_service(session: Session = Depends(get_session)) -> DataService:
    return DataService(SqlEntryRepository(session), SqlSettingsRepository(session), SqlPhotoRepository(session))


def get_photo_service(session: Session = Depends(get_session)) -> PhotoService:
    return PhotoService(SqlPhotoRepository(session))


def get_ai(assistant: HealthAssistant = Depends(get_assistant)) -> HealthAssistant:
    return assistant


def get_ai_service(health: HealthService = Depends(get_health_service), assistant: HealthAssistant = Depends(get_ai)) -> AIService:
    return AIService(health, assistant)
