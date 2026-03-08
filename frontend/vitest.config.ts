import { defineConfig } from 'vitest/config';

// Extended vitest configuration for Angular's unit-test builder.
// maplibre-gl ships as a CJS UMD bundle. Using server.deps.inline forces vitest
// to transform it through Vite's pipeline, enabling named ESM imports to work.
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: ['maplibre-gl'],
      },
    },
  },
});
