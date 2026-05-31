import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { Reflector } from '@nestjs/core';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';
import { TRUST_PROXY } from '../../common/fastify/trust-proxy.config';

// SEC-013 witness: behind nginx, the per-client throttle/lockout key must be the
// REAL client IP carried in X-Forwarded-For, not the proxy's socket address.
//
// This boots a real Fastify instance with the SAME trustProxy posture as the
// production FastifyAdapter (apps/api/src/main.ts) so the XFF chain is parsed by
// Fastify's real proxy-addr machinery — not a hand-built req. The injected socket
// is loopback (127.0.0.1), which trustProxy trusts, so the leftmost untrusted hop
// (the client in XFF) must win.

async function resolveTracker(opts: {
  trustProxy: boolean | readonly string[];
  xff?: string;
}): Promise<string> {
  const fastify = Fastify({
    trustProxy: Array.isArray(opts.trustProxy)
      ? [...opts.trustProxy]
      : opts.trustProxy,
  });
  // getTracker only reads req.ip / req.ips; the other ctor deps are unused here.
  const guard = new ThrottlerBehindProxyGuard(
    { throttlers: [] } as never,
    {} as never,
    new Reflector(),
  );
  const expose = guard as unknown as {
    getTracker(req: unknown): Promise<string>;
  };

  let tracker = '';
  fastify.get('/__tracker', async (req, reply) => {
    tracker = await expose.getTracker(req);
    return reply.send({ tracker });
  });
  await fastify.ready();
  await fastify.inject({
    method: 'GET',
    url: '/__tracker',
    remoteAddress: '127.0.0.1',
    headers: opts.xff ? { 'x-forwarded-for': opts.xff } : {},
  });
  await fastify.close();
  return tracker;
}

describe('ThrottlerBehindProxyGuard getTracker (SEC-013)', () => {
  it('resolves the real client IP from X-Forwarded-For behind a trusted proxy', async () => {
    const tracker = await resolveTracker({
      trustProxy: TRUST_PROXY,
      xff: '203.0.113.7',
    });
    expect(tracker).toBe('203.0.113.7');
  });

  it('keeps the leftmost client across a multi-hop X-Forwarded-For chain', async () => {
    const tracker = await resolveTracker({
      trustProxy: TRUST_PROXY,
      xff: '203.0.113.7, 10.0.0.5',
    });
    expect(tracker).toBe('203.0.113.7');
  });

  it('falls back to the socket address when no proxy is trusted (trustProxy off)', async () => {
    // Demonstrates trustProxy is load-bearing: with it disabled the spoofable
    // XFF header is ignored and the key collapses to the socket address.
    const tracker = await resolveTracker({
      trustProxy: false,
      xff: '203.0.113.7',
    });
    expect(tracker).toBe('127.0.0.1');
  });
});
