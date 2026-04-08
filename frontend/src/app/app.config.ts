import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { includeBearerTokenInterceptor } from 'keycloak-angular';

import { routes } from './app.routes';
import { provideKeycloakConfig } from './core/config/keycloak.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
provideHttpClient(
      withInterceptors([includeBearerTokenInterceptor])
    ),
    ...provideKeycloakConfig(),
  ],
};
