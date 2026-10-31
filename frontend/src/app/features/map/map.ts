import { Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  getAvailableTileLayers,
  TILE_LAYER_STORAGE_KEY,
  type TileLayerOption,
  type TileLayerType,
} from '../../core/config/tile-layers.config';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { StickerService } from '../../core/services/sticker.service';
import * as maplibregl from 'maplibre-gl';
import {
  GeoJSONSourceComponent as MglGeoJSONSourceComponent,
  LayerComponent as MglLayerComponent,
  MapComponent as MglMapComponent,
  MarkerComponent as MglMarkerComponent,
  PopupComponent as MglPopupComponent,
} from '@maplibre/ngx-maplibre-gl';
import {
  DeleteStickerDialogComponent,
  type DeleteDialogData,
  type DeleteDialogResult,
} from '../../shared/components/delete-sticker-dialog/delete-sticker-dialog.component';
import {
  ReportRemovalDialogComponent,
  type ReportRemovalDialogData,
  type ReportRemovalDialogResult,
} from '../../shared/components/report-removal-dialog/report-removal-dialog.component';
import { CategoryService } from '../../core/services/category.service';
import type { Category } from '../../core/models/category.model';
import type { HqLocation, StickerPointGeoJson } from '../../core/models/sticker.model';
import { isEpochSentinel } from '../../shared/utils/date-utils';
import { formatDistance } from '../../shared/utils/distance-utils';
import { buildF35Cursor } from '../../shared/utils/f35-cursor';
import { EditStickerModalComponent } from './edit-sticker-modal/edit-sticker-modal.component';
import { DistanceLabelComponent } from './distance-label/distance-label.component';

/** Off, a line to the farthest shown sticker, lines to every shown sticker, or measuring between two stickers. */
type DistanceMode = 'off' | 'farthest' | 'all' | 'measure';
type LngLatTuple = [lng: number, lat: number];

const DISTANCE_MODE_STORAGE_KEY = 'stickermap-distance-mode';
/** Above this many lines from HQ the per-sticker distance tags crowd the map; popups still show the distance. */
const MAX_DISTANCE_TAGS = 25;

/**
 * Great-circle distance in metres on a sphere: the same model the leaderboard uses on the backend
 * (ST_Distance with use_spheroid = false), so the map and the home page show identical numbers.
 */
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return new maplibregl.LngLat(a.lon, a.lat).distanceTo(new maplibregl.LngLat(b.lon, b.lat));
}

/** End point of a line from `from`, shifted by 360° so the line takes the short way round the antimeridian. */
function shortWayRound(from: LngLatTuple, to: LngLatTuple): LngLatTuple {
  const lonDelta = to[0] - from[0];
  return [lonDelta > 180 ? to[0] - 360 : lonDelta < -180 ? to[0] + 360 : to[0], to[1]];
}

/** MapLibre draws a segment straight in Web Mercator, so a label belongs at the Mercator midpoint. */
function mercatorMidpoint(a: LngLatTuple, b: LngLatTuple): LngLatTuple {
  const ma = maplibregl.MercatorCoordinate.fromLngLat(a);
  const mb = maplibregl.MercatorCoordinate.fromLngLat(b);
  const mid = new maplibregl.MercatorCoordinate((ma.x + mb.x) / 2, (ma.y + mb.y) / 2).toLngLat();
  return [mid.lng, mid.lat];
}

function lineFeature(from: LngLatTuple, to: LngLatTuple) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: [from, to] },
  };
}

interface ProcessedSticker {
  id: number;
  lat: number;
  lon: number;
  /** Null for non-viewers — the backend blanks metadata out for unauthenticated callers. */
  poster: string | null;
  uploader: string | null;
  post_date: string | null;
  upload_date: string | null;
  extra_info: string | null;
  image: string;
  uploaded_by: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  canEdit: boolean;
  canDelete: boolean;
  removalCount: number;
  archived: boolean;
  canReport: boolean;
  category_id: number | null;
  category_name: string | null;
  category_icon_url: string | null;
  private: boolean;
  dateUnknown: boolean;
}

@Component({
  selector: 'app-map',
  imports: [
    FormsModule,
    MglMapComponent,
    MglMarkerComponent,
    MglPopupComponent,
    MglGeoJSONSourceComponent,
    MglLayerComponent,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    EditStickerModalComponent,
    DistanceLabelComponent,
    TranslatePipe,
  ],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapComponent implements OnInit {
  private stickerService = inject(StickerService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private categoryService = inject(CategoryService);

  readonly locationSelectionMode = input(false);
  readonly selectionStartLocation = input<{ lat: number; lon: number } | null>(null);
  readonly isAuthenticated = input(false);
  readonly isViewer = input(false);
  readonly isUploader = input(false);
  readonly isEditor = input(false);
  readonly isAdmin = input(false);
  readonly locationSelected = output<{ lat: number; lon: number }>();

  private mapInstance?: maplibregl.Map;
  private lastMousePos: maplibregl.Point | null = null;
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);

  // Loading state
  isLoading = signal(false);
  stickerCount = signal(0);

  // Full-size image overlay
  fullSizeImageUrl = signal<string | null>(null);

  // Stickers for declarative rendering
  stickers = signal<ProcessedSticker[]>([]);

  // Single signal for the selection/preview marker (green=click, blue=preview)
  activeSelectionMarker = signal<{ lat: number; lon: number; color: 'green' | 'blue' } | null>(
    null,
  );

  // Sticker popup: track which sticker's popup is open
  openPopupStickerId = signal<number | null>(null);
  openPopupSticker = computed(() => {
    const id = this.openPopupStickerId();
    if (id === null) return null;
    return this.stickers().find((s) => s.id === id) ?? null;
  });

  // Edit modal state (child component controlled via stickerId signal)
  editingStickerId = signal<number | null>(null);
  editSelectingLocation = signal(false);
  editPendingLocation = signal<{ lat: number; lon: number } | null>(null);

  // Category filter
  categories = signal<Category[]>([]);
  selectedCategoryFilter = signal<number | 'all'>('all');

  // Poster filter (viewers only: poster names are blank for anonymous callers). '' means all posters,
  // which cannot clash with a name because blank posters are left out of the list.
  selectedPosterFilter = signal('');
  posters = computed(() =>
    [...new Set(this.stickers().map((s) => s.poster?.trim() ?? ''))]
      .filter((poster) => poster !== '')
      .sort((a, b) => a.localeCompare(b)),
  );

  // Distances. HQ comes from the backend (viewers only); every distance is computed in the browser.
  // The HQ modes draw to the stickers the filters leave visible, so a poster filter shows only theirs.
  hq = signal<HqLocation | null>(null);
  distanceMode = signal<DistanceMode>(this.resolveInitialDistanceMode());
  measureStickerIds = signal<number[]>([]);

  readonly farthestLinePaint = { 'line-color': '#e17000', 'line-width': 3, 'line-dasharray': [2, 2] };
  readonly allLinesPaint = { 'line-color': '#e17000', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [2, 2] };
  readonly measureLinePaint = { 'line-color': '#e17000', 'line-width': 3 };

  hqLines = computed(() => {
    const mode = this.distanceMode();
    const hq = this.hq();
    if ((mode !== 'farthest' && mode !== 'all') || !hq) return null;

    const lang = this.languageService.current();
    const from: LngLatTuple = [hq.lon, hq.lat];
    let targets = this.visibleStickers().map((sticker) => ({ sticker, meters: distanceMeters(hq, sticker) }));
    if (mode === 'farthest' && targets.length > 0) {
      targets = [targets.reduce((farthest, t) => (t.meters > farthest.meters ? t : farthest))];
    }
    const ends = targets.map(({ sticker }) => shortWayRound(from, [sticker.lon, sticker.lat]));

    return {
      hq: from,
      ends,
      paint: mode === 'farthest' ? this.farthestLinePaint : this.allLinesPaint,
      geojson: { type: 'FeatureCollection' as const, features: ends.map((end) => lineFeature(from, end)) },
      // Farthest: one label halfway along the line, with the poster's name
      record:
        mode === 'farthest' && targets.length > 0
          ? {
              stickerId: targets[0].sticker.id,
              poster: targets[0].sticker.poster,
              distance: formatDistance(targets[0].meters, lang),
              lngLat: mercatorMidpoint(from, ends[0]),
            }
          : null,
      // Every sticker: a distance tag under each one, as long as they still fit
      tags:
        mode === 'all' && targets.length <= MAX_DISTANCE_TAGS
          ? targets.map(({ sticker, meters }) => ({
              stickerId: sticker.id,
              lngLat: [sticker.lon, sticker.lat] as LngLatTuple,
              distance: formatDistance(meters, lang),
            }))
          : [],
    };
  });

  measureLine = computed(() => {
    if (this.distanceMode() !== 'measure') return null;
    const [a, b] = this.measureStickerIds().map((id) => this.stickers().find((s) => s.id === id));
    if (!a || !b) return null;
    const from: LngLatTuple = [a.lon, a.lat];
    const to = shortWayRound(from, [b.lon, b.lat]);
    return {
      geojson: lineFeature(from, to),
      lngLat: mercatorMidpoint(from, to),
      distance: formatDistance(distanceMeters(a, b), this.languageService.current()),
    };
  });

  openPopupDistance = computed(() => {
    const sticker = this.openPopupSticker();
    const hq = this.hq();
    return sticker && hq ? formatDistance(distanceMeters(hq, sticker), this.languageService.current()) : null;
  });

  private resolveInitialDistanceMode(): DistanceMode {
    // Measuring is never stored, so a reload does not leave marker clicks picking stickers
    const stored = localStorage.getItem(DISTANCE_MODE_STORAGE_KEY);
    return stored === 'farthest' || stored === 'all' ? stored : 'off';
  }

  // Available tile layers (driven by configured env vars)
  readonly availableTileLayers: TileLayerOption[] = getAvailableTileLayers();
  activeTileLayer = signal<TileLayerType>(this.resolveInitialTileLayer());

  // MapLibre style for base raster tiles
  readonly mapStyle = {
    version: 8 as const,
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: [this.activeTileLayerUrl()],
        tileSize: 256,
        attribution: '&copy; StickerMap',
      },
    },
    layers: [
      {
        id: 'base-tiles-layer',
        type: 'raster' as const,
        source: 'base-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };

  private resolveInitialTileLayer(): TileLayerType {
    const available = this.availableTileLayers;
    const stored = (typeof localStorage !== 'undefined'
      ? localStorage.getItem(TILE_LAYER_STORAGE_KEY)
      : null) as TileLayerType | null;
    if (stored && available.some((o) => o.id === stored)) return stored;
    return available[0]?.id ?? 'street';
  }

  private activeTileLayerUrl(): string {
    const active = this.activeTileLayer();
    return (
      this.availableTileLayers.find((o) => o.id === active)?.url ??
      this.availableTileLayers[0]?.url ??
      ''
    );
  }

  switchTileLayer(type: TileLayerType): void {
    if (!type || type === this.activeTileLayer()) return;
    const option = this.availableTileLayers.find((o) => o.id === type);
    if (!option) return;
    this.activeTileLayer.set(type);
    localStorage.setItem(TILE_LAYER_STORAGE_KEY, type);
    const source = this.mapInstance?.getSource('base-tiles') as
      | maplibregl.RasterTileSource
      | undefined;
    source?.setTiles([option.url]);
  }

  targetFocus = signal<{ lat: number; lon: number } | null>(null);
  focusStickerId = signal<number | null>(null);
  viewportParams = signal<{ lat: number; lng: number; zoom: number } | null>(null);
  initialViewport = signal<{ center: [number, number]; zoom: number } | null>(null);

  private destroyRef = inject(DestroyRef);

  constructor() {
    // Watch locationSelectionMode to manage cursor and map state
    effect(() => {
      const selectionMode = this.locationSelectionMode();
      if (!this.mapInstance) return;

      if (selectionMode) {
        this.setMapCursor('crosshair');
        const startLoc = this.selectionStartLocation();
        setTimeout(() => {
          this.mapInstance!.resize();
          if (startLoc) {
            this.activeSelectionMarker.set({ lat: startLoc.lat, lon: startLoc.lon, color: 'blue' });
            this.mapInstance!.jumpTo({ center: [startLoc.lon, startLoc.lat], zoom: 7 });
          } else {
            this.mapInstance!.jumpTo(this.fallbackViewport());
          }
        }, 0);
      } else {
        this.setF35Cursor(0);
        this.activeSelectionMarker.set(null);
      }
    });
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    if (params['lat'] && params['lon']) {
      this.targetFocus.set({ lat: +params['lat'], lon: +params['lon'] });
      this.initialViewport.set({ center: [+params['lon'], +params['lat']], zoom: 17 });
    }
    if (params['id']) {
      this.focusStickerId.set(+params['id']);
    }
    if (!params['id'] && !params['lon'] && params['lat'] && params['lng'] && params['zoom']) {
      const lat = parseFloat(params['lat']);
      const lng = parseFloat(params['lng']);
      const zoom = parseFloat(params['zoom']);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom) &&
          lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
          zoom >= 0 && zoom <= 22) {
        this.viewportParams.set({ lat, lng, zoom });
        this.initialViewport.set({ center: [lng, lat], zoom });
      }
    }
    if (this.isViewer()) {
      this.loadHq();
    } else if (this.distanceMode() !== 'off') {
      // An HQ mode stored during an earlier signed-in visit; anonymous visitors can only measure
      this.distanceMode.set('off');
    }
    this.loadStickers();
    this.loadCategories();
  }

  setCategoryFilter(category: number | 'all'): void {
    this.selectedCategoryFilter.set(category);
    this.fitToVisibleStickers();
  }

  setPosterFilter(poster: string): void {
    this.selectedPosterFilter.set(poster);
    this.fitToVisibleStickers();
  }

  setDistanceMode(mode: DistanceMode): void {
    this.distanceMode.set(mode);
    this.measureStickerIds.set([]);
    if (mode === 'measure') {
      // While measuring, marker clicks pick stickers instead of opening popups
      this.openPopupStickerId.set(null);
      return;
    }
    localStorage.setItem(DISTANCE_MODE_STORAGE_KEY, mode);
    const lines = this.hqLines();
    if (lines) this.fitToCoordinates([lines.hq, ...lines.ends], { padding: 80 });
  }

  clearMeasurement(): void {
    this.measureStickerIds.set([]);
  }

  private loadHq(): void {
    this.stickerService
      .getHq()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hq) => this.hq.set(hq),
        error: () => {},
      });
  }

  /** Where the map starts without stickers or a known location: HQ for viewers, otherwise the whole world. */
  private fallbackViewport(): { center: [number, number]; zoom: number } {
    const hq = this.hq();
    return hq ? { center: [hq.lon, hq.lat], zoom: 7 } : { center: [0, 0], zoom: 2 };
  }

  private loadCategories(): void {
    this.categoryService
      .listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.categories.set(rows),
        error: () => {},
      });
  }

  visibleStickers = computed<ProcessedSticker[]>(() => {
    const category = this.selectedCategoryFilter();
    const poster = this.selectedPosterFilter();
    return this.stickers().filter(
      (s) =>
        (category === 'all' || s.category_id === category) &&
        (poster === '' || s.poster?.trim() === poster),
    );
  });

  onMapLoad(map: maplibregl.Map): void {
    this.mapInstance = map;
    this.setF35Cursor(0);

    map.on('mousemove', (e) => {
      if (this.locationSelectionMode() || this.editSelectingLocation()) return;
      if (this.lastMousePos) {
        const dx = e.point.x - this.lastMousePos.x;
        const dy = e.point.y - this.lastMousePos.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          const angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI) + map.getBearing();
          this.setF35Cursor(angleDeg);
        }
      }
      this.lastMousePos = e.point;
    });

    map.on('mouseout', () => {
      this.lastMousePos = null;
      if (!this.locationSelectionMode() && !this.editSelectingLocation()) {
        this.setF35Cursor(0);
      }
    });

    const target = this.targetFocus();
    const viewport = this.viewportParams();
    if (target) {
      this.mapInstance.jumpTo({ center: [target.lon, target.lat], zoom: 17 });
    } else if (viewport) {
      this.mapInstance.jumpTo({ center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
    } else if (this.focusStickerId() === null) {
      this.fitToVisibleStickers({ animate: false });
    }

    map.on('moveend', () => {
      if (this.locationSelectionMode() || this.editSelectingLocation()) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const url = new URL(window.location.href);
      url.searchParams.set('lat', center.lat.toFixed(5));
      url.searchParams.set('lng', center.lng.toFixed(5));
      url.searchParams.set('zoom', zoom.toFixed(2));
      window.history.replaceState(null, '', url.toString());
    });
  }

  loadStickers() {
    this.isLoading.set(true);
    this.stickerCount.set(0);

    this.stickerService.getAllStickers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rawStickers) => {
        const currentUser = this.authService.getUserInfo()?.preferred_username;

        const processed: ProcessedSticker[] = rawStickers
          .filter((s) => !s[10])
          .map((s) => {
            const geom = JSON.parse(s[1]) as StickerPointGeoJson;
            const [lon, lat] = geom.coordinates;
            const uploadedBy: string | null = s[7];
            const isOwner = uploadedBy != null && uploadedBy === currentUser;
            const canEdit = this.isEditor() || this.isAdmin() || (this.isUploader() && isOwner);
            const canDelete = this.isAdmin();
            const removalCount: number = s[9] ?? 0;
            const archived: boolean = s[10] ?? false;
            const canReport = this.isViewer() && !this.isEditor() && !this.isAdmin() && !archived;
            const image: string = s[6];
            const lastDot = image.lastIndexOf('.');
            const thumbName = lastDot >= 0
              ? `${image.slice(0, lastDot)}_thumb${image.slice(lastDot)}`
              : `${image}_thumb`;
            const categoryId: number | null = s[11] ?? null;
            const categoryName: string | null = s[12] ?? null;
            const categoryIconFile: string | null = s[13] ?? null;
            const isPrivate: boolean = s[14] ?? false;

            return {
              id: s[0],
              lat,
              lon,
              poster: s[2],
              uploader: s[3],
              post_date: s[4],
              upload_date: s[5],
              extra_info: s[15] ?? null,
              image,
              uploaded_by: uploadedBy,
              imageUrl: `/uploads/${image}`,
              thumbnailUrl: `/uploads/${thumbName}`,
              canEdit,
              canDelete,
              removalCount,
              archived,
              canReport,
              category_id: categoryId,
              category_name: categoryName,
              category_icon_url: categoryIconFile ? `/uploads/categories/${categoryIconFile}` : null,
              private: isPrivate,
              dateUnknown: isEpochSentinel(s[4]),
            };
          });

        this.stickers.set(processed);
        this.stickerCount.set(processed.length);

        const focusId = this.focusStickerId();
        if (this.initialViewport() === null) {
          if (focusId !== null) {
            const target = processed.find((s) => s.id === focusId);
            if (target) {
              this.openPopupStickerId.set(focusId);
              this.initialViewport.set({ center: [target.lon, target.lat], zoom: 15 });
            } else {
              this.initialViewport.set(
                processed.length > 0
                  ? this.boundsToViewport(processed)
                  : this.fallbackViewport(),
              );
            }
          } else {
            this.initialViewport.set(
              processed.length > 0
                ? this.boundsToViewport(processed)
                : this.fallbackViewport(),
            );
          }
        } else if (focusId !== null) {
          const target = processed.find((s) => s.id === focusId);
          if (target) this.openPopupStickerId.set(focusId);
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Stickers laden is mislukt:', error);
        if (this.initialViewport() === null) {
          this.initialViewport.set(this.fallbackViewport());
        }
        this.isLoading.set(false);
      },
    });
  }

  private boundsToViewport(stickers: ProcessedSticker[]): { center: [number, number]; zoom: number } {
    if (stickers.length === 1) {
      return { center: [stickers[0].lon, stickers[0].lat], zoom: 13 };
    }
    const lons = stickers.map((s) => s.lon);
    const lats = stickers.map((s) => s.lat);
    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
    const zoom = span === 0 ? 13 : Math.min(14, Math.max(1, Math.log2(360 / span) - 1));
    return { center: [centerLon, centerLat], zoom };
  }

  private fitBoundsToStickers(
    stickers: ProcessedSticker[],
    options: maplibregl.FitBoundsOptions = {},
  ): void {
    this.fitToCoordinates(stickers.map((s): LngLatTuple => [s.lon, s.lat]), options);
  }

  /**
   * Zoom to the stickers the filters leave visible, keeping HQ in view while HQ lines are drawn.
   * The first view uses it too, so setting both filters back to "all" returns to that view.
   */
  private fitToVisibleStickers(options: maplibregl.FitBoundsOptions = {}): void {
    const points = this.visibleStickers().map((s): LngLatTuple => [s.lon, s.lat]);
    if (points.length === 0) return;
    const lines = this.hqLines();
    this.fitToCoordinates(lines ? [lines.hq, ...points] : points, options);
  }

  private fitToCoordinates(coords: LngLatTuple[], options: maplibregl.FitBoundsOptions = {}): void {
    if (!this.mapInstance || coords.length === 0) return;

    if (coords.length === 1) {
      this.mapInstance.jumpTo({ center: coords[0], zoom: 13 });
      return;
    }

    const lons = coords.map(([lon]) => lon);
    const lats = coords.map(([, lat]) => lat);
    this.mapInstance.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 50, maxZoom: 15, ...options },
    );
  }

  fitToAllStickers(): void {
    this.fitBoundsToStickers(this.stickers());
  }

  onMapClick(e: maplibregl.MapMouseEvent): void {
    if (this.editSelectingLocation()) {
      this.editPendingLocation.set({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      this.editSelectingLocation.set(false);
      this.setF35Cursor(0);
    } else if (this.locationSelectionMode()) {
      this.activeSelectionMarker.set({ lat: e.lngLat.lat, lon: e.lngLat.lng, color: 'green' });
      this.locationSelected.emit({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    }
  }

  onMarkerClick(stickerId: number, event: Event): void {
    event.stopPropagation();
    if (this.distanceMode() === 'measure') {
      // First pick, second pick; a third pick starts a new measurement
      this.measureStickerIds.update((ids) =>
        ids.length === 1 && ids[0] !== stickerId ? [ids[0], stickerId] : [stickerId],
      );
      return;
    }
    this.openPopupStickerId.set(stickerId);
  }

  closeFullImage() {
    this.fullSizeImageUrl.set(null);
  }

  refreshStickers() {
    this.stickers.set([]);
    this.loadStickers();
  }

  previewLocation(lat: number, lon: number): void {
    this.activeSelectionMarker.set({ lat, lon, color: 'blue' });
    this.mapInstance?.jumpTo({ center: [lon, lat], zoom: 13 });
  }

  // --- Edit modal ---

  openEditModal(stickerId: number): void {
    this.openPopupStickerId.set(null);
    this.editingStickerId.set(stickerId);
  }

  onEditModalClosed(): void {
    this.editingStickerId.set(null);
    if (this.editSelectingLocation()) {
      this.editSelectingLocation.set(false);
      this.setF35Cursor(0);
    }
  }

  onLocationSelectionStarted(): void {
    this.editSelectingLocation.set(true);
    this.setMapCursor('crosshair');
  }

  onLocationSelectionCancelled(): void {
    this.editSelectingLocation.set(false);
    this.setF35Cursor(0);
  }

  // --- Cursor ---

  private setF35Cursor(angleDeg = 0): void {
    if (this.mapInstance) {
      this.mapInstance.getCanvas().style.cursor = buildF35Cursor(angleDeg);
    }
  }

  private setMapCursor(cursor: string): void {
    if (this.mapInstance) {
      this.mapInstance.getCanvas().style.cursor = cursor;
    }
  }

  // --- Report as removed (MatDialog) ---

  openReportDialog(stickerId: number, poster: string | null): void {
    this.openPopupStickerId.set(null);
    const ref = this.dialog.open(ReportRemovalDialogComponent, {
      width: '420px',
      data: { stickerId, poster } satisfies ReportRemovalDialogData,
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: ReportRemovalDialogResult | undefined) => {
      if (result?.reported) {
        this.refreshStickers();
        this.snackBar.open(this.translate.instant('map.reportedRemoved'), this.translate.instant('common.close'), { duration: 4000 });
      }
    });
  }

  // --- Delete Confirmation (MatDialog) ---

  openDeleteConfirm(stickerId: number, poster: string | null): void {
    this.openPopupStickerId.set(null);
    const ref = this.dialog.open(DeleteStickerDialogComponent, {
      width: '400px',
      data: { stickerId, poster } satisfies DeleteDialogData,
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: DeleteDialogResult | undefined) => {
      if (result?.deleted) {
        this.refreshStickers();
        this.snackBar.open(this.translate.instant('map.deleted'), this.translate.instant('common.close'), { duration: 3000 });
      }
    });
  }
}
