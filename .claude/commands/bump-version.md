---
description: Bump the project version everywhere (frontend, backend, migrations, Dockerfiles, Chart.yaml, CHANGELOG, changelog model) using general/scripts/bump-version.py
argument-hint: <new-version>
---

Run the project's version-bump script with the version argument the user provided:

```bash
uv run general/scripts/bump-version.py $ARGUMENTS
```

The script edits `frontend/package.json`, `backend/pyproject.toml`, `backend/main.py`, `database_migrations/pyproject.toml`, all three Dockerfiles' `IMAGE_VERSION` ARGs, `helm/stickermap/Chart.yaml`'s `appVersion`, promotes `[Unreleased]` to a dated section in `CHANGELOG.md`, and regenerates `frontend/src/app/core/models/changelog.model.ts`.

After it runs:

1. Show the user `git status` so they can see exactly what changed.
2. Remind them to add release notes under the new section in `CHANGELOG.md` if they haven't already (the script preserves whatever was under `[Unreleased]`, so this is only needed if it was empty).
3. Do **not** commit, tag, or push — that's the user's call. The CI workflows in `.github/workflows/` are triggered by semver git tags, so the user will tag manually when ready.
