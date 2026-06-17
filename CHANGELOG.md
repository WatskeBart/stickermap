# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.21.3] - 2026-06-17

### Security

- Resolved Dependabot alerts via version floor raises in backend dependencies (no application code changes):
  - **Backend** — `python-multipart` 0.0.28 → 0.0.31+ floor (quadratic-time CPU DoS via semicolon querystring parsing, negative Content-Length full-body buffering, semicolon parameter smuggling, and RFC 2231/5987 Content-Disposition smuggling); `cryptography` 48.0.0 → 48.0.1+ floor (vulnerable OpenSSL bundled in wheels).
  - **Frontend** — Dependabot alert #83 (`@babel/core` ≤7.29.0, low severity, arbitrary file read via sourceMappingURL comment) cannot be resolved on Angular 21: `@babel/core ≥7.29.1` introduced strict `NumericLiteral` AST validation that breaks `@angular/build@21.2.x`'s Angular compiler plugin when processing Angular Material's fesm2022 output. The alert will be dismissed; it is addressed by upgrading to Angular 22.

## [1.21.2] - 2026-06-16

### Fixed

- Frontend CI image build failed pnpm's supply-chain `minimumReleaseAge` policy: the lockfile pinned `electron-to-chromium@1.5.374`, published within the 24-hour release-age cutoff, so `pnpm install --frozen-lockfile` aborted with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. The 1.21.1 release was cut before this fix, so its frontend image never published.

### Changed

- Pinned the pnpm supply-chain release-age policy explicitly in `frontend/pnpm-workspace.yaml` (`minimumReleaseAge: 1440`) so the build no longer inherits whatever default the floating pnpm version ships, and excluded the high-churn, low-risk browser-data packages `electron-to-chromium` and `caniuse-lite` (`minimumReleaseAgeExclude`), which are bumped multiple times daily as transitive deps and were the only entries tripping the check.

## [1.21.1] - 2026-06-16

### Security

- Resolved all open Dependabot alerts via dependency upgrades (no application code changes):
  - **Backend** — `PyJWT` 2.12.1 → 2.13.0 (algorithm allow-list bypass, unbounded Base64URL DoS, and unbounded JWKS-request DoS); `starlette` 1.0.0 → 1.3.1 (missing Host-header validation that poisoned `request.url.path`). The `starlette` floor is pinned via `[tool.uv].constraint-dependencies` since it is a transitive FastAPI dependency.
  - **Frontend** — `@angular/core`, `@angular/common`, and `@angular/compiler` 21.2.12 → 21.2.17 (template/attribute namespace XSS bypasses, `HttpTransferCache` cross-request data leakage/poisoning, and `formatDate`/`digitsInfo` OOM DoS); `hono` → 4.12.25 (routing, cookie-injection, and JWT-scheme issues); `esbuild` 0.27.3 → 0.28.1 (Deno-path RCE and Windows dev-server file read), forced via a `pnpm` override because `@angular/build` pins esbuild exactly.

## [1.21.0] - 2026-05-30

### Added

- Traefik HTTP→HTTPS redirect middleware for the Helm chart — a `Middleware` CRD resource (`traefik.io/v1alpha1`) is created when `ingress.httpRedirect: true` (the new default). The middleware is automatically wired into the `Ingress` annotations so all plain-HTTP traffic is permanently redirected to HTTPS. Disable by setting `ingress.httpRedirect: false`. Requires Traefik CRDs to be installed in the cluster.

## [1.20.0] - 2026-05-29

### Added

- Runtime i18n with Dutch and English support via `@ngx-translate/core` v17 — all user-facing strings across every feature and shared component are now translatable. Translation files live at `frontend/public/i18n/{nl,en}.json` and are served at `/i18n/*.json`. The active language is persisted in `localStorage` under the key `stickermap-lang`.
- Language switcher in the sidenav — the user can toggle between Dutch (default) and English at runtime without a page reload. Adding a new language requires only a JSON translation file and a one-line entry in `LanguageService`; the sidenav dropdown renders it automatically. See `frontend/README.md` for the step-by-step guide.

## [1.19.0] - 2026-05-26

### Changed

- Map component refactored: the edit-sticker modal extracted from `map.ts` into a standalone `EditStickerModalComponent` under `features/map/edit-sticker-modal/`, dropping ~270 lines from `map.ts`. Date-formatting helpers and the F-35 custom-cursor logic moved into reusable modules at `shared/utils/date-utils.ts` and `shared/utils/f35-cursor.ts`.

### Docs

- Root `README.md` Helm features table corrected — the chart has been external-only for both database and Keycloak since 1.17.0; the CNPG/standalone and embedded/external options described in earlier docs no longer exist.
- Frontend port `8181` added to the compose prerequisites in the root `README.md`.
- `backend/README.md` API endpoint reference expanded to cover the categories, removal-reports, admin maintenance jobs, archive/unarchive, image rotation, and export routes that previously had no documentation.
- `backend/README.md` Keycloak manual-run example switched to the `KC_BOOTSTRAP_ADMIN_USERNAME`/`KC_BOOTSTRAP_ADMIN_PASSWORD` env vars and pinned to `quay.io/keycloak/keycloak:26.6` to match `compose.yml`.
- `KEYCLOAK_CLIENT_SECRET` added to the backend env-variable table.
- `backend/.env.example` Keycloak variable renamed from the broken `KEYCLOAK_SERVER_URL` to `KEYCLOAK_URL` (the name the config code actually reads); `KEYCLOAK_INTERNAL_URL` added.
- Migration history table removed from `database_migrations/README.md` to avoid further drift — `uv run alembic history --verbose` is now the source of truth.

## [1.18.0] - 2026-05-22

### Added

- Unknown post date support (fixes #119) — upload and edit forms now include a "Date unknown" checkbox; when checked, the date field is disabled and the sticker is stored with an epoch sentinel (`1970-01-01 00:00:00`). The map popup and sticker overview recognise the sentinel and display "Unknown" instead of the raw date.
- Added pnpm overrides in pnpm-workspace.yaml.

### Changed

- Reverted OIDC session storage back to `sessionStorage` (the library default); the earlier switch to `localStorage` introduced in 1.13.0 is undone so authentication tokens are no longer persisted across browser sessions.
- Split sidenav menu items to top and bottom
- Changing to a new location will show the previous location as a blue marker.
- Changed various default zoom levels to more sensible values.

### Fixed

- Fixed some small UI issues in sticker edit and upload forms.
- Fixed bug on manual coördinate input field.

### Removed

- Removed pnpm overrides from package.json.

## [1.17.2] - 2026-05-17

### Added

- Added latest (image) tag to helm values.

### Fixed

- Fixed image name in helm values.

## [1.17.1] - 2026-05-17

### Fixed

- Set default values for helm chart to prevent template render errors.

## [1.17.0] - 2026-05-16

### Added

- Map tile-type toggle (fixes #62) — switch between street, satellite, and terrain base layers from a `mat-button-toggle-group` in the bottom-left of the map. The active selection persists in `localStorage` and switching uses MapLibre's `setTiles()` so sticker markers and custom layers remain intact. Tile URLs are injected at runtime via three independent ngssc environment variables; any layer whose URL is unset is hidden from the toggle, and the toggle itself is hidden when only one layer is configured.

### Changed

- **Tile-server environment variable split** — `TILESERVER_URL` is replaced by `TILESERVER_URL_STREET`, `TILESERVER_URL_SATELLITE`, and `TILESERVER_URL_TERRAIN`. The street layer falls back to the bundled OpenStreetMap URL when its variable is unset. Helm `frontend.tileserverUrl` becomes `frontend.tileLayers.{street,satellite,terrain}`.
- **Helm chart refactored to external-only database and Keycloak** (chart version `0.3.0`) — breaking change for existing installs:
  - Removed embedded database support (CNPG `Cluster` CR and standalone `StatefulSet`); the chart no longer manages a database. Provide credentials via `database.existingSecretName` (reference an existing Secret) or raw `database.host/port/dbname/username/password` values (chart creates the Secret).
  - Removed embedded Keycloak deployment and realm auto-import (`stickermap-realm.json`). Configure an external Keycloak via the new top-level `keycloak` section (`keycloak.url`, `keycloak.internalUrl`, `keycloak.realm`, `keycloak.clientId`).
  - `global.hostname` moved to `ingress.hostname`.
  - Keycloak connection settings (`keycloakUrl`, `keycloakInternalUrl`, `keycloakRealm`, `keycloakClientId`, `keycloakClientSecret`) removed from `backend`; replaced by the `keycloak` section and a separate Secret.
  - CORS defaults tightened: `corsAllowedOrigins` now defaults to `https://<ingress.hostname>` (was `*`); `corsAllowedMethods` and `corsAllowedHeaders` are now explicit lists instead of `*`.
  - Backend memory limit raised from `256Mi` to `512Mi`.
  - Image `pullPolicy` changed from `IfNotPresent` to `Always` for backend, migrations, and frontend.

### Removed

- Helm templates for embedded Keycloak (`deployment`, `service`, `secret`, `configmap`) and bundled realm JSON
- Helm templates for CNPG `Cluster` and standalone PostgreSQL `StatefulSet`, `ConfigMap`, `Secret`, and `Service`

### Fixed

- Category filter no longer overlaps the map controls on mobile — left offset increased from `12px` to `60px` below the 600px breakpoint

## [1.16.0] - 2026-05-16

### Added

- Admin maintenance page (`/admin`) accessible only to `sm-admin` users, with a sidenav link
  - Stats dashboard: total stickers, missing thumbnails (DB and file), missing GPS, archived, and private counts
  - File audit panel: lists stickers whose full image or thumbnail file is missing from disk
  - **Generate missing thumbnails** — creates `_thumb` files for stickers with no thumbnail on disk or in DB
  - **Compress oversized images** — re-compresses images whose longest side exceeds the configured maximum (1920 px by default); also regenerates their thumbnails
  - **Strip EXIF data** — re-saves all existing images without EXIF metadata (location, device info) for privacy; regenerates thumbnails
  - **Cleanup orphan files** — deletes files in the upload directory that are no longer referenced by any sticker or removal report
  - All maintenance jobs run as fire-and-forget background tasks; a snackbar notification is shown when a job completes or fails
- `thumbnail` column added to the `stickers` table (migration `0008`); new stickers now persist the thumbnail filename at creation time
- Sticker overview now persists the selected page size across sessions and supports sorting by category

### Changed

- Map tiles and GeoJSON are now loaded lazily so the initial map render is faster (fixes #39)

## [1.15.0] - 2026-05-16

### Added

- GeoJSON and CSV export endpoint for editors and admins (fixes #60)
- Private sticker visibility toggle: uploaders can mark a sticker as private so it is hidden from unauthenticated visitors; any authenticated user with at least `sm-viewer` can still see it. Private stickers show a lock indicator on the map marker, in popups, and in the sticker overview table (fixes #43)
- Clicking the sticker thumbnail in the map popup now opens the full-size image for unauthenticated users

### Changed

- Backend split into routers (`stickers`, `categories`, `reports`) and a `core/` module (`auth`, `config`, `connections`, `logger`) for better separation of concerns

### Fixed

- Corrected Dutch authorization message shown to unauthenticated users in the map popup

## [1.14.0] - 2026-05-14

### Added

- Sticker categories with moderator-controlled taxonomy: category selector on upload and edit, category column in the sticker overview, and a dedicated category management page guarded by a moderator role (fixes #41)

## [1.13.0] - 2026-05-14

### Changed

- Use `localStorage` instead of default `sessionStorage` for OIDC session persistence
- Migrate OIDC config to `provideAppInitializer` and `inject` API
- Cast `RSAAlgorithm.from_jwk` result to `RSAPublicKey` type in auth
- Bumped dependencies across backend, frontend, and infra

## [1.12.0] - 2026-05-10

### Added

- Archive stickers as editor or admin (fixes #97)

### Fixed

- Show sticker popup info only when authenticated
- Force white color on sidebar timestamp text
- Prevent duplicate changelog entries when running bump_version.py with an existing version

## [1.11.0] - 2026-05-09

### Added

- Report removed stickers

### Changed

- Bumped various dependencies
- Optimized Claude integration (.claude directory)

### Removed

- Removed all tests across the codebase

### Fixed

- No more horizontal scroll in sticker overview page on mobile devices

## [1.10.1] - 2026-05-06

### Fixed

- Always show sidenav tooltips regardless of expanded state
- Clear default Keycloak admin password in Helm chart values

### Changed

- Bumped postcss to ^8.5.10 in frontend overrides

## [1.10.0] - 2026-05-05

### Added

- Image rotation support: manual rotate action and automatic EXIF-based orientation on upload (fixes #85)

### Changed

- Refactored frontend UI for mobile responsiveness (fixes #87)

## [1.9.0] - 2026-05-02

### Added

- Database connection pooling for improved concurrency and resource utilisation (fixes #79)
- Targeted database indexes on frequently queried columns for improved query performance (fixes #80)
- `updated_at` column on stickers for auditability, automatically updated on every write (fixes #81)

### Fixed

- Increased backend memory limit in Helm chart values

### Changed

- Removed migration structural tests and the associated CI job

## [1.8.0] - 2026-04-19

### Added

- Release notes dialog shown on first visit after an update (fixes #66)

### Changed

- Map viewport state (center coordinates and zoom) is now encoded in URL query parameters, enabling shareable and bookmarkable map views (fixes #59)

## [1.7.0] - 2026-04-18

### Changed

- Migrated Keycloak roles from realm scope to client scope under `stickermap-client` — backend now reads `resource_access.<clientId>.roles` from JWT instead of `realm_access.roles`
- Keycloak group hierarchy restructured: `stickermap` parent group with sub-groups `/stickermap/sm-viewer`, `/stickermap/sm-uploader`, `/stickermap/sm-editor`, `/stickermap/sm-admin`; each sub-group carries the matching client role
- `/stickermap/sm-viewer` set as realm default group so all new users receive viewer access automatically (fixes #71)
- Added Helm chart CI workflow for automated chart linting and packaging
- Updated backend and frontend dependencies

## [1.6.2] - 2026-04-18

### Added

- Image processing configuration options (max dimensions, quality) configurable via environment variables

### Changed

- Migrated frontend authentication from `keycloak-angular` to `angular-auth-oidc-client` for standards-compliant OIDC support

## [1.6.1] - 2026-04-14

### Changed

- Helm chart refactored into a single flat chart with flexible database modes (`cnpg` or `standalone`) and Helm v4 support (fixes #68)
- Helm chart documentation updated for v4 requirements and new database/Keycloak configuration options

### Fixed

- Async login not working on mobile devices

### Dependencies

- Bumped `cryptography` to 46.0.7

## [1.6.0] - 2026-04-10

### Added

- Server-side image optimization: uploaded images are resized and compressed before storage (fixes #57)
- Non-GPS EXIF metadata is stripped from uploaded images to protect uploader privacy (fixes #58)

### Changed

- Map popup content is now restricted based on authentication and role — unauthenticated users see limited sticker details (fixes #61)
- Allow inline HTML in Markdown-rendered content

## [1.5.0] - 2026-04-08

### Added

- Upload disclaimer dialog shown before file upload (fixes #42)

### Changed

- Frontend restructured into `core/`, `features/`, and `shared/` layers for cleaner separation of concerns

## [1.4.0] - 2026-04-07

### Added

- F-35 silhouette custom cursor on the map that rotates to follow mouse movement
- EXIF datetime extraction independent of GPS location — sticker date/time now read from image metadata even when GPS tags are absent (fixes #45)

### Changed

- Removed info popup shown on empty map clicks
- Updated backend, frontend, and CI dependencies

### Fixed

- File upload now correctly rejects zero-byte files and guards against missing GPS EXIF tags (fixes #44)
- Upgraded `lodash` to 4.18.1 via `pnpm` override to address CVE-2026-4800 (code injection) and CVE-2026-2950 (prototype pollution)
- Various transitive dependency security updates (Dependabot)

## [1.3.5] - 2026-04-01

### Changed

- Keycloak `onLoad` set to `login-required` to always show the login form instead of attempting silent authentication

## [1.3.4] - 2026-04-01

### Fixed

- Uploader stats displayed `preferred_username` instead of first and last name

## [1.3.3] - 2026-03-31

### Fixed

- Removed silent SSO check (`silent-check-sso.html`) and disabled `checkLoginIframe` to fix authentication failures in mobile browsers caused by iframe restrictions

## [1.3.2] - 2026-03-22

### Changed

- Migrated JWT library from `python-jose` to `PyJWT` (`import jwt`) with `cryptography` backend for JWKS key handling
- Updated frontend dependencies

### Fixed

- Backend tests updated to pass authenticated user context in API test fixtures

## [1.3.1] - 2026-03-22

### Added

- `isViewer()` role checks in `AuthService`; UI elements gated on viewer role
- Dark-mode CSS custom properties added to global styles and component stylesheets
- Backend `/api/v1/stickers` (public endpoint) now restricts PII fields (`uploaded_by`) to authenticated viewers

### Fixed

- `PUBLIC_URL` default port in `compose.yml` aligned with `KEYCLOAK_URL` (both now use `8282`)
- Reverted backend and database_migrations Dockerfiles to `uv pip install --system` (fixes regression from 1.3.0)
- Typo in backend/database_migrations Dockerfiles

### Docs

- Removed incorrect note about `sm-viewer` being a default role for new users

## [1.3.0] - 2026-03-18

### Added

- OCI image labels (`title`, `version`, `source`, `authors`) to all Dockerfiles
- `.dockerignore` for the `database_migrations` service
- `CMD` instruction to frontend Dockerfile; `entrypoint.sh` now uses `exec "$@"` for proper signal handling

### Changed

- Renamed `FQDN` env var to `PUBLIC_URL` (now a full URL including protocol, e.g. `https://localhost`) in Caddyfile, Compose files, and `.env.example`
- Switched from `uv pip install --system` to `uv sync --no-dev --no-install-project` in backend and database\_migrations Dockerfiles
- Dev Compose (`compose.yml`) now uses `tmpfs` for Caddy data/config/srv volumes instead of named volumes
- Frontend container user changed from `1000` to `11953` with OpenShift-compatible group permissions (`g=u`)
- Expanded `.gitattributes` to enforce LF line endings for all text file types and mark lock files as generated
- `bump-version.sh` now also patches the `ARG IMAGE_VERSION` in all Dockerfiles

## [1.2.0] - 2026-03-15

### Added

- Sticker overview page with sortable/filterable table, inline editing, and bulk delete
- Edit sticker dialog component for updating sticker fields
- Bulk delete dialog with confirmation
- Dark theme support with a theme toggle (persisted via `ThemeService`)
- Map deep-linking: URL hash updates on map move/zoom and restores position on load
- Statistics dashboard on the landing page showing sticker counts per uploader and total
- New backend endpoint `GET /api/v1/stats` returning sticker statistics
- `StickerStats` and `UploaderStat` models added to the frontend

### Changed

- Landing page layout updated to accommodate the statistics dashboard
- Map component extended with deep-link hash handling and sticker overview navigation
- App routing updated to include the sticker overview route

## [1.1.0] - 2026-03-14

### Added

- Angular Material library integrated into the frontend UI components
- Database migration support via Alembic for schema versioning
- CI workflow to automatically bump version across all project files

### Changed

- Refactored backend to separate models from services for cleaner code structure
- Refactored frontend configuration and removed unused datasets
- Caddy now runs as an unprivileged user with adjusted port configuration
- Updated environment variable example file

### Fixed

- Helm chart packaging and global values corrected
- Frontend container image: fixed Dockerfile and entrypoint script for proper file handling and permissions
- Backend tests updated to work with the new Alembic migration setup

### Docs

- Updated README with improved layout and badge visibility
- Added authentication troubleshooting guide to README

### Dependencies

- Bumped `tar` and `hono` frontend packages (Dependabot)
- Updated `uv.lock`

## [1.0.0] - 2026-03-08

- Initial release of StickerMap — an interactive map for pinning and sharing stickers
- FastAPI backend with PostGIS for geospatial sticker storage
- Angular frontend with Leaflet map integration
- Keycloak authentication with role-based access control (`sm-viewer`, `sm-uploader`, `sm-editor`, `sm-admin`)
- Helm chart for Kubernetes deployment (umbrella chart with backend, frontend, keycloak, database sub-charts)
- Docker Compose setup for local development
- CI pipeline with BuildKit-based container image builds
- Dependabot configured for automated dependency updates

[unreleased]: https://github.com/WatskeBart/stickermap/compare/1.21.2...HEAD
[1.21.2]: https://github.com/WatskeBart/stickermap/compare/1.21.1...1.21.2
[1.21.1]: https://github.com/WatskeBart/stickermap/compare/1.21.0...1.21.1
[1.21.0]: https://github.com/WatskeBart/stickermap/compare/1.20.0...1.21.0
[1.20.0]: https://github.com/WatskeBart/stickermap/compare/1.19.0...1.20.0
[1.19.0]: https://github.com/WatskeBart/stickermap/compare/1.18.0...1.19.0
[1.18.0]: https://github.com/WatskeBart/stickermap/compare/1.17.2...1.18.0
[1.17.2]: https://github.com/WatskeBart/stickermap/compare/1.17.1...1.17.2
[1.17.1]: https://github.com/WatskeBart/stickermap/compare/1.17.0...1.17.1
[1.17.0]: https://github.com/WatskeBart/stickermap/compare/1.16.0...1.17.0
[1.16.0]: https://github.com/WatskeBart/stickermap/compare/1.15.0...1.16.0
[1.15.0]: https://github.com/WatskeBart/stickermap/compare/1.14.0...1.15.0
[1.14.0]: https://github.com/WatskeBart/stickermap/compare/1.13.0...1.14.0
[1.13.0]: https://github.com/WatskeBart/stickermap/compare/1.12.0...1.13.0
[1.12.0]: https://github.com/WatskeBart/stickermap/compare/1.11.0...1.12.0
[1.11.0]: https://github.com/WatskeBart/stickermap/compare/1.10.1...1.11.0
[1.10.1]: https://github.com/WatskeBart/stickermap/compare/1.10.1...1.10.1
[1.10.0]: https://github.com/WatskeBart/stickermap/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/WatskeBart/stickermap/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/WatskeBart/stickermap/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/WatskeBart/stickermap/compare/1.6.2...1.7.0
[1.6.2]: https://github.com/WatskeBart/stickermap/compare/1.6.1...1.6.2
[1.6.1]: https://github.com/WatskeBart/stickermap/compare/1.6.0...1.6.1
[1.6.0]: https://github.com/WatskeBart/stickermap/compare/1.5.0...1.6.0
[1.5.0]: https://github.com/WatskeBart/stickermap/compare/1.4.0...1.5.0
[1.4.0]: https://github.com/WatskeBart/stickermap/compare/1.3.5...1.4.0
[1.3.5]: https://github.com/WatskeBart/stickermap/compare/1.3.4...1.3.5
[1.3.4]: https://github.com/WatskeBart/stickermap/compare/1.3.3...1.3.4
[1.3.3]: https://github.com/WatskeBart/stickermap/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/WatskeBart/stickermap/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/WatskeBart/stickermap/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/WatskeBart/stickermap/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/WatskeBart/stickermap/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/WatskeBart/stickermap/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/WatskeBart/stickermap/releases/tag/1.0.0
