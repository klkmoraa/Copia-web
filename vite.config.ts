import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Provenance stamped on exported documents must come from the package, never from a
// literal someone has to remember to bump.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  test: {
    // The quality gate must only observe the real product. Backups, worktrees and
    // vendored copies of the app live beside `src/` and would otherwise be collected,
    // reporting stale failures and inflating the suite by an order of magnitude.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'structureCo/**',
      'structureCo-backup-*/**',
      'structureCo-worktrees/**',
      'structureco-sites/**',
      'structureco-sites-worktrees/**',
      'structureco-design-review/**',
      'structureco-palette-lab/**',
      'structureCo-contexto-*/**',
      'structureCo-documentacion-integral-*/**',
    ],
  },
});
