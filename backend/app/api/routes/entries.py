from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ...schemas import EntryIn
from ...services.health import HealthService, NotFound
from ..deps import get_health_service

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _row(e: EntryIn) -> dict:
    return {**e.model_dump(), "date": e.date.isoformat()}


@router.get("")
def list_entries(svc: HealthService = Depends(get_health_service)):
    return svc.entries.list()


@router.get("/{day}")
def get_entry(day: date, svc: HealthService = Depends(get_health_service)):
    try:
        return svc.get_entry(day.isoformat())
    except NotFound:
        raise HTTPException(404, "No check-in for that date")


@router.put("/{day}")
def upsert_entry(day: date, body: EntryIn, svc: HealthService = Depends(get_health_service)):
    """Create or replace the check-in for a date. Returns the new evaluation."""
    if body.date != day:
        raise HTTPException(400, "Path date and body date differ")
    return svc.save_entry(_row(body))


@router.patch("/{day}")
def patch_entry(day: date, fields: dict, svc: HealthService = Depends(get_health_service)):
    """Merge a few fields into a day's check-in (e.g. reaction-test results)."""
    merged = EntryIn(**svc.merge_entry(day.isoformat(), fields))  # re-validate the merged record
    svc.entries.upsert(_row(merged))
    return svc.get_entry(day.isoformat())


@router.delete("/{day}", status_code=204)
def delete_entry(day: date, svc: HealthService = Depends(get_health_service)):
    try:
        svc.delete_entry(day.isoformat())
    except NotFound:
        raise HTTPException(404, "No check-in for that date")
