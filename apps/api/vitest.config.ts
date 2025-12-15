import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import swc from 'unplugin-swc';

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
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        'src/main.ts',
        'vitest.config.ts',
        'src/__mocks__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules/', 'dist/'],
    server: {
      deps: {
        inline: ['database'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'database': resolve(__dirname, '../../packages/database'),
    },
  },
});
