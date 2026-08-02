---
description: Bump the project version everywhere (frontend, backend, migrations, Dockerfiles, Chart.yaml, CHANGELOG, changelog model) using general/scripts/bump-version.py
argument-hint: <new-version>
---

Before running anything, check that the `## [Unreleased]` section of `CHANGELOG.md` has a
**`### Highlights`** block. That section is the only one shown in the in-app "what's new"
dialog and the only one that leads the GitHub release notes — without it, end users see an
empty release.

If it is missing, write it first (see the Changelog & Releases section of `CLAUDE.md` for the
rules): plain language, what the user can now do, no identifiers or file paths, no nested
bullets, and a "For self-hosters:" bullet when the release only touches deployment.

Then run the project's version-bump script with the version argument the user provided:

```bash
uv run general/scripts/bump-version.py $ARGUMENTS
```

The script edits `frontend/package.json`, `backend/pyproject.toml`, `backend/main.py`,
`database_migrations/pyproject.toml`, all three Dockerfiles' `IMAGE_VERSION` ARGs,
`helm/stickermap/Chart.yaml`'s `appVersion`, promotes `[Unreleased]` to a dated section in
`CHANGELOG.md`, and regenerates `frontend/src/app/core/models/changelog.model.ts` from the
`### Highlights` sections.

After it runs:

1. Check stderr for a `WARNING: release <version> has no '### Highlights' section`. The script
   deliberately continues past this, but it means the changelog dialog and the release notes
   will both be empty — fix `CHANGELOG.md` and re-run the script before going further.
2. Show the user how the release will read to an end user:

   ```bash
   uv run general/scripts/bump-version.py $ARGUMENTS --release-notes
   ```

   This prints the GitHub release body (highlights, then technical detail in a collapsed
   block) and changes no files.
3. Show the user `git status` so they can see exactly what changed.
4. Do **not** commit, tag, or push — that's the user's call. The CI workflows in
   `.github/workflows/` are triggered by semver git tags. Tagging also fires `release.yml`,
   which creates a **draft** GitHub Release the user reviews and publishes manually.
