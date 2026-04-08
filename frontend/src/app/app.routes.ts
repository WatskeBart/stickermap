import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { MapViewComponent } from './features/map/map-view/map-view.component';
import { AddStickerViewComponent } from './features/add-sticker/add-sticker-view.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'map', component: MapViewComponent },
  { path: 'add-sticker', component: AddStickerViewComponent, canActivate: [authGuard] },
  {
    path: 'sticker-overview',
    loadComponent: () =>
      import('./features/sticker-overview/sticker-overview.component').then(
        (m) => m.StickerOverviewComponent,
      ),
  },
  { path: '**', redirectTo: '' }
];
