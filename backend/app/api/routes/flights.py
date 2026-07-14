"""
Flight search via Sky Scrapper API (RapidAPI) — real Skyscanner data.
Falls back to mock data when RAPIDAPI_KEY is not configured.

Sign up free at https://rapidapi.com → search "Sky Scrapper" → subscribe Basic (free).
Add RAPIDAPI_KEY=your_key to backend/.env
"""
import random
import logging
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from typing import Optional

from app.core.config import get_settings

log    = logging.getLogger(__name__)
router = APIRouter()

RAPIDAPI_HOST = "sky-scrapper.p.rapidapi.com"

# ── currency conversion rates (relative to PKR) ──────────────────────────
CURRENCY_RATES: dict[str, float] = {
    "PKR": 1.0,    "USD": 0.0036, "EUR": 0.0033,
    "GBP": 0.0028, "AED": 0.013,  "SAR": 0.013,
    "CAD": 0.0049, "AUD": 0.0055, "INR": 0.30,
    "TRY": 0.12,
}

# ── Sky Scrapper currency codes (ISO 4217) ────────────────────────────────
SS_CURRENCY_MAP: dict[str, str] = {
    "PKR": "PKR", "USD": "USD", "EUR": "EUR", "GBP": "GBP",
    "AED": "AED", "SAR": "SAR", "CAD": "CAD", "AUD": "AUD",
    "INR": "INR", "TRY": "TRY",
}

# ── mock data (fallback when no API key) ─────────────────────────────────
AIRLINES_MOCK = [
    {"code": "EK", "name": "Emirates",           "hub": "DXB"},
    {"code": "QR", "name": "Qatar Airways",       "hub": "DOH"},
    {"code": "EY", "name": "Etihad Airways",      "hub": "AUH"},
    {"code": "TK", "name": "Turkish Airlines",    "hub": "IST"},
    {"code": "PK", "name": "Pakistan International", "hub": "KHI"},
    {"code": "G9", "name": "Air Arabia",          "hub": "SHJ"},
    {"code": "FZ", "name": "flydubai",            "hub": "DXB"},
    {"code": "SQ", "name": "Singapore Airlines",  "hub": "SIN"},
    {"code": "MH", "name": "Malaysia Airlines",   "hub": "KUL"},
    {"code": "WY", "name": "Oman Air",            "hub": "MCT"},
]

# Extensive city → IATA lookup for common destinations
CITY_IATA: dict[str, str] = {
    # Pakistan
    "lahore": "LHE", "karachi": "KHI", "islamabad": "ISB",
    "peshawar": "PEW", "quetta": "UET", "multan": "MUX",
    # Middle East
    "dubai": "DXB", "abu dhabi": "AUH", "doha": "DOH",
    "riyadh": "RUH", "jeddah": "JED", "muscat": "MCT",
    "sharjah": "SHJ", "kuwait city": "KWI", "kuwait": "KWI",
    "bahrain": "BAH", "amman": "AMM", "beirut": "BEY",
    # Southeast Asia
    "singapore": "SIN", "kuala lumpur": "KUL", "bangkok": "BKK",
    "bali": "DPS", "denpasar": "DPS", "jakarta": "CGK",
    "manila": "MNL", "ho chi minh city": "SGN", "hanoi": "HAN",
    "phuket": "HKT", "colombo": "CMB",
    # East Asia
    "tokyo": "NRT", "osaka": "KIX", "seoul": "ICN",
    "beijing": "PEK", "shanghai": "PVG", "hong kong": "HKG",
    "taipei": "TPE",
    # Europe
    "london": "LHR", "paris": "CDG", "amsterdam": "AMS",
    "frankfurt": "FRA", "istanbul": "IST", "barcelona": "BCN",
    "madrid": "MAD", "rome": "FCO", "milan": "MXP",
    "vienna": "VIE", "zurich": "ZRH", "brussels": "BRU",
    "munich": "MUC", "athens": "ATH", "lisbon": "LIS",
    "dublin": "DUB", "copenhagen": "CPH", "stockholm": "ARN",
    "oslo": "OSL", "helsinki": "HEL", "warsaw": "WAW",
    "prague": "PRG", "budapest": "BUD", "bucharest": "OTP",
    # Greek Islands & destinations
    "santorini": "JTR", "thira": "JTR", "mykonos": "JMK",
    "corfu": "CFU", "rhodes": "RHO", "heraklion": "HER",
    "crete": "HER", "kos": "KGS", "zakynthos": "ZTH",
    "skiathos": "JSI", "thessaloniki": "SKG",
    # Mediterranean
    "valletta": "MLA", "malta": "MLA", "nicosia": "LCA",
    "larnaca": "LCA",
    # Turkey
    "antalya": "AYT", "bodrum": "BJV", "izmir": "ADB",
    "ankara": "ESB", "dalaman": "DLM",
    # Africa
    "cairo": "CAI", "nairobi": "NBO", "johannesburg": "JNB",
    "cape town": "CPT", "lagos": "LOS", "casablanca": "CMN",
    "addis ababa": "ADD", "dar es salaam": "DAR",
    # Americas
    "new york": "JFK", "los angeles": "LAX", "toronto": "YYZ",
    "chicago": "ORD", "miami": "MIA", "houston": "IAH",
    "vancouver": "YVR", "montreal": "YUL", "mexico city": "MEX",
    "cancun": "CUN", "sao paulo": "GRU", "buenos aires": "EZE",
    # Australia / NZ
    "sydney": "SYD", "melbourne": "MEL", "brisbane": "BNE",
    "perth": "PER", "auckland": "AKL",
    # Central Asia
    "tashkent": "TAS", "almaty": "ALA", "baku": "GYD",
    "tbilisi": "TBS", "yerevan": "EVN",
    # South Asia
    "delhi": "DEL", "new delhi": "DEL", "mumbai": "BOM",
    "dhaka": "DAC", "kathmandu": "KTM", "colombo": "CMB",
}

BASE_PRICES_PKR: dict[str, int] = {
    # Middle East
    "DXB": 45000,  "DOH": 55000,  "AUH": 50000,
    "RUH": 65000,  "JED": 70000,  "MCT": 50000,
    "SHJ": 42000,  "KWI": 60000,  "BAH": 58000,
    # Europe
    "LHR": 200000, "CDG": 210000, "AMS": 205000, "FRA": 195000,
    "IST": 120000, "BCN": 210000, "MAD": 205000, "FCO": 215000,
    "MXP": 200000, "VIE": 195000, "ZRH": 220000, "BRU": 200000,
    "MUC": 195000, "ATH": 185000, "LIS": 200000, "DUB": 195000,
    # Greek Islands
    "JTR": 220000, "JMK": 215000, "CFU": 195000, "RHO": 190000,
    "HER": 185000, "KGS": 185000, "ZTH": 190000, "SKG": 180000,
    # Southeast Asia
    "SIN": 130000, "KUL": 110000, "BKK": 120000,
    "DPS": 155000, "CGK": 145000, "MNL": 140000,
    "SGN": 140000, "HAN": 145000, "HKT": 130000,
    # East Asia
    "NRT": 240000, "KIX": 235000, "ICN": 220000,
    "PEK": 230000, "PVG": 230000, "HKG": 210000,
    # Americas
    "JFK": 280000, "LAX": 300000, "YYZ": 270000,
    "ORD": 285000, "MIA": 290000,
    # Australia
    "SYD": 320000, "MEL": 315000, "BNE": 310000,
    # South Asia
    "DEL": 25000,  "BOM": 28000,  "DAC": 30000,
}

DURATIONS: dict[str, float] = {
    "DXB": 2.5, "DOH": 3.0, "AUH": 3.0, "IST": 6.5,
    "SIN": 7.5, "KUL": 7.0, "BKK": 7.5, "DPS": 9.5,
    "LHR": 9.0, "CDG": 9.5, "BCN": 9.5, "AMS": 9.0,
    "JFK": 14.5, "NRT": 11.5, "YYZ": 14.0,
    "JTR": 8.5, "JMK": 8.0, "ATH": 8.0, "RHO": 8.0,
    "FCO": 8.5, "MXP": 8.5, "VIE": 8.0, "MUC": 8.5,
    "DEL": 2.0, "BOM": 2.5,
}


# ═══════════════════════════════════════════════════════════════════════════
#  Sky Scrapper (RapidAPI) — real flight data
# ═══════════════════════════════════════════════════════════════════════════

async def _sky_search_airport(query: str, api_key: str) -> Optional[dict]:
    """Return {skyId, entityId, name} for the best match or None."""
    url = f"https://{RAPIDAPI_HOST}/api/v1/flights/searchAirport"
    headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": RAPIDAPI_HOST}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params={"query": query, "locale": "en-US"}, headers=headers)
            r.raise_for_status()
            data = r.json()
            places = data.get("data") or []
            if not places:
                return None
            best = places[0]
            return {
                "skyId":    best.get("skyId") or best.get("iataCode", ""),
                "entityId": best.get("entityId", ""),
                "name":     best.get("presentation", {}).get("title", query),
            }
    except Exception as e:
        log.warning("Airport search failed for %r: %s", query, e)
        return None


async def _sky_search_flights(
    origin: dict, dest: dict,
    date: str, adults: int, currency: str, api_key: str,
) -> Optional[list[dict]]:
    """Search flights via Sky Scrapper. Returns normalised flight list or None."""
    url = f"https://{RAPIDAPI_HOST}/api/v1/flights/searchFlights"
    headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": RAPIDAPI_HOST}
    params = {
        "originSkyId":        origin["skyId"],
        "destinationSkyId":   dest["skyId"],
        "originEntityId":     origin["entityId"],
        "destinationEntityId": dest["entityId"],
        "date":               date,        # yyyy-mm-dd
        "adults":             str(adults),
        "currency":           SS_CURRENCY_MAP.get(currency.upper(), "USD"),
        "market":             "en-US",
        "countryCode":        "US",
        "cabinClass":         "economy",
        "sortBy":             "best",
        "limit":              "10",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()

        itineraries = (
            data.get("data", {})
                .get("itineraries") or []
        )
        if not itineraries:
            return None

        flights = []
        for it in itineraries[:10]:
            legs  = it.get("legs", [])
            price = it.get("price", {}).get("raw") or 0

            if not legs:
                continue
            leg = legs[0]
            segments = leg.get("segments", [])

            dep_iso = leg.get("departure", "")
            arr_iso = leg.get("arrival", "")
            dur_min = leg.get("durationInMinutes", 0)
            stops   = leg.get("stopCount", 0)
            carriers = [
                c.get("name", "") for c in leg.get("carriers", {}).get("marketing", [])
            ] or ["Unknown Airline"]
            codes = [
                c.get("alternateId", "") for c in leg.get("carriers", {}).get("marketing", [])
            ]

            # Skyscanner deep link
            compact = date.replace("-", "")[2:]
            deep_link = (
                f"https://www.skyscanner.net/transport/flights/"
                f"{origin['skyId'].lower()}/{dest['skyId'].lower()}/{compact}/"
            )

            route = [
                {
                    "airline":      seg.get("marketingCarrier", {}).get("alternateId", ""),
                    "airline_name": seg.get("marketingCarrier", {}).get("name", ""),
                    "from":         seg.get("origin", {}).get("displayCode", ""),
                    "to":           seg.get("destination", {}).get("displayCode", ""),
                    "departure":    seg.get("departure", ""),
                    "arrival":      seg.get("arrival", ""),
                }
                for seg in segments
            ]

            flights.append({
                "id":            it.get("id", f"ss-{len(flights)}"),
                "price":         round(price),
                "currency":      currency.upper(),
                "airlines":      codes,
                "airline_names": carriers,
                "from":          leg.get("origin", {}).get("displayCode", origin["skyId"]),
                "to":            leg.get("destination", {}).get("displayCode", dest["skyId"]),
                "city_from":     origin["name"],
                "city_to":       dest["name"],
                "departure":     dep_iso,
                "arrival":       arr_iso,
                "duration_mins": dur_min,
                "stops":         stops,
                "deep_link":     deep_link,
                "route":         route,
            })

        return flights if flights else None

    except Exception as e:
        log.warning("Sky Scrapper flight search failed: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════════
#  Mock fallback
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_iata(city: str) -> str:
    key = city.lower().strip()
    # Try full name first, then first word (e.g. "Santorini, Greece" → "santorini")
    if key in CITY_IATA:
        return CITY_IATA[key]
    first_word = key.split(",")[0].strip()
    if first_word in CITY_IATA:
        return CITY_IATA[first_word]
    # Last resort: keep the raw value if it looks like an IATA code already
    if len(city.strip()) == 3 and city.strip().isalpha():
        return city.strip().upper()
    return first_word.upper()[:3]  # best-effort 3-letter code


def _skyscanner_link(from_code: str, to_code: str, date: str) -> str:
    compact = date.replace("-", "")[2:]
    return f"https://www.skyscanner.net/transport/flights/{from_code.lower()}/{to_code.lower()}/{compact}/"


def _mock_flights(
    from_iata: str, to_iata: str,
    dep_date: datetime, adults: int, curr: str, limit: int,
) -> list[dict]:
    random.seed(f"{from_iata}{to_iata}{dep_date.date()}")
    base_pkr   = BASE_PRICES_PKR.get(to_iata, 150000) * adults
    rate       = CURRENCY_RATES.get(curr.upper(), 1.0)
    dur_base   = DURATIONS.get(to_iata, 8.0)
    dep_hours  = [2, 4, 6, 8, 10, 13, 16, 19, 21, 23]
    selected   = random.sample(AIRLINES_MOCK, min(len(AIRLINES_MOCK), limit))
    date_str   = dep_date.strftime("%Y-%m-%d")

    flights = []
    for i, airline in enumerate(selected):
        hour   = dep_hours[i % len(dep_hours)]
        dep_dt = dep_date.replace(hour=hour, minute=random.choice([0, 15, 30, 45]))
        dur    = dur_base + random.uniform(-0.5, 0.5)
        arr_dt = dep_dt + timedelta(hours=dur)
        price  = round(base_pkr * random.uniform(0.85, 1.20) * rate)

        via = airline["hub"] if airline["hub"] not in (from_iata, to_iata) and random.random() < 0.6 else None
        if via:
            price = round(price * 0.85)

        stops = 1 if via else 0
        route = []
        if via:
            mid_arr = dep_dt + timedelta(hours=dur * 0.45)
            lay_dep = mid_arr + timedelta(hours=random.uniform(1.5, 3.0))
            route = [
                {"airline": airline["code"], "airline_name": airline["name"],
                 "from": from_iata, "to": via,
                 "departure": dep_dt.isoformat(), "arrival": mid_arr.isoformat()},
                {"airline": airline["code"], "airline_name": airline["name"],
                 "from": via, "to": to_iata,
                 "departure": lay_dep.isoformat(), "arrival": arr_dt.isoformat()},
            ]
        else:
            route = [{"airline": airline["code"], "airline_name": airline["name"],
                      "from": from_iata, "to": to_iata,
                      "departure": dep_dt.isoformat(), "arrival": arr_dt.isoformat()}]

        flights.append({
            "id":            f"{airline['code']}-{from_iata}-{to_iata}-{dep_dt.strftime('%H%M')}",
            "price":         price,
            "currency":      curr.upper(),
            "airlines":      [airline["code"]],
            "airline_names": [airline["name"]],
            "from":          from_iata,
            "to":            to_iata,
            "city_from":     from_iata,
            "city_to":       to_iata,
            "departure":     dep_dt.isoformat(),
            "arrival":       arr_dt.isoformat(),
            "duration_mins": int(dur * 60),
            "stops":         stops,
            "deep_link":     _skyscanner_link(from_iata, to_iata, date_str),
            "route":         route,
        })

    flights.sort(key=lambda f: f["price"])
    return flights


def _parse_date(dd_mm_yyyy: str) -> datetime:
    try:
        d, m, y = dd_mm_yyyy.split("/")
        return datetime(int(y), int(m), int(d))
    except Exception:
        return datetime.now() + timedelta(days=30)


# ═══════════════════════════════════════════════════════════════════════════
#  Endpoint
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/flights/search")
async def search_flights(
    fly_from:    str           = Query(...),
    fly_to:      str           = Query(...),
    date_from:   str           = Query(..., description="dd/mm/yyyy"),
    date_to:     str           = Query(""),
    return_from: Optional[str] = Query(None),
    return_to:   Optional[str] = Query(None),
    adults:      int           = Query(1, ge=1, le=9),
    curr:        str           = Query("PKR"),
    limit:       int           = Query(8, ge=1, le=20),
):
    settings  = get_settings()
    api_key   = settings.RAPIDAPI_KEY
    dep_date  = _parse_date(date_from)
    date_iso  = dep_date.strftime("%Y-%m-%d")
    is_mock   = False

    if api_key:
        # ── Real data via Sky Scrapper ──────────────────────────────────
        origin_info = await _sky_search_airport(fly_from, api_key)
        dest_info   = await _sky_search_airport(fly_to,   api_key)

        if origin_info and dest_info:
            flights = await _sky_search_flights(
                origin_info, dest_info, date_iso, adults, curr, api_key
            )
            if flights:
                return {
                    "success": True,
                    "data": {
                        "flights":  flights,
                        "currency": curr,
                        "from":     origin_info["skyId"],
                        "to":       dest_info["skyId"],
                        "count":    len(flights),
                        "source":   "skyscanner",
                    },
                }

        log.warning("Sky Scrapper returned no results, falling back to mock")

    # ── Mock fallback ───────────────────────────────────────────────────
    is_mock     = True
    from_iata   = _resolve_iata(fly_from)
    to_iata     = _resolve_iata(fly_to)
    flights     = _mock_flights(from_iata, to_iata, dep_date, adults, curr, limit)

    return {
        "success": True,
        "data": {
            "flights":  flights,
            "currency": curr,
            "from":     from_iata,
            "to":       to_iata,
            "count":    len(flights),
            "source":   "mock",
            "note":     "Estimated prices — add RAPIDAPI_KEY to .env for live data",
        },
    }
