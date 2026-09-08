"""Add an optional editorial body without changing legacy signal content."""
from alembic import op
import sqlalchemy as sa

revision = "202609090001"
down_revision = "202609060002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("signals", sa.Column("body", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("signals", "body")
