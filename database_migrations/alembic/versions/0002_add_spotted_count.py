"""add spotted_count to stickers

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-13
"""
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column(
        "stickers",
        sa.Column("spotted_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("stickers", "spotted_count")
