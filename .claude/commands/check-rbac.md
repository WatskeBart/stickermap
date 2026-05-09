---
description: Audit the current branch for backend route changes and confirm role protection + matching frontend gating
---

Audit RBAC coverage for any backend routes added or modified on the current branch (vs `develop`).

## Steps

1. Diff the current branch against `develop`, scoped to `backend/main.py`:

   ```bash
   git diff develop...HEAD -- backend/main.py
   ```

2. Identify every added or modified route handler (`@router.<verb>(...)` decorator).

3. For each route, classify it:

   | Route shape | Required protection |
   | --- | --- |
   | Read-only public data (e.g. `get_all_stickers`, `stats`) | May be public OR use `Depends(get_current_user)` for role-aware response shaping |
   | Anything that writes, deletes, or mutates state | Must use `Depends(require_role(ROLE_X))` |
   | Edit/delete of an existing sticker | Must also enforce ownership via `get_user_identity()` unless `is_editor` or `is_admin` |
   | Admin-only fields (e.g. updating `uploader`) | Must reject non-admin callers with 403 |

4. For each role-protected endpoint, find the corresponding caller in `frontend/src/app/core/services/sticker.service.ts` and confirm the UI element that triggers it is wrapped in an `*ngIf="authService.isUploader()"` (or `isEditor` / `isAdmin`) check. Use Grep:

   ```
   isUploader|isEditor|isAdmin
   ```

   …in the feature folder that owns the UI for the endpoint.

## Report format

Output a table:

| Route | Protection | Frontend gate | Status |
| --- | --- | --- | --- |
| `POST /api/v1/upload` | `require_role(ROLE_UPLOADER)` | `isUploader()` in add-sticker | ✅ |
| `POST /api/v1/some-new-thing` | *(missing)* | *(missing)* | ❌ Missing both |

End with a bullet list of any endpoints flagged ❌, with the file:line where the fix should land. Do not fix anything — this is an audit.
