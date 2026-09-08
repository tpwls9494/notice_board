"""Store the blog's public profile image separately from account avatars."""
from alembic import op
import sqlalchemy as sa

revision = "202609050004"
down_revision = "202609050003"
branch_labels = None
depends_on = None


def upgrade():
    profile = op.create_table(
        "blog_profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("image_url", sa.String(500), nullable=True),
    )
    op.bulk_insert(profile, [{"id": 1, "image_url": None}])


def downgrade():
    op.drop_table("blog_profile")
