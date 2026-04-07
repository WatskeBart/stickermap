import { Component, OnInit, inject, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { StickerService } from '../services/sticker.service';
import { AuthService } from '../services/auth.service';
import type { GPSInfo, StickerData } from '../models/sticker.model';

@Component({
  selector: 'app-sticker-form',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
  templateUrl: './sticker-form.component.html',
  styleUrls: ['./sticker-form.component.scss'],
})
export class StickerFormComponent implements OnInit {
  readonly stickerCreated = output<void>();
  readonly locationSelectionRequested = output<void>();
  readonly previewLocationRequested = output<{ lat: number; lon: number }>();

  private snackBar = inject(MatSnackBar);

  // Form state
  selectedFile = signal<File | null>(null);
  imagePreviewUrl = signal<string | null>(null);
  uploadedFilename = signal<string | null>(null);

  // GPS data from EXIF
  extractedGPS = signal<GPSInfo | null>(null);
  hasGPSData = signal(false);
  hasImageDate = signal(false);
  dateSource = signal<'gps' | 'exif' | null>(null);

  // Manual location selection
  manualLocation = signal<{ lat: number | null; lon: number | null }>({ lat: null, lon: null });
  useManualLocation = signal(false);
  manualLocationInput = signal('');

  // Form fields
  poster = signal('');
  uploader = signal('');
  postDate = signal('');

  // Auto-fill indicators
  isLocationAutoFilled = signal(false);
  isDateAutoFilled = signal(false);
  isUploaderAutoFilled = signal(false);

  // UI state
  uploading = signal(false);
  creating = signal(false);
  coordError = signal('');
  isSelectingLocation = signal(false);

  constructor(
    private stickerService: StickerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Auto-populate uploader name from Keycloak
    if (this.authService.isAuthenticated()) {
      const userInfo = this.authService.getUserInfo();
      if (userInfo) {
        const firstName = userInfo.given_name || '';
        const lastName = userInfo.family_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const name =
          fullName || userInfo.name || userInfo.preferred_username || userInfo.email || '';
        this.uploader.set(name);
        if (name) {
          this.isUploaderAutoFilled.set(true);
        }
      }
    }
  }

  private convertToBackendFormat(dateTimeLocal: string): string {
    if (!dateTimeLocal) return '';

    if (dateTimeLocal.includes(' ') && dateTimeLocal.length === 19) {
      return dateTimeLocal;
    }

    const localDate = new Date(dateTimeLocal);

    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private convertToInputFormat(backendDateTime: string): string {
    if (!backendDateTime) return '';

    const utcDate = new Date(backendDateTime + 'Z');

    const year = utcDate.getFullYear();
    const month = String(utcDate.getMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getDate()).padStart(2, '0');
    const hours = String(utcDate.getHours()).padStart(2, '0');
    const minutes = String(utcDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
      this.coordError.set('');

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreviewUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);

      this.uploadImage();
    }
  }

  uploadImage(): void {
    if (!this.selectedFile()) {
      this.snackBar.open('Selecteer een afbeelding', 'Sluiten', { duration: 3000 });
      return;
    }

    const uploaderName = this.uploader().trim() || 'Unknown';

    this.uploading.set(true);

    this.stickerService.uploadImage(this.selectedFile()!, uploaderName).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.uploadedFilename.set(response.filename);

        if (
          response.gps_info &&
          typeof response.gps_info === 'object' &&
          'latitude' in response.gps_info
        ) {
          const gpsInfo = response.gps_info as GPSInfo;
          this.extractedGPS.set(gpsInfo);
          this.hasGPSData.set(true);
          this.isLocationAutoFilled.set(true);

          if (gpsInfo.DateTimestamp) {
            this.postDate.set(this.convertToInputFormat(gpsInfo.DateTimestamp));
            this.hasImageDate.set(true);
            this.dateSource.set(gpsInfo.date_source ?? null);
            this.isDateAutoFilled.set(true);
          }

          const dateMsg = this.hasImageDate()
            ? (this.dateSource() === 'gps' ? ' en datum (GPS)' : ' en datum (EXIF)')
            : '';
          this.snackBar.open(
            `GPS locatie gevonden! Locatie${dateMsg} automatisch ingevuld.`,
            'OK',
            { duration: 4000 },
          );
        } else {
          this.hasGPSData.set(false);
          this.isLocationAutoFilled.set(false);
          this.useManualLocation.set(true);

          // No GPS location, but there may still be an EXIF date
          const exifInfo = response.gps_info as GPSInfo;
          if (exifInfo?.DateTimestamp) {
            this.postDate.set(this.convertToInputFormat(exifInfo.DateTimestamp));
            this.hasImageDate.set(true);
            this.dateSource.set(exifInfo.date_source ?? null);
            this.isDateAutoFilled.set(true);
          }

          const dateMsg = this.hasImageDate() ? ' Datum uit EXIF automatisch ingevuld.' : '';
          this.snackBar.open(
            `Afbeelding geüpload. Geen GPS locatie gevonden — selecteer een locatie op de kaart.${dateMsg}`,
            'OK',
            { duration: 5000 },
          );
        }
      },
      error: (error) => {
        this.uploading.set(false);
        this.snackBar.open(
          `Upload mislukt: ${error.error?.detail || error.message}`,
          'Sluiten',
          { duration: 5000, panelClass: ['snackbar-error'] },
        );
      },
    });
  }

  toggleLocationSelection(): void {
    this.useManualLocation.update((v) => !v);
  }

  requestMapLocationSelection(): void {
    this.isSelectingLocation.set(true);
    this.locationSelectionRequested.emit();
  }

  setManualLocation(lat: number, lon: number): void {
    this.manualLocation.set({ lat, lon });
    this.isSelectingLocation.set(false);
    this.manualLocationInput.set(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    this.snackBar.open(`Locatie geselecteerd: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'OK', {
      duration: 3000,
    });
  }

  onManualLocationInput(input: string): void {
    const trimmed = input.trim();

    if (!trimmed) {
      this.manualLocation.set({ lat: null, lon: null });
      this.coordError.set('');
      return;
    }

    const parts = trimmed.split(',').map((p) => p.trim());

    if (parts.length !== 2) {
      this.coordError.set('Vul het coordinaat in dit formaat: latitude, longitude');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      this.coordError.set('Ongeldige coordinaten. Vul een valide getallen in.');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    if (lat < -90 || lat > 90) {
      this.coordError.set('Latitude moet zijn tussen de -90 en 90');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    if (lon < -180 || lon > 180) {
      this.coordError.set('Longitude moet zijn tussen de -180 en 180');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    this.manualLocation.set({ lat, lon });
    this.coordError.set('');
    this.snackBar.open(`Locatie ingesteld: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'OK', {
      duration: 3000,
    });

    this.previewLocationRequested.emit({ lat, lon });
  }

  changeLocation(): void {
    this.manualLocation.set({ lat: null, lon: null });
    this.manualLocationInput.set('');
    this.isSelectingLocation.set(false);
  }

  canSubmit(): boolean {
    const loc = this.manualLocation();
    return !!(
      this.uploadedFilename() &&
      this.poster().trim() &&
      this.uploader().trim() &&
      this.postDate() &&
      (this.hasGPSData() || (loc.lat !== null && loc.lon !== null))
    );
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      this.snackBar.open(
        'Vul alle verplichte velden in en zorg dat de locatie is ingesteld.',
        'Sluiten',
        { duration: 4000, panelClass: ['snackbar-error'] },
      );
      return;
    }

    this.creating.set(true);

    const loc = this.manualLocation();
    let location;
    if (this.useManualLocation() && loc.lat !== null && loc.lon !== null) {
      location = { lat: loc.lat, lon: loc.lon };
    } else if (this.hasGPSData() && this.extractedGPS()) {
      location = {
        lat: this.extractedGPS()!.latitude!,
        lon: this.extractedGPS()!.longitude!,
      };
    } else {
      this.snackBar.open('Geen geldige locatie beschikbaar.', 'Sluiten', {
        duration: 4000,
        panelClass: ['snackbar-error'],
      });
      this.creating.set(false);
      return;
    }

    const stickerData: StickerData = {
      location: location,
      poster: this.poster().trim(),
      uploader: this.uploader().trim(),
      post_date: this.convertToBackendFormat(this.postDate()),
      image: this.uploadedFilename()!,
    };

    this.stickerService.createSticker(stickerData).subscribe({
      next: () => {
        this.creating.set(false);
        this.snackBar.open('Sticker succesvol toegevoegd!', 'OK', { duration: 3000 });
        setTimeout(() => {
          this.resetForm();
          this.stickerCreated.emit();
        }, 1500);
      },
      error: (error) => {
        this.creating.set(false);
        this.snackBar.open(
          `Sticker toevoegen is mislukt: ${error.error?.detail || error.message}`,
          'Sluiten',
          { duration: 5000, panelClass: ['snackbar-error'] },
        );
      },
    });
  }

  resetForm(): void {
    this.selectedFile.set(null);
    this.imagePreviewUrl.set(null);
    this.uploadedFilename.set(null);
    this.extractedGPS.set(null);
    this.hasGPSData.set(false);
    this.hasImageDate.set(false);
    this.dateSource.set(null);
    this.manualLocation.set({ lat: null, lon: null });
    this.manualLocationInput.set('');
    this.useManualLocation.set(false);
    this.poster.set('');
    this.postDate.set('');
    this.coordError.set('');
    this.isSelectingLocation.set(false);
    this.isLocationAutoFilled.set(false);
    this.isDateAutoFilled.set(false);

    if (!this.isUploaderAutoFilled()) {
      this.uploader.set('');
    }
  }
}
