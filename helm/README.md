# StickerMap Helm Chart

Helm chart for deploying StickerMap on Kubernetes.

**Components deployed by this chart:**

| Component | Description |
| --- | --- |
| `backend` | FastAPI application (port 5555) |
| `frontend` | Angular SPA served by Caddy (port 8181 http) |
| `migrations` | Alembic migration Job (post-install/post-upgrade hook) |

**Not included — manage these externally:**

| Component | Notes |
| --- | --- |
| Database | Any PostgreSQL + PostGIS instance; provide credentials via secret or values |
| Keycloak | Any Keycloak instance; set `keycloak.url` |

All traffic enters through a single Ingress. Path-based routing directs requests to the appropriate service:

- `/api/v1*`, `/uploads/*` → backend
- `/*` → frontend (SPA)

## Prerequisites

- An Ingress controller (default: `traefik`)
- All container images available in your registry
- A running PostgreSQL + PostGIS database
- A running Keycloak instance with the `stickermap` realm configured

## Helm v4

This chart requires Helm v4 (`apiVersion: v2` in Chart.yaml). No `helm dependency build` step is needed — all templates are inlined directly under `templates/`.

## Database Credentials

Provide database credentials using one of two approaches:

### Option A — Reference an existing Secret

Set `database.existingSecretName` to the name of a pre-existing Kubernetes Secret. The secret must contain the keys: `host`, `port`, `dbname`, `username`, `password`.

```yaml
database:
  existingSecretName: "my-db-secret"
```

### Option B — Raw values (chart creates the Secret)

Leave `database.existingSecretName` empty and provide the connection details directly. The chart creates a Secret named `<release>-db-stickermap`.

```yaml
database:
  host: "postgres.example.com"
  port: "5432"
  dbname: "stickermap"
  username: "stickermap"
  password: "changeme"
```

## Keycloak Configuration

The chart always uses an external Keycloak. Set `keycloak.url` to the public URL of your Keycloak instance — both backend and frontend use this. The backend additionally uses `keycloak.internalUrl` for server-side JWKS/token validation when set, falling back to `keycloak.url`.

```yaml
keycloak:
  url: "https://auth.example.com"
  internalUrl: "http://keycloak.keycloak.svc.cluster.local:8080"  # optional
  realm: "stickermap"
  clientId: "stickermap-client"
```

## Database Migrations

Migrations run as a Helm **post-install / post-upgrade hook** Job. The Job:

- Uses the `backend.migrations.image` container
- Reads DB credentials from the same secret as the backend
- Is cleaned up automatically on success (`hook-delete-policy: hook-succeeded`)
- Retries up to 5 times to handle database availability lag

Migration failures block the Helm release from marking as successful.

## Mandatory Values

These values have no defaults and **must** be provided:

| Value | Description |
| --- | --- |
| `ingress.hostname` | External hostname, e.g. `stickermap.example.com` |
| `backend.image.repository` | Backend image, e.g. `registry.example.com/stickermap-backend` |
| `backend.image.tag` | Backend image tag, e.g. `1.0.0` |
| `backend.migrations.image.repository` | Migrations image, e.g. `registry.example.com/stickermap-migrations` |
| `backend.migrations.image.tag` | Migrations image tag, e.g. `1.0.0` |
| `keycloak.url` | Public Keycloak URL, e.g. `https://auth.example.com` |
| `frontend.image.repository` | Frontend image, e.g. `registry.example.com/stickermap-frontend` |
| `frontend.image.tag` | Frontend image tag, e.g. `1.0.0` |
| `database.existingSecretName` **or** `database.host` + `database.password` | DB credentials (see [Database Credentials](#database-credentials)) |

## Notable Defaults

| Value | Default | Notes |
| --- | --- | --- |
| `keycloak.realm` | `stickermap` | |
| `keycloak.clientId` | `stickermap-client` | |
| `keycloak.internalUrl` | *(falls back to `keycloak.url`)* | Backend JWKS calls only |
| `backend.env.corsAllowedOrigins` | *(derived from `https://<ingress.hostname>`)* | Set explicitly if the frontend is served from a different origin |
| `backend.env.corsAllowedMethods` | `GET, POST, PUT, DELETE, OPTIONS` | |
| `backend.env.corsAllowedHeaders` | `Content-Type, Authorization` | |
| `database.port` | `5432` | |
| `database.dbname` | `stickermap` | |
| `database.username` | `stickermap` | |
| `backend.uploads.storage.size` | `10Gi` | PVC for sticker images |
| `ingress.className` | `traefik` | Match your Ingress controller |

## Installation

### 1. Create a values file

```yaml
# my-values.yaml
backend:
  image:
    repository: registry.example.com/stickermap-backend
    tag: "1.0.0"
  migrations:
    image:
      repository: registry.example.com/stickermap-migrations
      tag: "1.0.0"

frontend:
  image:
    repository: registry.example.com/stickermap-frontend
    tag: "1.0.0"

keycloak:
  url: "https://auth.example.com"

database:
  existingSecretName: "my-db-secret"   # or provide host/password directly

ingress:
  hostname: stickermap.example.com
  className: traefik
  tls:
    - secretName: stickermap-tls
      hosts:
        - stickermap.example.com
```

### 2. Install

```bash
helm install stickermap helm/stickermap \
  --namespace stickermap \
  --create-namespace \
  -f my-values.yaml
```

### 3. Upgrade

```bash
helm upgrade stickermap helm/stickermap \
  --namespace stickermap \
  -f my-values.yaml
```

## OCI Registry

To package and distribute the chart via an OCI registry:

```bash
# 1. Package into a tarball (no dependency build needed)
helm package helm/stickermap

# 2. Push to your OCI registry
helm push stickermap-0.3.0.tgz oci://your-registry.example.com/charts
```

Install directly from the registry (no local clone needed):

```bash
helm install stickermap oci://your-registry.example.com/charts/stickermap \
  --version 0.3.0 \
  --namespace stickermap \
  --create-namespace \
  -f my-values.yaml
```

## Notes

### Database Secret Format

Whether you provide `database.existingSecretName` or let the chart create the secret, the backend always reads from a secret with these keys: `host`, `port`, `dbname`, `username`, `password`.

### Read-only Filesystem

All containers run with `readOnlyRootFilesystem: true` and `runAsNonRoot: true`. Writable paths are provided via `emptyDir` volumes. The backend's upload directory uses a `PersistentVolumeClaim`.

### Migrations

The migration Job runs as a `post-install` and `post-upgrade` hook. If the database is not yet reachable, the Job retries up to 5 times. It is cleaned up automatically on success.
