import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
  private readonly mapChild = viewChild(MapComponent);
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private router: Router,
    public authService: AuthService
  ) {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => e.urlAfterRedirects.startsWith('/map')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mapChild()?.fitToAllStickers();
      });
  }

  navigateToAddSticker(): void {
    this.router.navigate(['/add-sticker']);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }
}
