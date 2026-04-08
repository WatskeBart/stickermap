import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { StickerService } from '../../core/services/sticker.service';
import { DisclaimerDialogComponent } from '../../shared/components/disclaimer-dialog/disclaimer-dialog.component';

const DISCLAIMER_KEY = 'stickermap_disclaimer_accepted';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule, MatDialogModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);
  private stickerService = inject(StickerService);

  readonly stats = toSignal(this.stickerService.getStats());

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
}
