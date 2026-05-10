"""Itinerary generation tools — builds structured day-by-day travel plans."""

_PKR_RATES: dict[str, float] = {
    "PKR": 1, "USD": 278, "EUR": 300, "GBP": 355,
    "AED": 76, "SAR": 74, "CAD": 205, "AUD": 182,
    "INR": 3.3, "TRY": 8.5,
}


def generate_day_by_day_itinerary(
    destination: str,
    country: str,
    duration_days: int,
    highlights: str,
    restaurants: str = "",
    interests: str = "culture, food, sightseeing",
    daily_budget_per_person: float = 0,
    currency: str = "USD",
) -> dict:
    """
    Generate a detailed day-by-day itinerary for any destination worldwide.

    Call this AFTER using google_search to find the destination's top attractions
    and restaurants. Pass those results in as comma-separated strings.

    Args:
        destination: City name (e.g., "Paris", "Tokyo", "Lahore")
        country: Country name (e.g., "France", "Japan", "Pakistan")
        duration_days: Total trip days
        highlights: Comma-separated top attractions found via google_search
                    (e.g., "Eiffel Tower, Louvre, Notre-Dame, Versailles")
        restaurants: Comma-separated restaurant names found via google_search
                     (e.g., "Bouillon Chartier, L'As du Fallafel, Breizh Café")
        interests: Comma-separated interest tags (adventure, culture, food, etc.)
        daily_budget_per_person: Estimated daily spend per person (from search/user input)
        currency: Display currency for cost estimates

    Returns:
        dict with full day-by-day itinerary and cost summary.
    """
    highlight_list = [h.strip() for h in highlights.split(",") if h.strip()]
    restaurant_list = [r.strip() for r in restaurants.split(",") if r.strip()]
    interest_list = [i.strip().lower() for i in interests.split(",")]
    currency = currency.upper()

    def fmt(amount: float) -> str:
        return f"{currency} {amount:,.0f}"

    days = []
    highlight_idx = 0
    restaurant_idx = 0

    for day_num in range(1, duration_days + 1):
        is_first = day_num == 1
        is_last = day_num == duration_days

        if is_first:
            morning = f"Arrive in {destination}. Check in and rest. Explore the neighborhood around your accommodation."
        elif highlight_list:
            morning = f"Visit {highlight_list[highlight_idx % len(highlight_list)]}. Take your time to explore fully."
            highlight_idx += 1
        else:
            morning = f"Morning exploration of {destination}'s highlights."

        if highlight_list:
            afternoon = f"Head to {highlight_list[highlight_idx % len(highlight_list)]}. Grab lunch nearby."
            highlight_idx += 1
        else:
            afternoon = f"Afternoon sightseeing and local exploration in {destination}."

        if is_last:
            evening = "Light packing, last-minute souvenirs, early dinner. Prepare for departure."
        elif restaurant_list:
            rest = restaurant_list[restaurant_idx % len(restaurant_list)]
            restaurant_idx += 1
            evening = f"Dinner at {rest}. Evening stroll or rest."
        else:
            evening = "Dinner at a local restaurant. Evening at leisure."

        days.append({
            "day": day_num,
            "title": f"Day {day_num}: {_day_title(day_num, duration_days, destination)}",
            "morning": morning,
            "afternoon": afternoon,
            "evening": evening,
            "tips": _day_tips(day_num, duration_days, country, interest_list),
        })

    result = {
        "status": "success",
        "destination": destination,
        "country": country,
        "duration_days": duration_days,
        "currency": currency,
        "itinerary": days,
        "packing_tips": _packing_tips(country, interest_list),
        "transport_tip": _transport_tip(country),
    }

    if daily_budget_per_person > 0:
        result["cost_estimate"] = {
            "daily_per_person": fmt(daily_budget_per_person),
            "total_stay": fmt(daily_budget_per_person * duration_days),
            "note": "Excludes flights. Based on your provided daily budget.",
        }

    return result


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
        weather_concern: Weather issue ("heavy rain", "extreme heat", "storm", etc.)

    Returns:
        dict with adjusted itinerary and indoor alternatives.
    """
    indoor_alts = [
        "Visit a local museum or art gallery",
        "Explore an indoor covered market or shopping mall",
        "Enjoy a local cooking class or food tour",
        "Visit a historical palace, library, or cultural center",
        "Try a local café or coffee house experience",
    ]

    adjusted = []
    used_alts = list(indoor_alts)
    for activity in original_itinerary:
        if any(kw in activity.lower() for kw in ["hike", "trek", "outdoor", "beach", "park", "garden", "walk", "cruise"]):
            alt = used_alts.pop(0) if used_alts else "Visit a local museum or covered market"
            adjusted.append(f"[Adjusted for {weather_concern}] {alt}")
        else:
            adjusted.append(activity)

    return {
        "status": "success",
        "destination": destination,
        "weather_concern": weather_concern,
        "adjusted_itinerary": adjusted,
        "indoor_alternatives": indoor_alts[:3],
        "advisory": _weather_tip(weather_concern.lower()),
    }


# ─── Private helpers ─────────────────────────────────────────────────────────

def _day_title(day: int, total: int, destination: str) -> str:
    if day == 1:
        return f"Arrival in {destination}"
    if day == total:
        return f"Farewell to {destination}"
    return f"Exploring {destination}"


def _day_tips(day: int, total: int, country: str, interests: list) -> list[str]:
    tips = []
    if day == 1:
        tips.append("Exchange currency at the airport or a reputable local exchange center.")
        tips.append("Download offline maps (Google Maps / Maps.me) before leaving the airport.")
    if country == "Pakistan":
        tips.append("Use Careem or inDrive for reliable transport. Negotiate rickshaw fares upfront.")
    if "adventure" in interests and day not in (1, total):
        tips.append("Start outdoor activities early to beat crowds and midday heat.")
    if day == total:
        tips.append("Check out by noon. Store luggage at the hotel while doing last-minute sightseeing.")
    return tips


def _packing_tips(country: str, interests: list) -> list[str]:
    tips = ["Comfortable walking shoes are essential for city exploration."]
    if country == "Pakistan":
        tips.append("Modest clothing (covered shoulders and knees) is appreciated and sometimes required at religious sites.")
    if "adventure" in interests or "hiking" in interests:
        tips += ["Sunscreen (SPF 50+)", "Insect repellent", "Lightweight daypack"]
    tips.append("Portable power bank for full-day outings.")
    tips.append("Travel adapter for local socket types.")
    return tips


def _transport_tip(country: str) -> str:
    tips = {
        "Pakistan": "Use Careem, inDrive, or local taxis. Inter-city: Daewoo coaches or domestic flights.",
        "UAE": "Dubai Metro is excellent and affordable. Taxis/Uber reliable but pricier.",
        "Turkey": "Istanbul metro + tram system is great — get an Istanbulkart. Taxis available but agree on fare first.",
        "Malaysia": "KL has good MRT/LRT/monorail. Grab works reliably everywhere.",
        "Thailand": "BTS Skytrain is easiest in Bangkok. Use Grab for other transport.",
        "France": "Paris Métro is comprehensive and affordable. A Navigo Découverte weekly pass is great value.",
        "Japan": "IC card (Suica/Pasmo) works on all trains and metros. Buy at airport.",
        "UK": "London Oyster card for all tube/bus travel. Apps: Citymapper for navigation.",
        "USA": "Uber/Lyft are standard. Public transit varies heavily by city.",
    }
    return tips.get(country, "Use local ride-hailing apps (Uber/Grab/local equivalents). Public transit is usually the best value.")


def _weather_tip(concern: str) -> str:
    if "rain" in concern:
        return "Carry a compact umbrella. Waterproof your bag. Wear quick-dry clothing."
    if "heat" in concern or "hot" in concern:
        return "Start outdoor activities before 10am and after 4pm. Stay well hydrated."
    if "cold" in concern or "snow" in concern:
        return "Layer up: thermal base + insulating mid-layer + windproof outer shell."
    if "storm" in concern or "wind" in concern:
        return "Monitor local weather apps. Avoid exposed outdoor areas until conditions improve."
    return "Stay flexible and check local news for real-time weather updates."
