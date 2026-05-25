/**
 * OBS-024 compile-time witness — DO NOT DELETE.
 *
 * Proves that `AuditPersistenceService.log()`'s `action` parameter accepts the
 * `AuditAction` enum ONLY — never an arbitrary string. This is the type-level
 * guarantee that closed OBS-024: a single source of truth for audit action
 * codes (`audit-action.enum.ts`), compile-time enforced.
 *
 * Lives in `src/` (not in a `*.spec.ts`) on purpose: `nest build` typechecks
 * every source file, so this witness is enforced by the real build gate on
 * every CI run. Vitest uses esbuild and does NOT typecheck, so a spec-based
 * witness would be decorative.
 *
 * If the negative `@ts-expect-error` below ever reports "unused directive"
 * (TS2578), the `action` parameter has regressed from `AuditAction` back to
 * `string` and the enum-vs-free-string convergence has been undone. Fix the
 * regression — do not delete this file.
 */
import type { AuditAction } from './audit.service';
import type { AuditPersistenceService } from './audit-persistence.service';

/** The exact type of the `action` field accepted by the persistence boundary. */
type AuditLogAction = Parameters<AuditPersistenceService['log']>[0]['action'];

// Positive control: every AuditAction member is an accepted action.
type _Accepted = AuditAction extends AuditLogAction ? true : false;
const _accepted: _Accepted = true;

// Negative control: a non-member string literal MUST be rejected. Before
// OBS-024 (when `action: string`) this assignment is legal and the directive
// is unused → TS2578 → build fails, which is precisely the bug OBS-024 fixes.
// @ts-expect-error a non-member string literal is not assignable to AuditAction
const _rejected: AuditLogAction = 'NOT_A_REAL_ACTION';

export { _accepted, _rejected };
