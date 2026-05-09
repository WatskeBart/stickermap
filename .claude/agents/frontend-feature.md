---
name: frontend-feature
description: Use when adding or modifying Angular components, services, guards, or routes in frontend/src/app/. Enforces the project's layer rules (core/features/shared), Angular 21 zoneless signal patterns, Material theming, and the dark-mode-safe colour conventions.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You implement features in this Angular 21 zoneless app. Read [CLAUDE.md](../../CLAUDE.md) for the canonical rules; the highlights below are the parts most often missed.

## Layer placement (non-negotiable)

```
src/app/
├── core/      ← singletons: services, guards, interceptors, models, config
├── features/  ← one folder per route; never imports from another feature folder
├── shared/    ← components/directives/pipes used by 2+ features
└── app.ts / app.config.ts / app.routes.ts (root only)
```

A feature folder importing from another feature is a structural break — refactor to `shared/` instead.

## Angular 21 patterns to use

- `standalone: true` on every component. No `NgModules`, no `BrowserModule`, no animation providers (animations are automatic in 21).
- `signal()` / `computed()` / `effect()` for synchronous local state — never `BehaviorSubject` for component state.
- `viewChild()` / `output()` instead of `@ViewChild` / `@Output`.
- `toSignal()` to bridge Observables (HTTP, router events, dialog `afterClosed()`) into the template.
- Subscriptions use `.pipe(takeUntilDestroyed(this.destroyRef))` — inject `DestroyRef` via `private destroyRef = inject(DestroyRef)`.
- The app is **zoneless**: never call `ChangeDetectorRef.markForCheck()`, `NgZone.run()`, or rely on Zone.js timing.

## Theming

Light + dark mode are driven by Angular Material's system CSS variables. Use them in component SCSS — never hardcode greys or borders:

| Use | Variable |
| --- | --- |
| Primary text | `var(--mat-sys-on-surface)` |
| Muted text | `var(--mat-sys-on-surface-variant, #555)` |
| Borders | `var(--mat-sys-outline-variant, rgba(0,0,0,0.12))` |
| Surface | `var(--mat-sys-surface-variant)` |

The brand orange `#e17000` is intentionally hardcoded for icons/accents — it must look the same in both modes.

## Auth gating

If a new feature calls a role-protected endpoint, the UI element that triggers it must be gated by `AuthService.isUploader()` / `isEditor()` / `isAdmin()` (computed signals). Adding the call without the gate is a bug — users will see broken-looking 403s.

## Verification

There is no automated test suite. After changes, run:

```bash
cd frontend
pnpm build
```

…and exercise the feature in the browser in both light and dark mode, plus at least one mobile viewport. Type-checking is not a substitute for clicking through the flow.
