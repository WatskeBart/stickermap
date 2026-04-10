import { Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { StickerService } from '../../core/services/sticker.service';
import type { UpdateStickerRequest } from '../../core/models/sticker.model';
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
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
})
export class MapComponent implements OnInit {
  readonly locationSelectionMode = input(false);
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

  // Edit modal state
  editingSticker = signal<any>(null);
  editForm = signal<{
    poster: string;
    post_date: string;
    location: { lat: number; lon: number };
    uploader: string;
  } | null>(null);
  editSaving = signal(false);
  editSelectingLocation = signal(false);
  uploaderList = signal<string[]>([]);

  // MapLibre style for OSM raster tiles
  readonly mapStyle = {
    version: 8 as const,
    sources: {
      'osm-tiles': {
        type: 'raster' as const,
        tiles: [environment.tileLayerUrl],
        tileSize: 256,
        attribution: '&copy; StickerMap',
      },
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster' as const,
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };

  targetFocus = signal<{ lat: number; lon: number } | null>(null);
  focusStickerId = signal<number | null>(null);

  private destroyRef = inject(DestroyRef);

  constructor(private stickerService: StickerService, private authService: AuthService, private route: ActivatedRoute) {
    // Watch locationSelectionMode to manage cursor and map state
    effect(() => {
      const selectionMode = this.locationSelectionMode();
      if (!this.mapInstance) return;

      if (selectionMode) {
        this.setMapCursor('crosshair');
        setTimeout(() => {
          this.mapInstance!.resize();
          this.mapInstance!.jumpTo({ center: [6.129131, 49.611267], zoom: 5 });
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
    }
    if (params['id']) {
      this.focusStickerId.set(+params['id']);
    }
    this.loadStickers();
  }

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
    if (target) {
      this.mapInstance.jumpTo({ center: [target.lon, target.lat], zoom: 17 });
    } else {
      // Handle race: stickers may have loaded before map was ready
      const s = this.stickers();
      if (s.length > 0) {
        this.fitBoundsToStickers(s);
      }
    }
  }

  loadStickers() {
    this.isLoading.set(true);
    this.stickerCount.set(0);

    this.stickerService.getAllStickers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rawStickers: any[]) => {
        const currentUser = this.authService.getUserInfo()?.preferred_username;

        const processed: ProcessedSticker[] = rawStickers.map((s: any) => {
          const geom = JSON.parse(s[1]);
          const [lon, lat] = geom.coordinates;
          const uploadedBy: string = s[7];
          const isOwner = uploadedBy != null && uploadedBy === currentUser;
          const canEdit = this.isEditor() || this.isAdmin() || (this.isUploader() && isOwner);
          const canDelete = this.isAdmin();
          const image: string = s[6];
          const lastDot = image.lastIndexOf('.');
          const thumbName = lastDot >= 0
            ? `${image.slice(0, lastDot)}_thumb${image.slice(lastDot)}`
            : `${image}_thumb`;

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
          };
        });

        this.stickers.set(processed);
        this.stickerCount.set(processed.length);

        const focusId = this.focusStickerId();
        if (focusId !== null) {
          const target = processed.find((s) => s.id === focusId);
          if (target) {
            this.openPopupStickerId.set(focusId);
            if (this.mapInstance) {
              this.mapInstance.jumpTo({ center: [target.lon, target.lat], zoom: 17 });
            }
          } else {
            this.fitBoundsToStickers(processed);
          }
        } else {
          this.fitBoundsToStickers(processed);
        }

        setTimeout(() => {
          this.isLoading.set(false);
        }, 300);
      },
      error: (error) => {
        console.error('Stickers laden is mislukt:', error);
        this.isLoading.set(false);
      },
    });
  }

  private fitBoundsToStickers(stickers: ProcessedSticker[]): void {
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
      { padding: 50, maxZoom: 15 },
    );
  }

  onMapClick(e: maplibregl.MapMouseEvent): void {
    if (this.editSelectingLocation()) {
      this.completeEditLocationSelection(e.lngLat.lat, e.lngLat.lng);
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

  // --- Edit Modal (inline) ---

  openEditModal(stickerId: number): void {
    this.openPopupStickerId.set(null);
    this.editSelectingLocation.set(false);

    // Fetch uploaders list
    this.stickerService.getUploaders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.uploaderList.set(response.uploaders);
      },
      error: (err) => {
        console.error('Failed to fetch uploaders:', err);
      },
    });

    this.stickerService.getSticker(stickerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sticker: any) => {
        const geom = JSON.parse(sticker[1]);
        this.editingSticker.set({
          id: sticker[0],
          poster: sticker[2],
          uploader: sticker[3],
          post_date: sticker[4],
          upload_date: sticker[5],
          image: sticker[6],
          uploaded_by: sticker[7],
          location: { lat: geom.coordinates[1], lon: geom.coordinates[0] },
        });
        this.editForm.set({
          poster: sticker[2],
          post_date: sticker[4],
          location: { lat: geom.coordinates[1], lon: geom.coordinates[0] },
          uploader: sticker[3],
        });
      },
      error: (err: any) => {
        console.error('Failed to fetch sticker:', err);
      },
    });
  }

  closeEditModal(): void {
    this.editingSticker.set(null);
    this.editForm.set(null);
    this.editSaving.set(false);
    this.editSelectingLocation.set(false);
  }

  saveEdit(): void {
    const currentEditingSticker = this.editingSticker();
    const currentEditForm = this.editForm();
    if (!currentEditingSticker || !currentEditForm) return;

    this.editSaving.set(true);

    // Build update payload with only changed fields
    const updates: UpdateStickerRequest = {};

    if (currentEditForm.poster !== currentEditingSticker.poster) {
      updates.poster = currentEditForm.poster;
    }
    if (currentEditForm.post_date !== currentEditingSticker.post_date) {
      updates.post_date = currentEditForm.post_date;
    }
    if (
      currentEditForm.location.lat !== currentEditingSticker.location.lat ||
      currentEditForm.location.lon !== currentEditingSticker.location.lon
    ) {
      updates.location = currentEditForm.location;
    }
    // Admin-only fields
    if (this.isAdmin()) {
      if (currentEditForm.uploader !== currentEditingSticker.uploader) {
        updates.uploader = currentEditForm.uploader;
      }
    }

    if (Object.keys(updates).length === 0) {
      this.snackBar.open('Geen wijzigingen gedetecteerd', 'Sluiten', { duration: 3000 });
      this.editSaving.set(false);
      return;
    }

    this.stickerService.updateSticker(currentEditingSticker.id, updates).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.closeEditModal();
        this.refreshStickers();
        this.snackBar.open('Sticker succesvol bijgewerkt!', 'Sluiten', { duration: 3000 });
      },
      error: (err: any) => {
        this.editSaving.set(false);
        this.snackBar.open(
          `Bijwerken mislukt: ${err.error?.detail || err.message}`,
          'Sluiten',
          { duration: 5000, panelClass: ['snackbar-error'] },
        );
      },
    });
  }

  private readonly F35_SVG_PATH = `M 222.5,-0.5 C 222.833,-0.5 223.167,-0.5 223.5,-0.5C 238.264,26.2943 247.097,54.961 250,85.5C 253.256,117.214 256.923,148.881 261,180.5C 262.882,189.648 266.049,198.314 270.5,206.5C 276.463,201.872 282.13,196.872 287.5,191.5C 291.98,196.155 295.48,201.488 298,207.5C 299.536,231.819 300.703,256.152 301.5,280.5C 300.691,278.708 300.191,276.708 300,274.5C 299.5,275.667 298.667,276.5 297.5,277C 297.936,279.366 299.269,281.533 301.5,283.5C 301.371,308.08 311.371,327.247 331.5,341C 368.5,366.667 405.5,392.333 442.5,418C 443.996,420.714 444.996,423.547 445.5,426.5C 445.5,443.5 445.5,460.5 445.5,477.5C 418.543,483.656 391.543,489.656 364.5,495.5C 364.53,494.503 364.03,493.836 363,493.5C 361.5,494 360,494.5 358.5,495C 359.737,495.232 360.737,495.732 361.5,496.5C 340.323,500.402 319.323,505.069 298.5,510.5C 302.431,519.793 306.264,529.126 310,538.5C 328.333,551.5 346.667,564.5 365,577.5C 365.499,582.489 365.666,587.489 365.5,592.5C 364.71,591.391 364.21,590.058 364,588.5C 362.691,590.686 362.524,592.853 363.5,595C 362.833,595.333 362.167,595.667 361.5,596C 362.46,597.419 363.293,598.919 364,600.5C 364.186,597.964 364.686,595.631 365.5,593.5C 365.831,601.528 365.498,609.528 364.5,617.5C 353.24,620.815 341.907,623.815 330.5,626.5C 330.083,625.876 329.416,625.543 328.5,625.5C 326.5,626 324.5,626.5 322.5,627C 321.748,627.671 321.414,628.504 321.5,629.5C 305.012,633.67 288.678,638.003 272.5,642.5C 271.833,642.5 271.167,642.5 270.5,642.5C 269.15,633.767 267.483,625.1 265.5,616.5C 266.376,616.631 267.043,616.298 267.5,615.5C 267.185,613.517 266.185,612.184 264.5,611.5C 260.733,592.834 256.9,574.167 253,555.5C 252.333,554.167 251.667,554.167 251,555.5C 249.772,560.281 248.272,564.947 246.5,569.5C 245.074,570.802 243.741,572.302 242.5,574C 243.094,574.464 243.761,574.631 244.5,574.5C 244.335,576.827 243.669,578.993 242.5,581C 239.274,582.199 235.941,582.699 232.5,582.5C 231.036,581.84 229.369,581.507 227.5,581.5C 225.36,581.556 223.694,582.223 222.5,583.5C 216.115,583.061 209.781,582.228 203.5,581C 199.743,572.064 196.576,562.897 194,553.5C 186.718,582.965 180.218,612.632 174.5,642.5C 173.833,642.5 173.167,642.5 172.5,642.5C 151.351,636.545 130.018,630.878 108.5,625.5C 108.063,623.926 107.063,622.759 105.5,622C 103.302,621.627 101.135,621.127 99,620.5C 97.9701,620.836 97.4701,621.503 97.5,622.5C 91.2115,621.101 85.2115,619.101 79.5,616.5C 80.329,609.011 80.829,601.344 81,593.5C 81.6543,594.696 82.1543,594.696 82.5,593.5C 80.1945,591.019 80.1945,588.686 82.5,586.5C 82.1543,585.304 81.6543,585.304 81,586.5C 80.502,583.518 80.3354,580.518 80.5,577.5C 97.2201,565.45 114.22,553.783 131.5,542.5C 130.537,543.363 130.537,544.03 131.5,544.5C 132.386,543.675 132.719,542.675 132.5,541.5C 133.315,540.163 134.482,539.163 136,538.5C 139.249,529.084 143.083,519.917 147.5,511C 136.098,507.4 124.431,504.567 112.5,502.5C 114.887,500.342 114.22,499.508 110.5,500C 109.944,500.383 109.611,500.883 109.5,501.5C 72.7458,493.883 36.0791,485.883 -0.5,477.5C -0.5,466.5 -0.5,455.5 -0.5,444.5C 0.179784,436.098 0.84645,427.598 1.5,419C 34.8767,395.32 68.5433,372.153 102.5,349.5C 102.56,350.043 102.893,350.376 103.5,350.5C 104.386,349.675 104.719,348.675 104.5,347.5C 112.741,341.94 120.741,335.94 128.5,329.5C 135.783,319.935 140.616,309.268 143,297.5C 144.414,267.14 146.081,236.806 148,206.5C 150.16,200.682 153.493,195.682 158,191.5C 163.468,195.967 168.635,200.8 173.5,206C 174.332,206.688 174.998,206.521 175.5,205.5C 179.172,198.49 182.005,191.157 184,183.5C 186.25,167.166 188.417,150.832 190.5,134.5C 191.222,134.918 191.722,135.584 192,136.5C 192.602,133.779 192.435,131.113 191.5,128.5C 192.834,104.658 195.668,80.9916 200,57.5C 204.465,36.9296 211.965,17.5962 222.5,-0.5 Z`;

  private buildF35Cursor(angleDeg = 0, size = 48, color = '#000000'): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 446 643"><g transform="rotate(${angleDeg}, 223, 321.5)"><path fill="${color}" d="${this.F35_SVG_PATH}"/></g></svg>`;
    const encoded = encodeURIComponent(svg);
    const rad = (angleDeg * Math.PI) / 180;
    const half = size / 2;
    const hotspotX = Math.round(half + half * Math.sin(rad));
    const hotspotY = Math.round(half - half * Math.cos(rad));
    return `url("data:image/svg+xml,${encoded}") ${hotspotX} ${hotspotY}, auto`;
  }

  private setF35Cursor(angleDeg = 0): void {
    if (this.mapInstance) {
      this.mapInstance.getCanvas().style.cursor = this.buildF35Cursor(angleDeg);
    }
  }

  private setMapCursor(cursor: string): void {
    if (this.mapInstance) {
      this.mapInstance.getCanvas().style.cursor = cursor;
    }
  }

  startEditLocationSelection(): void {
    this.editSelectingLocation.set(true);
    this.setMapCursor('crosshair');
  }

  cancelEditLocationSelection(): void {
    this.editSelectingLocation.set(false);
    this.setF35Cursor(0);
  }

  completeEditLocationSelection(lat: number, lon: number): void {
    const currentEditForm = this.editForm();
    if (currentEditForm) {
      this.editForm.set({ ...currentEditForm, location: { lat, lon } });
      this.editSelectingLocation.set(false);
      this.setF35Cursor(0);
    }
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
