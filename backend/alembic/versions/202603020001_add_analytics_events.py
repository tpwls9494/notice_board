"""Add analytics_events table

Revision ID: 202603020001
Revises: 202603010001
Create Date: 2026-03-02 11:30:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603020001"
down_revision: Union[str, None] = "202603010001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS analytics_events (
            id SERIAL PRIMARY KEY,
            event_name VARCHAR(100) NOT NULL,
            user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            page VARCHAR(255) NULL,
            referrer VARCHAR(255) NULL,
            properties_json TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_event_name "
        "ON analytics_events (event_name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_user_id "
        "ON analytics_events (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_analytics_events_created_at "
        "ON analytics_events (created_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS analytics_events")
