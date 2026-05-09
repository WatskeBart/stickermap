---
description: Print the manual steps for importing the StickerMap Keycloak realm into a manually-started Keycloak instance
---

The `compose.yml` stack imports `general/keycloak_realm/stickermap-realm.json` automatically on first start of the Keycloak container. These instructions are for the case where Keycloak was started **outside** compose (e.g., a standalone `podman run` or a remote dev cluster).

Print the following to the user, verbatim, with no preamble:

```
Manual realm import — Keycloak admin console
=============================================

1. Open http://localhost:8080 (or your Keycloak host) and sign in to the admin console.
2. From the realm dropdown (top-left), choose "Create realm".
3. Click "Browse..." and select:
     general/keycloak_realm/stickermap-realm.json
4. Confirm the realm name reads "stickermap" and click "Create".

Verify after import
-------------------
- Realm settings → Login: confirm "User registration" is on.
- Clients → stickermap-client: confirm it exists; copy the client secret if needed.
- Client roles on stickermap-client: sm-viewer, sm-uploader, sm-editor, sm-admin all present
  with composite role inheritance (admin ⊇ editor ⊇ uploader ⊇ viewer).
- Groups: /stickermap with sub-groups sm-viewer, sm-uploader, sm-editor, sm-admin —
  each carrying the matching client role.
- Realm settings → User registration → Default groups: /stickermap/sm-viewer is set.
```

Do not run any commands. This command exists to surface the exact steps without the user having to dig through `docs/authentication.md`.
