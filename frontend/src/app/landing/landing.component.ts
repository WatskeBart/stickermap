import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../services/auth.service';
import { StickerService } from '../services/sticker.service';
import { DisclaimerDialogComponent } from '../sticker-form/disclaimer-dialog/disclaimer-dialog.component';

const DISCLAIMER_KEY = 'stickermap_disclaimer_accepted';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatDividerModule, MatProgressSpinnerModule, MatDialogModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
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
