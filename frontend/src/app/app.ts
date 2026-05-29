import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from './core/services/auth.service';
import { StickerService } from './core/services/sticker.service';
import { ThemeService } from './core/services/theme.service';
import { LanguageService, AppLang } from './core/services/language.service';
import { DisclaimerDialogComponent } from './shared/components/disclaimer-dialog/disclaimer-dialog.component';
import { ChangelogDialogComponent } from './shared/components/changelog-dialog/changelog-dialog.component';
import { map } from 'rxjs/operators';
import { version } from '../../package.json';

const DISCLAIMER_KEY = 'stickermap_disclaimer_accepted';
const RELEASE_NOTES_KEY = 'stickermap_last_seen_version';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    UpperCasePipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly appVersion = version;

  private breakpointObserver = inject(BreakpointObserver);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  isHandset = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private hovering = signal(false);
  sidenavExpanded = computed(() => this.isHandset() || this.hovering());

  languageMenuOpen = signal(false);

  private stickerService = inject(StickerService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  public languageService = inject(LanguageService);

  private pendingNotificationShown = false;

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
  ) {
    effect(() => {
      const isEditor = this.authService.isEditor();
      const isAdmin = this.authService.isAdmin();
      if ((isEditor || isAdmin) && !this.pendingNotificationShown) {
        this.pendingNotificationShown = true;
        this.stickerService.getPendingReportsCount()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              if (res.count > 0) {
                const ref = this.snackBar.open(
                  this.translate.instant('nav.pendingReports', { count: res.count }),
                  this.translate.instant('nav.review'),
                  { duration: 8000 },
                );
                ref.onAction().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
                  this.router.navigate(['/sticker-overview']);
                });
              }
            },
            error: () => {},
          });
      }
    });
  }

  ngOnInit(): void {
    const lastSeen = localStorage.getItem(RELEASE_NOTES_KEY);
    if (lastSeen !== this.appVersion) {
      localStorage.setItem(RELEASE_NOTES_KEY, this.appVersion);
      this.dialog.open(ChangelogDialogComponent, { width: '640px', maxHeight: '80vh' });
    }
  }

  onSidenavHover(hovering: boolean): void {
    if (!this.isHandset()) {
      this.hovering.set(hovering);
      // Collapse the language submenu when the rail shrinks back to icons-only.
      if (!hovering) {
        this.languageMenuOpen.set(false);
      }
    }
  }

  toggleLanguageMenu(): void {
    this.languageMenuOpen.update((open) => !open);
  }

  selectLanguage(lang: AppLang): void {
    this.languageService.use(lang);
    this.languageMenuOpen.set(false);
  }

  login(): void {
    this.authService.login();
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

  navigateToCategories(): void {
    this.router.navigate(['/categories']);
  }

  navigateToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  openChangelog(): void {
    this.dialog.open(ChangelogDialogComponent, { width: '640px', maxHeight: '80vh' });
  }
}
