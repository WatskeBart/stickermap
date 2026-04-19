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
