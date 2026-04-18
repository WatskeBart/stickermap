import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs/operators';
import { StickerMapRoles, UserInfo } from '../models/auth.model';
import { environment } from '../../../environments/environment';

/**
 * AuthService provides authentication functionality using angular-auth-oidc-client.
 * Observables from OidcSecurityService are bridged to signals for reactive, zoneless usage.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);

  /**
   * Reactive: true when the user is authenticated.
   */
  readonly isAuthenticated = toSignal(
    this.oidcSecurityService.isAuthenticated$.pipe(map((state) => state.isAuthenticated)),
    { initialValue: false },
  );

  /**
   * Decoded access token payload — re-emits on every token refresh.
   * Used as a synchronous signal for role checks.
   */
  private readonly accessTokenPayload = toSignal(
    this.oidcSecurityService.getPayloadFromAccessToken(),
    { initialValue: null },
  );

  private readonly accessToken = toSignal(this.oidcSecurityService.getAccessToken(), {
    initialValue: '',
  });

  /**
   * Get the current access token string.
   */
  getToken(): string | null {
    return this.accessToken() || null;
  }

  /**
   * Get user info from the decoded access token payload.
   */
  getUserInfo(): UserInfo | null {
    return (this.accessTokenPayload() as UserInfo) ?? null;
  }

  /**
   * Trigger login flow.
   */
  login(): void {
    this.oidcSecurityService.authorize();
  }

  /**
   * Trigger logout flow, revoking tokens before redirecting.
   */
  logout(): void {
    this.oidcSecurityService.logoffAndRevokeTokens().subscribe();
  }

  /**
   * Check if user has a specific client role (from Keycloak resource_access.<clientId>.roles in the JWT).
   */
  hasClientRole(role: string): boolean {
    const payload = this.accessTokenPayload() as any;
    const clientId = environment.keycloak.clientId;
    return payload?.resource_access?.[clientId]?.roles?.includes(role) ?? false;
  }

  /**
   * Reactive: true when user has viewer role (or higher).
   * Automatically re-evaluates when the access token payload signal updates.
   */
  readonly isViewer = computed(() => this.hasClientRole(StickerMapRoles.VIEWER));

  /**
   * Reactive: true when user has uploader role (or higher).
   */
  readonly isUploader = computed(() => this.hasClientRole(StickerMapRoles.UPLOADER));

  /**
   * Reactive: true when user has editor role (or higher).
   */
  readonly isEditor = computed(() => this.hasClientRole(StickerMapRoles.EDITOR));

  /**
   * Reactive: true when user has admin role.
   */
  readonly isAdmin = computed(() => this.hasClientRole(StickerMapRoles.ADMIN));
}
