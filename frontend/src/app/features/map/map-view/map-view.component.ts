import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MapComponent } from '../map';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [MapComponent],
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss']
})
export class MapViewComponent {
  constructor(
    private router: Router,
    public authService: AuthService
  ) {}

  navigateToAddSticker(): void {
    this.router.navigate(['/add-sticker']);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }
}
