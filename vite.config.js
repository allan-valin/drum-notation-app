import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // '/' in dev and for a root deployment; the Pages workflow sets DRUM_BASE=/drum-notation-app/
  base: process.env.DRUM_BASE || '/',
  plugins: [svelte()],
  // under vitest, resolve Svelte's browser build so components mount in jsdom
  // (component tests carry `// @vitest-environment jsdom` at the top of the file)
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    environment: 'node',
  },
});
