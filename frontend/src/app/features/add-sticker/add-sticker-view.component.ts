import { Component, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MapComponent } from '../map/map';
import { StickerFormComponent } from '../sticker-form/sticker-form.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-add-sticker-view',
  standalone: true,
  imports: [MapComponent, StickerFormComponent, MatToolbarModule],
  templateUrl: './add-sticker-view.component.html',
  styleUrls: ['./add-sticker-view.component.scss']
})
export class AddStickerViewComponent {
  readonly mapComponent = viewChild.required(MapComponent);
  readonly formComponent = viewChild.required(StickerFormComponent);

  locationSelectionMode = signal(false);

  constructor(
    private router: Router,
    public authService: AuthService
  ) {}

  onLocationSelectionRequested(): void {
    this.locationSelectionMode.set(true);
    if (this.formComponent().manualLocation().lat !== null) {
      this.updateMapPreview();
    }
  }

  onLocationSelected(location: { lat: number, lon: number }): void {
    this.locationSelectionMode.set(false);
    this.formComponent().setManualLocation(location.lat, location.lon);
  }

  private updateMapPreview(): void {
    const loc = this.formComponent().manualLocation();
    if (loc.lat !== null) {
      this.mapComponent().previewLocation(loc.lat!, loc.lon!);
    }
  }

  onPreviewLocationRequested(location: { lat: number, lon: number }): void {
    this.locationSelectionMode.set(true);
    setTimeout(() => {
      this.mapComponent().previewLocation(location.lat, location.lon);
    }, 100);
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
