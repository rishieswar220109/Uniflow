"""Consent-based financial data providers."""

from app.providers.bank.base import (
    BankProvider,
    ProviderAccount,
    ProviderAuthorization,
    ProviderError,
    ProviderInstitution,
    ProviderTransaction,
)
from app.providers.bank.mock import MockBankProvider
from app.providers.bank.registry import available_providers, get_provider

__all__ = [
    "BankProvider",
    "MockBankProvider",
    "ProviderAccount",
    "ProviderAuthorization",
    "ProviderError",
    "ProviderInstitution",
    "ProviderTransaction",
    "available_providers",
    "get_provider",
]
