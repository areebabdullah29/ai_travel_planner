"""Cost estimation and budget validation tools."""

from app.agent.data.destinations import (
    DESTINATIONS,
    ABSOLUTE_MIN_BUDGETS_PKR,
    convert_from_pkr,
    convert_to_pkr,
    get_accommodation_tier,
)


def estimate_trip_costs(
    destination: str,
    duration_days: int,
    travelers: int = 1,
    accommodation_tier: str = "mid_range",
    currency: str = "PKR",
) -> dict:
    """
    Estimate total trip costs broken down by category.

    Args:
        destination: City/destination name (e.g., "Lahore", "Dubai")
        duration_days: Length of trip in days
        travelers: Number of travelers
        accommodation_tier: "budget", "mid_range", "luxury", or "auto"
        currency: Output currency code (default PKR)

    Returns:
        dict with itemized costs and total in requested currency.
    """
    dest = _find_destination(destination)
    if not dest:
        return {
            "status": "error",
            "message": f"Destination '{destination}' not found. Try: {', '.join(list(DESTINATIONS.keys())[:5])}",
        }

    currency = currency.upper()
    tier_key = accommodation_tier if accommodation_tier in ("budget", "mid_range", "luxury") else "mid_range"
    costs = dest["costs_pkr"][tier_key]

    daily_cost_pkr = sum(costs.values())
    flight_pkr = dest.get("flight_from_karachi_pkr", 0) * travelers * 2
    total_stay_pkr = daily_cost_pkr * duration_days * travelers

    def fmt(pkr: float) -> float:
        return convert_from_pkr(pkr, currency) if currency != "PKR" else pkr

    return {
        "status": "success",
        "destination": destination,
        "duration_days": duration_days,
        "travelers": travelers,
        "accommodation_tier": tier_key,
        "currency": currency,
        "breakdown": {
            "flights_round_trip": fmt(flight_pkr),
            "accommodation": fmt(costs["accommodation"] * duration_days * travelers),
            "meals": fmt(costs["meals"] * duration_days * travelers),
            "activities": fmt(costs["activities"] * duration_days * travelers),
            "local_transport": fmt(costs["local_transport"] * duration_days * travelers),
        },
        "per_person_total": fmt((daily_cost_pkr * duration_days) + dest.get("flight_from_karachi_pkr", 0) * 2),
        "grand_total": fmt(total_stay_pkr + flight_pkr),
        "daily_average_per_person": fmt(daily_cost_pkr),
        "note": "Estimates based on historical averages. Actual costs may vary +/-20%.",
    }


def validate_budget(
    destination: str,
    duration_days: int,
    budget: float,
    currency: str = "PKR",
    travelers: int = 1,
) -> dict:
    """
    Check if the user's budget is sufficient for the trip.
    Returns a clear warning with minimum required budget if insufficient.

    Args:
        destination: Destination city name
        duration_days: Trip length in days
        budget: Total available budget
        currency: Budget currency code
        travelers: Number of travelers

    Returns:
        dict with feasibility verdict, gap analysis, and alternative suggestions.
    """
    currency = currency.upper()
    budget_pkr = convert_to_pkr(budget, currency) if currency != "PKR" else budget

    dest = _find_destination(destination)
    if not dest:
        return {"status": "error", "message": f"Destination '{destination}' not found."}

    min_daily_pkr = sum(dest["costs_pkr"]["budget"].values())
    flight_pkr = dest.get("flight_from_karachi_pkr", 0) * travelers * 2
    min_total_pkr = (min_daily_pkr * duration_days * travelers) + flight_pkr

    budget_per_day_pkr = budget_pkr / max(travelers, 1) / max(duration_days, 1)
    is_feasible = budget_pkr >= min_total_pkr
    is_tight = is_feasible and budget_pkr < min_total_pkr * 1.3
    gap_pkr = max(0, min_total_pkr - budget_pkr)

    alternatives = []
    if not is_feasible:
        alternatives = _suggest_budget_alternatives(budget_pkr, duration_days, travelers)

    def fmt(pkr: float) -> str:
        val = convert_from_pkr(pkr, currency) if currency != "PKR" else pkr
        return f"{currency} {val:,.0f}"

    return {
        "status": "success",
        "destination": destination,
        "budget": f"{currency} {budget:,.0f}",
        "required_minimum": fmt(min_total_pkr),
        "gap": fmt(gap_pkr) if gap_pkr > 0 else "None",
        "feasible": is_feasible,
        "tight": is_tight,
        "accommodation_tier_affordable": get_accommodation_tier(budget_per_day_pkr),
        "verdict": _verdict(is_feasible, is_tight, destination, fmt(min_total_pkr), fmt(gap_pkr)),
        "alternative_destinations": alternatives,
    }


def get_budget_recommendation(interests: str, duration_days: int, currency: str = "PKR") -> dict:
    """
    Suggest minimum and comfortable budgets for a trip based on interests and duration.

    Args:
        interests: Comma-separated interests
        duration_days: Trip length in days
        currency: Output currency code

    Returns:
        dict with budget tiers and what each covers.
    """
    currency = currency.upper()
    tiers = {
        "backpacker": 4500 * duration_days + 15000,
        "comfortable": 10000 * duration_days + 30000,
        "mid_range": 20000 * duration_days + 50000,
        "luxury": 50000 * duration_days + 120000,
    }

    def fmt(pkr: float) -> float:
        return convert_from_pkr(pkr, currency) if currency != "PKR" else pkr

    return {
        "status": "success",
        "duration_days": duration_days,
        "currency": currency,
        "budget_tiers": {
            "backpacker": {"amount": fmt(tiers["backpacker"]), "covers": "Hostels, street food, public transport"},
            "comfortable": {"amount": fmt(tiers["comfortable"]), "covers": "Budget hotels, local restaurants, key attractions"},
            "mid_range": {"amount": fmt(tiers["mid_range"]), "covers": "3-star hotels, variety of restaurants, guided tours"},
            "luxury": {"amount": fmt(tiers["luxury"]), "covers": "4-5 star hotels, fine dining, premium activities"},
        },
    }


def _find_destination(name: str) -> dict | None:
    name_lower = name.lower()
    for dest_name, dest in DESTINATIONS.items():
        if dest_name.lower() == name_lower or name_lower in dest_name.lower():
            return dest
    return None


def _verdict(feasible: bool, tight: bool, destination: str, required: str, gap: str) -> str:
    if not feasible:
        return (
            f"Budget too low for {destination}. You need at least {required}. "
            f"You are short by {gap}. Consider local/nearby destinations or increasing your budget."
        )
    if tight:
        return (
            f"Budget is barely sufficient for {destination} on a strict backpacker plan. "
            "Recommend adding 30% buffer for comfort."
        )
    return f"Budget is comfortable for {destination}."


def _suggest_budget_alternatives(budget_pkr: float, duration_days: int, travelers: int) -> list[dict]:
    suggestions = []
    for name, dest in DESTINATIONS.items():
        min_daily = sum(dest["costs_pkr"]["budget"].values())
        flight = dest.get("flight_from_karachi_pkr", 0) * travelers * 2
        if budget_pkr >= (min_daily * duration_days * travelers) + flight:
            suggestions.append({
                "destination": name,
                "country": dest["country"],
                "interests": dest["interests"][:3],
            })
    return suggestions[:4]
