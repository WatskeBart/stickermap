export const environment = {
  production: true,
  tileLayers: {
    street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
  },
  keycloak: {
    url: 'http://localhost:8080', // Keycloak running on host
    realm: 'stickermap',
    clientId: 'stickermap-client',
  },
};
