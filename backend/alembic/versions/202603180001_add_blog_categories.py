"""add blog_categories table

Revision ID: 202603180001
Revises: 202603170001
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = "202603180001"
down_revision = "202603170001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute(
        """
        INSERT INTO blog_categories (name, "order") VALUES
        ('개발', 1),
        ('AI', 2),
        ('CS', 3),
        ('일상', 4),
        ('회고', 5)
        """
    )


def downgrade() -> None:
    op.drop_table("blog_categories")
