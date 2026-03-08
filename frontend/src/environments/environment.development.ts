import 'angular-server-side-configuration/process';

export const environment = {
  production: false,
  tileLayerUrl: process.env.TILESERVER_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'stickermap',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'stickermap-client',
  },
};
