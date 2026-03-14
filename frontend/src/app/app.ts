import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
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

  constructor(
    public authService: AuthService,
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
    this.router.navigate(['/add-sticker']);
  }
}
