# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Run the API server (requires running DB and Keycloak)
uv run fastapi dev main.py --host 0.0.0.0 --port 5555

# Lint
uv run ruff check .
```

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Dev server (requires running backend + Keycloak); proxies /api/v1 and /uploads to localhost:5555
pnpm start

# Build
pnpm build
```

### Database migrations

```bash
cd database_migrations

# Install dependencies
uv sync

# Apply / roll back (reads DB_HOST, DB_PORT, DB_DBNAME, DB_USER, DB_PASSWORD)
uv run alembic upgrade head
uv run alembic downgrade -1
```

### Local Dev Stack (Docker/Podman Compose)

```bash
# Build and start all services (PostGIS, Keycloak, migrations, backend, frontend)
podman compose up --build
```

After `compose up`, the app is available at `https://localhost:8282`. Keycloak admin UI: `http://localhost:8080` (admin/admin). The one-shot `migrations` service runs `alembic upgrade head` before the backend starts. The backend is also reachable directly on `http://localhost:5555` and PostGIS on `localhost:5432` (`user`/`password`).

The repository contains no automated tests — verify changes by running the dev stack and exercising the affected flows in a browser.

## Git & Commits

**Never commit without explicit permission from the project owner.** This covers everything that writes to history or leaves the machine:

- `git commit`
- `git push`
- creating or pushing tags (including the release tag in the flow below)
- opening pull requests

Permission is per action, not standing — approval for one commit does not authorise the next one. Read-only git (`status`, `diff`, `log`, `show`) and creating a local branch need no approval. Stage the work, show what changed, and wait to be asked before committing.

**Commit messages follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), without scopes.**

```text
<type>: <description>

[optional body]

[optional footer]
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **No parenthesised scope** — write `fix: guard null poster in map popup`, not `fix(frontend): …`. This matches the existing history.
- Description in the imperative mood, lower case, no trailing period.
- Breaking changes: append `!` after the type (`feat!: …`) and/or add a `BREAKING CHANGE:` footer.

```text
✅ feat: add Highlights-based changelog pipeline
✅ chore: release v1.24.0 with changelog dialog redesign
❌ fix(frontend): guard null poster        ← no scopes in this repo
❌ Fixed the map popup crash.              ← no type, past tense, trailing period
```

## Architecture

### Overview

StickerMap is a geo-tagged sticker tracker. Users upload photos, the backend extracts GPS data from EXIF, and stickers are shown on a MapLibre GL map.

```text
Frontend (Angular 22 SPA, Caddy) ──HTTP──▶ Backend (FastAPI :5555)
                                                  │
                              Keycloak (OIDC) ◀──┤──▶ PostgreSQL + PostGIS ◀── Alembic migrations
                                                  │
                                             /uploads (static files)
```

### Backend (`backend/`)

- **`main.py`** — Creates the FastAPI app, runs the `Config.validate_*()` startup checks, configures CORS, registers the routers under the `/api/v1` prefix and mounts `/uploads` as static files. The API docs are at `/api/v1/docs`.
- **`routers/`** — Route handlers, one module per area:
  - `stickers.py` — upload, create/read/update/delete, `/stats`, export, rotate, archive/unarchive.
  - `reports.py` — removal reports and their review.
  - `categories.py` — categories and their icons.
  - `admin.py` — `/admin/*`: health counters, file audit and background maintenance jobs.
  - `leaderboard.py` — `/hq` and `/leaderboard/distance`, the "Farthest from HQ" leaderboard (see below).

  `backend/README.md` lists every endpoint with its required role; the Swagger UI is the authoritative reference.
- **`core/auth.py`** — JWT validation via Keycloak JWKS endpoint using **PyJWT** (`import jwt`) with `RSAAlgorithm.from_jwk()` to convert JWKS keys. `require_role(ROLE_X)` is a FastAPI dependency factory. `get_user_identity()` returns `preferred_username` for ownership tracking. Public keys are cached with a 1-hour TTL.
- **`core/config.py`** — `Config` class: reads env vars (with defaults) and exposes `validate_db()`, `validate_keycloak()` and `validate_hq()`, which `main.py` calls at startup.
- **`core/connections.py`** — `get_pool()`: a lazily created, thread-safe psycopg `ConnectionPool` (min 2, max 10).
- **`core/logger.py`** — `setup_logging()` (called once in `main.py`) and `get_logger(__name__)`.
- **`dependencies.py`** — `get_db()`, the FastAPI dependency that yields a pooled connection.
- **`file_handlers.py`** — `FileValidator` (MIME + magic bytes + size), `CategoryIconValidator`, `ImageProcessor` (resize, thumbnail, re-encode as `IMAGE_FORMAT`), `rotate_image_file()` and `GPSExtractor` (EXIF parsing with exifread/Pillow).
- **`models/sticker.py`** — Pydantic request models: `CreateStickersRequest`, `UpdateStickerRequest`, `RotateRequest`, `ReviewReportRequest`, `CreateCategoryRequest`, `UpdateCategoryRequest`.

**t-strings:** The backend uses Python 3.14 t-strings (template strings, `t"..."`) for parameterized SQL queries. These are not f-strings — they produce a `Template` object that psycopg uses for safe parameter binding. The exceptions are deliberate: an f-string only ever splices in a fixed SQL fragment (the privacy filter in `get_all_stickers`), and the dynamic `UPDATE`s (`update_sticker`, `update_category`) build a `%s`-parameterised `SET` list. Request values always go through parameters.

**Response shapes:** the older sticker endpoints return raw psycopg rows (positional JSON arrays — see the frontend notes below). `/stats`, categories, reports, admin and the leaderboard return JSON objects; use objects for new endpoints.

### Frontend (`frontend/src/app/`)

The frontend follows a **medium-sized Angular project structure**. Always place new files in the correct layer — do not add files directly under `src/app/` except for the root bootstrap files.

```text
src/app/
├── core/                       ← singleton services, guards, config, models (imported once)
│   ├── config/                 ← oidc.config.ts, tile-layers.config.ts
│   ├── guards/                 ← auth.guard.ts, moderator.guard.ts (editor/admin), admin.guard.ts
│   ├── models/                 ← auth, category, sticker models + changelog.model.ts (generated)
│   └── services/               ← auth, sticker, category, language and theme services
├── features/                   ← one folder per route/feature
│   ├── add-sticker/            ← upload page (composes sticker-form + the map in picker mode)
│   ├── admin/                  ← admin dashboard: health counters, file audit, maintenance jobs
│   ├── category-management/    ← category moderation (editor/admin)
│   ├── landing/                ← home page: navigation, stats, "Farthest from HQ" leaderboard
│   ├── map/                    ← MapComponent (MapLibre GL)
│   │   ├── distance-label/     ← distance pill for distance lines and per-sticker tags
│   │   ├── edit-sticker-modal/ ← in-map edit modal
│   │   └── map-view/           ← route page wrapper for the map
│   ├── sticker-form/           ← sticker upload form component
│   └── sticker-overview/       ← overview table + edit, bulk-delete and review-reports dialogs
├── shared/                     ← reusable pieces used across multiple features
│   ├── components/             ← category-selector, changelog-dialog, delete-sticker-dialog,
│   │                             disclaimer-dialog, report-removal-dialog
│   └── utils/                  ← date-utils.ts, distance-utils.ts, f35-cursor.ts
└── app.ts / app.config.ts / app.routes.ts / app.html / app.scss
```

Routes (`app.routes.ts`): `/` landing, `/map`, `/add-sticker` (`authGuard`), `/sticker-overview` (lazy), `/categories` (`authGuard` + `moderatorGuard`, lazy), `/admin` (`authGuard` + `adminGuard`, lazy).

Component styles are the `.scss` files named in `styleUrl`. The `.css` files next to some of them (`landing`, `map`, `map-view`, `add-sticker-view`, `sticker-form`) are unused leftovers — do not edit them.

**Non-negotiable Angular standards — always apply these:**

- **Angular 22** — use Angular 22 APIs only. No `NgModules`, no `BrowserModule`, no `BrowserAnimationsModule`, no `provideAnimationsAsync`/`provideAnimations` (animations are automatic). Components are standalone by default since v19 — **do not** write `standalone: true`, it is redundant.
- **TypeScript 6.0** — Angular 22 requires `>=6.0 <6.1`; TypeScript 5.9 is not supported. The build also needs Node `^22.22.3 || ^24.15.0 || >=26`.
- **`OnPush` is the default** — Angular 22 changed the default `changeDetection` for components that do not declare one from eager to `OnPush`, and this project relies on that default. Do not add `changeDetection:` to a component, and never `ChangeDetectionStrategy.Eager`. Any state a template reads must be a signal (or an `input()`/`output()`/`toSignal()` bridge), otherwise it will not re-render.
- **Angular Material** — use Angular Material components and theming for all UI. Do not introduce other UI libraries.
- **Signals for local state** — use `signal()`, `computed()`, `effect()` for local synchronous component state. Do not use `BehaviorSubject` or store state as component-level Observable properties. RxJS/Observables remain the correct tool for async operations (HTTP calls, router events, dialog results, streams) — do not replace these with signals.
- **Signal queries** — prefer `viewChild()` / `viewChild.required()` over `@ViewChild`, and `output()` over `@Output EventEmitter`. Use `toSignal()` from `@angular/core/rxjs-interop` to bridge an Observable into a signal for template binding where it simplifies the code.
- **Subscription cleanup** — always pipe `takeUntilDestroyed(this.destroyRef)` on subscriptions inside components. Inject `DestroyRef` via `private destroyRef = inject(DestroyRef)`. Import `takeUntilDestroyed` from `@angular/core/rxjs-interop`.
- **Zoneless** — the app runs without Zone.js. Do not use `ChangeDetectorRef.markForCheck()`, `NgZone.run()`, or any zone-dependent patterns. Signals drive change detection automatically.
- **i18n** — every user-visible string goes through the `translate` pipe (`@ngx-translate`). Add each new key to **both** `frontend/public/i18n/nl.json` and `en.json`; `nl` is the default and fallback language.

**Rules for new code:**

- `core/` — singleton services, guards, interceptors, models. Never import `core/` files from each other in a circular way.
- `features/` — one folder per route. Feature components may import from `core/` and `shared/`, but never from other feature folders. The one existing exception is `add-sticker/`, which composes `map/`'s `MapComponent` and `sticker-form/`'s `StickerFormComponent`; do not add more.
- `shared/` — components, directives, pipes and utils used by 2+ features. No business logic or service calls that belong in `core/`.
- Root `app/` files — only bootstrap-level files (`app.ts`, `app.config.ts`, `app.routes.ts`).

**Key files:**

- **`app.config.ts`** — Bootstrap config: router, HTTP client with the OIDC `authInterceptor()`, ngx-translate, `provideMaplibreWorker()`, and `provideOidcConfig()`, whose `provideAppInitializer` initializes OIDC auth before the app starts.
- **`core/services/auth.service.ts`** — Wraps `angular-auth-oidc-client`'s `OidcSecurityService`. Observables are bridged to signals via `toSignal()` for zoneless reactivity. Role checks (`isViewer()`, `isUploader()`, `isEditor()`, `isAdmin()`) are `computed()` signals that call `hasClientRole()`, which reads `resource_access.<clientId>.roles` from the decoded access token payload.
- **`core/services/sticker.service.ts`** — All sticker, report, admin and leaderboard HTTP calls to `/api/v1` (categories have their own `category.service.ts`). Bearer token is attached automatically by the `authInterceptor()` for routes matching `/api/`.

  **Sticker endpoints return positional tuples, not objects.** The backend returns raw psycopg rows, which serialise to JSON *arrays* — so `get_all_stickers` yields `[[1, "{...geojson}", "poster", ...], ...]` and callers index by position (`s[2]` is the poster). These are typed as labelled tuples in `core/models/sticker.model.ts` (`StickerRow`, `StickerDetailRow`, `StickerRotateRow`); when a column is added to the SQL `SELECT`, add it to the matching tuple type or index access silently drifts.

  **Metadata is null for non-viewers.** `get_all_stickers` blanks out `poster`, `uploader`, `post_date`, `upload_date`, `uploaded_by`, `updated_at` and `extra_info` for unauthenticated callers, so those fields are `string | null` on `ParsedSticker`/`ProcessedSticker`. Guard them before calling string methods.
- **`core/services/language.service.ts`** — Current language (`nl` default, `en`) as a signal, persisted in localStorage (`stickermap-lang`). Use `current()` when formatting numbers for display (e.g. `formatDistance()`).
- **`features/map/map.ts`** — Main map component (MapLibre GL). Markers and popups are rendered **declaratively** via `ngx-maplibre-gl`'s `<mgl-marker>` / `<mgl-popup>` in `map.html`, and popup actions are ordinary Angular `(click)` bindings — there is no `window.*` callback bridge. Distance lines are `<mgl-geojson-source>` + `<mgl-layer>` pairs with HTML-marker labels (see "Distances" below). `maplibregl` is imported for types, the `RasterTileSource.setTiles()` call behind the tile-layer toggle, `MercatorCoordinate` to place labels halfway along a line, and `LngLat.distanceTo()` for distances. The same component also serves as the location picker on the add-sticker page (`locationSelectionMode`), which hides the stickers and overlay controls.
- **`core/config/oidc.config.ts`** — OIDC client configuration (authority, client ID, scopes, secure routes via `ngssc` environment injection). Also exports `provideOidcConfig()`, which registers a `provideAppInitializer` that calls `checkAuth()` and handles post-login redirects.
- **`core/config/tile-layers.config.ts`** — Street/satellite/terrain tile URLs from `TILESERVER_URL_*`; the map's layer toggle only lists configured layers and hides itself when there is just one.
- **`core/guards/auth.guard.ts`** — Functional `CanActivateFn` that checks `OidcSecurityService.isAuthenticated$`, stores the target URL in sessionStorage (`redirect_url`), and triggers `authorize()` if unauthenticated.

Frontend environment variables (`KEYCLOAK_*`, `TILESERVER_URL_*`, `PRODUCTION`) are read through `process.env` in `src/environments/environment.ts` and injected via `angular-server-side-configuration` (ngssc) at container start, not at build time: the image's `entrypoint.sh` copies the build into `/srv` and runs `ngssc insert /srv` before starting Caddy.

**MapLibre GL v6 — the worker must be served as a real file:**

The map uses **MapLibre GL JS 6.x** via **`@maplibre/ngx-maplibre-gl` 22.x** (the ngx major tracks the Angular major; v22 peers `maplibre-gl >= 6.0.0`). Three things about v6 are easy to get wrong:

- **ESM-only, no default export.** `import maplibregl from 'maplibre-gl'` no longer works. Use `import * as maplibregl from 'maplibre-gl'` (what `map.ts` does) or named imports. `maplibre-gl` must **not** be listed in `allowedCommonJsDependencies` in `angular.json`.
- **The web worker is a separate runtime fetch that bundlers cannot rewrite.** v6 resolves it from `import.meta.url`, which after esbuild points at a hashed chunk — so without an explicit URL it requests a file that does not exist, **the worker 404s and no tiles render**. The `new Worker()` call fails asynchronously rather than throwing, so the failure surfaces as a missing basemap plus a 404 in the network tab, not as a thrown error. Two pieces make it work, and both are required:
  1. `angular.json` `assets` copies **`maplibre-gl-worker.mjs`** (and `maplibre-gl-shared.mjs`) from `node_modules/maplibre-gl/dist` to the output root. Since maplibre-gl 6.16 the worker is one self-contained file and `maplibre-gl-shared.mjs` is empty and unused; the asset entry stays so either layout works. In layouts where the worker imports `./maplibre-gl-shared.mjs` (as in 6.4), the two files must stay **siblings in the same directory**.
  2. `app.config.ts` provides `provideMaplibreWorker('maplibre-gl-worker.mjs')` from `@maplibre/ngx-maplibre-gl/config`. The path is resolved against `document.baseURI`, so a sub-path deployment (`--base-href`) keeps working. Keep it relative for that reason.

  Because Caddy sets `X-Content-Type-Options: nosniff`, the `.mjs` files must also be served as `text/javascript` or the browser blocks the module worker. `caddy:alpine` does this correctly out of the box — but it is the thing to check first if the map works in `pnpm start` and breaks in a container.
- **Camera inputs are plain numbers, not single-element arrays.** ngx-maplibre-gl 22 changed `[zoom]`, `[bearing]`, `[pitch]` and `[roll]` from `[9]` to `9`, and made them two-way capable (`[(zoom)]`). Templates using the old array form fail the build under v22's strict template checking.

MapLibre v6 also **requires WebGL2** (WebGL1 support was removed), and if a CSP is ever added it needs `worker-src 'self'` and `img-src data: blob: 'self'` — the dedicated CSP bundle from v5 no longer exists.

**Text on the map:** the base style is raster-only and has no `glyphs` URL, so symbol layers cannot render text. Put labels in an HTML `<mgl-marker>` instead (as the `distance-label` component does); adding a glyph server would also break air-gapped deployments that self-host their tiles.

**CSS theming — light/dark mode:**

The app uses an Angular Material **M2** theme (`mat.m2-define-light-theme` / `mat.m2-define-dark-theme`). The dark theme is activated by adding the `.dark-theme` class to the root element. **Do not use `--mat-sys-*` tokens** — those are M3 system tokens that this M2 setup never emits; they are always undefined and fall back to hardcoded light-mode values, making text invisible in dark mode.

Use the project's own `--sm-*` CSS custom properties, defined in `src/styles.scss`, for all custom element colour rules:

| Purpose | CSS variable | Light value | Dark value |
| --- | --- | --- | --- |
| Primary text | `var(--sm-text-primary)` | `rgba(0,0,0,0.87)` | `rgba(255,255,255,0.87)` |
| Secondary text | `var(--sm-text-secondary)` | `rgba(0,0,0,0.6)` | `rgba(255,255,255,0.6)` |
| Muted / hint text | `var(--sm-text-muted)` | `#555555` | `rgba(255,255,255,0.5)` |
| Page / section headings | `var(--sm-heading-color)` | `#0d3662` (navy) | `#90b4d9` (light blue) |
| Card / panel surface | `var(--sm-surface-color)` | `#ffffff` | `#1e1e1e` |
| Alternate surface | `var(--sm-surface-alt)` | `#f5f5f5` | `#2a2a2a` |
| Borders / dividers | `var(--sm-border-color)` | `#e0e0e0` | `rgba(255,255,255,0.12)` |
| Orange-tinted surface | `var(--sm-accent-surface)` | `#fff5e6` | `#2a1800` |
| Orange text on light surfaces | `var(--sm-accent-text)` | `#b55800` | `#e17000` |
| Loading overlay | `var(--sm-overlay-bg)` | `rgba(255,255,255,0.95)` | `rgba(18,18,18,0.95)` |
| Error text | `var(--sm-error-color)` | `#b00020` | `#ef5350` |

Theme-agnostic tokens, the same in both modes: `--sm-brand-orange` (`#e17000`), `--sm-image-dim` (lightbox backdrop), `--sm-modal-scrim` (modal backdrop), `--sm-overlay-close` (lightbox close-button hover).

**Brand accent colour** — `#e17000` (orange), also available as `var(--sm-brand-orange)`. Use this for icons, badges, labels, and interactive highlights. It must remain consistent in both light and dark modes; most existing styles write it as a hardcoded `#e17000`, which is fine for this one colour.

Example pattern:

```scss
// ✅ Correct — adapts automatically to light and dark
.title       { color: var(--sm-heading-color); }
.description { color: var(--sm-text-muted); }
.card        { border: 1px solid var(--sm-border-color); background: var(--sm-surface-color); }

// ✅ Correct — brand accent, same in both modes
.icon { color: #e17000; }

// ❌ Wrong — --mat-sys-* tokens are M3-only and undefined in this M2 theme;
//            always falls back to the hardcoded value, invisible in dark mode
.label { color: var(--mat-sys-on-surface-variant, #555); }

// ❌ Wrong — hardcoded colour breaks dark mode
.label { color: #555; }
```

The `--mat-sys-*` tokens are **only** safe when overriding Angular Material's own component tokens (e.g. `--mdc-chip-label-text-color`), because Material resolves those internally. Never use them on plain HTML elements (`<p>`, `<h2>`, `<span>`, etc.).

### Auth & RBAC

Roles live in Keycloak as **client roles** scoped to `stickermap-client` with the `sm-` prefix (avoids collision with Keycloak built-ins). They are hierarchical composite roles in Keycloak:

```text
sm-admin ⊇ sm-editor ⊇ sm-uploader ⊇ sm-viewer
```

- `sm-viewer` — read-only access, plus reporting a sticker as removed
- `sm-uploader` — can upload and edit their own stickers (`uploaded_by` = `preferred_username`), and propose categories
- `sm-editor` — can edit, archive and export any sticker, review removal reports, and manage categories
- `sm-admin` — can delete stickers, change the uploader field, approve categories, and use the admin dashboard

Backend enforces roles via `require_role()` dependency; it reads `resource_access.<KEYCLOAK_CLIENT_ID>.roles` from the decoded JWT. Frontend hides/shows UI elements via `AuthService.isX()` computed signals, which call `hasClientRole()` reading `resource_access.<clientId>.roles` from the token payload. Because composite roles are configured in Keycloak, a user with `sm-editor` also passes `isUploader()` checks. The route guards (`authGuard`, `moderatorGuard` for editor/admin, `adminGuard`) only keep users out of pages; the backend check is the real one. UI that calls a role-protected endpoint must be gated with the matching `isX()` signal, or anonymous visitors trigger 401s.

Group structure in the realm export: a `stickermap` parent group with sub-groups `/stickermap/sm-viewer`, `/stickermap/sm-uploader`, `/stickermap/sm-editor`, `/stickermap/sm-admin` — each with the corresponding client role assigned. `/stickermap/sm-viewer` is set as the realm's default group so all new users receive viewer access automatically.

### Database

PostGIS with SRID 4326. Sticker locations are stored as **`geography(Point, 4326)`**, not `geometry`, so `ST_Distance` returns metres on the spheroid; cast with `location::geometry` where a function needs geometry (e.g. `ST_X`/`ST_Y`). Points are built with `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`. Timestamps are `TIMESTAMP` without time zone and hold UTC.

- **`stickers`** — `id`, `location`, `poster` (free text: who stuck it), `uploader` (display name), `post_date` (when it was stuck; an unknown date is stored as a 1970-01-01 sentinel, see `isEpochSentinel()` in `shared/utils/date-utils.ts`), `upload_date`, `image` / `thumbnail` (filenames under `UPLOAD_DIR`), `uploaded_by` (Keycloak `preferred_username`), `updated_at`, `spotted_count`, `archived` (hidden from the map), `category_id`, `private` (hidden from non-viewers), `extra_info` (`VARCHAR(256)`, optional free-text note).
- **`removal_reports`** — one report per sticker per user; `review_status` is `pending`, `confirmed` (which archives the sticker) or `dismissed`.
- **`categories`** — unique `name`, optional icon under `uploads/categories/`, `approved`, `archived_at`.

Migrations live in `database_migrations/` (Alembic, its own uv project and container image). Revisions are numbered `0001` … `0009`, mostly written as raw SQL via `op.execute`, and must implement `downgrade()`.

### Distances and the "Farthest from HQ" leaderboard

- **HQ** is configured on the backend with `HQ_LAT` / `HQ_LON` (Helm `backend.env.hqLat` / `hqLon`). The default, `52.155174` / `5.387206`, is the Onze Lieve Vrouwetoren in Amersfoort, the origin of the Dutch national grid. **Never commit a deployment's real HQ coordinates** — not as a default, in docs, in the changelog or in test data; deployments set them through the env vars. The frontend never hard-codes a location: the map gets HQ from **`GET /api/v1/hq`** (`sm-viewer`) and uses it as its fallback start (no stickers, or the add-sticker picker without a known location), with a world view for anonymous visitors.
- **`GET /api/v1/leaderboard/distance?period=all|year|half`** (`sm-viewer`) returns the top 10 posters by their farthest sticker (`DISTINCT ON (poster)`), as a JSON object with `distance_m`. `year` and `half` filter on `post_date` from 1 January / 1 July (UTC) of the current year, so unknown-date stickers only count for `all`. Archived stickers and stickers without a poster are excluded; private ones count.
- **One distance model everywhere:** the leaderboard uses `ST_Distance(…, false)` (great circle on a sphere) and the map computes distances in the browser with MapLibre's `LngLat.distanceTo()` (sphere, R = 6,371,008.8 m); the two agree to under a metre. Change both or neither — the spheroid differs by up to ~0.5%, which shows up as different numbers on the home page and the map.
- **Map:** a "Distance" menu, below the category and poster filters in the top-right card: off, farthest from HQ, from HQ to every sticker shown, or between two stickers. The HQ options are viewer-only and draw to the stickers the category and poster filters leave visible; measuring works for everyone and makes marker clicks pick stickers instead of opening popups. The last line mode is remembered in localStorage (`stickermap-distance-mode`); measuring is never stored. Per-sticker distance tags appear only while at most `MAX_DISTANCE_TAGS` (25) stickers are shown, and the popup shows "Distance from HQ" for viewers. Labels go halfway along a line at the Web Mercator midpoint, and lines that would cross the antimeridian take the short way round.
- **Home page:** the leaderboard card with a period toggle; rows open `/map?id=<sticker>`. Format distances with `formatDistance()` from `shared/utils/distance-utils.ts`.
- `poster` is free text: the leaderboard matches it exactly, so name variants rank separately (the same as "Most active poster" in `/stats`); the map's poster filter trims whitespace.

### Helm Chart (`helm/stickermap/`)

Single flat chart — **requires Helm v4** (`apiVersion: v2`). No sub-charts or external dependencies; all component templates are inlined under `templates/` (air-gap friendly). It deploys only the **backend**, the **frontend** and the **migrations** hook Job. PostgreSQL + PostGIS and Keycloak are **external**.

- **Database credentials:** `database.existingSecretName` (e.g. a CloudNativePG `<cluster>-app` secret with keys `host`, `port`, `dbname`, `username`, `password`), or raw `database.*` values from which the chart creates `<release>-db-stickermap`.
- **Keycloak:** always external. Set `keycloak.url` (public); `keycloak.internalUrl` optionally gives the backend a cluster-internal URL for the JWKS fetch.
- **Backend settings** live under `backend.env.*` and map one-to-one to env vars (e.g. `imageFormat` → `IMAGE_FORMAT`, `hqLat` → `HQ_LAT`). A new backend env var needs a default in `values.yaml`, an entry in `templates/backend/deployment.yaml`, a row in `helm/README.md`, and an entry in `compose.yml` and `.env.example`.
- **Migrations** run as a post-install/post-upgrade hook Job, with retries for database availability lag.
- **Frontend:** the container's entrypoint copies the SPA into an emptyDir at `/srv` and runs ngssc there before Caddy starts. There is no init container.

CI publishes the chart to `oci://ghcr.io/<repo>/stickermap-helm` (`build-helm.yml`) and to a Helm repository on GitHub Pages (`publish-helm-pages.yml` + `deploy-pages.yml`). See `helm/README.md` for mandatory values, installation examples, and OCI packaging.

### Changelog & Releases

`CHANGELOG.md` is the single source for three audiences. Every release block starts with a **`### Highlights`** section written for people using the app, followed by the usual `Added`/`Changed`/`Fixed`/`Security` sections holding the technical record.

```text
CHANGELOG.md
├── ### Highlights   → changelog.model.ts → in-app "what's new" dialog (end users)
│                    → top of the GitHub release body
└── ### Added/…      → collapsed <details> in the GitHub release body
                     → the full technical history, read on GitHub
```

**Writing a `Highlights` entry** — this text is shown to sticker spotters, not developers:

- Lead with what the user can now do, using the name that appears on screen ("Add a note to your stickers", not "Optional `extra_info` column").
- No identifiers, file paths, function names, migration numbers, or dependency version ranges.
- One to three sentences per bullet, and **no nested bullets** — `generate_changelog_model()` only picks up top-level `- ` items, so sub-bullets are silently dropped from the dialog.
- Dependency-only releases collapse to a single line: "Security updates to third-party libraries. Nothing changes in how the app works."
- Deployment-only changes still get a bullet, prefixed **"For self-hosters:"**, so no release renders empty.
- `**bold**` and `` `code` `` are converted to `<strong>`/`<code>` because the dialog binds items with `[innerHTML]`. Other markdown (links, italics, nested lists) is **not** converted and will render as literal characters.

**Never edit `frontend/src/app/core/models/changelog.model.ts` by hand** — it is generated by `uv run general/scripts/bump-version.py <version>`. Re-running the script with the current version skips the changelog and only refreshes the model, but the model is built from **every** block that has a `Highlights` section, including `## [Unreleased]`. Do not refresh it while `[Unreleased]` has content, or the in-app dialog gains an "Unreleased" entry; let the release step regenerate it.

The script warns (but does not fail) when the release being cut has no `Highlights` section. Treat that warning as a blocker — without it, both the dialog and the release notes are empty for that version.

**Release flow:**

1. Write the entry under `## [Unreleased]` — highlights *and* technical sections.
2. `uv run general/scripts/bump-version.py <version>` — bumps all version files, dates the release, regenerates the model.
3. Push a semver tag. `build-images.yml` and `build-helm.yml` publish artifacts; `release.yml` creates a **draft** GitHub Release from the changelog.
4. Review the draft on GitHub and publish it manually.

`bump-version.py <version> --release-notes` prints that release body to stdout and changes no files — useful for checking how an entry will read before tagging.

The dialog items are plain English regardless of the selected language; `@ngx-translate` covers the dialog chrome (title, buttons) but not the changelog content itself.

## Testing

There are no automated test suites in this repository (no `pytest`, no `vitest`, no GitHub Actions test job). Verify changes manually:

- **Backend** — exercise endpoints via the Swagger UI at `http://localhost:5555/api/v1/docs` once the dev stack is up. Without Keycloak, SQL and serialisation can still be checked against a migrated PostGIS: set dummy `KEYCLOAK_*` env vars, call the app through FastAPI's `TestClient`, and replace the route's `require_role` dependency via `app.dependency_overrides`.
- **Frontend** — `pnpm start` (or `podman compose up`) and click through affected flows in the browser. Test light and dark themes, both languages, and at least one mobile viewport.
- **Migrations** — `uv run alembic upgrade head` then `uv run alembic downgrade -1` to confirm both directions work against a real PostGIS DB.

Type checking and `pnpm build` / `uv run ruff check .` verify code correctness, not feature correctness — manual testing is required for behavioural changes.

**Build budgets** (`angular.json`, e.g. 7 kB per component stylesheet): keep `pnpm build` free of warnings, but raising a budget a little is fine when a feature needs it. Don't restructure code just to stay under a budget.

## Claude Code helpers

Project commands live in `.claude/commands/` (`/bump-version`, `/check-rbac` to audit route role protection against frontend gating, `/realm-import`) and subagents in `.claude/agents/` (`frontend-feature`, `helm-values`, `migration-author`).
