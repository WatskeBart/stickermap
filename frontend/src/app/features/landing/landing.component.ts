import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type { LeaderboardPeriod } from '../../core/models/sticker.model';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { StickerService } from '../../core/services/sticker.service';
import { DisclaimerDialogComponent } from '../../shared/components/disclaimer-dialog/disclaimer-dialog.component';
import { formatDistance } from '../../shared/utils/distance-utils';

const DISCLAIMER_KEY = 'stickermap_disclaimer_accepted';

@Component({
  selector: 'app-landing',
  imports: [MatCardModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule, MatDialogModule, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);
  private stickerService = inject(StickerService);
  private languageService = inject(LanguageService);

  readonly stats = toSignal(this.stickerService.getStats().pipe(catchError(() => of(null))));

  // Distance leaderboard: viewer-only like its endpoint, refetched whenever the period changes.
  readonly currentYear = new Date().getFullYear();
  readonly currentHalf = new Date().getMonth() < 6 ? 1 : 2;
  readonly leaderboardPeriod = signal<LeaderboardPeriod>('all');
  readonly leaderboard = toSignal(
    toObservable(this.leaderboardPeriod).pipe(
      switchMap((period) =>
        this.authService.isViewer()
          ? this.stickerService.getDistanceLeaderboard(period).pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
  );
  readonly leaderboardEntries = computed(() => {
    const lang = this.languageService.current();
    return (this.leaderboard()?.entries ?? []).map((entry) => ({
      ...entry,
      distance: formatDistance(entry.distance_m, lang),
    }));
  });

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }

  navigateToAddSticker(): void {
    if (localStorage.getItem(DISCLAIMER_KEY) === 'true') {
      this.router.navigate(['/add-sticker']);
      return;
    }

    this.dialog.open(DisclaimerDialogComponent, { width: '600px', disableClose: true })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((accepted: boolean) => {
        if (accepted) {
          this.router.navigate(['/add-sticker']);
        }
      });
  }

  navigateToOverview(): void {
    this.router.navigate(['/sticker-overview']);
  }

  openStickerOnMap(stickerId: number): void {
    this.router.navigate(['/map'], { queryParams: { id: stickerId } });
  }
}
