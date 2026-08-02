"""add extra_info column to stickers

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-02
"""
revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stickers ADD COLUMN IF NOT EXISTS extra_info VARCHAR(256);"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE stickers DROP COLUMN IF EXISTS extra_info;")
