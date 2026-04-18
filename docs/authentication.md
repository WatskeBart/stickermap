# Authentication

StickerMap uses [Keycloak](https://www.keycloak.org/) for identity and access management.

## Roles

Four hierarchical **client roles** (scoped to the `stickermap-client` client) with the `sm-` prefix:

| Role | Name | Permissions |
| ---- | ---- | ----------- |
| Viewer | `sm-viewer` | View all sticker details (default for all users) |
| Uploader | `sm-uploader` | Upload new stickers and edit own stickers |
| Editor | `sm-editor` | Edit any sticker's poster name, post date, and location |
| Administrator | `sm-admin` | Full access: edit all fields and delete stickers |

Roles are implemented as Keycloak **composite roles** — each role includes the permissions of all roles below it:

- `sm-admin` includes `sm-editor`
- `sm-editor` includes `sm-uploader`
- `sm-uploader` includes `sm-viewer`
- `sm-viewer` is assigned by default to all new users via the `/stickermap/sm-viewer` sub-group (set as default group)

Assign only the highest needed role per user.

## Keycloak Setup

### Using the realm export (recommended)

Import `general/extra/stickermap-realm.json` via the Keycloak Admin Console. All roles and the `stickermap-client` client are pre-configured.

- **`compose.yml`** — realm is imported automatically on first start.
- **`compose.prod.yml`** — import manually: navigate to **Realm settings** → import realm → upload `general/extra/stickermap-realm.json`.

### Manual setup

If not using the realm export:

1. Create realm: `stickermap`
2. Create client: `stickermap-client` (OpenID Connect, public)
   - Redirect URIs: `http://localhost:4200/*`
   - Web origins: `http://localhost:4200`
   - Enable standard flow and direct access grants
3. Create client roles on the `stickermap-client` client:

   | Role | Description | Composite roles |
   | ---- | ----------- | --------------- |
   | `sm-viewer` | Can view sticker details | — |
   | `sm-uploader` | Can upload and edit own stickers | `sm-viewer` |
   | `sm-editor` | Can edit any sticker | `sm-uploader` |
   | `sm-admin` | Full access | `sm-editor` |

4. Create a `stickermap` group with four sub-groups matching the roles:

   | Group path | Client role assigned |
   | ---------- | -------------------- |
   | `/stickermap/sm-viewer` | `sm-viewer` |
   | `/stickermap/sm-uploader` | `sm-uploader` |
   | `/stickermap/sm-editor` | `sm-editor` |
   | `/stickermap/sm-admin` | `sm-admin` |

5. Set `/stickermap/sm-viewer` as the default group:
   - **Realm settings** → **User registration** → **Default groups** → add `/stickermap/sm-viewer`

### Assigning roles to users

Add the user to the appropriate sub-group under `/stickermap/`:

1. **Users** → select a user
2. **Groups** tab → **Join Group**
3. Select `/stickermap/sm-uploader` (or `sm-editor` / `sm-admin`) and click **Join**

Remove the user from `/stickermap/sm-viewer` if you want to prevent viewer access while they hold a higher role — though in practice composite roles make this unnecessary.

## Protected routes and endpoints

| Resource | Requirement |
| -------- | ----------- |
| `/add-sticker` (frontend) | Any authenticated user |
| `POST /api/v1/upload` | `sm-uploader` |
| `POST /api/v1/create_sticker` | `sm-uploader` |
| `PATCH /api/v1/sticker/{id}` | `sm-uploader` (own) / `sm-editor` (any) / `sm-admin` (all fields) |
| `DELETE /api/v1/sticker/{id}` | `sm-admin` |
| `GET /api/v1/*`, `GET /uploads/*` | Public |

## Security features

- RS256 asymmetric token signing
- Token signature validation against Keycloak JWKS endpoint
- Automatic access token refresh (checked every 60 s)
- HTTP interceptor injects Bearer token on all API requests
- 401/403 responses trigger re-login
