import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Allows the route only for editor or admin role. Other authenticated users are redirected home.
 */
export const moderatorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isEditor() || authService.isAdmin()) {
    return true;
  }
  return router.parseUrl('/');
};
