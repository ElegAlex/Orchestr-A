# Uniform leave-type balance gating + self-approval permission

**Date**: 2026-05-23
**Type**: Behavior change + schema cleanup + RBAC addition
**Status**: Approved

## Context

Today, the leave-creation endpoint applies two independent and inconsistent gates:

1. A **hardcoded CP-only balance check** (`leaves.service.ts:367-376`) — if the leave type's code equals `'CP'`, the service compares the request against `LeaveBalance` (individual override → global → fallback `0`).
2. A **per-type annual cap** (`leaves.service.ts:378-386`) — if `LeaveTypeConfig.maxDaysPerYear` is set, the cumulative year-to-date usage is compared against that cap.

Side effects of this split:
- A `LeaveBalance` entry on any non-CP type is **ignored** at validation time.
- A CP request with no `LeaveBalance` row resolves the allocation to `0` and is therefore **rejected** — silently in the dataset, since the only CP leaves in production were imported via a CSV path that bypasses validation (`leaves.service.ts:2563`).
- "Unlimited" is conflated: `maxDaysPerYear = NULL` looks unlimited in the admin UI, but the CP-only branch can still reject submissions.

### Prod audit (2026-05-23 snapshot)

```
SELECT id, code, name, "maxDaysPerYear", "isActive" FROM leave_type_configs;
```

| code | name | maxDaysPerYear | isActive |
|---|---|---|---|
| CP | Congés payés | NULL | t |
| RTT | RTT | NULL | t |
| SICK_LEAVE | Maladie | NULL | t |
| UNPAID | Sans solde | NULL | t |
| OTHER | Autre | NULL | t |
| FORMATION | Formation | NULL | t |
| ALTERNANCE | Alternance | NULL | t |

```
SELECT COUNT(*) FROM leave_balances;
-- 0
```

Zero rows in `leave_balances`, zero non-null `maxDaysPerYear`. The column carries no production data; dropping it is loss-less.

## Decision

Make leave-balance gating **uniform across all leave types** by collapsing the two mechanisms into one:

- **`LeaveBalance`** becomes the single source of truth for any quota.
- **`LeaveTypeConfig.maxDaysPerYear`** is dropped from the schema and the API.
- The semantic of "unlimited" is **explicit by absence**: a leave type with no `LeaveBalance` row (neither individual `(userId, typeId, year)` nor global `(null, typeId, year)`) is unlimited for that user/year. A `LeaveBalance` row with `totalDays = 0` is an explicit "depleted" state and rejects requests.
- The CP-only hardcoded branch disappears. Validation becomes generic.

## Scope

### What changes

**Schema**:
- Drop column `leave_type_configs.maxDaysPerYear` (Prisma migration).
- No data migration: column is NULL across all rows in production.

**Backend — `apps/api/src/leaves/leaves.service.ts`**:
- Replace the two existing branches (`if code === 'CP'`, `if maxDaysPerYear`) at the leave-creation gate (lines 367-386) with a single generic check based on `LeaveBalance` presence.
- Introduce two helpers (or refactor `resolveAllocatedDays`): `hasConfiguredBalance(userId, typeId, year): Promise<boolean>` and `getAvailableDays(userId, typeId, year): Promise<number>` (= total − approved − pending). The presence check fires the gate; the available days drive the comparison.
- The CSV import path (`leaves.service.ts:2563`) keeps its current behavior of bypassing balance validation (separate ticket if we want to harmonize). This is **out of scope** here.

**Backend — DTOs**:
- Remove `maxDaysPerYear` from `apps/api/src/leave-types/dto/create-leave-type.dto.ts` and any update DTO.
- Remove the field from shared types in `packages/types/` if exposed.

**Frontend — `apps/web/src/components/LeaveTypesManager.tsx`**:
- Drop the "Limite/an" column from the type-list table (around line 323-325).
- Drop the `maxDaysPerYear` field from the create/edit form, including the placeholder strings showing "illimité" attached to that field.
- The "Soldes" tab on `apps/web/app/[locale]/leaves/page.tsx` (CRUD on `LeaveBalance`) remains the single configuration surface for per-type quotas.

**Tests**:
- Vitest backend (`leaves.service.spec.ts`): drop `maxDaysPerYear`-related tests; add tests for the new generic gate (4 branches: no balance → allow, individual override → enforce, global default → enforce, override beats global).
- Playwright E2E: add a scenario where a non-CP type (RTT) has a global `LeaveBalance(totalDays=N)` and a request above `N` is rejected with 400; add a scenario where a type with no balance accepts arbitrary requests.
- Remove the existing CP-specific balance test in favor of the generic ones.

### What does NOT change

- `LeaveBalance` table structure: untouched.
- `LeaveBalance` CRUD endpoints and admin UI under `/leaves` "Soldes" tab: untouched (already generic over types).
- The CSV bulk-import bypass at line 2563: untouched (separate concern).
- The `getLeaveBalance()` shape returned to consumers, including the legacy CP-prominent root fields (`total`, `used`, `available`, `pending`): untouched. Reason: frontend widgets still consume the legacy form; refactoring them is a follow-up.
- The `getPendingDays()` helper at line 1870, which uses the legacy `LeaveType.CP` enum: untouched (private, no impact on the gate).
- The Prisma `LeaveType` enum on the `Leave.type` column (separate compatibility field): untouched.

## Behavior matrix (after the change)

| Type has `LeaveBalance` for (user, type, year) | Type has global `LeaveBalance` for (null, type, year) | Result |
|---|---|---|
| no | no | **Unlimited** (no gate) |
| no | yes, totalDays = N | Enforce against `N − used − pending` |
| yes, totalDays = M | (any) | Enforce against `M − used − pending` (individual wins) |
| no | yes, totalDays = 0 | All requests rejected with `Solde insuffisant` |

Same rules apply to every leave type, including CP.

## Acceptance criteria

1. `pnpm run build` and `pnpm run test` pass across all workspaces.
2. Prisma migration applies cleanly: `pnpm --filter database db:migrate deploy` succeeds; the resulting schema has no `maxDaysPerYear` column.
3. New backend tests cover the four branches of the matrix above.
4. New E2E test passes: an RTT request above a configured global balance returns 400; an RTT request on a type with no balance returns 201.
5. The admin UI (`LeaveTypesManager.tsx`) no longer shows the "Limite/an" column or input.
6. The Swagger spec for `POST /leaves` no longer mentions `maxDaysPerYear` validation.
7. `grep -rn "maxDaysPerYear" apps/ packages/` returns zero hits in source code (the migration file is allowed to mention it in the `DROP COLUMN` statement).
8. A CP request submitted via the UI by an authenticated user no longer hits the `'Solde insuffisant'` rejection when no `LeaveBalance` exists. (This is a deliberate fix to the latent silent bug surfaced by the audit.)

## Risks and rollback

- **Behavior change for production CP** — today, a CP request via the standard API path would be rejected because no `LeaveBalance` exists. After the change, that same request is accepted (unlimited until balances are configured). This is the intended fix, but operations must be aware: if quotas should apply, the admin needs to create `LeaveBalance` rows via the existing "Soldes" tab.
- **Schema drop is destructive** — `maxDaysPerYear` is gone. Restoring it would require a new migration. Since the column is NULL across all rows in prod, the rollback cost is purely the migration files; no data loss.
- **Tests using `maxDaysPerYear`** — must be deleted, not skipped, so they don't drift.

## Self-approval permission (related change)

### Context

Today, when a user submits a leave request, the initial status is determined by `LeaveTypeConfig.requiresApproval` (`leaves.service.ts:393-403`). If the type requires approval, the leave goes `PENDING` and a validator is looked up via `findValidatorForUser()`. There is no path to short-circuit the approval workflow based on the requesting user's seniority — even an ADMIN must wait for their own leave to be approved by someone else.

Operational reality: top-tier roles (`ADMIN`, `RESPONSABLE`) are themselves the validators in most service hierarchies, and asking them to self-create-then-approve in two clicks is friction.

### Decision

Introduce a new RBAC permission `leaves:self_approve`. Users carrying that permission, when creating a leave **for themselves** (not via the "declare for others" flow), get the leave persisted with status `APPROVED` directly and no validator assigned.

The permission is added to the templates `ADMIN` and `RESPONSABLE` only — per project convention, no hardcoded role checks.

### Scope

**RBAC catalog (`packages/rbac/atomic-permissions.ts`)**:
- Add `"leaves:self_approve"` to the `PermissionCode` union (alphabetical order in the `leaves` group).
- Add it to `CATALOG_PERMISSIONS` (alphabetical position).
- Add it to a relevant `LEAVES_*` bundle, or create a new bundle if no existing one is semantically correct. Reading the file will clarify the right composition; the goal is to land in templates `ADMIN` and `RESPONSABLE` only.

**RBAC templates (`packages/rbac/templates.ts`)**:
- Make sure `ADMIN` and `RESPONSABLE` templates pick up the new permission (either via a bundle they already use, or via an explicit added entry).

**Backend — `apps/api/src/leaves/leaves.service.ts`**:
- In `create()` (around lines 393-403), when the leave is for `userId === requestingUserId` (no `targetUserId` redirect) and the requesting user has `leaves:self_approve`, set `initialStatus = APPROVED` and `validatorId = null`, bypassing the `requiresApproval` branch. The check uses the existing `roleHasPermission(role, perm)` helper (`leaves.service.ts:245`) for consistency.
- The "declared by manager for collaborator" path keeps its own existing auto-approval logic (`declaredByManager || !leaveTypeConfig.requiresApproval`), unchanged. Self-approval applies only when the leave is for oneself.

**Templates count and tests**:
- `packages/rbac/__tests__/templates.spec.ts` — bump `CATALOG_PERMISSIONS` length (116 → 117) and increment `EXPECTED_COUNTS` for any template that gains the permission (at least `ADMIN` and `RESPONSABLE`; let the failing tests dictate the exact list, as we did in the balanced-planning removal).
- `apps/api/src/rbac/__tests__/permissions.service.spec.ts` — bump the catalog count assertion (116 → 117).
- `apps/api/src/rbac/__tests__/templates.spec.ts` (if present) — sync any explicit ADMIN/RESPONSABLE permission lists.

**Tests for the new flow**:
- `leaves.service.spec.ts`: 4 test cases.
  - User with `leaves:self_approve` creating own leave → status APPROVED, no validatorId
  - User with `leaves:self_approve` creating leave for another user (`targetUserId`) → existing flow (no special bypass; `declaredByManager` path handles approval)
  - User without `leaves:self_approve`, type with `requiresApproval=true` → status PENDING with validatorId
  - User without `leaves:self_approve`, type with `requiresApproval=false` → status APPROVED (unchanged)
- Playwright E2E: optional — a test that as ADMIN, a leave is APPROVED immediately upon creation, no entry in pending list.

### Behavior matrix (self-approval)

| Requesting user | targetUserId set? | Has `leaves:self_approve`? | Type `requiresApproval` | Resulting status | validatorId |
|---|---|---|---|---|---|
| any | self | yes | any | **APPROVED** | null |
| any | self | no | true | PENDING | resolved validator |
| any | self | no | false | APPROVED | null |
| manager | other | (irrelevant for self-approve) | any | existing logic (`declaredByManager` path) | existing logic |

### Acceptance criteria (added)

9. `leaves:self_approve` is part of `CATALOG_PERMISSIONS` and resolves at runtime for ADMIN and RESPONSABLE templates only.
10. A leave creation request from an ADMIN for themselves on a type with `requiresApproval=true` lands as `APPROVED` with `validatorId=null`.
11. The same request from a CONTRIBUTEUR lands as `PENDING` with a non-null `validatorId`.
12. The "declared for others" path is unchanged by this work.

## Out of scope

- Generalizing the CSV import bypass to enforce balances.
- Refactoring the legacy CP-prominent fields on `getLeaveBalance()` (`total`, `used`, `available`, `pending` at the root).
- Removing the legacy `Leave.type` enum column (separate refactor).
- Any change to the admin UI for configuring `LeaveBalance` rows (`/leaves` "Soldes" tab).
- Auto-approving leaves declared by a manager for someone else (already handled by the `declaredByManager` branch).
- Surfacing a frontend distinction "this is auto-approved because you have self_approve" — the user just sees their leave land directly in approved state.
