# StickerMap Frontend

Angular 21 (standalone, zoneless, signals) single-page app. For build/run commands and
the full architecture overview, see [`CLAUDE.md`](../CLAUDE.md) at the repository root.

## Internationalization (i18n)

The UI is translatable at runtime with [`@ngx-translate/core`](https://github.com/ngx-translate/core).
Each language is a single self-contained JSON file under [`public/i18n/`](public/i18n)
(served at `/i18n/<code>.json`). The active language is chosen from the **language
dropdown in the sidenav**, persisted in `localStorage` (`stickermap-lang`), and defaults
to Dutch (`nl`). Switching is instant — no page reload.

Currently shipped: **Dutch (`nl`, default)** and **English (`en`)**.

> The changelog entries (`src/app/core/models/changelog.model.ts`) and the Keycloak
> login/registration pages are intentionally **not** translated here.

### Adding a new language

The example below adds **French (`fr`)**. Substitute your own
[ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes).

1. **Create the translation file.** Copy an existing file as the template and translate
   every value — keep the keys exactly as they are (do not add, remove, or rename keys):

   ```bash
   cp public/i18n/en.json public/i18n/fr.json
   ```

   Then translate each value in `public/i18n/fr.json`. Leave the `{{placeholders}}`
   (e.g. `{{count}}`, `{{detail}}`) intact — they are filled in at runtime. Values that
   contain `<strong>…</strong>` markup (e.g. the disclaimer rules) should keep the tags.

2. **Add the language's own name (endonym)** under `nav.languageName` in **every**
   `public/i18n/*.json` file — `nl.json`, `en.json`, and the new `fr.json`. This is what
   the dropdown shows, so it is normally identical across all files:

   ```jsonc
   "languageName": {
     "nl": "Nederlands",
     "en": "English",
     "fr": "Français"
   }
   ```

3. **Register the language** in
   [`src/app/core/services/language.service.ts`](src/app/core/services/language.service.ts)
   by extending the `AppLang` type and the `available` array:

   ```ts
   export type AppLang = 'nl' | 'en' | 'fr';
   // ...
   readonly available: readonly AppLang[] = ['nl', 'en', 'fr'];
   ```

   No template changes are needed — the sidenav dropdown renders one entry per item in
   `available`, and the two-letter badge next to the globe icon is derived automatically
   (`fr` → `FR`).

That's the whole change. The default language and key-missing fallback stay Dutch
(`fallbackLang: 'nl'` in [`src/app/app.config.ts`](src/app/app.config.ts)); change that
only if you want a different default.

### Verifying

- **Key parity** — every language file must contain the exact same set of keys. Check it
  against the reference (`nl.json`) with:

  ```bash
  node -e "const fs=require('fs');const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?flat(v,p+k+'.'):[p+k]);const a=flat(JSON.parse(fs.readFileSync('public/i18n/nl.json'))).sort();const b=flat(JSON.parse(fs.readFileSync('public/i18n/fr.json'))).sort();const miss=a.filter(k=>!b.includes(k)),extra=b.filter(k=>!a.includes(k));console.log('missing:',miss.length?miss:'(none)');console.log('extra:',extra.length?extra:'(none)');"
  ```

- **Build** — `pnpm build` must compile with no warnings or errors.
- **Manual** — run the app, open the sidenav language dropdown, pick the new language, and
  confirm the whole UI switches live and that the choice survives a page reload. Check both
  light and dark themes and a mobile viewport.

### Where strings live

- **Templates** use the `translate` pipe, e.g. `{{ 'nav.map' | translate }}` (import the
  standalone `TranslatePipe` into the component — this project uses no `NgModule`s).
- **Code** (snackbars, validation, dialog data) uses `TranslateService.instant('key', { param })`.
- Keys are grouped by feature/area (`nav`, `map`, `stickerForm`, `overview`, `admin`, …)
  with a shared `common` group for ubiquitous button labels (`close`, `save`, `cancel`, …).
