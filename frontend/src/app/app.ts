import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { DisclaimerDialogComponent } from './sticker-form/disclaimer-dialog/disclaimer-dialog.component';
import { filter } from 'rxjs/operators';

const DISCLAIMER_KEY = 'stickermap_disclaimer_accepted';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule, MatTooltipModule, MatSlideToggleModule, MatDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  currentRoute = signal('');
  pageTitle = signal('');
  pageSubtitle = signal('');

  private subtitles = [
    '"Sticker, sticker, welke sticker?"',
    '"Was al"',
    '"Een sticker in de morgen, is een dag zonder zorgen"',
    '"Nou, nou, hier heb je een sticker"',
    '"Stickerje, stickerje, aan de wand. ASEC heeft de beste sticker van het land!"',
    '"Plak een sticker, maak een vriend"',
    '"Stickers maken alles beter"',
    '"Een dag niet gestickerd, is een dag niet geleefd"',
    '"Leef, lach, sticker"',
    '"Wie het eerst plakt, het eerst maalt"',
    '"Sticker mee, sticker blij"',
    '"Een sticker komt nooit alleen"',
    '"Stickeren is zilver, verzamelen is goud"',
    '"Beter een sticker op de wand, dan tien in de lucht"',
    '"Oost, west, stickers best"',
  ];

  showViewMapButton = computed(() => {
    const route = this.currentRoute();
    const isLandingPage = route === '/' || route.startsWith('/?') || route.startsWith('/#');
    return !route.includes('/map') && !isLandingPage;
  });

  showAddStickerButton = computed(() => {
    const route = this.currentRoute();
    const isLandingPage = route === '/' || route.startsWith('/?') || route.startsWith('/#');
    return !route.includes('/add-sticker') && !isLandingPage && this.authService.isUploader();
  });

  showOverviewButton = computed(() => {
    const route = this.currentRoute();
    const isLandingPage = route === '/' || route.startsWith('/?') || route.startsWith('/#');
    return !route.includes('/sticker-overview') && !isLandingPage;
  });

  private dialog = inject(MatDialog);

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
  ) {
    this.pageSubtitle.set(this.getRandomSubtitle());
  }

  private getRandomSubtitle(): string {
    const randomIndex = Math.floor(Math.random() * this.subtitles.length);
    return this.subtitles[randomIndex];
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.urlAfterRedirects);
        this.updatePageTitle();
      });

    setTimeout(() => {
      this.currentRoute.set(this.router.url);
      this.updatePageTitle();
    }, 0);
  }

  updatePageTitle(): void {
    const route = this.currentRoute();
    if (route.includes('/add-sticker')) {
      this.pageTitle.set('Nieuwe Sticker Toevoegen');
    } else if (route.includes('/map')) {
      this.pageTitle.set('Kaart');
    } else if (route.includes('/sticker-overview')) {
      this.pageTitle.set('Sticker Overzicht');
    } else {
      this.pageTitle.set('');
    }
  }

  async login(): Promise<void> {
    await this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }

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
