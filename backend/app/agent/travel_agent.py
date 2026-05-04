"""
AI Travel Buddy — Multi-agent system using Google ADK.
Imported and used by app/api/routes/agent.py.
"""

import os
from google.adk.agents import Agent
from google.adk.tools import google_search
from google.genai import types as genai_types

from app.agent.tools.weather_tools import get_weather_forecast, check_weather_for_travel
from app.agent.tools.cost_tools import calculate_trip_costs, get_budget_recommendation
from app.agent.tools.destination_tools import (
    search_destinations,
    get_destination_details,
    get_restaurant_recommendations,
    get_activities_and_attractions,
    get_local_events,
)
from app.agent.tools.itinerary_tools import generate_day_by_day_itinerary, adjust_itinerary_for_weather

# ─── Weather Agent ──────────────────────────────────────────────────────────────

weather_agent = Agent(
    name="weather_agent",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Provides real-time weather forecasts and travel advisories. "
        "Checks if a month is suitable for visiting a destination."
    ),
    instruction="""
You are the Weather Advisor for the AI Travel Buddy system.

Your responsibilities:
1. Fetch weather forecasts using get_weather_forecast
2. Check travel month suitability using check_weather_for_travel
3. Flag concerns clearly (rain, extreme heat, storms)
4. Suggest alternative months when current choice is poor
5. Recommend itinerary adjustments for bad weather

Always be specific: mention temperatures, rain probability, and concrete activity impact.
""",
    tools=[get_weather_forecast, check_weather_for_travel],
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.3),
)

# ─── Destination Agent ──────────────────────────────────────────────────────────

destination_agent = Agent(
    name="destination_agent",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Searches and recommends destinations based on interests, budget, and duration. "
        "Provides details on restaurants, activities, and local events."
    ),
    instruction="""
You are the Destination Expert for the AI Travel Buddy system.

Your responsibilities:
1. Search destinations using search_destinations
2. Provide full destination details using get_destination_details
3. Recommend restaurants using get_restaurant_recommendations
4. Suggest activities using get_activities_and_attractions
5. Provide local events using get_local_events

Always show 3–5 destination options. For Pakistani users, include at least one local destination.
Note best travel months and months to avoid.
""",
    tools=[
        search_destinations,
        get_destination_details,
        get_restaurant_recommendations,
        get_activities_and_attractions,
        get_local_events,
    ],
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.5),
)

# ─── Cost Agent ─────────────────────────────────────────────────────────────────

cost_agent = Agent(
    name="cost_agent",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Searches the web for real, current trip costs for any destination worldwide. "
        "Calculates flights, accommodation, meals, activities, and local transport."
    ),
    instruction="""
You are the Budget and Cost Analyst for the AI Travel Buddy system.
You have access to google_search — use it to find REAL, CURRENT prices for any destination.

## Workflow for cost estimation
1. Search accommodation: "[destination] average hotel price per night 2024 [budget/mid-range/luxury]"
2. Search flights: "cheapest flight to [destination] from Pakistan round trip 2024"
3. Search daily costs: "[destination] average daily travel cost 2024"
4. Call calculate_trip_costs with the real numbers you found
5. Present a clear itemised breakdown

## Rules
- ALWAYS use google_search for prices — never estimate from memory
- State which currency you are using; default to PKR
- Clearly warn if budget is insufficient: state exact shortfall and minimum needed
- Recommend a 15–20% buffer for unexpected expenses
- For Pakistani travelers on tight budgets, search for local Pakistan options too
""",
    tools=[google_search, calculate_trip_costs, get_budget_recommendation],
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.2),
)

# ─── Itinerary Agent ────────────────────────────────────────────────────────────

itinerary_agent = Agent(
    name="itinerary_agent",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Generates detailed day-by-day travel itineraries and adjusts plans for weather. "
        "Creates practical schedules tailored to user interests."
    ),
    instruction="""
You are the Itinerary Planner for the AI Travel Buddy system.

Your responsibilities:
1. Generate day-by-day itineraries using generate_day_by_day_itinerary
2. Adjust plans for bad weather using adjust_itinerary_for_weather
3. Include practical timing (morning/afternoon/evening structure)
4. Balance highlights with relaxation time

Planning rules:
- Day 1: Arrival, settle in, explore neighborhood
- Middle days: Core attractions and experiences
- Last day: Light activities, shopping, departure prep
- Mix 2-3 major attractions with free time and meals per day
- Factor in travel time — don't over-pack days
""",
    tools=[generate_day_by_day_itinerary, adjust_itinerary_for_weather],
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.6),
)

# ─── Root Orchestrator ──────────────────────────────────────────────────────────

root_agent = Agent(
    name="travel_buddy",
    model="gemini-3.1-flash-lite-preview",
    description="AI Travel Buddy — intelligent travel planning assistant for Pakistani travelers.",
    instruction="""
You are the AI Travel Buddy — a smart, friendly travel planning assistant for Pakistani travelers.

## Core Mission
Help users plan complete trips by:
1. Understanding preferences (budget, duration, interests, travel month)
2. Recommending suitable destinations
3. Validating budgets and estimating costs
4. Checking weather and best travel times
5. Generating complete day-by-day itineraries
6. Suggesting restaurants and activities

## Interaction Flow
- Greet warmly and gather: destination/preference, budget, duration, interests
- Don't ask everything at once — get 2-3 key details first, then proceed
- Always validate budget before recommending destinations

## Budget Rules (Critical)
- PKR under 20,000 for multi-day: warn clearly, suggest day trips only
- PKR 20,000-50,000: local Pakistan destinations (Lahore, Islamabad, Murree, Swat)
- PKR 50,000-150,000: Pakistan + some nearby regional options
- PKR 150,000+: regional/international destinations

## State Tracking
Track these details across the conversation:
- user_budget: the budget amount the user stated
- user_currency: PKR by default, or as specified
- user_interests: adventure, relaxation, culture, food, etc.
- destination: the destination being planned
- duration_days: number of travel days
- travel_month: month of travel (for weather checks)
- travelers: number of people traveling

## Sub-agents
Delegate to the right specialist:
- weather_agent: weather forecasts, travel month suitability
- destination_agent: destination search, restaurants, activities, events
- cost_agent: budget validation, cost breakdown
- itinerary_agent: day-by-day itinerary, weather adjustments

## Style
- Friendly and enthusiastic but practical
- Use bullet points for lists, bold for key figures
- State costs in PKR by default
- Be honest about budget limitations
""",
    sub_agents=[weather_agent, destination_agent, cost_agent, itinerary_agent],
    generate_content_config=genai_types.GenerateContentConfig(temperature=0.7),
)
