# StickerMap Helm Chart

Umbrella Helm chart for deploying StickerMap on Kubernetes.

**Components:**

| Sub-chart | Description |
| --- | --- |
| `backend` | FastAPI application (port 5555) |
| `frontend` | Angular SPA served by Caddy (port 8282) |
| `keycloak` | Keycloak identity provider, production mode (port 8080) — **optional** |
| `database` | PostgreSQL with PostGIS — CNPG Cluster or standalone StatefulSet |

All traffic enters through a single Ingress. Path-based routing directs requests to the appropriate service:

- `/api/v1*`, `/uploads/*` → backend
- `/realms/*`, `/resources/*`, `/js/*`, `/admin/*` → keycloak *(only when `global.keycloak.enabled: true`)*
- `/*` → frontend (SPA)

## Prerequisites

- An Ingress controller (default: `nginx`)
- All container images available in your registry (no external chart repos are used)
- **CNPG mode only:** [CloudNativePG operator](https://cloudnative-pg.io/) installed in the cluster

## Database Modes

Set `global.database.type` to choose:

| Mode | Value | Requirements |
| --- | --- | --- |
| CloudNativePG Cluster | `cnpg` *(default)* | CNPG operator installed |
| Standalone StatefulSet | `standalone` | None |

Both modes create a `stickermap` database (with PostGIS) and, when Keycloak is enabled, a `keycloak` database. Both expose the same secret format (`<release>-db-stickermap`) to the backend, so no other values need to change when switching modes.

### CNPG mode

Uses `ghcr.io/cloudnative-pg/postgis` — a CNPG-specific image. The standard `docker.io/postgis/postgis` Docker Hub image is **not** compatible with CNPG.

### Standalone mode

Uses `docker.io/postgis/postgis` from Docker Hub. Deploys a single-replica `StatefulSet`. The database is initialised on first pod start via an init script; PostGIS extensions are enabled automatically.

> **Note:** The standalone PostgreSQL container requires `readOnlyRootFilesystem: false` due to PostgreSQL's runtime directory requirements.

## Keycloak Modes

Set `global.keycloak.enabled` to choose:

| Mode | Value | Description |
| --- | --- | --- |
| Embedded Keycloak | `true` *(default)* | Deploys the Keycloak sub-chart with realm auto-import |
| External Keycloak | `false` | No Keycloak resources are deployed; set `backend.keycloakUrl` |

## Mandatory Values

These values have no defaults and **must** be provided:

| Value | Description |
| --- | --- |
| `global.hostname` | External hostname, e.g. `stickermap.example.com` |
| `backend.image.repository` | Backend image, e.g. `registry.example.com/stickermap-backend` |
| `backend.image.tag` | Backend image tag, e.g. `main` |
| `backend.keycloakClientSecret` | Client secret — must match the value in `stickermap-realm.json` (default: `clientsecret`) |
| `frontend.image.repository` | Frontend image, e.g. `registry.example.com/stickermap-frontend` |
| `frontend.image.tag` | Frontend image tag, e.g. `main` |
| `keycloak.adminPassword` | Keycloak admin console password *(when `global.keycloak.enabled: true`)* |
| `backend.keycloakUrl` | External Keycloak URL *(required when `global.keycloak.enabled: false`)* |

## Auto-generated Passwords

The following passwords are **auto-generated** on first install and preserved across upgrades when left empty:

| Value | Secret created | Notes |
| --- | --- | --- |
| `keycloak.dbPassword` | `<release>-keycloak-db` | Keycloak DB user password |
| `database.standalone.appPassword` | `<release>-db-stickermap` | Stickermap DB user password (standalone only) |

> Auto-generation uses `randAlphaNum` + `lookup` and is idempotent on `helm upgrade`. It does not work with `helm template` (offline rendering).

## Notable Defaults

| Value | Default | Notes |
| --- | --- | --- |
| `global.database.type` | `cnpg` | Switch to `standalone` for no-operator clusters |
| `global.keycloak.enabled` | `true` | Set `false` to use an external Keycloak |
| `keycloak.image.repository` | `quay.io/keycloak/keycloak` | |
| `keycloak.image.tag` | `26.5` | |
| `database.cnpg.imageName` | `ghcr.io/cloudnative-pg/postgis:18-3.6-standard-trixie` | CNPG-specific PostGIS image |
| `database.cnpg.instances` | `1` | Increase for HA |
| `database.cnpg.storage.size` | `5Gi` | |
| `database.standalone.image.repository` | `docker.io/postgis/postgis` | Standard Docker Hub PostGIS image |
| `database.standalone.image.tag` | `18-3.6` | |
| `database.standalone.storage.size` | `5Gi` | |
| `backend.uploads.storage.size` | `10Gi` | PVC for sticker images |
| `ingress.className` | `nginx` | Match your Ingress controller |

## Installation

### 1. Package sub-chart dependencies

This only reads local files — no internet access required.

```bash
helm dependency build helm/stickermap
```

### 2. Create a values file

**Example: CNPG + embedded Keycloak (default)**

```yaml
# my-values.yaml
global:
  hostname: stickermap.example.com

backend:
  image:
    repository: registry.example.com/stickermap-backend
    tag: "1.0.0"
  keycloakClientSecret: "clientsecret"

frontend:
  image:
    repository: registry.example.com/stickermap-frontend
    tag: "1.0.0"

keycloak:
  image:
    repository: registry.example.com/keycloak
    tag: "26.5"
  adminPassword: "changeme"

database:
  cnpg:
    imageName: registry.example.com/postgis:18-3.6

ingress:
  className: nginx
  tls:
    - secretName: stickermap-tls
      hosts:
        - stickermap.example.com
```

**Example: Standalone database + external Keycloak**

```yaml
# my-values.yaml
global:
  hostname: stickermap.example.com
  database:
    type: standalone
  keycloak:
    enabled: false

backend:
  image:
    repository: registry.example.com/stickermap-backend
    tag: "1.0.0"
  keycloakClientSecret: "clientsecret"
  keycloakUrl: "https://auth.example.com"
  keycloakRealm: "stickermap"
  keycloakClientId: "stickermap-client"

frontend:
  image:
    repository: registry.example.com/stickermap-frontend
    tag: "1.0.0"

ingress:
  className: nginx
  tls:
    - secretName: stickermap-tls
      hosts:
        - stickermap.example.com
```

### 3. Install

```bash
helm install stickermap helm/stickermap \
  --namespace stickermap \
  --create-namespace \
  -f my-values.yaml
```

### 4. Upgrade

```bash
helm upgrade stickermap helm/stickermap \
  --namespace stickermap \
  -f my-values.yaml
```

## OCI Registry

To package and distribute the chart via an OCI registry:

```bash
# 1. Build sub-chart dependencies (creates Chart.lock + charts/*.tgz)
helm dependency build helm/stickermap

# 2. Package into a tarball
helm package helm/stickermap

# 3. Push to your OCI registry
helm push stickermap-0.1.0.tgz oci://your-registry.example.com/charts
```

Install directly from the registry (no local clone needed):

```bash
helm install stickermap oci://your-registry.example.com/charts/stickermap \
  --version 0.1.0 \
  --namespace stickermap \
  --create-namespace \
  -f my-values.yaml
```

> `Chart.lock` is committed to the repository. The generated `charts/*.tgz` files are excluded from git (`.gitignore`) and must be recreated by running `helm dependency build` before each `helm package`.

## Notes

### Database

Both database modes create the same secret format. The backend always reads from `<release>-db-stickermap` (keys: `host`, `port`, `dbname`, `username`, `password`).

- **CNPG:** The CNPG operator generates `<release>-db-stickermap` automatically after cluster bootstrap.
- **Standalone:** The database sub-chart creates `<release>-db-stickermap` at install time (with auto-generated or provided password).

### Keycloak Realm Import

The `stickermap` realm is imported automatically on first startup from `charts/keycloak/files/stickermap-realm.json`. If you modify the stickermap-realm.json, re-install or upgrade the chart — Keycloak skips already-imported realms by default.

To re-import a modified realm, delete the Keycloak pod so it restarts and re-reads the import file.

### Read-only Filesystem

All containers except the standalone PostgreSQL run with `readOnlyRootFilesystem: true` and `runAsNonRoot: true`. Writable paths are provided via `emptyDir` volumes. The backend's upload directory uses a `PersistentVolumeClaim`.

### First-time Database Initialization

On first install, set `backend.env.initNewDatabase: "true"` in your values to create the database schema. Reset it to `"false"` before subsequent upgrades to avoid dropping and recreating the schema.

```bash
# First install only
helm install stickermap helm/stickermap \
  --set backend.env.initNewDatabase=true \
  ... other flags
```
