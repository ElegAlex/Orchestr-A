/**
 * DAT-021 compile-time witness — DO NOT DELETE.
 *
 * Proves that the Zod payload registry (`payload-schemas.ts`) has a schema for
 * EVERY `AuditAction` enum member, and no stray schema for a non-member. This is
 * the post-OBS-024 THIRD compile-time enforcement layer for the audit trail:
 *
 *     enum         — audit-action.enum.ts        (action codes are a closed set)
 *   ∩ entityType   — ENTITY_TYPE_BY_ACTION         (every action maps to a subject)
 *   ∩ payload      — AUDIT_PAYLOAD_SCHEMAS (here)   (every action has a payload shape)
 *
 * Lives in `src/` (not a `*.spec.ts`) on purpose: `nest build` typechecks every
 * source file, so this witness is enforced by the real build gate on every CI
 * run. Vitest uses esbuild and does NOT typecheck, so a spec-based witness would
 * be decorative.
 *
 * The registry uses `satisfies Record<AuditAction, …>`, so its inferred key set
 * is the LITERAL set of keys actually present. That lets the two `extends never`
 * checks below catch drift independently of the registry's own annotation:
 *
 *   - If a new `AuditAction` member is added WITHOUT a schema, `_MissingSchemas`
 *     is that member (not `never`) and `_noMissingSchemas` fails to compile
 *     ("Type 'false' is not assignable to type 'true'").
 *   - If a schema is keyed by something that is not an `AuditAction`,
 *     `_StraySchemas` is non-`never` and `_noStraySchemas` fails to compile.
 *
 * Either failure means the audit payload contract drifted — fix the registry, do
 * not delete this file.
 */
import type { AuditAction } from './audit-action.enum';
import { AUDIT_PAYLOAD_SCHEMAS } from './payload-schemas';

/** The literal key set actually present in the registry (preserved by `satisfies`). */
type RegistryKeys = keyof typeof AUDIT_PAYLOAD_SCHEMAS;

/** Enum members with no registered schema. MUST be `never`. */
type _MissingSchemas = Exclude<AuditAction, RegistryKeys>;
const _noMissingSchemas: _MissingSchemas extends never ? true : false = true;

/** Registry keys that are not enum members. MUST be `never`. */
type _StraySchemas = Exclude<RegistryKeys, AuditAction>;
const _noStraySchemas: _StraySchemas extends never ? true : false = true;

export { _noMissingSchemas, _noStraySchemas };
