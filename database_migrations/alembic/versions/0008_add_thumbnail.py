"""add thumbnail column to stickers

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-16
"""
revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stickers ADD COLUMN IF NOT EXISTS thumbnail VARCHAR(500);"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE stickers DROP COLUMN IF EXISTS thumbnail;")
