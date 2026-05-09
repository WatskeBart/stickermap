"""add removal_reports table and archived column to stickers

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-09
"""
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("ALTER TABLE stickers ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("""
        CREATE TABLE IF NOT EXISTS removal_reports (
            id SERIAL PRIMARY KEY,
            sticker_id INTEGER NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
            reported_by VARCHAR(255) NOT NULL,
            reported_at TIMESTAMP NOT NULL,
            proof_image VARCHAR(500),
            reviewed_by VARCHAR(255),
            review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
            reviewed_at TIMESTAMP,
            CONSTRAINT uq_report_per_user_sticker UNIQUE (sticker_id, reported_by)
        );
    """)
    op.execute("CREATE INDEX idx_removal_reports_sticker_id ON removal_reports(sticker_id);")
    op.execute("CREATE INDEX idx_removal_reports_status ON removal_reports(review_status);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_removal_reports_status;")
    op.execute("DROP INDEX IF EXISTS idx_removal_reports_sticker_id;")
    op.execute("DROP TABLE IF EXISTS removal_reports;")
    op.execute("ALTER TABLE stickers DROP COLUMN IF EXISTS archived;")
