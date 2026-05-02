"""add updated_at to stickers

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-02
"""
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column(
        "stickers",
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stickers", "updated_at")
