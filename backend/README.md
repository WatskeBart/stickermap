# StickerMap Backend

FastAPI backend for the StickerMap application.

## Quick Start (with compose)

The recommended way to run the full stack is via the project root `compose.yml`:

```bash
# From project root
podman compose up -d
```

## Development Setup

### Prerequisites

- Python 3.14
- `uv` package manager
- A running PostGIS instance and Keycloak (see below)

### Run locally

```bash
cd backend

# Install dependencies
uv sync

# Create Podman network (if running services manually)
podman network create stickermap

# Start PostgreSQL with PostGIS
podman run --name stickermap-postgis -d --network stickermap -p 5432:5432 \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=stickermap \
  docker.io/postgis/postgis:latest

# Start Keycloak
podman run --name stickermap-keycloak -d --network stickermap -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev

# Wait 30-60 seconds for Keycloak to start, then import the realm:
# http://localhost:8080 → admin console → Create Realm → import general/extra/stickermap-realm.json

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Initialize database
uv run python database_setup.py

# Optional: Load test data
uv run python migrate_data.py

# Run development server
uv run uvicorn main:app --port 5555 --reload
```

Backend runs at: <http://localhost:5555>

## Environment Variables

Copy `.env.example` and adjust as needed.

### Database (`DB_*`)

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `DB_HOST` | Database hostname | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_DBNAME` | Database name | `stickermap` |
| `DB_USER` | Database username | required |
| `DB_PASSWORD` | Database password | required |

### Keycloak

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `KEYCLOAK_URL` | External URL (must match JWT issuer) | required |
| `KEYCLOAK_INTERNAL_URL` | Internal URL for JWKS fetching | `KEYCLOAK_URL` |
| `KEYCLOAK_REALM` | Realm name | required |
| `KEYCLOAK_CLIENT_ID` | Client ID | required |

### Other

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `LOG_LEVEL` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `INFO` |
| `UPLOAD_DIR` | Upload directory | `uploads` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `*` |
| `CORS_ALLOWED_METHODS` | Comma-separated allowed methods | `*` |
| `CORS_ALLOWED_HEADERS` | Comma-separated allowed headers | `*` |
| `CORS_ALLOW_CREDENTIALS` | Allow credentials in CORS | `true` |

### Note on `KEYCLOAK_URL` vs `KEYCLOAK_INTERNAL_URL`

- **`KEYCLOAK_URL`**: The URL browsers use to authenticate. Must match the `iss` (issuer) claim in JWT tokens.
- **`KEYCLOAK_INTERNAL_URL`**: Used by the backend to fetch JWKS public keys. In containerized environments, use the internal container hostname (e.g., `http://keycloak:8080`).

## API Endpoints

### Public Endpoints

```text
GET  /api/v1/
     Returns API welcome message

GET  /api/v1/get_all_stickers
     Returns all stickers with GeoJSON locations

GET  /api/v1/get_sticker/{id}
     Returns single sticker by ID

GET  /uploads/{filename}
     Serve uploaded image files
```

### Role-Protected Endpoints

```text
POST  /api/v1/upload            (requires sm-uploader role)
      Upload image with automatic EXIF GPS extraction
      Form data: file
      Returns: filename, message, gps_info

POST  /api/v1/create_sticker    (requires sm-uploader role)
      Create one or more stickers
      JSON body: CreateStickersRequest
      Returns: created sticker IDs
      Note: uploaded_by is set automatically from the JWT token

PATCH  /api/v1/sticker/{id}    (requires sm-uploader role)
       Update sticker fields
       Uploaders: poster, post_date, location (own stickers only)
       Editors: poster, post_date, location (any sticker)
       Admins: all fields including uploader

DELETE /api/v1/sticker/{id}    (requires sm-admin role)
       Delete sticker and associated image file
```

## Running Tests

Tests use [pytest](https://docs.pytest.org/) and run entirely without a live database or Keycloak instance — all external dependencies are mocked.

Install the dev dependency group once before running tests:

```bash
cd backend
uv sync --group dev
```

### Run all tests

```bash
cd backend
uv run pytest
```

### Run with verbose output

```bash
uv run pytest -v
```

### Run a specific test file

```bash
uv run pytest tests/test_auth.py -v
```

### Test layout

| File | What it covers |
| ---- | -------------- |
| `tests/conftest.py` | Shared fixtures, env-var setup, mock DB helpers |
| `tests/test_auth.py` | Role helpers, identity extraction, `require_role` dependency, Keycloak key manager |
| `tests/test_file_handlers.py` | MIME/size/content validation, GPS EXIF extraction |
| `tests/test_models.py` | Pydantic model validation for all request/response schemas |
| `tests/test_api.py` | All API endpoints (auth enforcement, RBAC rules, 404 handling) |

## Interactive API Docs

- Swagger UI: <http://localhost:5555/api/v1/docs>
- ReDoc: <http://localhost:5555/api/v1/redoc>
