export interface ChangelogSection {
  type: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date?: string;
  sections: ChangelogSection[];
}

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '1.21.2',
    date: '2026-06-16',
    sections: [
      {
        type: 'Fixed',
        items: [
          'Frontend CI image build failed pnpm\'s supply-chain <code>minimumReleaseAge</code> policy: the lockfile pinned <code>electron-to-chromium@1.5.374</code>, published within the 24-hour release-age cutoff, so <code>pnpm install --frozen-lockfile</code> aborted with <code>ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION</code>. The 1.21.1 release was cut before this fix, so its frontend image never published.',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Pinned the pnpm supply-chain release-age policy explicitly in <code>frontend/pnpm-workspace.yaml</code> (<code>minimumReleaseAge: 1440</code>) so the build no longer inherits whatever default the floating pnpm version ships, and excluded the high-churn, low-risk browser-data packages <code>electron-to-chromium</code> and <code>caniuse-lite</code> (<code>minimumReleaseAgeExclude</code>), which are bumped multiple times daily as transitive deps and were the only entries tripping the check.',
        ],
      },
    ],
  },
  {
    version: '1.21.1',
    date: '2026-06-16',
    sections: [
      {
        type: 'Security',
        items: [
          'Resolved all open Dependabot alerts via dependency upgrades (no application code changes):',
        ],
      },
    ],
  },
  {
    version: '1.21.0',
    date: '2026-05-30',
    sections: [
      {
        type: 'Added',
        items: [
          'Traefik HTTP→HTTPS redirect middleware for the Helm chart — a <code>Middleware</code> CRD resource (<code>traefik.io/v1alpha1</code>) is created when <code>ingress.httpRedirect: true</code> (the new default). The middleware is automatically wired into the <code>Ingress</code> annotations so all plain-HTTP traffic is permanently redirected to HTTPS. Disable by setting <code>ingress.httpRedirect: false</code>. Requires Traefik CRDs to be installed in the cluster.',
        ],
      },
    ],
  },
  {
    version: '1.20.0',
    date: '2026-05-29',
    sections: [
      {
        type: 'Added',
        items: [
          'Runtime i18n with Dutch and English support via <code>@ngx-translate/core</code> v17 — all user-facing strings across every feature and shared component are now translatable. Translation files live at <code>frontend/public/i18n/{nl,en}.json</code> and are served at <code>/i18n/*.json</code>. The active language is persisted in <code>localStorage</code> under the key <code>stickermap-lang</code>.',
          'Language switcher in the sidenav — the user can toggle between Dutch (default) and English at runtime without a page reload. Adding a new language requires only a JSON translation file and a one-line entry in <code>LanguageService</code>; the sidenav dropdown renders it automatically. See <code>frontend/README.md</code> for the step-by-step guide.',
        ],
      },
    ],
  },
  {
    version: '1.19.0',
    date: '2026-05-26',
    sections: [
      {
        type: 'Changed',
        items: [
          'Map component refactored: the edit-sticker modal extracted from <code>map.ts</code> into a standalone <code>EditStickerModalComponent</code> under <code>features/map/edit-sticker-modal/</code>, dropping ~270 lines from <code>map.ts</code>. Date-formatting helpers and the F-35 custom-cursor logic moved into reusable modules at <code>shared/utils/date-utils.ts</code> and <code>shared/utils/f35-cursor.ts</code>.',
        ],
      },
      {
        type: 'Docs',
        items: [
          'Root <code>README.md</code> Helm features table corrected — the chart has been external-only for both database and Keycloak since 1.17.0; the CNPG/standalone and embedded/external options described in earlier docs no longer exist.',
          'Frontend port <code>8181</code> added to the compose prerequisites in the root <code>README.md</code>.',
          '<code>backend/README.md</code> API endpoint reference expanded to cover the categories, removal-reports, admin maintenance jobs, archive/unarchive, image rotation, and export routes that previously had no documentation.',
          '<code>backend/README.md</code> Keycloak manual-run example switched to the <code>KC_BOOTSTRAP_ADMIN_USERNAME</code>/<code>KC_BOOTSTRAP_ADMIN_PASSWORD</code> env vars and pinned to <code>quay.io/keycloak/keycloak:26.6</code> to match <code>compose.yml</code>.',
          '<code>KEYCLOAK_CLIENT_SECRET</code> added to the backend env-variable table.',
          '<code>backend/.env.example</code> Keycloak variable renamed from the broken <code>KEYCLOAK_SERVER_URL</code> to <code>KEYCLOAK_URL</code> (the name the config code actually reads); <code>KEYCLOAK_INTERNAL_URL</code> added.',
          'Migration history table removed from <code>database_migrations/README.md</code> to avoid further drift — <code>uv run alembic history --verbose</code> is now the source of truth.',
        ],
      },
    ],
  },
  {
    version: '1.18.0',
    date: '2026-05-22',
    sections: [
      {
        type: 'Added',
        items: [
          'Unknown post date support — upload and edit forms now include a "Date unknown" checkbox; when checked, the date field is disabled and the sticker is stored with an epoch sentinel (<code>1970-01-01 00:00:00</code>). The map popup and sticker overview recognise the sentinel and display "Unknown" instead of the raw date.',
          'Added pnpm overrides in pnpm-workspace.yaml.',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Reverted OIDC session storage back to <code>sessionStorage</code> (the library default); the earlier switch to <code>localStorage</code> introduced in 1.13.0 is undone so authentication tokens are no longer persisted across browser sessions.',
          'Split sidenav menu items to top and bottom',
          'Changing to a new location will show the previous location as a blue marker.',
          'Changed various default zoom levels to more sensible values.',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Fixed some small UI issues in sticker edit and upload forms.',
          'Fixed bug on manual coördinate input field.',
        ],
      },
      {
        type: 'Removed',
        items: [
          'Removed pnpm overrides from package.json.',
        ],
      },
    ],
  },
  {
    version: '1.17.2',
    date: '2026-05-17',
    sections: [
      {
        type: 'Added',
        items: [
          'Added latest (image) tag to helm values.',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Fixed image name in helm values.',
        ],
      },
    ],
  },
  {
    version: '1.17.1',
    date: '2026-05-17',
    sections: [
      {
        type: 'Fixed',
        items: [
          'Set default values for helm chart to prevent template render errors.',
        ],
      },
    ],
  },
  {
    version: '1.17.0',
    date: '2026-05-16',
    sections: [
      {
        type: 'Added',
        items: [
          'Map tile-type toggle — switch between street, satellite, and terrain base layers from a <code>mat-button-toggle-group</code> in the bottom-left of the map. The active selection persists in <code>localStorage</code> and switching uses MapLibre\'s <code>setTiles()</code> so sticker markers and custom layers remain intact. Tile URLs are injected at runtime via three independent ngssc environment variables; any layer whose URL is unset is hidden from the toggle, and the toggle itself is hidden when only one layer is configured.',
        ],
      },
      {
        type: 'Changed',
        items: [
          '**Tile-server environment variable split** — <code>TILESERVER_URL</code> is replaced by <code>TILESERVER_URL_STREET</code>, <code>TILESERVER_URL_SATELLITE</code>, and <code>TILESERVER_URL_TERRAIN</code>. The street layer falls back to the bundled OpenStreetMap URL when its variable is unset. Helm <code>frontend.tileserverUrl</code> becomes <code>frontend.tileLayers.{street,satellite,terrain}</code>.',
          '**Helm chart refactored to external-only database and Keycloak** (chart version <code>0.3.0</code>) — breaking change for existing installs:',
        ],
      },
      {
        type: 'Removed',
        items: [
          'Helm templates for embedded Keycloak (<code>deployment</code>, <code>service</code>, <code>secret</code>, <code>configmap</code>) and bundled realm JSON',
          'Helm templates for CNPG <code>Cluster</code> and standalone PostgreSQL <code>StatefulSet</code>, <code>ConfigMap</code>, <code>Secret</code>, and <code>Service</code>',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Category filter no longer overlaps the map controls on mobile — left offset increased from <code>12px</code> to <code>60px</code> below the 600px breakpoint',
        ],
      },
    ],
  },
  {
    version: '1.16.0',
    date: '2026-05-16',
    sections: [
      {
        type: 'Added',
        items: [
          'Admin maintenance page (<code>/admin</code>) accessible only to <code>sm-admin</code> users, with a sidenav link',
          '<code>thumbnail</code> column added to the <code>stickers</code> table (migration <code>0008</code>); new stickers now persist the thumbnail filename at creation time',
          'Sticker overview now persists the selected page size across sessions and supports sorting by category',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Map tiles and GeoJSON are now loaded lazily so the initial map render is faster',
        ],
      },
    ],
  },
  {
    version: '1.15.0',
    date: '2026-05-16',
    sections: [
      {
        type: 'Added',
        items: [
          'GeoJSON and CSV export endpoint for editors and admins',
          'Private sticker visibility toggle: uploaders can mark a sticker as private so it is hidden from unauthenticated visitors; any authenticated user with at least <code>sm-viewer</code> can still see it. Private stickers show a lock indicator on the map marker, in popups, and in the sticker overview table',
          'Clicking the sticker thumbnail in the map popup now opens the full-size image for unauthenticated users',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Backend split into routers (<code>stickers</code>, <code>categories</code>, <code>reports</code>) and a <code>core/</code> module (<code>auth</code>, <code>config</code>, <code>connections</code>, <code>logger</code>) for better separation of concerns',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Corrected Dutch authorization message shown to unauthenticated users in the map popup',
        ],
      },
    ],
  },
  {
    version: '1.14.0',
    date: '2026-05-14',
    sections: [
      {
        type: 'Added',
        items: [
          'Sticker categories with moderator-controlled taxonomy: category selector on upload and edit, category column in the sticker overview, and a dedicated category management page guarded by a moderator role',
        ],
      },
    ],
  },
  {
    version: '1.13.0',
    date: '2026-05-14',
    sections: [
      {
        type: 'Changed',
        items: [
          'Use <code>localStorage</code> instead of default <code>sessionStorage</code> for OIDC session persistence',
          'Migrate OIDC config to <code>provideAppInitializer</code> and <code>inject</code> API',
          'Cast <code>RSAAlgorithm.from_jwk</code> result to <code>RSAPublicKey</code> type in auth',
          'Bumped dependencies across backend, frontend, and infra',
        ],
      },
    ],
  },
  {
    version: '1.12.0',
    date: '2026-05-10',
    sections: [
      {
        type: 'Added',
        items: [
          'Archive stickers as editor or admin',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Show sticker popup info only when authenticated',
          'Force white color on sidebar timestamp text',
          'Prevent duplicate changelog entries when running bump_version.py with an existing version',
        ],
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-05-09',
    sections: [
      {
        type: 'Added',
        items: [
          'Report removed stickers',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Bumped various dependencies',
          'Optimized Claude integration (.claude directory)',
        ],
      },
      {
        type: 'Removed',
        items: [
          'Removed all tests across the codebase',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'No more horizontal scroll in sticker overview page on mobile devices',
        ],
      },
    ],
  },
  {
    version: '1.10.1',
    date: '2026-05-06',
    sections: [
      {
        type: 'Fixed',
        items: [
          'Always show sidenav tooltips regardless of expanded state',
          'Clear default Keycloak admin password in Helm chart values',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Bumped postcss to ^8.5.10 in frontend overrides',
        ],
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-05-05',
    sections: [
      {
        type: 'Added',
        items: [
          'Image rotation support: manual rotate action and automatic EXIF-based orientation on upload',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Refactored frontend UI for mobile responsiveness',
        ],
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-02',
    sections: [
      {
        type: 'Added',
        items: [
          'Database connection pooling for improved concurrency and resource utilisation',
          'Targeted database indexes on frequently queried columns for improved query performance',
          '<code>updated_at</code> column on stickers for auditability, automatically updated on every write',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Increased backend memory limit in Helm chart values',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Removed migration structural tests and the associated CI job',
        ],
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-04-19',
    sections: [
      {
        type: 'Added',
        items: [
          'Release notes dialog shown on first visit after an update',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Map viewport state (center coordinates and zoom) is now encoded in URL query parameters, enabling shareable and bookmarkable map views',
        ],
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-04-18',
    sections: [
      {
        type: 'Changed',
        items: [
          'Migrated Keycloak roles from realm scope to client scope under <code>stickermap-client</code> — backend now reads <code>resource_access.&lt;clientId&gt;.roles</code> from JWT instead of <code>realm_access.roles</code>',
          'Keycloak group hierarchy restructured: <code>stickermap</code> parent group with sub-groups <code>/stickermap/sm-viewer</code>, <code>/stickermap/sm-uploader</code>, <code>/stickermap/sm-editor</code>, <code>/stickermap/sm-admin</code>; each sub-group carries the matching client role',
          '<code>/stickermap/sm-viewer</code> set as realm default group so all new users receive viewer access automatically',
          'Added Helm chart CI workflow for automated chart linting and packaging',
          'Updated backend and frontend dependencies',
        ],
      },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-04-18',
    sections: [
      {
        type: 'Added',
        items: [
          'Image processing configuration options (max dimensions, quality) configurable via environment variables',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Migrated frontend authentication from <code>keycloak-angular</code> to <code>angular-auth-oidc-client</code> for standards-compliant OIDC support',
        ],
      },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-04-14',
    sections: [
      {
        type: 'Changed',
        items: [
          'Helm chart refactored into a single flat chart with flexible database modes (<code>cnpg</code> or <code>standalone</code>) and Helm v4 support',
          'Helm chart documentation updated for v4 requirements and new database/Keycloak configuration options',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Async login not working on mobile devices',
        ],
      },
      {
        type: 'Dependencies',
        items: [
          'Bumped <code>cryptography</code> to 46.0.7',
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-04-10',
    sections: [
      {
        type: 'Added',
        items: [
          'Server-side image optimization: uploaded images are resized and compressed before storage',
          'Non-GPS EXIF metadata is stripped from uploaded images to protect uploader privacy',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Map popup content is now restricted based on authentication and role — unauthenticated users see limited sticker details',
          'Allow inline HTML in Markdown-rendered content',
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-08',
    sections: [
      {
        type: 'Added',
        items: [
          'Upload disclaimer dialog shown before file upload',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Frontend restructured into <code>core/</code>, <code>features/</code>, and <code>shared/</code> layers for cleaner separation of concerns',
        ],
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04-07',
    sections: [
      {
        type: 'Added',
        items: [
          'F-35 silhouette custom cursor on the map that rotates to follow mouse movement',
          'EXIF datetime extraction independent of GPS location — sticker date/time now read from image metadata even when GPS tags are absent',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Removed info popup shown on empty map clicks',
          'Updated backend, frontend, and CI dependencies',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'File upload now correctly rejects zero-byte files and guards against missing GPS EXIF tags',
          'Upgraded <code>lodash</code> to 4.18.1 via <code>pnpm</code> override to address CVE-2026-4800 (code injection) and CVE-2026-2950 (prototype pollution)',
          'Various transitive dependency security updates (Dependabot)',
        ],
      },
    ],
  },
  {
    version: '1.3.5',
    date: '2026-04-01',
    sections: [
      {
        type: 'Changed',
        items: [
          'Keycloak <code>onLoad</code> set to <code>login-required</code> to always show the login form instead of attempting silent authentication',
        ],
      },
    ],
  },
  {
    version: '1.3.4',
    date: '2026-04-01',
    sections: [
      {
        type: 'Fixed',
        items: [
          'Uploader stats displayed <code>preferred_username</code> instead of first and last name',
        ],
      },
    ],
  },
  {
    version: '1.3.3',
    date: '2026-03-31',
    sections: [
      {
        type: 'Fixed',
        items: [
          'Removed silent SSO check (<code>silent-check-sso.html</code>) and disabled <code>checkLoginIframe</code> to fix authentication failures in mobile browsers caused by iframe restrictions',
        ],
      },
    ],
  },
  {
    version: '1.3.2',
    date: '2026-03-22',
    sections: [
      {
        type: 'Changed',
        items: [
          'Migrated JWT library from <code>python-jose</code> to <code>PyJWT</code> (<code>import jwt</code>) with <code>cryptography</code> backend for JWKS key handling',
          'Updated frontend dependencies',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Backend tests updated to pass authenticated user context in API test fixtures',
        ],
      },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-03-22',
    sections: [
      {
        type: 'Added',
        items: [
          '<code>isViewer()</code> role checks in <code>AuthService</code>; UI elements gated on viewer role',
          'Dark-mode CSS custom properties added to global styles and component stylesheets',
          'Backend <code>/api/v1/stickers</code> (public endpoint) now restricts PII fields (<code>uploaded_by</code>) to authenticated viewers',
        ],
      },
      {
        type: 'Fixed',
        items: [
          '<code>PUBLIC_URL</code> default port in <code>compose.yml</code> aligned with <code>KEYCLOAK_URL</code> (both now use <code>8282</code>)',
          'Reverted backend and database_migrations Dockerfiles to <code>uv pip install --system</code> (fixes regression from 1.3.0)',
          'Typo in backend/database_migrations Dockerfiles',
        ],
      },
      {
        type: 'Docs',
        items: [
          'Removed incorrect note about <code>sm-viewer</code> being a default role for new users',
        ],
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-18',
    sections: [
      {
        type: 'Added',
        items: [
          'OCI image labels (<code>title</code>, <code>version</code>, <code>source</code>, <code>authors</code>) to all Dockerfiles',
          '<code>.dockerignore</code> for the <code>database_migrations</code> service',
          '<code>CMD</code> instruction to frontend Dockerfile; <code>entrypoint.sh</code> now uses <code>exec "$@"</code> for proper signal handling',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Renamed <code>FQDN</code> env var to <code>PUBLIC_URL</code> (now a full URL including protocol, e.g. <code>https://localhost</code>) in Caddyfile, Compose files, and <code>.env.example</code>',
          'Switched from <code>uv pip install --system</code> to <code>uv sync --no-dev --no-install-project</code> in backend and database\\_migrations Dockerfiles',
          'Dev Compose (<code>compose.yml</code>) now uses <code>tmpfs</code> for Caddy data/config/srv volumes instead of named volumes',
          'Frontend container user changed from <code>1000</code> to <code>11953</code> with OpenShift-compatible group permissions (<code>g=u</code>)',
          'Expanded <code>.gitattributes</code> to enforce LF line endings for all text file types and mark lock files as generated',
          '<code>bump-version.sh</code> now also patches the <code>ARG IMAGE_VERSION</code> in all Dockerfiles',
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-15',
    sections: [
      {
        type: 'Added',
        items: [
          'Sticker overview page with sortable/filterable table, inline editing, and bulk delete',
          'Edit sticker dialog component for updating sticker fields',
          'Bulk delete dialog with confirmation',
          'Dark theme support with a theme toggle (persisted via <code>ThemeService</code>)',
          'Map deep-linking: URL hash updates on map move/zoom and restores position on load',
          'Statistics dashboard on the landing page showing sticker counts per uploader and total',
          'New backend endpoint <code>GET /api/v1/stats</code> returning sticker statistics',
          '<code>StickerStats</code> and <code>UploaderStat</code> models added to the frontend',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Landing page layout updated to accommodate the statistics dashboard',
          'Map component extended with deep-link hash handling and sticker overview navigation',
          'App routing updated to include the sticker overview route',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-14',
    sections: [
      {
        type: 'Added',
        items: [
          'Angular Material library integrated into the frontend UI components',
          'Database migration support via Alembic for schema versioning',
          'CI workflow to automatically bump version across all project files',
        ],
      },
      {
        type: 'Changed',
        items: [
          'Refactored backend to separate models from services for cleaner code structure',
          'Refactored frontend configuration and removed unused datasets',
          'Caddy now runs as an unprivileged user with adjusted port configuration',
          'Updated environment variable example file',
        ],
      },
      {
        type: 'Fixed',
        items: [
          'Helm chart packaging and global values corrected',
          'Frontend container image: fixed Dockerfile and entrypoint script for proper file handling and permissions',
          'Backend tests updated to work with the new Alembic migration setup',
        ],
      },
      {
        type: 'Docs',
        items: [
          'Updated README with improved layout and badge visibility',
          'Added authentication troubleshooting guide to README',
        ],
      },
      {
        type: 'Dependencies',
        items: [
          'Bumped <code>tar</code> and <code>hono</code> frontend packages (Dependabot)',
          'Updated <code>uv.lock</code>',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-08',
    sections: [
      {
        type: 'Notes',
        items: [
          'Initial release of StickerMap — an interactive map for pinning and sharing stickers',
          'FastAPI backend with PostGIS for geospatial sticker storage',
          'Angular frontend with Leaflet map integration',
          'Keycloak authentication with role-based access control (<code>sm-viewer</code>, <code>sm-uploader</code>, <code>sm-editor</code>, <code>sm-admin</code>)',
          'Helm chart for Kubernetes deployment (umbrella chart with backend, frontend, keycloak, database sub-charts)',
          'Docker Compose setup for local development',
          'CI pipeline with BuildKit-based container image builds',
          'Dependabot configured for automated dependency updates',
        ],
      },
    ],
  },
];
