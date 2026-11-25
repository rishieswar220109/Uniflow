"""phase3 financial intelligence

Revision ID: 0003_phase3_intelligence
Revises: 0002_phase2_financial
Create Date: 2026-11-22

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = '0003_phase3_intelligence'
down_revision: str | None = '0002_phase2_financial'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'budgets',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('category_id', sa.Uuid(), nullable=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column(
            'alert_threshold',
            sa.Integer(),
            server_default='80',
            nullable=False,
        ),
        sa.Column(
            'is_active',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'amount > 0',
            name=op.f('ck_budgets_amount_positive'),
        ),
        sa.CheckConstraint(
            'period_end >= period_start',
            name=op.f('ck_budgets_period_end_after_start'),
        ),
        sa.ForeignKeyConstraint(
            ['category_id'],
            ['transaction_categories.id'],
            name=op.f('fk_budgets_category_id_transaction_categories'),
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_budgets_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_budgets')),
    )
    op.create_index(
        op.f('ix_budgets_user_id'), 'budgets', ['user_id'], unique=False
    )
    op.create_index(
        'ix_budgets_user_period',
        'budgets',
        ['user_id', 'period_start', 'period_end'],
        unique=False,
    )
    op.create_index(
        'ix_budgets_user_active', 'budgets', ['user_id', 'is_active'],
        unique=False,
    )

    op.create_table(
        'savings_goals',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('target_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            'current_amount',
            sa.Numeric(precision=14, scale=2),
            server_default='0',
            nullable=False,
        ),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column(
            'is_active',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'target_amount > 0',
            name=op.f('ck_savings_goals_target_amount_positive'),
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_savings_goals_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_savings_goals')),
    )
    op.create_index(
        op.f('ix_savings_goals_user_id'), 'savings_goals', ['user_id'],
        unique=False,
    )

    op.create_table(
        'spending_preferences',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'proactive_awareness_enabled',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'significant_spending_threshold',
            sa.Numeric(precision=14, scale=2),
            server_default='5000.00',
            nullable=False,
        ),
        sa.Column(
            'reminder_advance_days',
            sa.Integer(),
            server_default='3',
            nullable=False,
        ),
        sa.Column(
            'enable_due_reminders',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'enable_post_payment_reminders',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'enable_entertainment_alerts',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column(
            'entertainment_categories',
            sa.String(length=200),
            server_default='entertainment,dining',
            nullable=False,
        ),
        sa.Column(
            'reminder_frequency',
            sa.String(length=16),
            server_default='daily',
            nullable=False,
        ),
        sa.Column('currency', sa.String(length=3), server_default='INR', nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'significant_spending_threshold > 0',
            name=op.f('ck_spending_preferences_threshold_positive'),
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_spending_preferences_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_spending_preferences')),
        sa.UniqueConstraint(
            'user_id', name=op.f('uq_spending_preferences_user_id')
        ),
    )

    op.create_table(
        'forecasts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('forecast_date', sa.Date(), nullable=False),
        sa.Column('projected_balance', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            'expected_income',
            sa.Numeric(precision=14, scale=2),
            server_default='0',
            nullable=False,
        ),
        sa.Column(
            'expected_expenses',
            sa.Numeric(precision=14, scale=2),
            server_default='0',
            nullable=False,
        ),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column(
            'generated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('assumptions', sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_forecasts_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_forecasts')),
    )
    op.create_index(
        op.f('ix_forecasts_user_id'), 'forecasts', ['user_id'], unique=False
    )
    op.create_index(
        'ix_forecasts_user_date', 'forecasts', ['user_id', 'forecast_date'],
        unique=False,
    )

    op.create_table(
        'financial_insights',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('insight_type', sa.String(length=32), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=3), nullable=True),
        sa.Column('related_date', sa.Date(), nullable=True),
        sa.Column(
            'is_dismissed',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_financial_insights_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_financial_insights')),
    )
    op.create_index(
        op.f('ix_financial_insights_user_id'), 'financial_insights', ['user_id'],
        unique=False,
    )
    op.create_index(
        'ix_insights_user_type',
        'financial_insights',
        ['user_id', 'insight_type'],
        unique=False,
    )
    op.create_index(
        'ix_insights_user_severity',
        'financial_insights',
        ['user_id', 'severity'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_insights_user_severity', table_name='financial_insights')
    op.drop_index('ix_insights_user_type', table_name='financial_insights')
    op.drop_index(
        op.f('ix_financial_insights_user_id'), table_name='financial_insights'
    )
    op.drop_table('financial_insights')
    op.drop_index('ix_forecasts_user_date', table_name='forecasts')
    op.drop_index(op.f('ix_forecasts_user_id'), table_name='forecasts')
    op.drop_table('forecasts')
    op.drop_table('spending_preferences')
    op.drop_index(op.f('ix_savings_goals_user_id'), table_name='savings_goals')
    op.drop_table('savings_goals')
    op.drop_index('ix_budgets_user_active', table_name='budgets')
    op.drop_index('ix_budgets_user_period', table_name='budgets')
    op.drop_index(op.f('ix_budgets_user_id'), table_name='budgets')
    op.drop_table('budgets')
