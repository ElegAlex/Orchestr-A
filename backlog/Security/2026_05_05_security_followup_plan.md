# Security Follow-up Plan — May 2026 Audit (cross-cutting)

> **Source**: cross-cutting concerns section of `2026_05_05_security_remediation_plan.md`, set aside while the four primary issues were fixed.
> **Status**: 3 hardening items, none of them direct vulnerabilities — these are defense-in-depth and observability gaps surfaced during the audit.
> **Goal**: enable each item to be picked up in an independent session, mirroring the format of the primary remediation plan. Read the **Session Entry Protocol** before starting.

---

## Status board

| # | Title | Severity | Status | Branch / commit |
|---|-------|----------|--------|-----------------|
| 1 | Rate-limit on `POST /auth/reset-password-token` | Low | ☐ Pending | — |
| 2 | `PASSWORD_CHANGED` audit-log entries not surfaced in admin UI | Low | ☐ Pending | — |
| 3 | `USERS_CRUD` decomposition — split create/import/reset_password | Medium (defense-in-depth) | ☐ Pending | — |

Update this table at the **start** and **end** of every session. Set status to `🟡 In progress` when you begin and `✅ Done — <commit sha>` when merged.

---

## Session Entry Protocol

Same protocol as the primary plan:

1. **Re-verify the finding still applies** — read the function/file listed under *Affected code*. If the gap is closed, mark the row done and stop.
2. **Run the failing test first** when one is listed. Confirm red before touching production code.
3. **Stay scoped to the issue.** Cross-cutting refactors go into their own commit/PR.
4. **`pnpm run build` and the relevant test command must pass** before declaring done.
5. **Commit on `master` directly.** No feature branches (project convention).
6. **Update the status board** in this file in the same commit (or in a dedicated follow-up commit, mirroring the prior `Record fix commit sha for security Issue #N` pattern).

---

## Issue 1 — Rate-limit `POST /auth/reset-password-token`

**Severity**: Low — admin-only endpoint protected by `users:reset_password`. No direct vulnerability now that Issue #2 of the primary plan added the hierarchy gate, but a throttle hardens against (a) credential abuse by a compromised admin/admin-delegated account, (b) accidental loops in import scripts.

### Affected code

- `apps/api/src/auth/auth.controller.ts`
  - `generateResetToken()` (around line 284) — guarded by `@RequirePermissions('users:reset_password')`, **no `@Throttle` decorator**.
- For comparison, `POST /auth/reset-password` (line 292) is already throttled (5/min, 20/15min) via the public `@Throttle` decorator.
- Throttler infrastructure: `apps/api/src/auth/guards/throttler-behind-proxy.guard.ts` (already wired as the global guard for `auth.controller.ts`).

### Root cause

The endpoint inherits only the global throttler default. Per-route override is the established pattern in this controller (login, register, refresh, reset-password each have their own `@Throttle`). The reset-token issuance was missed.

### Fix specification

Add a `@Throttle` decorator on `generateResetToken`. Suggested limits, mirroring the symmetric `reset-password` route but tighter since this endpoint is more sensitive (issues a credential):

```ts
@Throttle({
  short: { limit: 3, ttl: 60_000 },     // 3 / minute / IP
  medium: { limit: 10, ttl: 900_000 },  // 10 / 15min / IP
})
```

No service-layer changes. No DTO changes.

### Test plan

Unit (`apps/api/src/auth/auth.controller.spec.ts` if present, or skip — controller decorators are typically not unit-tested): not required.

E2E (`e2e/tests/security/auth-reset-password.spec.ts` already covers the happy path):
- Add a `@throttle` test: as `admin`, fire 4 `POST /auth/reset-password-token` in quick succession against distinct user ids, assert the 4th returns `429`.
- Tag with `@smoke` (consistent with the rest of the file).

### Verification checklist

- [ ] `@Throttle` decorator present on `generateResetToken`.
- [ ] E2E throttle test green.
- [ ] `pnpm run build` green.
- [ ] Status board updated.

---

## Issue 2 — Surface `PASSWORD_CHANGED` audit-log entries in the admin UI

**Severity**: Low — observability gap. The audit log is correctly written by `auth.service.ts` (`AuditAction.PASSWORD_CHANGED` at lines 400 and 453) and persisted via `AuditPersistenceService`, but there is **no front-end consumer** for it.

### Affected code

- API side (already implemented — verify only):
  - `apps/api/src/audit/audit.service.ts`
  - `apps/api/src/audit/audit-persistence.service.ts`
  - Any existing `GET /audit-logs` controller (verify it exists — search `apps/api/src/audit` for a controller).
- Frontend side (gap):
  - `apps/web/app/` — no audit page exists today (`find apps/web -name '*audit*'` returns nothing).
  - `apps/web/src/services/` — no audit service.

### Root cause

API records audit events but no admin route consumes them. A High issue is mitigated when abuse is *detectable*; today, detection requires direct DB access.

### Fix specification

1. **API**: confirm there is a `GET /audit-logs` endpoint with filters `action`, `userId`, `createdAt[gte]`, `createdAt[lte]`. If not, add one in `apps/api/src/audit/`:
   - Guard with `@RequirePermissions('audit:view')` (add the atomic permission to `packages/rbac/atomic-permissions.ts` if absent; bind it to `ADMIN` only via templates).
   - DTO: query filters above + standard pagination.
2. **Frontend**: add `apps/web/app/admin/audit/page.tsx` with:
   - A filter bar (action select, user picker, date range).
   - A paginated table (timestamp, actor, action, target, IP, metadata).
   - Default filter: last 7 days.
3. **Service layer**: `apps/web/src/services/audit.service.ts` (one Axios service, follow the pattern from `users.service.ts`).
4. **Navigation**: link from the admin sidebar, gated on `audit:view`.

### Test plan

API:
- Unit `apps/api/src/audit/audit.controller.spec.ts`: filter combinations return scoped results; pagination shape.
- E2E `e2e/tests/security/audit-log-access.spec.ts`: only `admin` (or whoever holds `audit:view`) gets 2xx; other 5 roles → 403.

Frontend:
- Component test `apps/web/src/__tests__/audit-page.test.tsx`: renders, filter bar updates URL params, pagination works.
- Manual smoke: trigger a password reset → entry visible in the UI within seconds.

### Verification checklist

- [ ] `audit:view` permission defined and bound to `ADMIN` template only.
- [ ] `GET /audit-logs` endpoint returns `PASSWORD_CHANGED` rows when filtered by action.
- [ ] Admin UI page renders, paginates, filters by action.
- [ ] `pnpm run build` green.
- [ ] Both unit + E2E suites green.
- [ ] Status board updated.

---

## Issue 3 — Decompose `USERS_CRUD` permission bundle

**Severity**: Medium (defense-in-depth). After the primary plan fixes, `ADMIN_DELEGATED` cannot abuse `users:create` / `users:reset_password` to escalate, but the bundling means *any* delegate gets all three capabilities at once. Splitting them grants finer control and reduces blast radius if a future template wants e.g. "can reset passwords but not create users".

### Affected code

- `packages/rbac/atomic-permissions.ts`
  - `USERS_CRUD` (line 574): bundles `users:create`, `users:update`, `users:delete`, `users:import`, `users:reset_password`.
- `packages/rbac/templates.ts`
  - `ADMIN_DELEGATED` (line 328) consumes `USERS_CRUD` (verify which atomic permissions it actually uses).
- Anywhere `@RequirePermissions(...USERS_CRUD)` is spread (grep `USERS_CRUD` across `apps/api/src`).

### Root cause

`USERS_CRUD` was assembled when the `ADMIN_DELEGATED` template was first introduced. After the primary remediation, the bundle is no longer dangerous, but it remains coarse-grained. Granular templates (e.g. a future "HR helpdesk" with reset-only) cannot be expressed without splitting.

### Fix specification

1. **Split** `USERS_CRUD` into three named bundles:
   - `USERS_LIFECYCLE` = `['users:create', 'users:update', 'users:delete', 'users:import']`
   - `USERS_CREDENTIALS` = `['users:reset_password']`
   - Keep `USERS_CRUD` as a thin alias = `[...USERS_LIFECYCLE, ...USERS_CREDENTIALS]` for one release, then remove. (Alternative: remove `USERS_CRUD` outright and update every callsite — pick this if grep shows ≤5 callsites.)
2. **Update templates** in `packages/rbac/templates.ts`:
   - `ADMIN`: keeps both bundles (no behavior change).
   - `ADMIN_DELEGATED`: keeps both bundles (no behavior change in this PR — the split is structural).
3. **Cache invalidation**: per `MEMORY.md` — purge Redis `role-permissions:*` keys after deploy. Document this in the commit message.

### Test plan

Unit (`packages/rbac/__tests__/templates.spec.ts`):
- Re-run existing tests; nothing should regress.
- Add a test asserting `ADMIN_DELEGATED` resolves to the same flat permission set as before the split.

API:
- No service changes expected. Run `pnpm --filter api run test` to confirm no regression.

E2E:
- Re-run `users-create-hierarchy.spec.ts` and `auth-reset-password.spec.ts` from the primary plan — both must stay green (the split is behavior-preserving).

### Verification checklist

- [ ] `USERS_CRUD` split with no behavioral change for `ADMIN` and `ADMIN_DELEGATED`.
- [ ] `pnpm --filter @orchestra/rbac run test` green.
- [ ] `pnpm run build` green.
- [ ] Redis `role-permissions:*` cache purged on deploy (note in commit message).
- [ ] Status board updated.

---

## Out of scope for this plan

- **Re-verification of `bbaacb2` ("harden auth rbac and production security", 2026-04-26) and `df2decf` ("39 vulnerabilities fixed")** — already covered implicitly by the primary plan's per-issue re-verification step. Not a recurring task.
- **Adding a real SSH step to `.github/workflows/deploy.yml`** — already tracked in user memory as a known gap. Not security-critical, not part of this plan.

---

## Conclusion

These three items harden defense-in-depth and observability around the four primary issues fixed in `2026_05_05_security_remediation_plan.md`. None is itself a vulnerability — they reduce blast radius, add detection, and tighten future grant flexibility.

Suggested order: **1 → 3 → 2**. Issue 1 is a one-line decorator + one E2E test (~30 min). Issue 3 is a structural refactor with no behavior change (~1h, mostly testing). Issue 2 is the largest (UI + API + tests, ~half-day).

---

## Changelog

- 2026-05-05 — Initial follow-up plan, derived from cross-cutting concerns section of `2026_05_05_security_remediation_plan.md`.
