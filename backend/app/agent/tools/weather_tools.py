"""Weather tools — real OpenWeatherMap API with graceful fallback."""

import os
import httpx
from datetime import datetime, timedelta


OWM_BASE = "https://api.openweathermap.org/data/2.5"

SEASONAL_WEATHER = {
    ("Dec", "Jan", "Feb"): {"description": "cool and dry", "temp_range": "10–22°C", "rain_chance": "low"},
    ("Mar", "Apr", "May"): {"description": "warm and pleasant", "temp_range": "20–32°C", "rain_chance": "low-medium"},
    ("Jun", "Jul", "Aug"): {"description": "hot and humid", "temp_range": "30–42°C", "rain_chance": "high (monsoon)"},
    ("Sep", "Oct", "Nov"): {"description": "mild and clear", "temp_range": "18–28°C", "rain_chance": "low"},
}


def _get_api_key() -> str:
    return os.getenv("OPENWEATHER_API_KEY", "")


def get_weather_forecast(city: str, days: int = 5) -> dict:
    """
    Fetch real-time weather forecast for a city using OpenWeatherMap.

    Args:
        city: City name (e.g., "Lahore", "Dubai", "Istanbul")
        days: Number of forecast days (1–5, free tier limit)

    Returns:
        dict with daily forecasts, temperature ranges, and travel advisories.
    """
    days = min(max(days, 1), 5)
    api_key = _get_api_key()

    if not api_key or api_key == "your_openweathermap_key_here":
        return _seasonal_fallback(city, days)

    try:
        resp = httpx.get(
            f"{OWM_BASE}/forecast",
            params={"q": city, "appid": api_key, "units": "metric", "cnt": days * 8},
            timeout=10,
        )
        resp.raise_for_status()
        return _parse_owm_forecast(resp.json(), days)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"status": "error", "message": f"City '{city}' not found. Try a major nearby city."}
        return _seasonal_fallback(city, days)
    except Exception:
        return _seasonal_fallback(city, days)


def check_weather_for_travel(city: str, travel_month: str) -> dict:
    """
    Check if a month is good for visiting a city and flag any concerns.

    Args:
        city: Destination city name
        travel_month: Month name (e.g., "June", "December")

    Returns:
        dict with suitability rating, concerns, and recommendation.
    """
    from app.agent.data.destinations import DESTINATIONS

    dest = next(
        (d for name, d in DESTINATIONS.items() if name.lower() == city.lower()),
        None,
    )

    month_abbr = travel_month[:3].capitalize()
    suitability = "good"
    concerns = []
    recommendation = ""

    if dest:
        if month_abbr in dest.get("avoid_months", []):
            suitability = "poor"
            concerns.append(f"{travel_month} is typically unfavorable for {city} (extreme weather).")
            recommendation = f"Consider visiting in {', '.join(dest['best_months'][:3])} instead."
        elif month_abbr in dest.get("best_months", []):
            suitability = "excellent"
            recommendation = f"{travel_month} is one of the best times to visit {city}!"
        else:
            suitability = "fair"
            recommendation = f"{travel_month} is acceptable. Peak season: {', '.join(dest['best_months'][:3])}."

    return {
        "status": "success",
        "city": city,
        "travel_month": travel_month,
        "suitability": suitability,
        "concerns": concerns,
        "recommendation": recommendation,
        "current_forecast": get_weather_forecast(city, days=3),
    }


def _parse_owm_forecast(data: dict, days: int) -> dict:
    from collections import defaultdict

    daily: dict = defaultdict(list)
    for item in data.get("list", []):
        date = item["dt_txt"].split(" ")[0]
        daily[date].append(item)

    summaries = []
    for date, items in list(daily.items())[:days]:
        temps = [i["main"]["temp"] for i in items]
        descs = [i["weather"][0]["description"] for i in items]
        rain_chance = sum(1 for i in items if i.get("pop", 0) > 0.4) / len(items) * 100

        summaries.append({
            "date": date,
            "temp_min": round(min(temps), 1),
            "temp_max": round(max(temps), 1),
            "conditions": max(set(descs), key=descs.count),
            "rain_probability": f"{round(rain_chance)}%",
            "advisory": _weather_advisory(min(temps), max(temps), rain_chance, descs),
        })

    return {
        "status": "success",
        "source": "OpenWeatherMap (live)",
        "city": data.get("city", {}).get("name", ""),
        "country": data.get("city", {}).get("country", ""),
        "forecast": summaries,
    }


def _seasonal_fallback(city: str, days: int) -> dict:
    month = datetime.now().strftime("%b")
    for months, info in SEASONAL_WEATHER.items():
        if month in months:
            season = info
            break
    else:
        season = {"description": "variable", "temp_range": "15–30°C", "rain_chance": "medium"}

    return {
        "status": "estimated",
        "source": "seasonal averages (no live API key)",
        "city": city,
        "season": season["description"],
        "typical_temp_range": season["temp_range"],
        "rain_chance": season["rain_chance"],
        "note": "Add OPENWEATHER_API_KEY to .env for real-time forecasts.",
        "forecast": [
            {
                "date": (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d"),
                "conditions": season["description"],
                "temp_range": season["temp_range"],
            }
            for i in range(days)
        ],
    }


def _weather_advisory(t_min: float, t_max: float, rain_pct: float, conditions: list) -> str:
    advisories = []
    if t_max > 38:
        advisories.append("Extreme heat — stay hydrated, avoid midday outdoor activities.")
    elif t_max > 32:
        advisories.append("Hot weather — light clothing, sunscreen recommended.")
    if t_min < 5:
        advisories.append("Very cold nights — pack warm layers.")
    if rain_pct > 60:
        advisories.append("High rain probability — carry umbrella/raincoat.")
    if any("storm" in c or "thunder" in c for c in conditions):
        advisories.append("Thunderstorms possible — check before outdoor plans.")
    return " ".join(advisories) if advisories else "Pleasant conditions for travel."
