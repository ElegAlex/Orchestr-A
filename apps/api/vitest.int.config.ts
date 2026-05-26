import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import swc from 'unplugin-swc';

/**
 * TST-DB-001 — integration test project (real Postgres, no `vi.mock('database')`).
 *
 * Additive to the unit config (`vitest.config.ts`) and the e2e config
 * (`vitest.e2e.config.ts`): separate file pattern (`*.int.spec.ts`), separate
 * setup (`vitest.int.setup.ts`, which omits the global database mock), and a
 * globalSetup that spins an ephemeral migrated DB. Run via `pnpm test:integration`.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    root: './',
    setupFiles: ['./vitest.int.setup.ts'],
    globalSetup: ['./vitest.int.global-setup.ts'],
    include: ['src/**/*.int.spec.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 30000,
    hookTimeout: 120000,
    // One DB, one serial writer: the audit_logs hash chain + advisory lock are
    // single-threaded by design; running test files sequentially keeps future
    // int specs from racing on the same chain. (`poolOptions.singleFork` was
    // removed in vitest 4 — `fileParallelism: false` is the v4 equivalent.)
    fileParallelism: false,
    server: {
      deps: {
        inline: ['database'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      database: resolve(__dirname, '../../packages/database'),
    },
  },
});
