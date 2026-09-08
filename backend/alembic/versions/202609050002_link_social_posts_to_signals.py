"""link community posts to AI signals

Revision ID: 202609050002
Revises: 202609050001
"""
from alembic import op
import sqlalchemy as sa

revision = "202609050002"
down_revision = "202609050001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_post_signals",
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("social_posts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("signal_id", sa.Integer(), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_social_post_signals_signal_id", "social_post_signals", ["signal_id"])


def downgrade() -> None:
    op.drop_index("ix_social_post_signals_signal_id", table_name="social_post_signals")
    op.drop_table("social_post_signals")
