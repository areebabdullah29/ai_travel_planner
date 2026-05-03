import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


class ChatMessage(BaseModel):
    """Chat message schema"""
    content: str


class TripPlanRequest(BaseModel):
    """Trip plan generation request"""
    budget: float
    currency: str = "PKR"
    duration: int = 5
    interests: list[str] = []
    groupType: str = "solo"
    travelStyle: str = "adventurous"


SYSTEM_PROMPT = """You are an expert travel planning assistant powered by Claude.
Your role is to help users plan amazing trips by asking clarifying questions and providing
personalized travel recommendations. Be friendly, knowledgeable, and enthusiastic about travel.

When providing recommendations, consider:
- User's budget and preferences
- Travel duration
- Group composition (solo, couple, family)
- Travel style (adventurous, luxury, budget, cultural, etc.)
- Interests and activities

Always provide helpful, actionable advice."""


@router.post("/chat")
async def chat(
    message: ChatMessage,
):
    """Chat with Claude AI about travel planning"""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message.content}],
        )

        return {
            "success": True,
            "data": {
                "response": response.content[0].text if response.content else "",
                "model": "claude-sonnet-4-6",
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/generate-plan")
async def generate_plan(
    request: TripPlanRequest,
):
    """Generate a complete trip plan using Claude AI"""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    system_prompt = f"""You are an expert travel planner. Generate a comprehensive travel plan in JSON format.
The user has specified:
- Budget: {request.budget} {request.currency}
- Duration: {request.duration} days
- Interests: {', '.join(request.interests) if request.interests else 'Not specified'}
- Group Type: {request.groupType}
- Travel Style: {request.travelStyle}

Return a JSON object with this exact structure:
{{
  "destination": "string",
  "country": "string",
  "duration": {request.duration},
  "totalCost": number,
  "currency": "{request.currency}",
  "highlights": ["string"],
  "bestTime": "string",
  "itinerary": [
    {{"day": 1, "activity": "string", "cost": number}}
  ],
  "restaurants": [
    {{"name": "string", "type": "string", "costPerPerson": number}}
  ],
  "practicalInfo": {{"visaRequired": boolean, "bestTransport": "string"}},
  "costBreakdown": {{"accommodation": number, "food": number, "activities": number, "transport": number}}
}}

Make sure all monetary values are in {request.currency}."""

    prompt = f"""Based on my preferences, create a detailed trip plan.
Budget: {request.budget} {request.currency}
Duration: {request.duration} days
Interests: {', '.join(request.interests) if request.interests else 'General tourism'}
Group: {request.groupType}
Style: {request.travelStyle}

Please generate a complete travel plan in the specified JSON format."""

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text if response.content else ""

        # Try to extract JSON from response
        try:
            # Find JSON in response (handles markdown code blocks)
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                plan_data = json.loads(json_str)
            else:
                plan_data = json.loads(response_text)
        except json.JSONDecodeError:
            plan_data = {"raw_response": response_text}

        return {
            "success": True,
            "data": plan_data,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
