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

This creates a new file in `alembic/versions/`. Name it with the next zero-padded revision number (e.g. `0006_your_description.py`) and fill in `upgrade()` and `downgrade()`.

Always implement `downgrade()` so migrations remain reversible.

## Verifying Changes

There is no automated test suite. Verify a new migration manually against a real PostGIS database:

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic upgrade head
```

Both `upgrade()` and `downgrade()` must run cleanly.
