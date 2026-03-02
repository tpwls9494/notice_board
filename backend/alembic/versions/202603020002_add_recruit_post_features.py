"""Add recruit post type, recruit metadata, and applications

Revision ID: 202603020002
Revises: 202603020001
Create Date: 2026-03-02 22:05:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603020002"
down_revision: Union[str, None] = "202603020001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE posts "
        "ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) NOT NULL DEFAULT 'NORMAL'"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_posts_post_type ON posts (post_type)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS recruit_meta (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
            recruit_type VARCHAR(30) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
            is_online BOOLEAN NOT NULL DEFAULT TRUE,
            location_text VARCHAR(255) NULL,
            schedule_text VARCHAR(255) NOT NULL,
            headcount_max INTEGER NOT NULL,
            deadline_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_recruit_meta_post_id ON recruit_meta (post_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_recruit_meta_recruit_type ON recruit_meta (recruit_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_recruit_meta_status ON recruit_meta (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_recruit_meta_is_online ON recruit_meta (is_online)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_recruit_meta_deadline_at ON recruit_meta (deadline_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recruit_meta_status_deadline_at "
        "ON recruit_meta (status, deadline_at)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS recruit_applications (
            id SERIAL PRIMARY KEY,
            recruit_post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            link VARCHAR(500) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_recruit_application_post_applicant UNIQUE (recruit_post_id, applicant_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recruit_applications_recruit_post_id "
        "ON recruit_applications (recruit_post_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recruit_applications_applicant_id "
        "ON recruit_applications (applicant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recruit_applications_status "
        "ON recruit_applications (status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recruit_applications_post_status "
        "ON recruit_applications (recruit_post_id, status)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS recruit_applications")
    op.execute("DROP TABLE IF EXISTS recruit_meta")
    op.execute("DROP INDEX IF EXISTS ix_posts_post_type")
    op.execute("ALTER TABLE posts DROP COLUMN IF EXISTS post_type")
