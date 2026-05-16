import 'angular-server-side-configuration/process';

export const environment = {
  production: process.env.PRODUCTION !== 'false',
  tileLayers: {
    street: process.env.TILESERVER_URL_STREET || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: process.env.TILESERVER_URL_SATELLITE || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: process.env.TILESERVER_URL_TERRAIN || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
  },
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'stickermap',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'stickermap-client',
  },
};
