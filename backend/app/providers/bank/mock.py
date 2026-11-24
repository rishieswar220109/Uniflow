"""Deterministic mock bank provider for development and tests.

The mock is clearly labelled as mock data end to end: connections, accounts and
the API responses carry an ``is_mock`` flag so the user is never shown simulated
figures as though they were real. No credentials are accepted or stored.
"""

from __future__ import annotations

import calendar
import uuid
from datetime import date, timedelta
from decimal import Decimal
from random import Random

from app.core.security import utcnow
from app.providers.bank.base import (
    BankProvider,
    ProviderAccount,
    ProviderAuthorization,
    ProviderError,
    ProviderInstitution,
    ProviderTransaction,
)

_INSTITUTIONS = (
    ("mock-hdfc", "HDFC Bank (Demo)"),
    ("mock-icici", "ICICI Bank (Demo)"),
    ("mock-sbi", "State Bank of India (Demo)"),
    ("mock-axis", "Axis Bank (Demo)"),
)

_CHECKING_MERCHANTS = (
    ("Swiggy order", "Swiggy", "dining"),
    ("BigBasket groceries", "BigBasket", "groceries"),
    ("Uber ride", "Uber", "transport"),
    ("Amazon purchase", "Amazon", "shopping"),
    ("Cafe Coffee Day", "Cafe Coffee Day", "dining"),
    ("Apollo Pharmacy", "Apollo Pharmacy", "health"),
    ("Indian Oil fuel", "Indian Oil", "transport"),
    ("Myntra order", "Myntra", "shopping"),
)

_CARD_MERCHANTS = (
    ("Amazon purchase", "Amazon", "shopping"),
    ("Flipkart order", "Flipkart", "shopping"),
    ("BookMyShow tickets", "BookMyShow", "entertainment"),
    ("Zomato order", "Zomato", "dining"),
)


def _month_start(value: date, months_back: int) -> date:
    month = value.month - months_back
    year = value.year
    while month < 1:
        month += 12
        year -= 1
    return date(year, month, 1)


def _on_day(month_start: date, day: int) -> date:
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    return month_start.replace(day=min(day, last_day))


class MockBankProvider(BankProvider):
    slug = "mock"
    display_name = "Mock Bank (development)"
    kind = "mock"
    is_mock = True

    def list_institutions(self) -> list[ProviderInstitution]:
        return [
            ProviderInstitution(
                id=institution_id,
                name=name,
                country="IN",
                is_mock=True,
            )
            for institution_id, name in _INSTITUTIONS
        ]

    def authorize(
        self, *, institution_id: str, user_reference: uuid.UUID
    ) -> ProviderAuthorization:
        institutions = {item.id: item for item in self.list_institutions()}
        institution = institutions.get(institution_id)
        if institution is None:
            raise ProviderError("Unknown institution")

        reference = f"mock-{institution_id}-{uuid.uuid4().hex[:16]}"
        return ProviderAuthorization(
            external_reference=reference,
            institution_id=institution.id,
            institution_name=institution.name,
            scopes=("accounts", "transactions"),
            expires_at=utcnow() + timedelta(days=90),
        )

    def revoke(self, *, external_reference: str) -> None:
        # The mock keeps no server-side state, so revocation is a no-op that
        # must still succeed for the application-level consent flow.
        if not external_reference.startswith("mock-"):
            raise ProviderError("Unknown connection reference")

    def list_accounts(self, *, external_reference: str) -> list[ProviderAccount]:
        rng = Random(f"{external_reference}:accounts")
        checking_balance = Decimal("48250.75")
        credit_limit = Decimal("30000.00")
        owed = Decimal(str(round(rng.uniform(2400, 9600), 2)))
        return [
            ProviderAccount(
                external_id="acc-checking-001",
                name="Everyday Checking",
                account_type="checking",
                currency="INR",
                balance=checking_balance,
                available_balance=checking_balance - Decimal("3130.00"),
            ),
            ProviderAccount(
                external_id="acc-card-001",
                name="Rewards Credit Card",
                account_type="credit_card",
                currency="INR",
                balance=-owed,
                available_balance=credit_limit - owed,
            ),
        ]

    def list_transactions(
        self,
        *,
        external_reference: str,
        account_external_id: str,
        since: date | None = None,
    ) -> list[ProviderTransaction]:
        rng = Random(f"{external_reference}:{account_external_id}:transactions")
        today = date.today()
        records: list[ProviderTransaction] = []

        if account_external_id == "acc-checking-001":
            records.extend(self._checking_records(rng, today))
        elif account_external_id == "acc-card-001":
            records.extend(self._card_records(rng, today))
        else:
            raise ProviderError("Unknown account")

        if since is not None:
            records = [record for record in records if record.occurred_on >= since]
        records.sort(key=lambda record: (record.occurred_on, record.external_id))
        return records

    def _checking_records(
        self, rng: Random, today: date
    ) -> list[ProviderTransaction]:
        records: list[ProviderTransaction] = []
        for months_back in range(3, -1, -1):
            month = _month_start(today, months_back)
            if month > today:
                continue
            month_key = month.strftime("%Y-%m")
            records.append(
                ProviderTransaction(
                    external_id=f"chk-salary-{month_key}",
                    account_external_id="acc-checking-001",
                    amount=Decimal("85000.00"),
                    currency="INR",
                    description="Salary credit - Acme Corp",
                    merchant="Acme Corp",
                    occurred_on=_on_day(month, 1),
                    transaction_type="income",
                )
            )
            records.append(
                ProviderTransaction(
                    external_id=f"chk-rent-{month_key}",
                    account_external_id="acc-checking-001",
                    amount=Decimal("-25000.00"),
                    currency="INR",
                    description="House rent",
                    merchant="Landlord",
                    occurred_on=_on_day(month, 5),
                    transaction_type="expense",
                )
            )
            records.append(
                ProviderTransaction(
                    external_id=f"chk-power-{month_key}",
                    account_external_id="acc-checking-001",
                    amount=Decimal("-1450.00"),
                    currency="INR",
                    description="Electricity bill",
                    merchant="State Power",
                    occurred_on=_on_day(month, 12),
                    transaction_type="expense",
                )
            )
            records.append(
                ProviderTransaction(
                    external_id=f"chk-gym-{month_key}",
                    account_external_id="acc-checking-001",
                    amount=Decimal("-1500.00"),
                    currency="INR",
                    description="Gym membership",
                    merchant="FitLife Gym",
                    occurred_on=_on_day(month, 3),
                    transaction_type="expense",
                )
            )
            for index in range(rng.randint(3, 5)):
                description, merchant, _category = rng.choice(_CHECKING_MERCHANTS)
                day = min(rng.randint(2, 27), 28)
                occurred_on = _on_day(month, day)
                if occurred_on > today:
                    continue
                amount = Decimal(str(round(rng.uniform(180, 3200), 2)))
                records.append(
                    ProviderTransaction(
                        external_id=f"chk-{month_key}-{index}",
                        account_external_id="acc-checking-001",
                        amount=-amount,
                        currency="INR",
                        description=description,
                        merchant=merchant,
                        occurred_on=occurred_on,
                        transaction_type="expense",
                    )
                )
        return records

    def _card_records(self, rng: Random, today: date) -> list[ProviderTransaction]:
        records: list[ProviderTransaction] = []
        for months_back in range(3, -1, -1):
            month = _month_start(today, months_back)
            month_key = month.strftime("%Y-%m")
            records.append(
                ProviderTransaction(
                    external_id=f"card-netflix-{month_key}",
                    account_external_id="acc-card-001",
                    amount=Decimal("-649.00"),
                    currency="INR",
                    description="Netflix subscription",
                    merchant="Netflix",
                    occurred_on=_on_day(month, 18),
                    transaction_type="expense",
                )
            )
            records.append(
                ProviderTransaction(
                    external_id=f"card-spotify-{month_key}",
                    account_external_id="acc-card-001",
                    amount=Decimal("-119.00"),
                    currency="INR",
                    description="Spotify Premium",
                    merchant="Spotify",
                    occurred_on=_on_day(month, 22),
                    transaction_type="expense",
                )
            )
            for index in range(rng.randint(2, 3)):
                description, merchant, _category = rng.choice(_CARD_MERCHANTS)
                occurred_on = _on_day(month, rng.randint(4, 26))
                if occurred_on > today:
                    continue
                amount = Decimal(str(round(rng.uniform(350, 4800), 2)))
                records.append(
                    ProviderTransaction(
                        external_id=f"card-{month_key}-{index}",
                        account_external_id="acc-card-001",
                        amount=-amount,
                        currency="INR",
                        description=description,
                        merchant=merchant,
                        occurred_on=occurred_on,
                        transaction_type="expense",
                    )
                )
        return records
