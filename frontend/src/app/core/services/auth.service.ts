import { Injectable, computed, inject } from '@angular/core';
import Keycloak from 'keycloak-js';
import { KEYCLOAK_EVENT_SIGNAL } from 'keycloak-angular';
import { StickerMapRoles, KeycloakUserInfo } from '../models/auth.model';
export { KEYCLOAK_EVENT_SIGNAL } from 'keycloak-angular';

/**
 * AuthService provides authentication functionality using keycloak-angular.
 * Role-check properties are computed signals so they re-evaluate reactively in a zoneless Angular app.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private keycloak: Keycloak | null = null;

  /**
   * Reactive handle on Keycloak events. Used as a signal dependency so that
   * computed role checks re-run whenever auth state changes (e.g. after
   * check-sso resolves or a token refresh).
   */
  private readonly keycloakEvents = inject(KEYCLOAK_EVENT_SIGNAL, { optional: true });

  constructor() {
    try {
      this.keycloak = inject(Keycloak);
    } catch {
      console.warn('Keycloak not available - running without authentication');
    }
  }

  /**
   * Reactive: true when the user is authenticated.
   */
  readonly isAuthenticated = computed(() => {
    this.keycloakEvents?.();
    return this.keycloak?.authenticated ?? false;
  });

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
      prompt: 'login',
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
   * Reactive: true when user has viewer role (or higher).
   */
  readonly isViewer = computed(() => {
    this.keycloakEvents?.();
    return this.hasRealmRole(StickerMapRoles.VIEWER);
  });

  /**
   * Reactive: true when user has uploader role (or higher).
   */
  readonly isUploader = computed(() => {
    this.keycloakEvents?.();
    return this.hasRealmRole(StickerMapRoles.UPLOADER);
  });

  /**
   * Reactive: true when user has editor role (or higher).
   */
  readonly isEditor = computed(() => {
    this.keycloakEvents?.();
    return this.hasRealmRole(StickerMapRoles.EDITOR);
  });

  /**
   * Reactive: true when user has admin role.
   */
  readonly isAdmin = computed(() => {
    this.keycloakEvents?.();
    return this.hasRealmRole(StickerMapRoles.ADMIN);
  });
}
