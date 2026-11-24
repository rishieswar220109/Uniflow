"""Financial account API routes."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.accounts import FinancialAccountRead
from app.services.account_service import AccountService

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get(
    "",
    response_model=list[FinancialAccountRead],
    summary="List the current user's financial accounts",
)
def list_accounts(
    current_user: CurrentUser,
    db: DatabaseSession,
    active_only: bool = True,
) -> list[FinancialAccountRead]:
    accounts = AccountService(db).list(current_user, active_only=active_only)
    return [FinancialAccountRead.model_validate(account) for account in accounts]


@router.get(
    "/{account_id}",
    response_model=FinancialAccountRead,
    summary="Get one financial account",
)
def get_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> FinancialAccountRead:
    account = AccountService(db).get(current_user, account_id)
    return FinancialAccountRead.model_validate(account)
