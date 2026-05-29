import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'nl' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly STORAGE_KEY = 'stickermap-lang';
  private readonly translate = inject(TranslateService);

  readonly available: readonly AppLang[] = ['nl', 'en'];

  /** Current active language; default Dutch. */
  readonly current = signal<AppLang>('nl');

  constructor() {
    const stored = localStorage.getItem(this.STORAGE_KEY) as AppLang | null;
    const lang: AppLang = stored && this.available.includes(stored) ? stored : 'nl';
    this.translate.addLangs([...this.available]);
    this.use(lang);
  }

  use(lang: AppLang): void {
    this.current.set(lang);
    this.translate.use(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
  }
}
