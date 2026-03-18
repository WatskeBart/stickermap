# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/WatskeBart/stickermap/compare/1.3.0...HEAD
[1.3.0]: https://github.com/WatskeBart/stickermap/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/WatskeBart/stickermap/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/WatskeBart/stickermap/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/WatskeBart/stickermap/releases/tag/1.0.0
