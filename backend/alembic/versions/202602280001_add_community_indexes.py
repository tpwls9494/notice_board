"""Add indexes for community read performance

Revision ID: 202602280001
Revises: 202602270001
Create Date: 2026-02-28 16:10:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202602280001"
down_revision: Union[str, None] = "202602270001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # posts list/hot queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_posts_created_at ON posts (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_posts_category_id ON posts (category_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_posts_category_created_at "
        "ON posts (category_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_posts_is_pinned_pinned_order_created_at "
        "ON posts (is_pinned, pinned_order, created_at)"
    )

    # comment aggregation/read queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_comments_post_id ON comments (post_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_comments_post_created_at "
        "ON comments (post_id, created_at)"
    )

    # bookmark read queries (my bookmarks/status)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bookmarks_user_id ON bookmarks (user_id)")

    # notification read/unread count queries
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at "
        "ON notifications (user_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_is_read "
        "ON notifications (user_id, is_read)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_is_read")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_created_at")
    op.execute("DROP INDEX IF EXISTS ix_bookmarks_user_id")
    op.execute("DROP INDEX IF EXISTS ix_comments_post_created_at")
    op.execute("DROP INDEX IF EXISTS ix_comments_post_id")
    op.execute("DROP INDEX IF EXISTS ix_posts_is_pinned_pinned_order_created_at")
    op.execute("DROP INDEX IF EXISTS ix_posts_category_created_at")
    op.execute("DROP INDEX IF EXISTS ix_posts_category_id")
    op.execute("DROP INDEX IF EXISTS ix_posts_created_at")
