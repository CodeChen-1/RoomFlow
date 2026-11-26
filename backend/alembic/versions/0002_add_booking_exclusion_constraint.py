"""add booking exclusion constraint

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-26 12:09:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT no_overlapping_active_bookings
        EXCLUDE USING gist (
            room_id WITH =,
            tsrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (status = 'active');
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_active_bookings;")
