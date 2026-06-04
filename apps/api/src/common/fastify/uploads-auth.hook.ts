import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * SEC-016 — @fastify/static serves `/api/uploads/*` as raw Fastify routes that
 * BYPASS Nest's global JwtAuthGuard / PermissionsGuardV2 (those guards only run
 * on Nest-registered routes, never on plugin-added routes). Without this hook,
 * anyone who knows or guesses a user UUID can fetch
 * `/api/uploads/avatars/<uuid>.<ext>` unauthenticated (anon GET = 200).
 *
 * This `onRequest` hook runs in Fastify's earliest phase — before the static
 * handler — and rejects any request to the uploads prefix that does not carry a
 * valid Bearer access token.
 *
 * Scope decision (proportionate to the reported failure mode — *anonymous*
 * access): "any authenticated user", verifying only the access token's
 * signature + expiry. This matches the existing exposure surface — `avatarUrl`
 * is already returned to every authenticated user in user-summary payloads — so
 * the binary should be readable by exactly the same audience. We deliberately do
 * NOT add a `users:read` permission gate (it would strip avatars from
 * EXTERNAL_PRESTATAIRE, including their own, for no reported-defect benefit) nor
 * the jti-blacklist / nbf checks (a logged-out-but-unexpired token revealing a
 * profile photo for ≤ the access TTL is negligible vs. the anonymous hole).
 *
 * Because an `<img>` element cannot carry an `Authorization` header, the
 * frontend (`UserAvatar`) loads uploaded avatars as an authenticated `fetch`
 * → blob → object URL rather than via a direct `src`.
 *
 * @fastify/static keeps its own `../` traversal protection (root confinement),
 * so this hook adds authentication without opening a path-traversal hole.
 */
export const UPLOADS_AUTH_PREFIX = '/api/uploads/';

/** Minimal surface of `@nestjs/jwt`'s `JwtService` used here. */
export interface AccessTokenVerifier {
  verify(token: string): unknown;
}

function unauthorized(reply: FastifyReply): FastifyReply {
  return reply
    .code(401)
    .send({ statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' });
}

/**
 * Build the `onRequest` hook. Injected with the app's configured `JwtService`
 * so token verification uses the same secret as every other auth path.
 */
export function createUploadsAuthHook(verifier: AccessTokenVerifier) {
  return async function uploadsAuthHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void> {
    const path = (request.url || '').split('?')[0];
    if (!path.startsWith(UPLOADS_AUTH_PREFIX)) {
      return; // not an uploads route — leave Nest routes untouched
    }

    // Let the CORS layer answer preflights: a cross-origin authenticated blob
    // fetch (the frontend's avatar loader) sends `Authorization`, which makes
    // the browser fire an OPTIONS preflight FIRST — and a preflight carries no
    // Bearer. This hook runs before enableCors(), so 401-ing OPTIONS here would
    // block the preflight and the real GET never happens. A preflight returns no
    // file; the actual GET below still requires a valid token.
    if (request.method === 'OPTIONS') {
      return;
    }

    const authHeader = request.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (!token) {
      return unauthorized(reply);
    }

    try {
      verifier.verify(token);
    } catch {
      return unauthorized(reply);
    }
  };
}
