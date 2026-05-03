import httpx
from fastapi import APIRouter, Query
from app.core.config import get_settings

router = APIRouter()

settings = get_settings()

OWM_API_KEY = settings.OPENWEATHER_API_KEY or ""
OPENTRIPMAP_KEY = settings.OPENTRIPMAP_API_KEY or ""


@router.get("/weather/{city}")
async def get_weather(city: str):
    """Get current weather for a city"""
    if not OWM_API_KEY:
        return {
            "success": False,
            "error": "Weather API key not configured",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": OWM_API_KEY, "units": "metric"},
            )

            if not r.is_success:
                return {
                    "success": False,
                    "error": "City not found or weather unavailable",
                }

            d = r.json()
            return {
                "success": True,
                "data": {
                    "city": d["name"],
                    "country": d["sys"]["country"],
                    "temp": round(d["main"]["temp"]),
                    "feels_like": round(d["main"]["feels_like"]),
                    "humidity": d["main"]["humidity"],
                    "description": d["weather"][0]["description"].title(),
                    "icon": d["weather"][0]["icon"],
                    "wind_speed": d["wind"]["speed"],
                    "visibility": d.get("visibility", 0) // 1000,
                },
            }
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Weather service timeout",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/forecast/{city}")
async def get_forecast(city: str):
    """Get 5-day weather forecast for a city"""
    if not OWM_API_KEY:
        return {
            "success": False,
            "error": "Weather API key not configured",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"q": city, "appid": OWM_API_KEY, "units": "metric"},
            )

            if not r.is_success:
                return {
                    "success": False,
                    "error": "City not found or forecast unavailable",
                }

            d = r.json()
            forecast_list = []
            for item in d["list"][::8]:  # Every 24 hours
                forecast_list.append({
                    "date": item["dt_txt"],
                    "temp": round(item["main"]["temp"]),
                    "description": item["weather"][0]["description"].title(),
                    "icon": item["weather"][0]["icon"],
                })

            return {
                "success": True,
                "data": {
                    "city": d["city"]["name"],
                    "country": d["city"]["country"],
                    "forecast": forecast_list,
                },
            }
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Forecast service timeout",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/hotels/{city}")
async def get_hotels(city: str, limit: int = Query(10, ge=1, le=50)):
    """Get hotels in a city"""
    if not OPENTRIPMAP_KEY:
        return {
            "success": False,
            "error": "OpenTripMap API key not configured",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # First, get city coordinates
            geoapi_r = await client.get(
                "https://api.opentripmap.com/0.3/en/places/geoname",
                params={"name": city, "apikey": OPENTRIPMAP_KEY},
            )

            if not geoapi_r.is_success:
                return {
                    "success": False,
                    "error": "City not found",
                }

            geo_data = geoapi_r.json()
            lat, lon = geo_data.get("lat"), geo_data.get("lon")

            if not lat or not lon:
                return {
                    "success": False,
                    "error": "Could not find city coordinates",
                }

            # Get nearby hotels
            r = await client.get(
                "https://api.opentripmap.com/0.3/en/places/nearby",
                params={
                    "lat": lat,
                    "lon": lon,
                    "radius": 5000,
                    "kinds": "accomodations",
                    "limit": limit,
                    "apikey": OPENTRIPMAP_KEY,
                },
            )

            if not r.is_success:
                return {
                    "success": False,
                    "error": "Could not fetch hotels",
                }

            return {
                "success": True,
                "data": r.json(),
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/places/{city}")
async def get_places(
    city: str,
    kinds: str = Query("museums,interesting_places,parks", description="Comma-separated place kinds"),
    limit: int = Query(20, ge=1, le=100),
):
    """Get interesting places in a city"""
    if not OPENTRIPMAP_KEY:
        return {
            "success": False,
            "error": "OpenTripMap API key not configured",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # First, get city coordinates
            geoapi_r = await client.get(
                "https://api.opentripmap.com/0.3/en/places/geoname",
                params={"name": city, "apikey": OPENTRIPMAP_KEY},
            )

            if not geoapi_r.is_success:
                return {
                    "success": False,
                    "error": "City not found",
                }

            geo_data = geoapi_r.json()
            lat, lon = geo_data.get("lat"), geo_data.get("lon")

            if not lat or not lon:
                return {
                    "success": False,
                    "error": "Could not find city coordinates",
                }

            # Get nearby places
            r = await client.get(
                "https://api.opentripmap.com/0.3/en/places/nearby",
                params={
                    "lat": lat,
                    "lon": lon,
                    "radius": 10000,
                    "kinds": kinds,
                    "limit": limit,
                    "apikey": OPENTRIPMAP_KEY,
                },
            )

            if not r.is_success:
                return {
                    "success": False,
                    "error": "Could not fetch places",
                }

            return {
                "success": True,
                "data": r.json(),
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/exchange-rates")
async def get_exchange_rates():
    """Get exchange rates for major currencies"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://open.er-api.com/v6/latest/PKR",
            )

            if not r.is_success:
                return {
                    "success": False,
                    "error": "Could not fetch exchange rates",
                }

            data = r.json()
            rates = data.get("rates", {})

            # Extract relevant currencies
            relevant_rates = {
                "PKR": 1.0,
                "USD": rates.get("USD", 1),
                "EUR": rates.get("EUR", 1),
                "GBP": rates.get("GBP", 1),
                "AED": rates.get("AED", 1),
                "SAR": rates.get("SAR", 1),
                "CAD": rates.get("CAD", 1),
                "AUD": rates.get("AUD", 1),
                "INR": rates.get("INR", 1),
                "TRY": rates.get("TRY", 1),
            }

            return {
                "success": True,
                "data": relevant_rates,
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
