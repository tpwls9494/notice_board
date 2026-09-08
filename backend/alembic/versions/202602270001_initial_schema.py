"""Initial schema

Revision ID: 202602270001
Revises:
Create Date: 2026-02-27 00:01:00
"""

from typing import Sequence, Union
from pathlib import Path
from runpy import run_path

from alembic import op

_snapshot = run_path(str(Path(__file__).resolve().parents[1] / "initial_schema_snapshot.py"))

# revision identifiers, used by Alembic.
revision: str = "202602270001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for statement in _snapshot["SCHEMA_STATEMENTS"]:
        op.execute(statement)


def downgrade() -> None:
    for table_name in reversed(_snapshot["TABLE_NAMES"]):
        op.drop_table(table_name)
