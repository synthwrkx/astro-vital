"""Repository pattern: the only code that talks to the database.

Services depend on these small interfaces, not on SQLModel, so storage can be swapped
(e.g. for an onboard embedded DB or a sync-capable store) without touching business logic.
"""
from __future__ import annotations

from typing import Optional, Protocol

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, delete, select

from .db import Entry, MissionSettings, Photo


class EntryRepository(Protocol):
    def list(self) -> list[dict]: ...
    def get(self, day: str) -> Optional[dict]: ...
    def upsert(self, entry: dict) -> None: ...
    def delete(self, day: str) -> bool: ...
    def delete_all(self) -> None: ...


class SettingsRepository(Protocol):
    def get(self) -> dict: ...
    def save(self, settings: dict) -> dict: ...
    def reset(self) -> None: ...


class PhotoRepository(Protocol):
    def list(self, day: Optional[str] = None) -> list[dict]: ...
    def get(self, photo_id: int) -> Optional[tuple[str, bytes]]: ...
    def add(self, day: str, tag: str, note: Optional[str], mime: str, data: bytes, created: str) -> dict: ...
    def delete(self, photo_id: int) -> bool: ...
    def delete_all(self) -> None: ...


class SqlPhotoRepository:
    def __init__(self, session: Session):
        self.s = session

    @staticmethod
    def _meta(p: Photo) -> dict:
        return {"id": p.id, "date": p.date, "tag": p.tag, "note": p.note, "mime": p.mime, "bytes": len(p.data), "created": p.created}

    def list(self, day: Optional[str] = None) -> list[dict]:
        q = select(Photo).order_by(Photo.date, Photo.id)
        if day:
            q = q.where(Photo.date == day)
        return [self._meta(p) for p in self.s.exec(q).all()]

    def get(self, photo_id: int) -> Optional[tuple[str, bytes]]:
        p = self.s.get(Photo, photo_id)
        return (p.mime, p.data) if p else None

    def add(self, day: str, tag: str, note: Optional[str], mime: str, data: bytes, created: str) -> dict:
        p = Photo(date=day, tag=tag, note=note, mime=mime, data=data, created=created)
        self.s.add(p)
        self.s.commit()
        self.s.refresh(p)
        return self._meta(p)

    def delete(self, photo_id: int) -> bool:
        p = self.s.get(Photo, photo_id)
        if not p:
            return False
        self.s.delete(p)
        self.s.commit()
        return True

    def delete_all(self) -> None:
        self.s.exec(delete(Photo))
        self.s.commit()


class SqlEntryRepository:
    def __init__(self, session: Session):
        self.s = session

    def list(self) -> list[dict]:
        return [r.model_dump(exclude_none=True) for r in self.s.exec(select(Entry).order_by(Entry.date)).all()]

    def get(self, day: str) -> Optional[dict]:
        row = self.s.get(Entry, day)
        return row.model_dump(exclude_none=True) if row else None

    def upsert(self, entry: dict) -> None:
        self.s.merge(Entry(**entry))
        self.s.commit()

    def delete(self, day: str) -> bool:
        row = self.s.get(Entry, day)
        if not row:
            return False
        self.s.delete(row)
        self.s.commit()
        return True

    def delete_all(self) -> None:
        self.s.exec(delete(Entry))
        self.s.commit()


class SqlSettingsRepository:
    def __init__(self, session: Session):
        self.s = session

    def _row(self) -> MissionSettings:
        row = self.s.get(MissionSettings, 1)
        if row is None:
            try:
                self.s.add(MissionSettings())
                self.s.commit()
            except IntegrityError:   # another request created the default row first
                self.s.rollback()
            row = self.s.get(MissionSettings, 1)
        return row

    def get(self) -> dict:
        return self._row().model_dump(exclude={"id"})

    def save(self, settings: dict) -> dict:
        row = self._row()
        for k, v in settings.items():
            if hasattr(row, k) and k != "id":
                setattr(row, k, v)
        self.s.add(row)
        self.s.commit()
        return self.get()

    def reset(self) -> None:
        row = self.s.get(MissionSettings, 1)
        if row:
            self.s.delete(row)
            self.s.commit()
