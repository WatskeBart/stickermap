import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from 'angular-auth-oidc-client';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideMaplibreWorker } from '@maplibre/ngx-maplibre-gl/config';

import { routes } from './app.routes';
import { provideOidcConfig } from './core/config/oidc.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // MapLibre v6 is ESM-only and loads its worker from a separate file at runtime;
    // bundlers cannot rewrite that URL, so without this the worker 404s and no tiles
    // render. The URL is resolved against document.baseURI, so a sub-path deployment
    // (--base-href) keeps working. `maplibre-gl-worker.mjs` and its sibling
    // `maplibre-gl-shared.mjs` are copied to the output root by angular.json assets.
    provideMaplibreWorker('maplibre-gl-worker.mjs'),
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withInterceptors([authInterceptor()])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'nl',
      lang: 'nl',
    }),
    ...provideOidcConfig(),
  ],
};
