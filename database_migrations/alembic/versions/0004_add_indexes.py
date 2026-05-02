"""add indexes on uploaded_by, upload_date, and poster

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-02
"""
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.create_index("idx_stickers_uploaded_by", "stickers", ["uploaded_by"])
    op.create_index("idx_stickers_upload_date", "stickers", ["upload_date"], postgresql_ops={"upload_date": "DESC"})
    op.create_index("idx_stickers_poster", "stickers", ["poster"])


def downgrade() -> None:
    op.drop_index("idx_stickers_poster", table_name="stickers")
    op.drop_index("idx_stickers_upload_date", table_name="stickers")
    op.drop_index("idx_stickers_uploaded_by", table_name="stickers")
