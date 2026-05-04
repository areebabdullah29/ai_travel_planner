"""Itinerary generation tools — builds structured day-by-day travel plans."""

from app.agent.data.destinations import DESTINATIONS, convert_from_pkr


def generate_day_by_day_itinerary(
    destination: str,
    duration_days: int,
    interests: str = "culture, food, sightseeing",
    accommodation_tier: str = "mid_range",
    currency: str = "PKR",
) -> dict:
    """
    Generate a detailed day-by-day itinerary for a destination.

    Args:
        destination: City name (e.g., "Lahore", "Istanbul")
        duration_days: Total trip days
        interests: Comma-separated interest tags
        accommodation_tier: "budget", "mid_range", or "luxury"
        currency: Display currency for cost estimates

    Returns:
        dict with full itinerary, daily schedule, and cost per day.
    """
    dest = _find_destination(destination)
    if not dest:
        return {"status": "error", "message": f"Destination '{destination}' not in database."}

    interest_list = [i.strip().lower() for i in interests.split(",")]
    highlights = dest["highlights"]
    restaurants = dest.get("restaurants", [])
    tier = accommodation_tier if accommodation_tier in dest["costs_pkr"] else "mid_range"
    costs = dest["costs_pkr"][tier]
    currency = currency.upper()

    def fmt(pkr: float) -> str:
        val = convert_from_pkr(pkr, currency) if currency != "PKR" else pkr
        return f"{currency} {val:,.0f}"

    days = []
    highlight_idx = 0
    restaurant_idx = 0

    for day_num in range(1, duration_days + 1):
        is_first = day_num == 1
        is_last = day_num == duration_days

        if is_first:
            morning = "Arrive and check in. Freshen up and explore the immediate neighborhood."
        else:
            morning = f"Visit {highlights[highlight_idx % len(highlights)]}. Take your time to explore fully."
            highlight_idx += 1

        afternoon = f"Head to {highlights[highlight_idx % len(highlights)]}. Grab lunch nearby."
        highlight_idx += 1

        rest = restaurants[restaurant_idx % len(restaurants)] if restaurants else None
        restaurant_idx += 1
        if rest:
            evening = f"Dinner at {rest['name']} ({rest['cuisine']}, {rest['price_tier']}). Evening stroll or rest."
        else:
            evening = "Dinner at a local restaurant. Evening at leisure."

        if is_last:
            evening = "Light packing, last-minute souvenirs, early dinner. Prepare for departure."

        daily_cost_pkr = sum(costs.values())
        days.append({
            "day": day_num,
            "title": f"Day {day_num}: {_day_title(day_num, duration_days, destination)}",
            "morning": morning,
            "afternoon": afternoon,
            "evening": evening,
            "tips": _day_tips(day_num, duration_days, dest["country"], interest_list),
            "estimated_cost": fmt(daily_cost_pkr),
        })

    total_stay_pkr = sum(costs.values()) * duration_days
    flight_pkr = dest.get("flight_from_karachi_pkr", 0) * 2

    return {
        "status": "success",
        "destination": destination,
        "country": dest["country"],
        "duration_days": duration_days,
        "accommodation_tier": tier,
        "currency": currency,
        "itinerary": days,
        "cost_summary": {
            "daily_average": fmt(sum(costs.values())),
            "total_stay_cost": fmt(total_stay_pkr),
            "flights_round_trip": fmt(flight_pkr),
            "grand_total": fmt(total_stay_pkr + flight_pkr),
        },
        "packing_tips": _packing_tips(dest["country"], interest_list),
        "best_transport": _transport_tips(dest["country"]),
    }


def adjust_itinerary_for_weather(
    destination: str,
    original_itinerary: list[str],
    weather_concern: str,
) -> dict:
    """
    Adjust a day's activities based on bad weather.

    Args:
        destination: City name
        original_itinerary: List of planned activities (strings)
        weather_concern: Weather issue ("heavy rain", "extreme heat", etc.)

    Returns:
        dict with adjusted itinerary and indoor alternatives.
    """
    dest = _find_destination(destination)
    country = dest["country"] if dest else "unknown"
    indoor_alts = _indoor_alternatives(country)[:]

    adjusted = []
    for activity in original_itinerary:
        if any(kw in activity.lower() for kw in ["hike", "trek", "outdoor", "beach", "park", "garden", "walk"]):
            alt = indoor_alts.pop(0) if indoor_alts else "Visit a local museum or covered market"
            adjusted.append(f"[Adjusted for {weather_concern}] {alt}")
        else:
            adjusted.append(activity)

    return {
        "status": "success",
        "destination": destination,
        "weather_concern": weather_concern,
        "adjusted_itinerary": adjusted,
        "indoor_alternatives": indoor_alts[:3],
        "advisory": _weather_travel_tip(weather_concern.lower()),
    }


def _find_destination(name: str) -> dict | None:
    name_lower = name.lower()
    for dest_name, dest in DESTINATIONS.items():
        if dest_name.lower() == name_lower or name_lower in dest_name.lower():
            return dest
    return None


def _day_title(day: int, total: int, destination: str) -> str:
    if day == 1:
        return f"Arrival in {destination}"
    if day == total:
        return f"Farewell to {destination}"
    return f"Exploring {destination}"


def _day_tips(day: int, total: int, country: str, interests: list) -> list[str]:
    tips = []
    if day == 1:
        tips.append("Exchange currency at the airport or a reputable exchange center.")
        tips.append("Download offline maps before leaving the airport.")
    if country == "Pakistan":
        tips.append("Use Careem/inDrive for transport. Negotiate rickshaw fares upfront.")
    if day == total:
        tips.append("Check out by noon. Store luggage at hotel while doing last-minute sightseeing.")
    return tips


def _indoor_alternatives(country: str) -> list[str]:
    alts = {
        "Pakistan": ["Visit a local museum", "Explore a covered bazaar", "Enjoy a local food tour"],
        "UAE": ["Visit Dubai Mall", "Explore the Dubai Museum", "Visit an aquarium"],
        "Turkey": ["Explore the Grand Bazaar", "Visit Topkapi Palace", "Turkish hammam experience"],
    }
    return alts.get(country, ["Visit a local museum", "Explore indoor markets", "Art galleries"])


def _packing_tips(country: str, interests: list) -> list[str]:
    tips = ["Comfortable walking shoes are essential."]
    if country == "Pakistan":
        tips.append("Modest clothing (covered shoulders/knees) is appreciated and sometimes required.")
    if "adventure" in interests or "hiking" in interests:
        tips += ["Sunscreen (SPF 50+)", "Insect repellent", "Daypack"]
    tips.append("Portable charger for full-day outings.")
    return tips


def _transport_tips(country: str) -> str:
    tips = {
        "Pakistan": "Use Careem, inDrive, or local taxis. Inter-city: Daewoo coaches or domestic flights.",
        "UAE": "Dubai Metro is excellent and cheap. Taxis/Uber are reliable but pricier.",
        "Turkey": "Istanbul metro + tram is great (Istanbulkart). Taxis available but negotiate first.",
        "Malaysia": "KL has good MRT/LRT/monorail. Grab works everywhere.",
        "Thailand": "BTS Skytrain is easiest in Bangkok. Use Grab for other transport.",
        "France": "Paris Metro is comprehensive and affordable. Get a Navigo pass.",
    }
    return tips.get(country, "Use local ride-hailing apps. Public transit is usually best value.")


def _weather_travel_tip(concern: str) -> str:
    if "rain" in concern:
        return "Carry a compact umbrella. Waterproof your bag. Wear quick-dry clothing."
    if "heat" in concern or "hot" in concern:
        return "Start outdoor activities before 10am and after 4pm. Stay hydrated."
    if "cold" in concern or "snow" in concern:
        return "Layer up — thermal base + insulating mid + windproof outer."
    return "Stay flexible and check local news for real-time updates."
