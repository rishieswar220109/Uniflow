"""Schema for recorded bill and subscription payments."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money, PositiveAmount


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bill_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    amount: Money
    currency: str
    paid_on: date
    note: str | None
    created_at: datetime


class PaymentCreate(BaseModel):
    paid_on: date | None = None
    amount: PositiveAmount | None = None
    note: str | None = Field(default=None, max_length=255)
