<h1 align="center">
StickerMap
</h1>

<p align="center">
<a href="https://github.com/WatskeBart/stickermap/actions/workflows/build-images.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/WatskeBart/stickermap/build-images.yml?branch=develop" />
</a>
<a href="https://github.com/WatskeBart/stickermap/releases">
  <img src="https://img.shields.io/github/v/release/WatskeBart/stickermap?style=flat-square&color=fb8237&labelColor=1f1f1f" alt="Latest Release" />
</a>
<a href="https://github.com/WatskeBart/stickermap/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL3-green?style=flat-square&color=d4fb37&labelColor=1f1f1f" alt="AGPL3 License" />
</a>
<a href="https://github.com/WatskeBart/stickermap/issues">
    <img src="https://img.shields.io/github/issues/WatskeBart/stickermap?style=flat-square&color=fb5437&labelColor=1f1f1f" alt="Issues" />
  </a>
</p>

<p align="center">
A web application for uploading, viewing, and managing sticker locations across the world with automatic GPS extraction from images.
</p>

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development Setup](#development-setup)
- [Container Deployment](#container-deployment)
- [Authentication](#authentication)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Overview

StickerMap allows users to:

- Upload sticker images with automatic GPS extraction from EXIF metadata
- Manually select locations on an interactive map
- View all stickers on a world map with custom markers
- Authenticate using Keycloak for secure access

### Technology Stack

**Frontend:**

- Angular 21 with standalone components (zoneless)
- TypeScript 5.9
- MapLibre GL 5.x for interactive maps
- Keycloak integration for authentication

**Backend:**

- Python 3.14
- FastAPI framework
- PostgreSQL with PostGIS extension
- JWT token validation

**Authentication:**

- Keycloak for identity and access management
- JWT tokens with RS256 algorithm
- Automatic token refresh

## Quick Start

### Prerequisites

- Podman
- At least 4GB of available RAM
- Ports 5432, 5555, 8080, and 8282 available

### Using Containers (Recommended)

Two compose files are provided:

| File | Description |
| ---- | ----------- |
| `compose.yml` | Builds images from local source code (development / CI) |
| `compose.prod.yml` | Uses pre-built images from `ghcr.io/watskebart/stickermap/stickermap-*:main` (production) |

**Build from source:**

1. **Start all services:**

    ```bash
    # From project root directory
    podman compose up -d
    ```

2. **Wait for services to initialize** (30-60 seconds). The Keycloak realm is imported automatically.

**Using pre-built images (production):**

1. **Start all services:**

    ```bash
    podman compose -f compose.prod.yml up -d
    ```

2. **Wait for services to initialize** (30-60 seconds).

3. **Import the Keycloak realm manually:**
   - Navigate to the Keycloak Admin Console (see below)
   - Go to **Realm settings** > import realm
   - Upload `general/extra/stickermap-realm.json`

**Access the application:**

- **Application**: <https://localhost:8282>
- **API Documentation**: <http://localhost:5555/api/v1/docs>
- **Keycloak Admin**: <https://localhost:8282/auth>

### Stop the Application

```bash
# Build version
podman compose down

# Production version
podman compose -f compose.prod.yml down
```

## Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────┐
│  Frontend (Angular)                                     │
│  - Landing page                                         │
│  - Map view (public)                                    │
│  - Add sticker (protected)                              │
│  - Keycloak authentication                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP/JSON + JWT
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (FastAPI)                                      │
│  - Image upload with GPS extraction                     │
│  - JWT token validation                                 │
│  - Public & protected endpoints                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL + PostGIS                                   │
│  - Geographic data storage (SRID 4326)                  │
│  - Spatial indexing                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Keycloak                                               │
│  - User management                                      │
│  - JWT token issuance                                   │
│  - SSO/Federation                                       │
└─────────────────────────────────────────────────────────┘
```

### Component Architecture

**Frontend Components:**

- **LandingComponent** (`/`) - Entry point with navigation cards
- **MapViewComponent** (`/map`) - View all stickers on map (public)
- **AddStickerViewComponent** (`/add-sticker`) - Upload stickers (protected)
- **StickerFormComponent** - Form with image upload and GPS extraction
- **MapComponent** - Dual-mode MapLibre map (view/selection)

**Backend Modules:**

- **main.py** - FastAPI app with API router at `/api/v1`
- **auth.py** - JWT validation and Keycloak integration
- **file_handlers.py** - Image upload processing and GPS extraction
- **models.py** - Pydantic models for request validation

### Database Schema

```sql
stickers table:
  - id (serial primary key)
  - location (geography point, SRID 4326)
  - poster (varchar) - sticker creator name
  - uploader (varchar) - person who uploaded
  - post_date (timestamp) - when sticker was posted
  - upload_date (timestamp) - when record was created
  - image (varchar) - image filename
```

## Development Setup

### Backend Setup

```bash
cd backend

# Install dependencies
uv sync

# Create Podman network
podman network create stickermap

# Start PostgreSQL with PostGIS
podman run --name stickermap-postgis -d --network stickermap -p 5432:5432 \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=stickermap \
  docker.io/postgis/postgis:18-3.6

# Start Keycloak
podman run --name stickermap-keycloak -d --network stickermap -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.5 start-dev

# Wait 30-60 seconds for Keycloak to start

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

### Frontend Setup

```bash
cd frontend

# Install dependencies
pnpm install

# Run development server (with proxy)
pnpm start
```

Frontend runs at: <http://localhost:4200>

## Container Deployment

The application provides two compose files in the project root:

- **`compose.yml`** — builds all images from local source code. Use this for development or building custom images.
- **`compose.prod.yml`** — pulls pre-built images from `ghcr.io/watskebart/stickermap/stickermap-*:main`. Use this for production deployments without a local build environment.

### Service Details

**PostGIS:**

- Image: `docker.io/postgis/postgis:18-3.6`
- Container: `stickermap-postgis`
- Port: 5432
- Volume: `postgis_data`

**Keycloak:**

- Image: `quay.io/keycloak/keycloak:26.5`
- Container: `stickermap-keycloak`
- Port: 8080
- `compose.yml`: realm automatically imported from `general/extra/stickermap-realm.json`
- `compose.prod.yml`: no automatic import — upload `general/extra/stickermap-realm.json` manually via the Keycloak Admin Console

**Backend:**

- `compose.yml` — Build: `./backend/Dockerfile`
- `compose.prod.yml` — Image: `ghcr.io/watskebart/stickermap/stickermap-backend:main`
- Container: `stickermap-backend`
- Port: 5555
- Volume: `backend_uploads`

**Frontend:**

- `compose.yml` — Build: `./frontend/Dockerfile`
- `compose.prod.yml` — Image: `ghcr.io/watskebart/stickermap/stickermap-frontend:main`
- Container: `stickermap-frontend`
- Port: 8282
- Web server: Caddy

### Common Commands

```bash
# View logs
podman compose logs -f backend

# Rebuild services
podman compose build
podman compose up -d --build

# Access backend shell
podman exec -it stickermap-backend /bin/bash

# Access database
podman exec -it stickermap-postgis psql -U user -d stickermap

# Stop and remove all data (WARNING)
podman compose down -v
```

### Production Deployment

For production:

1. Use environment files for sensitive data
2. Enable HTTPS with SSL certificates
3. Set strong passwords for all services
4. Configure backup strategy for volumes
5. Set resource limits for containers
6. Use production Keycloak configuration
7. Consider systemd service for auto-restart

Example systemd service:

```bash
# Generate systemd unit files
podman generate systemd --new --name stickermap-backend > /etc/systemd/system/stickermap-backend.service

# Enable and start
systemctl enable --now stickermap-backend
```

## Authentication

### Keycloak Overview

StickerMap uses Keycloak for authentication and role-based authorization:

- **Protected routes**: `/add-sticker` requires authentication
- **Public routes**: `/`, `/map` accessible to all
- **Role-protected endpoints**: Upload and create sticker (uploader+), update sticker (uploader for own / editor+ for any), delete sticker (admin only)
- **Public endpoints**: View stickers endpoints

### Roles

StickerMap uses four hierarchical realm roles (each higher role inherits lower permissions):

| Role | Name | Permissions |
| ---- | ---- | ----------- |
| Viewer | `sm-viewer` | View all sticker details (default for all users) |
| Uploader | `sm-uploader` | Upload new stickers and edit own stickers |
| Editor | `sm-editor` | Edit any sticker's poster name, post date, and location |
| Administrator | `sm-admin` | Edit all sticker fields, delete stickers and their images |

The hierarchy is implemented via Keycloak composite roles:

- `sm-admin` includes `sm-editor`
- `sm-editor` includes `sm-uploader`
- `sm-uploader` includes `sm-viewer`
- `sm-viewer` is included in the default realm roles (all new users get it automatically)

### Authentication Flow

1. **App initialization**: Silent SSO check on page load
2. **Protected route access**: AuthGuard checks authentication
3. **Login redirect**: If not authenticated, redirects to Keycloak
4. **Token storage**: Access and refresh tokens stored in localStorage
5. **Auto-refresh**: Tokens refreshed automatically (checks every 60s)
6. **API requests**: AuthInterceptor adds Bearer token to all requests
7. **Backend validation**: FastAPI validates JWT signature, claims, and realm roles

### Keycloak Configuration

**Manual Setup Steps:**

1. Create realm: `stickermap`
2. Create client: `stickermap-client` (OpenID Connect, public)
3. Configure redirect URIs: `http://localhost:4200/*`
4. Configure web origins: `http://localhost:4200`
5. Enable standard flow and direct access grants
6. Create application roles (see below)
7. Create test users with verified emails and assign roles

**Or use the realm export (recommended):**

- Import `general/extra/stickermap-realm.json` via admin console (includes all roles pre-configured)

#### Manual Role Setup

If not using the realm export, create roles manually in Keycloak:

1. Navigate to **Realm roles** in the admin console
2. Create role `sm-viewer`:
   - Description: "Can view sticker details"
3. Create role `sm-uploader`:
   - Description: "Can upload new stickers and edit own stickers"
   - Enable **Composite Roles** and add `sm-viewer`
4. Create role `sm-editor`:
   - Description: "Can edit any sticker's poster, date, and location"
   - Enable **Composite Roles** and add `sm-uploader`
5. Create role `sm-admin`:
   - Description: "Full access: edit all fields and delete stickers"
   - Enable **Composite Roles** and add `sm-editor`
6. Add `sm-viewer` to the default roles:
   - Navigate to **Realm settings** > **User registration** > **Default roles**
   - Add `sm-viewer` to the default realm roles

#### Assigning Roles to Users

1. Navigate to **Users** > select a user
2. Go to the **Role mapping** tab
3. Click **Assign role**
4. Select the desired role (`sm-viewer`, `sm-uploader`, `sm-editor`, or `sm-admin`)
5. Click **Assign**

Note: Only assign the highest needed role. Composite roles automatically grant lower permissions (e.g., assigning `sm-admin` also grants `sm-editor` and `sm-viewer`).

### Security Features

- RS256 asymmetric encryption
- Token signature validation with Keycloak public keys
- Automatic token refresh mechanism
- Protected routes with AuthGuard
- HTTP interceptor for token injection
- Role-based access control with backend enforcement
- 401/403 error handling with re-login

## API Documentation

### Endpoints

**Public Endpoints:**

```api
GET  /api/v1/
     Returns API welcome message

GET  /api/v1/get_all_stickers
     Returns all stickers with GeoJSON locations

GET  /api/v1/get_sticker/{id}
     Returns single sticker by ID
```

**Role-Protected Endpoints:**

```api
POST  /api/v1/upload            (requires sm-uploader role)
      Upload image with automatic EXIF GPS extraction
      Form data: file, uploader
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
       JSON body: UpdateStickerRequest (all fields optional)

DELETE /api/v1/sticker/{id}    (requires sm-admin role)
       Delete sticker and associated image file
```

**Static Files:**

```api
GET  /uploads/{filename}
     Serve uploaded image files (public)
```

### Swagger UI

Interactive API documentation: <http://localhost:5555/api/v1/docs>

### Example Requests

**Upload image:**

```bash
curl -X POST http://localhost:5555/api/v1/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@photo.jpg" \
  -F "uploader=John Doe"
```

**Create sticker:**

```bash
curl -X POST http://localhost:5555/api/v1/create_sticker \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stickers": [{
      "location": {"lon": -74.006, "lat": 40.7128},
      "poster": "Artist Name",
      "uploader": "John Doe",
      "post_date": "2024-01-04T12:00:00Z",
      "image": "photo.jpg"
    }]
  }'
```

**Get all stickers:**

```bash
curl http://localhost:5555/api/v1/get_all_stickers
```

## Troubleshooting

### Common Issues

**Port conflicts:**

- Solution: Change port mappings in `compose.yml` or `compose.prod.yml`

**Database connection errors:**

```bash
# Check if database is running
podman ps | grep stickermap-postgis

# Restart backend
podman compose restart backend
```

**CORS errors:**

- Verify CORS middleware in `backend/main.py`
- Check `allow_origins` includes frontend URL

**Image upload fails:**

- Check file size (max 16MB)
- Verify file type (JPEG, PNG, GIF, WebP)
- Ensure `uploads/` directory exists and is writable

**No GPS data extracted:**

- Verify image has GPS EXIF data
- Some platforms strip EXIF on upload
- Use original camera photos

**Map not loading:**

- Check browser console for errors
- Verify Leaflet CSS is loaded
- Check network tab for failed tile requests

**Keycloak authentication fails:**

- Verify Keycloak is running: `podman ps | grep stickermap-keycloak`
- Check realm and client exist in admin console
- Verify redirect URIs include: `http://localhost:4200/*`
- Clear browser cache and localStorage

**Token validation fails (401 errors):**

- Verify JWKS endpoint accessible: `curl http://localhost:8080/realms/stickermap/protocol/openid-connect/certs`
- Check `KEYCLOAK_SERVER_URL` in backend `.env`
- Verify client ID matches in all configs

**Infinite redirect loop:**

- Clear localStorage and sessionStorage
- Check for conflicting redirect URIs
- Temporarily change `onLoad: 'check-sso'` to `onLoad: 'login-required'`

### Debug Mode

**Backend verbose logging:**

Set `LOG_LEVEL=DEBUG` in `backend/.env` (or as an environment variable in `compose.yml`) to enable verbose output from all backend modules:

```bash
# backend/.env
LOG_LEVEL=DEBUG
```

Or pass it directly when running uvicorn:

```bash
uv run uvicorn main:app --port 5555 --reload
```

Valid values for `LOG_LEVEL`: `DEBUG`, `INFO` (default), `WARNING`, `ERROR`.

**View container logs:**

```bash
podman compose logs -f backend
podman logs stickermap-keycloak
```

**Database queries:**

```bash
# Connect to database
podman exec -it stickermap-postgis psql -U user -d stickermap

# View all stickers
SELECT id, poster, ST_AsText(location) FROM stickers;

# Check PostGIS version
SELECT PostGIS_Version();
```

### Data Backup

**Backup database:**

```bash
podman exec stickermap-postgis pg_dump -U user stickermap > backup.sql
```

**Restore database:**

```bash
cat backup.sql | podman exec -i stickermap-postgis psql -U user -d stickermap
```

**Backup uploads:**

```bash
podman run --rm -v backend_uploads:/data -v $(pwd):/backup:Z alpine \
  tar czf /backup/uploads-backup.tar.gz -C /data .
```

## Additional Resources

- [Podman Documentation](https://docs.podman.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Angular Documentation](https://angular.dev/)
- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [PostGIS Documentation](https://postgis.net/documentation/)

## License

See LICENSE file for details.
