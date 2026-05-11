"""
Budget validation tool — estimates realistic trip costs via live web search
and compares them against the user's stated budget.

Called by the root agent before marking requirements complete when the user
provides a budget, so the user gets an honest shortfall warning instead of
being silently sent into plan generation with an unrealistic budget.
"""

from .search_tool import web_search


# Rough PKR multipliers for converting common currencies if web search fails
_TO_PKR = {
    "PKR": 1,
    "USD": 280,
    "EUR": 305,
    "GBP": 355,
    "AED": 76,
    "SAR": 75,
    "CAD": 205,
    "AUD": 180,
    "INR": 3.4,
    "TRY": 8.5,
}


def validate_budget(
    destination: str,
    duration_days: int,
    travelers: int,
    budget: float,
    currency: str = "PKR",
) -> dict:
    """
    Estimate the realistic minimum cost for a trip and compare it to the
    user's stated budget.  Returns a validation result the agent can relay
    directly to the user.

    Call this whenever the user has provided a budget figure, BEFORE calling
    mark_requirements_complete.  If the budget is insufficient, present the
    shortfall to the user and ask how they'd like to proceed — do NOT
    immediately invoke mark_requirements_complete.

    Args:
        destination: Target city or country (e.g., "Paris", "Bangkok").
        duration_days: Number of days for the trip.
        travelers: Number of travellers.
        budget: Total budget in the chosen currency.
        currency: ISO currency code (default PKR).

    Returns:
        dict with keys:
          - is_sufficient (bool)
          - estimated_min_cost (float)  — in the user's currency
          - shortfall (float)           — 0 if sufficient
          - surplus (float)             — 0 if insufficient
          - currency (str)
          - cost_breakdown (str)        — human-readable breakdown
          - recommendation (str)        — actionable advice
    """
    currency = (currency or "PKR").upper()

    # 1. Search for realistic per-person daily costs -------------------------
    cost_results = web_search(
        f"{destination} average daily travel cost per person {duration_days} days "
        f"including hotel meals transport 2025"
    )

    # 2. Search for flights from Pakistan ------------------------------------
    flight_results = web_search(
        f"cheapest return flight to {destination} from Pakistan 2025 price PKR OR USD"
    )

    # 3. Ask an LLM-style estimate prompt so the model produces a number -----
    estimate_prompt = (
        f"Based on these search results, estimate the MINIMUM realistic total cost "
        f"in {currency} for {travelers} person(s) travelling to {destination} for "
        f"{duration_days} days from Pakistan. Include return flights, accommodation, "
        f"meals, transport, and activities. Give a single total number and a short "
        f"itemised breakdown.\n\n"
        f"Daily cost results:\n{cost_results}\n\n"
        f"Flight results:\n{flight_results}"
    )
    estimate_text = web_search(estimate_prompt)

    # 4. Try to parse a number from the estimate; fall back to heuristic -----
    estimated_cost = _parse_cost_from_text(estimate_text, currency, travelers)

    if estimated_cost is None:
        # Heuristic fallback: typical mid-range daily rate + flight lump sum
        daily_pkr = _heuristic_daily_pkr(destination)
        flight_pkr = _heuristic_flight_pkr(destination)
        total_pkr = (daily_pkr * duration_days * travelers) + (flight_pkr * travelers)
        multiplier = _TO_PKR.get(currency, 1)
        estimated_cost = round(total_pkr / multiplier) if multiplier != 1 else total_pkr

    shortfall = max(0.0, estimated_cost - budget)
    surplus = max(0.0, budget - estimated_cost)
    is_sufficient = shortfall == 0

    # 5. Build recommendation ------------------------------------------------
    if is_sufficient:
        recommendation = (
            f"Your budget of {currency} {budget:,.0f} looks workable for this trip "
            f"(estimated minimum: {currency} {estimated_cost:,.0f}). "
            f"You have roughly {currency} {surplus:,.0f} as a buffer — consider "
            f"keeping 15–20% for unexpected expenses."
        )
    else:
        pct_covered = int((budget / estimated_cost) * 100) if estimated_cost else 0
        recommendation = (
            f"Your budget of {currency} {budget:,.0f} covers approximately "
            f"{pct_covered}% of the estimated minimum cost of "
            f"{currency} {estimated_cost:,.0f} for this trip.\n\n"
            f"**Shortfall: {currency} {shortfall:,.0f}**\n\n"
            f"Options to make it work:\n"
            f"- Increase your budget by {currency} {shortfall:,.0f}\n"
            f"- Reduce the trip to {max(1, int(duration_days * budget / estimated_cost))} days\n"
            f"- Travel with more people to split fixed costs (flights, accommodation)\n"
            f"- Consider a more budget-friendly destination"
        )

    return {
        "is_sufficient": is_sufficient,
        "estimated_min_cost": float(estimated_cost),
        "shortfall": float(shortfall),
        "surplus": float(surplus),
        "currency": currency,
        "cost_breakdown": estimate_text[:800] if estimate_text else "See recommendation.",
        "recommendation": recommendation,
    }


# ─── helpers ────────────────────────────────────────────────────────────────────

def _parse_cost_from_text(text: str, currency: str, travelers: int) -> float | None:
    """Extract the first plausible total cost figure from free-form text."""
    import re

    if not text:
        return None

    # Strip commas and look for numbers > 1000 (likely a meaningful cost)
    cleaned = text.replace(",", "")
    candidates = re.findall(r"\b(\d{4,9})(?:\.\d+)?\b", cleaned)
    if not candidates:
        return None

    values = [float(v) for v in candidates]

    # Prefer values in a sane range for the given currency
    reasonable_min = {"PKR": 50_000, "USD": 500, "EUR": 500, "GBP": 400}.get(currency, 500)
    reasonable_max = {"PKR": 10_000_000, "USD": 50_000, "EUR": 50_000, "GBP": 50_000}.get(currency, 100_000)

    plausible = [v for v in values if reasonable_min <= v <= reasonable_max]
    if not plausible:
        return None

    # Return the median-ish value (sorted mid-point) to avoid outlier skew
    plausible.sort()
    return plausible[len(plausible) // 2]


def _heuristic_daily_pkr(destination: str) -> float:
    """Very rough mid-range daily cost per person in PKR (accommodation + meals + local transport)."""
    dest = destination.lower()
    if any(k in dest for k in ["paris", "london", "new york", "tokyo", "dubai", "singapore"]):
        return 35_000   # expensive cities
    if any(k in dest for k in ["bangkok", "bali", "istanbul", "cairo", "kuala lumpur"]):
        return 18_000   # mid-range
    if any(k in dest for k in ["lahore", "karachi", "islamabad", "murree", "swat", "hunza"]):
        return 8_000    # domestic Pakistan
    return 22_000       # default international mid-range


def _heuristic_flight_pkr(destination: str) -> float:
    """Very rough return flight cost per person from Pakistan in PKR."""
    dest = destination.lower()
    if any(k in dest for k in ["lahore", "karachi", "islamabad", "murree", "swat", "hunza", "gilgit"]):
        return 15_000   # domestic
    if any(k in dest for k in ["dubai", "abu dhabi", "riyadh", "muscat", "doha"]):
        return 80_000   # gulf
    if any(k in dest for k in ["bangkok", "kuala lumpur", "bali", "istanbul", "cairo"]):
        return 130_000  # mid-haul
    if any(k in dest for k in ["london", "paris", "amsterdam", "new york", "toronto"]):
        return 250_000  # long-haul
    return 150_000      # default international
