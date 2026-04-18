import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { provideAuth, PassedInitialConfig, OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

function buildOidcConfig(): PassedInitialConfig {
  return {
    config: {
      authority: `${environment.keycloak.url}/realms/${environment.keycloak.realm}`,
      redirectUrl: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
      clientId: environment.keycloak.clientId,
      scope: 'openid profile email',
      responseType: 'code',
      silentRenew: true,
      useRefreshToken: true,
      renewTimeBeforeTokenExpiresInSeconds: 30,
      ignoreNonceAfterRefresh: true,
      secureRoutes: ['/api/'],
    },
  };
}

function initializeAuth(oidcSecurityService: OidcSecurityService, router: Router) {
  return () =>
    firstValueFrom(
      oidcSecurityService.checkAuth().pipe(
        tap(({ isAuthenticated }) => {
          if (isAuthenticated) {
            const redirectUrl = localStorage.getItem('redirect_url');
            if (redirectUrl) {
              localStorage.removeItem('redirect_url');
              router.navigateByUrl(redirectUrl);
            }
          }
        }),
      ),
    );
}

export function provideOidcConfig(): (Provider | EnvironmentProviders)[] {
  return [
    provideAuth(buildOidcConfig()),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [OidcSecurityService, Router],
      multi: true,
    },
  ];
}
