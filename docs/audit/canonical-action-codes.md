# Canonical audit action codes (`audit_logs.action` / `audit_logs.entityType`)

**Status:** authoritative · **Task:** DAT-012 · **Last reviewed:** 2026-05-27

## TL;DR

`audit_logs.action` and `audit_logs.entityType` stay `String` in the schema — **on
purpose**. They are NOT promoted to a native Postgres enum and carry NO `CHECK`
constraint. The closed value set is enforced **at compile time** on the write side,
which is the only path that can write these columns. This document is the canonical
record of where that guarantee lives, so a future contributor does not "fix" the
free-string by adding a constraint and inadvertently break the audit trail.

## Source of truth (write side)

| Concern | Source of truth | Mechanism |
| --- | --- | --- |
| `action` value set | `apps/api/src/audit/audit-action.enum.ts` — `enum AuditAction` | Both writers (`AuditService`, `AuditPersistenceService`) type their `action` parameter as `AuditAction`; a typo'd code is a **compile error**. The string value of each member IS the persisted code. |
| `entityType` value set | `ENTITY_TYPE_BY_ACTION` in `apps/api/src/audit/audit.service.ts` | A `Record<AuditAction, …>` exhaustive map: every action must declare its subject type or the file does not compile. `entityType` is derived from the action, never free-typed. |
| `payload` shape per action | `apps/api/src/audit/payload-schemas.ts` (DAT-021) | Zod registry keyed by `AuditAction`; `audit-payload-registry.compile-witness.ts` makes a missing action/entityType/payload a compile error (the OBS-024 triple-intersection witness). |

There is **no untyped write path** into these columns:

- The application runtime role (`app_user`, TOOL-DEPLOY-001) holds only
  `INSERT, SELECT` on `audit_logs` — it cannot `UPDATE`/`DELETE`/`TRUNCATE`.
- The `audit_logs_no_update_delete` immutability trigger (migration
  `20260525190000`) blocks mutation even for the owner role at the SQL layer.
- Every insert flows through `AuditPersistenceService`, whose `action` parameter
  is `AuditAction`-typed and whose row is hash-chained.

## Why document instead of `CHECK` (DAT-012 decision)

A `CHECK (action IN ('…', …))` was considered and rejected:

1. **Friction.** `AuditAction` is actively extended (OBS-005/006/007/012/018/021/024
   each added members). A `CHECK` would couple a Prisma migration to every new action
   — exactly the free-string-vs-enum-migration trade-off the schema author was avoiding,
   and with no added safety over the existing compile-time guarantee.
2. **Prod-data risk.** `ADD CONSTRAINT … CHECK` is validated against existing rows.
   Legacy codes that predate the enum (precedent: `PASSWORD_RESET_ADMIN`, normalized
   read-side via AUD-READ-001) cannot be edited under the immutability trigger, so any
   un-enumerated legacy value would make the migration fail. The dev set is clean, but
   prod cannot be exhaustively enumerated from here.
3. **Redundancy.** The compile-time triple (enum + exhaustive map + Zod witness) plus
   the privilege REVOKE plus the immutability trigger already make an invalid code
   unwritable through any supported path. A `CHECK` adds churn without closing a gap.

## Legacy / un-reconcilable values

Codes written before the current enum (e.g. legacy `PASSWORD_RESET_ADMIN`) are
reconciled **read-side** by `apps/api/src/scripts/normalize-action-codes.ts`
(AUD-READ-001), run as the owner role with a hash-chain recompute — never by
in-place editing under the immutability trigger. If you add an alias or normalization,
record it there, not here.

## If you are about to change an action code

Changing the **string value** of an `AuditAction` member silently orphans existing
rows (the immutability trigger blocks backfilling old codes). Add a new member and a
read-side alias instead; see the header comment in `audit-action.enum.ts`.
