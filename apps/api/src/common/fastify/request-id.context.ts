/**
 * OBS-009 — Request-ID propagation via AsyncLocalStorage.
 *
 * Wires a correlation id into every async chain spawned from a Fastify
 * onRequest hook:
 *
 *   1. `genReqId` — Fastify's `genReqId` option; honours an incoming
 *      `x-request-id` header (sanitised) or generates a fresh UUID v4.
 *   2. `requestIdStore` — the ALS instance; the onRequest hook calls
 *      `als.enterWith()` so the id survives across async continuations.
 *   3. `getRequestId` — public helper; any service / audit emitter can
 *      call this to thread the id into a payload without carrying it as a
 *      parameter.
 *   4. `runWithRequestId` — test helper; wraps `als.run()` so spec files
 *      can set up an isolated scope without wiring a real Fastify server.
 *
 * Security notes:
 *  - The incoming header is capped at 128 characters to prevent log-line
 *    overflow and stripped of CR/LF to prevent log-injection.
 *  - The header value is treated as opaque (no parsing / validation beyond
 *    sanitisation); a request with no header gets a fresh UUID.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// ALS store
// ---------------------------------------------------------------------------

export interface RequestIdStore {
  requestId: string;
}

/** Package-internal ALS instance exported so the Fastify onRequest hook in
 *  main.ts can call `requestIdStore.enterWith(…)`. */
export const requestIdStore = new AsyncLocalStorage<RequestIdStore>();

// ---------------------------------------------------------------------------
// genReqId — passed to FastifyAdapter as the `genReqId` option
// ---------------------------------------------------------------------------

/**
 * Derive a request id from the incoming Fastify raw-request object.
 *
 * Called by Fastify early in the request lifecycle (before any hook) so
 * `request.id` is always populated.
 */
export function genReqId(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = req.headers['x-request-id'];
  const candidate = Array.isArray(raw) ? raw[0] : raw;

  if (candidate && typeof candidate === 'string') {
    const sanitised = candidate
      .replace(/[\r\n]/g, '') // strip log-injection chars
      .slice(0, 128); // cap length
    if (sanitised.length > 0) return sanitised;
  }

  return randomUUID();
}

// ---------------------------------------------------------------------------
// getRequestId — public accessor for services / audit emitters
// ---------------------------------------------------------------------------

/**
 * Returns the request id bound in the current async execution context, or
 * `undefined` when called outside of a request scope (background jobs,
 * bootstrap code, unit tests without runWithRequestId()).
 */
export function getRequestId(): string | undefined {
  return requestIdStore.getStore()?.requestId;
}

// ---------------------------------------------------------------------------
// runWithRequestId — test / utility wrapper
// ---------------------------------------------------------------------------

/**
 * Runs `fn` inside a new ALS scope with the given request id.
 * Useful for unit tests that need a scope without a real Fastify request.
 */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestIdStore.run({ requestId }, fn);
}
