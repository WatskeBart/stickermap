# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Refactored backend to separate models from services for cleaner code structure
- Bumped frontend dependencies (tar, hono)
- Added backend tests badge to README

## [1.0.0] - 2026-03-08

- Initial release of StickerMap — an interactive map for pinning and sharing stickers
- FastAPI backend with PostGIS for geospatial sticker storage
- Angular frontend with Leaflet map integration
- Keycloak authentication with role-based access control (`sm-viewer`, `sm-uploader`, `sm-editor`, `sm-admin`)
- Helm chart for Kubernetes deployment (umbrella chart with backend, frontend, keycloak, database sub-charts)
- Docker Compose setup for local development
- CI pipeline with BuildKit-based container image builds
- Dependabot configured for automated dependency updates

[unreleased]: https://github.com/WatskeBart/stickermap/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/WatskeBart/stickermap/releases/tag/v1.0.0
