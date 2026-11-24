"""Schemas for financial accounts."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Money


class FinancialAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_id: uuid.UUID | None
    name: str
    account_type: str
    currency: str
    balance: Money
    available_balance: Money
    is_active: bool
    is_mock: bool
    last_synced_at: datetime | None
    created_at: datetime
