"""Versioned API router aggregation."""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.modules.accounts.router import router as accounts_router
from app.modules.auth.router import router as auth_router
from app.modules.banking.router import router as banking_router
from app.modules.bills.router import router as bills_router
from app.modules.budgets.router import router as budgets_router
from app.modules.intelligence.router import router as intelligence_router
from app.modules.overview.router import router as overview_router
from app.modules.savings_goals.router import router as savings_goals_router
from app.modules.spending_preferences.router import (
    router as spending_preferences_router,
)
from app.modules.subscriptions.router import router as subscriptions_router
from app.modules.transactions.router import router as transactions_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(banking_router)
api_router.include_router(accounts_router)
api_router.include_router(transactions_router)
api_router.include_router(bills_router)
api_router.include_router(subscriptions_router)
api_router.include_router(overview_router)
api_router.include_router(budgets_router)
api_router.include_router(savings_goals_router)
api_router.include_router(spending_preferences_router)
api_router.include_router(intelligence_router)
