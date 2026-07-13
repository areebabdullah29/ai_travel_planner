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

import logging
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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

        # If the agent called mark_requirements_complete this turn, surface the
        # gathered prefs to the frontend so it can enable the Generate button.
        session = await _session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )
        prefs = (session.state or {}).get("requirements") if session else None
        if prefs:
            yield f"data: {json.dumps({'requirements_ready': True, 'prefs': prefs})}\n\n"
            # Clear so subsequent turns don't re-emit the same payload.
            # InMemorySessionService stores sessions in-process, so direct
            # state mutation persists for the next /chat call.
            session.state.pop("requirements", None)

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
    origin: str = "",
):
    """
    Get a real-time itemised cost estimate for a trip by searching the web.
    Works for any destination worldwide — not limited to a hardcoded list.
    When `origin` is provided, the flight cost reflects the real route price.
    """
    import asyncio, json, re
    from google import genai
    from google.genai import types as gt

    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    client = genai.Client()

    flight_clause = (
        f"round-trip flights from {origin} to {destination}"
        if origin else
        f"round-trip flights to {destination}"
    )

    prompt = (
        f"Search the web for current travel costs for {travelers} traveller(s) — "
        f"{flight_clause}, {duration_days} nights at {accommodation_tier} accommodation, "
        f"daily meals, activities, and local transport. "
        f"Return ONLY a JSON object — no markdown fences, no explanation — in this exact shape:\n"
        f'{{"destination":"{destination}","currency":"{currency}","grand_total":0,'
        f'"daily_average_per_person":0,'
        f'"breakdown":{{"flights_round_trip":0,"accommodation":0,"meals":0,"activities":0,"local_transport":0}}}}\n'
        f"Replace the zeros with real numbers in {currency}. "
        f"flights_round_trip should be the total for ALL {travelers} traveller(s) combined."
    )

    logger.info("[estimate-costs] destination=%s duration=%d travelers=%d currency=%s origin=%r",
                destination, duration_days, travelers, currency, origin)
    try:
        logger.debug("[estimate-costs] Calling Gemini model=gemini-3.1-flash-lite-preview")
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=gt.GenerateContentConfig(
                tools=[gt.Tool(google_search=gt.GoogleSearch())],
            ),
        )
        text = response.text or ""
        logger.debug("[estimate-costs] Raw response length=%d text_preview=%r", len(text), text[:300])
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            data = json.loads(match.group())
            logger.info("[estimate-costs] Parsed cost data keys=%s", list(data.keys()))
            return {"success": True, "data": data}
        logger.error("[estimate-costs] No JSON object found in response. Full text:\n%s", text)
    except Exception as exc:
        logger.exception("[estimate-costs] Exception during Gemini call: %s", exc)
        raise HTTPException(status_code=500, detail=f"Cost search failed: {exc}") from exc

    raise HTTPException(status_code=500, detail="Could not parse cost estimate from search results")


@router.post("/generate-plan")
async def generate_plan_endpoint(
    destination: str,
    duration_days: int,
    travelers: int = 1,
    currency: str = "PKR",
    origin: str = "",
    budget: float = 0,
    interests: str = "",
    travel_style: str = "Mixed",
    group_type: str = "solo",
    travel_month: str = "",
):
    """
    Generate a complete, agent-powered trip plan using Gemini + Google Search.
    Returns a TripPlan-compatible JSON object — no additional frontend API calls needed.
    """
    import asyncio, json, re, uuid
    from google import genai
    from google.genai import types as gt

    logger.info(
        "[generate-plan] destination=%s duration=%d travelers=%d currency=%s origin=%r "
        "budget=%s interests=%r style=%r group=%r month=%r",
        destination, duration_days, travelers, currency, origin,
        budget, interests, travel_style, group_type, travel_month,
    )

    if not settings.GOOGLE_API_KEY:
        logger.error("[generate-plan] GOOGLE_API_KEY is not set")
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY not configured in .env")

    logger.debug("[generate-plan] GOOGLE_API_KEY present (len=%d)", len(settings.GOOGLE_API_KEY))
    client = genai.Client()

    flight_info = f"round-trip flights from {origin} to {destination}" if origin else f"round-trip flights to {destination}"
    budget_note = f"The total budget is {budget} {currency} for all {travelers} traveller(s)." if budget > 0 else ""
    interests_note = f"Interests: {interests}." if interests else ""
    month_note = f"They are travelling in {travel_month}." if travel_month else ""

    prompt = f"""Search the web and generate a complete {duration_days}-day travel itinerary for {travelers} traveller(s) going to {destination}.
{f"They are travelling from {origin}." if origin else ""}
{budget_note}
{interests_note}
{month_note}
Travel style: {travel_style}.

Search for:
1. Real {flight_info} prices
2. Current hotel/accommodation costs in {destination}
3. Top attractions and must-see sights
4. Best local restaurants
5. Daily activity costs and local transport

Return ONLY a JSON object (no markdown, no code fences, just raw JSON) with this exact structure:
{{
  "destination": "<city name>",
  "country": "<country name>",
  "totalCost": <grand total in {currency} for all {travelers} traveller(s)>,
  "isOverBudget": <true if totalCost exceeds {budget if budget > 0 else 0}, else false>,
  "highlights": ["<attraction 1>", "<attraction 2>", "<attraction 3>", "<attraction 4>", "<attraction 5>"],
  "bestTime": "<best months to visit, e.g. March, April, October>",
  "restaurants": [
    {{"name": "<restaurant name>", "cuisine": "<cuisine type>", "priceRange": "<$ or $$ or $$$>", "rating": 4.5, "specialty": "<signature dish>", "location": "<area in city>"}}
  ],
  "itinerary": [
    {{
      "day": 1,
      "title": "<day theme, e.g. Arrival & First Impressions>",
      "activities": [
        {{"name": "<activity>", "time": "09:00", "duration": "<X hours>", "cost": <cost per person in {currency}>, "description": "<1-2 sentence description>", "category": "Sightseeing"}},
        {{"name": "<activity>", "time": "14:00", "duration": "<X hours>", "cost": <cost per person in {currency}>, "description": "<1-2 sentence description>", "category": "Culture"}}
      ],
      "meals": {{"breakfast": "<place or description>", "lunch": "<place or description>", "dinner": "<restaurant name>"}},
      "accommodation": "<hotel name or type, e.g. 4-star hotel in city center>",
      "estimatedCost": <total day cost for all {travelers} traveller(s) in {currency}>
    }}
  ],
  "costBreakdown": {{
    "flights": <total round-trip flights for all {travelers} traveller(s) in {currency}>,
    "accommodation": <total hotel cost for all {duration_days} nights in {currency}>,
    "food": <total meals cost for all {duration_days} days in {currency}>,
    "activities": <total activities cost in {currency}>,
    "transport": <total local transport in {currency}>,
    "miscellaneous": <shopping, tips, extras in {currency}>
  }},
  "practicalInfo": {{
    "language": "<primary language(s)>",
    "timezone": "<timezone name and UTC offset>",
    "currency": "<local currency name>",
    "tipping": "<tipping customs>",
    "transportation": "<how to get around the city>"
  }}
}}

Include exactly {duration_days} day objects in the itinerary array. Use real place names, real restaurant names, and real cost estimates from web search results."""

    logger.debug("[generate-plan] Prompt length=%d chars", len(prompt))
    try:
        logger.info("[generate-plan] Calling Gemini model=gemini-3.1-flash-lite-preview with google_search tool")
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=gt.GenerateContentConfig(
                tools=[gt.Tool(google_search=gt.GoogleSearch())],
            ),
        )
        text = response.text or ""
        logger.info("[generate-plan] Gemini responded: length=%d preview=%r", len(text), text[:300])

        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            logger.error("[generate-plan] No JSON object found in response. Full text:\n%s", text)
            raise HTTPException(status_code=500, detail="Agent returned no structured plan data")

        logger.debug("[generate-plan] JSON match start=%d end=%d", match.start(), match.end())
        plan_data = json.loads(match.group())
        logger.info("[generate-plan] Parsed plan keys=%s", list(plan_data.keys()))

        # Augment with fields the frontend TripPlan type expects
        plan_data.setdefault("id", str(uuid.uuid4()))
        plan_data.setdefault("duration", duration_days)
        plan_data.setdefault("currency", currency)
        plan_data.setdefault("createdAt", __import__("datetime").datetime.utcnow().isoformat())
        plan_data["preferences"] = {
            "budget": budget,
            "currency": currency,
            "duration": duration_days,
            "interests": [i.strip() for i in interests.split(",") if i.strip()] or ["culture", "food"],
            "weather": "mild",
            "travelStyle": travel_style,
            "departureCity": origin or "Your city",
            "groupType": group_type,
            "travelers": travelers,
            "travelMonth": travel_month or "",
        }
        # totalCost fallback
        if not plan_data.get("totalCost"):
            breakdown = plan_data.get("costBreakdown", {})
            plan_data["totalCost"] = sum(breakdown.values()) if breakdown else budget or 0
            logger.debug("[generate-plan] totalCost computed from breakdown: %s", plan_data["totalCost"])

        # Embed weather data so the frontend never needs a separate API call
        logger.debug("[generate-plan] Fetching weather for %s", destination)
        from app.agent.tools.weather_tools import get_weather_forecast, check_weather_for_travel
        weather_data = await asyncio.to_thread(get_weather_forecast, destination, 5)
        logger.debug("[generate-plan] Weather data keys=%s", list(weather_data.keys()) if isinstance(weather_data, dict) else type(weather_data))
        if travel_month:
            travel_check = await asyncio.to_thread(check_weather_for_travel, destination, travel_month)
            plan_data["weather"] = {
                **weather_data,
                "travel_month": travel_month,
                "suitability": travel_check.get("suitability", ""),
                "travel_advisory": travel_check.get("recommendation", ""),
            }
        else:
            plan_data["weather"] = weather_data

        logger.info("[generate-plan] SUCCESS — returning plan for %s", destination)
        return {"success": True, "data": plan_data}

    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        logger.exception("[generate-plan] JSON decode failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Could not parse plan JSON: {exc}") from exc
    except Exception as exc:
        logger.exception("[generate-plan] Unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {exc}") from exc
