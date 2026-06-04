/**
 * OBS-009 — Request-ID context (AsyncLocalStorage).
 *
 * RED before the fix (module missing).
 * GREEN after: genReqId honours x-request-id header and getRequestId() returns
 * the value bound in the current ALS scope.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// These imports will RED on unfixed code (module missing):
import {
  genReqId,
  getRequestId,
  runWithRequestId,
} from './request-id.context';

describe('request-id.context', () => {
  describe('genReqId()', () => {
    it('returns the x-request-id header value when present', () => {
      const id = genReqId({ headers: { 'x-request-id': 'my-trace-id' } });
      expect(id).toBe('my-trace-id');
    });

    it('falls back to a uuid when x-request-id is absent', () => {
      const id = genReqId({ headers: {} });
      // UUID v4 pattern
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sanitizes the header value (strips CR/LF)', () => {
      const id = genReqId({ headers: { 'x-request-id': 'evil\r\ninjected' } });
      expect(id).not.toContain('\r');
      expect(id).not.toContain('\n');
    });

    it('truncates oversized header values (cap at 128 chars)', () => {
      const long = 'a'.repeat(200);
      const id = genReqId({ headers: { 'x-request-id': long } });
      expect(id.length).toBeLessThanOrEqual(128);
    });
  });

  describe('getRequestId()', () => {
    it('returns undefined outside of any ALS scope', () => {
      // Outside of runWithRequestId() there is no store; must return undefined
      // gracefully (not throw).
      expect(getRequestId()).toBeUndefined();
    });

    it('returns the id bound inside runWithRequestId()', async () => {
      const expected = 'test-correlation-id';
      await runWithRequestId(expected, () => {
        expect(getRequestId()).toBe(expected);
      });
    });

    it('isolates ids across concurrent scopes', async () => {
      const results: string[] = [];
      await Promise.all([
        runWithRequestId('scope-A', async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(getRequestId()!);
        }),
        runWithRequestId('scope-B', async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getRequestId()!);
        }),
      ]);
      // Both are present; no cross-contamination
      expect(results).toContain('scope-A');
      expect(results).toContain('scope-B');
    });
  });
});
