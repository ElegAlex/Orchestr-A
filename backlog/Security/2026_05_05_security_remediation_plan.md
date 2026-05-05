# Security Remediation Plan — May 2026 Audit

> **Source audit**: `backlog/Security/2026_05_03_Revue de sécurité.md` (FR).
> **Status**: 4 confirmed issues, all reproducible on `master` as of 2026-05-05.
> **Goal**: enable each issue below to be fixed in an independent session, with no cross-session memory required. Read the **Session Entry Protocol** before starting any issue.

---

## Status board

| # | Title | Severity | Status | Branch / commit |
|---|-------|----------|--------|-----------------|
| 1 | Privilege escalation via user create / import (`roleCode` not gated by hierarchy) | **High** | ✅ Done — ef6b4e7 | ef6b4e7 |
| 2 | Cross-tier password reset token issuance | **High** | ☐ Pending | — |
| 3 | Time-tracking entries created on out-of-scope task / project | **High** | ☐ Pending | — |
| 4 | E2E IDOR test contradicts service behavior (silent coercion vs 403) | **Medium** | ☐ Pending | — |

Update this table at the **start** and **end** of every session. Set status to `🟡 In progress` when you begin and `✅ Done — <commit sha>` when merged.

---

## Session Entry Protocol

When starting a session to fix one of these issues:

1. **Re-verify the finding still applies** — code drifts. Read the function listed under *Affected code*. If the vulnerability is already gone, mark the row done and stop.
2. **Run the failing test first** (if listed). Confirm red before touching production code.
3. **Stay scoped to the issue.** Do not refactor adjacent code unless it directly blocks the fix. Cross-cutting refactors go into their own commit/PR.
4. **Always pass `pnpm run build` and the relevant E2E project before declaring done.**
5. **Commit on `master` directly.** No feature branches (project convention).
6. **Update the status board** in this file in the same commit as the fix.

Each issue below is self-contained: file refs, exploit, fix spec, tests. You should not need to read any other issue to ship a given one.

---

## Issue 1 — Privilege escalation via user create / import

**Severity**: High — leads directly to full ADMIN takeover.

### Affected code

- `apps/api/src/users/users.controller.ts`
  - `POST /users` (`create`) — guarded by `@RequirePermissions('users:create')`
  - `POST /users/import/validate` (`validateImport`)
  - `POST /users/import` (`importUsers`)
- `apps/api/src/users/users.service.ts`
  - `create(createUserDto)` — **no caller context**
  - `importUsers(users)` — **no caller context**
  - `validateImport(users)` — **no caller context**
  - `update(id, dto, callerRoleCode?)` — already does the hierarchy check (reference implementation)
  - Helpers already in this class: `resolveTemplateKey()`, `canAssignRole()`, `TEMPLATE_HIERARCHY`
- `packages/rbac/templates.ts` — `ADMIN_DELEGATED` excludes only `users:manage_roles`, so it has `users:create` and `users:import`.
- `packages/rbac/atomic-permissions.ts` — `USERS_CRUD` bundles `users:create`, `users:import`, `users:reset_password`.

### Root cause

`update()` enforces `canAssignRole(callerRoleCode, targetRoleCode)` (rank-based via `TEMPLATE_HIERARCHY`). `create()`, `validateImport()` and `importUsers()` do **not** receive `callerRoleCode` and assign whatever `roleCode` the caller submits. Any holder of `users:create` (notably `ADMIN_DELEGATED`) can therefore mint a fresh `ADMIN` account.

### Exploit

```
POST /api/users { ..., roleCode: "<institutional role bound to template ADMIN>" }
→ 201 Created
→ attacker logs in with new account → full ADMIN.
```

Same path via `POST /api/users/import` (mass).

### Fix specification

1. **Controller**: thread `@CurrentUser()` into `create`, `validateImport`, `importUsers` — pass the caller's `role.code` to the service (mirror `update()` at `users.controller.ts` line ~297).
2. **Service**: extend signatures
   - `create(dto, callerRoleCode: string)`
   - `validateImport(rows, callerRoleCode: string)`
   - `importUsers(rows, callerRoleCode: string)`
3. **Hierarchy check** — extract a private helper (or reuse the existing logic from `update()` lines 422-440):
   - If `targetTemplateKey === 'ADMIN'` and `callerTemplateKey !== 'ADMIN'` → `ForbiddenException`.
   - If `!await canAssignRole(callerRoleCode, targetRoleCode)` → `ForbiddenException`.
4. **Import flow**:
   - `validateImport` must surface non-assignable rows as warnings/errors per row (do **not** silently drop).
   - `importUsers` must reject the entire batch (or skip per-row with a clear error in the result) if any row violates the hierarchy. Pick **per-row skip with error in `result.errors`** to match the existing partial-success semantics.
5. **No backwards-compat shim**: there are no external callers; the signature change is safe.

### Test plan

Unit (Vitest, `apps/api/src/users/users.service.spec.ts`):
- `create` rejects when caller is `ADMIN_DELEGATED` and target role is bound to `ADMIN` template (403).
- `create` allows `ADMIN` to assign any institutional role.
- `create` allows `ADMIN_DELEGATED` to assign any role of strictly lower rank.
- Same three cases for `importUsers`. Verify the error appears in `result.errors` and the row is **not** in `result.createdUsers`.
- `validateImport` flags forbidden rows.

E2E (Playwright, `e2e/tests/security/`):
- New file `users-create-hierarchy.spec.ts`. For each of the 6 roles, attempt to create a user with role `ADMIN`. Only the `admin` project should succeed.
- Tag with `@smoke`.

### Verification checklist

- [ ] `git grep -n "users.service.create\|importUsers\|validateImport" apps/api` — every call site updated.
- [ ] `pnpm --filter @orchestra/api run test -- users.service` green.
- [ ] `npx playwright test e2e/tests/security/users-create-hierarchy.spec.ts` green.
- [ ] `pnpm run build` green.
- [ ] Status board updated in this file.

---

## Issue 2 — Cross-tier password reset token issuance

**Severity**: High — direct path to ADMIN takeover; depends only on `users:reset_password`.

### Affected code

- `apps/api/src/auth/auth.controller.ts`
  - `POST /auth/reset-password-token` — guarded by `@RequirePermissions('users:reset_password')`
  - Handler: `generateResetToken(dto, currentUser)`
- `apps/api/src/auth/auth.service.ts`
  - `generateResetToken(userId, createdById)` — **no hierarchy check, returns raw token in body**
- `packages/rbac/atomic-permissions.ts` — `users:reset_password` is in `USERS_CRUD`.
- `packages/rbac/templates.ts` — `ADMIN_DELEGATED` has `USERS_CRUD` minus `users:manage_roles` → has `users:reset_password`.

### Root cause

The endpoint trusts the permission alone. The service:
- does not compare the caller's template rank against the target's,
- returns the reset token verbatim in the response body, so anyone with the permission walks away with credentials they can immediately use.

### Exploit

```
ADMIN_DELEGATED → POST /api/auth/reset-password-token { userId: <ADMIN id> }
→ 200 { token, resetUrl }
→ POST /api/auth/reset-password { token, newPassword }
→ ADMIN account hijacked.
```

### Fix specification

Two layers, apply both:

1. **Hierarchy gate in the service**.
   - Add a dependency from `AuthService` to a hierarchy helper. Cleanest path: extract `resolveTemplateKey` + `canAssignRole` + `TEMPLATE_HIERARCHY` from `UsersService` into a new `apps/api/src/common/services/role-hierarchy.service.ts` and export it via `CommonModule`. Inject into both `UsersService` (replace its private copies) and `AuthService`.
   - In `generateResetToken(targetUserId, createdById)`: load the caller's role, load the target's role, reject (`ForbiddenException`) if `callerRank <= targetRank`. ADMIN can reset anyone except other ADMINs unless caller is also ADMIN — apply the same `target=ADMIN ⇒ caller must be ADMIN` rule used in `users.service.update()`.
2. **Stop returning the raw token in production responses**.
   - Add an env flag `AUTH_EXPOSE_RESET_TOKEN` (default `false`). When false, the endpoint returns `{ ok: true }` only and the reset URL is logged via the existing audit channel (or sent by mail if/when SMTP is wired). When true (dev / e2e), return as today.
   - Document the flag in `.env.example`.

### Migration / coordination notes

If the hierarchy helper is extracted (recommended), Issue 1's fix and Issue 2's fix touch the same new module. Either:
- Land Issue 1 first, do the extraction there, then Issue 2 imports the helper. **Recommended.**
- Or land Issue 2 first with the helper still inlined in `UsersService` (re-export it as `public`) and refactor later.

### Test plan

Unit (`apps/api/src/auth/auth.service.spec.ts`):
- `generateResetToken` throws 403 when caller is `ADMIN_DELEGATED` and target is `ADMIN`.
- Allows `ADMIN_DELEGATED` to reset a `MANAGER`.
- Allows `ADMIN` to reset anyone (including other `ADMIN`).
- With `AUTH_EXPOSE_RESET_TOKEN=false`, response body has no `token` / `resetUrl`.

E2E (`e2e/tests/security/auth-reset-password.spec.ts`):
- `responsable` role → POST reset for `admin` user → 403.
- `admin` → POST reset for any user → 200, then `POST /auth/reset-password` succeeds and old refresh tokens are revoked (already implemented — assert revocation).

### Verification checklist

- [ ] `RoleHierarchyService` extracted and unit-tested, both `UsersService` and `AuthService` consume it (or alternative chosen and documented).
- [ ] Reset endpoint returns 403 for cross-tier requests.
- [ ] `AUTH_EXPOSE_RESET_TOKEN` honored, `.env.example` updated.
- [ ] `pnpm run test` and `pnpm run build` green.
- [ ] Status board updated.

---

## Issue 3 — Time-tracking entries on out-of-scope task / project

**Severity**: High (data integrity for reporting / billing surfaces) / Medium otherwise.

### Affected code

- `apps/api/src/time-tracking/time-tracking.service.ts`
  - `create(currentUser, dto)` — checks task/project **existence** but not access.
  - `upsertDismissal(userId, taskId)` — same gap.
- `apps/api/src/common/services/access-scope.service.ts` — already exposes:
  - `assertCanAccessProject(projectId, user, bypassPermissions?)`
  - `assertCanReadTask(taskId, user, bypassPermissions?)`
  - `canAccessProject(projectId, user, bypassPermissions?)`

### Root cause

`time_tracking:create` is a self-service permission held broadly. The service trusts the UUID submitted by the caller. An attacker who knows or guesses a `taskId`/`projectId` outside their service/department can attach a time entry to it, polluting reports and dismissal state.

### Fix specification

In `TimeTrackingService.create`, before persisting:

1. If `taskId` is provided:
   - `await this.accessScopeService.assertCanReadTask(taskId, currentUser, [MANAGE_ANY_PERMISSION])`.
2. If `projectId` is provided (or derived from the task):
   - `await this.accessScopeService.assertCanAccessProject(effectiveProjectId, currentUser, [MANAGE_ANY_PERMISSION])`.
3. Apply the same two checks at the top of `upsertDismissal` (note: signature currently takes `userId, taskId` — extend to take `currentUser` so the access check is honored).
4. Inject `AccessScopeService` via the module — verify `TimeTrackingModule` imports `CommonModule` (it likely already does for ownership checks).

Behavior on rejection: throw `ForbiddenException` (403) — distinct from the existing `NotFoundException` (404) for missing entities. Return 404 only for genuinely missing IDs to avoid leaking existence of out-of-scope resources. The `AccessScopeService` already follows this convention.

### Edge cases

- **Third-party declarations**: `thirdPartiesService.assertAssignedToTaskOrProject` already runs after `resolveActor`. Keep it. Access scope on the task/project remains the caller's responsibility — verify the third-party path also goes through the new asserts.
- **Bypass**: `time_tracking:manage_any` already exists as `MANAGE_ANY_PERMISSION` (line 17). Use it as the bypass list passed to AccessScope.

### Test plan

Unit (`time-tracking.service.spec.ts`):
- `create` throws 403 when caller is contributor and `taskId` belongs to a project they can't access.
- `create` throws 403 when caller passes `projectId` directly out of scope.
- `upsertDismissal` same.
- `create` succeeds when caller has `time_tracking:manage_any`.

E2E (`e2e/tests/security/time-tracking-scope.spec.ts`):
- For each non-admin role: POST a time entry against a task in a project that role cannot access → 403.
- Admin / manage_any role → 201.

### Verification checklist

- [ ] `AccessScopeService` injected in `TimeTrackingService`, asserts called for both create paths.
- [ ] 403 vs 404 distinction respected.
- [ ] `pnpm --filter @orchestra/api run test -- time-tracking` green.
- [ ] `npx playwright test e2e/tests/security/time-tracking-scope.spec.ts` green.
- [ ] Status board updated.

---

## Issue 4 — E2E test contradicts time-tracking listing behavior

**Severity**: Medium — security posture is inconsistent and tests document the wrong contract.

### Affected code

- `apps/api/src/time-tracking/time-tracking.service.ts`
  - `getUserReport()` (or the listing path used by `GET /time-tracking`): silent coercion of `userId` to caller when `view_any` is missing (around L249-274; comment documents the intent).
- `e2e/tests/security/ownership-idor.spec.ts`
  - Test L422-431 expects **403** for `GET /time-tracking?userId=<other>` without `time_tracking:view_any`.

### Root cause

Production code silently rewrites `userId` to the caller's id and returns 200 with the caller's data. The E2E test expects a 403 refusal. One of them is wrong, and currently the test is either skipped, broken, or the suite has a divergence with the running app.

### Decision required (do this first)

**Recommended**: adopt **strict 403** and remove the silent coercion. Reasons:
- Silent coercion violates principle of least astonishment: a client sees data and assumes it's the requested user's.
- The pattern is already strict elsewhere in the codebase (ownership guard returns 403 for unauthorized resource access).
- Aligns with the existing E2E test, no test rewrites needed.

If the team prefers the lenient mode (200 with own data only), the test must be rewritten to assert (a) status 200, (b) every returned row's `userId === caller.id`, (c) no row matches the requested `userId` unless `view_any`.

### Fix specification (strict path — recommended)

1. In the listing handler, replace the coercion block with: if `userId && userId !== currentUser.id && !hasViewAny` → `throw new ForbiddenException()`.
2. Same logic for the symmetric filters if any (`projectId`, `taskId` filters that target other users' data).
3. Update the comment block to document the strict policy.
4. Confirm no other test or call site relies on the lenient behavior — `git grep -n "userId" apps/web/src` for any client expectation.

### Test plan

- E2E `ownership-idor.spec.ts` already asserts the desired behavior — run it and confirm green after the fix.
- Add a unit test in `time-tracking.service.spec.ts`: caller without `view_any`, `userId=other` → throws `ForbiddenException`.

### Verification checklist

- [ ] Decision recorded in commit message (strict vs lenient).
- [ ] E2E `ownership-idor.spec.ts` green without modification (strict path) **or** rewritten and green (lenient path).
- [ ] No frontend regression (manual smoke or grep for affected query patterns).
- [ ] Status board updated.

---

## Cross-cutting concerns (not addressed by individual issues)

These came up while auditing the four issues. Track separately, do not bundle into the fixes above.

- **Rate-limit** on `POST /auth/reset-password-token` and `POST /auth/reset-password`. Token is cryptographically strong (UUID v4, 122 bits), but a throttle still hardens against enumeration of valid `userId`s and accidental abuse.
- **Audit log review**: confirm `PASSWORD_CHANGED` entries (`auth.service.ts:370`) are surfaced in the admin UI. A High issue is mitigated if abuse is detectable.
- **`USERS_CRUD` decomposition**: bundling `users:create`, `users:import`, `users:reset_password` into one set is what makes Issues 1 and 2 reachable from `ADMIN_DELEGATED`. Even after the hierarchy gates land, splitting the bundle would give finer control. Out of scope for this plan; file as a tech-debt ticket.
- **Earlier security work**: commit `bbaacb2` ("harden auth rbac and production security", 2026-04-26) introduced `AccessScopeService` and several fixes. Verify Issues 1-4 are not regressions of fixes from `df2decf` ("39 vulnerabilities fixed").

---

## Conclusion

The codebase already has strong foundations (global JWT guard, refresh-token rotation, blacklist, magic-byte validation, ownership guards, dynamic RBAC). The four issues here are **consistency gaps** between the intended permission model and its application in two services (`UsersService`, `AuthService`) and two paths (`time-tracking create`, `time-tracking listing`).

Land issues in order **1 → 2 → 3 → 4**. Issue 1 is largest; Issue 2 piggybacks on its extraction. Issues 3 and 4 are independent and can swap order if convenient.

---

## Changelog

- 2026-05-05 — Initial plan, derived from `2026_05_03_Revue de sécurité.md` (FR audit) and verified against `master` HEAD.
