import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

/**
 * SEC-004 — confines a `forcePasswordChange`-flagged session to the
 * change-password endpoint.
 *
 * Registered as an APP_GUARD in AuthModule directly AFTER JwtAuthGuard (intra-
 * module APP_GUARD order is preserved), so `request.user` is already populated
 * by the time this runs. Enforcement reads the LIVE flag off `request.user`
 * (re-hydrated from the DB by JwtStrategy.validate on every request), NOT the
 * token's `mustChangePassword` claim — a claim goes stale for up to the access
 * TTL, which would lock the user out of normal routes right after they cleared
 * the flag. The DB read sees the cleared flag on the very next request.
 *
 * Decision matrix:
 *   - no `request.user` (e.g. @Public route, unauthenticated) → allow; auth is
 *     not this guard's concern.
 *   - `forcePasswordChange` falsy → allow (the overwhelming common case).
 *   - flagged + route marked `@AllowPasswordChange()` → allow.
 *   - flagged + any other route → 403 with a machine-readable code so the
 *     client can route to the change-password screen (every other endpoint,
 *     including GET /users/me, is blocked, so this 403 is the only signal).
 */
@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { forcePasswordChange?: boolean } }>();
    const user = request?.user;

    if (!user || !user.forcePasswordChange) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'PASSWORD_CHANGE_REQUIRED',
      message:
        'Vous devez changer votre mot de passe avant de poursuivre. Seul le changement de mot de passe est autorisé.',
    });
  }
}
