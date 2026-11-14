from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ...ai import AIRefused, AIUnavailable, HealthAssistant
from ...schemas import ChatRequest, ParseRequest
from ...services.health import AIService, NoData
from ..deps import get_ai, get_ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


async def _call(coro):
    """Translate service/port errors into HTTP responses in one place."""
    try:
        return await coro
    except NoData as e:
        raise HTTPException(400, str(e))
    except AIRefused as e:
        raise HTTPException(422, str(e))
    except AIUnavailable as e:
        raise HTTPException(503, str(e))


@router.get("/status")
def ai_status(assistant: HealthAssistant = Depends(get_ai)):
    """Which AI engine is active. Always offline: the model runs on the spacecraft."""
    return {"enabled": assistant.enabled, "model": assistant.model, "version": assistant.version, "offline": True,
            "reason": getattr(assistant, "reason", "")}


@router.post("/briefing")
async def briefing(svc: AIService = Depends(get_ai_service)):
    """Plain-language daily briefing and prioritised plan, built on the rule-engine findings."""
    return await _call(svc.briefing())


@router.post("/chat")
async def chat(body: ChatRequest, svc: AIService = Depends(get_ai_service)):
    """Health copilot: answers questions using tools that query the astronaut's own records."""
    if body.messages[0].role != "user" or body.messages[-1].role != "user":
        raise HTTPException(400, "Conversation must start and end with a user message")
    return await _call(svc.chat([t.model_dump() for t in body.messages]))


@router.post("/parse-checkin")
async def parse_checkin(body: ParseRequest, svc: AIService = Depends(get_ai_service)):
    """Turn free text / dictation into a draft check-in. The astronaut reviews it before saving."""
    return await _call(svc.parse_checkin(body.text))


@router.post("/surgeon-report")
async def surgeon_report(svc: AIService = Depends(get_ai_service)):
    """AI-written clinical downlink summary (Markdown) for the ground flight surgeon."""
    return await _call(svc.surgeon_report())
