import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { MapViewComponent } from './map-view/map-view.component';
import { AddStickerViewComponent } from './add-sticker-view/add-sticker-view.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'map', component: MapViewComponent },
  { path: 'add-sticker', component: AddStickerViewComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
