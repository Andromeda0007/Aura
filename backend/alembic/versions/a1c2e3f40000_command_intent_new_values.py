"""command_intent: add fact / list / image / numerical / chemistry

Additive enum change only — existing rows are unaffected.

Revision ID: a1c2e3f40000
Revises: 3ff850cef37e
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c2e3f40000"
down_revision: Union[str, None] = "3ff850cef37e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# PG enum stores the member NAMES (uppercase), matching app.models.enums.CommandIntent.
_NEW_VALUES = (
    "GENERATE_FACT",
    "LIST_ITEMS",
    "GENERATE_IMAGE",
    "GENERATE_NUMERICAL",
    "GENERATE_CHEMISTRY",
)


def upgrade() -> None:
    # PG 12+ allows ADD VALUE inside a transaction (it just can't be USED in the
    # same txn, which we don't). IF NOT EXISTS keeps it idempotent.
    for value in _NEW_VALUES:
        op.execute(f"ALTER TYPE command_intent ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL cannot drop enum values; downgrade is a no-op.
    pass
