"""add categories table and category_id column to stickers

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-14
"""
revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            icon_filename VARCHAR(255),
            approved BOOLEAN NOT NULL DEFAULT FALSE,
            created_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            archived_at TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_categories_approved ON categories(approved);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_categories_archived_at ON categories(archived_at);")
    op.execute(
        "ALTER TABLE stickers ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_stickers_category_id ON stickers(category_id);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stickers_category_id;")
    op.execute("ALTER TABLE stickers DROP COLUMN IF EXISTS category_id;")
    op.execute("DROP INDEX IF EXISTS idx_categories_archived_at;")
    op.execute("DROP INDEX IF EXISTS idx_categories_approved;")
    op.execute("DROP TABLE IF EXISTS categories;")
