"""Destination search and recommendation tools."""

from app.agent.data.destinations import DESTINATIONS, convert_to_pkr


def search_destinations(
    interests: str,
    budget: float,
    currency: str = "PKR",
    duration_days: int = 5,
    travelers: int = 1,
    region: str = "any",
) -> dict:
    """
    Search and rank destinations matching user preferences and budget.

    Args:
        interests: Comma-separated interest tags (e.g., "adventure, hiking, nature")
        budget: Total available budget
        currency: Budget currency (default PKR)
        duration_days: Trip duration
        travelers: Number of travelers
        region: "local", "regional", "international", or "any"

    Returns:
        dict with ranked list of matching destinations.
    """
    currency = currency.upper()
    budget_pkr = convert_to_pkr(budget, currency) if currency != "PKR" else budget
    interest_list = [i.strip().lower() for i in interests.split(",")]

    matches = []
    for name, dest in DESTINATIONS.items():
        if region != "any" and dest["region"] != region:
            continue

        min_daily_pkr = sum(dest["costs_pkr"]["budget"].values())
        flight_pkr = dest.get("flight_from_karachi_pkr", 0) * travelers * 2
        min_total_pkr = (min_daily_pkr * duration_days * travelers) + flight_pkr

        if budget_pkr < min_total_pkr:
            continue

        dest_interests = [i.lower() for i in dest["interests"]]
        matched = [i for i in interest_list if i in dest_interests]
        score = len(matched)

        if score == 0 and interest_list:
            continue

        budget_comfort = budget_pkr / max(min_total_pkr, 1)
        matches.append({
            "name": name,
            "country": dest["country"],
            "region": dest["region"],
            "description": dest["description"],
            "matching_interests": matched,
            "highlights": dest["highlights"][:3],
            "min_cost_pkr": min_total_pkr,
            "budget_comfort_ratio": round(budget_comfort, 2),
            "score": score + (budget_comfort * 0.1),
        })

    matches.sort(key=lambda x: x["score"], reverse=True)

    return {
        "status": "success",
        "query": {"interests": interests, "budget": f"{currency} {budget:,.0f}", "duration_days": duration_days},
        "total_matches": len(matches),
        "destinations": [{k: v for k, v in d.items() if k != "score"} for d in matches[:6]],
    }


def get_destination_details(destination: str) -> dict:
    """
    Get full details about a destination.

    Args:
        destination: Destination name (e.g., "Lahore", "Istanbul")

    Returns:
        dict with complete destination information.
    """
    dest = next(
        (d for name, d in DESTINATIONS.items() if name.lower() == destination.lower()),
        None,
    )
    if not dest:
        return {
            "status": "error",
            "message": f"'{destination}' not found. Available: {', '.join(list(DESTINATIONS.keys())[:8])}",
        }

    return {
        "status": "success",
        "destination": destination,
        "country": dest["country"],
        "description": dest["description"],
        "interests": dest["interests"],
        "highlights": dest["highlights"],
        "best_months": dest["best_months"],
        "months_to_avoid": dest["avoid_months"],
        "restaurants": dest.get("restaurants", []),
        "cost_summary": {
            "budget_per_day_pkr": sum(dest["costs_pkr"]["budget"].values()),
            "mid_range_per_day_pkr": sum(dest["costs_pkr"]["mid_range"].values()),
            "luxury_per_day_pkr": sum(dest["costs_pkr"]["luxury"].values()),
            "flight_from_karachi_pkr": dest.get("flight_from_karachi_pkr", 0),
        },
        "min_trip_budget_pkr": dest.get("min_trip_budget_pkr", 0),
    }


def get_restaurant_recommendations(
    destination: str,
    cuisine_preference: str = "any",
    budget_tier: str = "any",
) -> dict:
    """
    Get restaurant recommendations for a destination.

    Args:
        destination: City name
        cuisine_preference: Preferred cuisine type or "any"
        budget_tier: "budget", "mid-range", "luxury", or "any"

    Returns:
        dict with restaurant list and dining tips.
    """
    dest = next(
        (d for name, d in DESTINATIONS.items() if name.lower() == destination.lower()),
        None,
    )
    if not dest:
        return {"status": "error", "message": f"Destination '{destination}' not found."}

    restaurants = dest.get("restaurants", [])

    if cuisine_preference.lower() != "any":
        filtered = [r for r in restaurants if cuisine_preference.lower() in r["cuisine"].lower()]
        restaurants = filtered or restaurants

    if budget_tier.lower() != "any":
        filtered = [r for r in restaurants if r["price_tier"] == budget_tier.lower()]
        restaurants = filtered or restaurants

    return {
        "status": "success",
        "destination": destination,
        "restaurants": restaurants,
        "dining_tip": _dining_tip(dest["country"]),
    }


def get_activities_and_attractions(
    destination: str,
    interests: str = "general",
    duration_days: int = 3,
) -> dict:
    """
    Get activities and attractions for a destination tailored to interests.

    Args:
        destination: Destination city name
        interests: Comma-separated interest tags
        duration_days: Number of days (helps prioritize picks)

    Returns:
        dict with curated attractions and activity suggestions.
    """
    dest = next(
        (d for name, d in DESTINATIONS.items() if name.lower() == destination.lower()),
        None,
    )
    if not dest:
        return {"status": "error", "message": f"Destination '{destination}' not found."}

    highlights = dest.get("highlights", [])
    interest_list = [i.strip().lower() for i in interests.split(",")]

    return {
        "status": "success",
        "destination": destination,
        "must_see": highlights[:duration_days + 1],
        "additional_options": highlights[duration_days + 1:],
        "activity_types": dest["interests"],
        "tip": _activity_tip(destination, dest["country"], interest_list),
    }


def get_local_events(destination: str, travel_month: str) -> dict:
    """
    Get notable local events and festivals for a destination and month.

    Args:
        destination: City name
        travel_month: Month of travel (e.g., "March", "December")

    Returns:
        dict with events, festivals, and seasonal highlights.
    """
    events_db: dict[str, dict[str, list[str]]] = {
        "Lahore": {
            "Feb": ["Basant Festival (kite flying)", "Pakistan Day preparations"],
            "Mar": ["Pakistan Day (March 23)"],
            "Dec": ["Lahore Literary Festival", "New Year events"],
            "Oct": ["Lahore Food Festival", "Urs at Data Darbar"],
        },
        "Istanbul": {
            "Apr": ["Istanbul Tulip Festival", "National Sovereignty Day"],
            "Jun": ["Istanbul Music Festival"],
            "Oct": ["Republic Day celebrations"],
        },
        "Dubai": {
            "Nov": ["Dubai Airshow", "Dubai Food Festival"],
            "Dec": ["Dubai Shopping Festival", "New Year fireworks at Burj Khalifa"],
        },
        "Bangkok": {
            "Apr": ["Songkran (Thai New Year water festival)"],
            "Nov": ["Loy Krathong (lantern festival)"],
        },
    }

    month_abbr = travel_month[:3].capitalize()
    events = events_db.get(destination, {}).get(month_abbr, [
        "Check local tourism websites for current events closer to your travel date."
    ])

    return {
        "status": "success",
        "destination": destination,
        "travel_month": travel_month,
        "events_and_festivals": events,
        "note": "Events subject to change — verify closer to travel date.",
    }


def _dining_tip(country: str) -> str:
    tips = {
        "Pakistan": "Street food is outstanding and very affordable. Try local dhabas for authentic experience.",
        "UAE": "Look for budget Indian/Pakistani joints alongside upscale options. JBR beach area has great variety.",
        "Turkey": "Try a proper Turkish breakfast 'kahvalti' at a local tea house — a cultural experience.",
        "Malaysia": "Hawker stalls are the best value. Look for certified halal signs.",
        "Thailand": "Street food is world-class in Bangkok. Avoid tourist-trap restaurants near major landmarks.",
        "France": "Boulangeries for breakfast are much cheaper than cafes. Lunch 'plat du jour' is great value.",
    }
    return tips.get(country, "Ask locals for restaurant recommendations to find the best authentic spots.")


def _activity_tip(destination: str, country: str, interests: list) -> str:
    if "adventure" in interests or "hiking" in interests:
        return f"For adventure in {destination}, book through certified local guides for safety."
    if "culture" in interests or "history" in interests:
        return f"Many historical sites in {destination} offer guided tours that greatly enhance the experience."
    if "food" in interests:
        return f"Consider a food walking tour of {destination} for the best culinary deep-dive."
    return f"Visit the local tourism office in {destination} for free maps and discounted attraction tickets."
