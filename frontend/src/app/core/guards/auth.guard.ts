import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { createAuthGuard, AuthGuardData } from 'keycloak-angular';

/**
 * Auth guard access check function.
 * Checks if user is authenticated and triggers login if not.
 */
const isAccessAllowed = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  authData: AuthGuardData
): Promise<boolean | UrlTree> => {
  const { authenticated, keycloak } = authData;

  if (authenticated) {
    return true;
  }

  // Store the attempted URL for redirecting after login
  localStorage.setItem('redirect_url', state.url);

  // Trigger login
  await keycloak.login({
    redirectUri: window.location.origin + state.url,
  });

  return false;
};

/**
 * Auth guard using keycloak-angular's createAuthGuard.
 */
export const authGuard = createAuthGuard(isAccessAllowed);
