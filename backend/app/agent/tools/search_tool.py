"""
Custom web search tool — wraps Google Search via the genai API as a plain
Python function tool so it can be freely mixed with other function tools
without triggering the ADK built-in tool mixing restriction.
"""

import os
from google import genai
from google.genai import types as gt


def web_search(query: str) -> str:
    """
    Search the web for current, real-time information on any topic.

    Use targeted queries to find travel costs, attractions, restaurants,
    weather, events, and any other live information needed for trip planning.

    Args:
        query: Search query string (e.g., "Paris average hotel price per night 2025")

    Returns:
        str: Search results summary with current information.
    """
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=query,
        config=gt.GenerateContentConfig(
            tools=[gt.Tool(google_search=gt.GoogleSearch())],
            temperature=0.1,
        ),
    )
    return response.text or "No results found."
