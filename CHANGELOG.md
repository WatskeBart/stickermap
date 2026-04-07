# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/WatskeBart/stickermap/compare/1.4.0...HEAD
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
