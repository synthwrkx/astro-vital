"""Catalog, settings, status and report endpoints."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from ... import core as E
from ...core.knowledge import HAZARDS, METRIC_GUIDES, SOURCES
from ...core.profiles import PROFILES
from ...schemas import SettingsIn
from ...services.health import HealthService
from ..deps import get_health_service

router = APIRouter(prefix="/api")


@router.get("/catalog", tags=["meta"])
def catalog():
    """Metric, symptom and domain definitions used to build the UI."""
    return {"metrics": E.METRICS, "symptoms": E.SYMPTOMS, "domains": E.DOMAINS, "levels": E.LEVEL_LABEL, "profiles": PROFILES,
            "guides": METRIC_GUIDES, "hazards": HAZARDS, "sources": SOURCES}


@router.get("/settings", tags=["settings"])
def get_settings(svc: HealthService = Depends(get_health_service)):
    return svc.settings.get()


@router.put("/settings", tags=["settings"])
def put_settings(body: SettingsIn, svc: HealthService = Depends(get_health_service)):
    data = body.model_dump()
    data["mission_start"] = body.mission_start.isoformat() if isinstance(body.mission_start, date) else None
    return svc.settings.save(data)


@router.get("/status", tags=["status"])
def status(svc: HealthService = Depends(get_health_service)):
    """Rule-engine evaluation: overall + per-domain levels, findings, baseline, radiation, drift."""
    return svc.status()


@router.get("/routine", tags=["status"])
def routine(svc: HealthService = Depends(get_health_service)):
    """Today's mission routine, auto-completed from check-ins, with streak, score, XP and badges."""
    return svc.routine()


@router.get("/timeline", tags=["status"])
def timeline(svc: HealthService = Depends(get_health_service)):
    """Mission story: daily status ribbon, finding episodes (onset → resolution) and status transitions."""
    return svc.timeline()


@router.get("/report", tags=["status"], response_class=PlainTextResponse)
def report(svc: HealthService = Depends(get_health_service)):
    """Compact, deterministic plain-text downlink report (no AI)."""
    return svc.report()
