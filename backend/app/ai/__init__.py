"""AI package. `get_assistant()` is the factory: it loads the offline onboard model bundle and
returns the OnboardHealthAssistant, or the Null Object when the bundle is missing / AI is off."""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from .base import AIRefused, AIUnavailable, Briefing, ChatReply, CheckinDraft, HealthAssistant
from .disabled import DisabledHealthAssistant

log = logging.getLogger("astrovital.ai")


@lru_cache(maxsize=1)
def get_assistant() -> HealthAssistant:
    if os.getenv("ASTROVITAL_AI", "on").lower() == "off":
        return DisabledHealthAssistant("AI features are turned off (ASTROVITAL_AI=off).")
    from .onboard import ModelBundle, OnboardHealthAssistant
    from .onboard.bundle import BundleMissing
    try:
        return OnboardHealthAssistant(ModelBundle.load())
    except BundleMissing as e:
        log.warning("%s; AI features disabled", e)
        return DisabledHealthAssistant(str(e))


__all__ = ["AIRefused", "AIUnavailable", "Briefing", "ChatReply", "CheckinDraft", "HealthAssistant", "get_assistant"]
