---
name: helm-values
description: Use when modifying the Helm chart at helm/stickermap/ — values.yaml, Chart.yaml, or any template under templates/. Knows mandatory values, CNPG-vs-standalone database modes, embedded-vs-external Keycloak, and the chart's secret-naming conventions.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You modify the StickerMap Helm chart. The chart at `helm/stickermap/` is **flat** — no sub-charts, no external dependencies, all templates inlined under `templates/`. It targets **Helm v4** (`apiVersion: v2` in Chart.yaml).

## Mandatory values (no defaults)

Any change that affects required values must keep these set-able by the operator. Do not add new mandatory values without flagging it to the user — it's a breaking change for installs.

- `global.hostname`
- `backend.image.repository`, `backend.image.tag`
- `backend.migrations.image.repository`, `backend.migrations.image.tag`
- `backend.keycloakClientSecret`
- `frontend.image.repository`, `frontend.image.tag`
- `keycloak.adminPassword` (when `keycloak.enabled: true`)
- `backend.keycloakUrl` (when `keycloak.enabled: false`)

## Configuration axes

| Axis | Values | Notes |
| --- | --- | --- |
| `database.mode` | `cnpg` (default) / `standalone` | CNPG requires the operator pre-installed; standalone is a plain StatefulSet |
| `keycloak.enabled` | `true` (default) / `false` | When false, no Keycloak resources are deployed; backend points at an external IdP |

Both database modes expose the **same secret format** to the backend (`<release>-db-stickermap` with keys `host`, `port`, `dbname`, `username`, `password`). Don't break this contract.

## Keycloak DB password

Keycloak's DB password lives in `<release>-keycloak-db` with key `password` — that key name is a CNPG requirement, not a stylistic choice.

## Auto-generated passwords

`keycloak.dbPassword` and `database.standalone.appPassword` auto-generate via `randAlphaNum` + `lookup` and persist across upgrades. They do **not** work with `helm template` (offline rendering) — flag this if a change would force offline rendering.

## Security baseline

All containers run with `readOnlyRootFilesystem: true` and `runAsNonRoot: true`. Writable paths come from `emptyDir` volumes; the upload directory uses a PVC. Never relax these without the user explicitly accepting the trade-off.

## Migrations

A post-install / post-upgrade hook Job runs migrations. It retries up to 5 times to absorb CNPG bootstrap lag. Do not switch this to a regular Deployment or InitContainer — the retry loop is load-bearing.

## Verification

```bash
helm lint helm/stickermap
helm template helm/stickermap \
  --set global.hostname=test.local \
  --set backend.image.repository=test --set backend.image.tag=test \
  --set backend.migrations.image.repository=test --set backend.migrations.image.tag=test \
  --set frontend.image.repository=test --set frontend.image.tag=test \
  --set keycloak.adminPassword=test
```

`template` won't exercise the auto-password lookup paths, but it will catch most YAML and templating errors.
