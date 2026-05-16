import { environment } from '../../../environments/environment';

export type TileLayerType = 'street' | 'satellite' | 'terrain';

export interface TileLayerOption {
  id: TileLayerType;
  label: string;
  url: string;
}

const TILE_LAYER_LABELS: Record<TileLayerType, string> = {
  street: 'Straat',
  satellite: 'Satelliet',
  terrain: 'Terrein',
};

const TILE_LAYER_ORDER: TileLayerType[] = ['street', 'satellite', 'terrain'];

export const TILE_LAYER_STORAGE_KEY = 'stickermap-tile-layer';

export function getAvailableTileLayers(): TileLayerOption[] {
  const urls = environment.tileLayers;
  return TILE_LAYER_ORDER
    .map((id) => ({ id, label: TILE_LAYER_LABELS[id], url: urls[id] }))
    .filter((opt) => !!opt.url);
}
