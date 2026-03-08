import { Injectable, inject } from '@angular/core';
import Keycloak from 'keycloak-js';

/**
 * Token to inject Keycloak instance from keycloak-angular.
 * Re-exported from keycloak-angular for convenience.
 */
export { KEYCLOAK_EVENT_SIGNAL } from 'keycloak-angular';

/**
 * Application role constants matching Keycloak realm roles.
 */
export const StickerMapRoles = {
  VIEWER: 'sm-viewer',
  UPLOADER: 'sm-uploader',
  EDITOR: 'sm-editor',
  ADMIN: 'sm-admin',
} as const;

/**
 * User info interface matching Keycloak token claims.
 */
export interface KeycloakUserInfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

/**
 * AuthService provides authentication functionality using keycloak-angular.
 * Delegates to the injected Keycloak instance managed by keycloak-angular.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private keycloak: Keycloak | null = null;

  constructor() {
    try {
      this.keycloak = inject(Keycloak);
    } catch {
      console.warn('Keycloak not available - running without authentication');
    }
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.keycloak?.authenticated ?? false;
  }

  /**
   * Get the current access token.
   */
  getToken(): string | null {
    return this.keycloak?.token ?? null;
  }

  /**
   * Get user info from the parsed token.
   */
  getUserInfo(): KeycloakUserInfo | null {
    return (this.keycloak?.tokenParsed as KeycloakUserInfo) ?? null;
  }

  /**
   * Trigger login flow.
   */
  async login(): Promise<void> {
    if (!this.keycloak) {
      console.error('Keycloak not initialized');
      return;
    }

    await this.keycloak.login({
      redirectUri: window.location.origin + window.location.pathname,
    });
  }

  /**
   * Trigger logout flow.
   */
  async logout(): Promise<void> {
    if (!this.keycloak) {
      console.error('Keycloak not initialized');
      return;
    }

    await this.keycloak.logout({
      redirectUri: window.location.origin,
    });
  }

  /**
   * Check if user has a specific realm role.
   */
  hasRealmRole(role: string): boolean {
    return this.keycloak?.hasRealmRole(role) ?? false;
  }

  /**
   * Check if user has a specific resource/client role.
   */
  hasResourceRole(role: string, resource?: string): boolean {
    return this.keycloak?.hasResourceRole(role, resource) ?? false;
  }

  /**
   * Check if user has viewer role (or higher).
   */
  isViewer(): boolean {
    return this.hasRealmRole(StickerMapRoles.VIEWER);
  }

  /**
   * Check if user has uploader role (or higher, since editor composes uploader).
   */
  isUploader(): boolean {
    return this.hasRealmRole(StickerMapRoles.UPLOADER);
  }

  /**
   * Check if user has editor role (or higher, since admin composes editor).
   */
  isEditor(): boolean {
    return this.hasRealmRole(StickerMapRoles.EDITOR);
  }

  /**
   * Check if user has admin role.
   */
  isAdmin(): boolean {
    return this.hasRealmRole(StickerMapRoles.ADMIN);
  }
}
