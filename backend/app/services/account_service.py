"""Account listing and ownership-scoped lookups."""

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.financial import FinancialAccount
from app.repositories.banking_repository import BankingRepository


class AccountService:
    def __init__(self, db: Session) -> None:
        self.repo = BankingRepository(db)

    def list(self, user, *, active_only: bool = True) -> list[FinancialAccount]:
        return self.repo.list_accounts(user.id, active_only=active_only)

    def get(self, user, account_id: uuid.UUID) -> FinancialAccount:
        account = self.repo.get_account(user.id, account_id)
        if account is None:
            raise NotFoundError("Financial account not found")
        return account
