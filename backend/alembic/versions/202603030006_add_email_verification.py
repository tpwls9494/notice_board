"""Add email verification fields and token table

Revision ID: 202603030006
Revises: 202603030005
Create Date: 2026-03-03 12:00:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603030006"
down_revision: Union[str, None] = "202603030005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users "
        "ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE users "
        "ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL"
    )

    # Keep existing accounts usable after rollout; only new signups start unverified.
    op.execute(
        "UPDATE users "
        "SET email_verified = TRUE, email_verified_at = COALESCE(email_verified_at, NOW()) "
        "WHERE email_verified = FALSE"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_email_verification_tokens_token_hash "
        "ON email_verification_tokens (token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_user_id "
        "ON email_verification_tokens (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_expires_at "
        "ON email_verification_tokens (expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_verification_tokens")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified")
