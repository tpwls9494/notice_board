"""add AI signal, review, discussion, and interest tables

Revision ID: 202609040001
Revises: 202603180001
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa


revision = "202609040001"
down_revision = "202603180001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "signals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("why_it_matters", sa.Text(), nullable=True),
        sa.Column("try_this", sa.Text(), nullable=True),
        sa.Column("content_kind", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="candidate"),
        sa.Column("verification_level", sa.String(30), nullable=False, server_default="unverified"),
        sa.Column("source_kind", sa.String(30), nullable=False),
        sa.Column("source_name", sa.String(120), nullable=False),
        sa.Column("source_url", sa.String(1200), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("source_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("novelty_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("usefulness_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("submitted_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_signals_slug", "signals", ["slug"], unique=True)
    op.create_index("ix_signals_source_hash", "signals", ["source_hash"], unique=True)
    op.create_index("ix_signals_status_published_at", "signals", ["status", "published_at"])
    op.create_index("ix_signals_kind_published_at", "signals", ["content_kind", "published_at"])
    op.create_index("ix_signals_source_published_at", "signals", ["source_published_at"])

    op.create_table(
        "signal_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("signal_id", sa.Integer(), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False, server_default="question"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_signal_comments_signal_visible_created",
        "signal_comments",
        ["signal_id", "is_hidden", "created_at"],
    )
    op.create_index("ix_signal_comments_user_id", "signal_comments", ["user_id"])

    op.create_table(
        "signal_reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("signal_id", sa.Integer(), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_signal_reviews_signal_created", "signal_reviews", ["signal_id", "created_at"])

    op.create_table(
        "user_interests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("keyword", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "keyword", name="uq_user_interest_keyword"),
    )
    op.create_index("ix_user_interests_user_id", "user_interests", ["user_id"])
    op.create_index("ix_user_interests_keyword", "user_interests", ["keyword"])


def downgrade() -> None:
    op.drop_table("user_interests")
    op.drop_table("signal_reviews")
    op.drop_table("signal_comments")
    op.drop_table("signals")
