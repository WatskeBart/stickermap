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
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.6 start-dev

# Wait 30-60 seconds for Keycloak to start, then import the realm:
# http://localhost:8080 → admin console → Create Realm → import general/keycloak_realm/stickermap-realm.json

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations (from project root)
cd ../database_migrations
uv run alembic upgrade head
cd ../backend

# Run development server
uv run fastapi dev main.py --port 5555
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
| `KEYCLOAK_CLIENT_SECRET` | Client secret (read by config; only needed for confidential-client flows) | `""` |

### Other

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `LOG_LEVEL` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `INFO` |
| `UPLOAD_DIR` | Upload directory | `uploads` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `*` |
| `CORS_ALLOWED_METHODS` | Comma-separated allowed methods | `*` |
| `CORS_ALLOWED_HEADERS` | Comma-separated allowed headers | `*` |
| `CORS_ALLOW_CREDENTIALS` | Allow credentials in CORS | `true` |

### Image Processing

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `IMAGE_FORMAT` | Output format for processed images. Allowed values: `JPEG`, `WEBP`, `PNG`. Quality compression applies to `JPEG` and `WEBP` only. | `JPEG` |
| `IMAGE_QUALITY` | Compression quality for JPEG/WEBP (1–95) | `85` |
| `IMAGE_MAX_SIZE` | Maximum pixels on the longest edge of the full-size image | `1920` |
| `THUMBNAIL_SIZE` | Maximum pixels on the longest edge of the thumbnail | `400` |

### Note on `KEYCLOAK_URL` vs `KEYCLOAK_INTERNAL_URL`

- **`KEYCLOAK_URL`**: The URL browsers use to authenticate. Must match the `iss` (issuer) claim in JWT tokens.
- **`KEYCLOAK_INTERNAL_URL`**: Used by the backend to fetch JWKS public keys. In containerized environments, use the internal container hostname (e.g., `http://keycloak:8080`).

## API Endpoints

The Swagger UI at <http://localhost:5555/api/v1/docs> is the authoritative reference. Summary below.

### Public

```text
GET  /api/v1/                       API welcome message
GET  /api/v1/get_all_stickers       All stickers as GeoJSON (anonymous + non-viewer
                                    callers receive a stripped payload, no private stickers)
GET  /api/v1/stats                  Sticker statistics (name fields gated to sm-viewer+)
GET  /api/v1/categories             Categories (non-moderators see approved + non-archived only)
GET  /uploads/{filename}            Serve uploaded image files
```

### Stickers — `sm-uploader`+

```text
GET   /api/v1/get_sticker/{id}      Single sticker (used in edit flows)
GET   /api/v1/uploaders             Distinct uploader names (edit dropdown)
POST  /api/v1/upload                Validate, resize, generate thumbnail, extract EXIF GPS
POST  /api/v1/create_sticker        Create one or more stickers (uploaded_by from JWT)
PATCH /api/v1/sticker/{id}          Update poster/post_date/location/category/private
                                    Uploaders: own stickers only
                                    Editors:   any sticker
                                    Admins:    additionally may change `uploader`
PATCH /api/v1/stickers/{id}/rotate  Rotate image 90 CW / 90 CCW / 180 (own only; editor+ any)
```

### Stickers — `sm-editor`+

```text
GET   /api/v1/stickers/export             Export as GeoJSON (default) or CSV (?format=csv)
PATCH /api/v1/stickers/{id}/archive       Archive directly
PATCH /api/v1/stickers/{id}/unarchive     Unarchive
```

### Stickers — `sm-admin`

```text
DELETE /api/v1/sticker/{id}         Delete sticker + image + thumbnail
```

### Categories — `sm-uploader`+

```text
POST  /api/v1/categories            Propose a new category (pending admin approval)
```

### Categories — `sm-editor`+ (approval requires `sm-admin`)

```text
PATCH  /api/v1/categories/{id}            Rename / archive / (admin: approve)
POST   /api/v1/categories/{id}/icon       Upload SVG or PNG icon
DELETE /api/v1/categories/{id}/icon       Remove icon
```

### Removal reports — `sm-viewer`+

```text
POST  /api/v1/stickers/{id}/reports       Submit a removal report with optional proof image
```

### Removal reports — `sm-editor`+

```text
GET   /api/v1/reports/pending             Count of stickers with pending reports
GET   /api/v1/stickers/{id}/reports       All reports for a sticker
PATCH /api/v1/reports/{id}/review         Confirm (archives sticker) or dismiss
```

### Admin — `sm-admin`

```text
GET   /api/v1/admin/stats                       Health counters for the admin dashboard
GET   /api/v1/admin/audit                       Stickers whose image or thumbnail is missing
GET   /api/v1/admin/jobs/{job_id}               Poll background job status
POST  /api/v1/admin/jobs/generate-thumbnails    Backfill missing thumbnails
POST  /api/v1/admin/jobs/compress-images        Re-compress images larger than IMAGE_MAX_SIZE
POST  /api/v1/admin/jobs/strip-exif             Re-save all images without EXIF
POST  /api/v1/admin/jobs/cleanup-orphans        Delete uploads/ files not referenced by DB
```

## Verifying Changes

There is no automated test suite. Exercise the API manually via the Swagger UI at <http://localhost:5555/api/v1/docs> once the dev stack is up.

For static checks:

```bash
uv run ruff check .
```

## Interactive API Docs

- Swagger UI: <http://localhost:5555/api/v1/docs>
- ReDoc: <http://localhost:5555/api/v1/redoc>
