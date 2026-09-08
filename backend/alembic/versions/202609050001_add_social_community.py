"""add the new social community and editorial signal fields

Revision ID: 202609050001
Revises: 202609040001
Create Date: 2026-09-05
"""

from alembic import op
import sqlalchemy as sa


revision = "202609050001"
down_revision = "202609040001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signals", sa.Column("original_title", sa.String(500), nullable=True))
    op.add_column("signals", sa.Column("image_url", sa.String(1200), nullable=True))
    op.add_column("signals", sa.Column("external_reactions", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("signals", sa.Column("importance_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("signals", sa.Column("pinned_until", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_signals_importance", "signals", ["importance_score", "published_at"])
    op.create_index("ix_signals_pinned_until", "signals", ["pinned_until"])

    op.create_table(
        "signal_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("signal_id", sa.Integer(), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("signal_id", "user_id", name="uq_signal_recommendation"),
    )
    op.create_index("ix_signal_recommendations_signal", "signal_recommendations", ["signal_id"])

    op.create_table(
        "social_posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("space", sa.String(20), nullable=False, server_default="community"),
        sa.Column("topic", sa.String(30), nullable=False, server_default="story"),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("image_url", sa.String(1200), nullable=True),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_social_posts_space_created", "social_posts", ["space", "created_at"])
    op.create_index("ix_social_posts_user_created", "social_posts", ["user_id", "created_at"])

    op.create_table(
        "social_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("social_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_social_comments_post_created", "social_comments", ["post_id", "created_at"])
    op.create_index("ix_social_comments_parent_created", "social_comments", ["parent_id", "created_at"])

    op.create_table(
        "social_post_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("post_id", "user_id", name="uq_social_post_recommendation"),
    )
    op.create_index("ix_social_post_recommendations_post", "social_post_recommendations", ["post_id"])

    op.create_table(
        "social_comment_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("comment_id", sa.Integer(), sa.ForeignKey("social_comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_social_comment_recommendation"),
    )
    op.create_index("ix_social_comment_recommendations_comment", "social_comment_recommendations", ["comment_id"])


def downgrade() -> None:
    op.drop_table("social_comment_recommendations")
    op.drop_table("social_post_recommendations")
    op.drop_table("social_comments")
    op.drop_table("social_posts")
    op.drop_table("signal_recommendations")
    op.drop_index("ix_signals_pinned_until", table_name="signals")
    op.drop_index("ix_signals_importance", table_name="signals")
    op.drop_column("signals", "pinned_until")
    op.drop_column("signals", "importance_score")
    op.drop_column("signals", "external_reactions")
    op.drop_column("signals", "image_url")
    op.drop_column("signals", "original_title")
