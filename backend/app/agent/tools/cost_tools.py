"""
Cost calculation tools for the ADK cost_agent.

The cost_agent uses google_search to find real, current prices for any destination.
These helpers perform arithmetic once the agent has the raw numbers from search.
"""

# Exchange rates for generic budget recommendations (PKR base)
_PKR_RATES: dict[str, float] = {
    "PKR": 1, "USD": 278, "EUR": 300, "GBP": 355,
    "AED": 76, "SAR": 74, "CAD": 205, "AUD": 182,
    "INR": 3.3, "TRY": 8.5,
}


def calculate_trip_costs(
    destination: str,
    flight_cost_round_trip_per_person: float,
    accommodation_per_night: float,
    meals_per_day_per_person: float,
    activities_per_day_per_person: float,
    transport_per_day_per_person: float,
    duration_days: int,
    travelers: int = 1,
    currency: str = "USD",
) -> dict:
    """
    Calculate total trip cost from individual component costs found via google_search.

    Call this AFTER using google_search to find real current prices for the destination.

    Args:
        destination: Destination name (e.g., "Tokyo", "Paris", "Lahore")
        flight_cost_round_trip_per_person: Round-trip flight cost per person
        accommodation_per_night: Hotel/hostel total cost per night (shared by group)
        meals_per_day_per_person: Daily food cost per person
        activities_per_day_per_person: Daily attractions/entry fees per person
        transport_per_day_per_person: Daily local transport cost per person
        duration_days: Trip length in days
        travelers: Number of travelers
        currency: Currency of all input values (must be consistent)

    Returns:
        dict with complete cost breakdown, grand total, and daily average.
    """
    flights_total = round(flight_cost_round_trip_per_person * travelers)
    accommodation_total = round(accommodation_per_night * duration_days)
    meals_total = round(meals_per_day_per_person * travelers * duration_days)
    activities_total = round(activities_per_day_per_person * travelers * duration_days)
    transport_total = round(transport_per_day_per_person * travelers * duration_days)

    grand_total = flights_total + accommodation_total + meals_total + activities_total + transport_total
    daily_stay_cost = accommodation_per_night + (meals_per_day_per_person + activities_per_day_per_person + transport_per_day_per_person) * travelers
    daily_avg_per_person = round(daily_stay_cost / max(travelers, 1))

    return {
        "status": "success",
        "destination": destination,
        "duration_days": duration_days,
        "travelers": travelers,
        "currency": currency,
        "breakdown": {
            "flights_round_trip": flights_total,
            "accommodation": accommodation_total,
            "meals": meals_total,
            "activities": activities_total,
            "local_transport": transport_total,
        },
        "grand_total": grand_total,
        "daily_average_per_person": daily_avg_per_person,
        "note": "Calculated from real-time web search data.",
    }


def get_budget_recommendation(
    interests: str,
    duration_days: int,
    currency: str = "PKR",
) -> dict:
    """
    Provide rough global budget tier guidance as a starting point for planning.
    Use google_search for destination-specific costs after reviewing these tiers.

    Args:
        interests: Comma-separated interests (adventure, culture, food, beach, etc.)
        duration_days: Trip length in days
        currency: Output currency code

    Returns:
        dict with four budget tiers and what each typically covers.
    """
    currency = currency.upper()
    rate = _PKR_RATES.get(currency, 1.0)

    def from_pkr(amount: float) -> float:
        return round(amount / rate) if currency != "PKR" else round(amount)

    return {
        "status": "success",
        "note": "Rough global estimates only. Use google_search for destination-specific costs.",
        "interests": interests,
        "duration_days": duration_days,
        "currency": currency,
        "budget_tiers": {
            "backpacker": {
                "amount": from_pkr(4_500 * duration_days + 15_000),
                "covers": "Hostels, street food, public transport, free attractions",
            },
            "comfortable": {
                "amount": from_pkr(10_000 * duration_days + 30_000),
                "covers": "Budget hotels, local restaurants, key attractions",
            },
            "mid_range": {
                "amount": from_pkr(20_000 * duration_days + 50_000),
                "covers": "3-star hotels, varied dining, guided tours",
            },
            "luxury": {
                "amount": from_pkr(50_000 * duration_days + 120_000),
                "covers": "4–5 star hotels, fine dining, premium experiences",
            },
        },
    }
