"""Add user follow relationships

Revision ID: 202603030003
Revises: 202603030002
Create Date: 2026-03-03 23:10:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603030003"
down_revision: Union[str, None] = "202603030002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_user_follows_follower_following UNIQUE (follower_id, following_id),
            CONSTRAINT ck_user_follows_no_self_follow CHECK (follower_id <> following_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_follows_follower_id ON user_follows (follower_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_follows_following_id ON user_follows (following_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_follows_created_at ON user_follows (created_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_follows")
