"""Provider abstraction for consent-based financial data.

Every provider returns validated, provider-neutral records. The financial
management modules only depend on this interface, so a real bank-data provider
can be added without changing accounts, transactions, bills or subscriptions.

No provider may accept or return banking passwords, PINs, OTPs or card security
codes. Connections are represented by opaque provider references and consent
metadata only.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

AccountType = Literal["checking", "savings", "credit_card", "loan", "wallet"]
TransactionType = Literal["income", "expense", "transfer"]
ProviderKind = Literal["mock", "live"]


class ProviderError(Exception):
    """Raised when a provider cannot complete an operation."""


@dataclass(frozen=True)
class ProviderInstitution:
    id: str
    name: str
    country: str
    is_mock: bool


@dataclass(frozen=True)
class ProviderAccount:
    external_id: str
    name: str
    account_type: AccountType
    currency: str
    balance: Decimal
    available_balance: Decimal


@dataclass(frozen=True)
class ProviderTransaction:
    external_id: str
    account_external_id: str
    amount: Decimal
    currency: str
    description: str
    merchant: str | None
    occurred_on: date
    transaction_type: TransactionType
    is_pending: bool = False


@dataclass(frozen=True)
class ProviderAuthorization:
    external_reference: str
    institution_id: str
    institution_name: str
    scopes: tuple[str, ...]
    expires_at: datetime


class BankProvider(ABC):
    """Interface every financial data provider must implement."""

    slug: str
    display_name: str
    kind: ProviderKind
    is_mock: bool

    @abstractmethod
    def list_institutions(self) -> list[ProviderInstitution]:
        """Institutions the user can choose to connect."""

    @abstractmethod
    def authorize(
        self, *, institution_id: str, user_reference: uuid.UUID
    ) -> ProviderAuthorization:
        """Create a consent record. Only an opaque reference is returned."""

    @abstractmethod
    def revoke(self, *, external_reference: str) -> None:
        """Revoke provider-side access for a connection."""

    @abstractmethod
    def list_accounts(self, *, external_reference: str) -> list[ProviderAccount]:
        """Return the accounts visible under the consent."""

    @abstractmethod
    def list_transactions(
        self,
        *,
        external_reference: str,
        account_external_id: str,
        since: date | None = None,
    ) -> list[ProviderTransaction]:
        """Return transactions for one account, newest first."""
