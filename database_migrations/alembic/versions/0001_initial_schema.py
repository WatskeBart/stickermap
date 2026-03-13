"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-13
"""
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    op.execute("""
        CREATE TABLE IF NOT EXISTS stickers (
            id SERIAL PRIMARY KEY,
            location GEOGRAPHY(POINT, 4326),
            poster VARCHAR(255),
            uploader VARCHAR(255),
            post_date TIMESTAMP,
            upload_date TIMESTAMP,
            image VARCHAR(500),
            uploaded_by VARCHAR(255)
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_stickers_location
        ON stickers USING GIST(location);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stickers_location;")
    op.execute("DROP TABLE IF EXISTS stickers CASCADE;")
