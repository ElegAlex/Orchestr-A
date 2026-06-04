import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { JwtService } from '@nestjs/jwt';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createUploadsAuthHook } from './uploads-auth.hook';

/**
 * SEC-016 witness — reproduces the exact production plugin interaction
 * (@fastify/static at prefix `/api/uploads/`) with and without the auth hook,
 * using a real Fastify server and `inject()` (no DB/Redis/Nest container).
 *
 * The original failure mode is anonymous GET = 200 (the "control" suite below
 * locks it in). The fix is the onRequest hook: anonymous GET → 401, Bearer →
 * 200. Stash-verified RED→GREEN by neutering `createUploadsAuthHook` (the
 * with-hook anon assertion below returns 200 → RED; restored → 401 → GREEN).
 */
const SECRET = 'test-secret-sec016-uploads-hook';
// 1×1 transparent PNG magic header bytes — content is irrelevant to the test.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

async function buildApp(opts: {
  withHook: boolean;
}): Promise<{ app: FastifyInstance; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'sec016-uploads-'));
  const avatarsDir = join(root, 'avatars');
  await mkdir(avatarsDir, { recursive: true });
  await writeFile(join(avatarsDir, 'user-1.png'), PNG);

  const app = Fastify();
  if (opts.withHook) {
    app.addHook(
      'onRequest',
      createUploadsAuthHook(new JwtService({ secret: SECRET })),
    );
  }
  await app.register(fastifyStatic, { root, prefix: '/api/uploads/' });
  await app.ready();
  return { app, root };
}

const AVATAR_URL = '/api/uploads/avatars/user-1.png';

describe('SEC-016 — uploads static auth hook', () => {
  describe('control — fastifyStatic serves avatars anonymously (the vuln)', () => {
    let app: FastifyInstance;
    let root: string;

    beforeAll(async () => {
      ({ app, root } = await buildApp({ withHook: false }));
    });
    afterAll(async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    });

    it('returns 200 for an unauthenticated GET when the hook is absent', async () => {
      const res = await app.inject({ method: 'GET', url: AVATAR_URL });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(PNG)).toBe(true);
    });
  });

  describe('with the auth hook (the fix)', () => {
    let app: FastifyInstance;
    let root: string;

    beforeAll(async () => {
      ({ app, root } = await buildApp({ withHook: true }));
    });
    afterAll(async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    });

    it('rejects an unauthenticated GET with 401', async () => {
      const res = await app.inject({ method: 'GET', url: AVATAR_URL });
      expect(res.statusCode).toBe(401);
    });

    it('does NOT 401 a CORS preflight (OPTIONS carries no Bearer) — lets CORS answer', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: AVATAR_URL,
        headers: {
          origin: 'http://localhost:4001',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      // The hook must pass the preflight through (here, with no CORS plugin
      // registered, Fastify routing yields 404 — the point is it is NOT 401).
      expect(res.statusCode).not.toBe(401);
    });

    it('rejects a malformed / non-Bearer Authorization header with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: AVATAR_URL,
        headers: { authorization: 'Basic abc' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects an invalid Bearer token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: AVATAR_URL,
        headers: { authorization: 'Bearer not.a.jwt' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('serves the file (200) for a valid Bearer token', async () => {
      const token = new JwtService({ secret: SECRET }).sign({ sub: 'user-1' });
      const res = await app.inject({
        method: 'GET',
        url: AVATAR_URL,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(PNG)).toBe(true);
    });

    it('leaves non-uploads routes untouched (404 from the router, not 401)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(404);
    });
  });
});
