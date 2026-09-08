"""Add replies, edit timestamps and deletion tombstones without replacing comments."""
from alembic import op
import sqlalchemy as sa

revision = "202609060001"
down_revision = "202609050004"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("signal_comments") as batch:
        batch.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key("fk_signal_comments_parent_id", "signal_comments", ["parent_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_signal_comments_parent_id", ["parent_id"])


def downgrade():
    with op.batch_alter_table("signal_comments") as batch:
        batch.drop_index("ix_signal_comments_parent_id")
        batch.drop_constraint("fk_signal_comments_parent_id", type_="foreignkey")
        batch.drop_column("updated_at")
        batch.drop_column("is_deleted")
        batch.drop_column("parent_id")
