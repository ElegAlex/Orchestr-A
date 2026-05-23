# `apps/api/src/leaves/`

Leave-management module. Owns the `Leave`, `LeaveBalance`, and
`LeaveTypeConfig` Prisma models, and the gates that govern leave creation
and editing.

## Invariants

### 1. `leaveTypeId` is the source of truth; `type` (enum) is derived

The Prisma `Leave` model carries two competing identifiers for the kind of
leave:

```
Leave {
  leaveTypeId  String      // FK → LeaveTypeConfig.id (canonical)
  type         LeaveType?  // legacy enum, kept for back-compat
}
```

Until Wave 4 (2026-05-23), both were writable from `CreateLeaveDto` and
`UpdateLeaveDto`. A caller could send `{ leaveTypeId: cp-uuid, type: 'RTT' }`
and the server persisted both verbatim — producing a row that disagreed with
itself depending on which column a downstream consumer pivoted on.

The current invariant:

```
DTO.leaveTypeId  →  Leave.leaveTypeId  (verbatim)
DTO.type         →  IGNORED
Leave.type       =  LeaveTypeConfig.code mapped through LeaveType enum
                    (fall through to LeaveType.OTHER if no match)
```

Diagram:

```
           ┌─────────────────────────┐
DTO ─────► │ leaveTypeId  (REQUIRED) │ ─────► Leave.leaveTypeId  ──┐
           │ type         (IGNORED)  │                              │
           └─────────────────────────┘                              ▼
                                                          ┌────────────────┐
                                                          │ LeaveTypeConfig│
                                                          │   .code        │
                                                          └────────┬───────┘
                                                                   │
                                                       map → LeaveType enum
                                                       (or LeaveType.OTHER)
                                                                   │
                                                                   ▼
                                                            Leave.type
```

The DTO field is marked `@deprecated` and will be removed in the next
major release. Until then, the service silently drops it — no 400 — to
avoid breaking existing API consumers.

**Historical drift is not eliminated retroactively.** Wave 4 closes the
write path: no row created or updated after `0480bcb` can carry a
divergent `type` / `leaveTypeId`. Rows persisted before that commit may
still have the disagreement and `GET /leaves?type=X` will return them.
The Wave 5 closeout reports the historical count via:

```sql
SELECT COUNT(*)
FROM   leaves l
JOIN   leave_type_configs c ON c.id = l.leave_type_id
WHERE  l."type"::text != c.code
  AND  l."type" IS NOT NULL;
```

Backfilling those rows is a follow-up decision, not part of Wave 4.

If a future change introduces an editable `leaveTypeId` on update, both
columns must move together inside a single Prisma write. Adding a
"change leave type" endpoint without enforcing this invariant re-opens
finding #8.

### 2. Balance accounting is anchored on `Europe/Paris`

`apps/api/src/leaves/leave-year-window.ts` (`splitLeaveByYear`,
`parisYearWindow`, `calculateLeaveDays`) is the single owner of all
date/time math that touches leave days. The helper takes explicit TZ
arguments via `date-fns-tz` — host TZ is irrelevant. Tests run under
`TZ=Europe/Paris` (forced in `vitest.setup.ts` and the CI workflow);
production should also force the API container to `TZ=Europe/Paris`,
but the helper produces correct output regardless.

### 3. Self-approval is auditable from the table directly

A leave row carries an explicit `selfApproved BOOLEAN` column. When the
column is `true`, `validatorId = validatedById = actor`, and
`validatedAt` is set. A French auditor reading `SELECT * FROM leaves`
can tell self-approval apart from regular approval without joining the
audit log. The audit log carries the same info as a defense-in-depth
trail.

### 4. Manager-declared leaves carry validator metadata too (#12)

When `targetUserId` differs from the requester AND the requester has
`leaves:declare_for_others`, the row is `APPROVED` and the manager is
recorded as both `validatorId` and `validatedById` (`selfApproved` stays
`false`, because the actor is not the beneficiary). This closes the
audit-readability gap the equivalent for self-approval (#6) opened.

## Where to look

| Concern | File |
|---|---|
| Gates (create/update) | `leaves.service.ts:create`, `leaves.service.ts:update` |
| Year-window math | `leave-year-window.ts` |
| Balance helpers | `leaves.service.ts:hasConfiguredBalance`, `resolveAllocatedDays`, `getAvailableDays` |
| Permission resolution | `apps/api/src/rbac/permissions.service.ts` + `packages/rbac/` |
| Schema | `packages/database/prisma/schema.prisma` (models `Leave`, `LeaveBalance`, `LeaveTypeConfig`) |
| Migration history | `packages/database/prisma/migrations/` (`drop_max_days_per_year`, `self_approved_and_global_balance_unique`) |
| E2E coverage | `e2e/tests/workflows/leave-balance-gating.spec.ts` |
