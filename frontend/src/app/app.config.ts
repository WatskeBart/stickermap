import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { includeBearerTokenInterceptor } from 'keycloak-angular';

import { routes } from './app.routes';
import { provideKeycloakConfig } from './config/keycloak.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([includeBearerTokenInterceptor])
    ),
    ...provideKeycloakConfig(),
  ],
};
