"""Application services: business workflows composed from repositories, the evaluator and the AI port.
They are framework-free; FastAPI routes are thin adapters over these."""
from __future__ import annotations

from typing import Optional

from ..ai import HealthAssistant
from ..core import HealthEvaluator, build_report
from ..core.routine import build_routine
from ..core.timeline import build_timeline
from ..core.demo import generate_demo
from ..persistence.repositories import EntryRepository, PhotoRepository, SettingsRepository


class NotFound(Exception):
    pass


class NoData(Exception):
    pass


class HealthService:
    """Check-ins and their evaluation."""

    def __init__(self, entries: EntryRepository, settings: SettingsRepository, evaluator: HealthEvaluator,
                 photos: Optional[PhotoRepository] = None):
        self.entries, self.settings, self.evaluator, self.photos = entries, settings, evaluator, photos

    def snapshot(self) -> tuple[list[dict], dict]:
        return self.entries.list(), self.settings.get()

    def status(self) -> dict:
        return self.evaluator.evaluate(*self.snapshot()).to_dict()

    def report(self) -> str:
        text = build_report(*self.snapshot(), evaluator=self.evaluator)
        if self.photos and (ph := self.photos.list()):
            recent = ph[-5:]
            text += "\n\nPHOTOS ATTACHED: " + str(len(ph)) + " (latest: " + ", ".join(f"{p['date']} {p['tag']}" for p in recent) + ")"
        return text

    def routine(self) -> dict:
        """Today's mission routine (auto-completed from check-in data) plus streaks, XP and badges."""
        return build_routine(*self.snapshot())

    def timeline(self) -> dict:
        """Day-by-day replay of the mission (no hindsight) for the Mission story view."""
        return build_timeline(*self.snapshot(), evaluator=self.evaluator)

    def get_entry(self, day: str) -> dict:
        e = self.entries.get(day)
        if e is None:
            raise NotFound(day)
        return e

    def save_entry(self, entry: dict) -> dict:
        """Upsert a check-in and return the fresh evaluation.
        Policy: the very first check-in becomes launch day if none is configured."""
        s = self.settings.get()
        if not s.get("mission_start") and not self.entries.list():
            self.settings.save({"mission_start": entry["date"]})
        self.entries.upsert(entry)
        return self.status()

    def merge_entry(self, day: str, fields: dict) -> dict:
        base = self.entries.get(day) or {"date": day, "symptoms": []}
        return {**base, **fields, "date": day}

    def delete_entry(self, day: str) -> None:
        if not self.entries.delete(day):
            raise NotFound(day)


class PhotoService:
    """Images attached to check-ins. Stored onboard; listed in the downlink report."""
    MAX_BYTES = 3 * 1024 * 1024
    MIMES = {"image/jpeg", "image/png", "image/webp"}

    def __init__(self, photos: PhotoRepository):
        self.photos = photos

    def add(self, day: str, tag: str, note: Optional[str], data_url: str) -> dict:
        import base64
        import binascii
        from datetime import datetime
        try:
            head, b64 = data_url.split(",", 1)
            mime = head.removeprefix("data:").split(";")[0]
            raw = base64.b64decode(b64, validate=True)
        except (ValueError, binascii.Error) as e:
            raise ValueError("Image must be a base64 data URL") from e
        if mime not in self.MIMES:
            raise ValueError(f"Unsupported image type {mime}")
        if len(raw) > self.MAX_BYTES:
            raise ValueError("Image too large (max 3 MB)")
        return self.photos.add(day, tag, note, mime, raw, datetime.now().isoformat(timespec="seconds"))


class DataService:
    """Bulk data management: export, import, demo, reset."""

    def __init__(self, entries: EntryRepository, settings: SettingsRepository, photos: Optional[PhotoRepository] = None):
        self.entries, self.settings, self.photos = entries, settings, photos

    def export(self) -> dict:
        return {"settings": self.settings.get(), "entries": self.entries.list()}

    def replace_all(self, entries: list[dict], settings: Optional[dict] = None) -> int:
        self.entries.delete_all()
        if self.photos:            # photos belong to the replaced check-ins
            self.photos.delete_all()
        if settings:
            self.settings.save(settings)
        for e in entries:
            self.entries.upsert(e)
        return len(entries)

    def demo(self) -> tuple[dict, list[dict]]:
        return generate_demo()

    def clear(self) -> None:
        self.entries.delete_all()
        if self.photos:
            self.photos.delete_all()
        self.settings.reset()


class AIService:
    """Guards and data-gathering around the AI port."""

    def __init__(self, health: HealthService, assistant: HealthAssistant):
        self.health, self.ai = health, assistant

    def _data(self) -> tuple[list[dict], dict]:
        entries, settings = self.health.snapshot()
        if not entries:
            raise NoData("Record a check-in first")
        return entries, settings

    async def briefing(self) -> dict:
        return (await self.ai.briefing(*self._data())).model_dump()

    async def chat(self, turns: list[dict]) -> dict:
        return (await self.ai.chat(*self._data(), turns)).model_dump()

    async def parse_checkin(self, text: str) -> dict:
        return (await self.ai.parse_checkin(text)).model_dump()

    async def surgeon_report(self) -> dict:
        return {"markdown": await self.ai.surgeon_report(*self._data())}
