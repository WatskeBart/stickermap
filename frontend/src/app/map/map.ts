import { Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { StickerService } from '../services/sticker.service';
import type { UpdateStickerRequest } from '../models/sticker.model';
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
} from './delete-sticker-dialog.component';

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
        this.setMapCursor('');
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

    this.stickerService.getAllStickers().subscribe({
      next: (rawStickers: any[]) => {
        const currentUser = this.authService.getUserInfo()?.preferred_username;

        const processed: ProcessedSticker[] = rawStickers.map((s: any) => {
          const geom = JSON.parse(s[1]);
          const [lon, lat] = geom.coordinates;
          const uploadedBy: string = s[7];
          const isOwner = uploadedBy != null && uploadedBy === currentUser;
          const canEdit = this.isEditor() || this.isAdmin() || (this.isUploader() && isOwner);
          const canDelete = this.isAdmin();

          return {
            id: s[0],
            lat,
            lon,
            poster: s[2],
            uploader: s[3],
            post_date: s[4],
            upload_date: s[5],
            image: s[6],
            uploaded_by: uploadedBy,
            imageUrl: `/uploads/${s[6]}`,
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
    this.stickerService.getUploaders().subscribe({
      next: (response) => {
        this.uploaderList.set(response.uploaders);
      },
      error: (err) => {
        console.error('Failed to fetch uploaders:', err);
      },
    });

    this.stickerService.getSticker(stickerId).subscribe({
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

    this.stickerService.updateSticker(currentEditingSticker.id, updates).subscribe({
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
    this.setMapCursor('');
  }

  completeEditLocationSelection(lat: number, lon: number): void {
    const currentEditForm = this.editForm();
    if (currentEditForm) {
      this.editForm.set({ ...currentEditForm, location: { lat, lon } });
      this.editSelectingLocation.set(false);
      this.setMapCursor('');
    }
  }

  // --- Delete Confirmation (MatDialog) ---

  openDeleteConfirm(stickerId: number, poster: string): void {
    this.openPopupStickerId.set(null);
    const ref = this.dialog.open(DeleteStickerDialogComponent, {
      width: '400px',
      data: { stickerId, poster } satisfies DeleteDialogData,
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult | undefined) => {
      if (result?.deleted) {
        this.refreshStickers();
        this.snackBar.open('Sticker verwijderd.', 'Sluiten', { duration: 3000 });
      }
    });
  }
}
