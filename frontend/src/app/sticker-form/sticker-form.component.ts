import { Component, OnInit, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { StickerService } from '../services/sticker.service';
import { AuthService } from '../services/auth.service';
import type { GPSInfo, StickerData } from '../models/sticker.model';
@Component({
  selector: 'app-sticker-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './sticker-form.component.html',
  styleUrls: ['./sticker-form.component.css']
})
export class StickerFormComponent implements OnInit {
  readonly stickerCreated = output<void>();
  readonly locationSelectionRequested = output<void>();
  readonly previewLocationRequested = output<{ lat: number, lon: number }>();

  // Form state
  selectedFile = signal<File | null>(null);
  imagePreviewUrl = signal<string | null>(null);
  uploadedFilename = signal<string | null>(null);

  // GPS data from EXIF
  extractedGPS = signal<GPSInfo | null>(null);
  hasGPSData = signal(false);
  hasGPSDate = signal(false);

  // Manual location selection
  manualLocation = signal<{ lat: number | null, lon: number | null }>({ lat: null, lon: null });
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
  errorMessage = signal('');
  successMessage = signal('');
  isSelectingLocation = signal(false);

  constructor(
    private stickerService: StickerService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Auto-populate uploader name from Keycloak
    if (this.authService.isAuthenticated()) {
      const userInfo = this.authService.getUserInfo();
      if (userInfo) {
        // Construct full name from given_name and family_name
        const firstName = userInfo.given_name || '';
        const lastName = userInfo.family_name || '';
        const fullName = `${firstName} ${lastName}`.trim();

        // Use full name if available, otherwise fallback to name, preferred_username, or email
        const name = fullName || userInfo.name || userInfo.preferred_username || userInfo.email || '';
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
      this.errorMessage.set('');
      this.successMessage.set('');

      // Create image preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreviewUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);

      // Auto-upload to extract GPS
      this.uploadImage();
    }
  }

  uploadImage(): void {
    if (!this.selectedFile()) {
      this.errorMessage.set('Selecteer een afbeelding');
      return;
    }

    const uploaderName = this.uploader().trim() || 'Unknown';

    this.uploading.set(true);
    this.errorMessage.set('');

    this.stickerService.uploadImage(this.selectedFile()!, uploaderName).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.uploadedFilename.set(response.filename);

        if (response.gps_info && typeof response.gps_info === 'object' && 'latitude' in response.gps_info) {
          const gpsInfo = response.gps_info as GPSInfo;
          this.extractedGPS.set(gpsInfo);
          this.hasGPSData.set(true);
          this.isLocationAutoFilled.set(true);

          if (gpsInfo.DateTimestamp) {
            this.postDate.set(this.convertToInputFormat(gpsInfo.DateTimestamp));
            this.hasGPSDate.set(true);
            this.isDateAutoFilled.set(true);
          }

          this.successMessage.set(`GPS data gevonden! Locatie${this.hasGPSDate() ? ' en datum' : ''} automatisch ingevuld uit de afbeelding.`);
        } else {
          this.hasGPSData.set(false);
          this.isLocationAutoFilled.set(false);
          this.successMessage.set('Afbeelding succesvol geupload. Geen GPS data gevonden - selecteeer een locatie op de kaart.');
          this.useManualLocation.set(true);
        }
      },
      error: (error) => {
        this.uploading.set(false);
        this.errorMessage.set(`Upload mislukt: ${error.error?.detail || error.message}`);
      }
    });
  }

  toggleLocationSelection(): void {
    this.useManualLocation.update(v => !v);
    if (this.useManualLocation()) {
      this.successMessage.set('Klik op de kaart om een locatie te selecteren');
    }
  }

  requestMapLocationSelection(): void {
    this.isSelectingLocation.set(true);
    this.locationSelectionRequested.emit();
  }

  setManualLocation(lat: number, lon: number): void {
    this.manualLocation.set({ lat, lon });
    this.isSelectingLocation.set(false);
    this.manualLocationInput.set(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    this.successMessage.set(`Locatie geselecteerd: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  }

  onManualLocationInput(input: string): void {
    const trimmed = input.trim();

    if (!trimmed) {
      this.manualLocation.set({ lat: null, lon: null });
      this.errorMessage.set('');
      return;
    }

    const parts = trimmed.split(',').map(p => p.trim());

    if (parts.length !== 2) {
      this.errorMessage.set('Vul het coordinaat in dit formaat: latitude, longitude');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      this.errorMessage.set('Ongeldige coordinaten. Vul een valide getallen in.');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    if (lat < -90 || lat > 90) {
      this.errorMessage.set('Latitude moet zijn tussen de -90 en 90');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    if (lon < -180 || lon > 180) {
      this.errorMessage.set('Longitude moet zijn tussen de -180 en 180');
      this.manualLocation.set({ lat: null, lon: null });
      return;
    }

    this.manualLocation.set({ lat, lon });
    this.errorMessage.set('');
    this.successMessage.set(`Locatie ingesteld: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);

    this.previewLocationRequested.emit({ lat, lon });
  }

  changeLocation(): void {
    this.manualLocation.set({ lat: null, lon: null });
    this.manualLocationInput.set('');
    this.isSelectingLocation.set(false);
    this.successMessage.set('');
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
      this.errorMessage.set('Vul alle verplichte velden in en zorg dat de locatie is ingesteld.');
      return;
    }

    this.creating.set(true);
    this.errorMessage.set('');

    const loc = this.manualLocation();
    let location;
    if (this.useManualLocation() && loc.lat !== null && loc.lon !== null) {
      location = { lat: loc.lat, lon: loc.lon };
    } else if (this.hasGPSData() && this.extractedGPS()) {
      location = {
        lat: this.extractedGPS()!.latitude!,
        lon: this.extractedGPS()!.longitude!
      };
    } else {
      this.errorMessage.set('Geen geldige locatie beschikbaar.');
      this.creating.set(false);
      return;
    }

    const stickerData: StickerData = {
      location: location,
      poster: this.poster().trim(),
      uploader: this.uploader().trim(),
      post_date: this.convertToBackendFormat(this.postDate()),
      image: this.uploadedFilename()!
    };

    this.stickerService.createSticker(stickerData).subscribe({
      next: () => {
        this.creating.set(false);
        this.successMessage.set('Sticker succesvol toegevoegd!');

        setTimeout(() => {
          this.resetForm();
          this.stickerCreated.emit();
        }, 1500);
      },
      error: (error) => {
        this.creating.set(false);
        this.errorMessage.set(`Sticker toevoegen is mislukt: ${error.error?.detail || error.message}`);
      }
    });
  }

  resetForm(): void {
    this.selectedFile.set(null);
    this.imagePreviewUrl.set(null);
    this.uploadedFilename.set(null);
    this.extractedGPS.set(null);
    this.hasGPSData.set(false);
    this.hasGPSDate.set(false);
    this.manualLocation.set({ lat: null, lon: null });
    this.manualLocationInput.set('');
    this.useManualLocation.set(false);
    this.poster.set('');
    this.postDate.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSelectingLocation.set(false);
    this.isLocationAutoFilled.set(false);
    this.isDateAutoFilled.set(false);

    if (!this.isUploaderAutoFilled()) {
      this.uploader.set('');
    }
  }
}
