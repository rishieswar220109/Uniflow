"""Financial data provider registry."""

from app.core.config import settings
from app.providers.bank.base import BankProvider
from app.providers.bank.mock import MockBankProvider

_PROVIDERS: dict[str, BankProvider] = {
    "mock": MockBankProvider(),
}


def available_providers() -> list[BankProvider]:
    return list(_PROVIDERS.values())


def get_provider(slug: str | None = None) -> BankProvider:
    """Return a provider by slug, defaulting to the configured provider."""

    key = (slug or settings.bank_provider or "mock").strip().lower()
    provider = _PROVIDERS.get(key)
    if provider is None:
        raise KeyError(key)
    return provider
