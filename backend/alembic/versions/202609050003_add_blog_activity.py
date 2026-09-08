"""Add likes and comments dedicated to blog posts."""
from alembic import op
import sqlalchemy as sa

revision = "202609050003"
down_revision = "202609050002"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("blog_likes", "blog_comments"):
        columns = [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("post_id", sa.Integer(), sa.ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        ]
        if table == "blog_likes":
            columns.append(sa.UniqueConstraint("post_id", "user_id", name="uq_blog_like_user"))
        else:
            columns.append(sa.Column("content", sa.Text(), nullable=False))
        op.create_table(table, *columns)
        op.create_index(f"ix_{table}_post_id", table, ["post_id"])


def downgrade():
    op.drop_table("blog_comments")
    op.drop_table("blog_likes")
