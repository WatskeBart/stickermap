import { EnvironmentProviders, Provider } from '@angular/core';
import {
  provideKeycloak,
  withAutoRefreshToken,
  AutoRefreshTokenService,
  UserActivityService,
  createInterceptorCondition,
  IncludeBearerTokenCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
} from 'keycloak-angular';
import { environment } from '../../environments/environment';

/**
 * Condition for including bearer token in requests.
 * Matches both relative (/api/...) and absolute (http://host/api/...) API URLs.
 */
const apiTokenCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: /\/api\//i,
  bearerPrefix: 'Bearer',
});

/**
 * Provides Keycloak configuration for the application.
 */
export function provideKeycloakConfig(): (Provider | EnvironmentProviders)[] {
  return [
    provideKeycloak({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId,
      },
      initOptions: {
        onLoad: 'check-sso',
        ...(!(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && {
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        }),
        checkLoginIframe: false,
      },
      // No silent SSO at all — always redirects to Keycloak if unauthenticated.
      // Desktop users with an active IDP session still get transparent SSO via redirect.
      // Mobile users see the Keycloak login form with the SSO button.
      // silent-check-sso.html can be removed from public/ and the initOptions below can be used instead.
      // initOptions: {
      //   onLoad: 'login-required',
      //   checkLoginIframe: false,
      // },
      features: [
        withAutoRefreshToken({
          onInactivityTimeout: 'logout',
          sessionTimeout: 300000, // 5 minutes of inactivity before logout
        }),
      ],
      providers: [AutoRefreshTokenService, UserActivityService],
    }),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [apiTokenCondition],
    },
  ];
}
