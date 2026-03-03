"""Add signup email verification codes table

Revision ID: 202603030008
Revises: 202603030007
Create Date: 2026-03-03 13:00:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603030008"
down_revision: Union[str, None] = "202603030007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS signup_email_verifications (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            code_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_signup_email_verifications_email "
        "ON signup_email_verifications (email)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_signup_email_verifications_code_hash "
        "ON signup_email_verifications (code_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_signup_email_verifications_expires_at "
        "ON signup_email_verifications (expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS signup_email_verifications")
