"""
Currency conversion utilities used by cost and itinerary tools.
PKR exchange rates (approximate, mid-2025).
"""

PKR_EXCHANGE: dict[str, float] = {
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


def convert_to_pkr(amount: float, currency: str) -> float:
    """Convert an amount from the given currency to PKR."""
    rate = PKR_EXCHANGE.get(currency.upper(), 1)
    return round(amount * rate, 2)


def convert_from_pkr(amount_pkr: float, currency: str) -> float:
    """Convert a PKR amount to the target currency."""
    rate = PKR_EXCHANGE.get(currency.upper(), 1)
    return round(amount_pkr / rate, 2)
