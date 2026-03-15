import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'stickermap-theme';

  isDarkMode = signal(false);

  constructor() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = stored !== 'light';
    this.isDarkMode.set(prefersDark);
    this.applyTheme(prefersDark);
  }

  toggle(): void {
    const dark = !this.isDarkMode();
    this.isDarkMode.set(dark);
    this.applyTheme(dark);
    localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean): void {
    document.documentElement.classList.toggle('dark-theme', dark);
  }
}
