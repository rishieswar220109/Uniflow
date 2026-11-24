"""Deterministic, rule-based transaction categorisation.

Categorisation is intentionally simple and explainable. It is a Phase 2
convenience, not the Phase 3 intelligence engine, and the user can override any
assignment through the transaction API.
"""

from __future__ import annotations

from decimal import Decimal

# Rules are checked in order; the first match wins.
_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("salary", "payroll", "stipend"), "salary"),
    (("refund", "reversal", "cashback"), "refund"),
    (("rent", "landlord", "housing"), "rent"),
    (
        (
            "electricity",
            "water bill",
            "gas bill",
            "broadband",
            "internet",
            "recharge",
            "mobile bill",
            "power",
        ),
        "utilities",
    ),
    (
        (
            "netflix",
            "spotify",
            "prime video",
            "disney",
            "hotstar",
            "bookmyshow",
            "cinema",
            "gaming",
        ),
        "entertainment",
    ),
    (("swiggy", "zomato", "restaurant", "cafe", "coffee", "food"), "dining"),
    (
        ("bigbasket", "grocery", "supermarket", "dmart", "vegetables", "milk"),
        "groceries",
    ),
    (
        (
            "uber",
            "ola",
            "fuel",
            "petrol",
            "diesel",
            "metro",
            "irctc",
            "cab",
            "parking",
            "toll",
        ),
        "transport",
    ),
    (
        ("flight", "hotel", "makemytrip", "goibibo", "airbnb", "travel"),
        "travel",
    ),
    (
        ("pharmacy", "hospital", "clinic", "doctor", "medical", "gym"),
        "health",
    ),
    (
        ("school", "college", "course", "udemy", "coursera", "tuition"),
        "education",
    ),
    (
        ("amazon", "flipkart", "myntra", "ajio", "shopping", "mall", "store"),
        "shopping",
    ),
    (("emi", "loan", "interest", "fee", "charge", "tax"), "fees"),
    (("transfer", "neft", "imps", "self transfer"), "transfer"),
)


def suggest_category_slug(description: str, merchant: str | None = None) -> str:
    haystack = f"{description} {merchant or ''}".lower()
    for keywords, slug in _RULES:
        if any(keyword in haystack for keyword in keywords):
            return slug
    return "other"


def suggest_transaction_type(amount: Decimal) -> str:
    """Signed amounts map directly to income or expense."""

    return "income" if amount > 0 else "expense"
