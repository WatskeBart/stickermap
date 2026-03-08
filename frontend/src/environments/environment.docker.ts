export const environment = {
  production: true,
  tileLayerUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  keycloak: {
    url: 'http://localhost:8080', // Keycloak running on host
    realm: 'stickermap',
    clientId: 'stickermap-client',
  },
};
