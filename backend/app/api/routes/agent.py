"""
/api/agent/* — ADK-powered travel planning endpoints.

Endpoints:
  POST /api/agent/sessions          — create a conversation session
  POST /api/agent/chat              — send a message, get a response
  POST /api/agent/chat/stream       — streaming SSE response
  DELETE /api/agent/sessions/{id}   — clear a session
  GET  /api/agent/destinations      — list all destinations from database
  GET  /api/agent/destinations/{n}  — destination details
  GET  /api/agent/weather/{city}    — live weather forecast
"""

import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from app.agent.travel_agent import root_agent
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

APP_NAME = "travel_buddy"
_session_service = InMemorySessionService()
_runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=_session_service,
)


# ─── Schemas ────────────────────────────────────────────────────────────────────

class SessionCreateRequest(BaseModel):
    user_id: str
    preferences: dict | None = None


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    user_id: str | None = None
    # Optional initial preferences (budget, currency, interests, etc.)
    # Only used when creating a new session
    preferences: dict | None = None


# ─── Session helpers ─────────────────────────────────────────────────────────────

async def _ensure_session(user_id: str, session_id: str, preferences: dict | None = None) -> None:
    existing = await _session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not existing:
        await _session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state=preferences or {},
        )


# ─── Endpoints ───────────────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(req: SessionCreateRequest):
    """Create a new conversation session for a user."""
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    session_id = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME,
        user_id=req.user_id,
        session_id=session_id,
        state=req.preferences or {},
    )
    return {"success": True, "data": {"session_id": session_id, "user_id": req.user_id}}


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Send a message to the travel agent and receive a full response.

    Body:
      message     — user's message text
      session_id  — existing session ID (auto-created if omitted)
      user_id     — user identifier (defaults to "anonymous")
      preferences — initial state values (budget, currency, etc.)
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    user_id = req.user_id or "anonymous"
    session_id = req.session_id or str(uuid.uuid4())

    await _ensure_session(user_id, session_id, req.preferences)

    user_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=req.message)],
    )

    reply_text = ""
    agent_used = None

    async for event in _runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            reply_text = event.content.parts[0].text or ""
            if hasattr(event, "author"):
                agent_used = event.author

    if not reply_text:
        raise HTTPException(status_code=500, detail="Agent returned no response.")

    return {
        "success": True,
        "data": {
            "reply": reply_text,
            "session_id": session_id,
            "agent": agent_used,
        },
    }


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Streaming version of /chat — returns Server-Sent Events.
    Useful for showing a typing indicator in the frontend.

    Each SSE event is JSON: {"chunk": "...", "final": bool}
    Final event: "data: [DONE]"
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    user_id = req.user_id or "anonymous"
    session_id = req.session_id or str(uuid.uuid4())

    await _ensure_session(user_id, session_id, req.preferences)

    user_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=req.message)],
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        import json
        yield f"data: {json.dumps({'session_id': session_id})}\n\n"
        async for event in _runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        chunk = json.dumps({"chunk": part.text, "final": event.is_final_response()})
                        yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = "anonymous"):
    """Clear a conversation session."""
    await _session_service.delete_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    return {"success": True, "data": {"deleted": session_id}}


# ─── Quick-access data endpoints (no session needed) ────────────────────────────

@router.get("/destinations")
async def list_destinations():
    """List all destinations in the database with summary info."""
    from app.agent.data.destinations import DESTINATIONS

    return {
        "success": True,
        "data": {
            name: {
                "country": d["country"],
                "region": d["region"],
                "interests": d["interests"],
                "description": d["description"],
                "highlights": d["highlights"][:3],
                "min_trip_budget_pkr": d.get("min_trip_budget_pkr", 0),
            }
            for name, d in DESTINATIONS.items()
        },
    }


@router.get("/destinations/{name}")
async def destination_details(name: str):
    """Get full details for a specific destination."""
    from app.agent.tools.destination_tools import get_destination_details

    result = get_destination_details(name)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return {"success": True, "data": result}


@router.get("/weather/{city}")
async def weather_forecast(city: str, days: int = 5):
    """Get weather forecast for a city (live or seasonal estimate)."""
    from app.agent.tools.weather_tools import get_weather_forecast

    return {"success": True, "data": get_weather_forecast(city, days)}


@router.post("/estimate-costs")
async def estimate_costs_endpoint(
    destination: str,
    duration_days: int,
    travelers: int = 1,
    accommodation_tier: str = "mid_range",
    currency: str = "PKR",
):
    """
    Get a real-time itemised cost estimate for a trip by searching the web.
    Works for any destination worldwide — not limited to a hardcoded list.
    """
    import asyncio, json, re
    from google import genai
    from google.genai import types as gt

    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    client = genai.Client()

    prompt = (
        f"Search the web for current travel costs to {destination} for {duration_days} days, "
        f"{travelers} traveler(s), {accommodation_tier} accommodation tier. "
        f"Return ONLY a JSON object — no markdown fences, no explanation — in this exact shape:\n"
        f'{{"destination":"{destination}","currency":"{currency}","grand_total":0,'
        f'"daily_average_per_person":0,'
        f'"breakdown":{{"flights_round_trip":0,"accommodation":0,"meals":0,"activities":0,"local_transport":0}}}}\n'
        f"Replace the zeros with real numbers in {currency}."
    )

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=gt.GenerateContentConfig(
                tools=[gt.Tool(google_search=gt.GoogleSearch())],
            ),
        )
        text = response.text or ""
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            data = json.loads(match.group())
            return {"success": True, "data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cost search failed: {exc}") from exc

    raise HTTPException(status_code=500, detail="Could not parse cost estimate from search results")
