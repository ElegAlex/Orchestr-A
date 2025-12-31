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
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 30000,
    hookTimeout: 30000,
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
