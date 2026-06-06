/**
 * SA-SEC-017 — GET / must NOT expose version, endpoints list, or docs path.
 *
 * Fail-pre witness (RED before fix):
 *   - AppController.getRoot() returns { version, endpoints, docs, ... }
 *     → assertions 'not.toHaveProperty(version|endpoints|docs)' are RED.
 *
 * Pass-post (GREEN after fix):
 *   - getRoot() returns { status: 'operational', message: '...' } only.
 */
import { describe, it, expect } from 'vitest';
import { AppController } from './app.controller';

describe('AppController (SA-SEC-017)', () => {
  const controller = new AppController();

  describe('GET /', () => {
    it('does not expose version information', () => {
      const result = controller.getRoot();
      expect(result).not.toHaveProperty('version');
    });

    it('does not expose endpoints list', () => {
      const result = controller.getRoot();
      expect(result).not.toHaveProperty('endpoints');
    });

    it('does not expose docs path', () => {
      const result = controller.getRoot();
      expect(result).not.toHaveProperty('docs');
    });

    it('returns status and message only', () => {
      const result = controller.getRoot();
      expect(result).toMatchObject({
        status: 'operational',
        message: 'API is running. Access endpoints via /api/*',
      });
    });
  });
});
