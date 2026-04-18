# StickerMap Helm Chart

Helm chart for deploying StickerMap on Kubernetes.

**Components:**

| Sub-chart | Description |
| --- | --- |
| `backend` | FastAPI application (port 5555) |
| `frontend` | Angular SPA served by Caddy (port 8181 http) |
| `keycloak` | Keycloak identity provider, production mode (port 8080) — **optional** |
| `database` | PostgreSQL with PostGIS — CNPG Cluster or standalone StatefulSet |

All traffic enters through a single Ingress. Path-based routing directs requests to the appropriate service:

- `/api/v1*`, `/uploads/*` → backend
- `/realms/*`, `/resources/*`, `/js/*`, `/admin/*` → keycloak *(only when `keycloak.enabled: true`)*
- `/*` → frontend (SPA)

## Prerequisites

- An Ingress controller (default: `traefik`)
- All container images available in your registry
- **CNPG mode only:** [CloudNativePG operator](https://cloudnative-pg.io/) installed in the cluster

## Helm v4

This chart requires Helm v4 (`apiVersion: v2` in Chart.yaml). No `helm dependency build` step is needed — all templates are inlined directly under `templates/`.

## Database Modes

Set `database.mode` to choose:

| Mode | Value | Requirements |
| --- | --- | --- |
| CloudNativePG Cluster | `cnpg` *(default)* | CNPG operator installed |
| Standalone StatefulSet | `standalone` | None |

Both modes expose the same secret format (`<release>-db-stickermap`) to the backend, so no other values need to change when switching modes.

### CNPG mode

Uses `ghcr.io/cloudnative-pg/postgis` — a CNPG-specific image. The standard `docker.io/postgis/postgis` Docker Hub image is **not** compatible with CNPG.

#### Using an existing CNPG cluster

Set `database.cnpg.existingCluster` to the name of a pre-existing cluster. The chart will skip creating the `Cluster` CR. You must also set `database.cnpg.secretName` to the name of the CNPG-generated app secret (typically `<cluster-name>-<owner>`, e.g. `my-cluster-stickermap`).

```yaml
database:
  mode: cnpg
  cnpg:
    existingCluster: "my-cluster"
    secretName: "my-cluster-stickermap"
```

### Standalone mode

Uses `docker.io/postgis/postgis` from Docker Hub. Deploys a single-replica `StatefulSet`. The database is initialised on first pod start via an init script; PostGIS extensions are enabled automatically.

## Keycloak Modes

Set `keycloak.enabled` to choose:

| Mode | Value | Description |
| --- | --- | --- |
| Embedded Keycloak | `true` *(default)* | Deploys Keycloak with realm auto-import |
| External Keycloak | `false` | No Keycloak resources are deployed |

When using an external Keycloak, set `backend.keycloakUrl` (and optionally `frontend.keycloakUrl`) to point at your IdP.

## Database Migrations

Migrations run as a Helm **post-install / post-upgrade hook** Job. The Job:

- Uses the `backend.migrations.image` container
- Reads DB credentials from the same secret as the backend
- Is cleaned up automatically on success (`hook-delete-policy: hook-succeeded`)
- Retries up to 5 times to handle CNPG cluster bootstrap lag

Migration failures block the Helm release from marking as successful.

## Mandatory Values

These values have no defaults and **must** be provided:

| Value | Description |
| --- | --- |
| `global.hostname` | External hostname, e.g. `stickermap.example.com` |
| `backend.image.repository` | Backend image, e.g. `registry.example.com/stickermap-backend` |
| `backend.image.tag` | Backend image tag, e.g. `1.0.0` |
| `backend.migrations.image.repository` | Migrations image, e.g. `registry.example.com/stickermap-migrations` |
| `backend.migrations.image.tag` | Migrations image tag, e.g. `1.0.0` |
| `backend.keycloakClientSecret` | Client secret — must match the value in `stickermap-realm.json` (default: `clientsecret`) |
| `frontend.image.repository` | Frontend image, e.g. `registry.example.com/stickermap-frontend` |
| `frontend.image.tag` | Frontend image tag, e.g. `1.0.0` |
| `keycloak.adminPassword` | Keycloak admin console password *(when `keycloak.enabled: true`)* |
| `backend.keycloakUrl` | External Keycloak URL *(required when `keycloak.enabled: false`)* |

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
| `database.mode` | `cnpg` | Switch to `standalone` for no-operator clusters |
| `keycloak.enabled` | `true` | Set `false` to use an external Keycloak |
| `keycloak.image.repository` | `quay.io/keycloak/keycloak` | |
| `keycloak.image.tag` | `26.5` | |
| `database.cnpg.imageName` | `ghcr.io/cloudnative-pg/postgis:18-3.6-standard-trixie` | CNPG-specific PostGIS image |
| `database.cnpg.instances` | `1` | Increase for HA |
| `database.cnpg.storage.size` | `5Gi` | |
| `database.standalone.image.repository` | `docker.io/postgis/postgis` | Standard Docker Hub PostGIS image |
| `database.standalone.image.tag` | `18-3.6` | |
| `database.standalone.storage.size` | `5Gi` | |
| `backend.uploads.storage.size` | `10Gi` | PVC for sticker images |
| `ingress.className` | `traefik` | Match your Ingress controller |

## Installation

### 1. Create a values file

#### Example: CNPG + embedded Keycloak (default)

```yaml
# my-values.yaml
global:
  hostname: stickermap.example.com

backend:
  image:
    repository: registry.example.com/stickermap-backend
    tag: "1.0.0"
  migrations:
    image:
      repository: registry.example.com/stickermap-migrations
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
  className: traefik
  tls:
    - secretName: stickermap-tls
      hosts:
        - stickermap.example.com
```

#### Example: Standalone database + external Keycloak

```yaml
# my-values.yaml
global:
  hostname: stickermap.example.com

backend:
  image:
    repository: registry.example.com/stickermap-backend
    tag: "1.0.0"
  migrations:
    image:
      repository: registry.example.com/stickermap-migrations
      tag: "1.0.0"
  keycloakClientSecret: "clientsecret"
  keycloakUrl: "https://auth.example.com"
  keycloakRealm: "stickermap"
  keycloakClientId: "stickermap-client"

frontend:
  image:
    repository: registry.example.com/stickermap-frontend
    tag: "1.0.0"

keycloak:
  enabled: false

database:
  mode: standalone

ingress:
  className: traefik
  tls:
    - secretName: stickermap-tls
      hosts:
        - stickermap.example.com
```

#### Example: CNPG with an existing cluster

```yaml
# my-values.yaml
global:
  hostname: stickermap.example.com

database:
  mode: cnpg
  cnpg:
    existingCluster: "my-existing-cluster"
    secretName: "my-existing-cluster-stickermap"
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

## Notes

### Database

Both database modes create the same secret format. The backend always reads from `<release>-db-stickermap` (keys: `host`, `port`, `dbname`, `username`, `password`).

- **CNPG:** The CNPG operator generates `<release>-db-stickermap` automatically after cluster bootstrap.
- **Standalone:** The chart creates `<release>-db-stickermap` at install time (with auto-generated or provided password).
- **Existing CNPG cluster:** Set `database.cnpg.secretName` to the name of the existing secret.

### Keycloak Realm Import

The `stickermap` realm is imported automatically on first startup from `files/stickermap-realm.json`. If you modify the realm JSON, upgrade the chart — Keycloak skips already-imported realms by default.

To re-import a modified realm, delete the Keycloak pod so it restarts and re-reads the import file.

### Read-only Filesystem

All containers run with `readOnlyRootFilesystem: true` and `runAsNonRoot: true`. Writable paths are provided via `emptyDir` volumes. The backend's upload directory uses a `PersistentVolumeClaim`.

### Migrations

The migration Job runs as a `post-install` and `post-upgrade` hook. On first install with CNPG, the Job may fail and retry a few times while the database cluster bootstraps — this is expected. The Job is cleaned up automatically on success.
