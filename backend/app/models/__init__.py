"""Model package.

Importing this module registers every model on ``Base.metadata`` for Alembic
and test schema creation.
"""

from app.models.financial import (
    BankConnection,
    BankConsent,
    Bill,
    Budget,
    FinancialAccount,
    FinancialInsight,
    Forecast,
    Payment,
    SavingsGoal,
    SpendingPreference,
    Subscription,
    SyncJob,
    Transaction,
    TransactionCategory,
)
from app.models.user import AuthSession, User, UserPreferences

__all__ = [
    "AuthSession",
    "BankConnection",
    "BankConsent",
    "Bill",
    "Budget",
    "FinancialAccount",
    "FinancialInsight",
    "Forecast",
    "Payment",
    "SavingsGoal",
    "SpendingPreference",
    "Subscription",
    "SyncJob",
    "Transaction",
    "TransactionCategory",
    "User",
    "UserPreferences",
]
