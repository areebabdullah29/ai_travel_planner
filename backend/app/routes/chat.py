import json
import os
import re
import uuid
from datetime import datetime

from flask import Blueprint

from app.utils import get_json_body, json_response

chat_bp = Blueprint('chat', __name__)


def _extract_json(text: str) -> dict:
    """Try several strategies to extract a JSON object from model output."""
    text = text.strip()

    # Strategy 1: strip markdown fences
    clean = re.sub(r'^```(?:json)?\s*', '', text)
    clean = re.sub(r'\s*```$', '', clean.strip())
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Strategy 2: find the first { ... } block
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError('No valid JSON found in model response')


@chat_bp.route('/chat', methods=['POST'])
def chat():
    """Proxy Claude API chat messages from the frontend."""
    api_key = os.getenv('ANTHROPIC_API_KEY', '')
    if not api_key:
        return json_response(error='AI service not configured', status=503)

    data = get_json_body()
    messages = data.get('messages', [])
    system = data.get('system', 'You are TravelBuddy, an enthusiastic AI travel planning assistant.')

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return json_response(data={'response': response.content[0].text})
    except Exception as e:
        return json_response(error=str(e), status=500)


@chat_bp.route('/generate-plan', methods=['POST'])
def generate_plan():
    """Generate a structured trip plan using Claude AI."""
    api_key = os.getenv('ANTHROPIC_API_KEY', '')
    if not api_key:
        return json_response(error='AI service not configured', status=503)

    body = get_json_body()

    # Accept either a wrapped preferences object or a flat payload
    preferences = body.get('preferences', body)

    destination = (
        body.get('suggestedDestination')
        or body.get('destination')
        or preferences.get('suggestedDestination')
        or preferences.get('destination', 'Islamabad, Pakistan')
    )
    budget      = preferences.get('budget', 50000)
    currency    = preferences.get('currency', 'PKR')
    duration    = preferences.get('duration', 5)
    interests   = preferences.get('interests', [])
    group_type  = preferences.get('groupType', 'couple')
    travel_style = preferences.get('travelStyle', 'Mixed')

    interests_str = ', '.join(interests) if interests else 'sightseeing, culture, food'

    # Per-day budget so the AI can give realistic recommendations
    per_day = round(budget / duration) if duration else budget

    prompt = f"""You are a professional travel planner. Create a detailed, realistic {duration}-day itinerary for **{destination}**.

Trip details:
- Total budget: {budget:,} {currency} (≈ {per_day:,} {currency}/day)
- Interests: {interests_str}
- Travel group: {group_type}
- Travel style: {travel_style}

Rules:
1. Use REAL, well-known place names, restaurants, hotels, and attractions that actually exist in {destination}.
2. All costs MUST be in {currency} and stay within the {budget:,} {currency} total.
3. Include 3 activities per day (morning ~09:00, afternoon ~14:00, evening ~19:00).
4. The costBreakdown values must add up to exactly {budget}.
5. Return ONLY a valid JSON object — no markdown fences, no explanation, no extra text.

Return this exact JSON structure:
{{
  "destination": "<city name>",
  "country": "<country>",
  "duration": {duration},
  "totalCost": {budget},
  "currency": "{currency}",
  "highlights": ["<real highlight 1>", "<real highlight 2>", "<real highlight 3>", "<real highlight 4>"],
  "bestTime": "<best months to visit>",
  "itinerary": [
    {{
      "day": 1,
      "title": "<creative day title>",
      "activities": [
        {{"name": "<real activity/place>", "time": "09:00", "duration": "2-3 hours", "cost": <integer in {currency}>, "description": "<specific description>", "category": "Sightseeing"}},
        {{"name": "<real activity/place>", "time": "14:00", "duration": "2 hours",   "cost": <integer>,              "description": "<specific description>", "category": "Culture"}},
        {{"name": "<real restaurant/bar>", "time": "19:00", "duration": "2 hours",   "cost": <integer>,              "description": "<specific description>", "category": "Food"}}
      ],
      "meals": {{"breakfast": "<specific café or dish>", "lunch": "<specific restaurant>", "dinner": "<specific restaurant with area>"}},
      "accommodation": "<real hotel name> (<stars>★)",
      "estimatedCost": <total day cost as integer>
    }}
  ],
  "restaurants": [
    {{"name": "<real restaurant>", "cuisine": "<type>", "priceRange": "$",   "rating": 4.5, "specialty": "<signature dish>", "location": "<neighbourhood>"}},
    {{"name": "<real restaurant>", "cuisine": "<type>", "priceRange": "$$",  "rating": 4.3, "specialty": "<dish>",           "location": "<neighbourhood>"}},
    {{"name": "<real restaurant>", "cuisine": "<type>", "priceRange": "$$",  "rating": 4.6, "specialty": "<dish>",           "location": "<neighbourhood>"}},
    {{"name": "<real restaurant>", "cuisine": "<type>", "priceRange": "$$$", "rating": 4.4, "specialty": "<dish>",           "location": "<neighbourhood>"}}
  ],
  "practicalInfo": {{
    "language": "<primary language>",
    "timezone": "<e.g. PKT (UTC+5)>",
    "currency": "{currency}",
    "tipping": "<local custom>",
    "transportation": "<main options>"
  }},
  "costBreakdown": {{
    "flights":       <30% of {budget} rounded to integer>,
    "accommodation": <30% of {budget} rounded to integer>,
    "food":          <18% of {budget} rounded to integer>,
    "activities":    <12% of {budget} rounded to integer>,
    "transport":     <6%  of {budget} rounded to integer>,
    "miscellaneous": <4%  of {budget} rounded to integer>
  }}
}}

Generate all {duration} days in the itinerary array. Use authentic, specific details for {destination}."""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=8192,
            messages=[{'role': 'user', 'content': prompt}],
        )
        text = response.content[0].text
        plan = _extract_json(text)

        # Ensure required top-level fields exist
        plan.setdefault('id', str(uuid.uuid4()))
        plan.setdefault('createdAt', datetime.utcnow().isoformat())
        plan['preferences'] = preferences
        plan['id'] = str(uuid.uuid4())   # always fresh

        return json_response(data=plan)

    except (ValueError, json.JSONDecodeError) as e:
        return json_response(error=f'Failed to parse AI response: {e}', status=500)
    except Exception as e:
        return json_response(error=str(e), status=500)
