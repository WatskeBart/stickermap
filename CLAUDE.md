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

The frontend follows a **medium-sized Angular project structure**. Always place new files in the correct layer — do not add files directly under `src/app/` except for the root bootstrap files.

```text
src/app/
├── core/                    ← singleton services, guards, config, models (imported once)
│   ├── config/              ← keycloak.config.ts
│   ├── guards/              ← auth.guard.ts
│   ├── models/              ← auth.model.ts, sticker.model.ts
│   └── services/            ← auth.service.ts, sticker.service.ts, theme.service.ts
├── features/                ← one folder per route/feature
│   ├── add-sticker/         ← add-sticker-view component
│   ├── landing/             ← landing page component
│   ├── map/                 ← MapComponent (MapLibre GL) + nested map-view/ page
│   │   └── map-view/        ← route page wrapper for the map
│   ├── sticker-form/        ← sticker upload form component
│   └── sticker-overview/    ← overview table + edit/bulk-delete dialogs
├── shared/                  ← reusable components used across multiple features
│   └── components/
│       ├── delete-sticker-dialog/
│       └── disclaimer-dialog/
└── app.ts / app.config.ts / app.routes.ts / app.spec.ts / app.html / app.scss
```

**Non-negotiable Angular standards — always apply these:**

- **Angular 21** — use Angular 21 APIs only. No `NgModules`, no `BrowserModule`, no `BrowserAnimationsModule`, no `provideAnimationsAsync`/`provideAnimations` (animations are automatic). All components must be `standalone: true`.
- **Angular Material** — use Angular Material components and theming for all UI. Do not introduce other UI libraries.
- **Signals for local state** — use `signal()`, `computed()`, `effect()` for local synchronous component state. Do not use `BehaviorSubject` or store state as component-level Observable properties. RxJS/Observables remain the correct tool for async operations (HTTP calls, router events, dialog results, streams) — do not replace these with signals.
- **Signal queries** — prefer `viewChild()` / `viewChild.required()` over `@ViewChild`, and `output()` over `@Output EventEmitter`. Use `toSignal()` from `@angular/core/rxjs-interop` to bridge an Observable into a signal for template binding where it simplifies the code.
- **Subscription cleanup** — always pipe `takeUntilDestroyed(this.destroyRef)` on subscriptions inside components. Inject `DestroyRef` via `private destroyRef = inject(DestroyRef)`. Import `takeUntilDestroyed` from `@angular/core/rxjs-interop`.
- **Zoneless** — the app runs without Zone.js. Do not use `ChangeDetectorRef.markForCheck()`, `NgZone.run()`, or any zone-dependent patterns. Signals drive change detection automatically.

**Rules for new code:**

- `core/` — singleton services, guards, interceptors, models. Never import `core/` files from each other in a circular way.
- `features/` — one folder per route. Feature components may import from `core/` and `shared/`, but never from other feature folders.
- `shared/` — components, directives, pipes used by 2+ features. No business logic or service calls that belong in `core/`.
- Root `app/` files — only bootstrap-level files (`app.ts`, `app.config.ts`, `app.routes.ts`).

**Key files:**

- **`app.config.ts`** — Bootstrap config; Keycloak is initialized here before the app starts.
- **`core/services/auth.service.ts`** — Wraps `keycloak-js`. Role checks: `isViewer()`, `isUploader()`, `isEditor()`, `isAdmin()`. The Angular app is zoneless.
- **`core/services/sticker.service.ts`** — All HTTP calls to `/api/v1`. Attaches the Keycloak Bearer token.
- **`features/map/map.ts`** — Main map component (MapLibre GL). Uses a window bridge pattern for popup actions: `window.__editSticker`, `window.__deleteSticker`, `window.__openFullImage` (Leaflet-style callbacks from HTML popup content).
- **`core/config/keycloak.config.ts`** — Keycloak client configuration (realm, client ID, URLs via `ngssc` environment injection).
- **`core/guards/auth.guard.ts`** — Redirects unauthenticated users to Keycloak login.

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

Single flat chart — **requires Helm v4** (`apiVersion: v2`). No sub-charts or external dependencies; all component templates are inlined under `templates/` (air-gap friendly). Components: backend, frontend, Keycloak (optional), and database.

- **Database modes** (`database.mode`): `cnpg` (default, requires CloudNativePG operator) or `standalone` (plain StatefulSet, no operator needed). Both expose the same secret format to the backend.
- **Keycloak modes** (`keycloak.enabled`): `true` (default, deploys Keycloak with realm auto-import) or `false` (external Keycloak — set `backend.keycloakUrl`).
- **Migrations** run as a post-install/post-upgrade hook Job; retries handle CNPG bootstrap lag.
- **Frontend** uses an init container to run ngssc before Caddy serves the SPA from an emptyDir.

See `helm/README.md` for mandatory values, installation examples, and OCI packaging.

## Known Issues

- `frontend/src/app/app.spec.ts` has a pre-existing test failure (expects "Hello, frontend" but the app shows "StickerMap"). Do not fix this unless explicitly asked.
- Backend tests use `pytest-asyncio` with `asyncio_mode = "auto"` — no need to mark async tests individually.
