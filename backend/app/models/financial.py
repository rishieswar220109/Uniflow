"""Phase 2 financial data models.

These tables hold consent-based bank connections, provider-synced accounts and
transactions, and user-managed bills and subscriptions. Only provider references
and consent metadata are stored: no banking passwords, PINs, OTPs or card
security codes are ever accepted or persisted.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

MONEY = Numeric(14, 2)


class BankConnection(TimestampMixin, Base):
    """A consent-based link to a financial data provider."""

    __tablename__ = "bank_connections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    institution_id: Mapped[str] = mapped_column(String(64), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Opaque provider-side handle. Never a credential or banking secret.
    external_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    is_mock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    accounts: Mapped[list["FinancialAccount"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    consents: Mapped[list["BankConsent"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class BankConsent(TimestampMixin, Base):
    """The user's recorded consent for one connection."""

    __tablename__ = "bank_consents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("bank_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scopes: Mapped[str] = mapped_column(
        String(255), nullable=False, default="accounts,transactions"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class FinancialAccount(TimestampMixin, Base):
    """An account returned by a provider or created for a manual record set."""

    __tablename__ = "financial_accounts"
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "external_id",
            name="uq_financial_accounts_connection_external",
        ),
        Index("ix_financial_accounts_user_active", "user_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("bank_connections.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    account_type: Mapped[str] = mapped_column(String(24), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    balance: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    available_balance: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    is_mock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class TransactionCategory(TimestampMixin, Base):
    """A system or user-defined category for transactions and obligations."""

    __tablename__ = "transaction_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "slug", name="uq_transaction_categories_user_slug"),
        Index("ix_transaction_categories_slug", "slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    slug: Mapped[str] = mapped_column(String(48), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(
        String(12), nullable=False, default="expense", server_default="expense"
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )


class Transaction(TimestampMixin, Base):
    """A stored financial transaction.

    ``amount`` is signed: positive values are inflows (income, refunds) and
    negative values are outflows (expenses).
    """

    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint(
            "account_id", "dedupe_key", name="uq_transactions_account_dedupe"
        ),
        CheckConstraint("amount <> 0", name="amount_nonzero"),
        Index("ix_transactions_user_date", "user_id", "occurred_on"),
        Index("ix_transactions_user_type", "user_id", "transaction_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("transaction_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    merchant: Mapped[str | None] = mapped_column(String(120), nullable=True)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    transaction_type: Mapped[str] = mapped_column(String(12), nullable=False)
    source: Mapped[str] = mapped_column(
        String(12), nullable=False, default="provider", server_default="provider"
    )
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(64), nullable=False)
    is_pending: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    account: Mapped["FinancialAccount"] = relationship(lazy="joined")
    category: Mapped["TransactionCategory | None"] = relationship(lazy="joined")


class Bill(TimestampMixin, Base):
    """A one-off or recurring payment obligation."""

    __tablename__ = "bills"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_bills_user_due", "user_id", "due_date"),
        Index("ix_bills_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("transaction_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    payee: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurrence: Mapped[str] = mapped_column(
        String(16), nullable=False, default="none", server_default="none"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unpaid", server_default="unpaid"
    )
    autopay: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    reminder_days_before: Mapped[int] = mapped_column(
        nullable=False, default=3, server_default="3"
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    category: Mapped["TransactionCategory | None"] = relationship(lazy="joined")
    payments: Mapped[list["Payment"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class Subscription(TimestampMixin, Base):
    """A recurring subscription service the user pays for."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_subscriptions_user_next", "user_id", "next_payment_date"),
        Index("ix_subscriptions_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("transaction_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(
        String(16), nullable=False, default="monthly", server_default="monthly"
    )
    next_payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    reminder_days_before: Mapped[int] = mapped_column(
        nullable=False, default=3, server_default="3"
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    category: Mapped["TransactionCategory | None"] = relationship(lazy="joined")
    payments: Mapped[list["Payment"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class Payment(TimestampMixin, Base):
    """Recorded payment history for a bill or a subscription."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "(bill_id IS NULL) <> (subscription_id IS NULL)",
            name="single_target",
        ),
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_payments_user_paid_on", "user_id", "paid_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    paid_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SyncJob(TimestampMixin, Base):
    """One execution of a provider synchronisation."""

    __tablename__ = "sync_jobs"
    __table_args__ = (Index("ix_sync_jobs_connection_started", "connection_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("bank_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="running", server_default="running"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accounts_synced: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )
    transactions_created: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )
    transactions_skipped: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Budget(TimestampMixin, Base):
    """A monthly or category-based spending budget for a user.

    Spending is computed from stored transactions rather than stored on the
    budget row, so budgets stay consistent with the transaction ledger.
    """

    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "period_end >= period_start", name="period_end_after_start"
        ),
        Index("ix_budgets_user_period", "user_id", "period_start", "period_end"),
        Index("ix_budgets_user_active", "user_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("transaction_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    alert_threshold: Mapped[int] = mapped_column(
        nullable=False, default=80, server_default="80"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )


class SavingsGoal(TimestampMixin, Base):
    """A user-defined savings goal tracked against stored transactions."""

    __tablename__ = "savings_goals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )


class SpendingPreference(TimestampMixin, Base):
    """User preferences for proactive spending awareness and reminders.

    One row per user. Proactive awareness is enabled by default for new users.
    """

    __tablename__ = "spending_preferences"
    __table_args__ = (
        CheckConstraint(
            "significant_spending_threshold > 0",
            name="threshold_positive",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    proactive_awareness_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    significant_spending_threshold: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("5000.00"), server_default="5000.00"
    )
    reminder_advance_days: Mapped[int] = mapped_column(
        nullable=False, default=3, server_default="3"
    )
    enable_due_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    enable_post_payment_reminders: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    enable_entertainment_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    entertainment_categories: Mapped[str] = mapped_column(
        String(200), nullable=False, default="entertainment,dining", server_default="entertainment,dining"
    )
    reminder_frequency: Mapped[str] = mapped_column(
        String(16), nullable=False, default="daily", server_default="daily"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )


class Forecast(Base):
    """A stored cash-flow forecast snapshot generated by the intelligence engine.

    Forecasts are immutable snapshots, so they carry ``generated_at`` instead of
    a ``created_at``/``updated_at`` pair. This matches revision
    ``0003_phase3_intelligence``; adding ``TimestampMixin`` here would introduce
    columns the migration never created.
    """

    __tablename__ = "forecasts"
    __table_args__ = (
        Index("ix_forecasts_user_date", "user_id", "forecast_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False)
    projected_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    expected_income: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    expected_expenses: Mapped[Decimal] = mapped_column(
        MONEY, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    assumptions: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class FinancialInsight(TimestampMixin, Base):
    """A generated financial insight or risk warning for a user.

    Insights are deterministic and explainable, derived from stored financial
    records. They are never invented by an AI model.
    """

    __tablename__ = "financial_insights"
    __table_args__ = (
        Index("ix_insights_user_type", "user_id", "insight_type"),
        Index("ix_insights_user_severity", "user_id", "severity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    insight_type: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    related_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_dismissed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
