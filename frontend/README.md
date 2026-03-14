# Frontend

Angular 21 frontend for the StickerMap application.

## Installation

Install dependencies using pnpm:

```bash
pnpm install
```

## Development Server

To start a local development server, run:

```bash
pnpm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The development server is configured to proxy API requests to the backend (see [proxy.conf.json](src/proxy.conf.json)).

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm test
```

## Environment Variables


| Variable | Description | Default |
| -------- | ----------- | ------- |
| `BACKEND_URL` | Backend API for nginx proxy | `http://backend:5555` |
| `FQDN` | Fully Qualified Domain Name aka hostname | `localhost` |

These ariables are injected at runtime via angular-server-side-configuration binary called `ngssc`.

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `KEYCLOAK_URL` | Keycloak server URL | `http://localhost:8080` |
| `KEYCLOAK_REALM` | Realm name | `stickermap` |
| `KEYCLOAK_CLIENT_ID` | Client ID | `stickermap-client` |
| `TILESERVER_URL` | Map tile server | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |