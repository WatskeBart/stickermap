# Authentication

StickerMap uses [Keycloak](https://www.keycloak.org/) for identity and access management.

## Roles

Four hierarchical realm roles with the `sm-` prefix:

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
- `sm-viewer` is in the default realm roles (all new users receive it automatically)

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
3. Create realm roles:

   | Role | Description | Composite roles |
   | ---- | ----------- | --------------- |
   | `sm-viewer` | Can view sticker details | — |
   | `sm-uploader` | Can upload and edit own stickers | `sm-viewer` |
   | `sm-editor` | Can edit any sticker | `sm-uploader` |
   | `sm-admin` | Full access | `sm-editor` |

4. Add `sm-viewer` to the default realm roles:
   - **Realm settings** → **User registration** → **Default roles** → add `sm-viewer`

### Assigning roles to users

1. **Users** → select a user
2. **Role mapping** tab → **Assign role**
3. Select the desired role and click **Assign**

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
