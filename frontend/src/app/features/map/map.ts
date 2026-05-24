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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  getAvailableTileLayers,
  TILE_LAYER_STORAGE_KEY,
  type TileLayerOption,
  type TileLayerType,
} from '../../core/config/tile-layers.config';
import { AuthService } from '../../core/services/auth.service';
import { StickerService } from '../../core/services/sticker.service';
import maplibregl from 'maplibre-gl';
import {
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
import { isEpochSentinel } from '../../shared/utils/date-utils';
import { buildF35Cursor } from '../../shared/utils/f35-cursor';
import { EditStickerModalComponent } from './edit-sticker-modal/edit-sticker-modal.component';

interface ProcessedSticker {
  id: number;
  lat: number;
  lon: number;
  poster: string;
  uploader: string;
  post_date: string;
  upload_date: string;
  image: string;
  uploaded_by: string;
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
  standalone: true,
  imports: [
    FormsModule,
    MglMapComponent,
    MglMarkerComponent,
    MglPopupComponent,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonToggleModule,
    EditStickerModalComponent,
  ],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapComponent implements OnInit {
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

  constructor(
    private stickerService: StickerService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private categoryService: CategoryService,
  ) {
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
            this.mapInstance!.jumpTo({ center: [5.680191, 51.658250], zoom: 7 });
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
    this.loadStickers();
    this.loadCategories();
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
    const all = this.stickers();
    const filter = this.selectedCategoryFilter();
    if (filter === 'all') return all;
    return all.filter((s) => s.category_id === filter);
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
      const s = this.stickers();
      if (s.length > 0) {
        this.fitBoundsToStickers(s, { animate: false });
      }
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
      next: (rawStickers: any[]) => {
        const currentUser = this.authService.getUserInfo()?.preferred_username;

        const processed: ProcessedSticker[] = rawStickers
          .filter((s: any) => !s[10])
          .map((s: any) => {
            const geom = JSON.parse(s[1]);
            const [lon, lat] = geom.coordinates;
            const uploadedBy: string = s[7];
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
                  : { center: [5.680191, 51.658250], zoom: 7 },
              );
            }
          } else {
            this.initialViewport.set(
              processed.length > 0
                ? this.boundsToViewport(processed)
                : { center: [5.680191, 51.658250], zoom: 7 },
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
          this.initialViewport.set({ center: [5.680191, 51.658250], zoom: 7 });
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
    if (!this.mapInstance || stickers.length === 0) return;

    if (stickers.length === 1) {
      this.mapInstance.jumpTo({ center: [stickers[0].lon, stickers[0].lat], zoom: 13 });
      return;
    }

    const lons = stickers.map((s) => s.lon);
    const lats = stickers.map((s) => s.lat);
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

  openReportDialog(stickerId: number, poster: string): void {
    this.openPopupStickerId.set(null);
    const ref = this.dialog.open(ReportRemovalDialogComponent, {
      width: '420px',
      data: { stickerId, poster } satisfies ReportRemovalDialogData,
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: ReportRemovalDialogResult | undefined) => {
      if (result?.reported) {
        this.refreshStickers();
        this.snackBar.open('Sticker gemeld als verwijderd.', 'Sluiten', { duration: 4000 });
      }
    });
  }

  // --- Delete Confirmation (MatDialog) ---

  openDeleteConfirm(stickerId: number, poster: string): void {
    this.openPopupStickerId.set(null);
    const ref = this.dialog.open(DeleteStickerDialogComponent, {
      width: '400px',
      data: { stickerId, poster } satisfies DeleteDialogData,
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: DeleteDialogResult | undefined) => {
      if (result?.deleted) {
        this.refreshStickers();
        this.snackBar.open('Sticker verwijderd.', 'Sluiten', { duration: 3000 });
      }
    });
  }
}
