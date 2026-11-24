"""Date arithmetic for recurring bills and subscriptions."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

CADENCES = {"weekly", "monthly", "quarterly", "yearly"}


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def advance(value: date, cadence: str) -> date:
    if cadence == "weekly":
        return value + timedelta(days=7)
    if cadence == "monthly":
        return add_months(value, 1)
    if cadence == "quarterly":
        return add_months(value, 3)
    if cadence == "yearly":
        return add_months(value, 12)
    return value


def advance_until_after(value: date, cadence: str, *, after: date) -> date:
    """Advance a schedule until the next occurrence is after ``after``.

    A bounded loop protects against pathological stored dates while still
    catching up several missed cycles.
    """

    if cadence not in CADENCES:
        return value
    next_value = advance(value, cadence)
    for _ in range(480):
        if next_value > after:
            return next_value
        next_value = advance(next_value, cadence)
    return next_value


def monthly_equivalent(amount, cadence: str):
    if cadence == "weekly":
        return amount * 52 / 12
    if cadence == "quarterly":
        return amount / 3
    if cadence == "yearly":
        return amount / 12
    return amount
