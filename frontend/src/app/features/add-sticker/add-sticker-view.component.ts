import { Component, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MapComponent } from '../map/map';
import { StickerFormComponent } from '../sticker-form/sticker-form.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-add-sticker-view',
  standalone: true,
  imports: [MapComponent, StickerFormComponent, MatToolbarModule, MatButtonModule],
  templateUrl: './add-sticker-view.component.html',
  styleUrl: './add-sticker-view.component.scss'
})
export class AddStickerViewComponent {
  readonly mapComponent = viewChild.required(MapComponent);
  readonly formComponent = viewChild.required(StickerFormComponent);

  locationSelectionMode = signal(false);
  previewOnlyMode = signal(false);
  lastKnownLocation = signal<{ lat: number; lon: number } | null>(null);

  constructor(
    private router: Router,
    public authService: AuthService
  ) {}

  onLocationSelectionRequested(): void {
    this.previewOnlyMode.set(false);
    this.locationSelectionMode.set(true);
  }

  onLocationSelected(location: { lat: number, lon: number }): void {
    this.locationSelectionMode.set(false);
    this.previewOnlyMode.set(false);
    this.lastKnownLocation.set(location);
    this.formComponent().setManualLocation(location.lat, location.lon);
  }

  onPreviewLocationRequested(location: { lat: number, lon: number }): void {
    this.lastKnownLocation.set(location);
    this.previewOnlyMode.set(true);
    setTimeout(() => {
      this.mapComponent().previewLocation(location.lat, location.lon);
    }, 100);
  }

  onClosePreview(): void {
    this.previewOnlyMode.set(false);
  }

  onStickerCreated(): void {
    this.router.navigate(['/map']);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }
}
