from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from ..deps import get_photo_service
from ...services.health import PhotoService

router = APIRouter(prefix="/api/photos", tags=["photos"])


class PhotoIn(BaseModel):
    date: date
    tag: str = Field("other", max_length=40)
    note: Optional[str] = Field(None, max_length=500)
    data_url: str = Field(max_length=5_000_000)


@router.get("")
def list_photos(day: Optional[date] = None, svc: PhotoService = Depends(get_photo_service)):
    return svc.photos.list(day.isoformat() if day else None)


@router.post("", status_code=201)
def add_photo(body: PhotoIn, svc: PhotoService = Depends(get_photo_service)):
    """Attach a camera image (base64 data URL; JPEG, PNG or WebP, max 3 MB) to a check-in date."""
    try:
        return svc.add(body.date.isoformat(), body.tag, body.note, body.data_url)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/{photo_id}")
def get_photo(photo_id: int, svc: PhotoService = Depends(get_photo_service)):
    got = svc.photos.get(photo_id)
    if not got:
        raise HTTPException(404, "No such photo")
    mime, data = got
    return Response(content=data, media_type=mime, headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, svc: PhotoService = Depends(get_photo_service)):
    if not svc.photos.delete(photo_id):
        raise HTTPException(404, "No such photo")
