import { SetMetadata } from '@nestjs/common';

/**
 * SEC-004 — marks the change-password endpoint as reachable while a session is
 * under a `forcePasswordChange` block.
 *
 * `ForcePasswordChangeGuard` rejects every authenticated route for a flagged
 * user EXCEPT the one(s) carrying this marker, so the user can clear the flag
 * (and nothing else) until they do. Keep this on the self-service
 * change-password route only — widening it re-opens the hole the guard closes.
 */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allow_password_change';

export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
