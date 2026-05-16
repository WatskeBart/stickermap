"""add private column to stickers

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-16
"""
revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stickers ADD COLUMN IF NOT EXISTS private BOOLEAN NOT NULL DEFAULT FALSE;"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE stickers DROP COLUMN IF EXISTS private;")
