// This spec is excluded from the default test run via angular.json test.options.exclude.
//
// Reason: maplibre-gl ships as a CJS/UMD bundle. Angular's unit-test builder (vitest
// + jsdom) cannot resolve maplibre-gl's named ESM imports at runtime, and vi.mock()
// is explicitly blocked by the Angular unit-test system. MapLibre GL also requires a
// WebGL context that jsdom does not provide.
//
// Verified instead via: pnpm run build (production build) and manual browser testing.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { MapComponent } from './map';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
