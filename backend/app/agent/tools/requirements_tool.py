"""
Requirements gathering tool — signals when the agent has collected all
the trip-planning prerequisites from the user.

The frontend uses the structured payload written into session state to
enable the "Generate My Trip Plan" button.
"""

from google.adk.tools.tool_context import ToolContext


def mark_requirements_complete(
    origin: str,
    destination: str,
    duration_days: int,
    travelers: int,
    interests: str = "",
    budget: float = 0,
    currency: str = "PKR",
    travel_month: str = "",
    tool_context: ToolContext = None,
) -> dict:
    """
    Call this once you have collected all of the user's required trip details.

    Required fields:
      - origin: city/country the traveller is departing from
      - destination: target city/country
      - duration_days: trip length in days
      - travelers: number of people travelling

    Optional fields:
      - interests: comma-separated tags (culture, food, adventure, etc.)
      - budget: total budget; 0 means user did not specify
      - currency: ISO code, defaults to PKR
      - travel_month: month of travel (e.g., "June", "December")

    Args:
        origin: Departure city or country (e.g., "Karachi", "Lahore, Pakistan").
        destination: Destination city or country (e.g., "Tokyo", "Paris").
        duration_days: Number of days for the trip.
        travelers: Number of travellers in the group.
        interests: Optional comma-separated interest tags.
        budget: Optional total budget in the chosen currency.
        currency: ISO currency code (defaults to PKR).
        travel_month: Month of intended travel (e.g., "June", "December").
        tool_context: Provided by ADK at runtime for state access.

    Returns:
        dict acknowledging the gathered requirements.
    """
    interest_list = [i.strip() for i in interests.split(",") if i.strip()]

    prefs = {
        "origin": origin.strip(),
        "destination": destination.strip(),
        "duration_days": int(duration_days),
        "travelers": int(travelers),
        "interests": interest_list,
        "budget": float(budget) if budget else 0,
        "currency": (currency or "PKR").upper(),
        "travel_month": travel_month.strip() if travel_month else "",
    }

    if tool_context is not None:
        tool_context.state["requirements"] = prefs

    summary_parts = [
        f"from {prefs['origin']} to {prefs['destination']}",
        f"{prefs['duration_days']} days",
        f"{prefs['travelers']} traveller(s)",
    ]
    if prefs["travel_month"]:
        summary_parts.append(f"in {prefs['travel_month']}")
    if interest_list:
        summary_parts.append(f"interests: {', '.join(interest_list)}")
    if prefs["budget"] > 0:
        summary_parts.append(f"budget {prefs['currency']} {prefs['budget']:,.0f}")

    return {
        "status": "ready",
        "summary": " · ".join(summary_parts),
        "requirements": prefs,
    }
