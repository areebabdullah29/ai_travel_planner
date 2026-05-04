"""
Destination database with pricing, activities, and metadata.
All costs are in PKR per person per day (historical averages).
"""

from typing import TypedDict

# PKR exchange reference (approximate, as of mid-2025)
PKR_EXCHANGE = {
    "PKR": 1,
    "USD": 278,
    "EUR": 300,
    "GBP": 355,
    "AED": 76,
    "SAR": 74,
    "CAD": 205,
    "AUD": 182,
    "INR": 3.3,
    "TRY": 8.5,
}

DESTINATIONS = {
    # ─── LOCAL PAKISTAN (very budget-friendly) ─────────────────────────────
    "Lahore": {
        "country": "Pakistan",
        "region": "local",
        "tier": "budget",
        "interests": ["culture", "history", "food", "architecture"],
        "best_months": ["Oct", "Nov", "Dec", "Feb", "Mar"],
        "avoid_months": ["Jun", "Jul", "Aug"],  # extreme heat
        "costs_pkr": {
            "budget": {"accommodation": 2500, "meals": 1200, "activities": 500, "local_transport": 300},
            "mid_range": {"accommodation": 6000, "meals": 2500, "activities": 1200, "local_transport": 600},
            "luxury": {"accommodation": 18000, "meals": 5000, "activities": 3000, "local_transport": 2000},
        },
        "flight_from_karachi_pkr": 12000,
        "highlights": ["Badshahi Mosque", "Lahore Fort", "Food Street", "Wagah Border", "Shalimar Gardens"],
        "restaurants": [
            {"name": "Cuckoo's Den", "cuisine": "Pakistani", "price_tier": "mid-range"},
            {"name": "Haveli Restaurant", "cuisine": "Mughlai", "price_tier": "mid-range"},
            {"name": "Bundu Khan", "cuisine": "BBQ/Pakistani", "price_tier": "budget"},
            {"name": "Cafe Nescafe", "cuisine": "Cafe", "price_tier": "budget"},
        ],
        "description": "Cultural capital of Pakistan, rich in Mughal history, food, and architecture.",
        "min_budget_pkr_per_day": 4500,
        "min_trip_budget_pkr": 20000,
    },
    "Islamabad": {
        "country": "Pakistan",
        "region": "local",
        "tier": "budget",
        "interests": ["nature", "culture", "relaxation", "hiking"],
        "best_months": ["Mar", "Apr", "Oct", "Nov"],
        "avoid_months": [],
        "costs_pkr": {
            "budget": {"accommodation": 3000, "meals": 1500, "activities": 600, "local_transport": 400},
            "mid_range": {"accommodation": 8000, "meals": 3000, "activities": 1500, "local_transport": 800},
            "luxury": {"accommodation": 22000, "meals": 6000, "activities": 4000, "local_transport": 2500},
        },
        "flight_from_karachi_pkr": 15000,
        "highlights": ["Faisal Mosque", "Margalla Hills", "Lok Virsa Museum", "Daman-e-Koh", "Rawal Lake"],
        "restaurants": [
            {"name": "Monal Restaurant", "cuisine": "Pakistani/Continental", "price_tier": "mid-range"},
            {"name": "Street 1 Lahori Chargha", "cuisine": "Pakistani", "price_tier": "budget"},
            {"name": "Nando's", "cuisine": "International", "price_tier": "mid-range"},
        ],
        "description": "Pakistan's modern capital with beautiful hills, parks, and cultural sites.",
        "min_budget_pkr_per_day": 5500,
        "min_trip_budget_pkr": 25000,
    },
    "Murree": {
        "country": "Pakistan",
        "region": "local",
        "tier": "budget",
        "interests": ["nature", "relaxation", "adventure", "family"],
        "best_months": ["Mar", "Apr", "May", "Oct", "Nov"],
        "avoid_months": [],
        "costs_pkr": {
            "budget": {"accommodation": 3500, "meals": 1200, "activities": 800, "local_transport": 500},
            "mid_range": {"accommodation": 8000, "meals": 2500, "activities": 2000, "local_transport": 1000},
            "luxury": {"accommodation": 18000, "meals": 5000, "activities": 5000, "local_transport": 3000},
        },
        "flight_from_karachi_pkr": 15000,
        "highlights": ["Mall Road", "Patriata Chair Lift", "Pindi Point", "Kashmir Point", "Snow (winter)"],
        "restaurants": [
            {"name": "Cecil Hotel Restaurant", "cuisine": "Pakistani/Continental", "price_tier": "mid-range"},
            {"name": "Lintott's", "cuisine": "Bakery/Cafe", "price_tier": "budget"},
        ],
        "description": "Classic hill station near Islamabad, popular for cool weather and scenic views.",
        "min_budget_pkr_per_day": 6000,
        "min_trip_budget_pkr": 28000,
    },
    "Hunza": {
        "country": "Pakistan",
        "region": "local",
        "tier": "mid-range",
        "interests": ["adventure", "nature", "hiking", "culture", "photography"],
        "best_months": ["Apr", "May", "Jun", "Sep", "Oct"],
        "avoid_months": ["Jan", "Feb"],
        "costs_pkr": {
            "budget": {"accommodation": 4000, "meals": 1500, "activities": 1500, "local_transport": 1000},
            "mid_range": {"accommodation": 10000, "meals": 3000, "activities": 3000, "local_transport": 2000},
            "luxury": {"accommodation": 25000, "meals": 6000, "activities": 8000, "local_transport": 5000},
        },
        "flight_from_karachi_pkr": 28000,
        "highlights": ["Rakaposhi View", "Attabad Lake", "Baltit Fort", "Eagle's Nest", "Altit Fort"],
        "restaurants": [
            {"name": "Café de Hunza", "cuisine": "Local/Pakistani", "price_tier": "budget"},
            {"name": "Serenity Hotel Restaurant", "cuisine": "Pakistani/Chinese", "price_tier": "mid-range"},
        ],
        "description": "Breathtaking mountain valley in Gilgit-Baltistan, famous for Karakorum views.",
        "min_budget_pkr_per_day": 8000,
        "min_trip_budget_pkr": 55000,
    },
    "Swat Valley": {
        "country": "Pakistan",
        "region": "local",
        "tier": "budget",
        "interests": ["adventure", "nature", "relaxation", "hiking"],
        "best_months": ["Apr", "May", "Jun", "Sep", "Oct"],
        "avoid_months": ["Dec", "Jan", "Feb"],
        "costs_pkr": {
            "budget": {"accommodation": 3000, "meals": 1200, "activities": 1000, "local_transport": 800},
            "mid_range": {"accommodation": 7000, "meals": 2500, "activities": 2500, "local_transport": 1500},
            "luxury": {"accommodation": 18000, "meals": 5000, "activities": 6000, "local_transport": 4000},
        },
        "flight_from_karachi_pkr": 20000,
        "highlights": ["Malam Jabba Ski Resort", "Fizaghat Park", "Mingora Bazaar", "Marghuzar"],
        "restaurants": [
            {"name": "Rock City Restaurant", "cuisine": "Pakistani", "price_tier": "budget"},
            {"name": "Hotel Pameer Restaurant", "cuisine": "Pakistani/Chinese", "price_tier": "mid-range"},
        ],
        "description": "The Switzerland of Pakistan – lush green valleys, rivers, and ski resorts.",
        "min_budget_pkr_per_day": 6000,
        "min_trip_budget_pkr": 30000,
    },
    "Karachi": {
        "country": "Pakistan",
        "region": "local",
        "tier": "budget",
        "interests": ["culture", "food", "history", "beach"],
        "best_months": ["Nov", "Dec", "Jan", "Feb", "Mar"],
        "avoid_months": ["Jun", "Jul", "Aug"],
        "costs_pkr": {
            "budget": {"accommodation": 2500, "meals": 1200, "activities": 400, "local_transport": 400},
            "mid_range": {"accommodation": 7000, "meals": 2500, "activities": 1200, "local_transport": 800},
            "luxury": {"accommodation": 20000, "meals": 6000, "activities": 3000, "local_transport": 2500},
        },
        "flight_from_karachi_pkr": 0,
        "highlights": ["Clifton Beach", "Quaid's Mausoleum", "Port Grand", "Mohatta Palace", "Burns Road Food Street"],
        "restaurants": [
            {"name": "Bar.B.Q Tonight", "cuisine": "BBQ/Pakistani", "price_tier": "mid-range"},
            {"name": "Waheed Kabab House", "cuisine": "Pakistani", "price_tier": "budget"},
            {"name": "Xinhua Restaurant", "cuisine": "Chinese", "price_tier": "mid-range"},
        ],
        "description": "Pakistan's economic hub and largest city with vibrant food scene and beaches.",
        "min_budget_pkr_per_day": 4500,
        "min_trip_budget_pkr": 15000,
    },

    # ─── REGIONAL / MID-BUDGET ────────────────────────────────────────────
    "Dubai": {
        "country": "UAE",
        "region": "regional",
        "tier": "mid-range",
        "interests": ["luxury", "shopping", "adventure", "culture", "beach"],
        "best_months": ["Nov", "Dec", "Jan", "Feb", "Mar"],
        "avoid_months": ["Jun", "Jul", "Aug"],
        "costs_pkr": {
            "budget": {"accommodation": 18000, "meals": 8000, "activities": 5000, "local_transport": 3000},
            "mid_range": {"accommodation": 40000, "meals": 15000, "activities": 12000, "local_transport": 5000},
            "luxury": {"accommodation": 120000, "meals": 35000, "activities": 40000, "local_transport": 15000},
        },
        "flight_from_karachi_pkr": 35000,
        "highlights": ["Burj Khalifa", "Dubai Mall", "Desert Safari", "Palm Jumeirah", "Gold Souk"],
        "restaurants": [
            {"name": "At.mosphere (Burj Khalifa)", "cuisine": "International", "price_tier": "luxury"},
            {"name": "Ravi Restaurant", "cuisine": "Pakistani/Indian", "price_tier": "budget"},
            {"name": "Zaroob", "cuisine": "Lebanese Street Food", "price_tier": "mid-range"},
        ],
        "description": "Ultra-modern Gulf city blending luxury, adventure, and cultural experiences.",
        "min_budget_pkr_per_day": 34000,
        "min_trip_budget_pkr": 185000,
    },
    "Istanbul": {
        "country": "Turkey",
        "region": "regional",
        "tier": "mid-range",
        "interests": ["culture", "history", "food", "architecture", "shopping"],
        "best_months": ["Apr", "May", "Sep", "Oct"],
        "avoid_months": [],
        "costs_pkr": {
            "budget": {"accommodation": 12000, "meals": 5000, "activities": 4000, "local_transport": 2000},
            "mid_range": {"accommodation": 28000, "meals": 12000, "activities": 10000, "local_transport": 4000},
            "luxury": {"accommodation": 80000, "meals": 30000, "activities": 25000, "local_transport": 12000},
        },
        "flight_from_karachi_pkr": 55000,
        "highlights": ["Hagia Sophia", "Blue Mosque", "Grand Bazaar", "Topkapi Palace", "Bosphorus Cruise"],
        "restaurants": [
            {"name": "Nusr-Et Steakhouse", "cuisine": "Turkish/Steakhouse", "price_tier": "luxury"},
            {"name": "Karaköy Güllüoğlu", "cuisine": "Turkish/Baklava", "price_tier": "budget"},
            {"name": "Tarihi Sultanahmet Köftecisi", "cuisine": "Turkish", "price_tier": "budget"},
        ],
        "description": "Where East meets West — stunning mosques, bazaars, and Bosphorus views.",
        "min_budget_pkr_per_day": 23000,
        "min_trip_budget_pkr": 145000,
    },
    "Malaysia (Kuala Lumpur)": {
        "country": "Malaysia",
        "region": "regional",
        "tier": "budget",
        "interests": ["culture", "food", "nature", "shopping", "family"],
        "best_months": ["Mar", "Apr", "May", "Jun"],
        "avoid_months": [],
        "costs_pkr": {
            "budget": {"accommodation": 8000, "meals": 4000, "activities": 3000, "local_transport": 1500},
            "mid_range": {"accommodation": 20000, "meals": 8000, "activities": 8000, "local_transport": 3000},
            "luxury": {"accommodation": 60000, "meals": 20000, "activities": 20000, "local_transport": 8000},
        },
        "flight_from_karachi_pkr": 40000,
        "highlights": ["Petronas Towers", "Batu Caves", "KL Bird Park", "Bukit Bintang", "Langkawi Island"],
        "restaurants": [
            {"name": "Jalan Alor Food Street", "cuisine": "Malaysian/Street Food", "price_tier": "budget"},
            {"name": "Atmosphere 360", "cuisine": "International", "price_tier": "luxury"},
            {"name": "Din Tai Fung", "cuisine": "Chinese", "price_tier": "mid-range"},
        ],
        "description": "Diverse Southeast Asian gem with iconic skyline, jungle, and street food.",
        "min_budget_pkr_per_day": 16500,
        "min_trip_budget_pkr": 105000,
    },

    # ─── INTERNATIONAL / HIGH-BUDGET ──────────────────────────────────────
    "Paris": {
        "country": "France",
        "region": "international",
        "tier": "luxury",
        "interests": ["romance", "culture", "art", "food", "architecture"],
        "best_months": ["Apr", "May", "Jun", "Sep", "Oct"],
        "avoid_months": ["Aug"],
        "costs_pkr": {
            "budget": {"accommodation": 30000, "meals": 12000, "activities": 8000, "local_transport": 3000},
            "mid_range": {"accommodation": 70000, "meals": 25000, "activities": 20000, "local_transport": 6000},
            "luxury": {"accommodation": 200000, "meals": 60000, "activities": 60000, "local_transport": 20000},
        },
        "flight_from_karachi_pkr": 120000,
        "highlights": ["Eiffel Tower", "Louvre Museum", "Notre-Dame", "Champs-Élysées", "Versailles"],
        "restaurants": [
            {"name": "Le Jules Verne (Eiffel Tower)", "cuisine": "French Fine Dining", "price_tier": "luxury"},
            {"name": "Bouillon Chartier", "cuisine": "Traditional French", "price_tier": "budget"},
            {"name": "L'As du Fallafel", "cuisine": "Middle Eastern", "price_tier": "budget"},
        ],
        "description": "City of Light — iconic landmarks, world-class art, cuisine, and romance.",
        "min_budget_pkr_per_day": 53000,
        "min_trip_budget_pkr": 385000,
    },
    "Bangkok": {
        "country": "Thailand",
        "region": "international",
        "tier": "budget",
        "interests": ["culture", "food", "adventure", "nightlife", "temples"],
        "best_months": ["Nov", "Dec", "Jan", "Feb", "Mar"],
        "avoid_months": ["Apr", "May"],
        "costs_pkr": {
            "budget": {"accommodation": 6000, "meals": 3000, "activities": 2500, "local_transport": 1200},
            "mid_range": {"accommodation": 16000, "meals": 7000, "activities": 7000, "local_transport": 2500},
            "luxury": {"accommodation": 50000, "meals": 18000, "activities": 20000, "local_transport": 8000},
        },
        "flight_from_karachi_pkr": 42000,
        "highlights": ["Grand Palace", "Wat Pho", "Chatuchak Market", "Floating Markets", "Chao Phraya River"],
        "restaurants": [
            {"name": "Jay Fai", "cuisine": "Thai Street Food (Michelin)", "price_tier": "mid-range"},
            {"name": "Yaowarat Road (Chinatown)", "cuisine": "Chinese/Thai", "price_tier": "budget"},
            {"name": "Nahm Restaurant", "cuisine": "Thai Fine Dining", "price_tier": "luxury"},
        ],
        "description": "Vibrant Thai capital with stunning temples, street food, and lively markets.",
        "min_budget_pkr_per_day": 12700,
        "min_trip_budget_pkr": 85000,
    },
}

# Minimum viable budgets (PKR) — below these, trip is not feasible
ABSOLUTE_MIN_BUDGETS_PKR = {
    "1_day": 5000,      # Day trip within city
    "2_days": 12000,
    "3_days": 18000,
    "5_days": 30000,
    "7_days": 45000,
    "10_days": 65000,
    "14_days": 95000,
}

INTEREST_CATEGORIES = [
    "adventure", "relaxation", "culture", "history",
    "food", "nature", "shopping", "romance", "family",
    "hiking", "beach", "luxury", "photography", "architecture",
]


def convert_from_pkr(amount_pkr: float, currency: str) -> float:
    """Convert PKR amount to target currency."""
    rate = PKR_EXCHANGE.get(currency.upper(), 1)
    return round(amount_pkr / rate, 2)


def convert_to_pkr(amount: float, currency: str) -> float:
    """Convert amount from given currency to PKR."""
    rate = PKR_EXCHANGE.get(currency.upper(), 1)
    return round(amount * rate, 2)


def get_accommodation_tier(budget_pkr_per_day: float) -> str:
    """Determine accommodation tier based on daily budget."""
    if budget_pkr_per_day < 8000:
        return "budget"
    elif budget_pkr_per_day < 25000:
        return "mid_range"
    else:
        return "luxury"
