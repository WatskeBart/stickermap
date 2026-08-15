# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release opens with a **`### Highlights`** section written for people using the app —
plain language, no identifiers, no file paths, a handful of bullets at most. It is the only
section shown in the in-app "what's new" dialog and the only one that leads the GitHub
release notes. The `Added`/`Changed`/`Fixed`/`Security` sections below it are the technical
record and stay as detailed as they need to be. Deployment-only changes still get a
highlight, prefixed **"For self-hosters:"**, so no release appears empty to a reader.

## [Unreleased]

## [1.24.1] - 2026-08-15

### Highlights

- Security updates to third-party libraries. Nothing changes in how the app works.

### Security

- Resolved all nine open Dependabot alerts — one in the backend, eight in the frontend toolchain (no application code changes). Every fix was reached by a version floor raise or a plain lockfile refresh; no new `pnpm-workspace.yaml` override was needed.
  - **`cryptography`** 49.0.0 → 50.0.0 (high — GHSA-g6cj-pr64-35w5 / CVE-2026-69247: PKCS#7 `EnvelopedData` decryption exposes a Bleichenbacher oracle through distinguishable errors and timing). The only direct backend dependency in this batch, so the floor in `pyproject.toml` moved from `>=48.0.1` to `>=50.0.0`. The vulnerable code path is not one the backend reaches — `cryptography` is pulled in solely for PyJWT's `RSAAlgorithm.from_jwk()`, which converts Keycloak JWKS keys for RS256 *signature verification* in `auth.py`, and no PKCS#7 decryption happens anywhere in the app. Patched regardless, since it is a direct dependency and a major version bump: the JWKS → RSA → `jwt.decode()` round-trip was re-verified against 50.0.0.
  - **`hono`** 4.12.31 → 4.13.2, clearing three advisories at once (GHSA-f23p-vx2j-j53r, medium — `memo()` retains SSR output across requests, leaking data between users; GHSA-54fx-42gc-7vw4, medium — algorithmic-complexity DoS in the language middleware; GHSA-79qm-7rj5-m7r9, low — the proxy helper does not strip response headers named in `Connection`). All three are unreachable here: hono arrives through `@angular/cli` → `@modelcontextprotocol/sdk` → `@hono/node-server`, i.e. the opt-in `ng mcp` server, and this app is a client-side SPA with no SSR. Note that the `@modelcontextprotocol/sdk` override added in 1.22.1 is still required and still pinned at 1.30.0 — `@angular/cli` 22.2.0 has not shipped stable (22.1.4 is current), so the floor raise that would retire it is not yet possible.
  - **`ip-address`** 10.2.0 → 10.5.0, clearing three advisories (GHSA-mwp4-54f8-5fhr, high — `Address4` decodes leading-zero octets as decimal where resolvers read them as octal; GHSA-4xrf-jv44-h6hh, medium — a CIDR suffix suppresses special-use classification; GHSA-22jq-vg5j-6vgg, medium — IPv4-mapped/NAT64 IPv6 addresses are misclassified). All three are SSRF / trust-boundary bypasses in code that never runs here: the package is reached via `@modelcontextprotocol/sdk` → `express-rate-limit`, again only under `ng mcp`. The declared `^10.2.0` range already permitted the fixes.
  - **`fast-uri`** 3.1.4 → 3.1.5 (high — GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446: host confusion via a backslash authority introducer). Transitive through `ajv`, which the Angular devkit uses to validate build configuration schemas at build time; `ajv`'s `^3.0.1` range already allowed the patched release.
  - **`postcss`** 8.5.20 → 8.5.26 (medium — GHSA-fxqj-rqcc-2cmp / CVE-2026-69153: an incomplete fix for GHSA-6g55-p6wh-862q, where an attacker-controlled `sourceMappingURL` reads arbitrary `.map` files when `from` is unset). Build-time only, via `@angular/build`, `vite`, `beasties` and `postcss-safe-parser`, and it processes only this project's own stylesheets.
- All eight npm packages are `devDependencies` of the Angular build toolchain — `pnpm why --prod` reports no production path for any of them, and none appear in the compiled browser bundle, so no shipped artifact was affected. `pnpm audit` is clean for both the production and full trees.
- Ran `pnpm dedupe` afterwards. Re-resolving `postcss` had left the `browserslist` chain (`browserslist`, `caniuse-lite`, `electron-to-chromium`, `node-releases`, `baseline-browser-mapping`, `update-browserslist-db`) at two versions each, because the Babel 7 branch reached through `istanbul-lib-instrument` floated to a newer patch while the Babel 8 branch stayed put. The dedupe collapses each back to a single version and keeps the lockfile diff balanced; no advisory depended on it.
- Relocking also corrected stale project-version drift in both Python lockfiles, which `bump-version.py` does not refresh: `backend/uv.lock` still recorded `stickermap` at 1.23.0 and `database_migrations/uv.lock` still recorded `stickermap-migrations` at 1.12.0. Both now match their `pyproject.toml` at 1.24.1; no dependency versions moved as a result.

## [1.24.0] - 2026-08-02

### Highlights

- **The "what's new" dialog is now a short summary in plain language.** Each release opens with a handful of bullets about what changed for you, instead of the full technical list grouped under Added, Changed and Fixed. The complete technical record is still on GitHub for anyone who wants to read it.
- **Older releases were rewritten the same way**, so the history in the dialog reads consistently all the way back to the first release.

### Added

- **Draft GitHub Release workflow (`.github/workflows/release.yml`)** — a semver tag push (`[0-9]+.[0-9]+.[0-9]+*`) creates a *draft* release whose body is generated from `CHANGELOG.md`; a `workflow_dispatch` input rebuilds the draft for an existing tag. The body is the release's `### Highlights` block first, the technical sections inside a collapsed `<details>Technical details</details>`, then the compare URL. Nothing is published automatically — the draft is reviewed and published by hand.
  - **Pre-release tags fall back to generated notes.** A tag that is not plain `X.Y.Z` (e.g. `1.23.0-rc1`) has no changelog section, so the workflow uses `gh release create --generate-notes` and marks the release as a pre-release instead of failing.
  - **Re-running is safe.** For the same tag the workflow deletes and recreates an existing *draft*, but exits without touching a release that has already been published, so a manual dispatch can never clobber published notes.
- **`--release-notes` flag on `general/scripts/bump-version.py`** — prints the GitHub release body for a version to stdout and changes no files, so an entry can be proofread before the tag is pushed. It is also what the workflow calls, so local output and CI output cannot drift.
- **Warning when the release being cut has no `### Highlights` section.** The script still exits 0, but the in-app dialog and the GitHub release body would both be empty for that version, so the warning is a blocker in practice.
- **`### Highlights` backfilled for all 40 past releases** (1.0.0 through 1.23.0), plus a preamble at the top of this file describing which section feeds which audience.

### Changed

- **`changelog.model.ts` is generated from `### Highlights` only.** `ChangelogRelease` now carries a flat `items: string[]`; the `ChangelogSection` interface and the per-section grouping are gone, and the generated file dropped from 811 to 319 lines. Only top-level `- ` bullets are collected, so a nested sub-bullet under Highlights is silently dropped from the dialog — highlights have to stay flat.
- **Bold markup in a changelog item is converted to `<strong>`** by `_process_item()`, alongside the existing backtick-to-`<code>` conversion, because the dialog binds each item with `[innerHTML]` and would otherwise render literal asterisks. Nothing else is converted — links, italics and nested lists still come through as raw characters.
- **Changelog dialog markup simplified** — one `<ul>` per release instead of an icon-headed block per section, with `sectionIconMap` removed from the component. List items gained `<strong>` (heading colour) and `<code>` (alt surface) styling to replace what the section headers used to convey.
- **Release flow documented** in `CLAUDE.md` and the `/bump-version` command: write the entry under `## [Unreleased]` (highlights *and* technical sections) → `uv run general/scripts/bump-version.py <version>` → push the tag → review and publish the draft on GitHub.

## [1.23.0] - 2026-08-02

### Highlights

- **Add a note to your stickers.** An optional field for the story behind a sticker — "posted during the X festival", "second attempt, the first one got peeled off". Up to 256 characters. Fill it in when you upload, or add it later by editing the sticker from the map or the sticker overview. Notes also show up in CSV and GeoJSON exports.
- **Notes are for signed-in users only.** Visitors who are not logged in never see them, the same way poster names and dates are already hidden.
- **A new disclaimer rule about sensitive information**, plus a reminder and a live character counter on the note fields themselves.

### Added

- **Optional `extra_info` note on stickers (max 256 characters)** — free text describing why or how a sticker was posted ("posted during the X festival", "second attempt, the first one got peeled off"). Migration `0009_add_extra_info` adds a nullable `VARCHAR(256)` column, so the length guarantee holds at the storage layer even if a caller bypasses Pydantic. Settable from the upload form and from both edit dialogs (overview table and map popup), under the same rules as `poster`: `sm-uploader` on own stickers, `sm-editor`/`sm-admin` on any sticker. Shown in the map popup, the overview table (truncated, full text in a tooltip) and the CSV export — and in the GeoJSON export as well, since both formats come from the same editor-only endpoint.
  - **Readable by viewers only.** `get_all_stickers` blanks `extra_info` to `null` for unauthenticated/non-viewer callers exactly like `poster`/`uploader`/`post_date`, so a note never reaches an anonymous client. The column was appended last in the `SELECT` (index 15 on `StickerRow`, 13 on `StickerDetailRow`), and the non-viewer branch that rebuilds each row positionally was extended with a matching `None`.
  - **Plain text, never markup.** The popup and the table cell render the note with `{{ }}` interpolation only. The disclaimer list next to it uses `[innerHTML]` for translated markup; copying that pattern for user-supplied text would be an XSS hole, so HTML typed into the field shows up as literal characters.
  - **Clear semantics on `PATCH`.** `UpdateStickerRequest` is applied with `model_dump(exclude_unset=True)`, so an omitted field means "leave unchanged" while an empty string — or an explicit `null` — clears the note to `NULL`. Input is trimmed, `\r\n` normalised, and runs of blank lines collapsed to one; the 256-character limit is checked *before* trimming, so a whitespace-padded over-long payload is still a 422 rather than being silently accepted.
- **Disclaimer rule 7 — "Do not share sensitive information."** New `visibility_off` entry in the first-time upload disclaimer, in both `en` and `nl`, covering the first field where users can type arbitrary text. The `stickermap_disclaimer_accepted` localStorage flag is deliberately *not* invalidated, so existing users will not see it; to compensate, both extra-info inputs carry an inline `mat-hint` warning against personal data at the point of entry, alongside a live `123 / 256` character counter.

## [1.22.1] - 2026-08-01

### Highlights

- Security updates to third-party libraries. Nothing changes in how the app works.

### Security

- Resolved both open Dependabot alerts in the frontend toolchain (no application code changes):
  - **`brace-expansion`** 2.1.2 → 2.1.4 (high — DoS via unbounded expansion length causing an out-of-memory process crash), reached without an override. It is a transitive dependency of `angular-server-side-configuration` → `glob` → `minimatch@9.0.9`, whose `^2.0.2` range already permitted the patched 2.1.3+; only the lockfile pin was stale.
  - **`@hono/node-server`** 1.19.14 → 2.0.12 (medium — GHSA-frvp-7c67-39w9: path traversal in `serve-static` on Windows via an encoded backslash `%5C`, reachable only through `@angular/cli`'s opt-in `ng mcp` server, never the build). This needed the first `pnpm-workspace.yaml` override since the 1.21.5 cleanup, because no version floor raise can reach the fix: `@angular/cli@22.1.2` — the latest stable — pins `@modelcontextprotocol/sdk` to *exactly* 1.29.0, which declares `@hono/node-server: ^1.19.9`, and no 1.x release is patched (the fix landed in 2.0.5). That is precisely the exception 1.21.5 carved out for overrides: a parent package's own manifest still excludes the fixed version after a lockfile refresh. The override targets `@modelcontextprotocol/sdk` (→ 1.30.0) rather than `@hono/node-server` directly — 1.30.0 widens its own range to `^1.19.9 || ^2.0.5`, so hono resolves to a patched 2.x with every declared semver range in the tree still satisfied, instead of forcing a major version past a `^1` constraint. 1.30.0 is what `@angular/cli@22.2.0-next.0` already pins, so this only pre-adopts upstream; remove the override once CLI 22.2.0 ships stable. `@hono/node-server` 2.x raises its `engines` floor to Node `>=20`, which is already satisfied by the project's `^22.22.3 || ^24.15.0 || >=26` requirement.

## [1.22.0] - 2026-08-01

### Highlights

- **A newer map engine.** The map now runs on MapLibre 6, with faster rendering.
- **Updated to Angular 22** under the hood. Nothing changes on screen.
- **The map no longer works in very old browsers.** It now needs WebGL2, which every major browser has supported since 2021. If yours is older, the rest of StickerMap still works — only the map will fail to load.

### Changed

- **Angular 21.2.17 → 22.1.0** — `@angular/{core,common,compiler,forms,router,platform-browser}`, `@angular/{cdk,material}` 21.2.14 → 22.1.0, and the `@angular/{build,cli,compiler-cli}` toolchain. Three things about v22 affected this codebase:
  - **`OnPush` is now the default change-detection strategy** for components that do not declare one — v22 flipped the default from eager. No component in this repo sets `changeDetection`, so all 17 moved to `OnPush`. The app is already zoneless and fully signal-driven, so signal writes still drive re-render; the v22 `change-detection-eager` migration (which annotates components that relied on eager checking) was deliberately not applied. Any state a template reads must now be a signal or an `input()`/`output()`/`toSignal()` bridge.
  - Constructor-parameter DI replaced with `inject()` in 8 files (`app.ts`, `sticker.service.ts`, `map.ts`, `map-view`, `edit-sticker-modal`, `add-sticker-view`, `sticker-form`, `disclaimer-dialog`) via the `@angular/core:inject-migration` schematic.
  - `standalone: true` removed from all 17 components — redundant since v19, when standalone became the default. The option still exists in the v22 decorator API, so this is cleanup rather than a required change.
- **TypeScript 5.9.3 → 6.0.3** — Angular 22 requires `>=6.0 <6.1`; 5.9 is not supported. The build also now requires Node `^22.22.3 || ^24.15.0 || >=26` — `frontend/Dockerfile` already builds on `node:26-slim`, so no image change was needed.
- **Angular 22 toolchain resolves `@babel/core` 8.0.1** alongside 7.29.7. This closes out the Babel 8 incompatibility recorded in 1.21.3 and worked around in 1.21.4: `@angular/build@21.2.x` crashed on `@babel/core ≥7.29.1`'s strict `NumericLiteral` AST validation, which forced a pinned override. `overrides:` in `pnpm-workspace.yaml` stays empty — no pin is needed on v22.
- **MapLibre GL JS 5.24.0 → 6.1.0**, with `@maplibre/ngx-maplibre-gl` 21.0.2 → 22.1.0 (v22 peers `maplibre-gl >= 6.0.0`; the ngx major tracks the Angular major). Three breaking changes needed handling:
  - v6 is **ESM-only and dropped the default export**, so `map.ts` now uses `import * as maplibregl from 'maplibre-gl'`. `maplibre-gl` was removed from `allowedCommonJsDependencies` in `angular.json`.
  - v6 loads its **web worker from a separate file at runtime**, resolved from `import.meta.url` — which after esbuild points at a hashed chunk, so the request 404s and no tiles render. `angular.json` now copies `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` (the worker imports the latter as a sibling, so they must share a directory) to the output root, and `app.config.ts` provides `provideMaplibreWorker('maplibre-gl-worker.mjs')` from `@maplibre/ngx-maplibre-gl/config`. The path is relative so it resolves against `document.baseURI` and survives a `--base-href` sub-path deployment.
  - ngx-maplibre-gl 22 changed the **camera inputs from single-element arrays to plain numbers**, so `map.html` binds `[zoom]="iv.zoom"` instead of `[zoom]="[iv.zoom]"`.

  `RasterTileSource.setTiles()` is unchanged, so the tile-layer toggle needed no work. See **Removed** below for the WebGL2 requirement v6 introduces.

- **`@ngx-translate/core` and `@ngx-translate/http-loader` 17.0.0 → 18.0.0** — required by the Angular 22 peer range. No call-site changes: `provideTranslateService`, `provideTranslateHttpLoader`, `TranslatePipe`, and `TranslateService` are unchanged, as are the `frontend/public/i18n/{nl,en}.json` files and the `stickermap-lang` storage key.
- **`angular-server-side-configuration` 21.0.4 → 22.0.2**, with `ARG NGSSC_VERSION` in `frontend/Dockerfile` bumped to match so the binary and the build-time library stay on the same major. The runtime env-injection contract is unchanged — the same variables are still substituted into `index.html` at container start.
- Sticker endpoint responses are now typed instead of `any`. The backend returns raw psycopg rows, which serialise to JSON *arrays*, so they are modelled as labelled tuples — `StickerRow`, `StickerDetailRow`, `StickerRotateRow` — in `core/models/sticker.model.ts`, alongside `StickerPointGeoJson` for the parsed `ST_AsGeoJSON(location)` string and `MessageResponse`/`UpdateStickerResponse`/`SubmitReportResponse` for the mutating endpoints. Column order is now documented and index access is type-checked; when a column is added to a SQL `SELECT`, the matching tuple type has to be updated or the build fails instead of drifting silently.
- Metadata fields the backend blanks out for unauthenticated callers (`poster`, `uploader`, `post_date`, `upload_date`, `uploaded_by`) are now typed `string | null` on `ParsedSticker` and `ProcessedSticker`, matching what `get_all_stickers` actually returns. `isEpochSentinel()` accepts `string | null | undefined`, and the duplicated date-conversion helpers in `edit-sticker-dialog.component.ts` were dropped in favour of the shared `shared/utils/date-utils.ts` versions. No behavioural change — the runtime values were already null.

### Removed

- **`@angular/animations`** dropped from `frontend/package.json`. Nothing under `src/` imports it, and it is no longer a peer dependency of `@angular/material` 22 — Material's animations work without it, and the app has never called `provideAnimations`/`provideAnimationsAsync`.
- **Support for WebGL1-only browsers.** MapLibre GL v6 removed the WebGL1 renderer, so the map now requires WebGL2 — on a browser without it, the map fails to initialise while the rest of the app keeps working. WebGL2 has been baseline in every major browser since Safari 15 (2021), so no currently supported browser is affected.

## [1.21.5] - 2026-07-21

### Highlights

- Security updates to the image-processing and build libraries. Nothing changes in how the app works.

### Security

- Resolved open Dependabot alerts via version floor raises (no application code changes):
  - **Backend** — `pillow` 12.2.0 → 12.3.0 floor (nine alerts: heap out-of-bounds write in `ImageCmsTransform.apply()` via output mode mismatch, JPEG2000 tiled-decode scratch-buffer DoS, decompression-bomb DoS via `PdfParser.PdfStream.decode()`, heap out-of-bounds write in `Image.paste()`/`Image.crop()` via signed coordinate overflow, TGA RLE encoder heap-data leak, `WindowsViewer.get_command()` OS command injection, missing decompression-bomb checks in `GdImageFile._open()`/`BdfFontFile`/`FontFile.compile()`/`PcfFontFile._load_bitmaps()`, out-of-bounds read via row stride on the McIdas AREA mmap path, and an EPS `%%BeginBinary` negative-byte-count infinite loop).
  - **Frontend** — `tar` (PAX numeric path type confusion causing a process crash) and `brace-expansion` (DoS via exponential-time `{}` group expansion), both transitive dependencies of the `@angular/cli`/`angular-server-side-configuration` toolchain. No override was needed: `frontend/pnpm-lock.yaml` had gone stale at `@angular/cli@21.2.15`, which resolved the vulnerable `tar@7.5.16`/`brace-expansion@2.1.0`/`brace-expansion@5.0.6`. Regenerating the lockfile from scratch picked up `@angular/cli@21.2.19` — already permitted by the existing `^21.2.15` range in `package.json` — which resolves the patched `tar@7.5.20`, `brace-expansion@2.1.2`, and `brace-expansion@5.0.7` on its own.

### Changed

- Audited every override in `frontend/pnpm-workspace.yaml` and removed all 15 that had accumulated since 1.13.0 (`socket.io-parser`, `glob@^10`, `path-to-regexp@^8`, `lodash`, `vite`, `follow-redirects`, `hono`, `esbuild`, `postcss`, `fast-uri`, `ip-address`, `qs`, `undici@^7`, `piscina@^5`, `@babel/core@^7`): a from-scratch lockfile resolution showed every one is now met or exceeded natively by already-permitted patch/minor versions of the `@angular/cli`/`@angular/build` toolchain (`socket.io-parser`, `lodash`, and `follow-redirects` had also dropped out of the dependency tree entirely and were dead weight regardless). `overrides:` in `pnpm-workspace.yaml` is now empty. Going forward, prefer refreshing the lockfile (delete `frontend/pnpm-lock.yaml` and reinstall, or `pnpm update` within existing ranges) over adding an override — reach for an override only when a parent package's own manifest still excludes the fixed version even after that refresh.

## [1.21.4] - 2026-06-24

### Highlights

- Security updates to third-party libraries. Nothing changes in how the app works.

### Security

- Resolved open Dependabot alerts via version floor raises (no application code changes):
  - **Backend** — `pydantic-settings` 2.14.1 → 2.14.2+ floor (GHSA-4xgf-cpjx-pc3j: `NestedSecretsSettingsSource` follows symlinks outside `secrets_dir`, enabling local file read and bypassing `secrets_dir_max_size`). Pinned via `[tool.uv].constraint-dependencies` since it is a transitive dependency of `fastapi[standard]`.
  - **Frontend** — `@babel/core` 7.29.0 → 7.29.7 (GHSA: arbitrary file read via `sourceMappingURL` comment — contrary to the note in 1.21.3, 7.29.6+ resolves the alert and remains compatible with `@angular/build@21.2.x`); `piscina` 5.1.4 → 5.2.0 (prototype pollution gadget → RCE via inherited `options.filename`, high severity); `undici@7` 7.24.4 → 7.28.0 (six alerts: TLS certificate validation bypass via dropped `requestTls` in SOCKS5 `ProxyAgent`, cross-origin request routing via SOCKS5 proxy pool reuse, cross-user information disclosure via shared cache whitespace bypass, HTTP response queue poisoning via keep-alive socket reuse, HTTP header injection via `Set-Cookie` percent-decoding, and `Set-Cookie` `SameSite` attribute downgrade). All three frontend packages are pinned via `pnpm-workspace.yaml` overrides targeting their respective major-version ranges; `undici@6.27.0` (already at the fixed version) is left untouched.

## [1.21.3] - 2026-06-17

### Highlights

- Security updates to third-party libraries. Nothing changes in how the app works.

### Security

- Resolved Dependabot alerts via version floor raises in backend dependencies (no application code changes):
  - **Backend** — `python-multipart` 0.0.28 → 0.0.31+ floor (quadratic-time CPU DoS via semicolon querystring parsing, negative Content-Length full-body buffering, semicolon parameter smuggling, and RFC 2231/5987 Content-Disposition smuggling); `cryptography` 48.0.0 → 48.0.1+ floor (vulnerable OpenSSL bundled in wheels).
  - **Frontend** — Dependabot alert #83 (`@babel/core` ≤7.29.0, low severity, arbitrary file read via sourceMappingURL comment) cannot be resolved on Angular 21: `@babel/core ≥7.29.1` introduced strict `NumericLiteral` AST validation that breaks `@angular/build@21.2.x`'s Angular compiler plugin when processing Angular Material's fesm2022 output. The alert will be dismissed; it is addressed by upgrading to Angular 22.

## [1.21.2] - 2026-06-16

### Highlights

- **Fixes the 1.21.1 release never shipping.** A supply-chain check blocked the frontend image from publishing, so 1.21.2 is the first build that actually contains the 1.21.1 changes.

### Fixed

- Frontend CI image build failed pnpm's supply-chain `minimumReleaseAge` policy: the lockfile pinned `electron-to-chromium@1.5.374`, published within the 24-hour release-age cutoff, so `pnpm install --frozen-lockfile` aborted with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. The 1.21.1 release was cut before this fix, so its frontend image never published.

### Changed

- Pinned the pnpm supply-chain release-age policy explicitly in `frontend/pnpm-workspace.yaml` (`minimumReleaseAge: 1440`) so the build no longer inherits whatever default the floating pnpm version ships, and excluded the high-churn, low-risk browser-data packages `electron-to-chromium` and `caniuse-lite` (`minimumReleaseAgeExclude`), which are bumped multiple times daily as transitive deps and were the only entries tripping the check.

## [1.21.1] - 2026-06-16

### Highlights

- Security updates to third-party libraries. Nothing changes in how the app works.

### Security

- Resolved all open Dependabot alerts via dependency upgrades (no application code changes):
  - **Backend** — `PyJWT` 2.12.1 → 2.13.0 (algorithm allow-list bypass, unbounded Base64URL DoS, and unbounded JWKS-request DoS); `starlette` 1.0.0 → 1.3.1 (missing Host-header validation that poisoned `request.url.path`). The `starlette` floor is pinned via `[tool.uv].constraint-dependencies` since it is a transitive FastAPI dependency.
  - **Frontend** — `@angular/core`, `@angular/common`, and `@angular/compiler` 21.2.12 → 21.2.17 (template/attribute namespace XSS bypasses, `HttpTransferCache` cross-request data leakage/poisoning, and `formatDate`/`digitsInfo` OOM DoS); `hono` → 4.12.25 (routing, cookie-injection, and JWT-scheme issues); `esbuild` 0.27.3 → 0.28.1 (Deno-path RCE and Windows dev-server file read), forced via a `pnpm` override because `@angular/build` pins esbuild exactly.

## [1.21.0] - 2026-05-30

### Highlights

- **For self-hosters:** plain HTTP traffic is now redirected to HTTPS automatically in the Helm chart. Nothing changes in the app itself.

### Added

- Traefik HTTP→HTTPS redirect middleware for the Helm chart — a `Middleware` CRD resource (`traefik.io/v1alpha1`) is created when `ingress.httpRedirect: true` (the new default). The middleware is automatically wired into the `Ingress` annotations so all plain-HTTP traffic is permanently redirected to HTTPS. Disable by setting `ingress.httpRedirect: false`. Requires Traefik CRDs to be installed in the cluster.

## [1.20.0] - 2026-05-29

### Highlights

- **StickerMap now speaks Dutch and English.** Switch language from the sidebar at any time — no reload needed, and your choice is remembered. Every screen is translated.

### Added

- Runtime i18n with Dutch and English support via `@ngx-translate/core` v17 — all user-facing strings across every feature and shared component are now translatable. Translation files live at `frontend/public/i18n/{nl,en}.json` and are served at `/i18n/*.json`. The active language is persisted in `localStorage` under the key `stickermap-lang`.
- Language switcher in the sidenav — the user can toggle between Dutch (default) and English at runtime without a page reload. Adding a new language requires only a JSON translation file and a one-line entry in `LanguageService`; the sidenav dropdown renders it automatically. See `frontend/README.md` for the step-by-step guide.

## [1.19.0] - 2026-05-26

### Highlights

- Internal cleanup and documentation updates. Nothing changes on screen.

### Changed

- Map component refactored: the edit-sticker modal extracted from `map.ts` into a standalone `EditStickerModalComponent` under `features/map/edit-sticker-modal/`, dropping ~270 lines from `map.ts`. Date-formatting helpers and the F-35 custom-cursor logic moved into reusable modules at `shared/utils/date-utils.ts` and `shared/utils/f35-cursor.ts`.

### Docs

- Root `README.md` Helm features table corrected — the chart has been external-only for both database and Keycloak since 1.17.0; the CNPG/standalone and embedded/external options described in earlier docs no longer exist.
- Frontend port `8181` added to the compose prerequisites in the root `README.md`.
- `backend/README.md` API endpoint reference expanded to cover the categories, removal-reports, admin maintenance jobs, archive/unarchive, image rotation, and export routes that previously had no documentation.
- `backend/README.md` Keycloak manual-run example switched to the `KC_BOOTSTRAP_ADMIN_USERNAME`/`KC_BOOTSTRAP_ADMIN_PASSWORD` env vars and pinned to `quay.io/keycloak/keycloak:26.6` to match `compose.yml`.
- `KEYCLOAK_CLIENT_SECRET` added to the backend env-variable table.
- `backend/.env.example` Keycloak variable renamed from the broken `KEYCLOAK_SERVER_URL` to `KEYCLOAK_URL` (the name the config code actually reads); `KEYCLOAK_INTERNAL_URL` added.
- Migration history table removed from `database_migrations/README.md` to avoid further drift — `uv run alembic history --verbose` is now the source of truth.

## [1.18.0] - 2026-05-22

### Highlights

- **"Date unknown" for stickers.** When you don't know when a sticker was posted, tick the box on the upload or edit form and it shows as "Unknown" instead of a made-up date.
- **Moving a sticker now shows where it was.** The old location stays visible as a blue marker while you pick the new one.
- **You are signed out when you close your browser again.** Sessions no longer persist across browser restarts, reversing the change made in 1.13.0.
- More sensible default zoom levels, a tidier sidebar menu, and fixes to the manual coordinate field and some small layout glitches in the upload and edit forms.

### Added

- Unknown post date support (fixes #119) — upload and edit forms now include a "Date unknown" checkbox; when checked, the date field is disabled and the sticker is stored with an epoch sentinel (`1970-01-01 00:00:00`). The map popup and sticker overview recognise the sentinel and display "Unknown" instead of the raw date.
- Added pnpm overrides in pnpm-workspace.yaml.

### Changed

- Reverted OIDC session storage back to `sessionStorage` (the library default); the earlier switch to `localStorage` introduced in 1.13.0 is undone so authentication tokens are no longer persisted across browser sessions.
- Split sidenav menu items to top and bottom
- Changing to a new location will show the previous location as a blue marker.
- Changed various default zoom levels to more sensible values.

### Fixed

- Fixed some small UI issues in sticker edit and upload forms.
- Fixed bug on manual coördinate input field.

### Removed

- Removed pnpm overrides from package.json.

## [1.17.2] - 2026-05-17

### Highlights

- **For self-hosters:** Helm chart image naming and tag fixes. Nothing changes in the app.

### Added

- Added latest (image) tag to helm values.

### Fixed

- Fixed image name in helm values.

## [1.17.1] - 2026-05-17

### Highlights

- **For self-hosters:** the Helm chart renders without errors when optional values are left unset. Nothing changes in the app.

### Fixed

- Set default values for helm chart to prevent template render errors.

## [1.17.0] - 2026-05-16

### Highlights

- **Switch between street, satellite, and terrain maps.** A new control in the bottom-left corner of the map; your choice is remembered for next time.
- **The category filter no longer covers the map controls on a phone.**
- **For self-hosters:** breaking Helm chart changes — the chart no longer ships a database or Keycloak, and the tile server URL is now three separate variables. Read the details below before upgrading.

### Added

- Map tile-type toggle (fixes #62) — switch between street, satellite, and terrain base layers from a `mat-button-toggle-group` in the bottom-left of the map. The active selection persists in `localStorage` and switching uses MapLibre's `setTiles()` so sticker markers and custom layers remain intact. Tile URLs are injected at runtime via three independent ngssc environment variables; any layer whose URL is unset is hidden from the toggle, and the toggle itself is hidden when only one layer is configured.

### Changed

- **Tile-server environment variable split** — `TILESERVER_URL` is replaced by `TILESERVER_URL_STREET`, `TILESERVER_URL_SATELLITE`, and `TILESERVER_URL_TERRAIN`. The street layer falls back to the bundled OpenStreetMap URL when its variable is unset. Helm `frontend.tileserverUrl` becomes `frontend.tileLayers.{street,satellite,terrain}`.
- **Helm chart refactored to external-only database and Keycloak** (chart version `0.3.0`) — breaking change for existing installs:
  - Removed embedded database support (CNPG `Cluster` CR and standalone `StatefulSet`); the chart no longer manages a database. Provide credentials via `database.existingSecretName` (reference an existing Secret) or raw `database.host/port/dbname/username/password` values (chart creates the Secret).
  - Removed embedded Keycloak deployment and realm auto-import (`stickermap-realm.json`). Configure an external Keycloak via the new top-level `keycloak` section (`keycloak.url`, `keycloak.internalUrl`, `keycloak.realm`, `keycloak.clientId`).
  - `global.hostname` moved to `ingress.hostname`.
  - Keycloak connection settings (`keycloakUrl`, `keycloakInternalUrl`, `keycloakRealm`, `keycloakClientId`, `keycloakClientSecret`) removed from `backend`; replaced by the `keycloak` section and a separate Secret.
  - CORS defaults tightened: `corsAllowedOrigins` now defaults to `https://<ingress.hostname>` (was `*`); `corsAllowedMethods` and `corsAllowedHeaders` are now explicit lists instead of `*`.
  - Backend memory limit raised from `256Mi` to `512Mi`.
  - Image `pullPolicy` changed from `IfNotPresent` to `Always` for backend, migrations, and frontend.

### Removed

- Helm templates for embedded Keycloak (`deployment`, `service`, `secret`, `configmap`) and bundled realm JSON
- Helm templates for CNPG `Cluster` and standalone PostgreSQL `StatefulSet`, `ConfigMap`, `Secret`, and `Service`

### Fixed

- Category filter no longer overlaps the map controls on mobile — left offset increased from `12px` to `60px` below the 600px breakpoint

## [1.16.0] - 2026-05-16

### Highlights

- **A maintenance page for admins.** See how many stickers are missing photos, thumbnails, or location data, and run cleanup jobs: generate missing thumbnails, shrink oversized photos, strip camera data from stored images, and delete files no longer linked to any sticker.
- **The map loads faster** — map tiles and sticker data are now fetched only when needed.
- **The sticker overview remembers your page size** and can now be sorted by category.

### Added

- Admin maintenance page (`/admin`) accessible only to `sm-admin` users, with a sidenav link
  - Stats dashboard: total stickers, missing thumbnails (DB and file), missing GPS, archived, and private counts
  - File audit panel: lists stickers whose full image or thumbnail file is missing from disk
  - **Generate missing thumbnails** — creates `_thumb` files for stickers with no thumbnail on disk or in DB
  - **Compress oversized images** — re-compresses images whose longest side exceeds the configured maximum (1920 px by default); also regenerates their thumbnails
  - **Strip EXIF data** — re-saves all existing images without EXIF metadata (location, device info) for privacy; regenerates thumbnails
  - **Cleanup orphan files** — deletes files in the upload directory that are no longer referenced by any sticker or removal report
  - All maintenance jobs run as fire-and-forget background tasks; a snackbar notification is shown when a job completes or fails
- `thumbnail` column added to the `stickers` table (migration `0008`); new stickers now persist the thumbnail filename at creation time
- Sticker overview now persists the selected page size across sessions and supports sorting by category

### Changed

- Map tiles and GeoJSON are now loaded lazily so the initial map render is faster (fixes #39)

## [1.15.0] - 2026-05-16

### Highlights

- **Mark a sticker as private** so it stays hidden from visitors who are not signed in. Private stickers carry a lock icon on the map and in the overview.
- **Export the sticker list** as CSV or GeoJSON (editors and admins).
- **Click a photo in a map popup to open it full size**, even when you are not signed in.

### Added

- GeoJSON and CSV export endpoint for editors and admins (fixes #60)
- Private sticker visibility toggle: uploaders can mark a sticker as private so it is hidden from unauthenticated visitors; any authenticated user with at least `sm-viewer` can still see it. Private stickers show a lock indicator on the map marker, in popups, and in the sticker overview table (fixes #43)
- Clicking the sticker thumbnail in the map popup now opens the full-size image for unauthenticated users

### Changed

- Backend split into routers (`stickers`, `categories`, `reports`) and a `core/` module (`auth`, `config`, `connections`, `logger`) for better separation of concerns

### Fixed

- Corrected Dutch authorization message shown to unauthenticated users in the map popup

## [1.14.0] - 2026-05-14

### Highlights

- **Stickers now have categories.** Pick one when uploading or editing, and sort the overview by it. Moderators manage the list of categories from a dedicated page.

### Added

- Sticker categories with moderator-controlled taxonomy: category selector on upload and edit, category column in the sticker overview, and a dedicated category management page guarded by a moderator role (fixes #41)

## [1.13.0] - 2026-05-14

### Highlights

- **You stay signed in between browser sessions.** (Reversed again in 1.18.0.)

### Changed

- Use `localStorage` instead of default `sessionStorage` for OIDC session persistence
- Migrate OIDC config to `provideAppInitializer` and `inject` API
- Cast `RSAAlgorithm.from_jwk` result to `RSAPublicKey` type in auth
- Bumped dependencies across backend, frontend, and infra

## [1.12.0] - 2026-05-10

### Highlights

- **Archive stickers instead of deleting them** (editors and admins).
- **Sticker details in map popups are now shown only to signed-in users.**

### Added

- Archive stickers as editor or admin (fixes #97)

### Fixed

- Show sticker popup info only when authenticated
- Force white color on sidebar timestamp text
- Prevent duplicate changelog entries when running bump_version.py with an existing version

## [1.11.0] - 2026-05-09

### Highlights

- **Report a sticker that is no longer there.** If you find that a sticker has been removed, you can now report it so the map stays accurate.
- **No more sideways scrolling** in the sticker overview on a phone.

### Added

- Report removed stickers

### Changed

- Bumped various dependencies
- Optimized Claude integration (.claude directory)

### Removed

- Removed all tests across the codebase

### Fixed

- No more horizontal scroll in sticker overview page on mobile devices

## [1.10.1] - 2026-05-06

### Highlights

- **Sidebar tooltips now appear whether the menu is expanded or collapsed.**

### Fixed

- Always show sidenav tooltips regardless of expanded state
- Clear default Keycloak admin password in Helm chart values

### Changed

- Bumped postcss to ^8.5.10 in frontend overrides

## [1.10.0] - 2026-05-05

### Highlights

- **Rotate sticker photos.** Photos that come out sideways can be turned the right way up, and new uploads are rotated automatically based on how the camera was held.
- **A proper mobile layout** across the whole app.

### Added

- Image rotation support: manual rotate action and automatic EXIF-based orientation on upload (fixes #85)

### Changed

- Refactored frontend UI for mobile responsiveness (fixes #87)

## [1.9.0] - 2026-05-02

### Highlights

- **A faster app when several people use it at once.** Nothing changes on screen.

### Added

- Database connection pooling for improved concurrency and resource utilisation (fixes #79)
- Targeted database indexes on frequently queried columns for improved query performance (fixes #80)
- `updated_at` column on stickers for auditability, automatically updated on every write (fixes #81)

### Fixed

- Increased backend memory limit in Helm chart values

### Changed

- Removed migration structural tests and the associated CI job

## [1.8.0] - 2026-04-19

### Highlights

- **See what's new after an update.** A dialog with the latest changes appears on your first visit after a new version ships.
- **Share a map view.** The map position and zoom are now part of the address bar, so you can bookmark a spot or send someone a link that opens exactly where you were.

### Added

- Release notes dialog shown on first visit after an update (fixes #66)

### Changed

- Map viewport state (center coordinates and zoom) is now encoded in URL query parameters, enabling shareable and bookmarkable map views (fixes #59)

## [1.7.0] - 2026-04-18

### Highlights

- **New accounts can view the map straight away** — every new user now gets viewer access automatically.
- **For self-hosters:** roles moved from realm scope to client scope in Keycloak, with a new group structure. Existing installs need to be updated.

### Changed

- Migrated Keycloak roles from realm scope to client scope under `stickermap-client` — backend now reads `resource_access.<clientId>.roles` from JWT instead of `realm_access.roles`
- Keycloak group hierarchy restructured: `stickermap` parent group with sub-groups `/stickermap/sm-viewer`, `/stickermap/sm-uploader`, `/stickermap/sm-editor`, `/stickermap/sm-admin`; each sub-group carries the matching client role
- `/stickermap/sm-viewer` set as realm default group so all new users receive viewer access automatically (fixes #71)
- Added Helm chart CI workflow for automated chart linting and packaging
- Updated backend and frontend dependencies

## [1.6.2] - 2026-04-18

### Highlights

- **A more reliable sign-in**, rebuilt on a standards-compliant OpenID Connect library.
- **For self-hosters:** photo size and quality limits are now configurable.

### Added

- Image processing configuration options (max dimensions, quality) configurable via environment variables

### Changed

- Migrated frontend authentication from `keycloak-angular` to `angular-auth-oidc-client` for standards-compliant OIDC support

## [1.6.1] - 2026-04-14

### Highlights

- **Signing in on a phone works again.**
- **For self-hosters:** the Helm chart is now a single flat chart and requires Helm v4.

### Changed

- Helm chart refactored into a single flat chart with flexible database modes (`cnpg` or `standalone`) and Helm v4 support (fixes #68)
- Helm chart documentation updated for v4 requirements and new database/Keycloak configuration options

### Fixed

- Async login not working on mobile devices

### Dependencies

- Bumped `cryptography` to 46.0.7

## [1.6.0] - 2026-04-10

### Highlights

- **Your camera data stays private.** Everything except the location is now stripped from uploaded photos — camera model, serial number, timestamps.
- **Uploads are smaller and faster.** Photos are resized and compressed on the server before being stored.
- **Sticker details in map popups now depend on whether you are signed in.**

### Added

- Server-side image optimization: uploaded images are resized and compressed before storage (fixes #57)
- Non-GPS EXIF metadata is stripped from uploaded images to protect uploader privacy (fixes #58)

### Changed

- Map popup content is now restricted based on authentication and role — unauthenticated users see limited sticker details (fixes #61)
- Allow inline HTML in Markdown-rendered content

## [1.5.0] - 2026-04-08

### Highlights

- **A short disclaimer before your first upload**, covering what is and is not OK to post.

### Added

- Upload disclaimer dialog shown before file upload (fixes #42)

### Changed

- Frontend restructured into `core/`, `features/`, and `shared/` layers for cleaner separation of concerns

## [1.4.0] - 2026-04-07

### Highlights

- **A sticker's date is now read from the photo even when it has no location data.**
- **Empty files and photos without location no longer break the upload** — you get a clear error instead.
- **An F-35 cursor that banks as you move the mouse** across the map.

### Added

- F-35 silhouette custom cursor on the map that rotates to follow mouse movement
- EXIF datetime extraction independent of GPS location — sticker date/time now read from image metadata even when GPS tags are absent (fixes #45)

### Changed

- Removed info popup shown on empty map clicks
- Updated backend, frontend, and CI dependencies

### Fixed

- File upload now correctly rejects zero-byte files and guards against missing GPS EXIF tags (fixes #44)
- Upgraded `lodash` to 4.18.1 via `pnpm` override to address CVE-2026-4800 (code injection) and CVE-2026-2950 (prototype pollution)
- Various transitive dependency security updates (Dependabot)

## [1.3.5] - 2026-04-01

### Highlights

- **The login screen now always appears** instead of trying to sign you in silently first.

### Changed

- Keycloak `onLoad` set to `login-required` to always show the login form instead of attempting silent authentication

## [1.3.4] - 2026-04-01

### Highlights

- **Uploader statistics show real names** instead of usernames.

### Fixed

- Uploader stats displayed `preferred_username` instead of first and last name

## [1.3.3] - 2026-03-31

### Highlights

- **Signing in works on mobile browsers again.**

### Fixed

- Removed silent SSO check (`silent-check-sso.html`) and disabled `checkLoginIframe` to fix authentication failures in mobile browsers caused by iframe restrictions

## [1.3.2] - 2026-03-22

### Highlights

- Internal changes to how sign-in tokens are handled. Nothing changes on screen.

### Changed

- Migrated JWT library from `python-jose` to `PyJWT` (`import jwt`) with `cryptography` backend for JWKS key handling
- Updated frontend dependencies

### Fixed

- Backend tests updated to pass authenticated user context in API test fixtures

## [1.3.1] - 2026-03-22

### Highlights

- **Dark mode now covers the screens it previously missed.**
- **Who uploaded a sticker is only shown to signed-in users.**

### Added

- `isViewer()` role checks in `AuthService`; UI elements gated on viewer role
- Dark-mode CSS custom properties added to global styles and component stylesheets
- Backend `/api/v1/stickers` (public endpoint) now restricts PII fields (`uploaded_by`) to authenticated viewers

### Fixed

- `PUBLIC_URL` default port in `compose.yml` aligned with `KEYCLOAK_URL` (both now use `8282`)
- Reverted backend and database_migrations Dockerfiles to `uv pip install --system` (fixes regression from 1.3.0)
- Typo in backend/database_migrations Dockerfiles

### Docs

- Removed incorrect note about `sm-viewer` being a default role for new users

## [1.3.0] - 2026-03-18

### Highlights

- **For self-hosters:** container image improvements and a renamed `FQDN` → `PUBLIC_URL` environment variable. Nothing changes in the app.

### Added

- OCI image labels (`title`, `version`, `source`, `authors`) to all Dockerfiles
- `.dockerignore` for the `database_migrations` service
- `CMD` instruction to frontend Dockerfile; `entrypoint.sh` now uses `exec "$@"` for proper signal handling

### Changed

- Renamed `FQDN` env var to `PUBLIC_URL` (now a full URL including protocol, e.g. `https://localhost`) in Caddyfile, Compose files, and `.env.example`
- Switched from `uv pip install --system` to `uv sync --no-dev --no-install-project` in backend and database\_migrations Dockerfiles
- Dev Compose (`compose.yml`) now uses `tmpfs` for Caddy data/config/srv volumes instead of named volumes
- Frontend container user changed from `1000` to `11953` with OpenShift-compatible group permissions (`g=u`)
- Expanded `.gitattributes` to enforce LF line endings for all text file types and mark lock files as generated
- `bump-version.sh` now also patches the `ARG IMAGE_VERSION` in all Dockerfiles

## [1.2.0] - 2026-03-15

### Highlights

- **A sticker overview page** with a sortable, filterable table, inline editing, and bulk delete.
- **Dark mode**, with a toggle that remembers your choice.
- **Statistics on the landing page** — how many stickers there are in total and per uploader.
- **The map remembers where you were.** The address bar updates as you pan and zoom, so bookmarks and shared links reopen the same view.

### Added

- Sticker overview page with sortable/filterable table, inline editing, and bulk delete
- Edit sticker dialog component for updating sticker fields
- Bulk delete dialog with confirmation
- Dark theme support with a theme toggle (persisted via `ThemeService`)
- Map deep-linking: URL hash updates on map move/zoom and restores position on load
- Statistics dashboard on the landing page showing sticker counts per uploader and total
- New backend endpoint `GET /api/v1/stats` returning sticker statistics
- `StickerStats` and `UploaderStat` models added to the frontend

### Changed

- Landing page layout updated to accommodate the statistics dashboard
- Map component extended with deep-link hash handling and sticker overview navigation
- App routing updated to include the sticker overview route

## [1.1.0] - 2026-03-14

### Highlights

- **A refreshed interface** built on Angular Material.

### Added

- Angular Material library integrated into the frontend UI components
- Database migration support via Alembic for schema versioning
- CI workflow to automatically bump version across all project files

### Changed

- Refactored backend to separate models from services for cleaner code structure
- Refactored frontend configuration and removed unused datasets
- Caddy now runs as an unprivileged user with adjusted port configuration
- Updated environment variable example file

### Fixed

- Helm chart packaging and global values corrected
- Frontend container image: fixed Dockerfile and entrypoint script for proper file handling and permissions
- Backend tests updated to work with the new Alembic migration setup

### Docs

- Updated README with improved layout and badge visibility
- Added authentication troubleshooting guide to README

### Dependencies

- Bumped `tar` and `hono` frontend packages (Dependabot)
- Updated `uv.lock`

## [1.0.0] - 2026-03-08

### Highlights

- **The first release of StickerMap.** Pin stickers on an interactive map, upload a photo and have its location filled in automatically, and sign in to add and manage your own.

### Added

- Initial release of StickerMap — an interactive map for pinning and sharing stickers
- FastAPI backend with PostGIS for geospatial sticker storage
- Angular frontend with Leaflet map integration
- Keycloak authentication with role-based access control (`sm-viewer`, `sm-uploader`, `sm-editor`, `sm-admin`)
- Helm chart for Kubernetes deployment (umbrella chart with backend, frontend, keycloak, database sub-charts)
- Docker Compose setup for local development
- CI pipeline with BuildKit-based container image builds
- Dependabot configured for automated dependency updates

[unreleased]: https://github.com/WatskeBart/stickermap/compare/1.24.1...HEAD
[1.24.1]: https://github.com/WatskeBart/stickermap/compare/1.24.0...1.24.1
[1.24.0]: https://github.com/WatskeBart/stickermap/compare/1.23.0...1.24.0
[1.23.0]: https://github.com/WatskeBart/stickermap/compare/1.22.1...1.23.0
[1.22.1]: https://github.com/WatskeBart/stickermap/compare/1.22.0...1.22.1
[1.22.0]: https://github.com/WatskeBart/stickermap/compare/1.21.5...1.22.0
[1.21.5]: https://github.com/WatskeBart/stickermap/compare/1.21.4...1.21.5
[1.21.4]: https://github.com/WatskeBart/stickermap/compare/1.21.3...1.21.4
[1.21.3]: https://github.com/WatskeBart/stickermap/compare/1.21.2...1.21.3
[1.21.2]: https://github.com/WatskeBart/stickermap/compare/1.21.1...1.21.2
[1.21.1]: https://github.com/WatskeBart/stickermap/compare/1.21.0...1.21.1
[1.21.0]: https://github.com/WatskeBart/stickermap/compare/1.20.0...1.21.0
[1.20.0]: https://github.com/WatskeBart/stickermap/compare/1.19.0...1.20.0
[1.19.0]: https://github.com/WatskeBart/stickermap/compare/1.18.0...1.19.0
[1.18.0]: https://github.com/WatskeBart/stickermap/compare/1.17.2...1.18.0
[1.17.2]: https://github.com/WatskeBart/stickermap/compare/1.17.1...1.17.2
[1.17.1]: https://github.com/WatskeBart/stickermap/compare/1.17.0...1.17.1
[1.17.0]: https://github.com/WatskeBart/stickermap/compare/1.16.0...1.17.0
[1.16.0]: https://github.com/WatskeBart/stickermap/compare/1.15.0...1.16.0
[1.15.0]: https://github.com/WatskeBart/stickermap/compare/1.14.0...1.15.0
[1.14.0]: https://github.com/WatskeBart/stickermap/compare/1.13.0...1.14.0
[1.13.0]: https://github.com/WatskeBart/stickermap/compare/1.12.0...1.13.0
[1.12.0]: https://github.com/WatskeBart/stickermap/compare/1.11.0...1.12.0
[1.11.0]: https://github.com/WatskeBart/stickermap/compare/1.10.1...1.11.0
[1.10.1]: https://github.com/WatskeBart/stickermap/compare/1.10.1...1.10.1
[1.10.0]: https://github.com/WatskeBart/stickermap/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/WatskeBart/stickermap/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/WatskeBart/stickermap/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/WatskeBart/stickermap/compare/1.6.2...1.7.0
[1.6.2]: https://github.com/WatskeBart/stickermap/compare/1.6.1...1.6.2
[1.6.1]: https://github.com/WatskeBart/stickermap/compare/1.6.0...1.6.1
[1.6.0]: https://github.com/WatskeBart/stickermap/compare/1.5.0...1.6.0
[1.5.0]: https://github.com/WatskeBart/stickermap/compare/1.4.0...1.5.0
[1.4.0]: https://github.com/WatskeBart/stickermap/compare/1.3.5...1.4.0
[1.3.5]: https://github.com/WatskeBart/stickermap/compare/1.3.4...1.3.5
[1.3.4]: https://github.com/WatskeBart/stickermap/compare/1.3.3...1.3.4
[1.3.3]: https://github.com/WatskeBart/stickermap/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/WatskeBart/stickermap/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/WatskeBart/stickermap/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/WatskeBart/stickermap/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/WatskeBart/stickermap/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/WatskeBart/stickermap/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/WatskeBart/stickermap/releases/tag/1.0.0
