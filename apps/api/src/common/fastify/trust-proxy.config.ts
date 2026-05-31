/**
 * SEC-013 — client IP resolution behind nginx.
 *
 * The API container is reachable only through nginx on the internal docker
 * bridge (`expose: 4000`, no published host port); nginx is the sole ingress.
 * `['loopback', 'uniquelocal']` trusts the loopback + private network ranges
 * (10/8, 172.16/12, 192.168/16, fc00::/7) where nginx and the API sit, so the
 * real client carried in X-Forwarded-For is resolved — while X-Forwarded-For
 * from any PUBLIC source is rejected. This is the most restrictive posture that
 * still resolves the client without pinning nginx's (dynamic) bridge IP; it is
 * also safe if the API is ever published directly, where bare `true` would let
 * a public client spoof its own IP. Pinning a static nginx IP via the compose
 * network would be stricter but is an infra change out of this scope.
 *
 * MUST be passed to the FastifyAdapter in main.ts for `clientIp()` to work.
 */
export const TRUST_PROXY: readonly string[] = ['loopback', 'uniquelocal'];

/**
 * The real client IP for a Fastify request.
 *
 * Under Fastify, when `trustProxy` is enabled, `req.ip` is the leftmost
 * UNTRUSTED address of the X-Forwarded-For chain — i.e. the real client. Do NOT
 * use `req.ips[0]`: Fastify's `req.ips` is `[socketAddr, ...XFF right-to-left]`,
 * so `req.ips[0]` is always the proxy's socket address (nginx), never the
 * client. (That `req.ips[0]`-is-client assumption is Express semantics, where
 * the socket is stripped — it does not hold here.) When `trustProxy` is off,
 * `req.ip` is the socket address. Either way, `req.ip` is the correct key for
 * per-client throttling, lockout, and audit.
 */
export function clientIp(req?: { ip?: string }): string | undefined {
  return req?.ip;
}
