"""Null Object adapter: used when the onboard model bundle is missing or AI is switched off.

Lets every caller treat AI uniformly; each method fails with a clear, user-facing message.
"""
from __future__ import annotations

from .base import AIUnavailable, Briefing, ChatReply, CheckinDraft


class DisabledHealthAssistant:
    enabled = False
    model = ""
    version = ""

    def __init__(self, reason: str = "Onboard AI model is not installed."):
        self.reason = reason

    async def briefing(self, entries: list[dict], settings: dict) -> Briefing:
        raise AIUnavailable(self.reason)

    async def chat(self, entries: list[dict], settings: dict, turns: list[dict]) -> ChatReply:
        raise AIUnavailable(self.reason)

    async def parse_checkin(self, text: str) -> CheckinDraft:
        raise AIUnavailable(self.reason)

    async def surgeon_report(self, entries: list[dict], settings: dict) -> str:
        raise AIUnavailable(self.reason)
