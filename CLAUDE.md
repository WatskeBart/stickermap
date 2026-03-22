# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend

```bash
cd backend

# Install dependencies
uv sync --group dev

# Run the API server (requires running DB and Keycloak)
uv run uvicorn main:app --host 0.0.0.0 --port 5555 --reload

# Run all tests
uv run pytest

# Run a single test file
uv run pytest tests/test_api.py

# Run a single test
uv run pytest tests/test_api.py::test_function_name

# Lint
uv run ruff check .
```

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Dev server (requires running backend + Keycloak)
pnpm start

# Build
pnpm build

# Run tests (Vitest, no watch)
pnpm test -- --watch=false

# Run a single test file
pnpm test -- --watch=false src/app/map/map.spec.ts
```

### Local Dev Stack (Docker/Podman Compose)

```bash
# Build and start all services (DB, Keycloak, Backend, Frontend)
docker compose up --build

# Start with pre-built images
docker compose -f compose.prod.yml up
```

After `compose up`, the app is available at `https://localhost:8282`. Keycloak admin UI: `http://localhost:8080` (admin/admin).

## Architecture

### Overview

StickerMap is a geo-tagged sticker tracker. Users upload photos, the backend extracts GPS data from EXIF, and stickers are shown on a MapLibre GL map.

```text
Frontend (Angular 21) ──HTTP──▶ Backend (FastAPI :5555)
                                       │
                   Keycloak (OIDC) ◀──┤──▶ PostgreSQL + PostGIS
                                       │
                                  /uploads (static files)
```

### Backend (`backend/`)

- **`main.py`** — FastAPI app, all route handlers. URL prefix: `/api/v1`. The API docs are at `/api/v1/docs`.
- **`auth.py`** — JWT validation via Keycloak JWKS endpoint using **PyJWT** (`import jwt`) with `RSAAlgorithm.from_jwk()` to convert JWKS keys. `require_role(ROLE_X)` is a FastAPI dependency factory. `get_user_identity()` returns `preferred_username` for ownership tracking. Public keys are cached with a 1-hour TTL.
- **`environment.py`** — `Config` class validates required env vars at startup.
- **`connections.py`** — `DatabaseManager` for psycopg connection pooling.
- **`file_handlers.py`** — `FileValidator` (MIME + magic bytes + size) and `GPSExtractor` (EXIF parsing with exifread/Pillow).
- **`models.py`** — Pydantic request models: `CreateStickersRequest`, `UpdateStickerRequest`.

**t-strings:** The backend uses Python 3.14 t-strings (template strings, `t"..."`) for parameterized SQL queries. These are not f-strings — they produce a `Template` object that psycopg uses for safe parameter binding.

### Frontend (`frontend/src/app/`)

- **`app.config.ts`** — Bootstrap config; Keycloak is initialized here before the app starts.
- **`services/auth.service.ts`** — Wraps `keycloak-js`. Role checks: `isViewer()`, `isUploader()`, `isEditor()`, `isAdmin()`. The Angular app is zoneless.
- **`services/sticker.service.ts`** — All HTTP calls to `/api/v1`. Attaches the Keycloak Bearer token.
- **`map/map.ts`** — Main map component (MapLibre GL). Uses a window bridge pattern for popup actions: `window.__editSticker`, `window.__deleteSticker`, `window.__openFullImage` (Leaflet-style callbacks from HTML popup content).
- **`config/keycloak.config.ts`** — Keycloak client configuration (realm, client ID, URLs via `ngssc` environment injection).
- **`guards/auth.guard.ts`** — Redirects unauthenticated users to Keycloak login.

Frontend environment variables are injected at container start via `angular-server-side-configuration` (ngssc), which replaces tokens in `index.html` at runtime — not at build time.

### Auth & RBAC

Roles live in Keycloak as realm roles with the `sm-` prefix (avoids collision with Keycloak built-ins). They are hierarchical composite roles in Keycloak:

```text
sm-admin ⊇ sm-editor ⊇ sm-uploader ⊇ sm-viewer
```

- `sm-viewer` — read-only access
- `sm-uploader` — can upload and edit their own stickers (`uploaded_by` = `preferred_username`)
- `sm-editor` — can edit any sticker
- `sm-admin` — can delete stickers, change uploader field

Backend enforces roles via `require_role()` dependency. Frontend hides/shows UI elements via `AuthService.isX()` methods (which call `keycloak.hasRealmRole()`). Because composite roles are configured in Keycloak, a user with `sm-editor` also passes `isUploader()` checks.

### Database

PostGIS with SRID 4326. Sticker locations stored as `geometry(Point, 4326)`. Key columns: `id`, `location` (PostGIS point), `poster`, `uploader`, `post_date`, `upload_date`, `image` (filename), `uploaded_by` (Keycloak `preferred_username`).

### Helm Chart (`helm/stickermap/`)

Umbrella chart with 4 sub-charts (no external chart dependencies — air-gap friendly). Database sub-chart supports two modes: CNPG (`CloudNativePG` operator CRD) or standalone StatefulSet. Keycloak sub-chart supports embedded or external. The frontend sub-chart uses an init container to run ngssc before Caddy serves the files from an emptyDir. See `helm/README.md` for installation details.

## Known Issues

- `frontend/src/app/app.spec.ts` has a pre-existing test failure (expects "Hello, frontend" but the app shows "StickerMap"). Do not fix this unless explicitly asked.
- Backend tests use `pytest-asyncio` with `asyncio_mode = "auto"` — no need to mark async tests individually.
