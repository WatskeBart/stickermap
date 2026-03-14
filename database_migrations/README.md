# StickerMap Database Migrations

Alembic-managed schema migrations for the StickerMap PostGIS database.

## Quick Start

```bash
cd database_migrations

# Install dependencies
uv sync

# Apply all pending migrations
uv run alembic upgrade head
```

## Environment Variables

The following variables must be set (or present in a `.env` file):

| Variable | Description |
| -------- | ----------- |
| `DB_HOST` | Database hostname |
| `DB_PORT` | Database port |
| `DB_DBNAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |

## Common Commands

```bash
# Apply all pending migrations
uv run alembic upgrade head

# Roll back the last migration
uv run alembic downgrade -1

# Roll back all migrations
uv run alembic downgrade base

# Show current revision
uv run alembic current

# Show full migration history
uv run alembic history --verbose
```

## Adding a New Migration

Create a new revision file manually:

```bash
uv run alembic revision -m "your description here"
```

This creates a new file in `alembic/versions/`. Name it with the next zero-padded revision number (e.g. `0003_your_description.py`) and fill in `upgrade()` and `downgrade()`.

Always implement `downgrade()` — it is required by the structural tests.

## Migration History

| Revision | Description |
| -------- | ----------- |
| `0001` | Initial schema — `stickers` table with PostGIS `GEOGRAPHY(POINT, 4326)` and spatial index |
| `0002` | Add `spotted_count` column to `stickers` |

## Running Tests

Tests are structural — they verify the revision chain and migration content without a live database.

```bash
cd database_migrations
uv sync --group dev
uv run pytest
```

### Test layout

| File | What it covers |
| ---- | -------------- |
| `tests/test_migrations.py` | Chain integrity (single head, no gaps), presence of `upgrade()`/`downgrade()` on every revision, expected SQL content per migration |
