from __future__ import annotations

from fastapi import APIRouter, Depends

from ...schemas import EntryIn, ImportPayload, SettingsIn
from ...services.health import DataService
from ..deps import get_data_service

router = APIRouter(prefix="/api", tags=["data"])


def _apply(payload: ImportPayload, svc: DataService) -> dict:
    settings = None
    if payload.settings:
        settings = payload.settings.model_dump()
        settings["mission_start"] = payload.settings.mission_start.isoformat() if payload.settings.mission_start else None
    rows = [{**e.model_dump(), "date": e.date.isoformat()} for e in payload.entries]
    return {"imported": svc.replace_all(rows, settings)}


@router.get("/export")
def export(svc: DataService = Depends(get_data_service)):
    return svc.export()


@router.post("/import")
def import_data(body: ImportPayload, svc: DataService = Depends(get_data_service)):
    """Replace all data with an export file (validated)."""
    return _apply(body, svc)


@router.post("/demo")
def load_demo(svc: DataService = Depends(get_data_service)):
    """Replace all data with a reproducible 124-day demo mission ending today."""
    settings, entries = svc.demo()
    return _apply(ImportPayload(settings=SettingsIn(**settings), entries=[EntryIn(**e) for e in entries]), svc)


@router.delete("/data", status_code=204)
def clear(svc: DataService = Depends(get_data_service)):
    svc.clear()
