# ORCHESTRA — Adversarial Review Remediation Backlog (2026-06-04 merge)

> **Source audits (merged):**
>   - `audits/2026-06-04-adversarial-review/findings.json` — 268 findings, optimized run (**primary / canonical**; survived the adversarial refutation wave).
>   - `audits/2026-06-04-adversarial-review-sessionA/findings.json` — 99 findings, earlier run (**sessionA**).
>   - `audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md` — the read-only live correction (folded into SEC-001).
> **Generated:** 2026-06-05 by `scripts/build-merged-backlog.py` (deterministic; re-runnable).
> **Repo commit audited:** `0997b30e`.
> **Session protocol:** `../2026-05-24-review-payloads/CLAUDE_SESSION_CONTRACT.md` (same rules: strict file scope, gate-green-to-close, append-only history, `[closes <id>]` + `Closed_by` SHA).
> **Coherence gate:** `scripts/check-backlog-coherence.sh BACKLOG.md` (this dir).

## Reconciliation method

- **Merged total:** 329 tasks = 268 primary + 61 sessionA-only (38 sessionA findings deduped into a primary entry).
- **Dedup:** matched on (file + root cause). The primary entry is canonical (refutation-wave survivor); each duplicate sessionA id is cross-linked in the primary entry's **Notes** and is NOT emitted separately. sessionA-only findings are emitted with `SA-<id>` IDs to avoid collision.
- **Both runs reuse short IDs for *different* findings** (e.g. primary `SEC-001`=nginx TLS vs sessionA `SEC-001`=admin-reset nbf). Every cross-link names its run.
- **Severity recalibration:** the audit's blocking labels are **not** trusted blindly. Any finding whose truth/severity depends on runtime/deploy/CI/live state (TLS edge, CI/E2E boot, prod env, deploy-time locks) is **capped at `important`** and tagged **requires-live-verification** (Phase 3) — never blocking on static evidence alone. Code-verifiable blockers stay blocking (Phase 1).
- **SEC-001** applied: `blocking → important` per the live verification (prod terminates TLS at an out-of-repo certbot host nginx). Reframed residue: HSTS missing + TLS-terminator IaC drift + weak `ssl_protocols` floor.

> ⚠️ **Scope of this merge:** dedup is *across the two 2026-06-04 runs only*. Overlap with the older `2026-05-24` remediation cycle (sibling dir) was **NOT** deduped — some items here may already be DONE/superseded there. A verify pass should reconcile before remediation.

## Totals

- **Tasks:** 329  ·  **deduped (sessionA→primary):** 38  ·  **requires-live-verification:** 13
- **By effective severity:** 5 blocking · 186 important · 121 nit · 17 suggestion
- **By provenance:** 37 cross-validated · 231 primary-only · 61 secondary-only
- **By category:** 72 correctness · 42 data_integrity · 40 observability · 72 performance · 74 security · 29 tests

## Prioritized phases

- **Phase 1 — Code-verifiable blockers:** 5 tasks
- **Phase 2 — Important — code-verifiable (by cluster):** 178 tasks
- **Phase 3 — Requires-live-verification (capped at important · pending a live check):** 13 tasks
- **Phase 4 — Nit:** 116 tasks
- **Phase 5 — Suggestion:** 17 tasks

## Schema legend

Each task: `Status` (TODO→IN_PROGRESS→DONE→VERIFIED), `Phase` (priority band 1–5), `Cluster` (root-cause group A–T from the audit), `Confidence` (provenance: cross-validated / primary-only / secondary-only), `Blocked_by`, `Severity` (effective, after recalibration), `Live-gated`, `Category`, `File`, `Source` (truth lives in findings.json), `Closed_by` (SHA, required by the coherence gate for DONE/VERIFIED).

---

### Phase-1 code-verifiable blockers (close first)

- `COR-001` (cross-validated)
- `DAT-002` (cross-validated)
- `COR-002` (primary-only)
- `COR-003` (primary-only)
- `DAT-001` (primary-only)

---

## Phase 1 — Code-verifiable blockers

### COR-001 — canValidate: delegation check is not scoped to the leave's assigned validator — any delegate can approve any leave

- **Status:** TODO
- **Phase:** 1
- **Cluster:** A
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🔴 blocking
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · authorization_scope_bypass
- **File:** `apps/api/src/leaves/leaves.service.ts:1638-1650`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-001` · audit-confidence: high · found_by: correctness

**Description:**
The delegation branch of `canValidate` finds any active delegation where the calling user is `delegateId`, without requiring that the delegation's `delegatorId` matches `leave.validatorId`. If user Alice was delegated by Manager A (who manages dept A), she can also approve leaves of employees in dept B whose assigned validator is Manager B — as long as she has any active delegation. The three preceding checks (MANAGE_ANY_LEAVES, exact validatorId match, APPROVE_LEAVES+service-scope) are all bypassed by this last fallback.

The `findValidatorForUser` docstring explicitly says a delegate found for manager B 'must never become the validator for dept A users', but `canValidate` does exactly that through this undiscriminating delegation query.

**Root cause:**
The `findFirst` query filters on `delegateId` only, omitting the join condition `delegatorId = leave.validatorId` that would scope the delegation to the leave's actual assigned validator.

**Code evidence:**
```
    // Vérifier les délégations actives
    const today = new Date();
    const activeDelegation =
      await this.prisma.leaveValidationDelegate.findFirst({
        where: {
          delegateId: validatorId,
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

    return activeDelegation !== null;
```

**Suggested fix:**
Add `delegatorId: leave.validatorId` to the where clause (requires the leave be fetched with its `validatorId`). If `leave.validatorId` is null (no validator assigned), the delegation fallback should return false. Example fix:
ʼʼʼts
if (leave.validatorId) {
  const activeDelegation = await this.prisma.leaveValidationDelegate.findFirst({
    where: {
      delegatorId: leave.validatorId,
      delegateId: validatorId,
      isActive: true,
      startDate: { lte: today },
      endDate: { gte: today },
    },
  });
  if (activeDelegation) return true;
}
return false;

**Acceptance criteria:**
1. A user with an active delegation from manager A cannot approve a leave whose validatorId is manager B
2. A user with an active delegation from the leave's validatorId can approve that leave
3. Existing tests for canValidate pass with the fix
4. Commit message includes `[closes COR-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
npx jest --testPathPattern leaves.service.spec --no-coverage 2>&1 | grep -E 'PASS|FAIL|canValidate'
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-001 ⇄ sessionA COR-010).
- Headline authz bypass. Code-verifiable; stays blocking (Phase 1). Cross-validated by sessionA COR-010.
- Related (same run): SEC-009.
- Audit note: The bug is in the else-branch after the service-scope check succeeds. The fix also aligns with the intent documented in `findValidatorForUser` (COR-005 comment at line 712-714). Adversarial check: both approve() and reject() gate solely on canValidate() with no additional delegation scoping. findValidatorForUser correctly scopes to department manager (delegatorId: managerId) but canValidate does not apply the same filter. Code verbatim confirmed at lines 1638-1650.

**Closed_by:** (empty — TODO)

---

### DAT-002 — TaskRACI.userId has no FK relation — orphaned RACI rows, no cascade on user deletion

- **Status:** TODO
- **Phase:** 1
- **Cluster:** I
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🔴 blocking
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing-foreign-key
- **File:** `packages/database/prisma/schema.prisma:405-417`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-002` · audit-confidence: high · found_by: data_integrity

**Description:**
TaskRACI stores a userId column and a composite unique constraint on (taskId, userId, role), but there is NO Prisma relation connecting userId to the User table. There is no `user User @relation(...)` in TaskRACI, and the User model (lines 56-97) has no back-relation to TaskRACI. This means: (1) PostgreSQL has no FK constraint on task_raci.user_id — the DB will happily accept a non-existent userId; (2) when a User is deleted, their RACI rows remain in the table as orphaned records with a dangling userId; (3) no onDelete behavior is enforced. Compare with TaskAssignee (lines 360-374) which correctly declares both `task Task @relation(...)` and `user User @relation(...)` with `onDelete: Cascade`.

**Root cause:**
The `user` relation side was omitted from TaskRACI when the model was created, leaving userId as a plain String with no FK backing.

**Code evidence:**
```
model TaskRACI {
  id        String   @id @default(uuid())
  taskId    String
  userId    String
  role      RACIRole
  createdAt DateTime @default(now())

  // Relations
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, role])
  @@map("task_raci")
}
```

**Suggested fix:**
Add the FK relation on TaskRACI and the back-relation on User:

// In model TaskRACI, add:
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

// In model User, add to the relations block:
  taskRaci TaskRACI[]

Then generate and apply a migration:
  pnpm run db:migrate

The migration will add a FK constraint `REFERENCES users(id)` on task_raci.user_id and a cascade delete trigger consistent with the TaskAssignee pattern.

**Acceptance criteria:**
1. Prisma schema validates without error after adding the relation
2. psql: `\d task_raci` shows a FK constraint on user_id REFERENCES users(id)
3. Deleting a user whose userId appears in task_raci removes those rows (or the FK constraint fires the intended behavior)
4. User.taskRaci back-relation is accessible from Prisma client queries
5. Commit message includes `[closes DAT-002]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_name LIKE '%task_raci%user%';"
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary DAT-002 ⇄ sessionA DAT-001).
- Related (same run): PER-036.
- Audit note: ADVERSARIAL REVIEW CONFIRMED. Verified in schema.prisma lines 405-417 verbatim. Init migration (20251116093059_init/migration.sql line 360) adds only task_raci_taskId_fkey, never a userId FK. No subsequent migration adds it. The User model relations block (lines 56-97) has no taskRaci back-relation. Crucially, users.service.ts hard-delete transaction (lines 948-969) lists taskAssignee.deleteMany but NOT taskRACI.deleteMany — RACI rows are silently orphaned on user deletion. Application layer validates user existence on RACI creation (tasks.service.ts line 1029-1035) but provides NO protection … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### COR-002 — importTasks: task created but subtasks written outside transaction — partial failure leaves orphaned task row

- **Status:** TODO
- **Phase:** 1
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔴 blocking
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · transaction-boundary
- **File:** `apps/api/src/tasks/tasks.service.ts:1451-1482`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-002` · audit-confidence: high · found_by: correctness

**Description:**
In importTasks(), each task is created with prisma.task.create() and then its subtasks are created in a sequential loop of individual prisma.subtask.create() calls. There is no wrapping $transaction. If any subtask creation fails (e.g. DB constraint violation, connection interruption), the parent task row already exists in the database and will NOT be rolled back. The outer catch only records the error in errorDetails and increments result.errors — the dangling task row with no subtasks remains committed. Additionally, the duplicate-title check at line 1389 is a read followed by a create (non-atomic), creating a TOCTOU race.

**Root cause:**
No database transaction wraps the task.create + subtask.create sequence, so failure between them leaves partially-written data.

**Code evidence:**
```
        const createdTask = await this.prisma.task.create({
          data: {
            title: taskData.title,
            ...
          },
        });

        // Créer les sous-tâches si présentes (séparées par |)
        if (taskData.subtasks) {
          ...
          for (let j = 0; j < subtaskTitles.length; j++) {
            await this.prisma.subtask.create({
              data: { title: subtaskTitles[j], taskId: createdTask.id, position: j },
            });
```

**Suggested fix:**
Wrap the entire per-task block (task.create + all subtask.create) in a prisma.$transaction(). Move the duplicate check inside the transaction using upsert semantics or rely on a DB unique constraint to avoid the TOCTOU gap.

**Acceptance criteria:**
1. If subtask creation throws, the parent task row is rolled back
2. Concurrent imports with the same title do not both succeed
3. Commit message includes `[closes COR-002]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'prisma.task.create\|prisma.subtask.create\|\$transaction' apps/api/src/tasks/tasks.service.ts | head -30
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: validateImport() (dry-run) does not have this issue as it does not write. Verified at lines 1451-1482: no $transaction wrapping.

**Closed_by:** (empty — TODO)

---

### COR-003 — findAll auto-expand writes telework rows for ALL users when a non-privileged caller supplies startDate+endDate without userId

- **Status:** TODO
- **Phase:** 1
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔴 blocking
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · scope-leak / privilege-escalation-by-side-effect
- **File:** `apps/api/src/telework/telework.service.ts:164-182`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-003` · audit-confidence: high · found_by: correctness

**Description:**
When a non-privileged user (lacking telework:readAll) calls GET /telework?startDate=X&endDate=Y, the read scope is correctly narrowed to `where.userId = currentUserId`. However, the subsequent `expandRecurringRulesForRange(startDate, endDate, userId)` call passes the DTO-level `userId` query param, not the enforced `currentUserId`. A CONTRIBUTEUR who omits `userId` from the query will send `filterUserId=undefined` into `expandRecurringRulesForRange`, which then materialises TeleworkSchedule rows for every user in the system whose active recurring rules overlap the date range. The caller only reads their own data afterwards, but the DB has been silently mutated for others. An attacker can enumerate all colleagues' telework days simply by calling the read endpoint.

**Root cause:**
The expansion call uses the raw `userId` query param instead of the already-scope-narrowed `where.userId`, so the side-effect bypasses the permission gate applied to the read.

**Code evidence:**
```
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    if (!permissions.includes('telework:readAll')) {
      where.userId = currentUserId;
    } else if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Auto-expand recurring rules into individual schedules for the requested range
    if (startDate && endDate) {
      await this.expandRecurringRulesForRange(startDate, endDate, userId);
    }
```

**Suggested fix:**
Pass the actually-enforced user scope to expandRecurringRulesForRange. Replace line 181 with:
  `await this.expandRecurringRulesForRange(startDate, endDate, where.userId as string | undefined);`
This ensures non-privileged calls expand only the authenticated user's rules, while admin calls with an explicit userId= filter expand that user's rules, and admin calls without a filter expand all (intended).

**Acceptance criteria:**
1. A CONTRIBUTEUR calling GET /telework?startDate=X&endDate=Y does not trigger creation of TeleworkSchedule rows for users other than themselves.
2. An ADMIN calling GET /telework?startDate=X&endDate=Y&userId=other-id expands only that other user's rules.
3. An ADMIN calling GET /telework?startDate=X&endDate=Y (no userId) still expands rules for all users.
4. Commit message includes `[closes COR-003]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'expandRecurringRulesForRange' apps/api/src/telework/telework.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): COR-032, COR-033.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED. Verbatim code verified at lines 164-182. The `expandRecurringRulesForRange` signature at line 292-295 shows `filterUserId?: string` — when undefined, the `ruleWhere.userId` filter is not applied (line 308: `if (filterUserId) { ruleWhere.userId = filterUserId; }`), causing all active rules to be expanded. No mitigating guard exists between the scope decision at line 167-171 and the expansion call at line 181. findForPlanningOverview (line 246) has the same pattern — see correctness-S6-2.

**Closed_by:** (empty — TODO)

---

### DAT-001 — audit_logs created with ON DELETE SET NULL — immutability trigger added 31 days later, leaving a window where audit rows could be silently mutated

- **Status:** TODO
- **Phase:** 1
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔴 blocking
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_immutability_gap
- **File:** `packages/database/prisma/migrations/20260424111457_add_weight_and_audit_log/migration.sql:24`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-001` · audit-confidence: high · found_by: data_integrity

**Description:**
At creation time (20260424), audit_logs.actorId FK is declared ON DELETE SET NULL. Any user deletion between migration 20260424111457 and the immutability trigger migration 20260525190000 (31 days later) silently issues an UPDATE on audit_logs rows, setting actorId to NULL. This mutates the audit record without triggering any protection. The schema comment and 20260525190000 migration both acknowledge that SET NULL on an immutable table is problematic — the FK was later changed to NO ACTION — but the 31-day window is unprotected. If any user was hard-deleted during that window in production, those audit rows were silently modified and the actor identity is permanently lost.

**Root cause:**
The immutability trigger and the FK ON DELETE behavior were designed together but deployed in two separate migrations 31 days apart, leaving the audit table mutable in the interim.

**Code evidence:**
```
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Suggested fix:**
Verify prod audit_logs for rows where actorId IS NULL and actorEmail (if added) is also NULL — these may be the result of the SET NULL window. Additionally, the original migration should have set ON DELETE RESTRICT or NO ACTION to protect immutability from the start. Document the window in a SECURITY_NOTE.

**Acceptance criteria:**
1. No audit_logs row has actorId=NULL unless the user was deleted AFTER 2026-05-25 (when actorEmail snapshot was also captured)
2. Future audit_logs FK additions always use ON DELETE NO ACTION or RESTRICT
3. Commit message includes `[closes DAT-001]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT COUNT(*) FROM audit_logs WHERE "actorId" IS NULL AND "createdAt" < '2026-05-25';
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): DAT-013, DAT-028.
- Audit note: Code evidence VERBATIM confirmed at line 24. The immutability trigger migration 20260525190000 lines 95-104 explicitly states 'A SetNull on user deletion issues an UPDATE on audit_logs that the immutability trigger (step 6) would reject', confirming this was a known design flaw fixed retroactively. Current schema is now protected (FK changed to NO ACTION), but historical impact is real and unrecoverable without a backup from the window period.

**Closed_by:** (empty — TODO)

---

## Phase 2 — Important — code-verifiable (by cluster)

### COR-007 — auth.service resetPassword(): token validity check and usedAt marking are not atomic — concurrent reset with the same token succeeds twice

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / missing-transaction
- **File:** `apps/api/src/auth/auth.service.ts:545-575`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-007` · audit-confidence: high · found_by: correctness

**Description:**
The token validity check (findUnique → check usedAt === null → check expiresAt) and the subsequent user.update() + passwordResetToken.update() are three separate non-transactional statements. Between the read (usedAt is null) and the write (usedAt gets set), a concurrent request with the same token passes the same checks and proceeds. Both requests update the user password; the second write wins. The token gets marked used by both, but both password hashes land — the last one written wins, which is non-deterministic under load.

**Root cause:**
Read-then-write on the token row is not wrapped in a transaction nor uses an atomic conditional UPDATE (UPDATE ... WHERE usedAt IS NULL RETURNING).

**Code evidence:**
```
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Token de réinitialisation invalide');
    }

    if (resetToken.usedAt !== null) {
      throw new UnauthorizedException(
        'Ce token de réinitialisation a déjà été utilisé',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Ce token de réinitialisation a expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { token: tokenHash },
      data: { usedAt: new Date() },
    });
```

**Suggested fix:**
Wrap the entire sequence in a $transaction with Serializable isolation. Alternatively, replace findUnique + conditional check with a single atomic UPDATE ... SET usedAt = NOW() WHERE token = $hash AND usedAt IS NULL AND expiresAt > NOW() RETURNING *; reject if 0 rows updated. The existing refresh-token rotate() uses the serializable-transaction pattern.

**Acceptance criteria:**
1. Two concurrent requests with the same valid token: exactly one succeeds, the other receives 401.
2. After successful reset, passwordResetToken.usedAt is non-null.
3. Commit message includes `[closes COR-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification via concurrent HTTP test or integration test with parallel requests.
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-007 ⇄ sessionA COR-003).
- Audit note: refresh-token.service.ts rotate() avoids this correctly by using { isolationLevel: 'Serializable' } transaction. Adversarial check: no $transaction exists anywhere in auth.service.ts. schema.prisma confirms token field is @unique but usedAt has no DB-level unique partial constraint — no DB guard prevents dual usedAt writes.

**Closed_by:** (empty — TODO)

---

### COR-040 — users.service update(): service-membership deleteMany+createMany execute outside the user.update() transaction — partial failure leaves the user with no services

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing-transaction / partial-failure
- **File:** `apps/api/src/users/users.service.ts:620-676`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-040` · audit-confidence: high · found_by: correctness

**Description:**
When a PATCH /users/:id includes serviceIds, the existing UserService rows are deleted and new ones inserted BEFORE the main user.update() call. These three operations run as separate, non-transactional statements. If user.update() subsequently fails (e.g., a ConflictException on email/login, or a DB constraint), the UserService rows have already been wiped but the user row is unchanged, leaving the user with zero service memberships and no error to the caller's state matching. Similarly, if createMany fails after deleteMany succeeds, the deletion is permanent.

**Root cause:**
Multi-write path (deleteMany + createMany + update) is not wrapped in a $transaction, violating ACID intent.

**Code evidence:**
```
    if (updateUserDto.serviceIds !== undefined) {
      await this.prisma.userService.deleteMany({
        where: { userId: id },
      });

      if (updateUserDto.serviceIds.length > 0) {
        await this.prisma.userService.createMany({
          data: updateUserDto.serviceIds.map((serviceId) => ({
            userId: id,
            serviceId,
          })),
        });
      }
    }

    const user = await this.prisma.user.update({
```

**Suggested fix:**
Wrap the entire update block in a $transaction: move deleteMany, createMany, and user.update() inside a single prisma.$transaction(async (tx) => { ... }) call. Reference: refresh-token.service.ts rotate() already uses this pattern correctly.

**Acceptance criteria:**
1. If user.update() throws a ConflictException, UserService rows are rolled back to their pre-call state.
2. No window exists where a user has zero services between deleteMany and createMany.
3. Commit message includes `[closes COR-040]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification; inject a failing roleCode after valid serviceIds in a test to confirm rollback.
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-040 ⇄ sessionA COR-002).
- Audit note: Compare with hardDelete() which correctly uses $transaction for all owned-data deletions. Adversarial check: only one $transaction exists in users.service.ts (line 948, in hardDelete()). Pre-validation of serviceIds (lines 599-606) and email/login (lines 543-588) happens before deleteMany, but a concurrent constraint violation or unexpected DB error in user.update() (line 635) after deleteMany has committed would leave the user with no services.

**Closed_by:** (empty — TODO)

---

### COR-019 — personal-todos.service.ts create() has TOCTOU race on the 20-todo limit

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · toctou-count-limit
- **File:** `apps/api/src/personal-todos/personal-todos.service.ts:31-47`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-019` · audit-confidence: high · found_by: correctness

**Description:**
The 20-todo limit is enforced by reading the count and then creating. There is no DB-level constraint capping the count per user, and no transaction around the count+create pair. Two concurrent requests for the same user can both read count=19 (or any value < 20), both pass the guard, and both successfully create a new todo, leaving the user with 21 todos. This violates the stated business invariant documented in CLAUDE.md ('Personal Todos: hard-coded 20-item limit').

**Root cause:**
The count-then-create pattern is inherently non-atomic in a concurrent environment without a transaction or a DB-level constraint to enforce the limit.

**Code evidence:**
```
  async create(userId: string, dto: CreatePersonalTodoDto) {
    // Vérifier la limite de 20 todos
    const count = await this.prisma.personalTodo.count({
      where: { userId },
    });

    if (count >= MAX_TODOS) {
      throw new BadRequestException(`Limite de ${MAX_TODOS} to-dos atteinte`);
    }

    return this.prisma.personalTodo.create({
      data: {
        userId,
        text: dto.text,
      },
    });
  }
```

**Suggested fix:**
Wrap the count+create in a `prisma.$transaction()` with serializable isolation, or use a DB-level `CHECK` constraint or trigger, or at minimum accept that occasional over-limit is acceptable (nit) and document it. Minimal fix:
ʼʼʼtypescript
await this.prisma.$transaction(async (tx) => {
  const count = await tx.personalTodo.count({ where: { userId } });
  if (count >= MAX_TODOS) throw new BadRequestException(...);
  return tx.personalTodo.create({ data: { userId, text: dto.text } });
});
ʼʼʼ
Note: Prisma default transactions use read-committed; for a true count lock you need a SELECT FOR UPDATE or a raw query. Alternatively add a unique partial index or trigger in Postgres.

**Acceptance criteria:**
1. Concurrent double-submit for the same user does not result in more than 20 todos
2. The 21st todo attempt returns HTTP 400 even under concurrent load
3. Commit message includes `[closes COR-019]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '\$transaction\|count\|MAX_TODOS' apps/api/src/personal-todos/personal-todos.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-019 ⇄ sessionA COR-005).
- Audit note: CLAUDE.md explicitly states 'Personal Todos: hard-coded 20-item limit'. The findByUser() cleanup (cleanupOldCompleted) runs before the count check, which at least reduces the window, but does not close it. Adversarial check: code at lines 31-47 matches exactly; no DB CHECK constraint found in schema.prisma for PersonalTodo count per user; no $transaction wrapping confirmed absent.

**Closed_by:** (empty — TODO)

---

### PER-001 — analytics.service `getTasks` fetches all Task columns with no `select` projection — over-fetching on large task sets

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · over-fetching
- **File:** `apps/api/src/analytics/analytics.service.ts:223-236`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-001` · audit-confidence: high · found_by: performance

**Description:**
The private `getTasks` method fetches all columns of every Task row in the user's project scope. The returned `Task[]` is subsequently used only for: (a) `tasks.length` (total count), (b) `tasks.filter(t => t.status === 'DONE').length` (completed count), (c) `tasks.filter(t => t.endDate && ...)` (overdue count), and (d) `tasks.filter(t => t.projectId === project.id)` in `getProjectDetails`. Only `status`, `endDate`, and `projectId` are needed — yet all columns (including potentially large text fields like description) are transferred from DB.

**Root cause:**
Missing `select: { id: true, status: true, endDate: true, projectId: true }` on the `findMany` call.

**Code evidence:**
```
  private async getTasks(
    projectId: string | undefined,
    projectWhere: Prisma.ProjectWhereInput,
  ): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = {
      project: projectWhere,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    return this.prisma.task.findMany({ where });
  }
```

**Suggested fix:**
Add `select: { id: true, status: true, endDate: true, projectId: true }` to the `findMany` call and update the return type from `Task[]` to the projected interface. Note that the `taskStatusGroupBy` introduced at line 114 already covers the status-count use cases — `getTasks` may actually be redundant for metrics and could be removed entirely, delegating all status aggregation to `taskStatusGroupBy`.

**Acceptance criteria:**
1. getTasks uses a `select` projection with only required columns
2. Analytics response is identical before and after the fix
3. DB query EXPLAIN shows fewer transferred bytes
4. Commit message includes `[closes PER-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findMany\|select\|Task\[\]' apps/api/src/analytics/analytics.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-001 ⇄ sessionA PERF-010).
- Audit note: The `taskStatusGroupBy` at line 114 was added as PER-025 to avoid O(P×T) JS filters — but `getTasks` is still called and its result used in `getProjectDetails` (tasks per project count, completed count). The groupBy result already covers this; getTasks could be eliminated. Verified verbatim: `return this.prisma.task.findMany({ where });` at line 235 — no select clause.

**Closed_by:** (empty — TODO)

---

### PER-016 — getProjectStats fetches all tasks and all members without select projection on members

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/api/src/projects/projects.service.ts:1276-1288`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-016` · audit-confidence: high · found_by: performance

**Description:**
`getProjectStats` includes `members: true` (no select clause), which returns ALL columns of ALL ProjectMember rows. The only field consumed is `project.members.length` (line 1371). Additionally, `tasks` is fetched unbounded (no `take` limit) to compute statistics. For a project with 1000 tasks and 50 members this transfers the full member records (allocation, startDate, endDate, role string) unnecessarily.

**Root cause:**
`members: true` was used as a convenience; only the count is needed. `tasks` is also over-fetched since only counts per-status and sum of hours are needed.

**Code evidence:**
```
        tasks: {
          select: {
            id: true,
            status: true,
            estimatedHours: true,
            priority: true,
          },
        },
        members: true,
        epics: {
          select: {
            progress: true,
          },
        },
```

**Suggested fix:**
Replace `members: true` with `_count: { select: { members: true } }` and use `project._count.members`. Replace the tasks include with a `task.groupBy` + a separate `task.aggregate` for `_sum: { estimatedHours: true }`, and fetch actual hours from `timeEntry.aggregate` with `_sum: { hours: true }` using the task IDs filter.

**Acceptance criteria:**
1. GET /projects/:id/stats does not return member data in the Prisma query response
2. Response payload and computed values are identical before and after the fix
3. Commit message includes `[closes PER-016]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-016 ⇄ sessionA PERF-016).
- Audit note: Confirmed: `members: true` at line 1276, used only for `.length` at line 1371. Tasks array unbounded.

**Closed_by:** (empty — TODO)

---

### PER-021 — getTasksByAssignee and getTasksByProject have no pagination — unbounded findMany

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/tasks/tasks.service.ts:1133-1182`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-021` · audit-confidence: high · found_by: performance

**Description:**
Both `getTasksByAssignee` (line 1133) and `getTasksByProject` (line 1240) call `findMany` with no `take` parameter. For a user assigned to hundreds of tasks, or a large project, all matching rows are returned in a single DB query plus all their includes (project, assignee, assignees+users, timeEntries, dependencies, subtasks). There is no pagination wrapper, no total count, and no hard cap.

**Root cause:**
Missing `take` and `skip` arguments on both unbounded `findMany` calls; no pagination DTO accepted by these methods.

**Code evidence:**
```
    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [{ assigneeId: userId }, { assignees: { some: { userId } } }],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
```

**Suggested fix:**
Add `take: 200` (or accept `page/limit` params) and return paginated meta. For `getTasksByProject` add a hard cap of e.g. 500 with a cursor or page param. Example: `take: Math.min(limit ?? 100, 500), skip: (page - 1) * take`.

**Acceptance criteria:**
1. GET /tasks/assignee/:userId returns at most N rows (configurable, default ≤100)
2. GET /tasks/project/:projectId returns at most N rows and exposes meta.total
3. Commit message includes `[closes PER-021]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-021 ⇄ sessionA PERF-003, sessionA PERF-004).

**Closed_by:** (empty — TODO)

---

### PER-022 — getMyDoneUndeclaredTasks: unbounded findMany with NOT EXISTS subquery — full table scan risk

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/tasks/tasks.service.ts:1198-1221`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-022` · audit-confidence: high · found_by: performance

**Description:**
No `take` limit on this query. The `NOT: { timeEntries: { some: { userId } } }` clause forces a NOT EXISTS correlated subquery against `time_entries` for every matched task. With tasks indexed on `assigneeId` and `status`, the outer scan is bounded, but the correlated NOT EXISTS runs a subquery per matched task row. No pagination is applied — all matching DONE tasks are returned at once.

**Root cause:**
Missing `take` limit and the NOT EXISTS correlated subquery may cause per-row subquery evaluation in older PostgreSQL planner versions.

**Code evidence:**
```
    return this.prisma.task.findMany({
      where: {
        AND: [
          { status: 'DONE' },
          { OR: [{ assigneeId: userId }, { assignees: { some: { userId } } }] },
          { NOT: { timeEntries: { some: { userId } } } },
        ],
      },
```

**Suggested fix:**
Add `take: 50` (or similar cap). For the NOT EXISTS pattern consider an alternative: LEFT JOIN time_entries on userId and filter WHERE te.id IS NULL, or use `findMany` with cursor pagination.

**Acceptance criteria:**
1. GET /tasks/my/done-undeclared returns at most 50 items per request
2. Commit message includes `[closes PER-022]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-022 ⇄ sessionA PERF-006).

**Closed_by:** (empty — TODO)

---

### PER-025 — findOrphans: unbounded findMany on tasks with projectId IS NULL — no pagination

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/tasks/tasks.service.ts:1733-1773`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-025` · audit-confidence: high · found_by: performance

**Description:**
The `findOrphans` method returns all orphan tasks (projectId IS NULL) with no take/limit. The orphan set is unbounded; a government instance with many unattached tasks (meetings, cross-cutting work) could return thousands of rows with includes.

**Root cause:**
No `take` argument on the `findMany` call.

**Code evidence:**
```
    return this.prisma.task.findMany({
      where: {
        projectId: null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
```

**Suggested fix:**
Accept `page` and `limit` query params and apply `take/skip`, or add a hard cap (e.g. `take: 200`).

**Acceptance criteria:**
1. GET /tasks/orphans returns at most 200 rows or is paginated
2. Commit message includes `[closes PER-025]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-025 ⇄ sessionA PERF-005).
- Audit note: CLAUDE.md explicitly notes 'Tasks without a project = intentional (meetings, cross-cutting work)' — so the orphan set is a first-class concern and can grow large.

**Closed_by:** (empty — TODO)

---

### PER-007 — importLeaves: getHolidayKeySet + findValidatorForUser called per row inside transaction loop

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1
- **File:** `apps/api/src/leaves/leaves.service.ts:3558-3575`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-007` · audit-confidence: high · found_by: performance

**Description:**
Inside the `importLeaves` transaction loop (one iteration per CSV row), two multi-query DB operations are called per row: (1) `getHolidayKeySet` issues a `holiday.findMany` for each row's date range; (2) `findValidatorForUser` issues 1–3 queries (user + delegate lookup + possible role fallback) per user. For a 100-row CSV, this means 100+ holiday queries and up to 300+ validator queries — all serialised inside a single long-running Postgres transaction. The comment on line 3558 acknowledges this as 'lecture par ligne' but frames it as acceptable for 'volume d'import modéré', which is not enforced.

**Root cause:**
No pre-computation of the holiday set covering the entire CSV span before the loop, and no memoisation of validator lookups per userId across rows.

**Code evidence:**
```
          // COR-003 — soustraire les jours fériés non travaillés, comme la
          // création standard. Lecture par ligne (volume d'import modéré).
          const importHolidayKeys = await this.getHolidayKeySet(
            startDate,
            endDate,
          );
          const days = calculateLeaveDays(
            startDate,
            endDate,
            halfDay,
            undefined,
            importHolidayKeys,
          );

          // Trouver le validateur approprié
          const validatorId = leaveType.requiresApproval
            ? await this.findValidatorForUser(user.id)
            : null;
```

**Suggested fix:**
1. Compute a single holiday key set covering `min(startDate)..max(endDate)` of the entire CSV once before the loop (already done for the span filter — extend it to the holiday pre-fetch). 2. Memoize `findValidatorForUser` per userId: `const validatorCache = new Map<string, string|null>()` and call `findValidatorForUser` only on the first occurrence of each userId. 3. Consider enforcing a CSV row limit (e.g. 500) in the DTO.

**Acceptance criteria:**
1. A 100-row CSV triggers at most 1 `holiday.findMany` call total (not 100)
2. A 100-row CSV with 10 distinct users triggers at most 10 `findValidatorForUser` calls (not 100)
3. Commit message includes `[closes PER-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-007 ⇄ sessionA COR-007).
- Audit note: Code evidence verified verbatim at lines 3558-3575. The comment 'Lecture par ligne (volume d'import modéré)' explicitly acknowledges the pattern without enforcing a row cap. The CSV import DTO has no @Max() on the array length.

**Closed_by:** (empty — TODO)

---

### PER-023 — checkCircularDependency: one DB query per BFS node — potential N+1 for deep dependency graphs

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/tasks/tasks.service.ts:1303-1333`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-023` · audit-confidence: high · found_by: performance

**Description:**
The BFS loop issues one `taskDependency.findMany` per visited node. For a task graph with depth D and branching factor B, this is O(B^D) sequential DB queries in the worst case. There is no depth limit or node count limit. A malicious or accidentally deep dependency chain triggers one DB query per level.

**Root cause:**
BFS graph traversal with one query per visited node instead of a single recursive CTE or a bulk pre-fetch of the full dependency sub-graph.

**Code evidence:**
```
    while (queue.length > 0) {
      const currentTaskId = queue.shift()!;

      if (visited.has(currentTaskId)) {
        continue;
      }

      visited.add(currentTaskId);

      if (currentTaskId === targetTaskId) {
        return true; // Dépendance circulaire détectée
      }

      const dependencies = await this.prisma.taskDependency.findMany({
        where: { taskId: currentTaskId },
        select: { dependsOnTaskId: true },
      });

      queue.push(...dependencies.map((d) => d.dependsOnTaskId));
```

**Suggested fix:**
Option A (preferred): Use a PostgreSQL recursive CTE via `prisma.$queryRaw` to fetch the full reachable set in one query. Option B: Pre-fetch all `taskDependency` rows for the project in one query and run BFS entirely in memory. Add a max-depth guard of e.g. 20 hops before starting the BFS.

**Acceptance criteria:**
1. addDependency on a chain of 50 tasks issues at most 1 DB query for cycle detection
2. Cycle detection is capped at a defined max depth (e.g. 20 hops)
3. Commit message includes `[closes PER-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-023 ⇄ sessionA PERF-009).

**Closed_by:** (empty — TODO)

---

### PER-024 — importTasks: sequential await inside for-loop — N DB round trips for task creation + M subtask inserts

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/tasks/tasks.service.ts:1383-1481`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-024` · audit-confidence: high · found_by: performance

**Description:**
Inside the `for (let i = 0; i < tasks.length; i++)` loop: (1) one `findFirst` per task to check for duplicate title (N queries), (2) one `task.create` per task (N queries), (3) for each task with subtasks, one `subtask.create` per subtask (M queries total). There is no DTO-level array size limit for the import payload. With 100 tasks each having 5 subtasks, this is 100 + 100 + 500 = 700 sequential DB round trips within one HTTP request.

**Root cause:**
No batching: each loop iteration awaits individual Prisma calls instead of collecting and using `createMany` / batch transactions.

**Code evidence:**
```
      try {
        // Vérifier que le titre n'existe pas déjà dans le projet
        const existingTask = await this.prisma.task.findFirst({
          where: {
            projectId,
            title: taskData.title,
          },
        });

        if (existingTask) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Tâche "${taskData.title}" existe déjà`,
          );
          continue;
        }
```

**Suggested fix:**
1. Pre-fetch all existing titles for the project in one query before the loop: `findMany({ where: { projectId }, select: { title: true } })`. 2. Use `prisma.task.createMany` for bulk insert (note: no nested relations, so subtasks need a separate `createMany`). 3. Add `@Max()` validation on `ImportTasksDto.tasks` array (e.g. max 500 items). 4. Wrap in a single transaction.

**Acceptance criteria:**
1. POST /tasks/project/:id/import with 100 tasks completes in < 500ms
2. Import payload of > 500 tasks is rejected with 400
3. Duplicate detection uses a pre-fetched Set, not per-row findFirst
4. Commit message includes `[closes PER-024]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-024 ⇄ sessionA PERF-007).
- Audit note: validateImport correctly pre-fetches existingTasks in one query (line 1558) — importTasks should mirror that pattern. Confirmed: ImportTasksDto has no @ArrayMaxSize. The 1 MiB bodyLimit (SEC-025) provides some protection but does not eliminate the N+1 pattern.

**Closed_by:** (empty — TODO)

---

### PER-030 — importUsers executes N sequential DB round-trips (findFirst + bcrypt + create) per row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n+1-query
- **File:** `apps/api/src/users/users.service.ts:1301-1446`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-030` · audit-confidence: high · found_by: performance

**Description:**
For every row in the import array the loop performs: (1) a `user.findFirst` duplicate check, (2) a `bcrypt.hash` (cost 12, ~200-400ms), (3) a `user.create`, (4) optionally a `userService.createMany`. For a 100-row import this is 100 sequential bcrypt hashes (20-40s total CPU) plus 200-300 sequential Prisma round-trips over a single HTTP request. There is no batch size limit on the import DTO.

**Root cause:**
The import loop is fully sequential (`await` inside a `for` loop) and performs per-row duplicate checking instead of a pre-flight bulk check. No batch ceiling on the input array.

**Code evidence:**
```
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      const rowNum = i + 2;

      try {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            // DAT-015: case-insensitive lookup
            OR: [
              { email: { equals: userData.email, mode: 'insensitive' } },
              { login: { equals: userData.login, mode: 'insensitive' } },
            ],
          },
        });
```

**Suggested fix:**
Pre-flight: batch-resolve all duplicate emails/logins with a single `findMany({ where: { OR: [{ email: { in: emails } }, { login: { in: logins } }] } })` before the loop. Move bcrypt hashing to a worker thread pool (piscina / worker_threads) or reduce the cost factor for bulk operations. Add a `@Max(100)` constraint on `ImportUsersDto.users`. Use `createMany` for the non-duplicate rows.

**Acceptance criteria:**
1. POST /users/import with 100 rows completes in < 15s
2. POST /users/import with > 100 rows returns 400
3. Duplicate detection still works correctly after the batching refactor
4. Commit message includes `[closes PER-030]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-030 ⇄ sessionA PERF-008).
- Audit note: The validateImport method (line 1454) wisely pre-fetches all existing users at once (line 1479-1481); the same pattern should be applied to importUsers. ImportUsersDto.users has no @Max constraint — batch size is truly unbounded.

**Closed_by:** (empty — TODO)

---

### SEC-003 — LoginDto.password has no @MaxLength — long password input allows DoS via bcrypt CPU exhaustion

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/auth/dto/login.dto.ts:13-19`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-003` · audit-confidence: medium · found_by: security

**Description:**
The LoginDto's password field only enforces @IsString and @MinLength(6). There is no @MaxLength. bcrypt is deliberately CPU-intensive: hashing or comparing a very long string (e.g. 10 KB) can consume hundreds of milliseconds. Even with the @Throttle limit (5/min per IP) an attacker can send 5 requests per minute each with a 1 MB password body, generating significant CPU load. The per-IP throttle mitigates rate but not payload size. Many bcrypt libraries also truncate at 72 bytes, but the comparison still iterates on the full input up to that truncation in some implementations, and the server reads and deserialises the full body. NestJS's ValidationPipe does not cap body size by itself; a separate global limit should exist, but DTO-level MaxLength is the defense-in-depth layer at the validation gate.

**Root cause:**
LoginDto was never given a @MaxLength on password, and the global throttle was treated as the sole guard against credential-stuffing DoS.

**Code evidence:**
```
  @ApiProperty({
    description: 'Mot de passe',
    example: 'admin123',
  })
  @IsString()
  @MinLength(6)
  password: string;
```

**Suggested fix:**
Add @MaxLength(1024) to LoginDto.password (and optionally @MaxLength(254) to login, matching the NIST recommendation). Also confirm that Fastify's bodyLimit is set to a reasonable value (e.g. 1 MB) in main.ts to cap the raw body size before DTO validation.

**Acceptance criteria:**
1. POST /auth/login with a password longer than 1024 characters returns 400 Bad Request.
2. Login with a valid <= 1024 char password still succeeds.
3. Commit message includes `[closes SEC-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength\|bodyLimit' apps/api/src/auth/dto/login.dto.ts apps/api/src/main.ts 2>/dev/null | head -20
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-003 ⇄ sessionA SEC-003).
- Audit note: Adversarial check: main.ts line 96-98 sets bodyLimit=1048576 (1 MiB, SEC-025) which provides an outer bound — a single request body cannot exceed 1 MB. However, a 1 MB password still represents ~14,000 characters feeding into bcrypt. The DTO-level MaxLength is still absent and the defense-in-depth gap is real. Confidence downgraded from high to medium because the 1 MiB body limit substantially mitigates the worst-case payload size.

**Closed_by:** (empty — TODO)

---

### SEC-005 — CreateCommentDto.content and UpdateCommentDto.content lack @MaxLength — unbounded free-text field

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/comments/dto/create-comment.dto.ts:9-11`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-005` · audit-confidence: high · found_by: security

**Description:**
The `content` field in both CreateCommentDto and UpdateCommentDto is validated with @IsString() and @IsNotEmpty() but has no @MaxLength constraint. An authenticated user with `comments:create` can POST an arbitrarily large string, consuming DB storage (TEXT column is unlimited in PostgreSQL), and potentially triggering DoS-class conditions in any downstream code that copies or logs the content. The UpdateCommentDto (line 7-9 in update-comment.dto.ts) has the same issue.

**Root cause:**
Free-text fields that accept arbitrary user input were not capped at definition time.

**Code evidence:**
```
  @IsString()
  @IsNotEmpty()
  content: string;
```

**Suggested fix:**
Add `@MaxLength(10000)` (or an appropriate domain limit) to `content` in both CreateCommentDto and UpdateCommentDto. Example: `@MaxLength(10000, { message: 'Comment content cannot exceed 10 000 characters' })`.

**Acceptance criteria:**
1. POST /comments with content longer than the limit returns HTTP 400
2. PATCH /comments/:id with content longer than the limit returns HTTP 400
3. Commit message includes `[closes SEC-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X POST http://localhost:3000/api/comments -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"content":"'$(python3 -c 'print("A"*20001)')'" ,"taskId":"<uuid>"}' | jq .statusCode
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-005 ⇄ sessionA SEC-005).
- Audit note: Adversarial review: verbatim code confirmed in create-comment.dto.ts lines 9-11 and update-comment.dto.ts lines 6-8. No @MaxLength present anywhere in either file. 1 MiB body limit in main.ts (SEC-025) provides a coarse cap but a single 1 MiB comment is still excessive. Same pattern exists for CreateTaskDto.description (no @MaxLength), ImportTaskDto.description and .title, CreatePredefinedTaskDto.name/description/color/icon, CreateSubtaskDto.description — all lack @MaxLength. This finding focuses on the comment vector as the most reachable by low-privilege users.

**Closed_by:** (empty — TODO)

---

### SEC-019 — CreateTaskDto.tags field has no @IsArray / @IsString({ each }) / @MaxLength validators — arbitrary data injection

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/tasks/dto/create-task.dto.ts:223-224`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-019` · audit-confidence: medium · found_by: security

**Description:**
The `tags` field is declared as `string[]` but the only decorator is `@IsOptional()`. The global ValidationPipe runs with `whitelist:true` + `forbidNonWhitelisted:true` + `transform:true`, so the field is whitelisted. However, without `@IsArray()` + `@IsString({ each: true })` + `@MaxLength(N, { each: true })` + `@ArrayMaxSize(N)`, a caller can submit an array of arbitrary objects, non-string elements, or extremely large arrays/strings. Prisma will store whatever TypeScript receives after transformation, which may include arbitrary nested data depending on how `tags` is typed in the Prisma schema.

**Root cause:**
The `tags` field was added to the DTO without completing the class-validator decorator set required for array-of-strings validation.

**Code evidence:**
```
  @IsOptional()
  tags?: string[];
```

**Suggested fix:**
Add the full decorator chain:
ʼʼʼts
@IsOptional()
@IsArray()
@ArrayMaxSize(20)
@IsString({ each: true })
@MaxLength(100, { each: true })
tags?: string[];
ʼʼʼ

**Acceptance criteria:**
1. POST /tasks with tags: [1, 2, 3] (non-strings) returns HTTP 400
2. POST /tasks with tags: [{evil: true}] returns HTTP 400
3. POST /tasks with tags containing 21 elements returns HTTP 400
4. Commit message includes `[closes SEC-019]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X POST http://localhost:3000/api/tasks -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"title":"t","tags":[1,2,3]}' | jq .statusCode
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-019 ⇄ sessionA SEC-007).
- Audit note: Adversarial review: code evidence verbatim confirmed. HOWEVER: `tags` has no corresponding column in the Prisma Task model (schema.prisma lines 313-357 confirmed). The `...taskData` spread in tasks.service.ts:225 would include `tags`, but Prisma 6 would either throw a type error at compile time or silently ignore the unknown field at runtime. The stored XSS impact claim is therefore invalid as-is — data cannot be persisted. The finding is downgraded from high to medium confidence: the missing validators are a real gap that will matter the moment a `tags String[]` column is added to the schema, … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### OBS-016 — POST /users/import bulk-creates users with no audit row per created user

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-user-import
- **File:** `apps/api/src/users/users.service.ts:1400-1437`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-016` · audit-confidence: high · found_by: observability

**Description:**
In `importUsers()`, each successfully created user triggers a `prisma.user.create()` call inside a per-row try/catch loop. No `auditPersistence.log()` or `auditService.log()` is called for any created user. A bulk import of N users leaves N user provisioning events entirely untracked in the audit trail.

**Root cause:**
The import path was written independently of the single-user create path and inherited the same missing audit instrumentation.

**Code evidence:**
```
        const user = await this.prisma.user.create({
          data: {
            email: userData.email,
            login: userData.login,
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            roleId,
            departmentId,
            isActive: true,
          },
```

**Suggested fix:**
After each successful `prisma.user.create()` in the import loop, emit `auditPersistence.log({ action: AuditAction.USER_CREATED, entityType: 'User', entityId: user.id, actorId: callerRoleCode !== undefined ? ..., payload: { importedRow: i+1, roleId: user.roleId } })`. A batch-level summary audit row (action: SYSTEM_BACKFILL or a dedicated USERS_IMPORTED) would also be acceptable and less verbose.

**Acceptance criteria:**
1. After POST /users/import, at least one audit_logs row exists per created user referencing the action and the new user id
2. Commit message includes `[closes OBS-016]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'auditPersistence\|auditService\|AuditAction' apps/api/src/users/users.service.ts | grep -A2 -B2 '1400\|1430'
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary OBS-016 ⇄ sessionA OBS-002).
- Audit note: Verified: lines 1400-1437 confirmed verbatim. Grep of entire users.service.ts confirms no audit call between lines 1398-1448. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-017 — POST /users (admin-side user creation) emits no audit row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-user-create
- **File:** `apps/api/src/users/users.service.ts:153-219`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-017` · audit-confidence: high · found_by: observability

**Description:**
After the `prisma.user.create()` call in `UsersService.create()`, no `auditPersistence.log()` or `auditService.log()` is invoked. Self-registration via `/auth/register` does emit a `REGISTER` audit, but the admin-side POST /users creation (which creates an immediately-active account) generates no audit entry. This means account provisioning by administrators is invisible in the audit trail.

**Root cause:**
The `create()` method never received an audit emit, while the focus was on update (role change, deactivation, service membership) and delete paths.

**Code evidence:**
```
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        login: createUserDto.login,
        passwordHash,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        roleId,
        departmentId: createUserDto.departmentId,
        avatarUrl: createUserDto.avatarUrl,
        // SEC-011 — isActive is server-controlled on create (Model A: admins
        // create active users). The CreateUserDto no longer carries this field,
        // so the value is never caller-supplied. State changes go through the
        // UPDATE path, which audits USER_DEACTIVATED / USER_REACTIVATED.
        isActive: true,
      },
```

**Suggested fix:**
Add `USER_CREATED = 'USER_CREATED'` to AuditAction (and to ENTITY_TYPE_BY_ACTION). After the `prisma.user.create()` and the optional `userService.createMany()`, emit: `await this.auditPersistence.log({ action: AuditAction.USER_CREATED, entityType: 'User', entityId: user.id, actorId: caller?.id ?? null, payload: { after: { roleId: user.roleId, departmentId: user.departmentId, isActive: user.isActive } } })`. The caller id should be threaded from the controller.

**Acceptance criteria:**
1. A durable audit_logs row with action='USER_CREATED' appears after POST /users
2. The actorId field is the creating admin's id
3. Commit message includes `[closes OBS-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'USER_CREATED\|auditPersistence\|auditService' apps/api/src/users/users.service.ts | head -20
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary OBS-017 ⇄ sessionA OBS-001).
- Audit note: Verified: grep of all audit calls in users.service.ts shows the first audit emission is at line 683 (update path). Lines 140-220 (create()) contain zero audit calls. USER_CREATED absent from audit-action.enum.ts. No global interceptor. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### PER-035 — TaskDependency.dependsOnTaskId has no index — reverse dependency lookups in checkCircularDependency are slow

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing index
- **File:** `packages/database/prisma/schema.prisma:391-403`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-035` · audit-confidence: high · found_by: performance

**Description:**
The `TaskDependency` model has a composite unique on `(taskId, dependsOnTaskId)` which gives a forward index on `taskId` (leading column). However there is no index on `dependsOnTaskId` alone. The `tasks.service.ts findOne` includes `dependents: { include: { task: ... } }` which executes a lookup by `dependsOnTaskId`. Without an index, this is a seq-scan on `task_dependencies` filtered by `dependsOnTaskId`.

**Root cause:**
The reverse FK column `dependsOnTaskId` is not covered by any index (the unique only has `taskId` as leading column).

**Code evidence:**
```
model TaskDependency {
  id              String   @id @default(uuid())
  taskId          String
  dependsOnTaskId String
  createdAt       DateTime @default(now())

  // Relations
  task          Task @relation("TaskDependencies", fields: [taskId], references: [id], onDelete: Cascade)
  dependsOnTask Task @relation("DependentTasks", fields: [dependsOnTaskId], references: [id], onDelete: Cascade)

  @@unique([taskId, dependsOnTaskId])
  @@map("task_dependencies")
}
```

**Suggested fix:**
Add to schema.prisma: `@@index([dependsOnTaskId]) // reverse dependency lookup`

**Acceptance criteria:**
1. EXPLAIN on `SELECT * FROM task_dependencies WHERE depends_on_task_id = $1` shows Index Scan, not Seq Scan
2. Migration is generated: `CREATE INDEX task_dependencies_depends_on_task_id_idx ON task_dependencies (depends_on_task_id)`
3. Commit message includes `[closes PER-035]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
docker exec orchestr-a-db psql -U postgres -d orchestra -c "EXPLAIN SELECT * FROM task_dependencies WHERE depends_on_task_id = 'test';"
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-035 ⇄ sessionA PERF-020).

**Closed_by:** (empty — TODO)

---

### PER-036 — TaskRACI has no index on userId — per-user RACI lookups require seq-scan

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing index
- **File:** `packages/database/prisma/schema.prisma:405-417`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-036` · audit-confidence: low · found_by: performance

**Description:**
The `TaskRACI` model has only a composite unique on `(taskId, userId, role)`. The `taskId`-leading unique covers per-task lookups. However, there is no index on `userId` alone. Any query filtering RACI entries by `userId` (e.g. 'all tasks where user X is Accountable') requires a full table scan. Although the current codebase doesn't expose such a direct query, the `findOne` task detail page does include `raci: { select: { id, userId, role, createdAt } }` without a userId filter.

**Root cause:**
Missing `@@index([userId])` on `TaskRACI` — the reverse FK on `userId` is not covered by any index (the unique has `taskId` as leading column).

**Code evidence:**
```
model TaskRACI {
  id        String   @id @default(uuid())
  taskId    String
  userId    String
  role      RACIRole
  createdAt DateTime @default(now())

  // Relations
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, role])
  @@map("task_raci")
}
```

**Suggested fix:**
Add `@@index([userId]) // DAT-011: FK without auto-index` to the TaskRACI model.

**Acceptance criteria:**
1. EXPLAIN SELECT * FROM task_raci WHERE user_id = $1 shows Index Scan
2. Migration generates: CREATE INDEX task_raci_user_id_idx ON task_raci (user_id)
3. Commit message includes `[closes PER-036]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
docker exec orchestr-a-db psql -U postgres -d orchestra -c "EXPLAIN SELECT * FROM task_raci WHERE user_id = 'test';"
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-036 ⇄ sessionA PERF-021).
- Audit note: DOWNGRADED from medium to low. The cascade-delete rationale is incorrect: TaskRACI.userId has no Prisma FK relation to User (only to Task). No cascade trigger from User deletion will hit task_raci via a DB FK. The index would only help if a userId-only query is ever issued, which the current service layer does not do. Real impact is limited to hypothetical future queries.

**Closed_by:** (empty — TODO)

---

### COR-016 — getLeaveBalance uses new Date().getFullYear() (host-TZ) while balance windows use Paris-anchored parisYearWindow — mismatch on Jan 1 between 00:00 and 01:00 Paris time

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · tz_naive_year_computation
- **File:** `apps/api/src/leaves/leaves.service.ts:2635`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-016` · audit-confidence: medium · found_by: correctness

**Description:**
The leave balance system is explicitly anchored to Europe/Paris calendar year boundaries via `parisYearWindow` (which uses `fromZonedTime('${year}-01-01 00:00:00', 'Europe/Paris')`). However, `getLeaveBalance` computes `currentYear` using `new Date().getFullYear()`, which returns the year in the API process's local timezone (UTC when deployed on standard Linux containers). Between 2025-12-31 23:00 UTC and 2026-01-01 00:00 UTC (Paris midnight is at 23:00 UTC in winter, UTC+1), `getFullYear()` returns 2025 (UTC) but a Paris employee is already in 2026 (Paris time). The balance query then fetches 2025 allocations while the Paris employee expects their 2026 balance.

**Root cause:**
`new Date().getFullYear()` is UTC-based on most Linux deployments, while Paris year boundaries start one hour before UTC midnight in winter.

**Code evidence:**
```
    const currentYear = new Date().getFullYear();
```

**Suggested fix:**
Use `formatInTimeZone(new Date(), LEAVE_TIMEZONE, 'yyyy')` from `date-fns-tz` (already imported in `leave-year-window.ts`) to compute the Paris year:
ʼʼʼts
import { formatInTimeZone } from 'date-fns-tz';
import { LEAVE_TIMEZONE } from './leave-year-window';
const currentYear = parseInt(formatInTimeZone(new Date(), LEAVE_TIMEZONE, 'yyyy'), 10);
ʼʼʼ

**Acceptance criteria:**
1. At 2026-12-31T23:30:00Z (23:30 UTC = 00:30 Paris on Jan 1 2027), getLeaveBalance returns 2027 as the year (Paris is already in 2027)
2. Integration test for this boundary passes
3. Commit message includes `[closes COR-016]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: mock Date to 2026-12-31T23:30:00Z and call getLeaveBalance, expect year=2027 in the response
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-016 ⇄ sessionA COR-006).
- Audit note: Low probability (1 hour per year) but year-end is exactly when HR teams query balances for statutory reporting. Adversarial check: parisYearWindow confirmed to use fromZonedTime with Europe/Paris (leave-year-window.ts lines 52-55). The acceptance criteria example in the original finding had UTC/Paris direction reversed; corrected here — the bug manifests when UTC is still in year N but Paris has crossed to year N+1 (i.e., 23:xx UTC on Dec 31 = 00:xx Paris on Jan 1). Code verbatim confirmed at line 2635.

**Closed_by:** (empty — TODO)

---

### OBS-005 — Sentry / GlitchTip / OpenTelemetry stubs are no-ops — unhandled exceptions and 500s are log-only with no alerting

- **Status:** TODO
- **Phase:** 2
- **Cluster:** K
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · no-external-error-reporter
- **File:** `apps/api/src/common/filters/all-exceptions.filter.ts:33-40`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-005` · audit-confidence: high · found_by: observability

**Description:**
AllExceptionsFilter (OBS-017) and NoopErrorReporter (OBS-010) both document that they are stubs pending operator choice of a tracking backend (Sentry, GlitchTip, OpenTelemetry). SentryClient.captureException is a no-op at line 38. installGlobalErrorHandlers(new NoopErrorReporter()) in main.ts logs to stdout only. No external error reporting is wired. In a production government application (French local authority), unhandled exceptions during an active session produce a 500 that is logged locally but never surfaces as an alert. Log rotation or container restart can discard the evidence.

**Root cause:**
The operator decision on the tracking backend (Sentry vs GlitchTip for RGPD sovereignty) was intentionally deferred; the stubs are placeholders, not accidentally missing code.

**Code evidence:**
```
// ---------------------------------------------------------------------------
// Sentry no-op stub — replace with `import * as Sentry from '@sentry/node'`
// when the dependency is added.
// ---------------------------------------------------------------------------
const SentryClient = {
  captureException: (_err: unknown, _ctx?: Record<string, unknown>): void => {
    // no-op until @sentry/node is introduced
  },
};
```

**Suggested fix:**
Wire a real ErrorReporter. For RGPD-sovereign self-hosted deployments, GlitchTip (https://glitchtip.com) is the recommended Sentry-compatible alternative that can be co-located on the VPS. For managed cloud: Sentry DSN via SENTRY_DSN env var. Minimum implementation: if (process.env.SENTRY_DSN) { const Sentry = await import('@sentry/node'); Sentry.init({ dsn: process.env.SENTRY_DSN }); } and replace NoopErrorReporter with a SentryErrorReporter that calls Sentry.captureException(). The existing interface and wiring hooks require no structural change.

**Acceptance criteria:**
1. A thrown, uncaught exception in a service method is captured by the error reporter and visible in the configured backend within 60 seconds
2. If SENTRY_DSN / tracking DSN is not set, the application falls back to NoopErrorReporter without crashing (existing behavior retained)
3. The reporter does not forward PII (email, names) in exception context — only stack trace + requestId
4. Commit message includes `[closes OBS-005]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: grep -rn 'NoopErrorReporter\|SentryClient\|captureException' apps/api/src/
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary OBS-005 ⇄ sessionA OBS-007).
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. Code evidence at lines 33-40 is verbatim correct. The stub is intentionally documented. No mitigation found — no SENTRY_DSN env var wiring, no alternative reporter implementation. Finding stands at severity=important (intentional gap, not accidental).

**Closed_by:** (empty — TODO)

---

### SEC-011 — Metrics METRICS_TOKEN comparison uses non-constant-time string equality

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · timing-attack
- **File:** `apps/api/src/metrics/metrics.controller.ts:33`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-011` · audit-confidence: high · found_by: security

**Description:**
The METRICS_TOKEN check on line 33 uses the JavaScript `!==` string operator, which short-circuits on the first differing character and is therefore vulnerable to timing side-channels. An attacker with a high-resolution clock or many samples could statistically determine the token value one character at a time. main.ts already defines a `safeEqual` helper using `crypto.timingSafeEqual`, but it is not imported or used here.

**Root cause:**
Direct string comparison (`!==`) instead of a constant-time comparison function such as `crypto.timingSafeEqual`.

**Code evidence:**
```
    const token = process.env['METRICS_TOKEN'];
    if (token) {
      const expected = `Bearer ${token}`;
      if (!authorization || authorization !== expected) {
        throw new UnauthorizedException('Invalid or missing METRICS_TOKEN');
      }
    }
```

**Suggested fix:**
Import `timingSafeEqual` from `crypto` (or re-export `safeEqual` from main.ts into a utility), then replace the `authorization !== expected` check with `timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))` after verifying both buffers have the same length.

**Acceptance criteria:**
1. Token comparison uses crypto.timingSafeEqual or equivalent constant-time function
2. A buffer-length mismatch (different-length token) is handled before calling timingSafeEqual to avoid the 'buffers must be equal length' exception
3. Commit message includes `[closes SEC-011]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'authorization' apps/api/src/metrics/metrics.controller.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-011 ⇄ sessionA SEC-011).
- Audit note: safeEqual() is already implemented in main.ts line 34-38 using timingSafeEqual — it just needs to be extracted to a shared utility and used here. Adversarial re-check: code_evidence verified verbatim at lines 30-36 of metrics.controller.ts. No other guard or middleware provides constant-time comparison for this endpoint. The safeEqual helper in main.ts is a local function, not exported, confirming the gap is real.

**Closed_by:** (empty — TODO)

---

### COR-039 — users.service changePassword() and admin resetPassword() do not call jwtNotBefore.bumpUser() — live access tokens remain valid after password change for up to the access TTL

- **Status:** TODO
- **Phase:** 2
- **Cluster:** N
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing-session-invalidation
- **File:** `apps/api/src/users/users.service.ts:1041-1046 and 1123-1129`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-039` · audit-confidence: high · found_by: correctness

**Description:**
changePassword() (self-service) revokes all refresh tokens via revokeAllForUser() but does NOT call jwtNotBefore.bumpUser(userId). The admin path resetPassword() in users.service.ts (line 1129) has the same omission. By contrast, the token-based resetPassword() in auth.service.ts (line 585) correctly calls bumpUser(). Without bumping the per-user nbf, any access token minted before the password change remains fully valid until its natural expiry (up to 15 minutes, configurable). JwtStrategy.validate will admit these tokens because the nbf gate only fires if a nbf key exists for the user.

**Root cause:**
The SEC-019 nbf invalidation pattern was applied to auth.service.ts resetPassword() but was not applied to the two password-mutation paths in users.service.ts.

**Code evidence:**
```
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, forcePasswordChange: false },
    });

    await this.refreshTokenService.revokeAllForUser(userId);
```

**Suggested fix:**
Add `await this.jwtNotBefore.bumpUser(userId);` in changePassword() after revokeAllForUser() (line ~1046), and the same in resetPassword() (users.service.ts) after revokeAllForUser() (line ~1129). JwtNotBeforeService is already injected into UsersService.

**Acceptance criteria:**
1. After changePassword(), an access token minted before the change is rejected by JwtStrategy.validate.
2. After admin resetPassword(), an access token minted before the reset is rejected by JwtStrategy.validate.
3. Commit message includes `[closes COR-039]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'bumpUser' apps/api/src/users/users.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-039 ⇄ sessionA SEC-002).
- Audit note: jwtNotBefore is already injected at line 62. The fix is two one-line additions. Adversarial check: grep confirmed bumpUser only called at lines 781 and 826 (both for isActive true→false transitions in update() and remove() respectively). changePassword() (lines 1041-1067) and admin resetPassword() (lines 1123-1158) both end after revokeAllForUser() with no bumpUser call. auth.service.ts resetPassword() at line 585 correctly calls bumpUser — the asymmetry is confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-028 — Admin password reset (POST /users/:id/reset-password) does not bump JWT nbf, leaving existing access tokens valid for up to 15 min

- **Status:** TODO
- **Phase:** 2
- **Cluster:** N
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · session-invalidation
- **File:** `apps/api/src/users/users.service.ts:1089-1159`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-028` · audit-confidence: high · found_by: security

**Description:**
UsersService.resetPassword (the admin path, reached via POST /users/:id/reset-password) calls refreshTokenService.revokeAllForUser to revoke all refresh tokens, but does NOT call jwtNotBefore.bumpUser. As a result, any live access token belonging to the target user continues to be valid until its natural TTL expires (default 15 minutes). The complementary path — AuthService.resetPassword (reached via POST /auth/reset-password with a token) — correctly calls BOTH revokeAllForUser AND jwtNotBefore.bumpUser (auth.service.ts line 585). The SEC-019 rationale is already documented in the codebase: 'without this bump a stolen access token stays valid until it expires (≤15 min) after the victim resets.'

**Root cause:**
jwtNotBefore.bumpUser was added to AuthService.resetPassword (SEC-019) but the equivalent admin path in UsersService.resetPassword was not updated.

**Code evidence:**
```
    await this.refreshTokenService.revokeAllForUser(userId);

    // OBS-004 — durable admin-reset event. Renamed from the SEC-003 free-string
    // 'PASSWORD_RESET_ADMIN' to the AuditAction enum value (advances OBS-024's
    // enum-vs-free-string unification). The console-parity auditService.log
    // below still emits PASSWORD_CHANGED — that dual sink is OBS-024 territory.
    await this.auditPersistence.log({
```

**Suggested fix:**
Add `await this.jwtNotBefore.bumpUser(userId);` immediately after `await this.refreshTokenService.revokeAllForUser(userId);` in UsersService.resetPassword (around line 1130). JwtNotBeforeService is already injected in UsersService (line 62) so no additional wiring is needed.

**Acceptance criteria:**
1. After POST /users/:id/reset-password, a previously-issued access token for the target user is rejected by JwtStrategy.validate on the next request.
2. The Redis key jwt:nbf:<userId> exists with a value equal to approximately now+1 (seconds) and TTL <= JWT_ACCESS_TTL + 60s.
3. Integration test: issue access token, admin-reset password, verify 401 on the old token within 1 second.
4. Commit message includes `[closes SEC-028]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'bumpUser' apps/api/src/users/users.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-028 ⇄ sessionA SEC-001).
- Related (same run): COR-039, COR-007.
- Audit note: jwtNotBefore is already injected (constructor line 62, field declared at line 63). The fix is one line. Adversarial check confirms: bumpUser appears at lines 781 and 826 (for deactivation/removal paths) but NOT in the resetPassword body (lines 1089-1159). AuthService.resetPassword at line 585 correctly calls bumpUser — the omission in the admin path is confirmed.

**Closed_by:** (empty — TODO)

---

### COR-009 — documents.update: prisma.document.update has no deletedAt filter — can mutate soft-deleted document in race window

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / soft-delete bypass
- **File:** `apps/api/src/documents/documents.service.ts:172-181`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-009` · audit-confidence: high · found_by: correctness

**Description:**
`findOne(id)` (line 173) checks `document.deletedAt` and throws NotFoundException if the document is soft-deleted. However, `prisma.document.update({ where: { id } })` (line 174) uses only the `id` filter with no `deletedAt: null` guard. If a concurrent soft-delete sets `deletedAt` between the `findOne` call and the `update` call, the update will silently succeed on a logically-deleted document, resurrecting its state partially or overwriting the `deletedAt`-based tombstone.

**Root cause:**
The existence/soft-delete check and the write are two separate DB roundtrips with no transaction or atomic WHERE clause combining both conditions.

**Code evidence:**
```
  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }
```

**Suggested fix:**
Change the update where clause to `{ id, deletedAt: null }` and handle the Prisma P2025 'record not found' error as a NotFoundException, or wrap findOne + update in a `$transaction`.

**Acceptance criteria:**
1. Calling update() on a soft-deleted document always returns 404
2. No update succeeds on a document with deletedAt set
3. Commit message includes `[closes COR-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'deletedAt' apps/api/src/documents/documents.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The same TOCTOU is present for the remove() → findOne() → update({deletedAt: new Date()}) pattern, though its impact is lower: double-soft-delete is idempotent.

**Closed_by:** (empty — TODO)

---

### COR-010 — documents.update accepts projectId change without checking user access to the new project

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing authorization / business invariant gap
- **File:** `apps/api/src/documents/documents.service.ts:172-181`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-010` · audit-confidence: high · found_by: correctness

**Description:**
`UpdateDocumentDto` extends `PartialType(CreateDocumentDto)` (see update-document.dto.ts), which means `projectId` is an optional field in the update payload. The `update()` method passes `updateDocumentDto` directly to `prisma.document.update()` without checking whether the caller has access to the new `projectId`. The `OwnershipGuard` at the controller layer only verifies ownership of the document being updated — it does NOT verify that the destination project is accessible to the caller. A document owner can move their document to any arbitrary project (including confidential or restricted projects) by including a `projectId` in the PATCH payload.

**Root cause:**
The service `create()` correctly calls `assertCanAccessProject(createDocumentDto.projectId, ...)` but `update()` has no equivalent check for a projectId change.

**Code evidence:**
```
  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }
```

**Suggested fix:**
In `update()`, detect if `updateDocumentDto.projectId` is defined and differs from the current document's `projectId`; if so, call `accessScope.assertCanAccessProject(updateDocumentDto.projectId, currentUser, ...)`. The `update()` signature needs to accept `currentUser`.

**Acceptance criteria:**
1. PATCH /documents/:id with a projectId the caller has no access to returns 403
2. PATCH /documents/:id with the caller's own projectId succeeds
3. Commit message includes `[closes COR-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'projectId\|assertCanAccessProject' apps/api/src/documents/documents.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The create() method correctly enforces this check at line 57-62, but update() has no equivalent.

**Closed_by:** (empty — TODO)

---

### COR-029 — reorderSubtasks: subtask IDs from payload not validated to belong to taskId — cross-task position manipulation possible

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/tasks/tasks.service.ts:2039-2060`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-029` · audit-confidence: high · found_by: correctness

**Description:**
reorderSubtasks() verifies that the parent task exists, but does not verify that each subtaskId in the payload actually belongs to that task (i.e., subtask.taskId === taskId). An authenticated user with tasks:update permission can send subtask IDs from a different task and silently overwrite position values on subtasks they should have no access to. The getSubtasks(taskId) result returned will be correct for the requested task but the foreign subtasks are mutated.

**Root cause:**
The $transaction only filters by subtask PK (id), not by the composite (id, taskId), so it operates on any subtask regardless of ownership.

**Code evidence:**
```
  async reorderSubtasks(
    taskId: string,
    subtaskIds: string[],
    currentUser?: AccessUser,
  ) {
    ...
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');

    await this.prisma.$transaction(
      subtaskIds.map((id, index) =>
        this.prisma.subtask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return this.getSubtasks(taskId);
```

**Suggested fix:**
Either (a) pre-validate that all subtaskIds belong to taskId via a findMany({where:{id:{in:subtaskIds}, taskId}}) length check, or (b) change each update where clause to {id, taskId} so unowned subtasks produce a P2025 not-found error.

**Acceptance criteria:**
1. Sending a subtaskId belonging to a different task returns 404 or 400
2. Position of subtasks on the other task is unmodified
3. Commit message includes `[closes COR-029]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'reorderSubtasks\|subtask.update' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: updateSubtask and deleteSubtask correctly use findFirst({where:{id, taskId}}) — reorderSubtasks diverges from that pattern. Verified at lines 2006-2007 and 2029-2030.

**Closed_by:** (empty — TODO)

---

### COR-032 — findForPlanningOverview calls expandRecurringRulesForRange with no userId filter, materialising rows for all users

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · scope-leak / unintended write
- **File:** `apps/api/src/telework/telework.service.ts:246-253`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-032` · audit-confidence: high · found_by: correctness

**Description:**
findForPlanningOverview is called internally by planning/overview routes and receives an explicit `userIds` list that is the already-authorised visible scope. However, it calls `expandRecurringRulesForRange(startDate, endDate)` without a filterUserId argument, causing the expansion to materialise TeleworkSchedule rows for every active recurring rule in the system, not just those belonging to the visible users. The subsequent findMany read is correctly scoped to `userIds`, but the side-effect is global.

**Root cause:**
The filterUserId argument to expandRecurringRulesForRange is omitted; the function's optional param defaults to undefined → queries all rules.

**Code evidence:**
```
    await this.expandRecurringRulesForRange(startDate, endDate);

    return this.prisma.teleworkSchedule.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
```

**Suggested fix:**
Pass the userIds set to the expansion. Because expandRecurringRulesForRange takes a single optional userId string, the simplest change is to loop or refactor to accept string[]. Short-term: call `Promise.all(userIds.map(uid => this.expandRecurringRulesForRange(startDate, endDate, uid)))` before the findMany. Long-term: refactor expandRecurringRulesForRange to accept `userId?: string | string[]`.

**Acceptance criteria:**
1. Calling findForPlanningOverview with userIds=['A','B'] does not create TeleworkSchedule rows for user C.
2. The expansion still materialises rows for A and B correctly.
3. Commit message includes `[closes COR-032]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findForPlanningOverview\|expandRecurringRulesForRange' apps/api/src/telework/telework.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED. Verbatim code verified at lines 237-284. The call at line 246 `await this.expandRecurringRulesForRange(startDate, endDate)` passes no third argument. The function at line 292 shows `filterUserId?: string` — when absent, all active rules are processed regardless of which users are in scope.

**Closed_by:** (empty — TODO)

---

### SEC-004 — GET /projects/:projectId/clients — missing project-scope access check (IDOR)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · idor
- **File:** `apps/api/src/clients/clients.service.ts:290-298`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-004` · audit-confidence: high · found_by: security

**Description:**
The listProjectClients method, called by GET /projects/:projectId/clients in ProjectsClientsController, performs no project ownership or membership check before returning clients attached to a project. Any authenticated user holding the 'clients:read' permission can enumerate the client organisations associated with any project, regardless of whether they are a member of that project. The rest of the codebase (documents, tasks, time-tracking) consistently calls accessScope.assertCanAccessProject() before returning project-scoped data; this endpoint skips that pattern entirely.

**Root cause:**
listProjectClients never calls assertCanAccessProject(), unlike every other project-scoped read endpoint in the codebase.

**Code evidence:**
```
  async listProjectClients(projectId: string) {
    return this.prisma.projectClient.findMany({
      where: { projectId },
      include: {
        client: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
```

**Suggested fix:**
Inject AccessScopeService into ClientsService and call assertCanAccessProject(projectId, currentUser) at the start of listProjectClients. Thread the currentUser from ProjectsClientsController.list() through the service call, matching the pattern used in DocumentsService.create().

**Acceptance criteria:**
1. A user without project membership receives 403 on GET /projects/:otherProjectId/clients
2. A user with projects:manage_any still receives the list (bypass preserved)
3. Existing members receive the list unchanged
4. Commit message includes `[closes SEC-004]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'assertCanAccessProject' apps/api/src/clients/clients.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Pattern gap confirmed: grep of clients.service.ts and the controller (projects-clients.controller.ts) shows zero calls to assertCanAccessProject. DocumentsService.create() at line 57 and ProjectsService/TasksService/TimeTrackingService all enforce this check — absent only here.

**Closed_by:** (empty — TODO)

---

### SEC-006 — epics findAll and milestones findAll return all records regardless of project membership

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · broken-access-control
- **File:** `apps/api/src/epics/epics.service.ts:30-57`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-006` · audit-confidence: high · found_by: security

**Description:**
GET /epics and GET /milestones have no access-scope filter. Any authenticated user holding the quasi-universal epics:read / milestones:read permission (all roles down to OBSERVATEUR and CONTRIBUTEUR) can enumerate ALL epics and milestones across ALL projects, including those they are not a member of. The parallel routes GET /projects/:id and individual findOne paths do enforce membership via assertProjectMembership / assertCanAccessProject, but the list endpoints simply have no such filter. The milestones findAll is identical (apps/api/src/milestones/milestones.service.ts lines 53-88).

**Root cause:**
The findAll methods in epics and milestones services never check project membership or inject a caller-scoped WHERE clause, unlike the projects service which uses AccessScopeService.

**Code evidence:**
```
  async findAll(page = 1, limit = 1000, projectId?: string) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where = projectId ? { projectId } : {};

    const [data, total] = await Promise.all([
      this.prisma.epic.findMany({
        where,
```

**Suggested fix:**
Inject the caller's user ID and role into findAll, then apply the same membership-scoped WHERE clause used in ProjectsService.findAll: join through project.members where userId=callerId unless the caller holds projects:manage_any. Example: `where.project = { members: { some: { userId: callerId } } }` for non-privileged callers.

**Acceptance criteria:**
1. GET /epics without projectId as OBSERVATEUR returns only epics whose parent project has the caller as a member
2. GET /milestones without projectId as CONTRIBUTEUR returns only milestones whose parent project has the caller as a member
3. ADMIN and RESPONSABLE (with projects:manage_any) still receive all records
4. Commit message includes `[closes SEC-006]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: EpicsModule has no AccessScopeService injected; EpicsService.findAll signature takes no userId parameter; controller passes no currentUser to findAll. Same confirmed for MilestonesService.findAll (lines 53-88). No membership filter anywhere in the list path.

**Closed_by:** (empty — TODO)

---

### SEC-009 — canValidate() delegation fallback grants approve rights across the entire org, bypassing service-scope

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · authorization / IDOR
- **File:** `apps/api/src/leaves/leaves.service.ts:1638-1650`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-009` · audit-confidence: high · found_by: security

**Description:**
The final branch of `canValidate()` checks whether the caller is an active delegate of ANY delegator in the system, without scoping the check to the leave's owner, department, or service perimeter. A user delegated by Manager A (who covers Dept A) can therefore approve a pending leave belonging to any user in any other department. This directly contradicts the intention of delegations (which are supposed to cover the delegating manager's own perimeter) and the scope logic enforced everywhere else in the service (`getServiceIds`, `getManagedUserIds`). The `findValidatorForUser()` helper correctly scopes delegation lookups to `delegatorId: managerId` (the leave owner's department manager), but `canValidate()` does not.

**Root cause:**
The delegation lookup at the end of `canValidate()` matches any active delegation where the caller is `delegateId`, with no filter on `delegatorId` nor any perimeter check linking the delegator to the leave's owner.

**Code evidence:**
```
    // Vérifier les délégations actives
    const today = new Date();
    const activeDelegation =
      await this.prisma.leaveValidationDelegate.findFirst({
        where: {
          delegateId: validatorId,
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

    return activeDelegation !== null;
```

**Suggested fix:**
After checking the delegator's service perimeter, further restrict the delegation lookup: fetch the leave's `validatorId` (the assigned manager), then query for a delegation scoped to that delegatorId: `{ delegateId: validatorId, delegatorId: leave.validatorId, isActive: true, startDate: { lte: today }, endDate: { gte: today } }`. If `leave.validatorId` is null, fall back to the department manager lookup as in `findValidatorForUser`.

**Acceptance criteria:**
1. A delegate of Manager A cannot call POST /leaves/:id/approve on a leave whose `validatorId` belongs to Manager B (expect 403).
2. A delegate of Manager A CAN approve a leave whose `validatorId` is Manager A (expect 200).
3. Existing unit test for `canValidate` covers cross-department delegation boundary.
4. Commit message includes `[closes SEC-009]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: create two managers M1, M2 each with subordinates, create delegation for M1->D, then have D try to approve a leave belonging to M2's subordinate.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The comment at line 712 acknowledges the correct scope ('COR-005: scope the delegation lookup to the user's own department manager') for findValidatorForUser, but canValidate does not apply the same discipline. Adversarial review confirmed: the approve() method at line 1704 calls canValidate(), and the delegation check at lines 1638-1650 has no delegatorId filter. findValidatorForUser() at lines 712-735 correctly scopes to `delegatorId: managerId` — the asymmetry is real and exploitable.

**Closed_by:** (empty — TODO)

---

### SEC-013 — POST /milestones/:id/complete lacks project-membership check

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · broken-access-control
- **File:** `apps/api/src/milestones/milestones.service.ts:162-168`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-013` · audit-confidence: high · found_by: security

**Description:**
The `complete` endpoint marks any milestone as COMPLETED without verifying the caller is a member of the milestone's parent project. The controller handler (milestones.controller.ts:116) passes only the milestone ID to milestonesService.complete; no currentUserId or currentUserRole is passed, and the service performs no membership assertion. By contrast, the sibling methods update() and remove() call assertProjectMembership. Any user with the milestones:update permission (quasi-universal: all roles except OBSERVATEUR) can complete a milestone in any project.

**Root cause:**
The complete() service method was added or refactored without applying the same assertProjectMembership guard that update() and remove() use.

**Code evidence:**
```
  async complete(id: string) {
    await this.findOne(id);
    return this.prisma.milestone.update({
      where: { id },
      data: { status: MilestoneStatus.COMPLETED },
    });
  }
```

**Suggested fix:**
Update the controller to pass currentUserId and currentUserRole to milestonesService.complete, and add the assertProjectMembership call at the start of that method, mirroring update() and remove().

**Acceptance criteria:**
1. A user who is not a member of the parent project receives 403 when calling POST /milestones/:id/complete
2. A member of the project (or a user with projects:manage_any) can complete the milestone
3. Commit message includes `[closes SEC-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): COR-057.
- Audit note: Adversarial check: controller line 116 confirmed: `complete(@Param('id', ParseUUIDPipe) id: string)` — no @CurrentUser. Service complete() signature is `async complete(id: string)` — no user params. update() and remove() both accept currentUserId/currentUserRole and call assertProjectMembership. Gap is real.

**Closed_by:** (empty — TODO)

---

### SEC-017 — hardDelete lacks defense-in-depth ownership assertion present in all sibling mutation methods

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · broken-access-control
- **File:** `apps/api/src/projects/projects.service.ts:833-886`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-017` · audit-confidence: high · found_by: security

**Description:**
All other project mutation methods (update, remove, archive, unarchive, updateMember, removeMember) open with an `await this.assertProjectOwnershipOrBypass(id, user)` call as defense-in-depth. The hardDelete method is the sole exception — it relies exclusively on the OwnershipGuard decorator in the controller. If the guard is bypassed (e.g., a future refactor adds an internal call path, or the guard registration order changes), the service layer provides no backstop. This is an inconsistency in a system that has explicitly documented (see comment BUG-04 / BUG-08 SEC-06) the intentional double-enforcement pattern.

**Root cause:**
The assertProjectOwnershipOrBypass call was omitted when hardDelete was written, breaking the project-wide defense-in-depth contract.

**Code evidence:**
```
  async hardDelete(id: string, user: ProjectMutationUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const { canDelete, dependencies } = await this.checkProjectDependencies(id);
```

**Suggested fix:**
Add `await this.assertProjectOwnershipOrBypass(id, user);` as the first line of hardDelete(), before the findUnique call, mirroring the pattern in remove() and archive().

**Acceptance criteria:**
1. hardDelete throws ForbiddenException when called with a user who is neither owner nor holder of projects:manage_any, even if the OwnershipGuard is bypassed
2. Existing unit tests for hardDelete still pass
3. Commit message includes `[closes SEC-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'assertProjectOwnershipOrBypass' apps/api/src/projects/projects.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): COR-025.
- Audit note: Adversarial check: grep confirms assertProjectOwnershipOrBypass called at lines 555, 670, 693, 730, 970, 1015 (update, remove, archive, unarchive, updateMember, removeMember). hardDelete at line 833 has NO such call — confirmed omission. @OwnershipCheck decorator IS present on the controller, so the controller-level guard exists, but the service-layer backstop is absent unlike all siblings.

**Closed_by:** (empty — TODO)

---

### SEC-022 — reorderSubtasks does not verify that subtaskIds belong to the taskId — cross-task IDOR

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · idor
- **File:** `apps/api/src/tasks/tasks.service.ts:2039-2061`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-022` · audit-confidence: high · found_by: security

**Description:**
The `reorderSubtasks` method verifies that the current user can read `taskId` (via `assertCanReadTask`), then issues a Prisma transaction that updates the `position` of each subtask ID in `subtaskIds` by ID only — without filtering `where: { id, taskId }`. An attacker who knows the UUID of a subtask belonging to a task they do not own can include that UUID in the `subtaskIds` array and silently reorder/mutate the `position` field of arbitrary subtasks across the application.

**Root cause:**
The WHERE clause in the subtask update only uses `{ id }` instead of `{ id, taskId }`, failing to scope updates to the parent task.

**Code evidence:**
```
    await this.prisma.$transaction(
      subtaskIds.map((id, index) =>
        this.prisma.subtask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
```

**Suggested fix:**
Add `taskId` to each where clause:
ʼʼʼts
await this.prisma.$transaction(
  subtaskIds.map((id, index) =>
    this.prisma.subtask.update({
      where: { id, taskId },   // scope to parent task
      data: { position: index },
    }),
  ),
);
ʼʼʼ
Also add a pre-check that all provided subtask IDs belong to the given taskId before starting the transaction.

**Acceptance criteria:**
1. Attempting to reorder subtasks of another task returns HTTP 403 or the update is silently ignored (no position change on foreign subtask)
2. Unit test confirms that subtask.update is called with `{ id, taskId }` composite key
3. Commit message includes `[closes SEC-022]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: create two tasks each with one subtask, then POST /tasks/:id1/subtasks/reorder with subtaskId from task2 and verify that subtask2.position changes
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): COR-029.
- Audit note: Adversarial review: code evidence verbatim confirmed at tasks.service.ts lines 2051-2058. The assertCanReadTask guard on line 2045 only checks the caller's access to the parent taskId, not ownership of each subtask ID. No additional guard found in the controller (tasks.controller.ts:596-608) or the ReorderSubtasksDto. IDOR is real and exploitable.

**Closed_by:** (empty — TODO)

---

### SEC-025 — GET /tasks/:taskId/third-party-assignees — missing task-scope access check (IDOR)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · idor
- **File:** `apps/api/src/third-parties/third-parties.service.ts:310-321`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-025` · audit-confidence: high · found_by: security

**Description:**
listTaskAssignees, called by GET /tasks/:taskId/third-party-assignees in TasksThirdPartyAssigneesController, returns all third parties assigned to any task without checking task or project access for the requesting user. Any user with third_parties:read can enumerate third-party assignees for any task, including tasks in confidential projects.

**Root cause:**
listTaskAssignees never calls assertCanReadTask() or assertCanAccessProject(), unlike the tasks module which consistently enforces scope.

**Code evidence:**
```
  async listTaskAssignees(taskId: string) {
    return this.prisma.taskThirdPartyAssignee.findMany({
      where: { taskId },
      include: {
        thirdParty: true,
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
```

**Suggested fix:**
Call accessScope.assertCanReadTask(taskId, currentUser) at the top of listTaskAssignees. Inject AccessScopeService and thread currentUser from the controller.

**Acceptance criteria:**
1. A non-member receives 403 on GET /tasks/:confidentialTaskId/third-party-assignees
2. Assigned task members receive the list unchanged
3. Users with tasks:manage_any bypass the check
4. Commit message includes `[closes SEC-025]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'assertCanReadTask\|assertCanAccessProject' apps/api/src/third-parties/third-parties.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confidential tasks (confidential: true) are specifically protected in AccessScopeService.taskReadWhere; this gap bypasses that protection.

**Closed_by:** (empty — TODO)

---

### SEC-026 — GET /projects/:projectId/third-party-members — missing project-scope access check (IDOR)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · idor
- **File:** `apps/api/src/third-parties/third-parties.service.ts:323-334`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-026` · audit-confidence: high · found_by: security

**Description:**
listProjectMembers, called by GET /projects/:projectId/third-party-members in ProjectsThirdPartyMembersController, returns all third-party organisations (contractors, legal entities) attached to any project without checking project membership. A user with third_parties:read can iterate any projectId to discover which external partners are involved in projects they have no business seeing.

**Root cause:**
listProjectMembers never calls assertCanAccessProject(), unlike task, document, and time-tracking equivalents.

**Code evidence:**
```
  async listProjectMembers(projectId: string) {
    return this.prisma.projectThirdPartyMember.findMany({
      where: { projectId },
      include: {
        thirdParty: true,
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
```

**Suggested fix:**
Inject AccessScopeService into ThirdPartiesService and call assertCanAccessProject(projectId, currentUser) at the start of listProjectMembers. Pass currentUser from the controller.

**Acceptance criteria:**
1. Non-member with third_parties:read receives 403 on GET /projects/:otherProjectId/third-party-members
2. Project members receive the list unchanged
3. Users with projects:manage_any bypass the check
4. Commit message includes `[closes SEC-026]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'assertCanAccessProject' apps/api/src/third-parties/third-parties.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same pattern gap as security-S4-1 in the sibling module.

**Closed_by:** (empty — TODO)

---

### SEC-027 — POST /users/:id/reset-password uses 'users:manage_roles' permission — semantically wrong and may grant unintended reset capability to role managers

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · access-control
- **File:** `apps/api/src/users/users.controller.ts:430-431`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-027` · audit-confidence: high · found_by: security

**Description:**
The admin password-reset endpoint at POST /users/:id/reset-password requires the permission 'users:manage_roles', not 'users:reset_password'. The complementary token-generation endpoint at POST /auth/reset-password-token uses 'users:reset_password'. This means that any role template carrying 'users:manage_roles' (role administration) can directly reset any subordinate user's password, even if the operator intended role administration and password reset to be separate privileges. Conversely, a role template that holds 'users:reset_password' but not 'users:manage_roles' cannot use this direct-reset endpoint, even though it can use the token-generation path. The inconsistency means the password-reset access surface is wider than explicitly designed: role managers gain implicit password-reset authority.

**Root cause:**
The direct-reset endpoint was wired to 'users:manage_roles' instead of the purpose-built 'users:reset_password' permission, possibly because it was added alongside role-management features.

**Code evidence:**
```
  @Post(':id/reset-password')
  @RequirePermissions('users:manage_roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Réinitialiser le mot de passe d'un utilisateur (Admin/Responsable)",
```

**Suggested fix:**
Change line 431 to @RequirePermissions('users:reset_password'). Verify that all templates intended to perform admin password resets carry 'users:reset_password'. If both are needed, add @RequireAnyPermission('users:manage_roles', 'users:reset_password') with a comment explaining the dual need.

**Acceptance criteria:**
1. A caller with only 'users:manage_roles' (and not 'users:reset_password') gets 403 on POST /users/:id/reset-password.
2. A caller with 'users:reset_password' gets 200 on POST /users/:id/reset-password (provided hierarchy check passes).
3. E2E: RBAC matrix confirms the reset-password endpoint is not reachable by REFERENT_TECHNIQUE roles that only hold manage_roles.
4. Commit message includes `[closes SEC-027]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn "users:reset_password\|users:manage_roles" apps/api/src/users/users.controller.ts apps/api/src/auth/auth.controller.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: users.controller.ts line 431 confirmed `@RequirePermissions('users:manage_roles')`. auth.controller.ts line 314 uses `@RequirePermissions('users:reset_password')` for the token-path — the mismatch is real. Both endpoints still enforce hierarchy in the service layer via roleHierarchy.assertCanAssignRole, so there is no privilege escalation, but the permission surface inconsistency is confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-029 — Leave cancellation request button gated by client-side userId comparison instead of API canRequestCancel flag

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · client_side_auth
- **File:** `apps/web/app/[locale]/leaves/page.tsx:776-786`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-029` · audit-confidence: high · found_by: security

**Description:**
The 'request cancellation' button is shown when `leave.status === LeaveStatus.APPROVED && leave.userId === user?.id`. This is a client-side ownership check using the locally stored `user.id` from the auth store (JWT token). Per the CLAUDE.md memory rule, auth decisions must use API-computed flags (canEdit/canDelete per resource). While the API itself should enforce the authorization, the button relies on the frontend correctly reading `user.id` from the JWT, which could be manipulated by a XSS attacker or lead to display inconsistency if a manager is viewing someone else's leave in the all-leaves tab (where `leave.userId !== user.id` may incorrectly hide or show the button). The `canEdit` and `canDelete` flags are correctly API-sourced (lines 757, 767) — this one slip is inconsistent with the established pattern.

**Root cause:**
The requestCancel affordance check was implemented with a direct client-side `userId === user.id` comparison rather than an API-provided `canRequestCancel` flag on the leave object.

**Code evidence:**
```
            {!showValidationActions &&
              leave.status === LeaveStatus.APPROVED &&
              leave.userId === user?.id && (
                <button
                  onClick={() => handleRequestCancel(leave.id)}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                  title="Demander l'annulation"
                >
                  ↩️
                </button>
              )}
```

**Suggested fix:**
Add a `canRequestCancel` boolean flag to the Leave API response (similar to `canEdit`/`canDelete`). Use that flag: `(leave as Leave & { canRequestCancel?: boolean }).canRequestCancel && leave.status === LeaveStatus.APPROVED`.

**Acceptance criteria:**
1. Backend returns canRequestCancel: boolean in each Leave object.
2. Frontend renders the cancel-request button solely based on the API flag.
3. No client-side userId comparison remains for authorization decisions.
4. Commit message includes `[closes SEC-029]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'leave.userId === user' apps/web/app/\[locale\]/leaves/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code confirmed verbatim at lines 776-786. The API enforces the actual permission, so this is primarily an architectural inconsistency rather than an exploitable vulnerability. Severity is 'important' rather than 'blocking'.

**Closed_by:** (empty — TODO)

---

### SEC-030 — SuiviPage: access control (checkAccess) computed client-side from Zustand store data — no server-side enforcement of the scope filter

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · auth decisions computed client-side
- **File:** `apps/web/app/[locale]/users/[id]/suivi/page.tsx:95-111, 168-170, 181-183`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-030` · audit-confidence: medium · found_by: security

**Description:**
The `checkAccess` function runs entirely in the browser, using data from the Zustand auth store (`currentUser.managedServices`). It determines whether the current user may view another user's tasks, leaves, telework, time stats, and skills. If an attacker manipulates the Zustand store (e.g., via browser devtools or by replaying a modified `/auth/me` response), they can bypass the access check and then fetch all downstream data (tasks, leaves, telework, time) from the API — which may or may not enforce the same scope filter server-side. The comment in the code itself acknowledges: 'RBAC V0 — permission-based'. The six parallel API calls on line 191–198 use `userId` directly without the result of `checkAccess` being communicated to the API layer.

**Root cause:**
Access scoping (managedServices filter) is enforced only in the frontend; the API endpoints are called directly with the target `userId` regardless of whether `checkAccess` returns true or false at the server level.

**Code evidence:**
```
  const checkAccess = (targetUser: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.id === userId) return true;
    if (hasPermission("users:manage_roles")) return true;
    if (hasPermission("users:manage")) {
      const managedServiceIds = (currentUser.managedServices || []).map(
        (ms) => ms.id,
      );
      const targetServiceIds = (targetUser.userServices || []).map(
        (us) => us.service?.id,
      );
      return targetServiceIds.some(
        (id) => id && managedServiceIds.includes(id),
      );
    }
    return false;
  };
```

**Suggested fix:**
Verify that each API endpoint accessed in the parallel fetch (tasksService.getByAssignee, leavesService.getAll with userId, teleworkService.getByDateRange with userId, timeTrackingService.getStats with userId, skillsService.getUserSkills with userId, projectsService.getByUser with userId) enforces the managedService scope server-side. If not, add a server-side check in each endpoint. The frontend check is a UX enhancement, not a security control.

**Acceptance criteria:**
1. API endpoints enforce managedService scope independently of the frontend check
2. A user with users:manage but no managedService overlap with target user receives 403 from the API
3. Commit message includes `[closes SEC-030]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification of API endpoint guards required
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim. The checkAccess function (lines 95-111) and its use at lines 168-170 are exactly as cited. The parallel API calls at lines 191-198 are confirmed. Confidence remains medium — this is a genuine frontend-only gate pattern but whether it constitutes a vulnerability depends on backend enforcement, which requires cross-referencing the API shard.

**Closed_by:** (empty — TODO)

---

### COR-008 — hardDelete: count-then-delete without transaction allows deletion of client with active project links

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition / missing transaction
- **File:** `apps/api/src/clients/clients.service.ts:259-274`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-008` · audit-confidence: high · found_by: correctness

**Description:**
The `hardDelete` method reads the project-association count (line 265) then, in a separate operation, deletes the client (line 274). Between the count check and the delete, a concurrent `assignClientToProject` call can insert a `ProjectClient` row, meaning the client ends up deleted while a live project association still references it. The DB may cascade-delete the `ProjectClient` row (depending on FK rules), silently orphaning project records or causing inconsistent state depending on the cascade configuration.

**Root cause:**
Guard-then-delete pattern without wrapping both operations in a `$transaction`, leaving a TOCTOU window.

**Code evidence:**
```
    const projectsCount = await this.prisma.projectClient.count({
      where: { clientId: id },
    });
    if (projectsCount > 0) {
      throw new ConflictException(
        `Client ${id} cannot be deleted: it is linked to ${projectsCount} project(s). Remove the associations first or archive the client instead.`,
      );
    }

    await this.prisma.client.delete({ where: { id } });
```

**Suggested fix:**
Wrap both the count check and the delete inside a `$transaction`: `await this.prisma.$transaction(async (tx) => { const count = await tx.projectClient.count({...}); if (count > 0) throw new ConflictException(...); await tx.client.delete({...}); });`

**Acceptance criteria:**
1. Concurrent `assignClientToProject` and `hardDelete` calls never result in a client being deleted when it has active project associations
2. The entire guard-then-delete sequence executes within a single DB transaction
3. Commit message includes `[closes COR-008]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '\$transaction' apps/api/src/clients/clients.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The same pattern exists in update() (findUnique then update) but the consequence there is lower severity since update does not violate referential integrity.

**Closed_by:** (empty — TODO)

---

### COR-012 — Recurring event child occurrences created outside any transaction — partial failure leaves orphaned parent with no children

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · data_integrity — missing transaction boundary
- **File:** `apps/api/src/events/events.service.ts:233-245`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-012` · audit-confidence: high · found_by: correctness

**Description:**
After the parent event is committed (line 140–198), child occurrences are written in a sequential for-loop with N separate Prisma `event.create` calls, each in its own auto-commit transaction. If any child create fails mid-loop (e.g. DB connection reset, constraint violation on one participant, resource limit), the parent event and the already-created children are persisted but the request returns HTTP 500. The client never receives the parent ID and may retry, creating a duplicate recurrence series. Contrast with the `update()` method (lines 480–535) which correctly wraps participant rewrites in `$transaction`. The asymmetry is likely an oversight.

**Root cause:**
Occurrence loop runs as N independent writes after the parent has already committed, with no wrapping transaction to roll back on failure.

**Code evidence:**
```
      for (const occ of occurrences) {
        await this.prisma.event.create({
          data: {
            ...occ,
            ...(participantIds &&
              participantIds.length > 0 && {
                participants: {
                  create: participantIds.map((userId) => ({ userId })),
                },
              }),
          },
        });
      }
```

**Suggested fix:**
Wrap the parent create and all child creates in a single `this.prisma.$transaction(async (tx) => { ... })`. Move the `event.create` for the parent and the occurrence loop inside the transaction callback, substituting `tx.event.create` for all writes.

**Acceptance criteria:**
1. A simulated DB error on the 2nd child create rolls back the parent and the 1st child (DB is clean after failure)
2. A successful call with N=3 child occurrences produces exactly 1 parent + 3 children in a single atomic write
3. The existing PER-024 test (event.create called parent + 2 occurrences) still passes after the refactor
4. Commit message includes `[closes COR-012]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'prisma.event.create\|prisma.$transaction' apps/api/src/events/events.service.ts | head -30
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: update() wraps participant rewrite in $transaction (line 480) — the asymmetry with create() strengthens this finding. Adversarial check: no outer $transaction exists in the create() method; the parent event.create at line 140 is inside a try/catch for cycle detection only, not a tx. The occurrence loop at lines 233-245 runs after the parent has already committed. No global transaction interceptor found. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-017 — deleteBalance: hard-delete committed before audit log — crash between them produces silent deletion with no audit trace

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · non_atomic_write_then_audit
- **File:** `apps/api/src/leaves/leaves.service.ts:2989-3010`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-017` · audit-confidence: high · found_by: correctness

**Description:**
The balance is deleted on line 2989 and the audit write is attempted on line 2991, two separate awaits with no enclosing transaction. If the process crashes, is OOM-killed, or `auditPersistence.log` throws between these two lines, the balance row is gone from the database with no audit trace. This contrasts with `remove()` at line 1571 which wraps both the delete and the audit inside a single `this.prisma.$transaction`. The `remove()` docstring at line 1566 acknowledges the audit uses its own Prisma client and is not fully atomic — but `deleteBalance` here does not even attempt the transaction wrapper.

**Root cause:**
The `deleteBalance` method issues two sequential awaits (delete, then audit) without a transaction, unlike `remove()` which uses `$transaction` to couple them.

**Code evidence:**
```
    await this.prisma.leaveBalance.delete({ where: { id } });

    await this.auditPersistence.log({
      action: AuditAction.LEAVE_BALANCE_ADJUSTED,
      entityType: 'Leave',
      entityId: id,
      actorId: actorId ?? null,
      payload: {
        actor: actorSnapshot,
        subject: {
          balanceId: id,
          userId: balance.userId,
```

**Suggested fix:**
Wrap the delete + audit in a `this.prisma.$transaction` as done in `remove()`, accepting the same acknowledged trade-off that the audit uses its own client (so the tx guards the delete commit, not the audit write durability):
ʼʼʼts
await this.prisma.$transaction(async (tx) => {
  await tx.leaveBalance.delete({ where: { id } });
  await this.auditPersistence.log({ ... });
});
ʼʼʼ

**Acceptance criteria:**
1. Simulated crash between delete and audit does not result in a deleted balance with no audit row
2. The audit row appears in audit_logs after a successful deleteBalance call
3. Commit message includes `[closes COR-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The acknowledged trade-off (audit uses its own Prisma client) is documented in the remove() method. deleteBalance should at minimum match that level of coupling. Adversarial check: code verbatim confirmed at lines 2989-3010. No transaction wrapper present. The remove() method does wrap in $transaction. Finding stands.

**Closed_by:** (empty — TODO)

---

### COR-025 — hardDelete(): audit log written outside transaction — audit records 'deleted' even if delete fails

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · transaction-boundary
- **File:** `apps/api/src/projects/projects.service.ts:855-883`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-025` · audit-confidence: medium · found_by: correctness

**Description:**
The PROJECT_DELETED audit event is emitted and awaited before `prisma.project.delete()`. If the delete fails (e.g., a new FK constraint is added between the dependency check and the delete, or any unexpected DB error occurs), the audit log contains a 'deleted' record for a project that still exists. The comment explicitly acknowledges this: 'Plain await — not transactional with the delete'. This is a known trade-off documented in code, but it creates an inconsistency: the immutable audit trail claims the project was deleted while it remains in the DB.

**Root cause:**
Audit log and delete are two separate non-transactional operations; failure of the second leaves the audit trail in a false state.

**Code evidence:**
```
    // Final snapshot to the audit trail BEFORE the row is erased (audit
    // suggested-fix b). Plain await — not transactional with the delete — to
    // match the existing archive()/unarchive() emission pattern; the audit
    // pipeline (AuditPersistenceService) is out of DAT-007 scope.
    await this.auditPersistence.log({
      action: AuditAction.PROJECT_DELETED,
      entityType: 'Project',
      entityId: id,
      actorId: user.id,
      payload: {
        snapshot: {
          id: project.id,
```

**Suggested fix:**
Wrap both `auditPersistence.log` and `prisma.project.delete` in a single `$transaction`. If the audit service does not support transactional context, emit the audit event AFTER the delete succeeds. Alternatively, treat the audit as a best-effort post-delete step and explicitly document this as an accepted risk.

**Acceptance criteria:**
1. If prisma.project.delete() throws, no PROJECT_DELETED audit record should exist for that project
2. Or: clear documentation that this is an accepted risk with compensating controls
3. Commit message includes `[closes COR-025]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'auditPersistence.log\|project.delete' apps/api/src/projects/projects.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-026 — services.service.ts remove() performs 3 sequential DB writes without a transaction — inconsistent state on crash

- **Status:** TODO
- **Phase:** 2
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · non-atomic-delete
- **File:** `apps/api/src/services/services.service.ts:308-343`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-026` · audit-confidence: high · found_by: correctness

**Description:**
The `remove()` method executes three separate database writes sequentially: (1) deleteMany on userService pivot rows, (2) update service.managerId to null, (3) delete the service. None of these are wrapped in a `prisma.$transaction()`. If the process crashes or the connection drops after step 1 but before step 3, all userServices pivot rows are gone but the service still exists, leaving the data in an inconsistent state. Step 2 (update managerId=null before deleting the row) is also logically redundant since the service is immediately deleted, but it still incurs an extra round-trip and is evidence of confused logic.

Adversarial note: UserService has `onDelete: Cascade` on the service FK (schema.prisma line 158), so step 1 is redundant — the DB cascade handles it. However, the absence of a transaction still allows a crash after step 2 (managerId set to null) but before step 3 (service deleted) to leave a service row with managerId=null in a permanently inconsistent intermediate state visible to other reads.

**Root cause:**
The delete operation was built incrementally without wrapping all writes in a single Prisma transaction, leaving the multi-step operation non-atomic.

**Code evidence:**
```
    // Détacher les utilisateurs liés avant suppression
    if (service._count.userServices > 0) {
      await this.prisma.userService.deleteMany({
        where: { serviceId: id },
      });
    }

    // Retirer le manager du service
    if (service.managerId) {
      await this.prisma.service.update({
        where: { id },
        data: { managerId: null },
      });
    }

    await this.prisma.service.delete({
      where: { id },
    });
```

**Suggested fix:**
Wrap all three operations in `prisma.$transaction()`. Also remove the redundant managerId nulling step since the row will be deleted:
ʼʼʼtypescript
await this.prisma.$transaction(async (tx) => {
  if (service._count.userServices > 0) {
    await tx.userService.deleteMany({ where: { serviceId: id } });
  }
  await tx.service.delete({ where: { id } });
});
ʼʼʼ
Note: if the DB schema uses `onDelete: Cascade` on userServices, even step 1 can be removed.

**Acceptance criteria:**
1. DELETE /services/:id completes atomically — no partial state visible under concurrent reads
2. A simulated crash between the first and third writes leaves the service intact (rolled back)
3. Commit message includes `[closes COR-026]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '\$transaction\|deleteMany\|service.update\|service.delete' apps/api/src/services/services.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The managerId=null update step (lines 332-337) is entirely redundant before delete — it should be removed along with the transaction wrapping fix. Adversarial check: onDelete: Cascade on UserService.service (schema.prisma line 158) makes step 1 redundant, but the missing transaction is still a real correctness gap — worst case is managerId=null service row surviving if crash between steps 2 and 3.

**Closed_by:** (empty — TODO)

---

### COR-018 — importMilestones(): per-row findFirst+create is a TOCTOU race with no uniqueness guarantee

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition
- **File:** `apps/api/src/milestones/milestones.service.ts:193-231`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-018` · audit-confidence: high · found_by: correctness

**Description:**
The import loop performs a `findFirst` followed by a `create` in separate, non-transactional DB calls for each milestone. If two concurrent import requests are in flight simultaneously (or two rows in the same batch with identical names), both may pass the `findFirst` check (finding no existing milestone) and both attempt `create`. The `create` would then fail with a DB constraint violation (if a unique constraint on (projectId, name) exists) or silently succeed creating a duplicate (if no such constraint exists). The catch block at line 226-231 would catch the constraint error and count it as `errors`, not `skipped`, producing misleading stats. Also, the sequential per-row loop performs N times 2 DB queries for N milestones instead of a batch approach.

**Root cause:**
No transactional read-then-write or upsert pattern; the check-then-act is separated in time.

**Code evidence:**
```
    for (let i = 0; i < milestones.length; i++) {
      const milestoneData = milestones[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      try {
        // Vérifier que le nom n'existe pas déjà dans le projet
        const existingMilestone = await this.prisma.milestone.findFirst({
          where: {
            projectId,
            name: milestoneData.name,
          },
        });

        if (existingMilestone) {
          result.skipped++;
```

**Suggested fix:**
Pre-fetch all existing milestone names for the project in one query before the loop (like validateImport does at line 268-272), then use `createMany` with `skipDuplicates: true` for the batch. Or use `upsert` per row. This eliminates the TOCTOU window.

**Acceptance criteria:**
1. Two concurrent POST /milestones/project/:id/import requests with the same milestone names do not create duplicates
2. Import of N milestones performs O(1) DB queries for the existence check, not O(N)
3. Commit message includes `[closes COR-018]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findFirst\|createMany\|skipDuplicates' apps/api/src/milestones/milestones.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-021 — createBulkAssignment: telework check snapshot race — assertTeleworkCompatibility runs before the bulk inserts, but concurrent mutations can invalidate it

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:288-334`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-021` · audit-confidence: medium · found_by: correctness

**Description:**
The telework compatibility check is performed once as a snapshot before the loop starts. The bulk insert loop then runs N×M individual creates outside any transaction. Between the check and the insert loop (or between any two iterations of the loop), a concurrent request could change a user's telework schedule for one of the dates. More importantly, if the bulk insert itself takes seconds (large N×M), the check is stale. There is no transactional or re-check mechanism.

**Root cause:**
assertTeleworkCompatibility is an upfront read with no lock, and the subsequent writes are not in a transaction, creating a TOCTOU window.

**Code evidence:**
```
  async createBulkAssignment(assignedById: string, dto: BulkAssignmentDto) {
    // Check predefined task exists
    const task = await this.prisma.predefinedTask.findUnique(...);
    if (!task || !task.isActive) { ... }
    await this.assertTeleworkCompatibility(task, dto.userIds, dto.dates);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const userId of dto.userIds) {
      for (const dateStr of dto.dates) {
        try {
          await this.prisma.predefinedTaskAssignment.create({
```

**Suggested fix:**
Either wrap the entire operation in a REPEATABLE READ transaction and re-validate inside, or re-run the telework check per-assignment pair inside the loop before creating.

**Acceptance criteria:**
1. A concurrent telework schedule update during bulk assignment is detected and the conflicting assignment is rejected
2. Commit message includes `[closes COR-021]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'assertTeleworkCompatibility\|predefinedTaskAssignment.create' apps/api/src/predefined-tasks/predefined-tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: createAssignment (single) has the same pattern but the window is much smaller.

**Closed_by:** (empty — TODO)

---

### COR-031 — addDependency: check-then-create pattern is not race-safe — duplicate dependency race between circular-check and create

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition
- **File:** `apps/api/src/tasks/tasks.service.ts:922-964`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-031` · audit-confidence: high · found_by: correctness

**Description:**
The circular-dependency check (checkCircularDependency) traverses the graph with a series of individual SELECT queries outside any transaction. Between the final check and the INSERT, another concurrent request can insert the reverse dependency, creating a cycle that neither check catches. The existing-dependency check is similarly non-atomic. While the DB unique constraint on (taskId, dependsOnTaskId) will prevent true duplicates, the circular check has no DB-level enforcement and can be raced by two simultaneous symmetric requests (A→B and B→A submitted concurrently).

**Root cause:**
The multi-step graph traversal + insert sequence has no serialization, allowing concurrent symmetric dependency creation to slip through the circular check.

**Code evidence:**
```
    // Vérifier qu'on ne crée pas une dépendance circulaire
    const hasCircularDependency = await this.checkCircularDependency(
      dependsOnTaskId,
      taskId,
    );

    if (hasCircularDependency) {
      throw new BadRequestException(
        'Cette dépendance créerait une dépendance circulaire',
      );
    }

    // Vérifier que la dépendance n'existe pas déjà
    const existingDependency = await this.prisma.taskDependency.findUnique({
```

**Suggested fix:**
Wrap the circular-check + insert in a SERIALIZABLE transaction or use an advisory lock keyed on the lower/upper task UUIDs. Alternatively add a DB-level trigger or deferred constraint to enforce DAG invariant.

**Acceptance criteria:**
1. Concurrent POST /:id/dependencies with reverse direction is rejected for at least one request
2. No cycle is observable in task dependency graph after concurrent inserts
3. Commit message includes `[closes COR-031]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'checkCircularDependency\|taskDependency.create\|taskDependency.findUnique' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: checkCircularDependency itself is BFS, correct for sequential execution.

**Closed_by:** (empty — TODO)

---

### COR-033 — expandRecurringRulesForRange and generateSchedulesFromRules do non-atomic findUnique→create, causing unhandled P2002 on concurrent requests

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / lost-update / unhandled P2002
- **File:** `apps/api/src/telework/telework.service.ts:338-356`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-033` · audit-confidence: high · found_by: correctness

**Description:**
Both expandRecurringRulesForRange (lines 338-356) and generateSchedulesFromRules (lines 908-925) use the same read-then-write pattern: findUnique checks whether a row exists; if not, create is called. Under READ COMMITTED isolation (Postgres default), two concurrent calls for overlapping ranges will both see null from findUnique and both attempt create. The second create hits the `userId_date` unique constraint and throws a Prisma P2002 (unique constraint violation) that is not caught anywhere in the call stack. NestJS bubbles this as an unhandled exception → HTTP 500. Because findAll auto-calls expansion on every date-range GET, this is easily triggered in production by parallel frontend requests.

**Root cause:**
Non-atomic check-then-insert outside a transaction with no P2002 catch or upsert fallback.

**Code evidence:**
```
          const existing = await this.prisma.teleworkSchedule.findUnique({
            where: {
              userId_date: {
                userId: rule.userId,
                date: dateOnly,
              },
            },
          });

          if (!existing) {
            await this.prisma.teleworkSchedule.create({
              data: {
                userId: rule.userId,
                date: dateOnly,
                isTelework: true,
                isException: false,
              },
            });
```

**Suggested fix:**
Replace findUnique+create with a Prisma upsert using skipDuplicates, or wrap in a try/catch and ignore P2002:
ʼʼʼts
try {
  await this.prisma.teleworkSchedule.create({ data: { ... } });
} catch (e: unknown) {
  if ((e as { code?: string }).code !== 'P2002') throw e;
  // row already exists from concurrent insert — safe to ignore
}
ʼʼʼ
Alternatively use createMany with skipDuplicates if batching is acceptable.

**Acceptance criteria:**
1. Two concurrent calls to expandRecurringRulesForRange for the same userId and overlapping date range both return without error.
2. No duplicate rows are created — the unique constraint is respected.
3. HTTP 200 is returned in both cases.
4. Commit message includes `[closes COR-033]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'prisma.teleworkSchedule.create\|P2002\|skipDuplicates' apps/api/src/telework/telework.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED. Full-file grep for 'P2002', 'skipDuplicates', 'upsert', 'catch' in telework.service.ts returned no results — no error-handling exists for the unique constraint violation. The @@unique([userId, date]) constraint on TeleworkSchedule (schema.prisma line 733) is confirmed. generateSchedulesFromRules lines 908-925 contain an identical copy of the same pattern and need the same fix.

**Closed_by:** (empty — TODO)

---

### COR-036 — ThirdPartiesService.update: LEGAL_ENTITY invariant checked without transaction — concurrent partial updates can violate it

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition / business invariant bypass
- **File:** `apps/api/src/third-parties/third-parties.service.ts:115-151`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-036` · audit-confidence: medium · found_by: correctness

**Description:**
The LEGAL_ENTITY invariant (no contactFirstName/contactLastName allowed) is validated by merging the incoming dto fields with the current DB row (`existing`). However, this `findUnique` + invariant-check + `update` sequence is NOT wrapped in a transaction. Two concurrent PATCH requests — one changing `type` to LEGAL_ENTITY and another setting `contactFirstName = 'John'` — can both read the same `existing` row, pass their respective invariant checks, then execute their `update` calls. The final DB state may have `type=LEGAL_ENTITY` and `contactFirstName='John'`, violating the invariant.

**Root cause:**
Read-check-write pattern for a multi-field business invariant without a serializable transaction or optimistic concurrency (no version/updated_at in WHERE clause).

**Code evidence:**
```
  async update(id: string, dto: UpdateThirdPartyDto): Promise<ThirdParty> {
    const existing = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Third party ${id} not found`);
    }

    const nextType = dto.type ?? existing.type;
    const nextFirstName =
      dto.contactFirstName !== undefined
        ? dto.contactFirstName
        : existing.contactFirstName;
```

**Suggested fix:**
Wrap `findUnique`, invariant check, and `update` in a `$transaction` with isolation level SERIALIZABLE, or add an `updated_at` version field and use it in the `update WHERE` clause for optimistic concurrency control.

**Acceptance criteria:**
1. Concurrent PATCH requests that individually pass the invariant check but collectively violate it are rejected
2. The final state of a third party always satisfies: type=LEGAL_ENTITY implies contactFirstName IS NULL AND contactLastName IS NULL
3. Commit message includes `[closes COR-036]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '\$transaction\|LEGAL_ENTITY\|contactFirstName' apps/api/src/third-parties/third-parties.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: This is a true concurrent-write race; under normal single-user traffic it does not manifest. The LEGAL_ENTITY restriction is also only a service-layer invariant — not enforced via a DB CHECK constraint.

**Closed_by:** (empty — TODO)

---

### COR-037 — upsertDismissal findFirst→create inside $transaction does not prevent duplicate dismissal rows under READ COMMITTED

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / concurrency / missing unique constraint
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:296-330`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-037` · audit-confidence: high · found_by: correctness

**Description:**
The comment at line 282 acknowledges that Prisma does not support upsert on a non-unique composite key. The $transaction wraps the findFirst+create, but under READ COMMITTED isolation (Postgres default), a $transaction does NOT prevent a second concurrent transaction from also reading null from findFirst and then attempting create. There is no partial unique index on (userId, taskId, isDismissal=true) in the schema (confirmed by the code comment). Both transactions therefore succeed, producing two dismissal rows for the same (userId, taskId). Business invariant broken: a task can then show as dismissed twice, and subsequent idempotent calls return different rows on each call.

**Root cause:**
Logical uniqueness (userId, taskId, isDismissal=true) is not enforced at the DB level, and the transaction does not use SELECT FOR UPDATE or SERIALIZABLE isolation to block concurrent inserts.

**Code evidence:**
```
    const userId = currentUser.id;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.timeEntry.findFirst({
        where: { userId, taskId, isDismissal: true },
        select: { id: true },
      });
      if (existing) {
        return tx.timeEntry.update({
          where: { id: existing.id },
          data: { updatedAt: new Date() },
          include: { task: true, project: true },
        });
      }
```

**Suggested fix:**
Add a partial unique index in the Prisma schema:
ʼʼʼ
@@unique([userId, taskId], map: "uq_dismissal_user_task", where: { isDismissal: true })
ʼʼʼ
Or use a `prisma.$executeRaw` INSERT ON CONFLICT DO UPDATE to achieve true upsert semantics. The DB-level constraint is the only reliable guard under READ COMMITTED.

**Acceptance criteria:**
1. Two concurrent calls to upsertDismissal for the same (userId, taskId) result in exactly one row in time_entry with isDismissal=true.
2. Both calls return without error (one creates, one updates or both succeed idempotently).
3. Commit message includes `[closes COR-037]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'isDismissal\|partial\|unique' packages/database/prisma/schema.prisma | grep -i 'timeentry\|time_entry' || echo 'check schema for TimeEntry unique constraints'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED. TimeEntry model in schema.prisma (lines 446-474) has only plain @@index entries, no @@unique and no partial unique index. The code comment at lines 281-283 ('Prisma ne supporte pas d\'upsert sur clé composite non-unique') explicitly acknowledges the gap. The $transaction buys atomicity for the read-modify-write within one request, but not across concurrent requests under READ COMMITTED isolation.

**Closed_by:** (empty — TODO)

---

### COR-038 — ensureDailyCapNotExceeded is non-transactional: concurrent same-day creates can both pass the 24h cap and collectively exceed it

- **Status:** TODO
- **Phase:** 2
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / daily-cap race (acknowledged residual)
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:84-120`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-038` · audit-confidence: high · found_by: correctness

**Description:**
The daily-hours cap is enforced via aggregate→check→create, three separate DB roundtrips with no transaction. Two concurrent create requests for the same (userId, date) both read an aggregate sum below 24, both pass the check, and both commit rows that together exceed 24h. The code documents this as an accepted residual at line 203 ('The TOCTOU residual (non-transactional read-then-write race ... ) remains unaddressed') and line 80 ('Carries the same non-transactional TOCTOU residual'). The per-row CHECK (DAT-033, @Min(0.25)/@Max(24)) does not close the aggregate race.

**Root cause:**
The aggregate check and the subsequent create are not wrapped in a serialisable transaction or backed by a DB-level CHECK constraint on the daily sum.

**Code evidence:**
```
  private async ensureDailyCapNotExceeded(
    actor:
      | { kind: 'user'; userId: string }
      | { kind: 'thirdParty'; thirdPartyId: string },
    date: Date,
    newHours: number,
    excludeEntryId?: string,
  ): Promise<void> {
    const startOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const actorWhere =
      actor.kind === 'user'
        ? { userId: actor.userId }
        : { thirdPartyId: actor.thirdPartyId };

    const aggregate = await this.prisma.timeEntry.aggregate({
```

**Suggested fix:**
The code acknowledges this residual. Definitive fix requires either: (a) wrapping aggregate+create in a SERIALIZABLE $transaction (performance impact), or (b) a DB-level trigger/constraint on the daily sum. A practical improvement is a $transaction with SELECT ... FOR UPDATE on a synthetic lock row keyed on (userId, date), preventing concurrent inserts for the same actor+day.

**Acceptance criteria:**
1. Two concurrent POST /time-tracking requests for the same user and date summing to > 24h result in exactly one accepted and one 400.
2. Or: the total stored hours for the user on that date never exceeds 24h.
3. Commit message includes `[closes COR-038]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification via concurrent load test
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED. Verbatim code verified at lines 84-120. The aggregate→check→create sequence has no wrapping transaction. The code comment at lines 79-82 explicitly documents this as an accepted TOCTOU residual. Reported for completeness; severity is important rather than blocking because the code owns the limitation.

**Closed_by:** (empty — TODO)

---

### PER-006 — All `events.findAll` / `getEventsByUser` / `getEventsByRange` list endpoints are unpaginated and unbounded

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-list-query
- **File:** `apps/api/src/events/events.service.ts:297-334`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-006` · audit-confidence: high · found_by: performance

**Description:**
Three event list methods (`findAll`, `getEventsByUser`, `getEventsByRange`) issue unbounded `findMany` with no `take`/`skip` and return the full result set. Each row includes nested `participants.user` which multiplies data volume. For a deployment with years of recurring events, an unscoped `GET /events` (admin role, no date filter) would return every event row with all participants. At P50 even 10,000 events × 5 participants each = 50,000 joined rows serialized to JSON.

**Root cause:**
No pagination (`take`/`skip`) and no maximum limit applied to any of the three event list queries.

**Code evidence:**
```
    const events = await this.prisma.event.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        participants: {
          include: {
            user: {
```

**Suggested fix:**
Add pagination to all three list methods: accept `page`/`pageSize` (or cursor) params, enforce a `take = Math.min(pageSize, 200)` cap, return `{ data, meta: { total, page, pageSize } }`. For the planning overview path (`eventsService.findAll` called from `PlanningService`) date filters are always provided, which limits results naturally — but the endpoints as public API remain unbounded.

**Acceptance criteria:**
1. GET /events without date filter returns at most 200 events
2. GET /events?page=2&pageSize=50 returns the correct slice
3. Total count is returned in response metadata
4. Commit message includes `[closes PER-006]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'take\|skip\|limit\|page' apps/api/src/events/events.service.ts apps/api/src/events/events.controller.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The planning overview call (`findAll` with date bounds) is implicitly bounded by the date window. The direct event list endpoint is the primary exposure. Verified: all three methods (findAll line 297, getEventsByUser line 599, getEventsByRange line 692) use `findMany` with no `take`/`skip` parameter.

**Closed_by:** (empty — TODO)

---

### PER-008 — getPendingForValidator: unbounded findMany — no limit/pagination for ADMIN path

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/leaves/leaves.service.ts:896-941`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-008` · audit-confidence: high · found_by: performance

**Description:**
When the calling user has `leaves:manage_any` (ADMIN / RESPONSABLE), `getPendingForValidator` issues an unbounded `findMany` on the entire `leaves` table, filtered only by status. No `take` or pagination parameter is applied. A large organisation with many concurrent pending/cancellation-requested leaves can return thousands of rows, each joined with user, leaveType and validator sub-selects. The service-perimeter path (lines 965-1011) has the same gap.

**Root cause:**
The function returns the Prisma promise directly without wrapping it in a safeLimit guard, unlike `findAll` which has `Math.min(limit, 500)`.

**Code evidence:**
```
    if (hasManageAny) {
      return this.prisma.leave.findMany({
        where: {
          status: {
            in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
          },
        },
        include: {
```

**Suggested fix:**
Add pagination parameters (`page`, `limit`) to the method signature, apply `Math.min(limit, 100)` as the cap, and return a paginated `{ data, meta }` envelope consistent with `findAll`.

**Acceptance criteria:**
1. GET /leaves/pending-validation with default parameters returns at most 100 rows
2. A `meta.total` field is present in the response
3. ADMIN with 500 pending leaves gets paginated results, not all 500 at once
4. Commit message includes `[closes PER-008]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Both the hasManageAny branch (line 896) and the hasApprove branch (line 965) are unbounded. Controller at leaves.controller.ts:263 passes no limit. No interceptor or guard caps the output.

**Closed_by:** (empty — TODO)

---

### PER-015 — getProjectsByUser fetches ALL tasks for every project to compute progress (no take limit)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/api/src/projects/projects.service.ts:1109-1113`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-015` · audit-confidence: high · found_by: performance

**Description:**
`getProjectsByUser` includes all tasks of each project with no `take` limit, just to compute a `progress` percentage in JS. A user who is a member of 20 projects each with 500 tasks will cause 10,000 task rows to be transferred from the DB to the API process per request, then discarded after counting. The `findAll` endpoint has a similar issue — it solved it with a `groupBy` (comment `PER-005`) but `getProjectsByUser` was not updated with the same fix.

**Root cause:**
Progress computation is done by fetching all task rows and filtering in memory, rather than using a `groupBy` aggregation query.

**Code evidence:**
```
        tasks: {
          select: {
            status: true,
          },
        },
```

**Suggested fix:**
Apply the same `groupBy` pattern as `findAll` (lines 357-379): run a single `task.groupBy({ by: ['projectId', 'status'], where: { projectId: { in: projectIds } }, _count: { _all: true } })` after the project query, then map progress from the result. Remove the `tasks: { select: { status: true } }` include.

**Acceptance criteria:**
1. GET /projects/user/:id triggers at most 2 DB queries for the project list (findMany + groupBy), regardless of task count
2. Progress percentage is identical to the findAll endpoint for the same projects
3. Commit message includes `[closes PER-015]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code confirmed verbatim. findAll uses groupBy (PER-005) but getProjectsByUser at line 1074-1134 does not — the inconsistency is real.

**Closed_by:** (empty — TODO)

---

### PER-017 — Default and max page size of 1000 on list endpoints (projects, epics, milestones)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-page-size
- **File:** `apps/api/src/projects/projects.service.ts:231-238`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-017` · audit-confidence: high · found_by: performance

**Description:**
All three list endpoints (projects, epics, milestones) default to limit=1000 and cap at 1000. A single unauthenticated-but-permissioned request can transfer thousands of rows with their full include tree (manager, sponsor, members×5, clients, _count, tasks-for-progress). For the projects list each row includes up to 5 full member objects and a per-project client array. With 1000 projects this easily exceeds 1 MB of JSON per response.

**Root cause:**
Default parameter `limit = 1000` and `Math.min(limit || 1000, 1000)` sets the ceiling equal to the default rather than a fraction of it.

**Code evidence:**
```
  async findAll(
    page = 1,
    limit = 1000,
    status?: ProjectStatus,
    userId?: string,
    userRole?: string,
    clients?: string,
    archived: ArchivedFilter = ArchivedFilter.ACTIVE,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Reduce default limit to 20 and cap to 100: `limit = 20`, `const safeLimit = Math.min(limit || 20, 100)`. Apply the same change to `epics.service.ts` (line 31) and `milestones.service.ts` (line 59). If the frontend needs all projects for a dropdown, introduce a separate lightweight endpoint that returns only id+name.

**Acceptance criteria:**
1. GET /projects without ?limit returns at most 20 rows
2. GET /projects?limit=10000 is capped to 100
3. Same constraint applied to GET /epics and GET /milestones
4. Commit message includes `[closes PER-017]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -H 'Authorization: Bearer <token>' 'http://localhost:3000/api/projects' | jq '.meta.limit'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same pattern in epics.service.ts:31 and milestones.service.ts:59 (both default+cap at 1000). QueryProjectsDto has no @Max or limit field — no DTO-level constraint mitigates this.

**Closed_by:** (empty — TODO)

---

### PER-018 — findUsersBySkill() fetches ALL users with a skill then filters isActive in JavaScript — inactive users inflate DB result needlessly

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · post-db-filter
- **File:** `apps/api/src/skills/skills.service.ts:477-515`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-018` · audit-confidence: high · found_by: performance

**Description:**
The `userSkill.findMany` query fetches every user-skill record for a given skill regardless of whether the user is active. The `isActive` filter is then applied in JavaScript (line 515). In an org with many deactivated users this results in: (a) unnecessary data transfer from PostgreSQL, (b) over-fetching the nested `userServices` join for inactive users, (c) `totalUsers` reporting the count after JS-filtering rather than letting the DB compute it efficiently.

**Root cause:**
The `where` clause on `userSkill.findMany` only filters by `skillId` and optionally `level`; the `isActive` guard was added as an afterthought in JavaScript rather than pushed into the Prisma query.

**Code evidence:**
```
    const userSkills = await this.prisma.userSkill.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
            avatarPreset: true,
            isActive: true,
            department: {
              select: { id: true, name: true },
            },
            userServices: {
              select: { service: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { level: 'desc' },
    });

    // Filtrer seulement les utilisateurs actifs
    const activeUsers = userSkills.filter((us) => us.user.isActive);
```

**Suggested fix:**
Add `user: { isActive: true }` to the Prisma `where` clause so the filter is pushed to the DB. Then remove the JavaScript `.filter()` on line 515.

**Acceptance criteria:**
1. EXPLAIN ANALYZE shows a boolean filter on users.is_active at the DB level
2. The JavaScript .filter() line (515) is removed
3. API returns only active users for a skill that has both active and inactive assignees
4. Commit message includes `[closes PER-018]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed: Prisma `where` clause only filters `skillId` (and optionally `level`), `isActive: true` is absent from the DB query. JS filter at line 515 confirmed. No middleware or decorator that would add the filter at a higher level found.

**Closed_by:** (empty — TODO)

---

### PER-019 — Default page limit is 1000 on skills/departments/services list endpoints — 10× above recommended ceiling

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-page-size
- **File:** `apps/api/src/skills/skills.service.ts:62-63`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-019` · audit-confidence: high · found_by: performance

**Description:**
The skills `findAll` (and identically departments.service.ts:80-81, services.service.ts:102-103) defaults to limit=1000 and clamps at 1000. The PERFORMANCE checklist ceiling is 100. Every call that omits `limit` fetches all rows including nested `_count` relations. The same pattern is repeated verbatim in DepartmentsService.findAll and ServicesService.findAll.

**Root cause:**
Developer chose a 1000-row default/ceiling to avoid needing pagination logic on the frontend, treating the API as a thin wrapper over the full table rather than a paginated resource.

**Code evidence:**
```
  async findAll(page = 1, limit = 1000, category?: SkillCategory) {
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Lower default to 50 and hard cap to 100: `const safeLimit = Math.min(limit || 50, 100);`. Apply to all three services (skills, departments, services). Update frontend callers that rely on the all-rows behavior to either paginate or use a dedicated `findAll` (no-pagination) endpoint with RBAC guard.

**Acceptance criteria:**
1. GET /skills returns at most 100 rows per page when limit is absent or > 100
2. Same cap applies to GET /departments and GET /services
3. A query with limit=9999 returns exactly 100 rows, not 9999
4. Commit message includes `[closes PER-019]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s 'http://localhost:3000/api/skills?limit=9999' | jq '.meta.limit' # should be <= 100
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same pattern at apps/api/src/departments/departments.service.ts:80-81 and apps/api/src/services/services.service.ts:102-103 — all three need the same fix. Verbatim evidence verified in all three files. No global validation pipe or controller-level cap found that would override the 1000-row default.

**Closed_by:** (empty — TODO)

---

### PER-027 — findAll tasks allows limit=1000 — 10x higher than documented default, no hard cap at reasonable size

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/tasks/tasks.service.ts:305`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-027` · audit-confidence: high · found_by: performance

**Description:**
The default limit is `10` in the function signature (line 296) but `Math.min(limit || 1000, 1000)` means when limit is not passed the fallback is `10 || 1000 = 1000` because JS truthy: `10` is truthy so `10 || 1000 = 10`. However when a caller passes `limit=0` or `limit=null`, the fallback resolves to 1000 items, and callers can pass any value up to 1000. With the included joins (project, assignee, assignees.user, _count), 1000 tasks with their joins is a very heavy payload — easily 100KB+. The default parameter `limit = 10` is overridden immediately by the `|| 1000` on line 305.

**Root cause:**
The safeLimit expression `limit || 1000` substitutes 1000 for falsy values but also silently allows any caller to request up to 1000 rows with heavy includes.

**Code evidence:**
```
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
```

**Suggested fix:**
Reduce the hard cap: `const safeLimit = Math.min(limit ?? 10, 100);`. If 1000 is a business requirement, add `select` projection to limit the columns returned and document the cap explicitly.

**Acceptance criteria:**
1. GET /tasks?limit=1000 returns at most 100 rows (or the defined max)
2. GET /tasks with no limit returns the default page size (e.g. 10 or 20)
3. Commit message includes `[closes PER-027]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s 'http://localhost:3001/tasks?limit=1000' | jq '.meta.limit'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The same pattern appears in comments.service.ts and documents.service.ts (both use `Math.min(limit || 1000, 1000)` with default 1000). Adversarial note: the description's JS truthy reasoning is partially inverted (10 IS truthy, so default=10 path is correct; the problem is callers CAN pass limit=1000 explicitly). The substance of the finding is confirmed — the hard cap is 1000 with heavy includes.

**Closed_by:** (empty — TODO)

---

### SEC-024 — Unbounded date range in GET /telework triggers O(days × rules) sequential DB queries with no upper bound

- **Status:** TODO
- **Phase:** 2
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · DoS / query-amplification
- **File:** `apps/api/src/telework/telework.service.ts:180-182`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-024` · audit-confidence: high · found_by: security

**Description:**
The findAll service method calls expandRecurringRulesForRange whenever both startDate and endDate query params are provided. That private method iterates over every calendar day in the range for every active recurring rule, issuing up to two sequential Prisma queries per matching day (findUnique + create). There is no upper bound on the date range accepted from the user-supplied query params. A user with telework:read (any authenticated user who has permission to list telework) can pass startDate=1970-01-01&endDate=2099-12-31, causing ~47,450 loop iterations per rule. With, e.g., 10 active rules each covering one day per week, this translates to ~7,000 sequential DB queries per request, effectively DoS-ing the database connection pool for the duration of the call.

**Root cause:**
expandRecurringRulesForRange is called with unvalidated user-supplied date strings and performs N×M sequential DB I/O with no range cap or batching.

**Code evidence:**
```
    // Auto-expand recurring rules into individual schedules for the requested range
    if (startDate && endDate) {
      await this.expandRecurringRulesForRange(startDate, endDate, userId);
    }
```

**Suggested fix:**
1. Add a maximum range cap in the controller or service (e.g., 366 days): reject or clamp if endDate - startDate > 366 days.
2. Alternatively, move the recurring-rule expansion to a background job / cron and remove the inline call from findAll.
3. Short-term: add @IsDateString() validation on the query params and validate that endDate >= startDate and the range <= 366 days in the service before calling expandRecurringRulesForRange.

**Acceptance criteria:**
1. GET /api/telework?startDate=1970-01-01&endDate=2099-12-31 returns HTTP 400 with a message about the date range.
2. GET /api/telework?startDate=2026-01-01&endDate=2026-12-31 (366 days) completes in under 2 seconds regardless of the number of active recurring rules.
3. Commit message includes `[closes SEC-024]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
time curl -s 'http://localhost:4000/api/telework?startDate=2020-01-01&endDate=2026-12-31' -H 'Authorization: Bearer <user_token>' > /dev/null
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim code verified at telework.service.ts lines 179-182 (comment on 179, if-block on 180-182). No range cap exists anywhere in the service, controller, or global pipes — startDate/endDate are raw @Query() strings with no DTO class-validator constraints. The expandRecurringRulesForRange private method (lines 292-362) confirms the O(days × rules) sequential DB I/O pattern with findUnique + create per matching day. The same issue exists in generateSchedulesFromRules (lines 855-942), triggered by POST /telework/recurring-rules/generate. findForPlanningOverview (line 246) uses internal callers … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### PER-002 — assertCanAccessProject issues two project.count queries for the same projectId

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · redundant-db-query
- **File:** `apps/api/src/common/services/access-scope.service.ts:85-98`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-002` · audit-confidence: high · found_by: performance

**Description:**
`assertCanAccessProject` first executes `project.count({ where: { id: projectId } })` to check existence, then calls `canAccessProject` which immediately executes a second `project.count({ where: { id: projectId, ...projectAccessWhere(user) } })`. For privileged callers (who have `projects:manage_any`) the second count is skipped, but for all other callers two round-trips hit the projects table for every guarded endpoint. This pattern fires on `getProjectStats`, `getSnapshots`, `findOne`, and the milestones/epics ownership assertion path.

**Root cause:**
Existence check and access check are two separate `count` queries instead of a single combined query whose result encodes both.

**Code evidence:**
```
  async assertCanAccessProject(
    projectId: string,
    user: AccessUser | undefined,
    bypassPermissions: readonly string[] = ['projects:manage_any'],
  ): Promise<void> {
    const projectExists = await this.prisma.project.count({
      where: { id: projectId },
    });
    if (projectExists === 0) throw new NotFoundException('Projet introuvable');

    if (!(await this.canAccessProject(projectId, user, bypassPermissions))) {
      throw new ForbiddenException('Accès projet non autorisé');
```

**Suggested fix:**
Merge both counts into one: if `canAccessProject` returns false, distinguish 404 from 403 by running a bare `project.count({ where: { id: projectId } })` only on that failure path. Alternatively, `assertCanAccessProject` can run a single `project.count` with the combined `AND [{ id: projectId }, projectAccessWhere(user)]` condition; a zero result maps to 404 only when a bare-id count is also zero (one extra query only in the error path).

**Acceptance criteria:**
1. A successful GET /projects/:id by a CONTRIBUTEUR triggers exactly 1 project DB query for the access gate (verifiable via Prisma query log)
2. 404 is still returned for a non-existent id
3. 403 is still returned for an existing id outside the user's scope
4. Commit message includes `[closes PER-002]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same double-query pattern exists in assertCanManageUser (access-scope.service.ts line 282-294) for the users module. canAccessProject confirmed to return early for bypass users (line 74: `if (await this.hasAny(user, bypassPermissions)) return true`), so only non-privileged callers hit the double count.

**Closed_by:** (empty — TODO)

---

### PER-003 — assertCanAssignRole executes 4 DB queries when the caller is not ADMIN (resolveTemplateKey called twice in assertCanAssignRole + twice again in canAssignRole)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · redundant-db-query
- **File:** `apps/api/src/common/services/role-hierarchy.service.ts:83-103`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-003` · audit-confidence: high · found_by: performance

**Description:**
`assertCanAssignRole` resolves both role templateKeys (2 DB queries), then if neither is ADMIN it calls `canAssignRole(callerRoleCode, targetRoleCode)` which resolves the same two templateKeys again (2 more DB queries). Net result: 4 `role.findUnique` calls for the non-ADMIN path. This fires on every user create, update, import row, and password reset. `resolveTemplateKey` has no cache.

**Root cause:**
`canAssignRole` is a public method that does its own template resolution; `assertCanAssignRole` cannot pass the already-resolved keys to it.

**Code evidence:**
```
  async assertCanAssignRole(
    callerRoleCode: string | null | undefined,
    targetRoleCode: string | null | undefined,
  ): Promise<void> {
    if (!callerRoleCode || !targetRoleCode) return;
    const [targetTemplateKey, callerTemplateKey] = await Promise.all([
      this.resolveTemplateKey(targetRoleCode),
      this.resolveTemplateKey(callerRoleCode),
    ]);
    if (targetTemplateKey === 'ADMIN' && callerTemplateKey !== 'ADMIN') {
      throw new ForbiddenException(
        'Seul un administrateur peut cibler un rôle rattaché au template ADMIN',
      );
    }
    if (callerTemplateKey === 'ADMIN') return;
    if (!(await this.canAssignRole(callerRoleCode, targetRoleCode))) {
```

**Suggested fix:**
Extract a private `_canAssignRoleFromKeys(callerTplKey, targetTplKey): boolean` that takes pre-resolved keys, and have both `canAssignRole` and `assertCanAssignRole` call it after the resolution step. Alternatively, add simple in-process memoization (Map<code, templateKey>) since templateKeys are stable for the lifetime of a request.

**Acceptance criteria:**
1. POST /users triggers exactly 2 role.findUnique calls for the hierarchy check (not 4)
2. POST /users/import with 100 rows triggers 200 role.findUnique calls at most (2 per row), not 400
3. Commit message includes `[closes PER-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: resolveTemplateKey confirmed to do a raw `prisma.role.findUnique` with no caching. canAssignRole confirmed to call resolveTemplateKey twice independently via Promise.all.

**Closed_by:** (empty — TODO)

---

### PER-004 — assertProjectMembership in EpicsService fetches all project members (include: { project: { include: { members: true } } })

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n+1-query
- **File:** `apps/api/src/epics/epics.service.ts:115-123`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-004` · audit-confidence: high · found_by: performance

**Description:**
To check if a user is a member of an epic's project, the guard fetches ALL ProjectMember rows for that project (unbounded) and filters in-memory. A project with 100 members transfers 100 rows over the wire when a simple `count` with a WHERE clause would suffice. The same pattern is replicated in `milestones.service.ts` at line 150-158.

**Root cause:**
`include: { members: true }` fetches the entire members relation instead of using a targeted `project.count` or `projectMember.count` with a `{ projectId, userId }` filter.

**Code evidence:**
```
    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      include: { project: { include: { members: true } } },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');

    const isMember = epic.project.members.some((m) => m.userId === userId);
```

**Suggested fix:**
Replace the include+in-memory filter with a direct membership count:
ʼʼʼts
const memberCount = await this.prisma.projectMember.count({
  where: { projectId: epic.projectId, userId },
});
if (memberCount === 0) throw new ForbiddenException('Not a member of this project');
ʼʼʼ
This requires reading `epic.projectId` from a separate slim query first, or including only `{ project: { select: { id: true } } }` in the epic lookup.

**Acceptance criteria:**
1. PATCH /epics/:id makes at most 3 DB queries for a non-admin caller (permissions lookup, epic select, membership count)
2. Same fix applied to milestones.service.ts assertProjectMembership
3. Commit message includes `[closes PER-004]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: milestones.service.ts line 150-158 has the identical issue: `include: { project: { include: { members: true } } }`. Both confirmed verbatim.

**Closed_by:** (empty — TODO)

---

### PER-005 — Recurring event creation: sequential per-occurrence `event.create` loop — N DB round-trips on request path

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1-sequential-writes
- **File:** `apps/api/src/events/events.service.ts:233-245`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-005` · audit-confidence: high · found_by: performance

**Description:**
When creating a recurring event without an explicit `recurrenceEndDate`, the service defaults to 1 year of occurrences. With `recurrenceWeekInterval=1` this is ~52 occurrences, each inserted by an individual awaited `prisma.event.create`. If a user passes a far-future `recurrenceEndDate` (e.g. 5 years), that is ~260 sequential DB round-trips per request, all on the synchronous request path, blocking the Fastify worker. The DTO only caps `recurrenceWeekInterval` (max 52) but places NO upper bound on `recurrenceEndDate`.

**Root cause:**
Sequential `await` inside a `for` loop where a batch insert (`createMany`) or a single transaction with nested creates would suffice.

**Code evidence:**
```
      for (const occ of occurrences) {
        await this.prisma.event.create({
          data: {
            ...occ,
            ...(participantIds &&
              participantIds.length > 0 && {
                participants: {
                  create: participantIds.map((userId) => ({ userId })),
                },
              }),
          },
        });
      }
```

**Suggested fix:**
For occurrences without participants: replace the `for` loop with a single `this.prisma.event.createMany({ data: occurrences })`. For occurrences with participants: collect all participant rows and insert them in one `this.prisma.eventParticipant.createMany` after getting the auto-generated IDs (or generate UUIDs in application code to avoid the round-trip). Also cap `recurrenceEndDate` in the DTO with a max horizon (e.g. 2 years from `date`).

**Acceptance criteria:**
1. Creating a recurring weekly event for 1 year executes at most 3 DB statements (1 parent create, 1 createMany for occurrences, 1 createMany for participants)
2. DTO rejects `recurrenceEndDate` more than 2 years after `date`
3. No regression on event.id returned by the endpoint
4. Commit message includes `[closes PER-005]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'await this.prisma.event.create\|createMany' apps/api/src/events/events.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The comment at line 230-232 ('PER-024: use per-occurrence event.create with nested participants to avoid the createMany→findMany round-trip') was a prior fix that introduced this new pattern. The rationale is valid for participant nesting but the batch insert path for events without participants was not preserved. Verified: CreateEventDto has @Max(52) on recurrenceWeekInterval but no constraint at all on recurrenceEndDate (line 149-151 of create-event.dto.ts).

**Closed_by:** (empty — TODO)

---

### PER-010 — importMilestones executes N sequential findFirst + create per milestone

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n+1-query
- **File:** `apps/api/src/milestones/milestones.service.ts:193-224`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-010` · audit-confidence: high · found_by: performance

**Description:**
For each milestone in the import batch the loop makes a `milestone.findFirst` duplicate check followed by a `milestone.create`, producing 2N sequential database round-trips. The `validateImport` method correctly pre-fetches all existing names into a Set (line 268-274), but the actual `importMilestones` does not reuse this pattern.

**Root cause:**
The `importMilestones` loop was written without the pre-batch optimization used by `validateImport`; no max batch size is enforced.

**Code evidence:**
```
    for (let i = 0; i < milestones.length; i++) {
      const milestoneData = milestones[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      try {
        // Vérifier que le nom n'existe pas déjà dans le projet
        const existingMilestone = await this.prisma.milestone.findFirst({
          where: {
            projectId,
            name: milestoneData.name,
          },
        });
```

**Suggested fix:**
Pre-fetch existing milestone names with a single `findMany` before the loop (mirror `validateImport` line 268-274), build a Set, then use `createMany` for new milestones in a single batch. Add a `@Max(500)` decorator on `ImportMilestonesDto.milestones`.

**Acceptance criteria:**
1. POST /milestones/project/:id/import with 200 milestones makes at most 3 DB queries (findUnique project, findMany existing, createMany)
2. Duplicate detection by name still works
3. Commit message includes `[closes PER-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ImportMilestonesDto.milestones has no @Max constraint — batch size is unbounded.

**Closed_by:** (empty — TODO)

---

### PER-011 — ICS import: sequential `event.create` per VEVENT — up to 5MB/N-event sequential writes with no count cap

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1-sequential-writes
- **File:** `apps/api/src/planning-export/planning-export.service.ts:219-267`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-011` · audit-confidence: high · found_by: performance

**Description:**
The ICS import accepts up to 5 MB of ICS content (per `MaxLength(5 * 1024 * 1024)` in the DTO). A well-formed 5 MB ICS file can contain several thousand VEVENT components (a minimal VEVENT is ~150 bytes). Each event is inserted via an individual awaited `prisma.event.create` inside a sequential `for` loop — no batch, no transaction, no count limit. This produces potentially thousands of sequential DB round-trips on the HTTP request path.

**Root cause:**
No upper bound on the number of events imported in one request; sequential `await` inside loop instead of batch insert.

**Code evidence:**
```
    for (const key of Object.keys(parsed)) {
      const component = parsed[key];
      if (!component || component.type !== 'VEVENT') continue;

      const vevent = component;
      const start = vevent.start;
      if (!start) {
        skipped++;
        continue;
      }

      try {
        const end = vevent.end;
        const isDateOnly = !!(start as unknown as { dateOnly?: boolean })
          .dateOnly;

        const isAllDay =
```

**Suggested fix:**
1) Add an event-count cap in the DTO or at the service level (e.g. `MAX_IMPORT_EVENTS = 500`). 2) Replace the sequential loop with `prisma.event.createMany({ data: batch, skipDuplicates: true })` inside a transaction. 3) For very large imports, consider returning immediately with a job ID and processing asynchronously.

**Acceptance criteria:**
1. Importing an ICS with 1000 events is rejected (or capped) at the validated limit
2. Importing 100 events executes 1 DB statement (createMany), not 100
3. POST /planning-export/ics/import returns within 500ms for any valid input
4. Commit message includes `[closes PER-011]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'await this.prisma.event.create\|createMany\|MAX_IMPORT' apps/api/src/planning-export/planning-export.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The 5MB MaxLength was presumably set to limit payload size; it does not prevent high event count since ICS events are small. A dedicated `@Max()` on event count is needed. Verified: line 251 has `await this.prisma.event.create(...)` inside the for loop with no count accumulator or cap.

**Closed_by:** (empty — TODO)

---

### PER-012 — createBulkAssignment: one DB INSERT per (user × date) pair — sequential awaits in nested loop, no transaction

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:302-330`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-012` · audit-confidence: high · found_by: performance

**Description:**
For N users and M dates, the nested loop issues N×M individual `predefinedTaskAssignment.create` calls with sequential `await`. No transaction, no `createMany`. BulkAssignmentDto has `ArrayMinSize(1)` but no `ArrayMaxSize`, so a caller can pass 100 users × 100 dates = 10,000 sequential DB inserts per HTTP request.

**Root cause:**
Missing `createMany` batching and missing array size caps on the DTO.

**Code evidence:**
```
    for (const userId of dto.userIds) {
      for (const dateStr of dto.dates) {
        try {
          await this.prisma.predefinedTaskAssignment.create({
            data: {
              predefinedTaskId: dto.predefinedTaskId,
              userId,
              date: new Date(dateStr),
              period: dto.period,
              assignedById,
              isRecurring: false,
            },
          });
```

**Suggested fix:**
1. Add `@ArrayMaxSize(50)` on `userIds` and `@ArrayMaxSize(90)` on `dates` in BulkAssignmentDto. 2. Replace the nested loop with `prisma.predefinedTaskAssignment.createMany({ data: allPairs, skipDuplicates: true })` — wraps the entire batch in one statement. 3. Wrap in a transaction for atomicity.

**Acceptance criteria:**
1. POST /predefined-tasks/assignments/bulk with 50 users × 30 dates issues 1 DB statement instead of 1500
2. BulkAssignmentDto rejects userIds > 50 with 400
3. BulkAssignmentDto rejects dates > 90 with 400
4. Commit message includes `[closes PER-012]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed: BulkAssignmentDto has only @ArrayMinSize(1) on both userIds and dates — no upper bound. The 1 MiB bodyLimit limits the raw payload size but does not bound the number of DB round trips for a payload under 1 MiB.

**Closed_by:** (empty — TODO)

---

### PER-013 — bulkCreateRecurringRules: one DB INSERT per (user × dayOfWeek) inside a transaction — sequential awaits

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:448-486`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-013` · audit-confidence: high · found_by: performance

**Description:**
Inside a transaction, two nested for-loops call `tx.predefinedTaskRecurringRule.create` sequentially per (user, dayOfWeek) pair. With N users and D days (1–7), this is N×D sequential INSERTs inside a long-held transaction. `CreateBulkRecurringRulesDto` validates `userIds.length >= 1` and `daysOfWeek.length >= 1` but no max size cap.

**Root cause:**
Missing `createMany` batching; `create` in a loop inside a transaction holds the transaction open for N×D round trips.

**Code evidence:**
```
    const rules = await this.prisma.$transaction(async (tx) => {
      const created: any[] = [];
      for (const userId of dto.userIds) {
        for (const dayOfWeek of dto.daysOfWeek) {
          const rule = await tx.predefinedTaskRecurringRule.create({
            data: {
              predefinedTaskId: dto.predefinedTaskId,
              userId,
              dayOfWeek,
              period: dto.period,
              weekInterval,
              startDate: new Date(dto.startDate),
              ...(dto.endDate && { endDate: new Date(dto.endDate) }),
              createdById,
              isActive: true,
            },
```

**Suggested fix:**
Use `tx.predefinedTaskRecurringRule.createMany({ data: allRules })` after building the data array in memory. Add `@ArrayMaxSize` on both `userIds` and `daysOfWeek`.

**Acceptance criteria:**
1. POST /predefined-tasks/recurring-rules/bulk issues 1 createMany statement instead of N×D creates
2. DTO rejects userIds > 50 with 400
3. Commit message includes `[closes PER-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed: CreateBulkRecurringRulesDto has no @ArrayMaxSize on userIds. daysOfWeek is bounded by @Min(0)/@Max(6) per element (0-6 = at most 7 values) which partially mitigates the day dimension, but userIds has no upper bound.

**Closed_by:** (empty — TODO)

---

### PER-014 — generateFromRules: one DB INSERT per occurrence date, sequential await inside nested for-loop

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:565-610`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-014` · audit-confidence: high · found_by: performance

**Description:**
Two nested loops: outer loop over all active rules, inner loop over all generated dates per rule. Each inner iteration `await`s a single `create`. For a 3-month range with 50 active rules, each weekly, this generates approximately 50 × 13 = 650 sequential INSERT statements. There is no date range validation to prevent extremely wide ranges (e.g. 5 years), and no batch insert.

**Root cause:**
Missing `createMany` for the batch of assignments generated by a rule; missing date range cap in `GenerateFromRulesDto`.

**Code evidence:**
```
    for (const rule of rules) {
      // Adapter Prisma record → RuleLike interface
      const ruleLike: RuleLike = {
        id: rule.id,
        recurrenceType: (rule.recurrenceType ?? 'WEEKLY') as
          | 'WEEKLY'
          | 'MONTHLY_ORDINAL'
          | 'MONTHLY_DAY',
        dayOfWeek: rule.dayOfWeek,
        weekInterval: rule.weekInterval ?? 1,
        monthlyOrdinal: rule.monthlyOrdinal,
        monthlyDayOfMonth: rule.monthlyDayOfMonth,
        startDate: rule.startDate,
        endDate: rule.endDate ?? null,
        isActive: rule.isActive,
      };

      const dates = generateOccurrences(ruleLike, rangeStart, rangeEnd);

      for (const date of dates) {
        try {
          await this.prisma.predefinedTaskAssignment.create({
```

**Suggested fix:**
1. Add max date range validation in `GenerateFromRulesDto` (e.g. max 3 months). 2. Collect all dates across all rules and call `prisma.predefinedTaskAssignment.createMany({ data: allAssignments, skipDuplicates: true })` once. This collapses all inserts to 1 statement.

**Acceptance criteria:**
1. POST /predefined-tasks/recurring-rules/generate issues at most 2 DB statements (1 select rules + 1 createMany assignments)
2. Date range > 3 months is rejected with 400
3. All assignments are atomic (succeed or fail together)
4. Commit message includes `[closes PER-014]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed: GenerateFromRulesDto has only @IsDateString()/@IsNotEmpty() on startDate and endDate — no max-range constraint. Any date range is accepted.

**Closed_by:** (empty — TODO)

---

### PER-020 — importSkills() issues one INSERT per row in a serial for-loop with no upper bound on input array size — N sequential DB roundtrips

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-import-serial-writes
- **File:** `apps/api/src/skills/skills.service.ts:693-731`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-020` · audit-confidence: high · found_by: performance

**Description:**
The import endpoint accepts an `ImportSkillsDto` whose `skills` array has no `@ArrayMaxSize` validator (confirmed by reading import-skills.dto.ts). For N items, `importSkills` issues N sequential `prisma.skill.create()` calls inside a for-loop. A user with `skills:create` permission (ADMIN/RESPONSABLE) can accidentally or intentionally POST an oversized payload (e.g. a full CSV of thousands of rows) and tie up a DB connection for the entire duration. There is no batch INSERT or transaction wrapper either.

**Root cause:**
No upper-bound decorator on the DTO array and no batch INSERT strategy — the service loops individually over every element.

**Code evidence:**
```
    for (let i = 0; i < skills.length; i++) {
      const skillData = skills[i];
      const lineNum = i + 2;

      try {
        // Vérifier que le nom n'existe pas déjà (case-insensitive)
        const nameLower = skillData.name.toLowerCase();
        if (existingNames.has(nameLower)) {
          result.skipped++;
          continue;
        }

        // Créer la compétence
        await this.prisma.skill.create({
```

**Suggested fix:**
1. Add `@ArrayMaxSize(500)` (or a business-appropriate ceiling, e.g. 200) to `ImportSkillsDto.skills` in import-skills.dto.ts. 2. Replace the loop with `prisma.skill.createMany({ data: validSkills, skipDuplicates: true })` inside a single transaction. Collect validation errors before the batch rather than per-row.

**Acceptance criteria:**
1. POST /skills/import with skills.length > 500 returns HTTP 400
2. A valid import of 200 skills completes in a single DB round-trip (verified via query log)
3. No connection pool starvation when 5 concurrent large-import requests are made by authorized users
4. Commit message includes `[closes PER-020]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: import-skills.dto.ts confirmed: `@IsArray()` and `@ValidateNested({ each: true })` present but no `@ArrayMaxSize` decorator. Serial for-loop at lines 693-731 verbatim confirmed with `await this.prisma.skill.create()` inside the loop. validateImport (line 576) has the same loop but only performs one pre-load findMany then Set-based lookups, so no per-row DB call. The missing @ArrayMaxSize still allows oversized payloads to consume memory during JSON parse.

**Closed_by:** (empty — TODO)

---

### PER-026 — reorderSubtasks: one DB UPDATE per subtask in a transaction — N sequential round trips

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · N+1 / sequential await in loop
- **File:** `apps/api/src/tasks/tasks.service.ts:2051-2058`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-026` · audit-confidence: medium · found_by: performance

**Description:**
The reorder operation maps each subtask ID to a separate `update` call inside a Prisma interactive transaction. Prisma's array-form `$transaction` sends each update as a separate statement. For N subtasks this is N DB round trips inside one transaction. The `ReorderSubtasksDto` has no max array size.

**Root cause:**
No batched upsert or raw UPDATE … CASE statement; each position change is a separate DB query.

**Code evidence:**
```
    await this.prisma.$transaction(
      subtaskIds.map((id, index) =>
        this.prisma.subtask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
```

**Suggested fix:**
Use a raw SQL UPDATE … CASE … WHEN or `prisma.$executeRaw` to update all positions in a single statement. Add `@ArrayMaxSize(100)` to `ReorderSubtasksDto.subtaskIds`.

**Acceptance criteria:**
1. POST /tasks/:id/subtasks/reorder with 50 subtasks issues 1 SQL statement
2. DTO validates subtaskIds.length <= 100
3. Commit message includes `[closes PER-026]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The impact is lower than P2-7/8 because subtask counts are typically small (< 20). Still a design smell. Confirmed: ReorderSubtasksDto has only @IsArray() and @IsUUID — no @ArrayMaxSize.

**Closed_by:** (empty — TODO)

---

### PER-028 — expandRecurringRulesForRange: N+1 findUnique+create inside nested loop over days × rules

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1
- **File:** `apps/api/src/telework/telework.service.ts:328-361`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-028` · audit-confidence: high · found_by: performance

**Description:**
For each active rule, for each calendar day in the requested range that matches the rule's weekday, the code issues one `findUnique` query and potentially one `create` query. With R rules and a 30-day window, this is up to R×5 `findUnique` calls (one per weekday occurrence). Since `findAll` calls this method on every read request that includes a date range, this N+1 fan-out fires on every listing call, not just during schedule generation.

**Root cause:**
The existence check is done row-by-row inside a sequential async loop instead of bulk-loading existing schedules for the entire (userIds × date range) and computing the missing set in memory before issuing batched inserts.

**Code evidence:**
```
      while (cursorKey <= endKey) {
        const modelDay = modelDayOfWeekFromKey(cursorKey);

        if (
          modelDay === rule.dayOfWeek &&
          cursorKey >= ruleStartKey &&
          (!ruleEndKey || cursorKey <= ruleEndKey)
        ) {
          const dateOnly = dayKeyToUTCDate(cursorKey);

          const existing = await this.prisma.teleworkSchedule.findUnique({
            where: {
              userId_date: {
                userId: rule.userId,
                date: dateOnly,
```

**Suggested fix:**
Pre-load all existing `TeleworkSchedule` rows for the (ruleUserIds × date range) with a single `findMany`, store them in a `Set<string>` keyed on `${userId}|${dateKey}`, then collect missing dates and issue a single `createMany` (or batched `$transaction`).

**Acceptance criteria:**
1. GET /telework with a 6-month date range issues at most 2 DB queries (load rules + load existing schedules) before inserting missing rows
2. Correctness: same schedules are materialised as before
3. Commit message includes `[closes PER-028]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 328-361. findForPlanningOverview (line 246) also calls expandRecurringRulesForRange before its own findMany, confirming the fan-out fires on every planning read.

**Closed_by:** (empty — TODO)

---

### PER-029 — generateSchedulesFromRules: same N+1 findUnique+create loop as expandRecurringRulesForRange

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1
- **File:** `apps/api/src/telework/telework.service.ts:888-934`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-029` · audit-confidence: high · found_by: performance

**Description:**
POST /telework/recurring-rules/generate replicates the same sequential findUnique + create loop. Materialising a 6-month window for 30 users with 3 rules each involves ~1350 individual DB round-trips (one findUnique per matching day per rule). The issue is identical in structure to finding P3-3 but in an explicit admin endpoint, where the user controls the date range (bounded only by the DTO, which has no documented upper limit on the range length).

**Root cause:**
No bulk existence check; each day is probed independently within a sequential `for` loop.

**Code evidence:**
```
      while (cursorKey <= endKey) {
        const modelDay = modelDayOfWeekFromKey(cursorKey);

        if (
          modelDay === rule.dayOfWeek &&
          cursorKey >= ruleStartKey &&
          (!ruleEndKey || cursorKey <= ruleEndKey)
        ) {
          const dateOnly = dayKeyToUTCDate(cursorKey);

          // Skip si déjà existant
          const existing = await this.prisma.teleworkSchedule.findUnique({
            where: {
              userId_date: {
                userId: rule.userId,
                date: dateOnly,
```

**Suggested fix:**
Same as P3-3: bulk-load existing schedules for all (userId × date range) combinations with one `findMany`, compute missing slots in memory, then insert via `createMany` or chunked `$transaction([...creates])`.

**Acceptance criteria:**
1. POST /telework/recurring-rules/generate for a 1-year range issues O(rules) queries for lookups + 1 bulk insert, not O(rules × weekday occurrences) individual queries
2. Created/skipped counts remain accurate
3. Commit message includes `[closes PER-029]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 888-934. The await is inside both the for-rule loop and the while-day loop, confirming fully sequential execution.

**Closed_by:** (empty — TODO)

---

### COR-011 — CreateDocumentDto.size has no @IsNumber() or @Min(0) — negative/float sizes accepted

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing validator / business invariant gap
- **File:** `apps/api/src/documents/dto/create-document.dto.ts:88-90`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-011` · audit-confidence: high · found_by: correctness

**Description:**
The `size` field carries only `@IsNotEmpty()` — which checks for non-empty/null/undefined but does NOT validate that the value is a number, an integer, or non-negative. `@IsNotEmpty()` on a number type passes `0` and any negative value. The service's upper-bound check (`size > MAX_DOCUMENT_SIZE_BYTES` in documents.service.ts:50) only rejects oversized values; it does not reject negative sizes (e.g., `size: -1` would satisfy `!isNotEmpty && -1 < 200_000_000`). There is no `@IsInt()`, `@IsNumber()`, or `@Min(0)` decorator. A client can store a document with `size: -1` or `size: 3.14`, which is semantically invalid for a byte count and may cause incorrect quota calculations.

**Root cause:**
Missing class-validator numeric type decorators on the `size` field; only an upper-bound guard was added at the service layer.

**Code evidence:**
```
  @ApiProperty({ description: 'Taille en bytes', example: 2048576 })
  @IsNotEmpty()
  size: number;
```

**Suggested fix:**
Add `@IsInt()` and `@Min(0)` (both from `class-validator`) to `size` in `CreateDocumentDto`. Also check that `UpdateDocumentDto` (via `PartialType`) inherits these constraints.

**Acceptance criteria:**
1. POST /documents with size: -1 returns 400 Bad Request
2. POST /documents with size: 3.14 returns 400 Bad Request
3. POST /documents with size: 0 succeeds (zero-byte documents are valid)
4. Commit message includes `[closes COR-011]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'IsInt\|IsNumber\|Min\|size' apps/api/src/documents/dto/create-document.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The service-side check `createDocumentDto.size > MAX_DOCUMENT_SIZE_BYTES` is bypassed by any negative value, and only applies in create(), not in update().

**Closed_by:** (empty — TODO)

---

### SEC-008 — ImportLeavesDto.leaves array has no upper-bound limit, enabling memory-exhaustion via large payloads

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input validation / DoS
- **File:** `apps/api/src/leaves/dto/import-leaves.dto.ts:61-70`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-008` · audit-confidence: high · found_by: security

**Description:**
The `leaves` array in `ImportLeavesDto` has no `@ArrayMaxSize()` constraint. While the global body limit is 1 MiB (main.ts), a 1 MiB JSON array of `ImportLeaveDto` objects can contain several thousand rows. The `importLeaves()` service method then iterates all rows, calling `getHolidayKeySet()` (a DB query) on each row inside a transaction, plus `findValidatorForUser()` for each row. This can translate to thousands of sequential DB queries per import call, causing significant CPU/DB load. The `validateImport` endpoint (dry-run) has the same issue and even loads ALL active users into memory upfront. Both endpoints require only `leaves:create` permission (not a restricted admin-only permission), so any contributor-level user can trigger this.

**Root cause:**
No `@ArrayMaxSize(N)` decorator on `ImportLeavesDto.leaves`; no per-request DB query budget inside `importLeaves()`.

**Code evidence:**
```
export class ImportLeavesDto {
  @ApiProperty({
    description: 'Liste des congés à importer',
    type: [ImportLeaveDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLeaveDto)
  leaves: ImportLeaveDto[];
}
```

**Suggested fix:**
Add `@ArrayMaxSize(500)` (or a configurable limit) to `ImportLeavesDto.leaves`. Consider batching `getHolidayKeySet` calls across the entire date range rather than per row, and caching `findValidatorForUser` results per userId within the batch.

**Acceptance criteria:**
1. POST /leaves/import with `leaves` containing 501 items returns HTTP 400.
2. POST /leaves/import/validate with 501 items returns HTTP 400.
3. Commit message includes `[closes SEC-008]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: POST /leaves/import with payload {"leaves": [... 501 items ...]}, expect 400.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The body limit of 1 MiB (SEC-025) mitigates extreme cases but does not prevent the hundreds-of-rows scenario. Adversarial review confirmed: import-leaves.dto.ts lines 61-70 verbatim, no @ArrayMaxSize present. No compensating per-request row limit found elsewhere in the controller or service.

**Closed_by:** (empty — TODO)

---

### SEC-014 — BulkAssignmentDto.userIds and BulkAssignmentDto.dates have no @ArrayMaxSize — cartesian product DoS

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/predefined-tasks/dto/bulk-assignment.dto.ts:22-39`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-014` · audit-confidence: high · found_by: security

**Description:**
The `createBulkAssignment` endpoint accepts arbitrary-length `userIds` and `dates` arrays with only a minimum size of 1. The service iterates `userIds × dates` (cartesian product) with sequential Prisma `create` calls inside the loop. A caller with `predefined_tasks:assign` can submit 1000 users × 365 dates = 365 000 DB insert attempts in one request. The same issue affects `CreateBulkRecurringRulesDto.userIds` and `daysOfWeek`.

**Root cause:**
Bulk operation DTOs were not bounded with @ArrayMaxSize on either dimension.

**Code evidence:**
```
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  dates: string[];
```

**Suggested fix:**
Add `@ArrayMaxSize(100)` to `userIds` and `@ArrayMaxSize(365)` to `dates` in `BulkAssignmentDto`. Apply equivalent limits to `CreateBulkRecurringRulesDto.userIds` and `.daysOfWeek`. Enforce the same in the service as a defence-in-depth check.

**Acceptance criteria:**
1. POST /predefined-tasks/assignments/bulk with 101 userIds returns HTTP 400
2. POST /predefined-tasks/recurring-rules/bulk with 101 userIds returns HTTP 400
3. Commit message includes `[closes SEC-014]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: craft a body with large userIds/dates arrays, confirm 400 is returned after the fix
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review: verbatim code confirmed at bulk-assignment.dto.ts lines 26-39. @ArrayMinSize(1) present, no @ArrayMaxSize on either field. Finding confirmed. The daysOfWeek array in CreateBulkRecurringRulesDto is bounded at 0-6 per element but not in count; a validated array of 7 elements is the maximum semantic payload and is fine, but the userIds array is the main risk vector here.

**Closed_by:** (empty — TODO)

---

### SEC-015 — GET /projects/:id/snapshots uses @Param('id') without ParseUUIDPipe

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/projects/projects.controller.ts:183-196`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-015` · audit-confidence: high · found_by: security

**Description:**
Every other route in ProjectsController uses `@Param('id', ParseUUIDPipe)` to validate and sanitize the resource ID. The getSnapshots handler at line 187 uses `@Param('id')` with no pipe. The raw string is then forwarded to projectsService.getSnapshots and used in a Prisma findMany `where: { projectId }`. While Prisma parameterizes values (no SQL injection), an attacker can probe for non-404 responses with arbitrary strings, and the missing UUID validation allows bypass of route-level input contract.

**Root cause:**
ParseUUIDPipe was accidentally omitted from the @Param('id') decorator on the getSnapshots handler.

**Code evidence:**
```
  @Get(':id/snapshots')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get progress snapshots for a project' })
  async getSnapshots(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
```

**Suggested fix:**
Change `@Param('id')` to `@Param('id', ParseUUIDPipe)` on line 187, mirroring all other handlers in the same controller.

**Acceptance criteria:**
1. GET /projects/not-a-uuid/snapshots returns 400 Bad Request
2. GET /projects/<valid-uuid>/snapshots continues to return 200 with results
3. Commit message includes `[closes SEC-015]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'getSnapshots\|ParseUUIDPipe' apps/api/src/projects/projects.controller.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: controller lines 183-196 verbatim confirmed. @Param('id') with no pipe present. All sibling handlers verified to use @Param('id', ParseUUIDPipe). Missing pipe is a real inconsistency.

**Closed_by:** (empty — TODO)

---

### SEC-016 — Snapshot date filter params (from/to) are not validated and passed directly to new Date()

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/projects/projects.service.ts:1244-1249`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-016` · audit-confidence: high · found_by: security

**Description:**
The `from` and `to` query parameters for GET /projects/:id/snapshots are accepted as raw strings in the controller and forwarded to the service without any validation. The service passes them directly to `new Date()`. If an invalid date string is supplied (e.g., `from=not-a-date`), `new Date('not-a-date')` produces an Invalid Date object. Prisma will propagate this as an invalid timestamp to PostgreSQL, likely resulting in a 500 Internal Server Error rather than a 400 Bad Request, leaking stack trace details.

**Root cause:**
No @IsDateString validation is applied to the from/to query parameters before they reach the service.

**Code evidence:**
```
    const where: any = { projectId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
```

**Suggested fix:**
Add a DTO class with `@IsDateString() @IsOptional() from?: string` and `@IsDateString() @IsOptional() to?: string` and apply `@Query() query: SnapshotFilterDto` in the controller. Alternatively add explicit isNaN checks in the service before using the date values.

**Acceptance criteria:**
1. GET /projects/:id/snapshots?from=not-a-date returns 400 Bad Request
2. GET /projects/:id/snapshots?from=2025-01-01&to=2026-01-01 continues to work correctly
3. Commit message includes `[closes SEC-016]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: verified_clean note mentions milestones.service.ts:314-320 isNaN check, but that is in the validateImport preview path — NOT in getSnapshots. The projects.service.ts getSnapshots path at lines 1244-1249 has NO isNaN guard, no try/catch, no DTO validation before new Date(). Finding stands.

**Closed_by:** (empty — TODO)

---

### SEC-018 — ImportSkillsDto.skills array has no @ArrayMaxSize — sequential DB writes enable per-request DoS

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation / DoS
- **File:** `apps/api/src/skills/dto/import-skills.dto.ts:46-55`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-018` · audit-confidence: high · found_by: security

**Description:**
The `skills` array in `ImportSkillsDto` is validated with `@IsArray()` and `@ValidateNested()` but has no `@ArrayMaxSize()` constraint. The global body limit is 1 MiB. A minimal valid skill entry (`{"name":"a","category":"TECHNICAL"}`) is ~35 bytes, allowing approximately 30,000 entries per request. `importSkills()` in `skills.service.ts` processes each item in a sequential `for` loop, performing one `prisma.skill.create()` call per entry (plus an initial `prisma.skill.findMany()`). `validateImport()` similarly iterates with per-item logic. Both endpoints require `skills:create` permission (legitimate users only), but any user holding that role can trigger thousands of DB writes per HTTP request.

**Root cause:**
No `@ArrayMaxSize()` decorator on `ImportSkillsDto.skills`, combined with a sequential per-item DB write loop in the service, means a single large payload causes unbounded database load.

**Code evidence:**
```
export class ImportSkillsDto {
  @ApiProperty({
    description: 'Liste des compétences à importer',
    type: [ImportSkillDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSkillDto)
  skills: ImportSkillDto[];
}
```

**Suggested fix:**
Add `@ArrayMaxSize(500)` (or a similarly small bound) from `class-validator` to the `skills` field in `ImportSkillsDto`. Also convert the sequential loop in `importSkills()` to use `prisma.skill.createMany()` or a batched `$transaction` for efficiency.

**Acceptance criteria:**
1. POST /api/skills/import with skills array > 500 items returns HTTP 400
2. POST /api/skills/import/validate with skills array > 500 items returns HTTP 400
3. POST /api/skills/import with exactly 500 items succeeds (if authorized)
4. Commit message includes `[closes SEC-018]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X POST http://localhost:4000/api/skills/import -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"skills":[{"name":"s","category":"TECHNICAL"}]}' | jq .  # then repeat with 501 items and expect 400
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Both POST /skills/import and POST /skills/import/validate are affected. Verified: ImportSkillsDto at lines 46-54 has no @ArrayMaxSize. importSkills() service method (skills.service.ts lines 693-730) uses a sequential for loop with prisma.skill.create() per item — no batching, no size guard.

**Closed_by:** (empty — TODO)

---

### SEC-020 — ImportTasksDto.tasks has no @ArrayMaxSize — unbounded bulk import enabling DoS

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/tasks/dto/import-tasks.dto.ts:78-87`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-020` · audit-confidence: high · found_by: security

**Description:**
The `tasks` array in `ImportTasksDto` has `@IsArray()` and `@ValidateNested()` but no `@ArrayMaxSize()`. The `importTasks` and `validateImport` service methods iterate over every element in a `for` loop with individual Prisma calls inside each iteration (including a `findFirst` duplicate check, `task.create`, and N × `subtask.create` per task). A caller with `tasks:create` can submit thousands of tasks in a single request. This will (a) consume CPU for the nested validation loop, (b) issue potentially thousands of sequential DB round-trips holding a long-lived transaction window, and (c) exhaust the body-size limit only if `rawBody` caps are low (which they may not be).

**Root cause:**
The DTO array was not bounded with @ArrayMaxSize, and the service has no limit check on tasks.length.

**Code evidence:**
```
export class ImportTasksDto {
  @ApiProperty({
    description: 'Liste des tâches à importer',
    type: [ImportTaskDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTaskDto)
  tasks: ImportTaskDto[];
```

**Suggested fix:**
Add `@ArrayMaxSize(500)` (or a lower business-appropriate limit) to `ImportTasksDto.tasks`. Also add a guard in the service:
ʼʼʼts
if (tasks.length > 500) throw new BadRequestException('Import limited to 500 tasks per request');
ʼʼʼ
And apply `@MaxLength()` to `ImportTaskDto.title`, `description`, `subtasks`.

**Acceptance criteria:**
1. POST /tasks/project/:id/import with more than 500 tasks returns HTTP 400
2. POST /tasks/project/:id/import/validate with more than 500 tasks returns HTTP 400
3. Commit message includes `[closes SEC-020]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: craft a body with 1001 task objects and POST to the import endpoint, verify 400 is returned
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review: verbatim code confirmed at import-tasks.dto.ts lines 78-87. The 1 MiB bodyLimit in main.ts (SEC-025) caps byte size but not item count — a 1000-element array of short tasks easily fits under 1 MiB. No @ArrayMaxSize found anywhere in the file. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-021 — DELETE /tasks/:taskId/raci/:userId/:role — :role path param is unvalidated (no ParseEnumPipe)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/tasks/tasks.controller.ts:407-429`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-021` · audit-confidence: high · found_by: security

**Description:**
The `:role` path parameter is typed as `RACIRole` in TypeScript but extracted with a plain `@Param('role')` — no `ParseEnumPipe(RACIRole)` is applied. The global ValidationPipe does not validate path parameters; it only operates on `@Body()`. TypeScript types are erased at runtime. As a result, any arbitrary string will be accepted and passed as `role` to `removeRACI()`. In `removeRACI()` the value flows directly into a Prisma `findUnique` where clause: `taskId_userId_role: { taskId, userId, role }`. Prisma will not throw on an unknown enum value at the query level — it will simply return null and the service will throw NotFoundException. However, the lack of enum validation at the boundary is a defence-in-depth gap that could be exploited if Prisma behaviour changes or if an attacker probes for information via differential responses.

**Root cause:**
NestJS @Param decorators do not apply the global ValidationPipe; enum validation must be applied explicitly via ParseEnumPipe.

**Code evidence:**
```
  @Delete(':taskId/raci/:userId/:role')
  @RequirePermissions('tasks:update')
  ...
  removeRACI(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: RACIRole,
```

**Suggested fix:**
Use `new ParseEnumPipe(RACIRole)` on the param:
ʼʼʼts
@Param('role', new ParseEnumPipe(RACIRole)) role: RACIRole,
ʼʼʼ

**Acceptance criteria:**
1. DELETE /tasks/:id/raci/:userId/INVALID_ROLE returns HTTP 400 (not 404)
2. DELETE /tasks/:id/raci/:userId/RESPONSIBLE returns HTTP 200 or 404 (valid flow)
3. Commit message includes `[closes SEC-021]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X DELETE http://localhost:3000/api/tasks/<taskId>/raci/<userId>/INVALID_ROLE -H 'Authorization: Bearer <token>' | jq .statusCode
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review: verbatim code confirmed at tasks.controller.ts lines 407-429. The `@Param('role') role: RACIRole` pattern is real — no ParseEnumPipe present. Prisma's DB-level enum constraint (PostgreSQL native enum) does provide a backend safety net: an invalid enum string causes a Prisma P2023 error which NestJS maps to 500, not silent acceptance. However, the missing client-side validation means the error surface is 500 (internal) instead of 400 (bad request), which is still incorrect behavior and information-leaking in server logs.

**Closed_by:** (empty — TODO)

---

### SEC-023 — userId in CreateTeleworkDto and CreateRecurringRuleDto uses @IsString() instead of @IsUUID()

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/telework/dto/create-telework.dto.ts:23-25`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-023` · audit-confidence: high · found_by: security

**Description:**
The userId field in CreateTeleworkDto (and identically in CreateRecurringRuleDto) is annotated with @IsString() instead of @IsUUID(). Although the field is optional and the service performs a downstream Prisma lookup that will 404 if the ID does not exist, a non-UUID string accepted by the pipeline will cause Prisma to throw an internal database error (invalid UUID format) rather than a clean NestJS NotFoundException, potentially leaking implementation details. More importantly, the intent of the field is clearly a UUID primary key; @IsString() is under-constrained. All other ID fields in the same codebase (e.g., taskId, projectId in CreateTimeEntryDto) correctly use @IsUUID().

**Root cause:**
Copy-paste pattern chose @IsString() instead of @IsUUID() for optional userId body fields in telework DTOs.

**Code evidence:**
```
  @IsOptional()
  @IsString()
  userId?: string;
```

**Suggested fix:**
Replace @IsString() with @IsUUID() on the userId field in both CreateTeleworkDto and CreateRecurringRuleDto. Also add @IsUUID() to the same field in UpdateRecurringRuleDto (inherited via PartialType but explicit annotation is cleaner):
ʼʼʼ
@IsOptional()
@IsUUID()
userId?: string;
ʼʼʼ

**Acceptance criteria:**
1. POST /api/telework with body { date: '2026-06-01', userId: 'not-a-uuid' } returns HTTP 400 (class-validator error), not HTTP 500.
2. POST /api/telework/recurring-rules with body { dayOfWeek: 1, startDate: '2026-06-01', userId: 'not-a-uuid' } returns HTTP 400.
3. Commit message includes `[closes SEC-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X POST http://localhost:4000/api/telework -H 'Authorization: Bearer <admin_token>' -H 'Content-Type: application/json' -d '{"date":"2026-06-01","userId":"not-a-uuid"}' | jq '.statusCode'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim code verified at create-telework.dto.ts lines 23-25 and create-recurring-rule.dto.ts lines 19-21. No upstream UUID coercion, pipe, or interceptor compensates for the missing @IsUUID(). taskId and projectId in CreateTimeEntryDto correctly use @IsUUID() confirming this is an inconsistency. Same pattern applies to CreateRecurringRuleDto (apps/api/src/telework/dto/create-recurring-rule.dto.ts lines 19-21). UpdateRecurringRuleDto inherits via PartialType so is implicitly affected.

**Closed_by:** (empty — TODO)

---

### COR-014 — rejectCancellation writes no audit log — CANCELLATION_REQUESTED→APPROVED transition is invisible to the audit trail

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · state_machine_missing_audit
- **File:** `apps/api/src/leaves/leaves.service.ts:2283-2319`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-014` · audit-confidence: high · found_by: correctness

**Description:**
All other status transitions in LeavesService (approve, reject, cancel, requestCancel) emit an audit log entry via `auditPersistence.log` inside or right after the transaction. `rejectCancellation` is the only transition that performs no audit write. A manager who denies a cancellation request leaves zero trace in `audit_logs`. The `cancel()` docstring at line 2113 explicitly notes 'APPROVE_CANCELLATION is merged here', implying the intent was to instrument both paths. `rejectCancellation` was overlooked.

**Root cause:**
The `rejectCancellation` $transaction callback returns immediately after `tx.leave.update` without calling `auditPersistence.log`, and the outer function has no post-tx audit emit.

**Code evidence:**
```
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Demande de congé introuvable');
      }
      if (current.status !== LeaveStatus.CANCELLATION_REQUESTED) {
        throw new ConflictException(
          'La demande de congé a été modifiée pendant le traitement. Veuillez réessayer.',
        );
      }

      return tx.leave.update({
        where: { id },
        data: { status: LeaveStatus.APPROVED },
        include: {
```

**Suggested fix:**
Add an `await this.auditPersistence.log(...)` call inside the transaction callback, after the update, mirroring the pattern in `cancel()` and `requestCancel()`. Build an actorSnapshot before the transaction using `buildActorSnapshot(currentUserId ?? '', { roleCode: currentUserRole ?? null })`.

**Acceptance criteria:**
1. Calling rejectCancellation produces one audit_logs row with action LEAVE_CANCELLATION_REJECTED (or equivalent) and the correct entityId
2. The audit row is present even when the transaction commits atomically
3. Commit message includes `[closes COR-014]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: call POST /leaves/:id/reject-cancellation then SELECT * FROM audit_logs WHERE entity_id = ':id' ORDER BY created_at DESC LIMIT 5;
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: All other six status-transition methods have audit writes; this one is the sole exception. Adversarial check: read requestCancel() (lines 2220-2233) and cancel() (lines 2112-2135) — both have auditPersistence.log inside the $transaction. rejectCancellation transaction (lines 2283-2319) returns immediately after tx.leave.update with no audit call. Confirmed verbatim.

**Closed_by:** (empty — TODO)

---

### OBS-002 — requestId never populated in persisted audit-log payload despite declared schema field and ALS infrastructure

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · correlation-id-not-persisted
- **File:** `apps/api/src/audit/audit.service.ts:184-200`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-002` · audit-confidence: high · found_by: observability

**Description:**
The securityEnvelope Zod schema (payload-schemas.ts line 70) declares requestId as an optional field, with the comment: 'lets an SRE stitch a security-envelope audit row back to the originating HTTP request'. The ALS infrastructure (requestIdStore, getRequestId()) is fully wired in main.ts and request-id.context.ts. However, AuditService.log() never calls getRequestId() and never injects the correlation ID into the payload object. The field is always absent from every persisted LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED, ACCESS_DENIED, REGISTER, PASSWORD_CHANGED, and RELEASE_DEPLOYED row.

**Root cause:**
AuditService.log() was not updated to call getRequestId() when the ALS infrastructure (OBS-009) was added, leaving the schema-declared field permanently vacant.

**Code evidence:**
```
    void this.auditPersistence
      .log({
        action: event.action,
        entityType: ENTITY_TYPE_BY_ACTION[event.action] ?? 'Auth',
        entityId: this.resolveEntityId(event),
        actorId: event.userId ?? null,
        payload: {
          ip: event.ip,
          details: event.details,
          success: event.success,
          timestamp: entry.timestamp,
          ...(event.ua !== undefined ? { ua: event.ua } : {}),
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
          ...(event.before !== undefined ? { before: event.before } : {}),
          ...(event.after !== undefined ? { after: event.after } : {}),
        },
      })
```

**Suggested fix:**
In AuditService.log(), import getRequestId from '../common/fastify/request-id.context' and add requestId to the payload spread: ...(getRequestId() !== undefined ? { requestId: getRequestId() } : {}). This is a one-line change that populates the already-declared schema field with no schema migration needed.

**Acceptance criteria:**
1. A LOGIN_FAILURE audit row persisted during an HTTP request carries a requestId field in its payload
2. The requestId value matches the x-request-id header (or generated UUID) visible in the Fastify access log for the same request
3. Rows written outside an HTTP context (background jobs, scripts) still have no requestId (field absent, not null)
4. Commit message includes `[closes OBS-002]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: grep -n 'getRequestId' apps/api/src/audit/audit.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. (1) Code evidence at lines 184-200 is verbatim correct. (2) grep getRequestId audit.service.ts returns ZERO hits — the function is never imported or called. (3) payload-schemas.ts line 70 confirms `requestId: optStr` is declared in the Zod schema. (4) No other code path in audit.service.ts or audit-persistence.service.ts injects requestId. The schema field is permanently vacant. Finding stands at severity=important.

**Closed_by:** (empty — TODO)

---

### OBS-003 — POST /auth/logout emits no audit row — session termination is untracked

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-logout
- **File:** `apps/api/src/auth/auth.controller.ts:220-243`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-003` · audit-confidence: high · found_by: observability

**Description:**
The logout handler revokes the refresh token and blacklists the JTI, but calls neither `auditService.log()` nor `auditPersistence.log()`. No `LOGOUT` action exists in the `AuditAction` enum. An auditor cannot reconstruct which sessions were voluntarily terminated versus which tokens simply expired, and cannot correlate "user A logged in at T1 and logged out at T2" from the audit trail alone.

**Root cause:**
No audit emission was ever added to the logout controller path, and no LOGOUT enum member was defined in AuditAction.

**Code evidence:**
```
  async logout(
    @Body() body: LogoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ): Promise<void> {
    const refreshToken =
      body?.refreshToken ?? readRefreshCookie(req) ?? undefined;
    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }
```

**Suggested fix:**
1. Add `LOGOUT = 'LOGOUT'` to the `AuditAction` enum in `audit-action.enum.ts`. 2. Add it to the `ENTITY_TYPE_BY_ACTION` map in `audit.service.ts`. 3. In `AuthController.logout()`, call `this.auditService.log({ action: AuditAction.LOGOUT, userId: user.id, ip: clientIp(req), ua: req.headers?.['user-agent'], details: ..., success: true })` after the blacklist step.

**Acceptance criteria:**
1. A row with action='LOGOUT' appears in audit_logs after POST /auth/logout
2. The row captures the actor userId and the originating IP/UA
3. Commit message includes `[closes OBS-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'LOGOUT' apps/api/src/audit/audit-action.enum.ts apps/api/src/auth/auth.controller.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: auth.controller.ts lines 220-243 contain no audit emission. audit-action.enum.ts has no LOGOUT member (confirmed). No global audit interceptor exists in the codebase. Finding is structural.

**Closed_by:** (empty — TODO)

---

### OBS-004 — clients: create/update/hardDelete and project-assignment mutations emit no audit_log row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/clients/clients.service.ts:50-65`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-004` · audit-confidence: high · found_by: observability

**Description:**
ClientsService has no AuditPersistenceService injected. None of the following mutating operations write an audit_log row: create() (line 50), update() (line 235), hardDelete() (line 259), assignClientToProject() (line 300), or removeClientFromProject() (line 329). In a government context, client (commanditaire) management has procurement implications. Hard-deleting a client produces no forensic record. The assignClientToProject / removeClientFromProject calls modify project relationships silently.

**Root cause:**
AuditPersistenceService was never injected into ClientsService.

**Code evidence:**
```
  async create(dto: CreateClientDto): Promise<Client> {
    try {
      return await this.prisma.client.create({
        data: {
          name: dto.name,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
```

**Suggested fix:**
Inject AuditPersistenceService. Emit CLIENT_CREATED, CLIENT_UPDATED (with before snapshot), CLIENT_DELETED (with snapshot), CLIENT_ASSIGNED_TO_PROJECT, CLIENT_REMOVED_FROM_PROJECT. Add the actor userId to the service method signatures where it is not already present (create currently receives no actor). Update the controller to pass @CurrentUser('id').

**Acceptance criteria:**
1. POST /clients produces an audit_log row
2. PATCH /clients/:id produces an audit_log row with before/after
3. DELETE /clients/:id produces an audit_log row with client snapshot before deletion
4. Commit message includes `[closes OBS-004]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 50-65 matches verbatim. Constructor (line 48) verified: only PrismaService injected. No AuditPersistenceService import found. ClientsController.create() does not inject @CurrentUser, so actor identity is also not captured at the controller layer for this endpoint.

**Closed_by:** (empty — TODO)

---

### OBS-006 — documents: create and soft-delete emit no audit_log row (only DOCUMENT_READ is audited)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/documents/documents.service.ts:64-73`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-006` · audit-confidence: high · found_by: observability

**Description:**
DocumentsService wires AuditPersistenceService and correctly emits DOCUMENT_READ (OBS-006) for GET /:id. However, create() (line 64), update() (line 172), and remove()/soft-delete (line 204) all perform mutations with no corresponding audit log emission. A document upload (create) and a soft-delete are sensitive operations: government document management policies typically require knowing who uploaded and who deleted a document. The update() path also passes no currentUser, so actor identity is lost there too.

**Root cause:**
OBS-006 was scoped only to DOCUMENT_READ; the write/delete paths were not included in the audit emission.

**Code evidence:**
```
    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        uploadedBy: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }
```

**Suggested fix:**
In DocumentsService.create(), after prisma.document.create(), emit DOCUMENT_CREATED with payload={documentId, projectId, mimeType, sizeBytes, actorId}. In remove(), before the soft-delete update, emit DOCUMENT_DELETED with payload={documentId, projectId, uploadedBy, deletedBy: currentUser?.id}. For update(), pass currentUser from the controller (currently absent) and emit DOCUMENT_UPDATED with a before/after snapshot of changed metadata fields.

**Acceptance criteria:**
1. POST /documents produces an audit_log row with action DOCUMENT_CREATED
2. DELETE /documents/:id produces an audit_log row with action DOCUMENT_DELETED and the deletedBy actor
3. PATCH /documents/:id produces an audit_log row with before/after metadata
4. Commit message includes `[closes OBS-006]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 64-73 matches verbatim. AuditPersistenceService IS injected (line 39) but only DOCUMENT_READ is emitted (line 144-166). create() (line 64), update() (line 172), and remove() (line 183/204) have no audit emission calls. AuditAction enum has no DOCUMENT_CREATED, DOCUMENT_UPDATED, or DOCUMENT_DELETED members — only DOCUMENT_READ and DOCUMENT_DOWNLOADED. DocumentsController.update() does not inject @CurrentUser, so update() currently receives no actor identity.

**Closed_by:** (empty — TODO)

---

### OBS-007 — rejectCancellation() (CANCELLATION_REQUESTED → APPROVED) emits no audit row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-reject-cancellation
- **File:** `apps/api/src/leaves/leaves.service.ts:2283-2319`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-007` · audit-confidence: high · found_by: observability

**Description:**
The `rejectCancellation()` method transitions a leave from CANCELLATION_REQUESTED back to APPROVED. All other leave status transitions (approve, reject, cancel, requestCancel, update) emit a durable `auditPersistence.log()` call. This method is the sole exception: the manager decision to deny a cancellation request and restore the leave to APPROVED is silently not recorded in `audit_logs`.

**Root cause:**
The `rejectCancellation()` method was added (COR-009) to complete the cancellation state machine but its audit emit was not included, unlike the symmetric `cancel()` path.

**Code evidence:**
```
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Demande de congé introuvable');
      }
      if (current.status !== LeaveStatus.CANCELLATION_REQUESTED) {
        throw new ConflictException(
          'La demande de congé a été modifiée pendant le traitement. Veuillez réessayer.',
        );
      }

      return tx.leave.update({
        where: { id },
        data: { status: LeaveStatus.APPROVED },
```

**Suggested fix:**
Add `LEAVE_CANCELLATION_REJECTED = 'LEAVE_CANCELLATION_REJECTED'` to AuditAction (or reuse LEAVE_REJECTED with a before.status=CANCELLATION_REQUESTED marker). Inside the `$transaction`, after `tx.leave.update()`, emit `await this.auditPersistence.log({ action: AuditAction.LEAVE_CANCELLATION_REJECTED, entityType: 'Leave', entityId: id, actorId: currentUserId ?? null, payload: { before: { status: current.status }, after: { status: updated.status }, targetUserId: current.userId } })`.

**Acceptance criteria:**
1. After PATCH /leaves/:id/reject-cancellation, a durable audit_logs row records the before (CANCELLATION_REQUESTED) and after (APPROVED) states
2. The actorId field is the manager's user id
3. Commit message includes `[closes OBS-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'rejectCancellation\|auditPersistence' apps/api/src/leaves/leaves.service.ts | head -10
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: leaves.service.ts lines 2278-2319 confirmed verbatim. Full grep of audit calls in the file shows none in range 2280-2320. All other status-transition methods (approve at 1834, reject at 1981, cancel at 2112, requestCancel at 2220) have auditPersistence.log() calls; rejectCancellation uniquely lacks one. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-008 — createDelegation() and deactivateDelegation() emit no audit row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-delegation
- **File:** `apps/api/src/leaves/leaves.service.ts:2376-2406`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-008` · audit-confidence: high · found_by: observability

**Description:**
Delegations are RBAC-adjacent sensitive actions: they transfer leave approval authority from one user (delegator) to another (delegate) for a time window. Both `createDelegation()` (lines 2329–2407) and `deactivateDelegation()` (lines 2454–2485) perform state-changing DB writes with no `auditPersistence.log()` or `auditService.log()` call. A delegator could silently transfer their approval authority to any user in the system without any trace.

**Root cause:**
Delegation management was implemented without audit instrumentation.

**Code evidence:**
```
    // Créer la délégation
    const delegation = await this.prisma.leaveValidationDelegate.create({
      data: {
        delegatorId,
        delegateId,
        startDate,
        endDate,
        isActive: true,
      },
      include: {
        delegator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
```

**Suggested fix:**
Add `DELEGATION_CREATED` and `DELEGATION_DEACTIVATED` to AuditAction (and ENTITY_TYPE_BY_ACTION). Emit `auditPersistence.log()` in both `createDelegation()` and `deactivateDelegation()`. The payload should include delegatorId, delegateId, startDate, endDate, and actorId.

**Acceptance criteria:**
1. A durable audit_logs row exists after creating a delegation
2. A durable audit_logs row exists after deactivating a delegation
3. Both rows capture the delegator, delegate, and the actor performing the operation
4. Commit message includes `[closes OBS-008]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'createDelegation\|deactivateDelegation\|auditPersistence' apps/api/src/leaves/leaves.service.ts | head -20
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: createDelegation() at lines 2329-2407 and deactivateDelegation() at lines 2454-2485 confirmed verbatim. Full grep of audit calls in leaves.service.ts shows none in ranges 2329-2407 or 2454-2485. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-009 — Leave create path emits no durable audit row for PENDING/declaredByManager paths; selfApprove path mislabeled

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-leave-create
- **File:** `apps/api/src/leaves/leaves.service.ts:679-693`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-009` · audit-confidence: medium · found_by: observability

**Description:**
The `create()` method (lines 333-693) has three outcome paths: (1) PENDING leave submission, (2) declaredByManager (immediately APPROVED), (3) canSelfApprove (immediately APPROVED). Paths (1) and (2) emit no audit record at all. Path (3) calls `auditService.log()` which IS durably written to `audit_logs` via the dual-write mechanism (DAT-002), but the action is wrong: it emits LEAVE_APPROVED rather than LEAVE_CREATED, misclassifying creation as an approval event. The full leave lifecycle (update, delete, approve, reject, cancel) is audited, but the creation event is entirely absent for paths (1) and (2).

**Root cause:**
The create() path was instrumented for the status-transition event (self-approve) but a LEAVE_CREATED emission was never added for any path. The auditService dual-write was not recognized by the original reviewer.

**Code evidence:**
```
    // Trace d'audit séparée pour les auto-validations (finding #6). La
    // colonne `selfApproved` rend la distinction lisible dans la table,
    // l'entrée d'audit la rend visible dans le flux de logs sécurité.
    if (canSelfApprove) {
      this.auditService.log({
        action: AuditAction.LEAVE_APPROVED,
        userId: requestingUserId,
        targetId: leave.id,
        details: `Auto-validation par ${requestingUserId} (selfApproved=true)`,
        success: true,
      });
    }

    return leave;
```

**Suggested fix:**
Add `LEAVE_CREATED = 'LEAVE_CREATED'` to AuditAction and ENTITY_TYPE_BY_ACTION. After the transaction, emit `auditPersistence.log()` for all three paths covering the actor, target user, initial status, leaveTypeId, dates. Replace the current `auditService.log(LEAVE_APPROVED)` with `auditService.log(LEAVE_CREATED)` for the selfApprove path.

**Acceptance criteria:**
1. After POST /leaves, a durable audit_logs row with action='LEAVE_CREATED' exists
2. The payload captures the actor, the target user, and the initial status
3. Commit message includes `[closes OBS-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'LEAVE_CREATED\|auditPersistence' apps/api/src/leaves/leaves.service.ts | head -20
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: DOWNGRADED from high to medium. Original description incorrectly stated auditService.log() is 'console/SecurityAudit only — not persisted to audit_logs'. Verification of audit.service.ts lines 152-207 shows AuditService has a DAT-002 dual-write: it calls auditPersistence.log() fire-and-forget for every action, including LEAVE_APPROVED. Therefore the selfApprove path IS durably logged, but under the wrong action code. The core gap (no LEAVE_CREATED, no audit for paths 1 and 2) remains real and confirmed. LEAVE_CREATED is absent from audit-action.enum.ts.

**Closed_by:** (empty — TODO)

---

### OBS-010 — Project create, update, and soft-delete (status→CANCELLED) emit no audit rows

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-project-create-update-remove
- **File:** `apps/api/src/projects/projects.service.ts:89-687`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-010` · audit-confidence: high · found_by: observability

**Description:**
Only the `archive()`, `unarchive()`, and `hardDelete()` methods emit audit rows. The three core lifecycle methods are unaudited: `create()` (lines 89–221) creates a project and silently adds the creator as a member with no audit; `update()` (lines 548–662) modifies arbitrary project fields including status, manager, and sponsor with no before/after audit; `remove()` (lines 667–687) transitions a project to CANCELLED status with no audit. This means the vast majority of project lifecycle events are invisible in the audit trail.

**Root cause:**
Audit was retroactively added only to the archive/unarchive/hardDelete paths; the foundational CRUD operations were never instrumented.

**Code evidence:**
```
  async remove(id: string, user?: ProjectMutationUser) {
    // Defense-in-depth: enforce ownership even if guard is bypassed.
    if (user) {
      await this.assertProjectOwnershipOrBypass(id, user);
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.CANCELLED },
    });

    return { message: 'Projet annulé avec succès' };
  }
```

**Suggested fix:**
Add PROJECT_CREATED, PROJECT_UPDATED, PROJECT_CANCELLED to AuditAction and ENTITY_TYPE_BY_ACTION. In create(): emit PROJECT_CREATED with the project id and creatorId. In update(): capture the before-state for key fields (name, status, managerId, sponsorId) and emit PROJECT_UPDATED with before/after diff. In remove(): emit PROJECT_CANCELLED.

**Acceptance criteria:**
1. After POST /projects, an audit_logs row with action='PROJECT_CREATED' exists
2. After PATCH /projects/:id, an audit_logs row with action='PROJECT_UPDATED' and before/after state exists
3. After DELETE /projects/:id, an audit_logs row with action='PROJECT_CANCELLED' exists
4. Commit message includes `[closes OBS-010]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'auditPersistence\|auditService\|AuditAction' apps/api/src/projects/projects.service.ts | head -20
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: grep of projects.service.ts shows audit calls only at lines 710 (PROJECT_ARCHIVED), 748 (PROJECT_UNARCHIVED), 855 (PROJECT_DELETED). create() at 89-221, update() at 548-662, remove() at 667-687 confirmed verbatim with no audit calls. PROJECT_CREATED/PROJECT_UPDATED/PROJECT_CANCELLED absent from audit-action.enum.ts. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-011 — settings: all write operations emit no audit_log row and do not capture actor identity

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/settings/settings.service.ts:235-265`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-011` · audit-confidence: high · found_by: observability

**Description:**
SettingsService.update(), bulkUpdate(), resetToDefault(), resetAllToDefaults(), and remove() all mutate application settings with no audit log emission. Critically, the controller does not even pass CurrentUser to the service (settings.controller.ts lines 51-68), so there is no mechanism to record who changed a setting. Settings include security-relevant values: maxTeleworkDaysPerWeek, defaultLeaveDays, and planning.visibleDays. A settings change that affects entitlements (e.g. increasing defaultLeaveDays) should be auditable.

**Root cause:**
AuditPersistenceService is not injected in SettingsService; furthermore, the controller's write endpoints (PUT /:key, POST /bulk, POST /:key/reset, POST /reset-all, DELETE /:key) do not extract or forward CurrentUser to the service, making actor attribution impossible without refactoring.

**Code evidence:**
```
  async update(key: string, value: unknown, description?: string) {
    if (!SettingsService.isKnownKey(key)) {
      throw new BadRequestException(`Unknown setting key: ${key}`);
    }

    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await this.prisma.appSettings.upsert({
```

**Suggested fix:**
1) Add a currentUserId parameter to SettingsService.update() and its callers. 2) Inject AuditPersistenceService. 3) After each successful upsert, emit SETTINGS_CHANGED with payload={key, before: previousValue, after: newValue, actorId}. 4) Update SettingsController to pass @CurrentUser('id') to the service. 5) Add SETTINGS_CHANGED to AuditAction enum.

**Acceptance criteria:**
1. PUT /settings/:key produces an audit_log row with action SETTINGS_CHANGED, before value, after value, and actor_id
2. POST /settings/bulk produces one SETTINGS_CHANGED row per changed key
3. POST /settings/reset-all produces audit rows for all reset keys
4. The actor_id in each audit row matches the JWT sub of the requester
5. Commit message includes `[closes OBS-011]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 235-265 matches verbatim. No AuditPersistenceService import or injection found in settings.service.ts. AuditAction enum has no SETTINGS_CHANGED member. The controller does not use @CurrentUser on any mutating handler, so the service signature change is a prerequisite for actor attribution.

**Closed_by:** (empty — TODO)

---

### OBS-012 — Task create, update, and delete emit no audit rows — only CSV export is audited

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-task-lifecycle
- **File:** `apps/api/src/tasks/tasks.service.ts:841-885`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-012` · audit-confidence: high · found_by: observability

**Description:**
In `TasksService`, only the `exportProjectTasksCsv()` method emits an audit row (`DATA_EXPORTED`). The `create()` method (task creation), `update()` (status changes, assignee changes, priority changes, all sensitive in project governance), and `remove()` (task deletion) all perform DB writes without any audit emission. Task status transitions (TODO→IN_PROGRESS→DONE) represent project execution state changes that are material for project governance and compliance.

**Root cause:**
The audit instrumentation strategy focused on higher-sensitivity domains (leaves, RBAC, users) and task operations were not included.

**Code evidence:**
```
  async remove(id: string, user?: { id: string; role: string | null }) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        dependents: true,
        assignees: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }
    // ...
    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Tâche supprimée avec succès' };
  }
```

**Suggested fix:**
At minimum, add audit rows for status changes in `update()` (TASK_STATUS_CHANGED: before.status, after.status, taskId, projectId) and for `remove()` (TASK_DELETED: task snapshot). Add corresponding AuditAction members.

**Acceptance criteria:**
1. After PATCH /tasks/:id with a status change, an audit_logs row records the status transition
2. After DELETE /tasks/:id, an audit_logs row records the deletion
3. Commit message includes `[closes OBS-012]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'auditPersistence\|auditService\|AuditAction\|emitDataExported' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: tasks.service.ts grep shows only two audit references — line 45 (injection) and line 1907 (emitDataExported for CSV export). remove() at lines 841-885 confirmed verbatim with no audit call. TASK_* action codes absent from audit-action.enum.ts. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-013 — telework: all CRUD and recurring-rule mutations emit no audit_log row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/telework/telework.service.ts:71-145`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-013` · audit-confidence: high · found_by: observability

**Description:**
TeleworkService has no AuditPersistenceService injected. None of the following mutating operations write an audit_log row: create() (line 124), update() (line 574), remove() (line 620), createRecurringRule() (line 744), updateRecurringRule() (line 802), removeRecurringRule() (line 846), and generateSchedulesFromRules() (line 917). Telework scheduling is sensitive HR data; in particular, an admin (telework:manage_any) can create/delete/modify telework entries on behalf of any employee with no audit trail.

**Root cause:**
AuditPersistenceService was never injected into TeleworkService; the constructor only wires PrismaService and PermissionsService.

**Code evidence:**
```
    const telework = await this.prisma.teleworkSchedule.create({
      data: {
        userId,
        date: teleworkDate,
        isTelework,
        isException,
      },
      include: {
        user: {
          select: {
```

**Suggested fix:**
Inject AuditPersistenceService. Add audit emissions after each mutating DB call: TELEWORK_CREATED, TELEWORK_UPDATED (with before snapshot), TELEWORK_DELETED (with snapshot), TELEWORK_RULE_CREATED, TELEWORK_RULE_UPDATED, TELEWORK_RULE_DELETED, TELEWORK_SCHEDULES_GENERATED (with created count). Include targetUserId (the affected employee) and actorId (currentUserId) in each payload.

**Acceptance criteria:**
1. POST /telework produces an audit_log row with action TELEWORK_CREATED
2. PATCH /telework/:id produces an audit_log row with before/after fields
3. DELETE /telework/:id produces an audit_log row with a snapshot of the deleted entry
4. Admin creating telework for another user (targetUserId != actorId) is visible in the audit trail
5. Commit message includes `[closes OBS-013]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: AuditAction enum has no TELEWORK_* members. Constructor verified (line 63-66): only PrismaService and PermissionsService. Code at line 124 matches verbatim.

**Closed_by:** (empty — TODO)

---

### OBS-014 — third-parties: all mutating operations (create/update/hardDelete/assign/detach) emit no audit_log row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/third-parties/third-parties.service.ts:180-187`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-014` · audit-confidence: high · found_by: observability

**Description:**
ThirdPartiesService has no AuditPersistenceService injected. The hardDelete() path (line 180) deletes a third-party record and — per the comment — cascades to time_entries, taskThirdPartyAssignees, and projectThirdPartyMembers. This destroys multiple linked records with zero audit trail. Similarly, create() (line 23), update() (line 115), assignToTask() (line 276), unassignFromTask() (line 336), attachToProject() (line 350), and detachFromProject() (line 390) are all silent from an observability standpoint.

**Root cause:**
AuditPersistenceService was never injected into ThirdPartiesService.

**Code evidence:**
```
  async hardDelete(id: string): Promise<void> {
    const tp = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!tp) {
      throw new NotFoundException(`Third party ${id} not found`);
    }
    // Cascade FK handles time_entries, task_third_party_assignees, project_third_party_members
    await this.prisma.thirdParty.delete({ where: { id } });
  }
```

**Suggested fix:**
Inject AuditPersistenceService. Before hardDelete(), capture a full snapshot of the third party + cascade counts (from getDeletionImpact()) and emit THIRD_PARTY_DELETED with the snapshot. Emit THIRD_PARTY_CREATED, THIRD_PARTY_UPDATED (with before snapshot), THIRD_PARTY_ASSIGNED_TO_TASK, THIRD_PARTY_UNASSIGNED_FROM_TASK, THIRD_PARTY_ATTACHED_TO_PROJECT, THIRD_PARTY_DETACHED_FROM_PROJECT.

**Acceptance criteria:**
1. DELETE /third-parties/:id produces an audit_log row with the full third-party snapshot and cascade impact counts
2. POST /third-parties produces an audit_log row
3. PATCH /third-parties/:id produces an audit_log row with before/after
4. Commit message includes `[closes OBS-014]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 180-187 matches verbatim. No AuditPersistenceService import or injection found. ThirdPartiesController.remove() does not read @CurrentUser, so actor identity is also absent from the hardDelete flow.

**Closed_by:** (empty — TODO)

---

### OBS-015 — time-tracking: create/update/delete emit no audit_log row

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:208-249`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-015` · audit-confidence: high · found_by: observability

**Description:**
TimeTrackingService has no AuditPersistenceService injected and no audit log emission for any of the three mutating operations: create (line 208), update (line 586), or remove (line 644). Time entry declarations are payroll-adjacent data in a French government system; creation, modification, and deletion of work hours logged should each produce a durable audit_log row. The third-party declaration path (declaredById != userId) is particularly sensitive — an admin declaring hours on behalf of a contractor leaves no audit trace beyond the DB row itself.

**Root cause:**
AuditPersistenceService was never injected into TimeTrackingService; the constructor only wires PrismaService, ThirdPartiesService, PermissionsService, OwnershipService, and AccessScopeService.

**Code evidence:**
```
    return this.prisma.timeEntry.create({
      data: {
        userId: actor.kind === 'user' ? actor.userId : null,
        thirdPartyId: actor.kind === 'thirdParty' ? actor.thirdPartyId : null,
        declaredById: currentUser.id,
        date: new Date(date),
        hours,
        activityType,
        taskId,
        projectId: effectiveProjectId,
```

**Suggested fix:**
Inject AuditPersistenceService into TimeTrackingService. In create(), after the prisma.timeEntry.create(), emit an audit log with action=TIME_ENTRY_CREATED (new enum value), actorId=currentUser.id, entityType='TimeEntry', entityId=entry.id, payload={hours, activityType, date, taskId, projectId, declaredForThirdParty: !!thirdPartyId}. In update(), capture the before-state from the findUnique at line 518 and emit TIME_ENTRY_UPDATED with before/after snapshot. In remove(), capture the full entry before deletion and emit TIME_ENTRY_DELETED.

**Acceptance criteria:**
1. POST /time-tracking produces an audit_log row with action TIME_ENTRY_CREATED
2. PATCH /time-tracking/:id produces an audit_log row with action TIME_ENTRY_UPDATED containing before/after fields
3. DELETE /time-tracking/:id produces an audit_log row with action TIME_ENTRY_DELETED containing a snapshot of the deleted entry
4. The actorId in each audit row matches the currentUser.id (declaredById, not the target userId)
5. Commit message includes `[closes OBS-015]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -H 'Authorization: Bearer <TOKEN>' -X DELETE http://localhost:3000/time-tracking/<ENTRY_ID> && psql $DATABASE_URL -c "SELECT action, actor_id, entity_id FROM audit_logs WHERE action LIKE 'TIME_ENTRY%' ORDER BY created_at DESC LIMIT 1;"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: AuditAction enum (audit-action.enum.ts) has no TIME_ENTRY_* members, confirming no audit emission was ever added. Constructor verified: only PrismaService, ThirdPartiesService, PermissionsService, OwnershipService, AccessScopeService. Code at line 208 matches verbatim.

**Closed_by:** (empty — TODO)

---

### COR-006 — AuditService.log passes undefined-valued payload keys to computeRowHash; stored JSONB normalizes them differently, risking hash divergence on external recompute

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · hash-chain integrity
- **File:** `apps/api/src/audit/audit.service.ts:190-199`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-006` · audit-confidence: high · found_by: correctness

**Description:**
AuditService.log always includes `ip: event.ip` and `details: event.details` in the payload object, even when those values are `undefined`. The payload is then passed to AuditPersistenceService.log, which calls computeRowHash → stableStringify(payload). In stableStringify, Object.keys() includes keys with undefined values, and stableStringify(undefined) returns 'null'. So the hash is computed over a payload like {"details":null,"ip":null,"success":true,"timestamp":"..."}.

However, when this payload is stored in PostgreSQL JSONB via Prisma, undefined-valued keys are dropped (JSON.stringify behavior), so the stored JSONB becomes {"success":true,"timestamp":"..."}. When an external recompute reads the stored row and calls computeRowHash(storedRow), stableStringify produces {"success":true,"timestamp":"..."}, which differs from the original canonical string. The stored rowHash cannot be reproduced from the stored data.

This divergence is NOT assumption-dependent: empirical verification (node -e) confirms that JSON.stringify({ip: undefined, success: true}) = '{"success":true}' (drops undefined), while stableStringify({ip: undefined, success: true}) = '{"ip":null,"success":true}' (includes as null). Prisma uses JSON.stringify semantics for JSONB, so the divergence is real.

Secondary vector (same root cause, assumption-free): the payload-schemas.ts comment states snapshots carry 'D … [truncated — full text in findings.json]

**Root cause:**
computeRowHash canonicalizes the in-memory JS object (where undefined stays and Date has no enumerable keys) while PostgreSQL JSONB normalizes the stored form (undefined dropped, Date coerced to ISO string), so the hash input at write time and the hash input at re-read time can diverge.

**Code evidence:**
```
      payload: {
          ip: event.ip,
          details: event.details,
          success: event.success,
          timestamp: entry.timestamp,
          ...(event.ua !== undefined ? { ua: event.ua } : {}),
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
          ...(event.before !== undefined ? { before: event.before } : {}),
          ...(event.after !== undefined ? { after: event.after } : {}),
        },
```

**Suggested fix:**
Strip undefined-valued keys and normalise non-serializable types before calling computeRowHash. One approach: after the payload is assembled in AuditService.log, round-trip it through JSON.parse(JSON.stringify(payload)) to produce a JSONB-canonical plain object (drops undefined, serialises Date → ISO string, Prisma.Decimal → string). Pass this normalised form to both computeRowHash and the DB insert. Alternatively, guard ip/details with the same !== undefined pattern already used for ua/reason/before/after.

**Acceptance criteria:**
1. When AuditService.log is called without ip/details (both undefined), the stored payload in audit_logs contains no 'ip' or 'details' keys, and computeRowHash(storedRow) === storedRow.rowHash.
2. When a before/after value contains a Date object, computeRowHash(storedRow) === storedRow.rowHash after the row is read back from PostgreSQL.
3. A chain verify pass over rows written via AuditService.log finds 0 rowHash mismatches.
4. Commit message includes `[closes COR-006]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
pnpm test:integration -- --testPathPattern audit-persistence; also: insert a row via AuditService.log with no ip/details, then run: docker exec orchestr-a-db psql -U postgres orchestra -c "SELECT payload, \"rowHash\" FROM audit_logs ORDER BY \"createdAt\" DESC LIMIT 1" and manually call computeRowHash with the stored fields to compare.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed via empirical test: node -e proves JSON.stringify drops undefined-valued keys while stableStringify maps them to 'null'. Prisma uses JSON.stringify semantics for JSONB. Therefore hash-at-write-time ≠ hash-recomputed-from-stored-JSONB. Upgraded from 'medium' to 'high' confidence — the critical unknown (Prisma JSONB behavior on undefined) is resolved by standard JS behavior: JSON.stringify({ip: undefined}) = '{}'. The validatePayloadForAction gate (payload-schemas.ts:262-273) returns void and does NOT normalize the payload; the raw object with undefined-valued keys goes directly to com … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### DAT-013 — audit_logs immutability trigger does not cover TRUNCATE — entire ledger can be wiped silently

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_immutability
- **File:** `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:120-122`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-013` · audit-confidence: high · found_by: data_integrity

**Description:**
The immutability trigger uses `FOR EACH ROW` and catches only UPDATE and DELETE events. PostgreSQL's TRUNCATE is a DDL-level operation that bypasses row-level triggers entirely. A privileged user (or a bug in a service that has DDL-level access) can execute `TRUNCATE audit_logs` and wipe the entire append-only ledger — hash chain, actor snapshots, and all — without the trigger firing once. The migration's stated goal is to make audit_logs append-only for Cour-des-Comptes compliance; TRUNCATE is the single operation that completely invalidates that guarantee at the DB level.

**Root cause:**
`FOR EACH ROW BEFORE UPDATE OR DELETE` triggers are not fired by TRUNCATE in PostgreSQL; only a statement-level `BEFORE TRUNCATE` trigger can intercept it.

**Code evidence:**
```
CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
```

**Suggested fix:**
Add a statement-level TRUNCATE trigger on audit_logs using the same function:
ʼʼʼsql
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();
ʼʼʼ
Also revoke TRUNCATE privilege from the application role (defense-in-depth):
ʼʼʼsql
REVOKE TRUNCATE ON audit_logs FROM <app_role>;
ʼʼʼ
The `audit_logs_immutable()` function already raises a generic `check_violation` exception regardless of TG_OP, so it will work correctly for TRUNCATE without modification.

**Acceptance criteria:**
1. TRUNCATE audit_logs raises 'audit_logs is append-only: TRUNCATE is not permitted' (SQLSTATE 23514)
2. INSERT into audit_logs still succeeds after adding the TRUNCATE trigger
3. UPDATE/DELETE on audit_logs still raise the same exception as before
4. Commit message includes `[closes DAT-013]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql $DATABASE_URL -c "TRUNCATE audit_logs;" 2>&1 | grep 'audit_logs is append-only'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: PostgreSQL docs: 'Row-level triggers fired for TRUNCATE are a PostgreSQL extension. They are not part of the SQL standard.' In practice, TRUNCATE simply does not fire FOR EACH ROW triggers at all. Code evidence verbatim confirmed at lines 120-122. No TRUNCATE trigger found in any migration file (grep across all migrations returned zero results). init-roles.sql line 57 does REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user — this partially mitigates the runtime path but the schema-owning role retains full privilege. The statement-level trigger gap remains unaddressed.

**Closed_by:** (empty — TODO)

---

### OBS-020 — Audit log retention policy undeclared and unenforced — audit_logs grows unbounded

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · no-audit-retention-policy
- **File:** `packages/database/prisma/schema.prisma:1220`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-020` · audit-confidence: high · found_by: observability

**Description:**
The audit_logs table has an immutability trigger (audit_logs_no_update_delete) that prevents UPDATE and DELETE. The app_user role also has UPDATE/DELETE/TRUNCATE REVOKEd via init-roles.sql. These controls ensure tamper-resistance, but they also mean there is no mechanism to expire old rows. No retention period is declared in code, schema comments, or any migration. No table partitioning (pg_partman, declarative partitioning) is defined. For a French public body subject to RGPD Article 5(1)(e) (storage limitation) and the Cour des Comptes audit requirement, the audit trail must be both durable AND bounded. Growing a single unpartitioned table without a retention policy creates operational risk (table bloat, slow sequential scans) and potential RGPD non-compliance (storing audit PII — actorEmail, IP — indefinitely).

**Root cause:**
The immutability design (OBS-002/DAT-009) correctly prioritizes tamper-resistance but does not address the complementary need for a documented and enforced time-bounded retention window.

**Code evidence:**
```
///  - trigger BEFORE UPDATE/DELETE -> RAISE EXCEPTION (audit_logs_no_update_delete) ;
```

**Suggested fix:**
1. Declare a retention policy in a schema comment on audit_logs (e.g. 10 years for Cour des Comptes, then archive). 2. Implement range partitioning on createdAt (one partition per year) so old partitions can be detached and archived without violating the immutability trigger on the active partition. 3. Add a pg_cron or application-level job to DETACH partitions older than the retention threshold and move them to cold storage (not DROP). The immutability trigger applies per-partition; detach = archive, not delete.

**Acceptance criteria:**
1. A retention policy (duration + archival procedure) is documented in the schema comment or a POLICY.md
2. audit_logs is partitioned by RANGE on createdAt with at least a yearly partition granularity
3. A test or migration comment demonstrates that the immutability trigger and hash-chain verification work correctly on partitioned tables
4. Commit message includes `[closes OBS-020]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: check packages/database/prisma/migrations/ for any CREATE TABLE audit_logs ... PARTITION BY statement
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. Code evidence at line 1220 is verbatim correct. The immutability trigger comment is present at that exact line. No PARTITION BY statement exists in the schema. The finding correctly identifies that DELETE/TRUNCATE revocation + immutability trigger means no automated pruning path exists. Confirmed as a governance/compliance gap. Finding stands at severity=important.

**Closed_by:** (empty — TODO)

---

### DAT-003 — DOUBLE PRECISION used for HR-sensitive hours/days columns — rounding errors accumulate

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · float_precision_hr
- **File:** `packages/database/prisma/migrations/20251116093059_init/migration.sql:160-215`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-003` · audit-confidence: low · found_by: data_integrity

**Description:**
Three columns critical to HR/payroll computations — tasks.estimatedHours, time_entries.hours, and leaves.days — are declared DOUBLE PRECISION (IEEE 754 binary float). Binary floats cannot represent most decimal fractions exactly (e.g. 0.1 + 0.2 ≠ 0.3). For leave-day balances and time-entry aggregations, floating-point accumulation produces incorrect totals that silently diverge from true decimal values.

**Root cause:**
Prisma Float maps to DOUBLE PRECISION by default; no explicit @db.Decimal annotation was applied to HR-sensitive numeric fields.

**Code evidence:**
```
    "estimatedHours" DOUBLE PRECISION,
    "progress" INTEGER NOT NULL DEFAULT 0,
...
    "hours" DOUBLE PRECISION NOT NULL,
...
    "days" DOUBLE PRECISION NOT NULL,
```

**Suggested fix:**
Convert to NUMERIC: ALTER TABLE time_entries ALTER COLUMN hours TYPE NUMERIC(5,2) USING hours::numeric(5,2); same for leaves.days NUMERIC(6,2) and tasks.estimatedHours NUMERIC(5,2). Fixed by later migration 20260524100100_dat005_convert_float_to_decimal.

**Acceptance criteria:**
1. SELECT 0.1::double precision + 0.2::double precision = 0.3 returns false; SELECT 0.1::numeric(5,2) + 0.2::numeric(5,2) = 0.3 returns true
2. All three columns are NUMERIC after migration
3. Commit message includes `[closes DAT-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "\d time_entries" | grep hours
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 160 and 198 and 215 of init migration. Fixed by migration 20260524100100_dat005_convert_float_to_decimal (2026-05-24) which converts time_entries.hours to NUMERIC(5,2), leaves.days to NUMERIC(6,2), leave_balances.totalDays to NUMERIC(6,2), tasks.estimatedHours to NUMERIC(5,2). Downgraded to low confidence — issue is resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-004 — ON DELETE CASCADE on leave_balances.leaveTypeId destroys balance history when leave type is deleted

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · cascade_destroys_hr_history
- **File:** `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:27`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-004` · audit-confidence: high · found_by: data_integrity

**Description:**
Deleting a leave_type_config cascades to delete all leave_balances rows for that type across all users and years. This means retiring or removing a leave type (e.g., abolishing RTT during a reform) silently erases the historical annual allocations for all employees, making it impossible to verify past entitlements. The ON DELETE RESTRICT or a soft-delete on leave_type_configs would prevent accidental data destruction.

**Root cause:**
CASCADE chosen for referential convenience without considering that leave_type_configs rows represent system reference data that should be archived, not deleted.

**Code evidence:**
```
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Suggested fix:**
Change leave_balances.leaveTypeId FK to ON DELETE RESTRICT. Add isActive flag to leave_type_configs (already present) and use deactivation instead of deletion.

**Acceptance criteria:**
1. Attempting to DELETE a leave_type_configs row that has associated leave_balances rows raises a foreign key violation
2. Leave type deactivation uses isActive=false, not DELETE
3. Commit message includes `[closes DAT-004]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 27 of add_leave_balances_and_rbac_granularity migration. Verified no later migration changes this FK behavior — searched all migration SQL files for 'leave_balances_leaveTypeId_fkey' and found only the creation entry. No fix migration exists. The dat008_026_user_fk_full_erasure migration (2026-06-04) explicitly states it handles user deletion FKs only; leave_type_config FKs are not in scope. REMAINS OPEN.

**Closed_by:** (empty — TODO)

---

### DAT-005 — leave_balances unique index on nullable userId treats multiple NULL rows as distinct — global balance uniqueness not enforced

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · nullable_unique_constraint
- **File:** `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:4-21`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-005` · audit-confidence: low · found_by: data_integrity

**Description:**
userId is nullable (TEXT without NOT NULL), representing a 'global' balance row when NULL. Postgres NULLS DISTINCT semantics mean multiple rows with userId=NULL for the same (leaveTypeId, year) all satisfy the unique constraint. A concurrent upsertBalance operation can therefore race-create two global balance rows for the same (leaveTypeId, year), making resolveAllocatedDays non-deterministic.

**Root cause:**
Standard B-tree unique index treats each NULL as not equal to any other NULL (ISO SQL semantics), so the uniqueness guarantee does not hold for global (userId=NULL) rows.

**Code evidence:**
```
    "userId" TEXT,
...
CREATE UNIQUE INDEX "leave_balances_userId_leaveTypeId_year_key" ON "leave_balances"("userId", "leaveTypeId", "year");
```

**Suggested fix:**
Add a partial unique index: CREATE UNIQUE INDEX leave_balances_global_unique ON leave_balances (leaveTypeId, year) WHERE userId IS NULL. Fixed by later migration 20260523171000_self_approved_and_global_balance_unique.

**Acceptance criteria:**
1. Two concurrent INSERTs with userId=NULL, same leaveTypeId and year result in a unique constraint violation on the second INSERT
2. Partial index leave_balances_global_unique exists in pg_indexes
3. Commit message includes `[closes DAT-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT indexname FROM pg_indexes WHERE tablename='leave_balances' AND indexname='leave_balances_global_unique';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 4 and 21 of add_leave_balances_and_rbac_granularity migration. Fixed by migration 20260523171000_self_approved_and_global_balance_unique which adds: CREATE UNIQUE INDEX "leave_balances_global_unique" ON "leave_balances" ("leaveTypeId", "year") WHERE "userId" IS NULL. Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-006 — leave_balances.totalDays declared DOUBLE PRECISION — balance summaries accumulate float errors

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · float_precision_hr
- **File:** `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:7`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-006` · audit-confidence: low · found_by: data_integrity

**Description:**
leave_balances.totalDays is declared DOUBLE PRECISION. This column aggregates per-user annual leave allocations and carryovers. Float arithmetic on day counts can produce off-by-epsilon results that surface as fractional days when compared to integer day-count expectations in HR reporting.

**Root cause:**
Prisma Float maps to DOUBLE PRECISION by default; no explicit @db.Decimal annotation was applied.

**Code evidence:**
```
    "totalDays" DOUBLE PRECISION NOT NULL,
```

**Suggested fix:**
ALTER TABLE leave_balances ALTER COLUMN totalDays TYPE NUMERIC(6,2) USING totalDays::numeric(6,2). Fixed by later migration 20260524100100.

**Acceptance criteria:**
1. leave_balances.totalDays column type is NUMERIC(6,2) in the final schema
2. Commit message includes `[closes DAT-006]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "\d leave_balances" | grep totalDays
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 7 of add_leave_balances_and_rbac_granularity migration. Fixed by migration 20260524100100_dat005_convert_float_to_decimal (2026-05-24). Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-007 — ON DELETE CASCADE on project_snapshots destroys historical trend data when project is hard-deleted

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · cascade_destroys_audit_history
- **File:** `packages/database/prisma/migrations/20260404211126_add_project_snapshots/migration.sql:15`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-007` · audit-confidence: low · found_by: data_integrity

**Description:**
project_snapshots is an append-only time-series table recording project progress over time. With CASCADE, hard-deleting a project destroys all its snapshot history, removing the ability to reconstruct project velocity metrics, detect pattern anomalies, and satisfy retrospective reporting requirements. Snapshots have no independently meaningful identity without the project, but retain analytical value beyond the project lifecycle.

**Root cause:**
Default cascade behavior applied to time-series child table without considering post-project-lifecycle reporting needs.

**Code evidence:**
```
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Suggested fix:**
Change to ON DELETE RESTRICT and require project archival (status=CANCELLED/COMPLETED) before allowing hard deletion. Fixed by later migration 20260525200000_dat007_project_fk_restrict_preserve_history.

**Acceptance criteria:**
1. Attempting to DELETE a project with snapshots raises a foreign key violation
2. ProjectsService.checkProjectDependencies surfaces this as ConflictException
3. Commit message includes `[closes DAT-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "\d project_snapshots" | grep projectId
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 15 of add_project_snapshots migration. Fixed by migration 20260525200000_dat007_project_fk_restrict_preserve_history which drops CASCADE and adds RESTRICT on project_snapshots_projectId_fkey. Also fixes tasks, documents, and time_entries FKs in same migration. Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-008 — project_third_party_members.allocation INTEGER has no CHECK constraint for 0-100 range — unlike project_members.allocation which was fixed in DAT-004

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260411100717_add_third_parties_and_time_entry_actor_xor/migration.sql:109`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-008` · audit-confidence: high · found_by: data_integrity

**Description:**
project_third_party_members.allocation stores a percentage (0-100%) just like project_members.allocation. The DAT-003/DAT-004 business invariants migration (20260527120000) added CHECK ("allocation" BETWEEN 0 AND 100) for project_members but explicitly omitted project_third_party_members. This asymmetry means a buggy service path or direct SQL admin can insert allocation=-5 or allocation=150 for third-party members without any DB-level rejection. The schema comment for project_members reads '0-100%', implying the same semantic for both tables.

**Root cause:**
The DAT-004 migration added allocation range checks only for project_members but missed the parallel table project_third_party_members which has the same column with the same semantic.

**Code evidence:**
```
  "allocation"    INTEGER,
  "assignedById"  TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_third_party_members_pkey" PRIMARY KEY ("id")
```

**Suggested fix:**
Add: ALTER TABLE "project_third_party_members" ADD CONSTRAINT "project_third_party_members_allocation_ck" CHECK ("allocation" BETWEEN 0 AND 100);

**Acceptance criteria:**
1. INSERT INTO project_third_party_members (..., allocation) VALUES (..., 101) fails with check_violation
2. INSERT INTO project_third_party_members (..., allocation) VALUES (..., -1) fails with check_violation
3. INSERT INTO project_third_party_members (..., allocation) VALUES (..., 50) succeeds
4. Commit message includes `[closes DAT-008]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT COUNT(*) FROM project_third_party_members WHERE allocation < 0 OR allocation > 100;
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence VERBATIM confirmed at line 109 of the migration. Exhaustive search across all migrations confirms: project_members gets allocation CHECK in 20260527120000 (line 66: 'project_members_allocation_ck'), but project_third_party_members gets NO CHECK anywhere in the entire migration history. Current schema gap — not a historical window issue.

**Closed_by:** (empty — TODO)

---

### DAT-009 — time_entries.thirdPartyId ON DELETE CASCADE silently destroys billing/payroll records when a ThirdParty is deleted

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · cascade_destroys_time_entries
- **File:** `packages/database/prisma/migrations/20260411100717_add_third_parties_and_time_entry_actor_xor/migration.sql:159-161`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-009` · audit-confidence: high · found_by: data_integrity

**Description:**
Time entries are billing and payroll records. When a ThirdParty row is deleted (soft-delete via isActive=false exists but hard-delete is not blocked), all associated time_entries rows are CASCADE deleted. This destroys historical billing/HR records without warning or audit trail. The sister constraint for user-linked time entries (time_entries.userId) is also ON DELETE CASCADE in schema.prisma (line 462), compounding the risk. For an HR management system in French local government, these records may be subject to retention obligations (up to 5 years under French labor law). There is no RESTRICT guard preventing ThirdParty deletion when time entries exist.

**Root cause:**
The FK was set to ON DELETE CASCADE following the same pattern as task_third_party_assignees (where CASCADE is correct for a join table), but time_entries are substantive financial/HR records that should survive their actor's deletion.

**Code evidence:**
```
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_thirdPartyId_fkey"
  FOREIGN KEY ("thirdPartyId") REFERENCES "third_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Suggested fix:**
Change ON DELETE CASCADE to ON DELETE RESTRICT on time_entries.thirdPartyId FK. If deletion of a ThirdParty with associated time entries must be allowed, implement a soft-delete pattern (ThirdParty.isActive already exists) and block hard-deletes via application logic or a BEFORE DELETE trigger that raises an exception when time_entries referencing that ThirdParty exist.

**Acceptance criteria:**
1. DELETE FROM third_parties WHERE id = '...' fails with FK violation when time_entries reference that third_party
2. Integration test: create third_party + time_entry, attempt delete of third_party, expect error
3. Commit message includes `[closes DAT-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT tp.id, COUNT(te.id) as te_count FROM third_parties tp JOIN time_entries te ON te."thirdPartyId" = tp.id GROUP BY tp.id HAVING COUNT(te.id) > 0 LIMIT 5;
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence VERBATIM confirmed at lines 159-161. Schema.prisma line 463 confirms ON DELETE Cascade. The hardDelete service (third-parties.service.ts line 180-187) explicitly comments 'Cascade FK handles time_entries, task_third_party_assignees, project_third_party_members' — meaning this CASCADE is intentional design, not an oversight. However, the finding remains valid: the design choice to allow hard-delete of a ThirdParty with associated time entries is architecturally dangerous for an HR/billing system with legal retention requirements. The application intentionally offers this endpoint, … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### DAT-011 — predefined_task_recurring_rules lacks a XOR constraint ensuring exactly one of dayOfWeek (WEEKLY) or monthly fields (MONTHLY_DAY/MONTHLY_ORDINAL) is populated per recurrenceType

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260424124537_add_recurrence_and_completion/migration.sql:8-11`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-011` · audit-confidence: high · found_by: data_integrity

**Description:**
After this migration, dayOfWeek becomes nullable and two new monthly fields are added. The schema comment says dayOfWeek is NULL for MONTHLY_DAY recurrenceType. But no CHECK constraint enforces the cross-column invariant: when recurrenceType='WEEKLY', dayOfWeek must be non-null and monthly fields must be null; when recurrenceType='MONTHLY_DAY', monthlyDayOfMonth must be non-null; when recurrenceType='MONTHLY_ORDINAL', monthlyOrdinal must be non-null. Without this constraint, it is possible to store recurrenceType='WEEKLY' with dayOfWeek=NULL (null WEEKLY rule), or recurrenceType='MONTHLY_DAY' with both monthlyDayOfMonth and monthlyOrdinal populated (ambiguous rule). No later migration adds this cross-column guard.

**Root cause:**
The migration drops NOT NULL on dayOfWeek and adds the monthly alternatives without a compensating CHECK constraint to ensure exactly the right fields are populated per recurrenceType.

**Code evidence:**
```
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN     "monthlyDayOfMonth" INTEGER,
ADD COLUMN     "monthlyOrdinal" INTEGER,
ADD COLUMN     "recurrenceType" TEXT NOT NULL DEFAULT 'WEEKLY',
    ALTER COLUMN "dayOfWeek" DROP NOT NULL;
```

**Suggested fix:**
ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "ptrr_recurrence_fields_xor_ck" CHECK ( ("recurrenceType" = 'WEEKLY' AND "dayOfWeek" IS NOT NULL AND "monthlyDayOfMonth" IS NULL AND "monthlyOrdinal" IS NULL) OR ("recurrenceType" = 'MONTHLY_DAY' AND "monthlyDayOfMonth" IS NOT NULL AND "dayOfWeek" IS NULL AND "monthlyOrdinal" IS NULL) OR ("recurrenceType" = 'MONTHLY_ORDINAL' AND "monthlyOrdinal" IS NOT NULL AND "dayOfWeek" IS NULL AND "monthlyDayOfMonth" IS NULL) );

**Acceptance criteria:**
1. recurrenceType='WEEKLY' with dayOfWeek=NULL is rejected by check_violation
2. recurrenceType='MONTHLY_DAY' with both monthlyDayOfMonth and monthlyOrdinal populated is rejected
3. recurrenceType='WEEKLY' with dayOfWeek=1 and NULL monthly fields succeeds
4. Commit message includes `[closes DAT-011]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT COUNT(*) FROM predefined_task_recurring_rules WHERE ("recurrenceType" = 'WEEKLY' AND "dayOfWeek" IS NULL) OR ("recurrenceType" = 'MONTHLY_DAY' AND "monthlyDayOfMonth" IS NULL) OR ("recurrenceType" = 'MONTHLY_ORDINAL' AND "monthlyOrdinal" IS NULL);
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence VERBATIM confirmed at lines 8-11. The recurrenceType column was promoted to a proper enum by DAT-012 (20260527130000), but no XOR cross-column CHECK was added in DAT-012 or any other migration. The XOR pattern exists for time_entries actor fields in the same migration batch (lines 168-174: time_entries_actor_xor_check), confirming awareness of this pattern. Current schema gap.

**Closed_by:** (empty — TODO)

---

### DAT-012 — predefined_task_recurring_rules.monthlyOrdinal and monthlyDayOfMonth have no range CHECK constraints despite documented semantics (1..5 and 1..31)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260424124537_add_recurrence_and_completion/migration.sql:8-9`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-012` · audit-confidence: high · found_by: data_integrity

**Description:**
The schema.prisma documents monthlyOrdinal as '1..5 (5 = dernière occurrence du mois) pour MONTHLY_ORDINAL' and monthlyDayOfMonth as '1..31 pour MONTHLY_DAY'. Neither column has a DB-level CHECK constraint anywhere in the migration history. An invalid monthlyDayOfMonth=32 or monthlyOrdinal=0 would be silently accepted, leading to recurrence rule evaluation errors at runtime (no matching day in month, undefined ordinal week). The business invariants migration (20260527120000) that fixed similar issues on weight, progress, allocation, etc. does not cover these fields.

**Root cause:**
The recurrence rule columns were added as raw INTEGER without accompanying CHECK constraints, and the subsequent DAT-003/DAT-004 cleanup missed them.

**Code evidence:**
```
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN     "monthlyDayOfMonth" INTEGER,
ADD COLUMN     "monthlyOrdinal" INTEGER,
```

**Suggested fix:**
ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "ptrr_monthly_ordinal_ck" CHECK ("monthlyOrdinal" IS NULL OR ("monthlyOrdinal" BETWEEN 1 AND 5)); ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "ptrr_monthly_day_of_month_ck" CHECK ("monthlyDayOfMonth" IS NULL OR ("monthlyDayOfMonth" BETWEEN 1 AND 31));

**Acceptance criteria:**
1. INSERT with monthlyOrdinal=6 fails with check_violation
2. INSERT with monthlyDayOfMonth=32 fails with check_violation
3. INSERT with monthlyOrdinal=NULL succeeds (nullable column)
4. INSERT with monthlyDayOfMonth=31 succeeds
5. Commit message includes `[closes DAT-012]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT COUNT(*) FROM predefined_task_recurring_rules WHERE ("monthlyOrdinal" IS NOT NULL AND "monthlyOrdinal" NOT BETWEEN 1 AND 5) OR ("monthlyDayOfMonth" IS NOT NULL AND "monthlyDayOfMonth" NOT BETWEEN 1 AND 31);
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence VERBATIM confirmed at lines 8-9. Exhaustive grep across all migrations confirms no CHECK constraint exists for these two columns anywhere. Current schema gap — not a historical window issue.

**Closed_by:** (empty — TODO)

---

### DAT-015 — project_snapshots.progress lacks CHECK (BETWEEN 0 AND 100) — DAT-003/004 coverage gap

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260603130000_cor014_snapshot_unique_projectid_date/migration.sql:1-8`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-015` · audit-confidence: high · found_by: data_integrity

**Description:**
The COR-014 migration adds the unique constraint on (projectId, date) but does not add CHECK constraints on project_snapshots numeric integrity. Cross-checking against the DAT-003/004 migration (20260527120000_dat003_dat004_business_invariants/migration.sql), that migration adds CHECK constraints for tasks.progress, epics.progress, project_members.allocation, etc. — but project_snapshots.progress (0.00–100.00 per schema comment) is absent. Additionally, there is no CHECK (tasksDone >= 0), CHECK (tasksTotal >= 0), or CHECK (tasksDone <= tasksTotal) on project_snapshots. A buggy scheduler tick or direct SQL fix could insert progress=150 or tasksDone=10 with tasksTotal=5 without any DB-level rejection.

**Root cause:**
The DAT-003/004 migration that added business invariant CHECK constraints omitted project_snapshots entirely; the COR-014 migration which touches project_snapshots was a natural opportunity to add them but did not.

**Code evidence:**
```
-- COR-014: Add unique constraint on (projectId, date) in project_snapshots
-- Prevents duplicate snapshots from concurrent scheduler ticks.
-- date is stored as startOfDay (midnight UTC), so this enforces one row per project per day.
-- DropIndex replaces the plain index with the unique index (subsumes it).
DROP INDEX IF EXISTS "project_snapshots_projectId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "project_snapshots_projectId_date_key" ON "project_snapshots"("projectId", "date");
```

**Suggested fix:**
Add a follow-up migration:
ʼʼʼsql
ALTER TABLE "project_snapshots"
  ADD CONSTRAINT "project_snapshots_progress_ck" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "project_snapshots_tasksDone_ck" CHECK ("tasksDone" >= 0),
  ADD CONSTRAINT "project_snapshots_tasksTotal_ck" CHECK ("tasksTotal" >= 0),
  ADD CONSTRAINT "project_snapshots_tasksDone_le_total_ck" CHECK ("tasksDone" <= "tasksTotal");
ʼʼʼ
Verify no existing rows violate these predicates before applying.

**Acceptance criteria:**
1. project_snapshots has CHECK (progress BETWEEN 0 AND 100)
2. project_snapshots has CHECK (tasksDone >= 0) and CHECK (tasksTotal >= 0)
3. project_snapshots has CHECK (tasksDone <= tasksTotal)
4. INSERT of progress=101 into project_snapshots is rejected by the DB with a constraint violation
5. Commit message includes `[closes DAT-015]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'project_snapshots'::regclass AND contype = 'c';
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CONFIRMED. COR-014 migration code evidence is verbatim. Full grep of all migrations confirms zero CHECK constraints on project_snapshots. DAT-003/004 migration (20260527120000_dat003_dat004_business_invariants/migration.sql) confirmed to add CHECK constraints for tasks.progress, epics.progress, predefined_tasks.weight, project_members.allocation, leaves.days, leave_balances.totalDays, documents.size — but project_snapshots is explicitly absent. Schema.prisma comment says '0.00 – 100.00' but this is documentation only, not enforced at the DB level.

**Closed_by:** (empty — TODO)

---

### DAT-016 — DAT-015 creates redundant dual-layer uniqueness on email: plain @unique (case-sensitive) + LOWER() functional index (case-insensitive) — Prisma findUnique bypasses the case-insensitive guard

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · dual_uniqueness_semantic_confusion
- **File:** `packages/database/prisma/migrations/20260603140000_dat015_email_varchar254_lower_unique/migration.sql:9-16`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-016` · audit-confidence: high · found_by: data_integrity

**Description:**
The migration comment states 'The @unique PSL constraint is kept; these indexes do the case-insensitive enforcement.' However, the Prisma-managed plain @unique constraint on email (which creates a B-tree index on the raw email column) is case-sensitive and remains active. The new users_email_lower_uk LOWER() functional index is case-insensitive. This dual-layer setup means: (1) INSERT/UPDATE of 'User@Example.com' when 'user@example.com' already exists is correctly BLOCKED by the LOWER() index. (2) However, auth.service.ts validateUser() uses prisma.user.findUnique({ where: { email: login } }) at line 80-81, which uses the exact-match B-tree index. Emails are stored as-is (no toLowerCase before storage confirmed at users.service.ts:155). If the stored canonical form is 'User@Example.com' and the login attempt uses 'user@example.com', findUnique returns null and authentication fails, even though the uniqueness constraint would block creating a second user.

**Root cause:**
Prisma's @unique PSL constraint generates a plain B-tree index that Prisma uses for findUnique calls; adding a separate LOWER() functional index enforces DB-level case-insensitive uniqueness at write time but does not make Prisma findUnique case-insensitive at read time. Emails are stored as-is (not normalized to lowercase), so the case-sensitivity gap on read paths is real.

**Code evidence:**
```
-- AlterTable: cap email to VarChar(254) per RFC 5321 max length
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);

-- CreateIndex: case-insensitive unique index on email (LOWER() functional index)
-- NOTE: not CONCURRENTLY — migrations run inside a transaction
CREATE UNIQUE INDEX "users_email_lower_uk" ON "users" (LOWER(email));

-- CreateIndex: case-insensitive unique index on login
CREATE UNIQUE INDEX "users_login_lower_uk" ON "users" (LOWER(login));
```

**Suggested fix:**
For consistent case-insensitive email handling: (1) Normalize all email inputs to lowercase in the application layer (auth.service.ts, users.service.ts) before DB storage AND before lookup. (2) Once all stored emails are lowercase, the LOWER() functional index and the plain @unique become equivalent and the plain one can be dropped via `DROP INDEX users_email_key`. Alternatively, replace Prisma findUnique with findFirst + raw WHERE LOWER(email) = LOWER($1) for auth lookups, but this bypasses Prisma's unique index optimization.

**Acceptance criteria:**
1. prisma.user.findUnique({ where: { email: 'USER@EXAMPLE.COM' } }) returns the same row as findUnique({ where: { email: 'user@example.com' } })
2. Attempting to create a user with 'USER@EXAMPLE.COM' when 'user@example.com' exists fails with a unique constraint error
3. No two users have emails that differ only in case
4. Commit message includes `[closes DAT-016]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT email, COUNT(*) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1; -- should return 0 rows after normalization
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CONFIRMED. Migration code evidence is verbatim. auth.service.ts line 80-81: `prisma.user.findUnique({ where: { email: login } })` verified — no toLowerCase on login before call. users.service.ts line 155: `email: createUserDto.email` — stored as-is. Registration path (auth.service.ts line 333) also stores as-is. The migration comment acknowledges 'compatible with the existing @unique Prisma declarations used by findUnique calls in auth.service.ts' but this is the issue — findUnique on email is case-sensitive. The same dual-index pattern is applied to login but login is typically typed exactly … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### DAT-017 — TaskDependency.dependsOnTaskId has no index — cascade delete on Task triggers seq-scan

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing-index-on-fk
- **File:** `packages/database/prisma/schema.prisma:391-403`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-017` · audit-confidence: high · found_by: data_integrity

**Description:**
The composite `@@unique([taskId, dependsOnTaskId])` creates an index with `taskId` as the leading column. Queries and FK checks driven from the `dependsOnTaskId` side (e.g., 'which tasks depend on task X?', or the PostgreSQL FK cascade when deleting a Task referenced as dependsOnTask) cannot use this index and will perform a full seq-scan on task_dependencies. As tasks accumulate, this becomes a lock/latency hotspot on every Task deletion or dependency lookup from the 'dependency target' side.

**Root cause:**
Only the forward-direction unique index was declared; no reverse index was added for the `dependsOnTaskId` FK column.

**Code evidence:**
```
model TaskDependency {
  id              String   @id @default(uuid())
  taskId          String
  dependsOnTaskId String
  createdAt       DateTime @default(now())

  // Relations
  task          Task @relation("TaskDependencies", fields: [taskId], references: [id], onDelete: Cascade)
  dependsOnTask Task @relation("DependentTasks", fields: [dependsOnTaskId], references: [id], onDelete: Cascade)

  @@unique([taskId, dependsOnTaskId])
  @@map("task_dependencies")
}
```

**Suggested fix:**
Add a reverse index:

  @@index([dependsOnTaskId]) // reverse-lookup: tasks that depend on a given task

Migration: pnpm run db:migrate

**Acceptance criteria:**
1. psql: `\d task_dependencies` shows an index on dependsOnTaskId
2. EXPLAIN on `SELECT * FROM task_dependencies WHERE "dependsOnTaskId" = $1` uses an index scan
3. Commit message includes `[closes DAT-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'task_dependencies';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Related (same run): PER-035.
- Audit note: ADVERSARIAL REVIEW CONFIRMED. Verified schema.prisma lines 391-403 verbatim — no @@index([dependsOnTaskId]). Checked ALL migrations referencing task_dependencies (init + DAT-018): init only creates the composite unique index on (taskId, dependsOnTaskId); DAT-018 adds a no-self-loop CHECK and a cycle-prevention trigger — neither adds a dependsOnTaskId index. No migration anywhere adds this index. The DAT-029 pattern (@@index([serviceId]) on UserService, @@index([userId]) on ProjectMember) was not applied here.

**Closed_by:** (empty — TODO)

---

### DAT-018 — UserSkill.skillId has no standalone index — cascade delete on Skill triggers seq-scan

- **Status:** TODO
- **Phase:** 2
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing-index-on-fk
- **File:** `packages/database/prisma/schema.prisma:763-777`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-018` · audit-confidence: high · found_by: data_integrity

**Description:**
The composite PK `@@id([userId, skillId])` creates a B-tree index with `userId` as the leading column. Looking up 'all users with skill X' (the reverse direction) or firing the `onDelete: Cascade` FK enforcement when deleting a Skill row requires scanning the entire `user_skills` table on the skillId column. The DAT-029 annotation explicitly added @@index([serviceId]) to UserService for the same structural reason; UserSkill was not covered.

**Root cause:**
The composite PK only covers the userId-leading direction; no standalone index was declared for skillId.

**Code evidence:**
```
model UserSkill {
  userId      String
  skillId     String
  level       SkillLevel
  validatedBy String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([userId, skillId])
  @@map("user_skills")
}
```

**Suggested fix:**
Add a reverse index:

  @@index([skillId]) // DAT-029 pattern: reverse-lookup 'all users with skill X'

Migration: pnpm run db:migrate

**Acceptance criteria:**
1. psql: `\d user_skills` shows an index on skillId
2. EXPLAIN on `SELECT * FROM user_skills WHERE "skillId" = $1` uses an index scan
3. Commit message includes `[closes DAT-018]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'user_skills';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW CONFIRMED. Verified schema.prisma lines 763-777 verbatim — no @@index([skillId]). Checked all migrations: no migration adds a skillId index on user_skills. The @@id([userId, skillId]) PK only covers userId-leading lookups. Finding is structurally identical to DAT-029 pattern that was applied to UserService but missed UserSkill.

**Closed_by:** (empty — TODO)

---

### COR-013 — countWorkingDays: local-TZ setDate/getDate arithmetic causes DST off-by-one — one day may be counted twice or skipped

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · tz_naive_date_arithmetic
- **File:** `apps/api/src/holidays/holidays.service.ts:460-477`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-013` · audit-confidence: high · found_by: correctness

**Description:**
Three separate TZ issues interact here:
1. `current.setDate(current.getDate() + 1)` uses local-TZ date components. On a Europe/Paris host at the DST transition (end of March: clocks spring forward from 02:00 to 03:00), adding one local day advances the UTC timestamp by only 23 hours, not 24. On the autumn transition (02:00 → 01:00), advancing by one local day adds 25 UTC hours — making `current > endDate` false when it should be true, causing the last day to be counted twice.
2. `current.getDay()` is local-TZ; `dateStr = current.toISOString().split('T')[0]` is UTC. If startDate is provided as a UTC-midnight Date (typical for @db.Date columns) and the host runs at Europe/Paris (+01/+02), `getDay()` returns the local day-of-week (same as UTC in this case) but `dateStr` is already correct. However, `nonWorkingHolidayDates` is built via `.toISOString().split('T')[0]` on `h.date` which is also UTC — so these two UTC strings match. The primary risk is the DST loop increment.

**Root cause:**
`setDate/getDate` operates in local calendar time; on a Paris host the DST spring-forward transition causes a loop iteration that advances by only 23 hours, allowing one date to appear in two consecutive loop iterations.

**Code evidence:**
```
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Exclut samedi (6) et dimanche (0) et jours fériés non ouvrés
      if (
        dayOfWeek !== 0 &&
        dayOfWeek !== 6 &&
        !nonWorkingHolidayDates.has(dateStr)
      ) {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }
```

**Suggested fix:**
Replace the cursor-advance with UTC arithmetic matching the pattern in `leave-year-window.ts`:
ʼʼʼts
current.setUTCDate(current.getUTCDate() + 1);
ʼʼʼ
and use `current.getUTCDay()` for the day-of-week check to stay consistently in UTC.

**Acceptance criteria:**
1. countWorkingDays('2025-03-28', '2025-03-31') returns 2 (Fri 28 + Mon 31, excluding DST Sunday 30 and Saturday 29)
2. countWorkingDays('2025-10-24', '2025-10-27') returns 2 (Fri 24 + Mon 27)
3. Commit message includes `[closes COR-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
node -e "const d = new Date(Date.UTC(2025,2,29)); d.setDate(d.getDate()+1); console.log(d.toISOString())" # should be 2025-03-30T22:00:00.000Z on Europe/Paris host, not 2025-03-30T23:00:00.000Z
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The leave-year-window.ts module correctly uses setUTCDate/getUTCDate throughout. This function in holidays.service.ts should adopt the same pattern. Adversarial check: countWorkingDays is only called from the holidays controller (informational endpoint) — confirmed via grep. It is not wired into balance calculations, so impact is limited to display data. Code verbatim confirmed at lines 460-477.

**Closed_by:** (empty — TODO)

---

### COR-015 — getAvailableDays: existing leaves fetched without endHalfDay field — consumed days under-counted when stored leave has endHalfDay

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing_field_in_query_projection
- **File:** `apps/api/src/leaves/leaves.service.ts:2587-2614`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-015` · audit-confidence: high · found_by: correctness

**Description:**
The `select` projection on line 2604 only fetches `halfDay` (the start-half-day) but not `endHalfDay`. When `splitLeaveByYear` is called with `null` as the fourth argument (endHalfDay), it computes consumed days without the end-half-day deduction. Since the database `Leave` model only persists `halfDay` (not `endHalfDay` — verified in schema.prisma), and `create()` only stores `effectiveHalfDay || undefined` in the `halfDay` field (which is `halfDay || startHalfDay`), the `endHalfDay` is intentionally transient and never persisted. However, the stored `days` column DOES include the endHalfDay deduction (via `calculateLeaveDays` in `create()`). This means there is a discrepancy: the `days` column reflects the endHalfDay, but `getAvailableDays` re-derives consumed days without it, causing the available balance to be understated by 0.5 day for each existing leave that had `endHalfDay` set.

**Root cause:**
The Leave schema has no `endHalfDay` column, so the value is permanently lost after `create()`. `getAvailableDays` re-derives consumption from stored records but cannot recover the missing endHalfDay, leading to 0.5-day under-counting of available balance.

**Code evidence:**
```
    const intersecting = await db.leave.findMany({
      where: {
        userId,
        leaveTypeId,
        status: {
          in: [
            LeaveStatus.APPROVED,
            LeaveStatus.CANCELLATION_REQUESTED,
            LeaveStatus.PENDING,
          ],
        },
        startDate: { lt: yearEnd },
        endDate: { gte: yearStart },
        ...(options.excludeLeaveId
          ? { id: { not: options.excludeLeaveId } }
          : {}),
      },
      select: { startDate: true, endDate: true, halfDay: true },
    });

    const usedThisYear = intersecting.reduce((sum, l) => {
      const buckets = splitLeaveByYear(
        l.startDate,
        l.endDate,
        l.halfDay ?? null,
        null,
        holidayKeys,
      );
```

**Suggested fix:**
Either: (a) Add an `endHalfDay HalfDay?` column to the `Leave` model in schema.prisma and persist it in `create()` and `update()` — then include it in the `select` and pass it to `splitLeaveByYear`; or (b) Deprecate `endHalfDay` in the DTO and clarify in documentation that only `halfDay`/`startHalfDay` is persisted.

**Acceptance criteria:**
1. Creating a leave with endHalfDay=AFTERNOON and then querying getAvailableDays shows the correctly deducted balance (not 0.5 extra deducted)
2. The days column stored in DB matches the value computed by getAvailableDays when re-deriving usedThisYear
3. Commit message includes `[closes COR-015]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: create leave with endHalfDay, then call GET /leaves/me/balance and verify available = allocated - stored_days
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The issue is architectural: endHalfDay is accepted in the DTO, affects the `days` computation, but is never persisted. The `getAvailableDays` re-derivation cannot be correct without it. The fix with lowest risk is option (a) — add the column. Adversarial check: schema.prisma confirmed only `halfDay HalfDay?` at line 618, no endHalfDay field. splitLeaveByYear confirmed to use endHalfDay parameter (lines 140-141 of leave-year-window.ts). create() confirmed stores only `halfDay: effectiveHalfDay` (line 614). Finding stands.

**Closed_by:** (empty — TODO)

---

### COR-020 — ICS export silently drops leaves that span the requested date window (startDate before and endDate after the range)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business_invariant — incorrect range filter
- **File:** `apps/api/src/planning-export/planning-export.service.ts:100-108`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-020` · audit-confidence: high · found_by: correctness

**Description:**
The date filter for leaves uses `OR: [{startDate: dateFilter}, {endDate: dateFilter}]`. This matches leaves that START within the window or END within the window, but misses leaves that SPAN the window entirely (startDate < window.start AND endDate > window.end). A common real-world case: annual leave running Jan 1–Dec 31, exported for June 1–30 — neither condition matches and the leave is absent from the ICS. Events and telework days use a point-in-time `date` field so they are unaffected. Only the leave filter has this semantic gap.

**Root cause:**
The OR filter checks that startDate falls in the range OR endDate falls in the range, but never checks for spanning overlap (startDate <= end AND endDate >= start).

**Code evidence:**
```
    const leaves = await this.prisma.leave.findMany({
      where: {
        userId,
        status: 'APPROVED',
        ...(start || end
          ? { OR: [{ startDate: dateFilter }, { endDate: dateFilter }] }
          : {}),
      },
      include: { leaveType: true },
    });
```

**Suggested fix:**
Replace the OR filter with an overlap predicate: `{ startDate: { lte: new Date(end) }, endDate: { gte: new Date(start) } }`. This is the standard "intervals overlap" condition and matches all three cases (leave starting in range, ending in range, or spanning).

**Acceptance criteria:**
1. An APPROVED leave with startDate='2026-01-01' and endDate='2026-12-31' is included in an ICS export requested for start='2026-06-01' end='2026-06-30'
2. A leave that starts and ends within the window is still included
3. A leave entirely outside the window is still excluded
4. Commit message includes `[closes COR-020]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'startDate\|endDate\|dateFilter' apps/api/src/planning-export/planning-export.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Events and telework use a single date point so they are unaffected. Only the leaves query has this spanning-overlap gap. Adversarial check: dateFilter = { gte: new Date(start), lte: new Date(end) } (lines 55-57). Applied as OR: [{startDate: dateFilter}, {endDate: dateFilter}] — confirmed spans are missed. No secondary filter or post-query correction found. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-022 — assertTeleworkCompatibility: date comparison uses naive new Date(string) — TZ ambiguity with date-only strings

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:33-38`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-022` · audit-confidence: medium · found_by: correctness

**Description:**
The dates array received from the DTO contains ISO date strings. These are passed through `new Date(date)` and used in an `IN` filter against the DB `date` column (@db.Date). The TeleworkSchedule.date is a PostgreSQL DATE type. If date-only strings like '2026-03-25' are passed (which are valid @IsDateString() inputs), new Date('2026-03-25') in Node.js parses as midnight UTC — which happens to be correct for UTC servers. However, occurrence-generator.ts uses Date.UTC() strictly, creating an inconsistency in convention. On non-UTC deployments, date-only strings would produce wrong dates.

**Root cause:**
Inconsistent date construction: occurrence-generator uses Date.UTC() strictly; assertTeleworkCompatibility uses new Date(string) which is TZ-sensitive for date-only strings.

**Code evidence:**
```
    const teleworkSchedules = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId: { in: userIds },
        date: { in: dates.map((date) => new Date(date)) },
        isTelework: true,
      },
      select: { userId: true, date: true },
    });
```

**Suggested fix:**
Normalize date strings to midnight UTC before querying: `dates.map(d => { const p = d.split('T')[0]; const [y,m,day] = p.split('-').map(Number); return new Date(Date.UTC(y, m-1, day)); })` — matching the occurrence-generator convention.

**Acceptance criteria:**
1. Telework conflict check correctly detects conflicts on any server TZ setting
2. Integration test passes with TZ=America/New_York
3. Commit message includes `[closes COR-022]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'new Date(date)\|new Date(dateStr)\|Date.UTC' apps/api/src/predefined-tasks/predefined-tasks.service.ts apps/api/src/predefined-tasks/occurrence-generator.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Prod is UTC (MEMORY.md), TeleworkSchedule.date is @db.Date. BulkAssignmentDto uses @IsDateString() with UTC-qualified examples. Risk is latent but real for date-only inputs or non-UTC deployments.

**Closed_by:** (empty — TODO)

---

### COR-034 — getWeeklySchedule uses local-TZ getDay()/setDate()/setHours() for week boundary calculation, breaking on non-UTC servers

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · timezone / local-TZ date arithmetic
- **File:** `apps/api/src/telework/telework.service.ts:417-429`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-034` · audit-confidence: medium · found_by: correctness

**Description:**
getWeeklySchedule computes week boundaries using local-TZ methods (getDay, getDate, setDate, setHours). This contradicts the module's own documented approach: all other date operations in this file use UTC-anchored arithmetic (dayKeyToUTCDate, teleworkDayKey, Date.UTC) explicitly to avoid local-TZ DST hazards. On a server running in Europe/Paris (or any non-UTC TZ), getDay() returns the local calendar day, setHours(0,0,0,0) sets local midnight, and the resulting Date values have UTC representations that may be off by ±1–2 hours relative to UTC-midnight stored DB dates. The stored dates are always UTC-midnight (enforced by dayKeyToUTCDate). The gte/lte comparison therefore uses mismatched anchors: local-midnight vs UTC-midnight, producing off-by-one boundary mismatches during DST transitions.

**Root cause:**
Date boundary math uses local-TZ getters/setters instead of the UTC-anchored helpers (`dayKeyToUTCDate`, `Date.UTC`) established elsewhere in the same file for precisely this reason.

**Code evidence:**
```
    const referenceDate = date ? new Date(date) : new Date();

    // Calculer le début et la fin de la semaine (lundi à dimanche)
    const dayOfWeek = referenceDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Lundi = début

    const start = new Date(referenceDate);
    start.setDate(referenceDate.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Dimanche
    end.setHours(23, 59, 59, 999);
```

**Suggested fix:**
Use the same day-key arithmetic already in the file:
ʼʼʼts
const refKey = teleworkDayKey(referenceDate);
const jsDay = new Date(Date.UTC(...refKey.split('-').map(Number))).getUTCDay();
const diff = jsDay === 0 ? -6 : 1 - jsDay;
// advance/retreat by diff days using nextTeleworkDayKey loop or UTC arithmetic
const startKey = /* cursor from refKey by diff steps */;
const endKey = /* startKey + 6 days */;
const start = dayKeyToUTCDate(startKey);
const end = new Date(dayKeyToUTCDate(endKey).getTime() + 86400000 - 1);
ʼʼʼ

**Acceptance criteria:**
1. On a process running with TZ=Europe/Paris, getWeeklySchedule('2025-03-30') returns Monday=2025-03-24 as weekStart (UTC midnight), not 2025-03-23T23:00:00Z.
2. Week boundaries match the UTC-midnight dates stored by dayKeyToUTCDate.
3. Commit message includes `[closes COR-034]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
TZ=Europe/Paris node -e "const d=new Date('2025-03-30');d.setHours(0,0,0,0);console.log(d.toISOString())"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED as stated. Verbatim code verified at lines 417-429. Note: the module-level constant TELEWORK_TZ = 'Europe/Paris' (line 18) and the use of formatInTimeZone for teleworkDayKey explicitly anchor all date computations to the Paris calendar. getWeeklySchedule deviates from this design contract by using local-TZ methods. Prod server is UTC per MEMORY.md (so on UTC, local midnight = UTC midnight and getDay() = UTC day), making this latent on prod but active on dev machines running Europe/Paris TZ. Severity correctly set to important rather than blocking given prod UTC mi … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### COR-035 — getUserStats builds year boundaries with local-TZ new Date(year,0,1) and getTeamSchedule uses local-midnight setHours(0,0,0,0) for exact-match against UTC-midnight DB dates

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · timezone / local-TZ date arithmetic
- **File:** `apps/api/src/telework/telework.service.ts:463-466`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-035` · audit-confidence: medium · found_by: correctness

**Description:**
getUserStats constructs year boundaries using the local-TZ constructor `new Date(year, month, day)`. On a Europe/Paris server, `new Date(2026, 0, 1)` evaluates to `2025-12-31T23:00:00Z` (UTC), not `2026-01-01T00:00:00Z`. The `gte` filter would therefore include one entry from Dec 31 of the prior year. Separately, getTeamSchedule (line 948-952) sets `targetDate.setHours(0,0,0,0)` (local midnight) then uses `where.date = targetDate` as an exact equality filter against UTC-midnight stored dates. On a non-UTC server, local midnight ≠ UTC midnight → the exact-match filter returns zero rows for every query.

**Root cause:**
Local-TZ constructors and setters used where UTC-anchored Date.UTC() is required, inconsistent with the module-level COR-012/COR-027 design.

**Code evidence:**
```
    const currentYear = year ?? new Date().getFullYear();

    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
```

**Suggested fix:**
For getUserStats: use `new Date(Date.UTC(currentYear, 0, 1))` and `new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999))`. For getTeamSchedule: derive the target day key and use `dayKeyToUTCDate(teleworkDayKey(targetDate))` for the exact-match value.

**Acceptance criteria:**
1. On a TZ=Europe/Paris process, getUserStats(user, 2026) does not include rows dated 2025-12-31.
2. On a TZ=Europe/Paris process, getTeamSchedule('2026-01-15') returns rows whose date field is 2026-01-15T00:00:00Z.
3. Commit message includes `[closes COR-035]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
TZ=Europe/Paris node -e "console.log(new Date(2026,0,1).toISOString())"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: CONFIRMED as stated. Verbatim code verified at lines 463-466 (getUserStats) and 947-953 (getTeamSchedule — targetDate.setHours(0,0,0,0) then used as exact equality filter). Both deviate from the module's UTC-anchored design contract. Prod server is UTC so latent on prod, active on Europe/Paris dev machines. Same latency caveat as S6-5.

**Closed_by:** (empty — TODO)

---

### OBS-019 — Profile page shows `new Date()` (current time) as 'last login' instead of actual last-login timestamp

- **Status:** TODO
- **Phase:** 2
- **Cluster:** K
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · misleading-security-info
- **File:** `apps/web/app/[locale]/profile/page.tsx:344-356`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-019` · audit-confidence: high · found_by: observability

**Description:**
The Security tab of the profile page displays a 'last login' date but uses `new Date()` — the current page-render time — instead of the actual last-login timestamp from the authenticated user object. This renders the security control useless: the displayed time will always be 'right now', giving users no ability to detect unauthorised logins. Additionally, `new Date()` re-evaluates on every render, so the displayed time can update while the user watches the page.

**Root cause:**
Placeholder implementation was never replaced with the actual `user.lastLoginAt` (or equivalent) field.

**Code evidence:**
```
                <p className="text-sm text-gray-600">
                  {t("security.loginHistory.lastLogin")}{" "}
                  {new Date().toLocaleDateString(
                    locale === "en" ? "en-US" : "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
```

**Suggested fix:**
If the API provides `lastLoginAt` on the `User` type, use `user.lastLoginAt` here. If not, either remove the section or fetch it from the API (e.g. `GET /auth/me` already returns the user object). Ensure the `User` type and the Prisma schema include `lastLoginAt: DateTime?`.

**Acceptance criteria:**
1. The 'last login' date shown equals the server-recorded last-login timestamp, not the current browser time
2. The value does not change when the page re-renders without a new login
3. Commit message includes `[closes OBS-019]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: note displayed date, reload page, confirm it does NOT change
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at profile/page.tsx lines 344-356. Additionally confirmed that `lastLoginAt` does not exist in the Prisma schema (packages/database/prisma/schema.prisma) or in packages/types/, so even if the code were fixed, the backend field does not exist yet either. Confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-007 — Unauthenticated health endpoint reveals per-component infrastructure status (DB/Redis) to any caller

- **Status:** TODO
- **Phase:** 2
- **Cluster:** K
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · information-disclosure
- **File:** `apps/api/src/health/health.service.ts:78-86`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-007` · audit-confidence: high · found_by: security

**Description:**
The /health endpoint is decorated @Public() and returns per-component status: { status, db, redis } in every response. On 200, it confirms both DB and Redis are reachable. On 503, it reveals exactly which dependency (db vs redis) is down. This endpoint is not rate-limited beyond the global defaults (30/s per IP) and requires no authentication. An attacker can infer infrastructure topology (what backing services are present) and monitor for partial outages in real time, which aids targeted timing attacks during degraded states.

**Root cause:**
HealthStatus interface exposes named component fields ('db', 'redis') directly in the HTTP body returned to any caller, with no authentication requirement.

**Code evidence:**
```
    if (dbStatus === 'down' || redisStatus === 'down') {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: dbStatus,
        redis: redisStatus,
      });
    }

    return { status: 'ok', db: dbStatus, redis: redisStatus };
```

**Suggested fix:**
Return only { status: 'ok' | 'degraded' } to unauthenticated callers. Log per-component detail server-side only, or gate the granular payload behind a @Roles([ADMIN]) authenticated endpoint. Alternatively, return a minimal { ok: boolean } and rely on Prometheus metrics for operator drill-down.

**Acceptance criteria:**
1. GET /api/health returns at most { status: 'ok' | 'degraded' } to unauthenticated callers — no 'db' or 'redis' fields
2. Per-component detail is logged server-side and/or exposed on an authenticated /api/health/detail endpoint
3. E2E smoke test verifies 200 body does not contain 'db' or 'redis' keys
4. Commit message includes `[closes SEC-007]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s http://localhost:4000/api/health | jq 'keys'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim in health.service.ts lines 78-86. health.controller.ts confirms @Public() decorator with no auth guard. The comment 'Does NOT expose process.uptime, NODE_ENV, or any internal process info' is accurate for those specific fields but db/redis component names ARE infrastructure detail and are exposed. Finding confirmed as-is.

**Closed_by:** (empty — TODO)

---

### PER-009 — MetricsInterceptor uses raw URL path as label key — unbounded Map growth via unique UUIDs

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-memory-growth
- **File:** `apps/api/src/metrics/metrics.interceptor.ts:34`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-009` · audit-confidence: high · found_by: performance

**Description:**
The interceptor passes `req.path` (raw URL, e.g. `/api/projects/550e8400-e29b-41d4-a716-446655440000`) as the `route` label into `MetricsService.recordRequest`. Every distinct UUID or resource ID in the URL becomes a unique Map key. MetricsService holds these Maps for the entire process lifetime with no eviction or cap. On a long-lived server with many resources, this leaks memory proportionally to the number of unique URLs ever requested.

**Root cause:**
`req.path` carries the actual runtime path including resource IDs; the correct label is the route template (e.g. `/api/projects/:id`), accessible via `req.routerPath` or `request.routeOptions.url` in Fastify.

**Code evidence:**
```
    const route = req.path ?? '/';

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const status = res.statusCode ?? 200;
        const durationMs = Date.now() - start;
        try {
          this.metricsService.recordRequest(method, route, status, durationMs);
```

**Suggested fix:**
In Fastify, use `req.routeOptions?.url ?? req.routerPath ?? req.path` to get the route template. Rename the local variable to `routeTemplate` and pass that to `recordRequest`. Example: `const route = (req as FastifyRequest).routeOptions?.url ?? req.path ?? '/';`

**Acceptance criteria:**
1. GET /api/projects/uuid-1 and GET /api/projects/uuid-2 map to the same label `/api/projects/:id`
2. After N distinct resource requests, requestCounter.size is bounded by (distinct routes × distinct statuses × distinct methods), not N
3. Prometheus output contains route labels like `/api/projects/:id` not raw UUIDs
4. Commit message includes `[closes PER-009]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'routeOptions\|routerPath\|req.path' apps/api/src/metrics/metrics.interceptor.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: This is an always-on interceptor applied globally (APP_INTERCEPTOR). The leak is continuous and correlates with traffic volume. Verified: line 34 reads `const route = req.path ?? '/';` verbatim. MetricsService.requestCounter and durationSummary are plain Maps with no eviction or size cap.

**Closed_by:** (empty — TODO)

---

### SEC-010 — Swagger Basic Auth: passwords containing ':' are silently truncated, enabling credential bypass with a shorter guessable suffix

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · Swagger Basic Auth / credentials parsing
- **File:** `apps/api/src/main.ts:198-200`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-010` · audit-confidence: high · found_by: security

**Description:**
The Basic Auth credential parser uses `.split(':')` without a limit argument. If the configured SWAGGER_PASS contains a colon (e.g. `p@ss:word`), destructuring assignment `const [user, pass]` will receive only `p@ss` as `pass`, silently discarding the `word` suffix. The safeEqual comparison then compares the truncated string against the full configured password — which will fail — locking out the legitimate user. Conversely, an attacker who knows the password up to the first colon can log in with `p@ss` as the password. The HTTP Basic Auth RFC 7617 specifies that only the FIRST colon is a separator; the rest of the decoded string is the password.

**Root cause:**
`.split(':')` without a count/limit parameter splits on ALL colons; the RFC-correct approach is to split on the FIRST colon only.

**Code evidence:**
```
            const [user, pass] = Buffer.from(auth.slice(6), 'base64')
              .toString()
              .split(':');
```

**Suggested fix:**
Use a regex or indexOf to split only on the first colon:
ʼʼʼtypescript
const colonIndex = decoded.indexOf(':');
const user = decoded.slice(0, colonIndex);
const pass = decoded.slice(colonIndex + 1);
ʼʼʼ
Full fix:
ʼʼʼtypescript
const decoded = Buffer.from(auth.slice(6), 'base64').toString();
const sep = decoded.indexOf(':');
const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
const pass = sep >= 0 ? decoded.slice(sep + 1) : '';
ʼʼʼ

**Acceptance criteria:**
1. Swagger Basic Auth correctly authenticates when SWAGGER_PASS='p@ss:word' and the request uses password 'p@ss:word'
2. Swagger Basic Auth rejects requests using only 'p@ss' as password when SWAGGER_PASS='p@ss:word'
3. Unit test covers colon-in-password scenario
4. Commit message includes `[closes SEC-010]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: inspect main.ts line 198-200
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review confirmed: main.ts lines 198-200 code evidence matches verbatim. The `.split(':')` without limit is confirmed. safeEqual() in main.ts (lines 34-38) uses timingSafeEqual correctly but operates on an already-truncated `pass` value when the password contains colons. The finding correctly characterizes the RFC 7617 violation. Low probability in practice (passwords containing ':' are unusual) but the parser is structurally incorrect.

**Closed_by:** (empty — TODO)

---

### SEC-012 — Prometheus metric labels built from unsanitized req.path — label injection possible

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · prometheus-label-injection
- **File:** `apps/api/src/metrics/metrics.service.ts:37`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-012` · audit-confidence: high · found_by: security

**Description:**
The Prometheus text-format label string on line 37 is assembled by direct template interpolation of `route` (which equals `req.path` from the interceptor, line 34 of metrics.interceptor.ts). The `req.path` value comes from the raw request URL path and is not sanitized. A request whose path contains `"` or `}` will corrupt the label grammar, e.g. GET /api/test"} injected{x="1 produces the line `http_requests_total{method="GET",route="/api/test"} injected{x="1",status="200"} 1`. This is exploitable for Prometheus scraper confusion and could, in edge scenarios, overwrite metric values in Prometheus.

**Root cause:**
Route label value is taken verbatim from `req.path` and interpolated into the Prometheus text format without escaping double quotes or other special characters.

**Code evidence:**
```
  recordRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ): void {
    const labels = `method="${method}",route="${route}",status="${status}"`;
```

**Suggested fix:**
Escape double-quote characters in all label values before building the label string, or use an established Prometheus client library (prom-client) that handles escaping automatically. At minimum: `route.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')`.

**Acceptance criteria:**
1. A request path containing '"' or '}' does not break Prometheus text format output
2. Unit test for renderMetrics with a label containing special characters passes
3. Commit message includes `[closes SEC-012]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'labels\|route\|method' apps/api/src/metrics/metrics.service.ts | head -15
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial re-check: code_evidence verified verbatim at line 37 of metrics.service.ts. The interceptor (metrics.interceptor.ts line 34) confirms route = req.path with no sanitization. The renderMetrics() method (lines 66-80) interpolates the raw labels string directly into the output. No escaping or normalization layer exists anywhere in the pipeline.

**Closed_by:** (empty — TODO)

---

### SEC-031 — API proxy forwards `host` header to internal backend (host-header injection)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** security · host-header-injection
- **File:** `apps/web/app/api/[...path]/route.ts:4-18`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-031` · audit-confidence: medium · found_by: security

**Description:**
The `filterHeaders` function only removes hop-by-hop headers. The `host` header (plus `x-forwarded-for`, `x-forwarded-proto`, `x-real-ip`) is forwarded verbatim to the internal API at `http://localhost:4000`. If the NestJS API uses the `host` header to generate absolute URLs (e.g. password-reset links, ICS download URLs, CORS decisions, or email tokens), an attacker who controls the Host header in their request to the Next.js frontend can inject an arbitrary host, causing the API to emit URLs pointing to an attacker-controlled domain.

**Root cause:**
`host` is not in the HOP_BY_HOP filter set, so it passes through the proxy to the internal API unchanged.

**Code evidence:**
```
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "te",
  "trailer",
]);

function filterHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out[key] = value;
    }
  });
  return out;
}
```

**Suggested fix:**
Add `'host'` (and optionally `'x-forwarded-for'`, `'x-forwarded-host'`, `'x-real-ip'`) to the `HOP_BY_HOP` set, or add an explicit block list. Example: `const BLOCKED = new Set(['host', 'x-forwarded-host', 'x-real-ip']); if (!HOP_BY_HOP.has(key) && !BLOCKED.has(key)) { out[key] = value; }`

**Acceptance criteria:**
1. Sending `Host: attacker.com` to `POST /api/auth/login` does NOT forward `host: attacker.com` to the NestJS backend
2. Existing authenticated requests still work with the correct Bearer token forwarded
3. Commit message includes `[closes SEC-031]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -X POST http://localhost:3000/api/auth/login -H 'Host: evil.com' -H 'Content-Type: application/json' -d '{"login":"x","password":"x"}' -v 2>&1 | grep -i '< host'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed. DOWNGRADED from high to medium: adversarial review found that the NestJS API does NOT use the `host` request header anywhere in its source — password-reset URLs are built from `process.env.FRONTEND_URL` (auth.service.ts:540), not from the request host. No `req.headers.host` or equivalent usage found in apps/api/src/. The structural gap (missing `host` in the filter set) is real but its impact is currently limited to leaking the public hostname to the internal API; there is no active exploit path in the current codebase. Remains confirmed because the defensive … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### COR-041 — Login/register: JWT stored in localStorage before permissions fetch — broken auth state on network error

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · inconsistent-auth-state-on-login-failure
- **File:** `apps/web/app/[locale]/login/page.tsx:27-43`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-041` · audit-confidence: high · found_by: correctness

**Description:**
`authService.login()` persists the JWT to `localStorage` (`persistSession`) before `api.get('/auth/me/permissions')` is called. If the permissions request fails (transient network error, rate-limiting, server overload), the catch block shows a generic error toast, but the JWT is already stored. The user sees 'login failed' but is actually authenticated. On the next page load, `useAuthBootstrap` re-hydrates cleanly (it fetches both endpoints in parallel), so the broken state is self-healing — but only on reload. If the user clicks 'submit' again, `authService.login()` makes a second login call with the same credentials while already having a valid JWT, wasting a session. The same issue exists in `register/page.tsx` at lines 37-54.

**Root cause:**
`persistSession` in `auth.service.ts` stores the token immediately on login response, before the secondary permissions fetch completes.

**Code evidence:**
```
    try {
      const response = await authService.login(formData);
      const permsRes = await api.get<{ permissions: string[] }>(
        "/auth/me/permissions",
      );
      setAuth(response.user, permsRes.data.permissions);
      toast.success(t("login.success"));
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("login.errors.generic"),
      );
    }
```

**Suggested fix:**
In `auth.service.ts`, defer `localStorage.setItem(AUTH_TOKEN_KEY, ...)` until after the permissions fetch succeeds, OR in the login page handler, catch the permissions failure separately and fall back to `useAuthBootstrap`'s re-hydration rather than showing a generic error. The cleanest fix is to not call `/auth/me/permissions` in the login handler at all — `useAuthBootstrap` already does this on mount, so a `router.push` after login is sufficient; the dashboard layout's bootstrap will populate permissions.

**Acceptance criteria:**
1. If the server returns 200 on login but the permissions endpoint times out, the user is redirected to the dashboard and useAuthBootstrap fetches permissions successfully
2. No JWT is stored if login itself fails (HTTP 401)
3. Commit message includes `[closes COR-041]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: throttle /auth/me/permissions in devtools; confirm login still works
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed in login/page.tsx lines 27-43 and register/page.tsx lines 37-54. auth.service.ts:persistSession() at line 68 is called within authService.login() before the caller has a chance to fetch permissions. No guard elsewhere reverses this. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-042 — handleUpdateProject has no error handling — silent failure on project update

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · unhandled-error
- **File:** `apps/web/app/[locale]/projects/[id]/page.tsx:959-965`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-042` · audit-confidence: high · found_by: correctness

**Description:**
`handleUpdateProject` awaits two API calls (`projectsService.update` and `projectsService.getById`) with no try/catch. If either call throws (network error, 403, 422 validation), the promise rejects and the error propagates uncaught to the caller (ProjectEditModal's `onSave`). Since ProjectEditModal likely does not wrap this in its own try/catch (it calls `onSave` which it receives as a prop), the user sees no feedback and the modal may remain open or close silently depending on the modal's own error handling.

**Root cause:**
No try/catch around async API calls in `handleUpdateProject`, unlike every other mutation handler in this file which all have try/catch blocks.

**Code evidence:**
```
  // Project update handler
  const handleUpdateProject = async (data: UpdateProjectDto) => {
    await projectsService.update(projectId, data);
    toast.success(t("messages.updateSuccess"));
    // Refresh project data
    const projectData = await projectsService.getById(projectId);
    setProject(projectData);
  };
```

**Suggested fix:**
Wrap the body in try/catch matching the pattern used in `handleHardDeleteProject`:
ʼʼʼts
try {
  await projectsService.update(projectId, data);
  toast.success(t('messages.updateSuccess'));
  const projectData = await projectsService.getById(projectId);
  setProject(projectData);
} catch (err) {
  const axiosError = err as { response?: { data?: { message?: string } } };
  toast.error(axiosError.response?.data?.message || t('messages.updateError'));
  throw err; // re-throw so ProjectEditModal can keep modal open
}
ʼʼʼ

**Acceptance criteria:**
1. A simulated 422 from projectsService.update triggers an error toast
2. The edit modal remains open after a failed save
3. Commit message includes `[closes COR-042]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: verified at lines 958-965. handleHardDeleteProject immediately below (line 968) uses try/catch — confirms the missing pattern is inconsistent. No higher-level global error handler wraps this call. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-043 — onArchive / onUnarchive in projects/page.tsx have no error handling

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · unhandled-error
- **File:** `apps/web/app/[locale]/projects/page.tsx:323-337`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-043` · audit-confidence: high · found_by: correctness

**Description:**
Both `onArchive` and `onUnarchive` are async functions that await API calls (`projectsService.archive`, `projectsService.unarchive`) without any try/catch. On failure, the unhandled rejection propagates silently — the user receives no error feedback, and no UI update occurs (no toast, no re-render). This contrasts with all other mutation handlers in the same file which use toast.error on catch.

**Root cause:**
Missing try/catch in async event handlers that perform network mutations.

**Code evidence:**
```
  const onArchive = async (id: string) => {
    if (
      !confirm(
        "Archiver ce projet ? Il n'apparaîtra plus dans le suivi général mais restera accessible.",
      )
    )
      return;
    await projectsService.archive(id);
    await fetchProjects();
  };

  const onUnarchive = async (id: string) => {
    await projectsService.unarchive(id);
    await fetchProjects();
  };
```

**Suggested fix:**
Wrap each in try/catch with toast.error:
ʼʼʼts
const onArchive = async (id: string) => {
  if (!confirm(...)) return;
  try {
    await projectsService.archive(id);
    toast.success('Projet archivé');
    await fetchProjects();
  } catch (err) {
    toast.error('Erreur lors de l\'archivage');
  }
};
ʼʼʼ

**Acceptance criteria:**
1. A simulated API error on archive displays a toast.error
2. A simulated API error on unarchive displays a toast.error
3. Commit message includes `[closes COR-043]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: code verified verbatim at lines 323-337. No surrounding try/catch in callers. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-044 — fetchProjects useCallback missing hasPermission dependency — stale permission closure

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · stale-closure
- **File:** `apps/web/app/[locale]/projects/page.tsx:85-130`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-044` · audit-confidence: high · found_by: correctness

**Description:**
The useCallback at line 85 closes over `hasPermission` (line 101) but the dependency array at line 130 only lists `[user, memberMeFilter, showArchived]`. If the user's permissions change (e.g. after a session refresh or role change), `fetchProjects` will not be re-created and will keep using the stale closure over the old `hasPermission` function. The project fetch scope (getAll vs getByUser) depends entirely on the result of `hasPermission('projects:read')`, so a stale closure here will silently return wrong data.

**Root cause:**
`hasPermission` is used inside a `useCallback` but omitted from its dependency array, causing the callback to close over a potentially stale reference to the permission-checking function.

**Code evidence:**
```
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      let projectsData: Project[] = [];

      // Si ?member=me dans l'URL, on force le scope "mes projets" quel que
      // soit le rôle (pour les CTA du Dashboard notamment).
      if (memberMeFilter && user?.id) {
        try {
          projectsData = await projectsService.getByUser(user.id);
        } catch (err) {
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            throw err;
          }
        }
      } else if (hasPermission("projects:read")) {
```

**Suggested fix:**
Add `hasPermission` to the `useCallback` dependency array: `}, [user, memberMeFilter, showArchived, hasPermission]);`. Since `hasPermission` comes from `usePermissions()`, verify that the hook returns a stable reference (memoized with `useCallback`); if not, stabilize it at the hook level first.

**Acceptance criteria:**
1. ESLint react-hooks/exhaustive-deps rule passes without disable comments on this callback
2. After a mock permission change, fetchProjects re-runs and returns the correct scope
3. Commit message includes `[closes COR-044]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
cd /home/alex/Documents/REPO/ORCHESTRA && npx eslint apps/web/app/\[locale\]/projects/page.tsx --rule '{"react-hooks/exhaustive-deps": "error"}' 2>&1 | grep fetchProjects
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: usePermissions already wraps hasPermission in useCallback([permissions]) — so hasPermission IS stable when permissions don't change. However, when permissions DO change (e.g. role swap), the new hasPermission reference is NOT in fetchProjects dep array, so the callback is never re-created. The stale closure is real. Same pattern in tasks/page.tsx — see frontend-F2-2.

**Closed_by:** (empty — TODO)

---

### COR-045 — ProjectsDetailTable: Link href and router.push use locale-less paths, breaking client-side navigation

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · locale/i18n routing bug
- **File:** `apps/web/app/[locale]/reports/components/ProjectsDetailTable.tsx:379-380, 428`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-045` · audit-confidence: high · found_by: correctness

**Description:**
The `ProjectsDetailTable` component navigates to `/projects/${row.id}` and `/tasks?projectId=${row.id}&overdue=true` without a locale prefix. The app uses Next.js + next-intl locale routing under `app/[locale]/`. All internal navigation links must be prefixed with `/${locale}/` (e.g., `/${locale}/projects/${row.id}`). next-intl middleware adds the locale prefix only on full page loads (SSR/navigation), not on client-side `router.push()` calls. The component does not import `useLocale`. By contrast, `reports/page.tsx` correctly uses `/${locale}/tasks?overdue=true` for the same pattern.

**Root cause:**
The component uses standard `next/link` and `useRouter` without importing `useLocale` from `next-intl`, omitting the locale segment required by the `[locale]` app router structure.

**Code evidence:**
```
                  <Link
                    href={`/projects/${row.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1.5"
                  >
...
                          router.push(`/tasks?projectId=${row.id}&overdue=true`)
```

**Suggested fix:**
1. Add `import { useLocale } from 'next-intl'` and `const locale = useLocale()` inside `ProjectsDetailTable`. 2. Change `href={\`/projects/${row.id}\`}` to `href={\`/${locale}/projects/${row.id}\`}`. 3. Change `router.push(\`/tasks?projectId=${row.id}&overdue=true\`)` to `router.push(\`/${locale}/tasks?projectId=${row.id}&overdue=true\`)`.

**Acceptance criteria:**
1. Clicking a project name link navigates to /{locale}/projects/{id}
2. Clicking 'en retard' button navigates to /{locale}/tasks?projectId={id}&overdue=true
3. No 404 errors on either navigation
4. Commit message includes `[closes COR-045]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'useLocale\|locale' apps/web/app/\[locale\]/reports/components/ProjectsDetailTable.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim. No useLocale import present in ProjectsDetailTable.tsx. Routes only exist under [locale]/ (confirmed by directory scan) — /projects/abc has no corresponding page at app root. next-intl middleware (middleware.ts) uses createIntlMiddleware and only redirects on full-page requests, not client-side Link/router.push. PortfolioGantt.tsx line 72-78 confirmed to correctly use useLocale() and /${locale}/projects/${row.id}.

**Closed_by:** (empty — TODO)

---

### COR-046 — fetchData useCallback in tasks/page.tsx missing hasPermission dependency — stale permission closure

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · stale-closure
- **File:** `apps/web/app/[locale]/tasks/page.tsx:54-144`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-046` · audit-confidence: high · found_by: correctness

**Description:**
`fetchData` uses `hasPermission` at lines 60, 62, 87, 104, and 117 to decide which API calls to make and which data sets to load, but `hasPermission` is absent from the `useCallback` dependency array `[user, assigneeMeFilter]` at line 144. This is the same stale-closure pattern as in projects/page.tsx (finding F2-1) but more severe here because `hasPermission` gates five different branches: projects:read, tasks:readAll, assignee-only, tasks:create (orphans), tasks:update+users:read.

**Root cause:**
`hasPermission` is referenced inside `useCallback` but omitted from its deps, capturing the value from initial render and never updating if permissions change.

**Code evidence:**
```
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch projects (requires projects:read)
      let projectsData: Project[] = [];
      if (hasPermission("projects:read")) {
        try {
          if (hasPermission("tasks:readAll")) {
            const response = await projectsService.getAll();
            projectsData = Array.isArray(response.data) ? response.data : [];
          } else if (user?.id) {
            projectsData = await projectsService.getByUser(user.id);
```

**Suggested fix:**
Add `hasPermission` to the dependency array: `}, [user, assigneeMeFilter, hasPermission]);`. Ensure `usePermissions` returns a stable `hasPermission` reference.

**Acceptance criteria:**
1. ESLint react-hooks/exhaustive-deps passes on this callback without disable comment
2. Permission change causes fetchData to re-run with the new permission set
3. Commit message includes `[closes COR-046]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
cd /home/alex/Documents/REPO/ORCHESTRA && npx eslint apps/web/app/\[locale\]/tasks/page.tsx --rule '{"react-hooks/exhaustive-deps": "error"}' 2>&1 | grep fetchData
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: usePermissions wraps hasPermission in useCallback([permissions]) — stable unless permissions array changes. When permissions DO change, fetchData dep array [user, assigneeMeFilter] does not include hasPermission, so the callback retains the stale closure. Confirmed real.

**Closed_by:** (empty — TODO)

---

### COR-047 — usersService.getAll() in telework/page.tsx has no .catch() — silent failure in user selector

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · unhandled_rejection
- **File:** `apps/web/app/[locale]/telework/page.tsx:395-404`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-047` · audit-confidence: high · found_by: correctness

**Description:**
The `usersService.getAll()` promise has a `.then()` handler but no `.catch()`. If the request fails (network error, 403, 500), the rejection is unhandled. In modern browsers and Next.js, unhandled promise rejections in effects can produce console errors that reach the user-visible error reporter (via `logger.error` if it were called, but it isn't here). More critically, `allUsers` is never populated, so the manager's user-selector dropdown will be empty with no error feedback. The user has no way to know the fetch failed.

**Root cause:**
Missing `.catch()` on a fire-and-forget async operation inside a useEffect.

**Code evidence:**
```
  useEffect(() => {
    if (!user) return;
    setSelectedUserId(user.id);

    if (canManageOthers && canListUsers) {
      usersService.getAll().then((data) => {
        setAllUsers(Array.isArray(data) ? data : []);
      });
    }
  }, [user, canManageOthers, canListUsers]);
```

**Suggested fix:**
Add a `.catch()` handler: `usersService.getAll().then(data => { setAllUsers(Array.isArray(data) ? data : []); }).catch(err => { logger.error('Error fetching users for telework:', err); toast.error(tc('errors.serverError')); });`

**Acceptance criteria:**
1. When usersService.getAll() rejects, a toast error is shown to the manager.
2. logger.error is called with the error context.
3. The selector renders empty with a recoverable state.
4. Commit message includes `[closes COR-047]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'usersService.getAll' apps/web/app/\[locale\]/telework/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code is verbatim confirmed at lines 395-404. No .catch() is present anywhere on this promise chain.

**Closed_by:** (empty — TODO)

---

### OBS-018 — No React error boundary or Next.js error.tsx in any of the 6 scanned route segments

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing_error_boundary
- **File:** `apps/web/app/[locale]/leaves/page.tsx:1`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-018` · audit-confidence: high · found_by: observability

**Description:**
None of the 6 route segments (leaves, telework, time-tracking, clients, third-parties, events) have a co-located `error.tsx` file (Next.js App Router error boundary convention) or a React `<ErrorBoundary>` wrapper in their page component. A runtime rendering error (e.g., null-dereference when API returns unexpected shape, invalid date passed to `new Date()`) in any of these pages will crash the entire route segment and show a white screen with a browser error. The absence of `error.tsx` is confirmed by filesystem search — no such file exists under `apps/web/app/[locale]/` for any of the target directories.

**Root cause:**
No error.tsx or React ErrorBoundary created for these route segments, leaving unhandled render errors as full-page crashes.

**Code evidence:**
```
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
```

**Suggested fix:**
Create `apps/web/app/[locale]/leaves/error.tsx` (and similarly for the other 5 directories) following the Next.js App Router pattern: `'use client'; export default function Error({ reset }) { return <div>... <button onClick={reset}>Réessayer</button></div>; }`. Additionally add a shared `<ErrorBoundary>` wrapper inside `MainLayout` as a catch-all.

**Acceptance criteria:**
1. Each of the 6 directories has an error.tsx file.
2. Navigating to the page after an injected rendering error shows a user-facing error message with a retry button.
3. The error is logged via logger.error.
4. Commit message includes `[closes OBS-018]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find apps/web/app/\[locale\]/{leaves,telework,time-tracking,clients,third-parties,events} -name 'error.tsx' 2>/dev/null | wc -l
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Filesystem check confirmed 0 error.tsx files in all 6 directories. This finding covers all 6 route segments under the shard.

**Closed_by:** (empty — TODO)

---

### PER-031 — handleExportExcel fires Promise.all over all active clients without concurrency cap (up to 200 requests)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded_parallel_requests
- **File:** `apps/web/app/[locale]/clients/page.tsx:147-155`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-031` · audit-confidence: high · found_by: performance

**Description:**
The Excel export function fires one HTTP request per active client simultaneously via `Promise.all`. The list `cap` is bounded by the page-fetch limit of 200 (`getAll({ limit: 200 })`). Sending 200 simultaneous GET requests will saturate the browser's connection pool (typically 6 concurrent per origin), create a thundering-herd on the API, and likely trigger rate-limiting or timeouts. While there is a `> 100` confirm dialog, it only adds friction — the unbounded parallelism is present for any non-zero number of clients.

**Root cause:**
No concurrency limiter (e.g., p-limit, sequential chunking) is applied to the per-client project-summary fetches.

**Code evidence:**
```
      const results = await Promise.all(
        cap.map((c) =>
          clientsService
            .getProjectsWithSummary(c.id)
            .then((res) => ({ clientId: c.id, clientName: c.name, res }))
            .catch(() => ({ clientId: c.id, clientName: c.name, res: null })),
        ),
      );
```

**Suggested fix:**
Use a concurrency-limited pattern: import p-limit (already may be in package.json) with limit of 5-10, or fetch in sequential chunks of e.g. 10 clients at a time using a `for...of` loop with `await`. Alternatively, add a backend endpoint that returns all client+project summaries in a single call.

**Acceptance criteria:**
1. handleExportExcel never fires more than 10 simultaneous requests.
2. Export completes correctly for 200+ active clients.
3. Failed per-client fetches show a specific toast indicating partial data.
4. Commit message includes `[closes PER-031]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'Promise.all' apps/web/app/\[locale\]/clients/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code confirmed verbatim at lines 147-155. The `> 100` confirm dialog at line 130 suggests the developer was aware of scale issues but chose UI friction over a proper fix.

**Closed_by:** (empty — TODO)

---

### PER-032 — milestonesService.getAll() fetches ALL milestones system-wide then filters client-side in two pages

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/web/app/[locale]/projects/[id]/page.tsx:182-185`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-032` · audit-confidence: high · found_by: performance

**Description:**
Both `apps/web/app/[locale]/projects/[id]/page.tsx` (line 182-185) and `apps/web/app/[locale]/tasks/[id]/page.tsx` (line 97-101) call `milestonesService.getAll()` to retrieve all milestones in the system, then filter the result in JavaScript to find only those belonging to the current project. The milestones service already exposes `getByProject(projectId)` which returns only the relevant milestones. This pattern wastes bandwidth and API compute proportionally to the number of projects in the system.

**Root cause:**
Developers used the generic `getAll()` endpoint instead of the scoped `getByProject(projectId)` endpoint that already exists in the milestones service.

**Code evidence:**
```
        try {
          const milestonesData = await milestonesService.getAll();
          const projectMilestones = milestonesData.data.filter(
            (m: Milestone) => m.projectId === projectId,
          );
          setMilestones(projectMilestones);
```

**Suggested fix:**
Replace `milestonesService.getAll()` with `milestonesService.getByProject(projectId)` in both files:
- `apps/web/app/[locale]/projects/[id]/page.tsx` lines 182-185: replace with `const projectMilestones = await milestonesService.getByProject(projectId);` and `setMilestones(projectMilestones);`
- `apps/web/app/[locale]/tasks/[id]/page.tsx` lines 97-101: same replacement using `taskData.projectId`

**Acceptance criteria:**
1. Network tab shows only one milestones request per page load scoped to the project
2. milestonesService.getByProject is called instead of getAll in both pages
3. No regression in milestone display in project detail and task detail pages
4. Commit message includes `[closes PER-032]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'milestonesService.getAll' apps/web/app/\[locale\]/projects/\[id\]/page.tsx apps/web/app/\[locale\]/tasks/\[id\]/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: milestonesService.getAll() confirmed verbatim at projects/[id]/page.tsx:182 and tasks/[id]/page.tsx:97. getByProject(projectId) confirmed at milestonesService line 17. Note: getAll() fetches with ?limit=1000 — truly unbounded for any real deployment. getByProject returns Milestone[] directly (already scoped). Confirmed.

**Closed_by:** (empty — TODO)

---

### PER-033 — AdvancedAnalyticsTab creates a module-scope QueryClient inside its own QueryClientProvider, bypassing the app-level cache

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · isolated TanStack Query cache / module-scope QueryClient anti-pattern
- **File:** `apps/web/app/[locale]/reports/components/advanced/AdvancedAnalyticsTab.tsx:8-29`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-033` · audit-confidence: high · found_by: performance

**Description:**
The app wraps everything in a `QueryProvider` (with a 30 s staleTime) in `app/[locale]/layout.tsx`. `AdvancedAnalyticsTab` adds a nested `QueryClientProvider` with a module-scope `QueryClient`. This creates an isolated cache disconnected from the parent. Consequences: (1) data fetched by `WorkloadChart`, `RecentActivity`, and `MilestonesCompletion` is never shared with other components that might query the same keys; (2) the module-scope singleton persists for the process lifetime (not per-user), which in Next.js edge/server rendering can lead to cross-request cache contamination; (3) the TanStack Query docs explicitly warn against creating the QueryClient at module scope in components, recommending `useState` or `useMemo` instead.

**Root cause:**
Module-scope `QueryClient` instantiation combined with a redundant `QueryClientProvider` that shadows the app-level provider.

**Code evidence:**
```
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function TabContent() {
  return (
    <div className="space-y-6">
      <RecentActivity />
      <WorkloadChart />
      <MilestonesCompletion />
    </div>
  );
}

export default function AdvancedAnalyticsTab() {
  return (
    <QueryClientProvider client={queryClient}>
      <TabContent />
    </QueryClientProvider>
  );
}
```

**Suggested fix:**
Remove the `QueryClientProvider` wrapper in `AdvancedAnalyticsTab` entirely. The child components (`WorkloadChart`, `RecentActivity`, `MilestonesCompletion`) should use the parent `QueryProvider` already present in the layout. If isolation is intentional, move `queryClient` inside a `useState(() => new QueryClient(...))` call.

**Acceptance criteria:**
1. AdvancedAnalyticsTab does not instantiate its own QueryClient or QueryClientProvider
2. WorkloadChart, RecentActivity, MilestonesCompletion queries are visible in the app-level React Query devtools cache
3. Commit message includes `[closes PER-033]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'QueryClientProvider\|QueryClient' apps/web/app/\[locale\]/reports/components/advanced/AdvancedAnalyticsTab.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim byte-for-byte (lines 8-30). The component is loaded via dynamic() with ssr:false in reports/page.tsx, which mitigates the cross-request SSR concern, but the isolated cache and full refetch-per-tab-switch issues remain. The parent QueryProvider in layout.tsx confirmed at line 26 with NextIntlClientProvider wrapper.

**Closed_by:** (empty — TODO)

---

### PER-034 — tasksService.getAll(1, 1000) hard-coded limit of 1000 tasks loaded in single request

- **Status:** TODO
- **Phase:** 2
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/web/app/[locale]/tasks/page.tsx:88`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-034` · audit-confidence: high · found_by: performance

**Description:**
When the user has `tasks:readAll` permission, the tasks page requests up to 1000 tasks in a single API call. This bypasses any server-side pagination. In an organisation with many tasks this will: (1) cause long API response times, (2) transmit a large payload over the network, (3) force React to render a potentially very large list client-side. All 1000 tasks are then filtered client-side by project/priority/overdue flags with no virtual rendering.

**Root cause:**
A hard-coded limit of 1000 was used as a workaround for pagination complexity, treating the API as if it were a bulk data source.

**Code evidence:**
```
          } else if (hasPermission("tasks:readAll")) {
            const response = await tasksService.getAll(1, 1000);
            tasksData = Array.isArray(response.data) ? response.data : [];
```

**Suggested fix:**
Implement server-side filtering by passing current filter params (project, priority, status, overdue) to the API, or implement virtual scrolling / progressive loading. At minimum, add a pagination UI or reduce the limit to 200 with a 'load more' affordance.

**Acceptance criteria:**
1. The tasks page does not request more than 200 tasks per initial load for readAll users
2. Filters are passed as API query params rather than filtered client-side
3. Commit message includes `[closes PER-034]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'getAll(1, 1000)' apps/web/app/\[locale\]/tasks/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: confirmed verbatim at tasks/page.tsx:88. No server-side filtering in the call. Confirmed.

**Closed_by:** (empty — TODO)

---

### TST-002 — 13 controllers have no sibling *.spec.ts file

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · missing-controller-spec
- **File:** `apps/api/src/:N/A`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-002` · audit-confidence: high · found_by: tests

**Description:**
13 controller files have no co-located *.spec.ts file. Of these, metrics.controller.ts is partially covered in metrics.spec.ts (MetricsController describe block). The remaining 12 are untested at the controller layer. Notable gaps: leave-types.controller.ts (exposes CRUD + reorder endpoint), personal-todos.controller.ts (AllowSelfService decorator, ownership logic), rbac/roles.controller.ts (RBAC mutation endpoints), analytics/advanced/analytics-advanced.controller.ts (6 GET endpoints with RequirePermissions), planning.controller.ts, settings.controller.ts, school-vacations.controller.ts, holidays.controller.ts, projects-clients.controller.ts, projects-third-party-members.controller.ts, tasks-third-party-assignees.controller.ts, app.controller.ts. None have any controller-level spec coverage for routing, permission decorators, or request mapping correctness.

**Root cause:**
Controller spec files were never created for these modules, leaving routing decorators, permission annotations, and request-mapping logic untested.

**Code evidence:**
```
# Controllers with no sibling spec:
# apps/api/src/analytics/advanced/analytics-advanced.controller.ts
# apps/api/src/app.controller.ts
# apps/api/src/clients/projects-clients.controller.ts
# apps/api/src/holidays/holidays.controller.ts
# apps/api/src/leave-types/leave-types.controller.ts
# apps/api/src/metrics/metrics.controller.ts  (tested in metrics.spec.ts)
# apps/api/src/personal-todos/personal-todos.controller.ts
# apps/api/src/planning/planning.controller.ts
# apps/api/src/rbac/roles.controller.ts
# apps/api/src/school-vacations/school-vacations.controller.ts
# apps/api/src/settings/settings.controller.ts
# apps/api/src/third-parties/projects-third-party-members.controller.ts
# apps/api/src/third-parties/tasks-third-party-assignees.controller.ts
```

**Suggested fix:**
Add *.controller.spec.ts for each of the 12 untested controllers, at minimum covering: (1) happy-path delegation to service, (2) NotFoundException/ForbiddenException propagation, (3) permission decorator metadata assertions (e.g. `getMetadata('permissions', controller.create)`). Prioritize roles.controller.ts, leave-types.controller.ts, personal-todos.controller.ts.

**Acceptance criteria:**
1. Each of the 12 controllers has a sibling *.spec.ts that tests at least one happy path and one error path
2. roles.controller.ts spec covers 403 on system-role mutation attempts
3. personal-todos.controller.ts spec covers ForbiddenException when userId mismatch
4. Commit message includes `[closes TST-002]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find apps/api/src -name '*.controller.ts' | sort | while read f; do base=$(echo $f | sed 's/.ts$/.spec.ts/'); [ -f "$base" ] || echo "MISSING: $f"; done
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: metrics.controller.ts is tested in apps/api/src/metrics/metrics.spec.ts but not as a co-located sibling spec; coverage is present but unconventional. Adversarial check: `find` command executed — all 13 missing controller specs confirmed byte-for-byte; no hidden spec file found for any of the listed controllers.

**Closed_by:** (empty — TODO)

---

### TST-003 — analytics.controller.spec.ts has only happy-path tests — no error/auth failure coverage

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · happy-path-only-spec
- **File:** `apps/api/src/analytics/analytics.controller.spec.ts:8-88`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-003` · audit-confidence: high · found_by: tests

**Description:**
The AnalyticsController spec (88 lines total) contains exactly 3 test cases: `should be defined`, `should call service with correct parameters` (getAnalytics), and `should call service export method` (exportAnalytics). There are zero error-path tests. No test verifies that: (1) service throwing NotFoundException propagates correctly, (2) service throwing ForbiddenException propagates correctly, (3) wrong dateRange enum value causes 400. The spec also does not test permission metadata (RequirePermissions decorator).

**Root cause:**
The spec was written as a minimal delegation test without adding negative-path or error-propagation tests.

**Code evidence:**
```
describe('AnalyticsController', () => {
  describe('getAnalytics', () => {
    it('should call service with correct parameters', async () => {
      // ... happy path only
    });
  });

  describe('exportAnalytics', () => {
    it('should call service export method', async () => {
      // ... happy path only
    });
  });
});
```

**Suggested fix:**
Add tests for: `service.getAnalytics` throwing NotFoundException (verify propagation), `service.exportAnalytics` throwing ForbiddenException (verify propagation), and permission metadata assertion for both endpoints.

**Acceptance criteria:**
1. At least one test verifies that an exception from the service propagates as-is through the controller
2. Permission metadata for RequirePermissions decorator is asserted on both endpoints
3. Commit message includes `[closes TST-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'rejects\|throw\|Forbidden\|NotFound\|403\|404\|400' apps/api/src/analytics/analytics.controller.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: analytics.service.spec.ts has extensive coverage; the gap is specifically at the controller layer. Adversarial check: grep for rejects|throw|Forbidden|NotFound|403|404|400 returns 0 matches. File read confirms exactly 3 tests (lines 8-88), all happy-path only.

**Closed_by:** (empty — TODO)

---

### TST-004 — events.controller.spec.ts, clients.controller.spec.ts, and third-parties.controller.spec.ts have zero error-path tests

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · happy-path-only-spec
- **File:** `apps/api/src/events/events.controller.spec.ts:11-287`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-004` · audit-confidence: high · found_by: tests

**Description:**
Three controller specs — events.controller.spec.ts (11 tests, 287 lines), clients.controller.spec.ts (7 tests), and third-parties.controller.spec.ts (6 tests) — contain exclusively happy-path delegation tests. None assert what happens when the service throws NotFoundException, ForbiddenException, or BadRequestException. For events this is significant: events.service.spec.ts does test COR-038 (parent cycle → ConflictException) and various error paths, but the controller-layer propagation is untested. clients.controller.spec.ts has no test for the NotFoundException when a client is not found, no test for ConflictException on duplicate name.

**Root cause:**
These controller specs follow a minimal delegation pattern that tests wiring only, without negative scenarios.

**Code evidence:**
```
describe('EventsController', () => {
  // 11 test cases, all happy path:
  it('should be defined', ...)
  it('should create an event', ...)
  it('should return all events', ...)
  it('should return events with filters', ...)
  it('should return an event by id', ...)
  it('should update an event', ...)
  it('should delete an event', ...)
  it('should return events for a user', ...)
  it('should return events in date range', ...)
  it('should add a participant to an event', ...)
  it('should remove a participant from an event', ...)
  // ZERO throws/rejects/404/403/400 assertions
});
```

**Suggested fix:**
For each of the three controllers, add at minimum one test per mutating endpoint where the service throws a typed NestJS exception, verifying the exception propagates with the correct type.

**Acceptance criteria:**
1. events.controller.spec.ts has at least one test where service.create rejects with ConflictException and controller propagates it
2. clients.controller.spec.ts has at least one NotFoundException propagation test
3. third-parties.controller.spec.ts has at least one error-path test
4. Commit message includes `[closes TST-004]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'rejects\|throw\|Forbidden\|NotFound\|403\|404\|400\|409\|Conflict' apps/api/src/events/events.controller.spec.ts apps/api/src/clients/clients.controller.spec.ts apps/api/src/third-parties/third-parties.controller.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: test counts confirmed — events: 11, clients: 7, third-parties: 6. Grep for rejects|throw|Forbidden|NotFound|409|Conflict|403|404|400 across all three files returns 0 matches. Finding description is accurate.

**Closed_by:** (empty — TODO)

---

### TST-005 — LeaveTypesService.reorder() method has zero test coverage — $transaction branch untested

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · untested-service-method
- **File:** `apps/api/src/leave-types/leave-types.service.spec.ts:1-234`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-005` · audit-confidence: high · found_by: tests

**Description:**
The `reorder()` method in LeaveTypesService (lines 192-203) calls `this.prisma.$transaction(updates)` with an array of update promises. This is the only use of `$transaction` in the leave-types module. The leave-types.service.spec.ts (234 lines) has describe blocks for create, findAll, findOne, update, and remove — but no describe block or test for `reorder`. The $transaction mock is declared as `vi.fn()` with no implementation, meaning if reorder() were called it would resolve to undefined. No test exercises the reorder logic, the $transaction call, or any error path (e.g. invalid UUID in orderedIds).

**Root cause:**
The reorder method was added to the service but the corresponding spec tests were never written.

**Code evidence:**
```
// leave-types.service.ts lines 192-203:
async reorder(orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    this.prisma.leaveTypeConfig.update({
      where: { id },
      data: { sortOrder: index },
    }),
  );

  await this.prisma.$transaction(updates);

  return this.findAll();
}
```

**Suggested fix:**
Add a `describe('reorder')` block in leave-types.service.spec.ts covering: (1) happy path — verifies $transaction is called with array of N updates, (2) each update has correct sortOrder index, (3) calls findAll after transaction. Also add leave-types.controller.spec.ts with a reorder test.

**Acceptance criteria:**
1. leave-types.service.spec.ts has a describe('reorder') block with at least a happy-path test
2. The test asserts $transaction is called with an array of length N
3. The test asserts each update sets sortOrder equal to the array index
4. Commit message includes `[closes TST-005]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'reorder\|Reorder' apps/api/src/leave-types/leave-types.service.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: grep for 'reorder|Reorder' in leave-types.service.spec.ts returns 0 matches. The service.ts reorder() method at lines 192-203 is verbatim present. The spec file has describe blocks for create, findAll, findOne, update, remove only — no reorder coverage. The $transaction vi.fn() mock at line 23 has no implementation (resolves to undefined if called). The controller also lacks a spec (finding tests-T1-1).

**Closed_by:** (empty — TODO)

---

### TST-006 — planning-export.controller.spec.ts has only happy-path tests — no error propagation tests

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · happy-path-only-spec
- **File:** `apps/api/src/planning-export/planning-export.controller.spec.ts:12-39`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-006` · audit-confidence: high · found_by: tests

**Description:**
The PlanningExportController spec has 3 tests (39 lines): `should be defined`, `previewImport calls service`, and `importIcs calls service with userId`. There are zero error-path tests. No test verifies: (1) that a malformed ICS body causes a BadRequestException, (2) that an unauthorized userId triggers ForbiddenException, (3) the exportIcs endpoint exists in the spec (it appears in the mock but has no test). The exportIcs mock is set up but the controller method is never called in any test.

**Root cause:**
The spec was written as a minimal delegation stub with no negative-path or missing-method coverage.

**Code evidence:**
```
describe('PlanningExportController', () => {
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('previewImport calls service', async () => {
    const result = await controller.previewImport({ icsContent: '' });
    expect(mockService.previewImport).toHaveBeenCalledWith('');
    expect(result).toEqual([]);
  });

  it('importIcs calls service with userId', async () => {
    const result = await controller.importIcs({ icsContent: '' }, 'user-1');
    expect(mockService.importIcs).toHaveBeenCalledWith('', 'user-1');
    expect(result).toEqual({ imported: 0, skipped: 0 });
  });
});
```

**Suggested fix:**
Add tests for: `previewImport` with service throwing BadRequestException, `importIcs` with service throwing NotFoundException, and at least one test for the `exportIcs` controller method.

**Acceptance criteria:**
1. The spec has at least one test per controller method including exportIcs
2. At least one test verifies exception propagation from the service
3. Commit message includes `[closes TST-006]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'rejects\|throw\|Forbidden\|NotFound\|403\|404\|400\|exportIcs' apps/api/src/planning-export/planning-export.controller.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: mockService.exportIcs is defined on line 7 but the only grep match for 'exportIcs' is that mock definition — never called in any test. Adversarial check: file read confirms exactly 3 tests, all happy-path; grep for error-path terms returns 0 error-assertion matches (the 1 match is the mock definition line, not a test assertion).

**Closed_by:** (empty — TODO)

---

### TST-007 — Root-level e2e specs use UI login helper with hardcoded admin/admin123 credentials

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · ui-login
- **File:** `e2e/helpers.ts:1-13`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-007` · audit-confidence: high · found_by: tests

**Description:**
Five root-level spec files (full-workflow.spec.ts, projects.spec.ts, tasks.spec.ts, planning.spec.ts, leaves.spec.ts) all import and call this UI `login()` helper from e2e/helpers.ts, which drives the browser login form with hardcoded admin/admin123 credentials. This violates the CLAUDE.md convention ('Auth via API (never UI login in tests)') and the established auth.setup.ts pattern. The `chromium` project in playwright.config.ts runs these specs without a `dependencies: ['setup']` link and without a `storageState`, so these tests hit the rate-limited login endpoint and are fragile against any UI login-form change.

**Root cause:**
Root-level e2e specs were written before the auth.setup.ts/storage-state pattern was established and were never migrated.

**Code evidence:**
```
export async function login(
  page: Page,
  username = "admin",
  password = "admin123",
) {
  await page.goto("/login");
  await page.locator('input[id="login"]').fill(username);
  await page.locator('input[id="password"]').fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}
```

**Suggested fix:**
Migrate the 5 root-level specs to use the storage-state pattern: add `dependencies: ['setup']` to the `chromium` project in playwright.config.ts, or move the specs under e2e/tests/ and add `storageState: 'playwright/.auth/admin.json'` to their project. Replace `await login(page)` calls with the existing page.goto() pattern used by e2e/tests/workflows specs.

**Acceptance criteria:**
1. No e2e spec outside e2e/tests/workflows/auth.spec.ts uses the UI login form or calls helpers.login()
2. Root-level specs run without triggering a browser-based login flow
3. Commit message includes `[closes TST-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'import.*helpers\|await login(' e2e/*.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Affected files: e2e/full-workflow.spec.ts, e2e/projects.spec.ts, e2e/tasks.spec.ts, e2e/planning.spec.ts, e2e/leaves.spec.ts. The helpers.ts password 'admin123' differs from the seed ROLE_PASSWORD ('Test1234!') for the test users, making these tests target only the bootstrap admin account. VERIFIED: code_evidence verbatim confirmed in e2e/helpers.ts lines 1-13. chromium project in playwright.config.ts confirmed without dependencies or storageState. All 5 files confirmed to call login() via grep.

**Closed_by:** (empty — TODO)

---

### TST-008 — api-permissions.spec.ts — the core RBAC matrix test has zero @smoke tags despite covering all permission codes

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · smoke-coverage-gap
- **File:** `e2e/tests/rbac/api-permissions.spec.ts:89-143`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-008` · audit-confidence: high · found_by: tests

**Description:**
The api-permissions.spec.ts generates tests for every entry in PERMISSION_MATRIX (covering all 90+ permission codes, both allowed and denied paths). None of these generated tests carry the `@smoke` tag. The CLAUDE.md convention requires 'Tag critical tests with @smoke' and 'critical paths' are expected to have smoke tags. These are arguably the most critical permission tests in the suite; their absence from @smoke means running `pnpm exec playwright test --grep @smoke` (a fast pre-deploy smoke check) will skip the entire RBAC matrix verification.

**Root cause:**
The test generation loop in api-permissions.spec.ts was not updated to annotate generated tests with { tag: '@smoke' } for high-severity entries (e.g. privilege escalation: admin-only endpoints tested for all denied roles).

**Code evidence:**
```
for (const resource of resources) {
  const entries = PERMISSION_MATRIX.filter((e) => e.resource === resource);

  test.describe(`RBAC — ${resource}`, () => {
    for (const entry of entries) {
      // Tests pour les rôles AUTORISÉS
      for (const role of entry.allowedRoles as Role[]) {
        test(`[AUTORISÉ] ${entry.method} ${entry.apiEndpoint} — rôle: ${role} — ${entry.action}`, async ({
```

**Suggested fix:**
Add `{ tag: '@smoke' }` to the test options for denied-role tests (403 assertions), which are the security-critical cases. For large suites, at minimum tag the tests for endpoints with high-privilege actions (projects:delete, users:create, users:manage_roles). Example: `test('[INTERDIT] ...', { tag: '@smoke' }, async ({ request }) => { ... })`.

**Acceptance criteria:**
1. pnpm exec playwright test --grep @smoke includes at least the denied-role assertions from api-permissions.spec.ts for admin-only endpoints
2. At least the users:manage_roles and projects:delete INTERDIT tests carry @smoke
3. Commit message includes `[closes TST-008]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c '@smoke' e2e/tests/rbac/api-permissions.spec.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Other spec files (granular-checks.spec.ts, rbac-escalation.spec.ts, clients.spec.ts) do tag critical tests with @smoke. The gap is specific to the matrix-driven loop. VERIFIED: code_evidence verbatim confirmed in api-permissions.spec.ts lines 89-143. `grep -c '@smoke' e2e/tests/rbac/api-permissions.spec.ts` returns 0, confirming zero smoke tags.

**Closed_by:** (empty — TODO)

---

### DAT-010 — RBAC V4 drops role_permissions, permissions, role_configs tables and users.role column with no backup or preflight verification

- **Status:** TODO
- **Phase:** 2
- **Cluster:** P
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · destructive_drop_no_preflight
- **File:** `packages/database/prisma/migrations/20260420120000_rbac_v4_drop_legacy/migration.sql:1-19`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-010` · audit-confidence: medium · found_by: data_integrity

**Description:**
This migration irreversibly drops three tables (role_permissions, permissions, role_configs) and the users.role enum column, with only a comment advising to 'ensure a backup before prod deployment'. There is no preflight DO $$ ... RAISE EXCEPTION $$ block verifying that the V0 backfill was 100% complete (every user has a non-null roleId) before the legacy data is destroyed. Unlike the preceding V0 migration which has explicit post-backfill verification, V4 has none. If run on a database where V0's backfill had silently failed (e.g., a user with an unmapped legacy role left roleId NULL), the DROP destroys the only evidence of what roles existed.

**Root cause:**
The migration relies on a comment warning ('ensure backup') and the upstream V0 verification, but adds no self-contained guard to confirm the RBAC migration state before executing destructive DDL.

**Code evidence:**
```
-- ACTION IRRÉVERSIBLE — Assurer un backup avant déploiement prod.

-- 1. Drop FK contrainte role_permissions
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleConfigId_fkey";

-- 2. Drop tables legacy
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "role_configs";

-- 3. Drop colonne users.role
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

-- 4. Drop enum type
DROP TYPE IF EXISTS "Role";
```

**Suggested fix:**
Add a preflight DO block before the DROPs: DO $$ DECLARE null_count INTEGER; BEGIN SELECT COUNT(*) INTO null_count FROM users WHERE "roleId" IS NULL; IF null_count > 0 THEN RAISE EXCEPTION 'RBAC V4 preflight: % users still have NULL roleId — abort DROP', null_count; END IF; END $$;

**Acceptance criteria:**
1. If any user has roleId IS NULL, the V4 migration fails with an informative exception
2. The migration succeeds only when all users have a valid roleId from V0 backfill
3. Commit message includes `[closes DAT-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT COUNT(*) FROM users WHERE "roleId" IS NULL;
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence VERBATIM confirmed at lines 1-19 (the entire file). V0 migration (20260419192835) does have correct post-backfill verification (lines 100-107: RAISE EXCEPTION if any user has NULL roleId). In normal sequential Prisma deployment V0 must succeed before V4 runs. Risk is limited to partial DB restore or manual migration replay scenarios. Downgraded from high to medium confidence because the normal deployment path is protected by V0's guard.

**Closed_by:** (empty — TODO)

---

### COR-004 — MilestonesCompletionResponseDto.total means 'due milestones' not 'all milestones'

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · misleading_semantics
- **File:** `apps/api/src/analytics/advanced/services/milestones-completion.service.ts:75-77`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-004` · audit-confidence: high · found_by: correctness

**Description:**
`total` is computed as `completed + overdue`, deliberately excluding `upcoming` milestones. Yet the returned DTO also exposes `upcoming` as a peer field alongside `total`. Any consumer that interprets `total` as 'total milestones in scope' (the natural reading of the field name) will derive a wrong ratio manually (e.g. `completed / total` is not the same as `completed / (completed + overdue + upcoming)`). The `ratio` itself is correct given its definition, but the `total` field is misleading and can cause bugs in UI layers or downstream integrations that compute secondary metrics from the raw fields.

**Root cause:**
The variable named `total` is assigned `completed + overdue` rather than the actual total count of all milestones; the naming is ambiguous and conflicts with the natural meaning of 'total'.

**Code evidence:**
```
    const total = completed + overdue;
    const onTime = completed;
    const ratio = total > 0 ? onTime / total : 0;
```

**Suggested fix:**
Rename the field to `due` (or `dueTotal`) in the DTO and return object to reflect its actual semantics. Keep `total` as `completed + overdue + upcoming` if a true total is needed. Update `ratio` documentation to clarify it is `completed / (completed + overdue)`.

**Acceptance criteria:**
1. DTO field name unambiguously conveys 'milestones that have passed their due date or are completed'
2. Consumers cannot derive a wrong ratio by using the wrong denominator
3. Commit message includes `[closes COR-004]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 75-77. The return object at lines 115-124 exposes: onTime, total (=completed+overdue), ratio, completed, overdue, upcoming — so a consumer using total as 'all milestones' gets the wrong denominator.

**Closed_by:** (empty — TODO)

---

### COR-005 — taskStatusData and metrics diverge when scope exceeds PROJECT_DETAILS_LIMIT (50)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · data_inconsistency
- **File:** `apps/api/src/analytics/analytics.service.ts:103-127`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-005` · audit-confidence: high · found_by: correctness

**Description:**
`getProjects` applies `take: PROJECT_DETAILS_LIMIT` (50), truncating the project list. `getTasks` is scoped by `projectWhere` (no limit), so it can return tasks from all projects in scope (e.g. 200). `taskStatusGroupBy` is then built from only the 50 returned project IDs. As a result, `calculateMetrics` (consuming the full `tasks` array) counts all tasks across all projects, while `getTaskStatusData` (consuming `taskStatusGroupBy`) only covers the 50-project subset. The two panels on the analytics dashboard will show contradictory numbers: the overall 'Taux de Completion' metric counts tasks from projects 51-N, but the per-status breakdown chart silently omits them.

**Root cause:**
`getProjects` hard-caps at 50 rows but `getTasks` has no corresponding cap; the shared `taskStatusGroupBy` is then scoped to only the 50 returned project IDs instead of using the same unrestricted scope.

**Code evidence:**
```
    const [projects, tasks, users] = await Promise.all([
      this.getProjects(projectId, projectWhere),
      this.getTasks(projectId, projectWhere),
      this.getActiveUsers(projectWhere),
    ]);

    const projectIds = projects.map((p) => p.id);
    const taskStatusGroupBy = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    const metrics = this.calculateMetrics(projects, tasks, users);
    const taskStatusData = this.getTaskStatusData(taskStatusGroupBy);
```

**Suggested fix:**
Either (a) apply no `take` limit in `getProjects` for analytics (use a paginated or export path for the details table separately), or (b) derive `taskStatusGroupBy` from the same `projectWhere` clause as `getTasks` rather than from the post-truncated `projectIds`. If the 50-project cap must be kept for payload size, apply it consistently to `tasks` as well and document the sampling clearly.

**Acceptance criteria:**
1. When a user has 60 projects in scope, sum(taskStatusData[].value) equals metrics[1].change numerator (completedTasks count)
2. Integration test: seed 60 projects, call GET /analytics, verify taskStatusData sums == metrics totalTasks
3. Commit message includes `[closes COR-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim verified: getProjects uses `take: PROJECT_DETAILS_LIMIT` at line 154; getTasks has no take at line 235; taskStatusGroupBy scoped to projectIds (truncated list) at lines 113-118; calculateMetrics uses unbounded tasks array. The PER-025 comment at line 109 incorrectly states the groupBy is 'equivalent to the getTasks relation filter'. It is equivalent only when projects.length < PROJECT_DETAILS_LIMIT.

**Closed_by:** (empty — TODO)

---

### COR-024 — update() does not validate partial date changes against existing project dates

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/projects/projects.service.ts:583-588`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-024` · audit-confidence: high · found_by: correctness

**Description:**
The date invariant (endDate >= startDate) is only enforced when both `startDate` and `endDate` are simultaneously provided in the PATCH request. The existing project's dates (in `existingProject`) are loaded at line 558-560 but are never used in the validation. A PATCH with only `endDate: '2020-01-01'` on a project with `startDate: '2025-01-01'` passes validation and stores an end date before the start date, violating the core scheduling invariant. Similarly, a PATCH with only `startDate: '2030-01-01'` on a project with `endDate: '2025-01-01'` also bypasses validation.

**Root cause:**
The date comparison condition requires both `startDate && endDate` to be truthy, but partial updates only supply one; the check is never evaluated against the existing persisted value.

**Code evidence:**
```
    // Vérifier les dates si fournies
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }
```

**Suggested fix:**
Compute the effective start and end: `const effectiveStart = startDate ? new Date(startDate) : existingProject.startDate; const effectiveEnd = endDate ? new Date(endDate) : existingProject.endDate;` Then validate `if (effectiveEnd && effectiveStart && effectiveEnd < effectiveStart) throw BadRequestException(...)`.

**Acceptance criteria:**
1. PATCH /projects/:id with only endDate='2020-01-01' on a project with startDate='2025-01-01' returns 400
2. PATCH /projects/:id with only startDate='2030-01-01' on a project with endDate='2025-01-01' returns 400
3. PATCH /projects/:id with both valid dates in correct order returns 200
4. Commit message includes `[closes COR-024]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'startDate && endDate' apps/api/src/projects/projects.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-027 — skills.service.ts create() and update() missing P2002 catch — concurrent duplicate name causes unhandled 500

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing-p2002-catch
- **File:** `apps/api/src/skills/skills.service.ts:28-57`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-027` · audit-confidence: high · found_by: correctness

**Description:**
The `create()` method performs a pre-check `findFirst` then calls `prisma.skill.create()` without wrapping the create in a try/catch for Prisma P2002 (unique constraint violation). `Skill.name` has a `@unique` constraint in schema.prisma. Under concurrent requests (two users submitting the same skill name simultaneously), both pass the findFirst check, then the second `prisma.skill.create()` throws a `PrismaClientKnownRequestError` with code P2002 that is unhandled. This propagates as a 500 Internal Server Error. The same issue exists in `update()` at line 165 which also has no try/catch around `prisma.skill.update()`.

By contrast, `departments.service.ts` and `services.service.ts` explicitly define an `isUniqueViolation()` helper and wrap their create/update calls in try/catch blocks to map P2002 → 409 ConflictException. `skills.service.ts` lacks this defense.

**Root cause:**
`skills.service.ts` never adopted the P2002 catch pattern that `departments.service.ts` and `services.service.ts` introduced (COR-034), leaving the unique-constraint race unhandled.

**Code evidence:**
```
  async create(createSkillDto: CreateSkillDto) {
    const { name, description, category, requiredCount } = createSkillDto;

    // Vérifier l'unicité du nom
    const existing = await this.prisma.skill.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Une compétence avec ce nom existe déjà');
    }

    const skill = await this.prisma.skill.create({
```

**Suggested fix:**
Add `isUniqueViolation` helper and wrap both `create()` and `update()` calls in try/catch blocks, mirroring the pattern in `departments.service.ts`:
ʼʼʼtypescript
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
// In create():
try {
  const skill = await this.prisma.skill.create({ ... });
  return skill;
} catch (err) {
  if (isUniqueViolation(err)) throw new ConflictException('Une compétence avec ce nom existe déjà');
  throw err;
}
ʼʼʼ

**Acceptance criteria:**
1. Two concurrent POST /skills with the same name both return HTTP 409 (not 500)
2. PATCH /skills/:id renaming to an existing name returns HTTP 409 under concurrency
3. Commit message includes `[closes COR-027]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'isUniqueViolation\|P2002\|catch' apps/api/src/skills/skills.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: departments.service.ts lines 12-19 and 69-74 show the correct pattern. importSkills() at line 725 already has a try/catch per item. Only the standalone create()/update() methods are missing it. Adversarial check: grep confirmed zero P2002/catch/isUniqueViolation in skills.service.ts outside line 725 (importSkills). schema.prisma line 743 confirms @unique on Skill.name.

**Closed_by:** (empty — TODO)

---

### COR-028 — importTasks: missing date validity check — invalid startDate/endDate strings silently stored as Invalid Date

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/tasks/tasks.service.ts:1461-1462`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-028` · audit-confidence: high · found_by: correctness

**Description:**
In importTasks() (the actual write path, distinct from validateImport()), dates are passed directly to `new Date()` without validating the result with isNaN(). If taskData.startDate is a non-ISO string that the Date constructor cannot parse, `new Date(taskData.startDate)` returns an Invalid Date object, which Prisma will attempt to pass to PostgreSQL. The corresponding validateImport() path validates dates (lines 1653-1673), but only when BOTH startDate and endDate are present (condition: `if (taskData.startDate && taskData.endDate)`). The actual write path has no validation at all. DTO field startDate/endDate use @IsString() not @IsDateString().

**Root cause:**
Date validation is only performed in the dry-run path (validateImport), not in the real write path (importTasks). Additionally validateImport only validates when both dates are present.

**Code evidence:**
```
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            endDate: taskData.endDate ? new Date(taskData.endDate) : null,
```

**Suggested fix:**
Add `isNaN(new Date(taskData.startDate).getTime())` guards in importTasks() before constructing Date objects, consistent with the pattern in validateImport() lines 1655-1669.

**Acceptance criteria:**
1. POST /project/:projectId/import with an invalid startDate returns an error for that row, not a task with null/invalid date
2. Commit message includes `[closes COR-028]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'new Date(taskData\.' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The ImportTaskDto uses @IsString() not @IsDateString() for startDate/endDate (verified). Impact is slightly softened: Prisma will throw on Invalid Date, caught by per-row catch, so no silent data corruption — but error message is cryptic.

**Closed_by:** (empty — TODO)

---

### COR-030 — update(): date clearing is impossible — falsy check prevents clearing startDate/endDate to null

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/tasks/tasks.service.ts:795-796`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-030` · audit-confidence: high · found_by: correctness

**Description:**
In update(), dates are set only when the value is truthy. However, the UpdateTaskDto fields are optional strings — if a client sends `startDate: null` or an explicit empty string to clear a date, the falsy check skips the field entirely and the existing date is retained. There is no way to clear a date via PATCH. This is a business-logic correctness gap: date clearing is a valid user action (removing a deadline). The same pattern exists for create() lines 233-234 but create context is less critical since you can just omit the field.

**Root cause:**
Using a falsy guard (`...(startDate && {...})`) instead of an explicit `!== undefined` check; null/empty-string inputs are silently ignored.

**Code evidence:**
```
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
```

**Suggested fix:**
Change to `...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null })` so explicit null/empty string clears the field.

**Acceptance criteria:**
1. PATCH /tasks/:id with {endDate: null} results in task.endDate being null
2. PATCH /tasks/:id without endDate key leaves endDate unchanged
3. Commit message includes `[closes COR-030]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'startDate && {\|endDate && {' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: projectId clearing uses `...(projectId && {projectId})` with the same issue (line 789) but that case is handled by detachFromProject endpoint.

**Closed_by:** (empty — TODO)

---

### SA-OBS-003 — ACCESS_DENIED action is defined and schema'd but never emitted by any guard or filter

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · audit-trail-gap
- **File:** `apps/api/src/rbac/permissions.guard.ts:104-117`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-003` · audit-confidence: high · found_by: observability

**Description:**
AuditAction.ACCESS_DENIED is declared in audit-action.enum.ts:27, has an entity-type mapping in audit.service.ts:56, and a payload schema (payload-schemas.ts:160). However grep across all non-spec source shows zero AuditAction.ACCESS_DENIED call sites. The PermissionsGuardV2 logs a structured warn() to stdout but emits no persistent audit row. AllExceptionsFilter (line 21-25) explicitly defers this. The stdout log line has no userId, no targetedResource, no IP.

**Root cause:**
AllExceptionsFilter and PermissionsGuardV2 both have documented deferrals for ACCESS_DENIED audit emission; neither was followed up with an implementation.

**Code evidence:**
```
    if (!hasAll && !hasAny) {
      const routeId = `${klass?.name ?? '?'}.${...handler...?.name ?? '?'}`;
      if (this.mode === 'enforce') {
        this.logger.warn(
          `[RBAC enforce] route refusée (sans @RequirePermissions ni @AllowSelfService) : ${routeId}`,
        );
        return false;
      }
```

**Suggested fix:**
In PermissionsGuardV2.canActivate(), when returning false on a permission failure, fire-and-forget emit AuditAction.ACCESS_DENIED with the userId from request.user, the route, and the missing permission. The guard already has the ExecutionContext and can read request.id for correlation.

**Acceptance criteria:**
1. A 403 response from PermissionsGuardV2 produces an ACCESS_DENIED audit_logs row within 1s
2. The row payload contains the denied userId and the route identifier
3. Commit message includes `[closes SA-OBS-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-003` to avoid ID collision with the primary run; original id `OBS-003` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: The JwtAuthGuard path (unauthenticated 401) is a separate concern; only the post-auth 403 RBAC-denial path is flagged here.

**Closed_by:** (empty — TODO)

---

### SA-OBS-004 — DOCUMENT_DOWNLOADED action is defined but wired to no emitter (binary egress unobservable)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** E
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · audit-trail-gap
- **File:** `apps/api/src/audit/audit-action.enum.ts:49-53`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-004` · audit-confidence: high · found_by: observability

**Description:**
AuditAction.DOCUMENT_DOWNLOADED is in the enum, has an entity-type entry (audit.service.ts:71), and a payload schema (payload-schemas.ts), but no code emits it. The comment explains the bypass: Document.url points to external storage, so actual byte transfer bypasses the API. The gap is documented but the risk is real: an auditor querying DOCUMENT_DOWNLOADED for RGPD personal-data egress will find zero rows even if documents were accessed. DOCUMENT_READ only covers metadata fetch, not byte download.

**Root cause:**
Documents are metadata-only in the current architecture; the storage backend transfers bytes without going through the NestJS layer, so the DOWNLOADED event cannot be emitted server-side without a proxy or presigned-URL log hook.

**Code evidence:**
```
  // OBS-006 — document access lifecycle. READ = explicit metadata fetch-by-id
  // (DocumentsController GET /:id). DOWNLOADED = actual binary stream; reserved
  // and currently unwired — the binary lives in external storage referenced by
  // `Document.url`, so byte transfer bypasses the API and is not observable here.
  DOCUMENT_READ = 'DOCUMENT_READ',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
```

**Suggested fix:**
Either (a) implement a proxied download endpoint that streams from external storage through the API and emits DOCUMENT_DOWNLOADED, or (b) document the deliberate gap in a RGPD treatment record and add a compliance warning to the OBS-006 inline comment. If option (b), add a TODO with a tracking ticket ID so the gap is not forgotten.

**Acceptance criteria:**
1. If a proxied download endpoint exists: it emits DOCUMENT_DOWNLOADED per successful download
2. If no proxied path: a RGPD treatment record or code comment explicitly acknowledges the gap with remediation criteria
3. Commit message includes `[closes SA-OBS-004]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'DOCUMENT_DOWNLOADED' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src --include='*.ts' | grep -v 'enum\|schema\|ENTITY_TYPE\|spec'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-004` to avoid ID collision with the primary run; original id `OBS-004` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: The enum comment (lines 49-53) is the primary source; the gap is explicitly acknowledged but not mitigated.

**Closed_by:** (empty — TODO)

---

### SA-DAT-004 — USER_DELETED audit entry committed before erasure transaction — stale audit if tx rolls back

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_log_integrity
- **File:** `apps/api/src/users/users.service.ts:916-999`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-004` · audit-confidence: high · found_by: data_integrity

**Description:**
The USER_DELETED audit log entry is written at line 916 in a self-contained, committed transaction managed by AuditPersistenceService (as documented by the comment at line 912: 'Plain await, non-transactional'). The erasure transaction follows at line 948. If the erasure transaction fails for any reason — most importantly the concurrent-audit-insert race described below — the audit_logs row permanently records the user as deleted while the user row still exists. The race: (1) hardDelete checks authoredAuditRows = 0 at line 904; (2) a concurrent request (e.g. the user logs in via another tab) inserts a new audit_logs row; (3) USER_DELETED is committed; (4) tx.user.delete fails with FK violation (ON DELETE NO ACTION on audit_logs.actorId); the transaction rolls back but the immutable USER_DELETED entry cannot be reversed.

**Root cause:**
The audit entry is written outside and before the operational transaction to avoid passing a transaction client to AuditPersistenceService, matching the archive/unarchive pattern. But unlike archive/unarchive the subsequent operation can fail due to a DB-level FK race that the pre-check at line 904 cannot prevent.

**Code evidence:**
```
    await this.auditPersistence.log({
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: id,
      actorId: requestingUserId ?? null,
      payload: { snapshot: { ... } },
    });

    // Full erasure in ONE transaction. Every record OWNED by the user ...
    await this.prisma.$transaction(async (tx) => {
      await tx.personalTodo.deleteMany({ where: { userId: id } });
      ...
      await tx.user.delete({ where: { id } });
    });
```

**Suggested fix:**
Move the USER_DELETED audit log write to inside the erasure transaction, passing `tx` to `auditPersistence.log()`. AuditPersistenceService already supports a caller-supplied transaction client (documented at lines 104-110). This eliminates the race window entirely: if the tx rolls back, no audit row is committed.

**Acceptance criteria:**
1. Integration test: simulate a concurrent audit insert between the check and the transaction — verify no orphan USER_DELETED log exists after a FK-triggered rollback
2. Code review: USER_DELETED auditPersistence.log() called with `tx` argument inside the $transaction lambda
3. Commit message includes `[closes SA-DAT-004]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'auditPersistence.log\|\$transaction\|USER_DELETED' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/users/users.service.ts | head -15
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-004` to avoid ID collision with the primary run; original id `DAT-004` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Line 912 confirms 'Plain await, non-transactional'. Line 916-936: audit committed. Line 948: erasure $transaction begins. The same pre-tx pattern in project deletion (projects.service.ts line 855) is protected by an earlier checkProjectDependencies(); the user path has no equivalent guard for the concurrent-audit-insert case.

**Closed_by:** (empty — TODO)

---

### SA-DAT-005 — DAT-021 hash-chain recompute is operator-manual with no CI/migration guard that it executed

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_log_integrity
- **File:** `packages/database/prisma/migrations/20260526120000_dat021_audit_payload_schema_version_gin_index/migration.sql:27-31`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-005` · audit-confidence: high · found_by: data_integrity

**Description:**
Migration 20260526120000 adds the schemaVersion column to audit_logs and folds it into the computeRowHash input. Because schemaVersion was added via a catalog backfill (NOT a per-row UPDATE, so the immutability trigger is not triggered), every pre-existing row's prevHash/rowHash was computed without schemaVersion. The recompute script (scripts/recompute-chain-on-schema-bump.ts) must be run manually after this migration. No CI workflow step, no migration post-hook, and no integration test asserts that the recompute was executed. If the migration ran without the follow-up script, the stored rowHash for all pre-existing rows is stale and the chain does not verify against the current computeRowHash function.

**Root cause:**
The DAT-021 design deliberately decoupled the migration (schema change) from the hash recompute (data change) to avoid a long-running DDL+UPDATE in a single migration, but provided no automation to guarantee the second step ran.

**Code evidence:**
```
--   rowHash must be recomputed. That walk runs AFTER this migration via
--   scripts/recompute-chain-on-schema-bump.ts (advisory-lock + trigger-disable
--   inside one transaction, SYSTEM_BACKFILL-bracketed). See the runbook in the
--   DAT-021 closing commit body. Until the recompute runs, freshly inserted rows
--   are self-consistent (he hash with schemaVersion); pre-existing rows verify
--   only after the recompute.
```

**Suggested fix:**
Add a CI integration test that: (1) applies all migrations to a real PG DB, (2) inserts a seed row before the DAT-021 migration point via a partial migrate run, (3) finishes migrations, then (4) asserts that the full chain verifies. Alternatively, promote the recompute to a Prisma post-migrate hook or a documented, enforced deploy gate (checklist item with git-signed confirmation). Minimal: add a witness assertion in the existing dat021 int spec that verifies chain integrity over any seed rows.

**Acceptance criteria:**
1. CI step exists that runs the chain-verification logic after `prisma migrate deploy` completes
2. OR: the recompute script is idempotent and runs automatically as part of the standard deploy flow (deploy-prod.sh or equivalent)
3. Commit message includes `[closes SA-DAT-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'recompute\|schema-bump\|schemaVersion' /home/alex/Documents/REPO/ORCHESTRA/.github/workflows/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-005` to avoid ID collision with the primary run; original id `DAT-005` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Confirmed: no CI workflow file mentions 'recompute', 'schema-bump', or 'schemaVersion'. The witness script exists at apps/api/src/scripts/recompute-chain-on-schema-bump.witness.ts but is explicitly operator-manual (README line 78 says 'run against a throwaway DB').

**Closed_by:** (empty — TODO)

---

### SA-PERF-014 — audit_logs advisory lock serialises ALL audit writes globally — creates a bottleneck under concurrent mutations

- **Status:** TODO
- **Phase:** 2
- **Cluster:** F
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · lock-contention
- **File:** `apps/api/src/audit/audit-persistence.service.ts:152`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-014` · audit-confidence: high · found_by: performance

**Description:**
Every audit log write acquires the same global advisory lock on the string 'audit_logs_chain'. This serialises all audit inserts across all concurrent API requests. Under moderate load (10 concurrent requests each triggering an audit write), all 10 requests queue on this lock. Since the lock is held for the duration of a transaction that includes a user lookup + INSERT, hold time can be 5-20ms per write, creating throughput bottleneck of 50-200 audit writes/second.

**Root cause:**
The hash-chained audit log requires strictly ordered inserts to maintain prevHash integrity; the advisory lock is the implementation for this ordering guarantee.

**Code evidence:**
```
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))`;
```

**Suggested fix:**
Consider whether the strict sequential chain is necessary for ALL audit entries, or only for sensitive actions (ROLE_CHANGE, USER_DELETED, and so on). For high-frequency routine events, use a background queue (Redis list + consumer) that batches inserts with a single advisory lock acquisition. Alternatively, use a monotonic sequence column and accept eventual chain consistency.

**Acceptance criteria:**
1. Bulk import of 50 users completes without measurable advisory lock wait accumulation
2. Advisory lock contention is documented as a known tradeoff if not fixed
3. Commit message includes `[closes SA-PERF-014]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'pg_advisory_xact_lock' apps/api/src/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-014` to avoid ID collision with the primary run; original id `PERF-014` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: This is an architectural tradeoff — the hash chain's correctness depends on serialisation. The issue is the scale impact, not the design intent.

**Closed_by:** (empty — TODO)

---

### SA-PERF-001 — projects.findAll default limit is 1000 — effectively unbounded for admins

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/projects/projects.service.ts:229-238`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-001` · audit-confidence: high · found_by: performance

**Description:**
The default limit is 1000 and the hard ceiling is also 1000, so any caller without an explicit limit gets up to 1000 project rows per page. For ADMIN/RESPONSABLE/MANAGER roles (hasFullVisibility = true) this applies to the full projects table with eager-loaded members (take: 5 each), createdBy, manager, sponsor, clients, and all _count sub-selects. With 500 projects this generates a JOIN tree with 500×5 = 2500 ProjectMember rows hydrated per request.

**Root cause:**
Default and ceiling limit values are both 1000; there is no differentiation between list-page use (needs ~20) and export use (needs all).

**Code evidence:**
```
async findAll(
    page = 1,
    limit = 1000,
    status?: ProjectStatus,
    userId?: string,
    userRole?: string,
    clients?: string,
    archived: ArchivedFilter = ArchivedFilter.ACTIVE,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Lower the default limit to 20 and the hard ceiling to 200 for the standard list endpoint; provide a separate, authenticated export endpoint without a page limit. Or at minimum align with tasks.findAll's default of 10.

**Acceptance criteria:**
1. GET /projects without explicit limit parameter returns at most 20 items
2. GET /projects?limit=201 is rejected with 400 or silently capped at 200
3. An export endpoint (CSV or JSON) exists for ADMIN with explicit ceiling
4. Commit message includes `[closes SA-PERF-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -H 'Authorization: Bearer <token>' 'http://localhost:3000/projects' | jq '.meta.limit'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-001` to avoid ID collision with the primary run; original id `PERF-001` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: tasks.findAll uses default 10 but ceiling 1000 — the ceiling issue is shared.

**Closed_by:** (empty — TODO)

---

### SA-PERF-015 — planning.getOverview loads up to 1000 users and 1000 leaves in a single blocking request

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/planning/planning.service.ts:66-76`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-015` · audit-confidence: high · found_by: performance

**Description:**
The planning overview endpoint hard-codes limit=1000 for both users (allowFullScan: true bypasses the 200 hard ceiling) and services. Combined with leavesService.findAll(1, 1000, ...) in the second parallel batch (line 96-105), this single endpoint loads up to 1000 users + 1000 services + up to 500 tasks + up to 1000 leaves in one request. The response JSON for a mid-sized organisation (200 users, 50 services, 300 leaves) will easily exceed 1 MB.

**Root cause:**
The planning view was designed to render a full grid of all users/leaves/tasks for a date range; the 1000 limits were set as 'practical' ceilings but are effectively unbounded for small-to-medium organisations.

**Code evidence:**
```
const [usersResult, servicesResult, tasksResult] = await Promise.all([
      this.usersService.findAll(1, 1000, undefined, undefined, {
        allowFullScan: true,
      }),
      this.servicesService.findAll(1, 1000),
      this.tasksService.findForPlanningOverview(startDate, endDate, currentUser),
    ]);
```

**Suggested fix:**
Implement pagination or date-windowed loading for the planning view. Load users and services once (cached), then page-load leaves/tasks. Alternatively, move to a per-service or per-department view that scopes the load.

**Acceptance criteria:**
1. Planning overview does not load more than 200 users in a single request
2. Leaves and tasks are loaded for a maximum 4-week window by default
3. Commit message includes `[closes SA-PERF-015]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findAll.*1000\|limit.*1000' apps/api/src/planning/planning.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-015` to avoid ID collision with the primary run; original id `PERF-015` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-PERF-017 — getSnapshots has no pagination or limit — returns all historical snapshots for a project

- **Status:** TODO
- **Phase:** 2
- **Cluster:** G
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/projects/projects.service.ts:1231-1255`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-017` · audit-confidence: high · found_by: performance

**Description:**
Returns all ProjectSnapshot rows for a project with no limit. For a project running for 2 years with daily snapshots, this is 730 rows. Without a date filter (from/to are optional), all snapshots for the project's lifetime are returned in a single query.

**Root cause:**
No pagination or default date window; both from and to are optional with no fallback.

**Code evidence:**
```
async getSnapshots(
    projectId: string,
    from?: string,
    to?: string,
    currentUser?: AccessUser,
  ) {
    ...
    return this.prisma.projectSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }
```

**Suggested fix:**
Add a default date window (e.g. last 90 days) when from/to are not provided, and add a hard limit of 365 rows.

**Acceptance criteria:**
1. getSnapshots with no date filter returns at most the last 90 days
2. A hard take limit of 365 is enforced
3. Commit message includes `[closes SA-PERF-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'getSnapshots\|findMany' apps/api/src/projects/projects.service.ts | head -10
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-017` to avoid ID collision with the primary run; original id `PERF-017` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-PERF-011 — analytics.getAnalytics fires TWO identical task.groupBy queries per request

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · redundant-query
- **File:** `apps/api/src/analytics/analytics.service.ts:113-127`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-011` · audit-confidence: high · found_by: performance

**Description:**
getAnalytics fires taskStatusGroupBy (line 113) over the projectIds from getProjects. But getProjects itself (line 189) also fires an identical task.groupBy by ['projectId','status'] for progress computation. That means every analytics request runs the same GROUP BY on the tasks table twice. Both queries scan the same rows with the same filter.

**Root cause:**
getProjects was refactored to compute progress via groupBy without removing or sharing the outer groupBy that was added later.

**Code evidence:**
```
const taskStatusGroupBy = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });
    ...
    const projectProgressData = this.getProjectProgressData(projects, taskStatusGroupBy);
    const taskStatusData = this.getTaskStatusData(taskStatusGroupBy);
```

**Suggested fix:**
Pass the result of the outer taskStatusGroupBy (line 113) into getProjects as a parameter, eliminating the inner groupBy on line 189. Or compute the per-project progress map in getAnalytics and pass it through.

**Acceptance criteria:**
1. getAnalytics issues exactly ONE task.groupBy per request
2. Both getProjectProgressData and per-project progress in getProjects use the same pre-computed map
3. Commit message includes `[closes SA-PERF-011]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'task.groupBy\|groupBy' apps/api/src/analytics/analytics.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-011` to avoid ID collision with the primary run; original id `PERF-011` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-PERF-012 — analytics members include: loads ALL project members with full user object — no per-project cap

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-one
- **File:** `apps/api/src/analytics/analytics.service.ts:165-183`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-012` · audit-confidence: high · found_by: performance

**Description:**
getProjects in analytics includes ALL ProjectMember rows for each project, each with a full User object and their Department. Unlike the main project list (which uses take: 5 for members), the analytics query has no limit on members. A project with 50 members multiplied by 50 projects generates 2500 full user rows fetched per analytics call.

**Root cause:**
No take limit on members include in the analytics getProjects path.

**Code evidence:**
```
members: {
          include: {
            user: {
              include: {
                department: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
```

**Suggested fix:**
Add `take: 5` on members include as done in projects.findAll, or better, remove the members include from analytics entirely since the member count is available via _count.members.

**Acceptance criteria:**
1. analytics members include has a take: 5 cap or is removed
2. Member user data is not fetched for each of the 50 analytics projects
3. Commit message includes `[closes SA-PERF-012]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n -A5 'members.*include\|include.*members' apps/api/src/analytics/analytics.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-012` to avoid ID collision with the primary run; original id `PERF-012` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-PERF-018 — getProjectStats issues 2 separate TimeEntry findMany — should use one groupBy or aggregate

- **Status:** TODO
- **Phase:** 2
- **Cluster:** H
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-one
- **File:** `apps/api/src/projects/projects.service.ts:1322-1347`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-018` · audit-confidence: high · found_by: performance

**Description:**
getProjectStats fetches all user time entries and all third-party time entries for a project's task IDs, then reduces them in JavaScript. For a project with 100 tasks and 500 time entries, this fetches 500 rows just for the hours column. The aggregation should be pushed to Postgres via aggregate()._sum.hours.

**Root cause:**
findMany used where aggregate is appropriate; JS reduce replaces a DB SUM.

**Code evidence:**
```
const taskIds = project.tasks.map((t) => t.id);
    const [userTimeEntries, thirdPartyTimeEntries] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { taskId: { in: taskIds }, userId: { not: null }, isDismissal: false },
        select: { hours: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { taskId: { in: taskIds }, thirdPartyId: { not: null }, isDismissal: false },
        select: { hours: true },
      }),
    ]);
    const totalActualHours = userTimeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
```

**Suggested fix:**
Replace both findMany calls with `this.prisma.timeEntry.aggregate({ _sum: { hours: true }, where: {...} })` for each dimension.

**Acceptance criteria:**
1. getProjectStats uses timeEntry.aggregate not findMany for hour totals
2. No JS reduce over time entry arrays in getProjectStats
3. Commit message includes `[closes SA-PERF-018]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'timeEntry.findMany\|userTimeEntries\|thirdPartyTimeEntries' apps/api/src/projects/projects.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-018` to avoid ID collision with the primary run; original id `PERF-018` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-DAT-002 — UserSkill.validatedBy is an untyped String? with no FK to users — dangling reference risk

- **Status:** TODO
- **Phase:** 2
- **Cluster:** J
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · referential_integrity
- **File:** `packages/database/prisma/schema.prisma:763-778`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-002` · audit-confidence: high · found_by: data_integrity

**Description:**
UserSkill.validatedBy is typed as String? with no Prisma relation and no FK constraint in the database. The init migration (20251116093059) confirms that user_skills has only two FK constraints: userId → users and skillId → skills. No FK for validatedBy was added in any of the 74 migrations. When the user referenced by validatedBy is deleted, the validatedBy column retains the stale UUID indefinitely.

**Root cause:**
The field was added as a plain String? annotation without a FK, likely as a lightweight reference, and no later migration promoted it to a proper FK.

**Code evidence:**
```
model UserSkill {
  userId      String
  skillId     String
  level       SkillLevel
  validatedBy String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([userId, skillId])
  @@map("user_skills")
}
```

**Suggested fix:**
Add `validatedById String? @map("validated_by_id")` with a proper Prisma relation `validatedByUser User? @relation(..., onDelete: SetNull)` and rename the column. Alternatively keep it as an opaque string but rename to `validatedBySnapshot` and populate it with the user's name at write time (frozen snapshot, same pattern as audit_logs.actorLabel). The snapshot approach avoids a new FK migration on a composite-PK table.

**Acceptance criteria:**
1. Either: `psql`: `\d user_skills` shows a FK constraint on the validator column pointing to users
2. Or: the column is renamed to a snapshot field and populated with the user's display name at skill-validation time, never looked up via JOIN
3. Commit message includes `[closes SA-DAT-002]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'user_skills.*validatedBy\|validatedBy.*user_skills\|validated_by.*fkey' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/20251116093059_init/migration.sql
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-002` to avoid ID collision with the primary run; original id `DAT-002` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: init migration lines 249-257 show user_skills table with validatedBy TEXT; lines 378-381 add only userId and skillId FKs.

**Closed_by:** (empty — TODO)

---

### SA-COR-004 — addDependency allows two orphan tasks (projectId = null) to be linked, violating the 'same project' invariant

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business invariant / cross-domain enforcement
- **File:** `apps/api/src/tasks/tasks.service.ts:915-920`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#COR-004` · audit-confidence: high · found_by: correctness

**Description:**
The cross-project guard uses a strict JavaScript inequality (`!==`). When both `task.projectId` and `dependsOnTask.projectId` are `null`, the comparison evaluates `null !== null` which is `false`, so the guard passes silently. This means any two orphan tasks (meetings, cross-cutting tasks) can be linked as dependencies regardless of whether they have any business relationship. The orphan-task feature is intentional per CLAUDE.md, but linking arbitrary orphan tasks as dependencies creates invisible coupling that persists even when one of the tasks is later attached to a project via `attachToProject`.

**Root cause:**
The `!==` operator does not distinguish `null !== null` (both orphans) from `null !== 'project-uuid'` (different projects), treating both cases identically while only one should be an error.

**Code evidence:**
```
    // Vérifier qu'elles appartiennent au même projet
    if (task.projectId !== dependsOnTask.projectId) {
      throw new BadRequestException(
        'Les tâches doivent appartenir au même projet',
      );
    }
```

**Suggested fix:**
Add an explicit null check: `if (task.projectId === null || task.projectId !== dependsOnTask.projectId)`. Orphan tasks should not participate in dependency relationships (they have no project scope to define what 'same scope' means), or the check should be `task.projectId !== null && task.projectId === dependsOnTask.projectId` (i.e. same non-null project).

**Acceptance criteria:**
1. addDependency(orphanTask1, orphanTask2) throws BadRequestException
2. addDependency(projectTask, orphanTask) throws BadRequestException
3. addDependency(projectTask1, projectTask2_same_project) succeeds as before
4. Commit message includes `[closes SA-COR-004]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'projectId !== dependsOnTask.projectId' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-COR-004` to avoid ID collision with the primary run; original id `COR-004` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-COR-008 — tasks.update: assigning an epicId or milestoneId that belongs to a different project than the task's (possibly updated) projectId is not validated

- **Status:** TODO
- **Phase:** 2
- **Cluster:** L
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business invariant / incomplete validation
- **File:** `apps/api/src/tasks/tasks.service.ts:714-730`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#COR-008` · audit-confidence: high · found_by: correctness

**Description:**
The `create` method (lines 153–182) correctly validates that `epic.projectId === projectId` and `milestone.projectId === projectId`. The `update` method validates only that the epic/milestone *exist* but does NOT check that they belong to the same project as the task (either the task's existing `projectId` or the newly supplied `projectId` in the DTO). An attacker or UI bug can therefore link a task in project A to an epic from project B, violating the referential integrity that the create path enforces. The DB schema may not carry a composite FK for this cross-entity constraint.

**Root cause:**
The update validation was written as a subset of create validation, omitting the cross-project membership check for epicId and milestoneId.

**Code evidence:**
```
    if (epicId) {
      const epic = await this.prisma.epic.findUnique({
        where: { id: epicId },
      });
      if (!epic) {
        throw new NotFoundException('Epic introuvable');
      }
    }

    if (milestoneId) {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone introuvable');
      }
    }
```

**Suggested fix:**
In the update method's epicId validation block, after confirming the epic exists, add: `const effectiveProjectId = projectId ?? existingTask.projectId; if (epic.projectId !== effectiveProjectId) throw new BadRequestException("L'epic n'appartient pas au même projet");`. Apply the same pattern for milestoneId.

**Acceptance criteria:**
1. PATCH /tasks/:id with epicId belonging to a different project returns 400
2. PATCH /tasks/:id with milestoneId belonging to a different project returns 400
3. PATCH /tasks/:id with epicId null (clearing the epic) still succeeds
4. Existing valid updates (epic in the same project) are unaffected
5. Commit message includes `[closes SA-COR-008]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'epicId\|milestoneId\|projectId' apps/api/src/tasks/tasks.service.ts | grep -A5 'update' | head -30
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-COR-008` to avoid ID collision with the primary run; original id `COR-008` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-OBS-005 — getRequestId() has zero call sites: ALS request-ID never reaches audit payloads or structured logs

- **Status:** TODO
- **Phase:** 2
- **Cluster:** N
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · correlation-id-not-propagated
- **File:** `apps/api/src/common/fastify/request-id.context.ts:74-76`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-005` · audit-confidence: high · found_by: observability

**Description:**
OBS-009 wired AsyncLocalStorage to capture every request's ID (main.ts:110). The payload-schemas.ts securityEnvelope schema declares an optional `requestId` field (line 70) so audit rows can carry correlation IDs. However, grep across all non-spec, non-definition source files finds zero call sites for getRequestId(). AuditService.log() never reads it; AuditPersistenceService never passes it through. AllExceptionsFilter reads request.id directly from the Fastify object (line 77) but does not propagate it into the NestJS Logger or to downstream audit rows. The ALS store exists, the accessor exists, the schema slot exists — but nothing plumbs them together.

**Root cause:**
getRequestId() was defined as part of OBS-009 but was never invoked in the audit emission or logging code paths.

**Code evidence:**
```
export function getRequestId(): string | undefined {
  return requestIdStore.getStore()?.requestId;
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
```

**Suggested fix:**
In AuditService.log(), read `getRequestId()` from the context and add it to the entry object passed to this.logger.log(). In the security-envelope path, also forward it as `requestId` in the AuditPersistenceService payload. A single import of getRequestId into audit.service.ts and a one-line spread into the payload is sufficient.

**Acceptance criteria:**
1. A login request with X-Request-ID: test-id-123 produces an audit_logs row whose payload.requestId === 'test-id-123'
2. The server-side NestJS Logger line for the same event contains the request ID
3. Commit message includes `[closes SA-OBS-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'getRequestId()' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src --include='*.ts' | grep -v 'request-id.context.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-005` to avoid ID collision with the primary run; original id `OBS-005` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: payload-schemas.ts:57-70 confirms the schema slot is prepared; the gap is purely in the call-site wiring.

**Closed_by:** (empty — TODO)

---

### SA-OBS-008 — In-memory Prometheus metrics are fully reset on every container restart

- **Status:** TODO
- **Phase:** 2
- **Cluster:** N
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · metrics-lost-on-restart
- **File:** `apps/api/src/metrics/metrics.service.ts:20-52`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-008` · audit-confidence: high · found_by: observability

**Description:**
MetricsService stores http_requests_total and http_request_duration_seconds in two in-process Maps. On every container restart, rolling update, or OOM kill, all accumulated metric state is lost. For a production system on docker-compose.prod.yml (restart: unless-stopped, max_attempts: 3), the container restarts at least once per deploy. Prometheus scrape intervals between restarts collect counter values that reset to 0, making rate() and increase() calculations incorrect. There is no persistence layer (Redis, remote-write, or prom-client with pushgateway).

**Root cause:**
The metrics service was designed as a minimal scaffold (OBS-011) with no persistence; in-process Maps were the simplest approach.

**Code evidence:**
```
@Injectable()
export class MetricsService {
  private readonly requestCounter = new Map<string, CounterEntry>();
  private readonly durationSummary = new Map<string, SummaryEntry>();

  recordRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ): void {
```

**Suggested fix:**
Replace the in-process Maps with prom-client (the de-facto Node.js Prometheus library) and configure a Prometheus scrape interval short enough to catch data before restart, or add a remote_write endpoint. Alternatively, expose metrics via a push-on-shutdown hook to a Pushgateway. Minimum: document the restart-reset behavior as a known limitation on the /api/metrics endpoint.

**Acceptance criteria:**
1. http_requests_total counter value is not reset to 0 on container restart
2. Or: the /api/metrics response includes a last_reset_at metric so downstream tooling can detect and compensate
3. Commit message includes `[closes SA-OBS-008]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s http://localhost:4000/api/metrics | grep http_requests_total
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-008` to avoid ID collision with the primary run; original id `OBS-008` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-OBS-009 — No database connection-pool metrics or Redis latency metrics exposed at /api/metrics

- **Status:** TODO
- **Phase:** 2
- **Cluster:** N
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-db-redis-metrics
- **File:** `apps/api/src/metrics/metrics.service.ts:1-85`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-009` · audit-confidence: high · found_by: observability

**Description:**
The OBS-011 Prometheus endpoint tracks only HTTP request counts and durations. There are no metrics for: Prisma connection pool saturation (active/idle connections), PostgreSQL query error rates, Redis PING latency or connection failures, audit chain advisory lock wait time, or background snapshot-scheduler job timing. PrismaService.onModuleInit() wires a slow-query log listener (OBS-023) but this is stdout-only and not exported to Prometheus. A DB connection-pool exhaustion or Redis outage would be visible only in container logs, not in alerting dashboards.

**Root cause:**
OBS-011 explicitly documented itself as 'minimal'; no follow-up ticket wired DB/Redis instrumentation.

**Code evidence:**
```
/**
 * OBS-011 — Minimal in-process Prometheus metrics service.
 *
 * Tracks http_requests_total (counter) and http_request_duration_seconds (summary).
 * No external dependency (no prom-client). Output is valid Prometheus text format.
 */
```

**Suggested fix:**
Add Prometheus gauges/histograms for: Prisma $metrics (available via prisma.$metrics.json()), Redis PING latency (measured in the RedisService on each operation), and audit advisory lock wait time (measured in AuditPersistenceService.log()). These can be pushed to MetricsService.recordRequest() equivalent or a new recordGauge() method.

**Acceptance criteria:**
1. GET /api/metrics includes at least one metric covering DB connection state
2. GET /api/metrics includes at least one metric covering Redis latency
3. Commit message includes `[closes SA-OBS-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s http://localhost:4000/api/metrics | grep -E 'db_|redis_|prisma_|pool_'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-009` to avoid ID collision with the primary run; original id `OBS-009` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-TEST-004 — settings.controller.ts has no controller spec (8 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/settings/settings.controller.ts:1-110`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-004` · audit-confidence: high · found_by: tests

**Description:**
SettingsController has 8 endpoints (GET /, GET /category/:category, GET /:key, PUT /:key, POST /bulk, POST /:key/reset, POST /reset-all, DELETE /:key) all decorated with @RequirePermissions. There is a settings.service.spec.ts but no settings.controller.spec.ts. Controller-level tests verify that the controller passes correct arguments to the service, raises correct HTTP exceptions on errors, and that the guard decoration is present. The service spec does not test the controller layer.

**Root cause:**
Controller spec was never written when the settings module was added.

**Code evidence:**
```
@Controller('settings')
export class SettingsController {
  @Get()
  @RequirePermissions('settings:read')
  async findAll() {
    return this.settingsService.findAll();
  }

  @Put(':key')
  @RequirePermissions('settings:update')
```

**Suggested fix:**
Create apps/api/src/settings/settings.controller.spec.ts following the pattern in tasks.controller.spec.ts: mock SettingsService and PermissionsService, test each endpoint for happy path and at least NotFoundException/ForbiddenException paths.

**Acceptance criteria:**
1. apps/api/src/settings/settings.controller.spec.ts exists
2. All 8 endpoints have at least one happy-path test
3. PUT/:key and DELETE/:key have NotFoundException tests
4. Commit message includes `[closes SA-TEST-004]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/settings -name 'settings.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-004` to avoid ID collision with the primary run; original id `TEST-004` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-005, TEST-006, TEST-007, TEST-008, TEST-009, TEST-010, TEST-011, TEST-012.

**Closed_by:** (empty — TODO)

---

### SA-TEST-005 — leave-types.controller.ts has no controller spec (7 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/leave-types/leave-types.controller.ts:1-120`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-005` · audit-confidence: high · found_by: tests

**Description:**
LeaveTypesController has 7 endpoints (POST, GET /, GET /:id, GET /code/:code, PATCH /:id, DELETE /:id, POST /reorder). There is a leave-types.service.spec.ts but no leave-types.controller.spec.ts. Leave types are critical HR reference data; incorrect controller behavior (e.g., accepting an invalid reorder body without validation) could corrupt the leave type ordering.

**Root cause:**
Controller spec was never written when the leave-types module was added.

**Code evidence:**
```
@Controller('leave-types')
export class LeaveTypesController {
  @Post()
  @RequirePermissions('leaves:update')
  create(@Body() createLeaveTypeDto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(createLeaveTypeDto);
  }

  @Delete(':id')
  @RequirePermissions('leaves:delete')
```

**Suggested fix:**
Create apps/api/src/leave-types/leave-types.controller.spec.ts: mock LeaveTypesService, test create/findAll/findOne/findByCode/update/remove/reorder including NotFoundException and BadRequestException paths.

**Acceptance criteria:**
1. apps/api/src/leave-types/leave-types.controller.spec.ts exists
2. DELETE endpoint has a test verifying 400 for system type deletion
3. Commit message includes `[closes SA-TEST-005]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leave-types -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-005` to avoid ID collision with the primary run; original id `TEST-005` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.

**Closed_by:** (empty — TODO)

---

### SA-TEST-006 — rbac/roles.controller.ts has no controller spec (6 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/rbac/roles.controller.ts:1-120`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-006` · audit-confidence: high · found_by: tests

**Description:**
RolesController has 6 CRUD endpoints all requiring users:manage_roles, a critical RBAC-management permission. There is a roles.service.spec.ts and the admin-roles-gallery.spec.ts covers UI behavior, but no controller spec tests the HTTP layer directly. The DELETE endpoint must return 403 for system roles and 409 for roles with assigned users — these cases are tested at the service layer but not at the controller layer.

**Root cause:**
The roles controller was added as part of RBAC V4 refactor; only service and E2E tests were written.

**Code evidence:**
```
@Controller('roles')
export class RolesController {
  @Get('templates')
  @RequirePermissions('users:manage_roles')
  listTemplates() {
    return this.rolesService.listTemplates();
  }

  @Delete(':id')
  @RequirePermissions('users:manage_roles')
  @HttpCode(HttpStatus.NO_CONTENT)
```

**Suggested fix:**
Create apps/api/src/rbac/__tests__/roles.controller.spec.ts following the permissions.guard.spec.ts pattern.

**Acceptance criteria:**
1. apps/api/src/rbac/__tests__/roles.controller.spec.ts exists
2. DELETE endpoint has 403 (system role) and 409 (users assigned) test cases
3. Commit message includes `[closes SA-TEST-006]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/rbac -name 'roles.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-006` to avoid ID collision with the primary run; original id `TEST-006` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.

**Closed_by:** (empty — TODO)

---

### SA-TEST-007 — analytics-advanced.controller.ts has no controller spec (6 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 2
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/analytics/advanced/analytics-advanced.controller.ts:1-140`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-007` · audit-confidence: high · found_by: tests

**Description:**
AnalyticsAdvancedController has 6 GET endpoints (/snapshots, /workload, /project-health, /milestones-completion, /tasks-breakdown, /recent-activity) all under @RequirePermissions('reports:view'). There are 6 service specs under analytics/advanced/services/ but no controller spec. The controller passes a user context `{ id, role }` object to each service; a bug in this wiring (e.g., wrong user ID passed) would not be caught by unit tests.

**Root cause:**
Individual service specs were created but no controller spec was written.

**Code evidence:**
```
@Controller('analytics/advanced')
@ApiBearerAuth()
export class AnalyticsAdvancedController {
  @Get('snapshots')
  @RequirePermissions('reports:view')
  async getSnapshots(
    @Query() query: SnapshotsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SnapshotsResponseDto> {
```

**Suggested fix:**
Create apps/api/src/analytics/advanced/analytics-advanced.controller.spec.ts: mock each of the 6 services, verify user context is forwarded correctly, test that @RequirePermissions is applied to each endpoint.

**Acceptance criteria:**
1. apps/api/src/analytics/advanced/analytics-advanced.controller.spec.ts exists
2. Each of the 6 endpoints has a test verifying user context is forwarded
3. Commit message includes `[closes SA-TEST-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/analytics/advanced -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-007` to avoid ID collision with the primary run; original id `TEST-007` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.

**Closed_by:** (empty — TODO)

---

### SA-TEST-002 — e2e/leaves.spec.ts: tautological assertions — test always passes even when page is broken

- **Status:** TODO
- **Phase:** 2
- **Cluster:** P
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · weak-assertions
- **File:** `e2e/leaves.spec.ts:38-43`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-002` · audit-confidence: high · found_by: tests

**Description:**
The assertion `expect(hasList || hasEmptyMessage || isOnLeavesPage).toBeTruthy()` is a tautology: because the test just navigated to `/leaves`, `isOnLeavesPage` is always `true`, making the disjunction always pass regardless of actual content rendering. The same pattern appears at line 208 (`hasPendingLeaves || hasEmptyMessage || isOnLeavesPage`). Additionally, lines 92, 118, 142, 162, 243, 288 use `catch(() => {})` to silently swallow selector failures. If the leaves page renders a blank error screen, all these tests still pass.

**Root cause:**
Defensive coding that trades false-negative safety for no assertion value; these were written to avoid flakes but removed all signal.

**Code evidence:**
```
    const isOnLeavesPage = page.url().includes("/leaves");

    expect(hasList || hasEmptyMessage || isOnLeavesPage).toBeTruthy();
  });

  test("should open new leave request form", async ({ page }) => {
    await page.goto("/leaves");
```

**Suggested fix:**
Replace tautological disjunctions with targeted assertions on actual leaf data: use `await expect(page.locator('h1')).toContainText(/congés/i)` and for list presence use `await expect(page.locator('table, [data-testid="leaves-list"]')).toBeVisible()` with a proper timeout. Remove silent `catch(() => {})` blocks and let Playwright report the locator failure.

**Acceptance criteria:**
1. No `expect(... || isOnLeavesPage).toBeTruthy()` pattern in leaves.spec.ts
2. At least one assertion fails when the page renders empty (no table, no list)
3. Commit message includes `[closes SA-TEST-002]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'isOnLeavesPage\|catch(() => {})' /home/alex/Documents/REPO/ORCHESTRA/e2e/leaves.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-002` to avoid ID collision with the primary run; original id `TEST-002` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-003.

**Closed_by:** (empty — TODO)

---

### SA-TEST-003 — e2e/planning.spec.ts: two `expect(true).toBeTruthy()` assertions — tests can never fail

- **Status:** TODO
- **Phase:** 2
- **Cluster:** P
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · weak-assertions
- **File:** `e2e/planning.spec.ts:170`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-003` · audit-confidence: high · found_by: tests

**Description:**
`expect(true).toBeTruthy()` appears at lines 170 and 257 in planning.spec.ts. These are pure no-ops: the test exercises drag-and-drop and 'navigate to today' interactions but makes no assertion about the resulting state. If the interaction silently fails (the task stays in its column, the view does not update), the test passes. Line 199 also has a silent `catch(() => {})` eating selector failures.

**Root cause:**
Placeholder assertions left in place because the author noted the state was hard to verify without proper test IDs on the planning grid.

**Code evidence:**
```
        // Attendre la mise à jour
        await page.waitForTimeout(500);

        // Vérifier que la tâche a été déplacée (difficile à vérifier sans plus de contexte)
        expect(true).toBeTruthy();
      }
    }
  });
```

**Suggested fix:**
Add `data-testid` attributes to planning grid cells/slots in the web component, then assert that the dragged task appears at the new position. For the 'today' navigation, assert that the current week's date header is visible. At minimum, replace `expect(true).toBeTruthy()` with `expect(page.url()).toContain('/planning')` as a floor.

**Acceptance criteria:**
1. No `expect(true).toBeTruthy()` in planning.spec.ts
2. Drag-and-drop test asserts task moved to target cell
3. Commit message includes `[closes SA-TEST-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'expect(true).toBeTruthy' /home/alex/Documents/REPO/ORCHESTRA/e2e/planning.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-003` to avoid ID collision with the primary run; original id `TEST-003` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-002.

**Closed_by:** (empty — TODO)

---

### SA-TEST-013 — e2e/tasks.spec.ts: task-list test swallows selector failure and asserts only URL

- **Status:** TODO
- **Phase:** 2
- **Cluster:** P
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · weak-assertions
- **File:** `e2e/tasks.spec.ts:18-28`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-013` · audit-confidence: high · found_by: tests

**Description:**
The waitForSelector failure is silently caught and the only assertion is `expect(page.url()).toContain('/tasks')`. The URL is set by page.goto() regardless of render outcome, so this assertion is always true. If the tasks page crashes and shows a blank error component, this test passes. This test provides no signal about task list rendering.

**Root cause:**
Defensive catch block and URL-only assertion provide no actual verification of content.

**Code evidence:**
```
  test("should display task list", async ({ page }) => {
    await page.goto("/tasks");

    // Attendre que la liste se charge
    await page
      .waitForSelector('[data-testid="task-list"], .tasks-list, table', {
        timeout: 5000,
      })
      .catch(() => {
        // Si aucun élément trouvé, c'est OK, la page peut être vide
      });

    expect(page.url()).toContain("/tasks");
```

**Suggested fix:**
Replace with `await expect(page.locator('h1')).toContainText(/tâches/i)` after page.goto. If the list may be empty, assert `await expect(page.locator('h1, [data-testid="empty-state"]').first()).toBeVisible()`.

**Acceptance criteria:**
1. Test asserts task page H1 is visible
2. No catch(() => {}) on the selector wait
3. Commit message includes `[closes SA-TEST-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'catch(() => {})' /home/alex/Documents/REPO/ORCHESTRA/e2e/tasks.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-013` to avoid ID collision with the primary run; original id `TEST-013` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-002, TEST-003.

**Closed_by:** (empty — TODO)

---

### SA-TEST-001 — 5 legacy E2E specs use UI login (helpers.ts) instead of API-based storageState

- **Status:** TODO
- **Phase:** 2
- **Cluster:** Q
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** tests · e2e-auth-pattern
- **File:** `e2e/full-workflow.spec.ts:1-9`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-001` · audit-confidence: high · found_by: tests

**Description:**
e2e/full-workflow.spec.ts, e2e/planning.spec.ts, e2e/leaves.spec.ts, e2e/tasks.spec.ts, e2e/projects.spec.ts all import `login` from `./helpers` and call `await login(page)` which performs a UI form fill (`page.goto('/login')`, fill inputs, click submit). The CLAUDE.md repo convention is explicit: 'Auth via API (never UI login in tests) using storage states in playwright/.auth/'. These specs run under the `chromium` Playwright project (no storageState dependency), meaning they hit the login throttle bucket on every run, are slower, and couple test setup to UI changes.

**Root cause:**
These specs predate the auth.setup.ts/storageState pattern and were never migrated.

**Code evidence:**
```
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Full User Workflow", () => {
  test("complete workflow: login → dashboard → projects → tasks", async ({
    page,
  }) => {
    // 1. Login
    await login(page);
```

**Suggested fix:**
Migrate each spec to the `e2e/tests/` directory, import from `../../fixtures/test-fixtures` (which provides the `asRole` fixture and storageState), and remove the `login()` call. The `chromium` project in playwright.config.ts has no dependencies — these specs bypass the `setup` project entirely.

**Acceptance criteria:**
1. No spec under e2e/ (root level) imports from ./helpers
2. CI run of the 5 converted specs does not call POST /auth/login via UI
3. Converted specs pass with the admin storageState
4. Commit message includes `[closes SA-TEST-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'import.*helpers' /home/alex/Documents/REPO/ORCHESTRA/e2e --include='*.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-001` to avoid ID collision with the primary run; original id `TEST-001` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-002, TEST-003.
- Audit note: The helpers.ts login uses hardcoded credentials admin/admin123. The 5 affected files: e2e/full-workflow.spec.ts, e2e/planning.spec.ts, e2e/leaves.spec.ts, e2e/tasks.spec.ts, e2e/projects.spec.ts.

**Closed_by:** (empty — TODO)

---

### SA-PERF-023 — All app pages are 'use client' — no RSC, no TanStack Query, no incremental hydration

- **Status:** TODO
- **Phase:** 2
- **Cluster:** T
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · frontend-bundle
- **File:** `apps/web/app/[locale]/dashboard/page.tsx:1`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-023` · audit-confidence: high · found_by: performance

**Description:**
Every page in the App Router (dashboard, projects, tasks, leaves, and so on) is marked 'use client' and uses useEffect + useState for data fetching. This means the full JS bundle is shipped to the client on every navigation, no static or server-side rendering is used, and the page is blank until the client-side useEffect fires and the API response returns. TanStack Query is installed (in package.json via QueryProvider) but is not used in any page component for data fetching — all pages use useEffect + useState + direct service calls.

**Root cause:**
The frontend was built in a client-first pattern without adopting Server Components or TanStack Query's cache. The App Router's streaming/RSC capability is unused.

**Code evidence:**
```
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
```

**Suggested fix:**
Migrate data-fetching pages to use TanStack Query's useQuery hooks (already installed) for automatic caching, background refetch, and loading states. For static content (user list, departments), use RSC with server-side Prisma calls. At minimum, wrap the main data fetches in useQuery instead of useEffect+setState.

**Acceptance criteria:**
1. At least one high-traffic page (dashboard or projects) uses useQuery for data fetching
2. No page uses useEffect+setState for primary data fetching when TanStack Query is available
3. Commit message includes `[closes SA-PERF-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'useQuery\|useMutation' apps/web/src/ apps/web/app/ | grep -v node_modules | wc -l
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-023` to avoid ID collision with the primary run; original id `PERF-023` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: QueryProvider is correctly set up (apps/web/src/components/QueryProvider.tsx) but appears unused by actual page components.

**Closed_by:** (empty — TODO)

---

### SA-DAT-003 — LeaveTypeConfig.remove() checks only leaves count — silently cascade-deletes LeaveBalance rows

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · cascade_on_delete
- **File:** `apps/api/src/leave-types/leave-types.service.ts:148-187`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-003` · audit-confidence: high · found_by: data_integrity

**Description:**
The remove() function guards physical deletion by checking whether the LeaveTypeConfig has associated Leave rows (via _count.leaves). If the count is 0, it proceeds to delete. However LeaveBalance has a FK to LeaveTypeConfig with onDelete: Cascade (schema.prisma line 710). A LeaveTypeConfig with zero leaves but non-zero leave_balances (annual entitlement records) will be physically deleted, silently cascade-deleting all the leave_balance rows for all users and the global default for that type. No check for `leaveBalances` count is included.

**Root cause:**
The guard was written for the primary child relation (Leave) but did not extend to the secondary child (LeaveBalance), whose FK carries Cascade instead of Restrict.

**Code evidence:**
```
  async remove(id: string) {
    const existing = await this.prisma.leaveTypeConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leaves: true },
        },
      },
    });
    ...
    if (existing._count.leaves > 0) {
      await this.prisma.leaveTypeConfig.update({
        where: { id },
        data: { isActive: false },
      });
      ...
    }
    await this.prisma.leaveTypeConfig.delete({
      where: { id },
    });
```

**Suggested fix:**
Add `leaveBalances: true` to the _count include in remove(). In the guard block, treat a positive balance count the same as a positive leave count — deactivate instead of delete: `if (existing._count.leaves > 0 || existing._count.leaveBalances > 0) { ... deactivate ... }`. Alternatively change LeaveBalance's FK to Restrict and handle deletion explicitly.

**Acceptance criteria:**
1. Integration test: create a LeaveTypeConfig with 0 leaves but N leave_balances → calling remove() deactivates rather than deletes, and all leave_balances remain
2. psql: after the fix, a direct DELETE on leave_type_configs with referencing balance rows fails with FK violation if Restrict is chosen
3. Commit message includes `[closes SA-DAT-003]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '_count\|leaveBalance\|balance' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leave-types/leave-types.service.ts | head -20
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-003` to avoid ID collision with the primary run; original id `DAT-003` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Schema line 710 confirms onDelete: Cascade on LeaveBalance.leaveType FK. Service line 152-155 selects only _count.leaves. Leave_balance cascade confirmed in migration 20260321105758.

**Closed_by:** (empty — TODO)

---

### SA-DAT-006 — scripts/backup-database.sh produces unencrypted .gz dumps with no restore-verification step

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · backup_strategy
- **File:** `scripts/backup-database.sh:1-55`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-006` · audit-confidence: high · found_by: data_integrity

**Description:**
The repo-tracked backup script calls pg_dump and gzip-compresses the result. No GPG/AES encryption step is applied before writing to disk (confirmed: no mention of gpg, openssl, or ENCRYPT in the file). No restore verification step exists (no pg_restore into a test DB, no row-count assertion). The MEMORY note records that production uses a separate /opt/orchestra/scripts/backup-daily.sh (systemd timer) which is not in this repository tree, so its encryption posture cannot be audited from the repo. The in-repo script is the operator-documented recovery procedure and sets the backup hygiene expectation.

**Root cause:**
The script was written to demonstrate basic pg_dump automation; encryption and verification were not added, which is a common gap in initial backup implementations.

**Code evidence:**
```
docker exec "${CONTAINER_NAME}" pg_dump -U "${DATABASE_USER}" "${DATABASE_NAME}" > "${BACKUP_DIR}/${BACKUP_FILE}"
...
gzip "${BACKUP_DIR}/${BACKUP_FILE}"
...
find "${BACKUP_DIR}" -name "orchestr-a-backup-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
```

**Suggested fix:**
Add GPG symmetric encryption after gzip: `gpg --symmetric --cipher-algo AES256 --batch --passphrase-fd 0 <<< "$BACKUP_KEY" "${BACKUP_FILE}.gz"`. Store BACKUP_KEY in the environment/secret vault, not in the script. Add a smoke restore: `pg_restore --list ${BACKUP_FILE}.gz | wc -l` must be > 0. Alternatively use `pg_dump -Fc` (custom format) which is natively compressed and can be partially verified with `pg_restore --list`.

**Acceptance criteria:**
1. backup-database.sh produces a file that is not readable as plain SQL without a decryption key
2. backup-database.sh exits non-zero if the produced file cannot be listed by pg_restore/gunzip
3. Commit message includes `[closes SA-DAT-006]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'gpg\|openssl\|AES\|encrypt\|restore\|verify' /home/alex/Documents/REPO/ORCHESTRA/scripts/backup-database.sh
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-006` to avoid ID collision with the primary run; original id `DAT-006` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: This finding is scoped strictly to the in-repo script. The prod systemd backup script at /opt/orchestra/scripts/backup-daily.sh is not in this tree; its posture cannot be assessed here.

**Closed_by:** (empty — TODO)

---

### SA-PERF-013 — Analytics cache has no mutation invalidation — stale data served for up to 60s after changes

- **Status:** TODO
- **Phase:** 2
- **Cluster:** —
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing-cache-invalidation
- **File:** `apps/api/src/analytics/analytics.service.ts:23`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-013` · audit-confidence: high · found_by: performance

**Description:**
The analytics cache uses TTL-only eviction (60 seconds) with no mutation-bust hooks. When a task is created, completed, or a project status changes, the analytics page continues to show stale data for up to 60 seconds. The CacheService comment acknowledges this: 'TTL-only eviction (no mutation-bust hooks) within this initial bounded scope (AC#6 forbids touching mutation service paths in this commit).' The AC#6 block may still be active.

**Root cause:**
Cache invalidation was deferred to a future commit (AC#6 constraint) and has not been implemented.

**Code evidence:**
```
/** TTL for analytics cache entries (seconds). Balances freshness vs. Prisma load. */
const ANALYTICS_CACHE_TTL = 60;
```

**Suggested fix:**
Add cache invalidation calls in TasksService.update (status change), ProjectsService.update/archive/unarchive, and LeavesService.approve. Use pattern-delete `cache:analytics:${userId}:*` or a dedicated invalidation key per user-scope.

**Acceptance criteria:**
1. After a task status change, the next analytics request returns fresh data
2. CacheService.del is called with the analytics key on task/project mutations
3. Commit message includes `[closes SA-PERF-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'cache.*analytics\|analytics.*cache\|CacheService' apps/api/src/ | grep -v '.spec.'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-013` to avoid ID collision with the primary run; original id `PERF-013` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: The CacheService comment on line 12 explicitly acknowledges this gap.

**Closed_by:** (empty — TODO)

---

## Phase 3 — Requires-live-verification (capped at important · pending a live check)

### COR-023 — captureSnapshots() uses server-local midnight instead of UTC midnight for deduplication query

- **Status:** TODO
- **Phase:** 3
- **Cluster:** J
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** correctness · date-time
- **File:** `apps/api/src/projects/projects.service.ts:1158-1166`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-023` · audit-confidence: high · found_by: correctness

**Description:**
The schema comment on ProjectSnapshot explicitly states `date stored as startOfDay (midnight UTC)` (@@unique([projectId, date]) // COR-014: DB-level race guard; date stored as startOfDay (midnight UTC)). The deduplication lookup uses `startOfDay.setHours(0, 0, 0, 0)` which sets to server local midnight, not UTC midnight. If the prod server is not in UTC (or its TZ env differs), the `date: startOfDay` query will never match existing rows, causing the `alreadySnapshotted` set to always be empty. This defeats the deduplication check, and every invocation of captureSnapshots() on non-UTC servers will try to insert a new snapshot (relying only on the DB unique constraint's skipDuplicates guard), meaning `captured` always returns 0 (all are skipped by skipDuplicates) but the dedup logic is silently broken.

**Root cause:**
`setHours(0,0,0,0)` resets to local timezone midnight, not UTC midnight, while PostgreSQL stores and compares DateTime columns in UTC.

**Code evidence:**
```
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Batch-fetch existing snapshots for today (1 query)
    const existingToday = await this.prisma.projectSnapshot.findMany({
      where: {
        projectId: { in: projects.map((p) => p.id) },
        date: startOfDay,
      },
```

**Suggested fix:**
Replace `startOfDay.setHours(0, 0, 0, 0)` with UTC-anchored midnight: `startOfDay.setUTCHours(0, 0, 0, 0)`. Also use `setUTCHours` for `now` if it is used for the same day boundary. This aligns the dedup query with what PostgreSQL stored.

**Acceptance criteria:**
1. On a server with TZ=Europe/Paris, running captureSnapshots() twice in the same day returns {captured: 0} on the second call (dedup works)
2. The date stored in project_snapshots equals the UTC midnight of the current day
3. Commit message includes `[closes COR-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'setHours\|setUTCHours' apps/api/src/projects/projects.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-023 ⇄ sessionA COR-001).
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- sessionA COR-001 rated this blocking; capped to important here — the blocking data-corruption impact is deploy-TZ-conditional and masked on the current UTC prod host.

**Closed_by:** (empty — TODO)

---

### SEC-032 — nginx forwards client-supplied X-Forwarded-Proto ($http_x_forwarded_proto) instead of $scheme, enabling proto spoofing

- **Status:** TODO
- **Phase:** 3
- **Cluster:** L
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** security · Header injection / Proxy header spoofing
- **File:** `nginx/nginx.conf:131`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-032` · audit-confidence: high · found_by: security

**Description:**
Both the /api and / location blocks forward the X-Forwarded-Proto header using `$http_x_forwarded_proto` — the value of the incoming request's header — rather than `$scheme` (nginx's own connection scheme). If this nginx instance is the edge proxy (or if the upstream host-level proxy doesn't strip the header), a client can send `X-Forwarded-Proto: https` on an HTTP request and the backend will believe the connection is HTTPS. This can bypass HTTPS-required guards, influence redirect generation, and affect cookie Secure flag logic based on the detected protocol.

**Root cause:**
The variable `$http_x_forwarded_proto` reflects the client-supplied header value without sanitization; `$scheme` would reflect the actual nginx-to-backend transport (and the outer proxy, if real, should set the canonical value before forwarding).

**Code evidence:**
```
            proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
```

**Suggested fix:**
Replace `$http_x_forwarded_proto` with `$scheme` in both location blocks:
ʼʼʼnginx
proxy_set_header X-Forwarded-Proto $scheme;
ʼʼʼ
If there IS a host-level proxy doing TLS termination and setting X-Forwarded-Proto, the inner nginx should OVERWRITE the header with `$scheme` (the value seen by inner nginx), not blindly forward what the outer chain sent — the correct value will be set by the TLS-terminating proxy upstream.

**Acceptance criteria:**
1. curl -H 'X-Forwarded-Proto: https' http://orchestr-a.com/api/health does not result in backend receiving X-Forwarded-Proto: https when the actual connection is HTTP
2. nginx config uses $scheme for X-Forwarded-Proto on both /api and / locations
3. Commit message includes `[closes SEC-032]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: grep 'X-Forwarded-Proto' nginx/nginx.conf
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-032 ⇄ sessionA SEC-015).
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: Adversarial review confirmed: nginx.conf line 131 (location /api) and line 182 (location /) both use `$http_x_forwarded_proto`. The trust-proxy config (apps/api/src/common/fastify/trust-proxy.config.ts) scopes trust to loopback+uniquelocal only, which correctly prevents IP spoofing from public networks, but does not mitigate the proto-spoofing issue since the client header is forwarded as-is by nginx before reaching Fastify.

**Closed_by:** (empty — TODO)

---

### SEC-033 — No Strict-Transport-Security header emitted by nginx, web middleware, or API helmet

- **Status:** TODO
- **Phase:** 3
- **Cluster:** L
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** security · TLS / HSTS
- **File:** `nginx/nginx.conf:96-106`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-033` · audit-confidence: high · found_by: security

**Description:**
The server block in nginx.conf emits five security headers but omits Strict-Transport-Security (HSTS). The web middleware (apps/web/middleware.ts) emits only CSP. The API helmet configuration in main.ts does not explicitly set HSTS options. Without HSTS, browsers will not upgrade future HTTP requests to HTTPS automatically, leaving users vulnerable to SSL-stripping attacks even after the TLS block is added (finding INFRA-1).

**Root cause:**
HSTS was not included in the security headers block when the nginx config was authored.

**Code evidence:**
```
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

**Suggested fix:**
Add `add_header Strict-Transport-Security 'max-age=63072000; includeSubDomains; preload' always;` to the HTTPS server block in nginx.conf. Do NOT set it on the HTTP-only block (would violate RFC 6797 requirement that HSTS only be sent over TLS). Optionally add it to the helmet configuration in main.ts with `{ strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true } }`.

**Acceptance criteria:**
1. curl -I https://orchestr-a.com returns Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
2. HTTP-only responses do not include HSTS header
3. Commit message includes `[closes SEC-033]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -sI https://orchestr-a.com | grep -i strict-transport
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-033 ⇄ sessionA SEC-013).
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: Adversarial review confirmed: nginx.conf lines 96-106 code evidence matches verbatim. The @fastify/helmet registration in main.ts (lines 135-144) does not include strictTransportSecurity options. apps/web/src/lib/csp.ts buildCsp() only emits CSP directives, no HSTS. No HSTS header anywhere in the shipped codebase.

**Closed_by:** (empty — TODO)

---

### DAT-014 — 25 CREATE INDEX statements in dat011_fk_indexes run without CONCURRENTLY — ACCESS EXCLUSIVE lock on every indexed table

- **Status:** TODO
- **Phase:** 3
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** data_integrity · lock_risk_no_concurrently
- **File:** `packages/database/prisma/migrations/20260603115724_dat011_fk_indexes/migration.sql:1-74`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-014` · audit-confidence: high · found_by: data_integrity

**Description:**
All 25 CREATE INDEX statements in this migration (finding originally counted 18, actual count is 25 from grep) use the standard (blocking) form without CONCURRENTLY. PostgreSQL acquires an ACCESS EXCLUSIVE lock for the duration of the index build, which blocks all concurrent reads and writes to the affected table. This migration touches high-traffic tables: comments, documents, events, projects, milestones, password_reset_tokens, predefined_task_recurring_rules, predefined_tasks, services, holidays, leave_validation_delegates, leaves, epics. On a live production database with millions of rows in any of these tables, the migration will cause a complete read+write outage for each table in sequence. Prisma wraps migrations in a transaction, so CONCURRENTLY cannot be used directly — the comment in dat015 acknowledges this pattern — but the risk on large tables remains unmitigated.

**Root cause:**
All CREATE INDEX statements are non-concurrent, taking ACCESS EXCLUSIVE table locks; acceptable in a small dev DB but causes outages on large production tables.

**Code evidence:**
```
-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "comments"("taskId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "departments_managerId_idx" ON "departments"("managerId");

-- CreateIndex
CREATE INDEX "documents_projectId_idx" ON "documents"("projectId");
```

**Suggested fix:**
For production deployments, run each CREATE INDEX CONCURRENTLY in a separate migration (or using a custom migration runner outside a transaction). Prisma cannot use CONCURRENTLY inside its default transactional migration wrapper; a workaround is to mark the migration as non-transactional in its migration.sql (add `-- No transaction` at the top for Prisma v3+ with the `--skip-generate` flag, or use a custom migration script). Alternatively, accept the lock window if tables are small and document the maintenance window requirement.

**Acceptance criteria:**
1. Either each index is built CONCURRENTLY in a separate non-transactional migration, or the prod deployment runbook documents a maintenance window for this migration
2. No production requests are dropped or timeout due to table locks during the migration
3. Commit message includes `[closes DAT-014]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE indexname IN ('comments_taskId_idx','documents_projectId_idx','projects_createdById_idx') AND schemaname='public'; -- verify indexes exist after migration
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: CONFIRMED. Code evidence verbatim present. Migration file has 25 CREATE INDEX statements (finding title said '18' — minor count error, does not affect validity of finding). No CONCURRENTLY keyword and no '-- No transaction' directive present anywhere in the migration. The same pattern recurs in per010, per011, per012, per013, dat029 migrations. Flagged once here at the first occurrence (dat011). The dat015 migration itself explicitly notes 'NOTE: not CONCURRENTLY — migrations run inside a transaction', confirming this is a known constraint but not addressing the lock risk on large tables.

**Closed_by:** (empty — TODO)

---

### OBS-001 — AUDIT_HASH_KEY never set in CI — API cannot boot in E2E jobs

- **Status:** TODO
- **Phase:** 3
- **Cluster:** K
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important (capped from `blocking`)
- **Live-gated:** requires-live-verification
- **Category:** observability · ci-boot-failure
- **File:** `.github/workflows/ci.yml:262-273`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-001` · audit-confidence: high · found_by: observability

**Description:**
apps/api/src/main.ts calls assertAuditHashKey(process.env.AUDIT_HASH_KEY) at line 69 unconditionally — enforced in ALL environments, not just production. audit-hash-key.ts throws if the key is absent or shorter than 32 chars. The e2e-smoke and e2e-tests jobs in ci.yml both start the API (pnpm --filter api start) without AUDIT_HASH_KEY in the environment. The API will throw on bootstrap and never reach the health endpoint, so the timeout-based readiness probe will expire, causing the jobs to fail.

**Root cause:**
assertAuditHashKey is enforced universally (intentional by OBS-028 design), but the CI e2e job environment blocks were never updated to provide a non-production test value for AUDIT_HASH_KEY.

**Code evidence:**
```
      - name: Start Backend API
        run: |
          pnpm --filter api start > /tmp/api.log 2>&1 &
          echo "Waiting for API to be ready..."
          timeout 60 bash -c 'until curl -f http://localhost:4000/api/health 2>/dev/null; do sleep 2; done'
        env:
          DATABASE_URL: postgresql://orchestr_a:orchestr_a_dev_password@localhost:5432/orchestr_a_v2_e2e
          JWT_SECRET: test-jwt-secret-key
          REDIS_URL: redis://localhost:6379
          PORT: 4000
          ALLOWED_ORIGINS: http://localhost:3000
          TZ: Europe/Paris
```

**Suggested fix:**
Add AUDIT_HASH_KEY to the env block of every 'Start Backend API' step in both e2e-smoke and e2e-tests jobs, using a stable but non-secret test value of at least 32 chars. Example: AUDIT_HASH_KEY: 'ci-test-audit-hash-key-32-chars!!'. Also add it to the Build Applications step in case the build exercises any boot-path code.

**Acceptance criteria:**
1. E2E smoke and full e2e jobs complete without the 60-second API readiness timeout expiring
2. assertAuditHashKey receives a value >= 32 chars in all CI steps that start the API
3. The fix uses a dedicated CI-only key, not a production secret
4. Commit message includes `[closes OBS-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'AUDIT_HASH_KEY' .github/workflows/ci.yml
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Blocking→important: the static defect (AUDIT_HASH_KEY absent from .github/workflows/ci.yml) is real, but the 'API cannot boot in E2E' consequence is a CI-runtime claim. Related: SEC-002 (same root cause), SA-OBS-013 (prod env template).
- Related (same run): SEC-002.
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. (1) assertAuditHashKey at main.ts:69 is unconditional — verified verbatim. (2) audit-hash-key.ts throws when key is absent or <32 chars — verified verbatim. (3) grep -n AUDIT_HASH_KEY .github/workflows/ci.yml returns ZERO hits across the entire file. (4) Both e2e-smoke (line 262-273) and e2e-tests (line 397-408) 'Start Backend API' env blocks confirmed missing AUDIT_HASH_KEY. No mitigation found: no AUDIT_HASH_KEY in any env context of ci.yml. Finding stands at severity=blocking.

**Closed_by:** (empty — TODO)

---

### SEC-002 — CI e2e-smoke and e2e-tests jobs start the API without AUDIT_HASH_KEY, causing assertAuditHashKey() to abort in all environments

- **Status:** TODO
- **Phase:** 3
- **Cluster:** K
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** security · Missing AUDIT_HASH_KEY in CI — E2E API startup will crash
- **File:** `.github/workflows/ci.yml:263-272`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-002` · audit-confidence: high · found_by: security

**Description:**
Both `e2e-smoke` and `e2e-tests` CI jobs start the API server without setting the `AUDIT_HASH_KEY` environment variable. The `assertAuditHashKey()` function in main.ts is enforced in ALL environments (not just production) and will throw an Error if `AUDIT_HASH_KEY` is absent or shorter than 32 characters. This means both E2E jobs fail silently (the API crashes immediately, the `curl` healthcheck loop times out after 60 seconds, and E2E tests never run). The security gate — correct — but its absence from CI blocks E2E test coverage.

**Root cause:**
The AUDIT_HASH_KEY requirement was added as a universal (non-prod-gated) boot assertion, but the CI workflow was not updated to provide the variable in E2E startup steps.

**Code evidence:**
```
      - name: Start Backend API
        run: |
          pnpm --filter api start > /tmp/api.log 2>&1 &
          echo "Waiting for API to be ready..."
          timeout 60 bash -c 'until curl -f http://localhost:4000/api/health 2>/dev/null; do sleep 2; done'
        env:
          DATABASE_URL: postgresql://orchestr_a:orchestr_a_dev_password@localhost:5432/orchestr_a_v2_e2e
          JWT_SECRET: test-jwt-secret-key
          REDIS_URL: redis://localhost:6379
          PORT: 4000
          ALLOWED_ORIGINS: http://localhost:3000
          TZ: Europe/Paris
```

**Suggested fix:**
Add `AUDIT_HASH_KEY: a-32-char-or-longer-test-audit-hash-key` to the `env:` block of every 'Start Backend API' step in ci.yml (both e2e-smoke and e2e-tests jobs). Use a 32+ character test value; it is not a secret in this context (it protects the audit trail HMAC, and the test DB is ephemeral).

**Acceptance criteria:**
1. Both e2e-smoke and e2e-tests jobs in CI successfully start the API (healthcheck passes within 60s)
2. AUDIT_HASH_KEY is present and >= 32 chars in all 'Start Backend API' env blocks
3. Commit message includes `[closes SEC-002]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -A 15 'Start Backend API' .github/workflows/ci.yml | grep AUDIT_HASH_KEY
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: Adversarial review confirmed: ci.yml lines 262-273 (e2e-smoke) and lines 397-408 (e2e-tests) both confirmed to have identical env blocks missing AUDIT_HASH_KEY. assertAuditHashKey() in apps/api/src/common/config/audit-hash-key.ts confirmed to run in ALL environments unconditionally (no NODE_ENV check). The api will throw 'AUDIT_HASH_KEY must be set and at least 32 characters' at boot, preventing the healthcheck from ever succeeding within the 60s timeout.

**Closed_by:** (empty — TODO)

---

### SEC-001 — Committed nginx.conf has no :443 TLS block; live TLS is terminated by an out-of-repo host nginx (IaC drift) and HSTS is absent

- **Status:** TODO
- **Phase:** 3
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important
- **Live-gated:** requires-live-verification
- **Category:** security · TLS / HTTPS
- **File:** `nginx/nginx.conf:87-194`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-001` · audit-confidence: high · found_by: security

**Description:**
The nginx configuration defines only a single HTTP server block listening on port 80. docker-compose.prod.yml publishes port 443 (`"${HTTPS_PORT:-443}:443"`) and mounts certbot certificates (`certbot_certs:/etc/nginx/ssl:ro`), but nginx.conf has no corresponding `listen 443 ssl` block, no TLS directives, no HTTP-to-HTTPS redirect, and no HSTS header. Port 443 in production will silently refuse connections (TCP RST or hang) while all traffic runs over plaintext HTTP, rendering in-transit encryption entirely absent.

**Root cause:**
The nginx.conf was written with a comment stating 'behind host nginx SSL proxy', but TLS termination is never actually configured either in this file or verifiably in any other shipped artifact.

**Code evidence:**
```
    server {
        listen 80;
        server_name orchestr-a.com www.orchestr-a.com _;

        # ACME challenge for Let's Encrypt
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
```

**Suggested fix:**
(1) Add 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;' to the :443 server. (2) Bring the host nginx TLS terminator into version control / IaC (or move the 443+certbot config into the committed nginx.conf and publish 443 from the container) so the edge is reproducible and reviewable. (3) Confirm TLSv1/1.1 are effectively disabled (live http-context ssl_protocols still lists them; certbot include sets 1.2/1.3).

**Acceptance criteria:**
1. nginx -t passes with HTTPS server block
2. HTTP requests to port 80 return 301 redirect to https://
3. curl -I https://orchestr-a.com returns 200 with Strict-Transport-Security header
4. curl -I http://orchestr-a.com returns 301
5. Commit message includes `[closes SEC-001]`.
6. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -sSI --resolve orchestr-a.com:443:92.222.35.25 https://orchestr-a.com/ | grep -i strict-transport-security  # expect HSTS header present after fix
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Downgraded blocking→important after read-only live verification (audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md). Reframed residue: (1) HSTS missing; (2) TLS terminator is out-of-repo host nginx (IaC drift, unreviewable); (3) weak ssl_protocols floor (live http-context still lists TLSv1/1.1). The committed nginx.conf genuinely has no :443 block, but it is the inner container behind the host TLS edge.
- Related (same run): SEC-033, SEC-032.
- Audit note: Downgraded blocking->important after read-only live verification (operator-approved in-place patch). Evidence: audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md. Live: certbot.timer active, http->https 301, valid LE cert; the committed nginx.conf genuinely lacks a 443 block (code_evidence still accurate) but is the inner container behind the host TLS terminator.

**Closed_by:** (empty — TODO)

---

### TST-001 — clients.spec.ts Suite 6 asserts HTTP 200 for contributeur on GET /api/clients, contradicting the permission matrix and the generated INTERDIT test

- **Status:** TODO
- **Phase:** 3
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟠 important (capped from `blocking`)
- **Live-gated:** requires-live-verification
- **Category:** tests · matrix-contradiction
- **File:** `e2e/clients.spec.ts:657-680`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-001` · audit-confidence: high · found_by: tests

**Description:**
Suite 6 includes `contributeur` in the allRoles array and asserts `expect(res.status()).toBe(200)` for it. However, the permission matrix (permission-matrix.ts line 579) places `contributeur` in `deniedRoles` for `clients:read` / GET /api/clients. The matrix is authoritative: BASIC_USER template (bound to `contributeur` in seed) does NOT include `clients:read` — that permission is part of `PROJECT_STRUCTURE_READ` which BASIC_USER does not receive (it uses only `COMMON_BASE + STANDARD_SELF_SERVICE`). The auto-generated test in api-permissions.spec.ts therefore generates an [INTERDIT] test asserting 403 for the same role+endpoint. Both suites run during a full `pnpm test:e2e`, and exactly one will fail. The blocking severity reflects that the contradiction guarantees a permanent test failure.

**Root cause:**
Suite 6 was written with the incorrect assumption that all roles can read clients; the actual RBAC template for BASIC_USER excludes PROJECT_STRUCTURE_READ (which contains clients:read).

**Code evidence:**
```
test.describe("Clients — Lecture autorisée pour tous les rôles", () => {
  const allRoles: Role[] = [
    "admin",
    "responsable",
    "manager",
    "referent",
    "contributeur",
    "observateur",
  ];

  for (const role of allRoles) {
    test(`GET /api/clients — 200 pour ${role}`, async ({ request }) => {
```

**Suggested fix:**
Remove `contributeur` from the allRoles array in Suite 6. The corrected array should be `['admin', 'responsable', 'manager', 'referent', 'observateur']` — matching the `allowedRoles` in the permission matrix for `clients:read`. Optionally add a separate denial test for `contributeur` expecting 403.

**Acceptance criteria:**
1. Suite 6 allRoles does not include 'contributeur'
2. Running pnpm test:e2e produces zero failures on the GET /api/clients — 200 pour contributeur test
3. The api-permissions.spec.ts [INTERDIT] test for clients:read/contributeur passes with 403
4. Commit message includes `[closes TST-001]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -A20 'Lecture autorisée pour tous les rôles' e2e/clients.spec.ts | grep contributeur
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Blocking→important: the assertion contradicting the permission matrix is statically visible, but whether it FAILS (test wrong vs endpoint over-permissive) is only realized when the e2e suite runs.
- Audit note: Cross-verified against packages/rbac/templates.ts lines 887-894 (BASIC_USER = compose(COMMON_BASE, STANDARD_SELF_SERVICE)) and packages/rbac/atomic-permissions.ts lines 224-233 (PROJECT_STRUCTURE_READ includes clients:read; BASIC_USER does not receive PROJECT_STRUCTURE_READ). Matrix comment at line 559 explicitly states 'PAS contributeur (BASIC_USER ne l'a pas)'. VERIFIED: code_evidence verbatim confirmed in e2e/clients.spec.ts lines 657-680. permission-matrix.ts line 586 confirms deniedRoles: ["contributeur"] for GET /api/clients. RBAC chain independently verified: templates.ts:1049 CONTRIBUT … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### SEC-063 — nginx sets X-Frame-Options: SAMEORIGIN but CSP sets frame-ancestors: 'none' — conflicting framing policies

- **Status:** TODO
- **Phase:** 3
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** requires-live-verification
- **Category:** security · Inconsistent framing policy
- **File:** `nginx/nginx.conf:102`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-063` · audit-confidence: high · found_by: security

**Description:**
The nginx server block emits `X-Frame-Options: SAMEORIGIN` for the `/` (frontend) location. The Next.js CSP middleware (`apps/web/src/lib/csp.ts`) emits `frame-ancestors 'none'` in the Content-Security-Policy response header. Modern browsers honor `frame-ancestors` (CSP level 2) over `X-Frame-Options` when both are present, so the effective policy is `frame-ancestors 'none'` (no embedding allowed). However, `X-Frame-Options: SAMEORIGIN` remains in the response and contradicts the CSP. This creates auditor confusion, may cause issues with legacy browsers that only honor XFO, and the two headers together could interact unexpectedly with some proxy/WAF configurations.

**Root cause:**
The nginx headers were authored before or independently of the CSP middleware implementation, and the two were never reconciled.

**Code evidence:**
```
        add_header X-Frame-Options "SAMEORIGIN" always;
```

**Suggested fix:**
Align the policies. If the intent is 'no framing' (as expressed by `frame-ancestors 'none'`), change nginx to `add_header X-Frame-Options "DENY" always;` or remove it entirely (since frame-ancestors supersedes XFO in modern browsers). Do NOT change the CSP middleware.

**Acceptance criteria:**
1. X-Frame-Options value in nginx is either DENY or absent
2. CSP frame-ancestors: 'none' remains in the web middleware
3. Commit message includes `[closes SEC-063]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -sI http://localhost/ | grep -iE 'x-frame-options|content-security-policy'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: Adversarial review confirmed: nginx.conf line 102 code evidence matches verbatim. apps/web/src/lib/csp.ts line 23 confirmed to have `frame-ancestors 'none'` in buildCsp(). The /_next/static location block (nginx.conf line 161) also sets `X-Frame-Options: SAMEORIGIN` with the same inconsistency. The conflict is real and the CSP module correctly uses frame-ancestors 'none', making XFO SAMEORIGIN the weaker stray header.

**Closed_by:** (empty — TODO)

---

### SEC-064 — nginx rate limiting applies only to /api — frontend / and /_next/static locations are unthrottled

- **Status:** TODO
- **Phase:** 3
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** requires-live-verification
- **Category:** security · Rate limiting coverage
- **File:** `nginx/nginx.conf:174-193`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-064` · audit-confidence: high · found_by: security

**Description:**
The nginx `limit_req` and `limit_conn` directives are defined for the `/api` location block only (lines 121-122). The frontend (`location /`) and static asset (`location /_next/static`) locations have no rate limiting. An attacker can flood the Next.js web process with unbounded requests. While Next.js itself is statically served for most pages, SSR routes and API proxy calls are still processed per-request by the web container.

**Root cause:**
Rate limiting was scoped to the API backend only, under the assumption that the frontend is static. Next.js SSR routes are not static and can consume significant server resources per request.

**Code evidence:**
```
        location / {
            proxy_pass http://web_backend;
            proxy_http_version 1.1;

            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
```

**Suggested fix:**
Add a separate rate limit zone for the web frontend and apply it to `location /`:
ʼʼʼnginx
limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;
# ...
location / {
    limit_req zone=web_limit burst=100 nodelay;
    ...
}
ʼʼʼ
The rate can be higher than the API (30r/s vs 10r/s) to accommodate normal browsing patterns.

**Acceptance criteria:**
1. nginx.conf defines a rate limit zone for the web frontend
2. location / applies limit_req from that zone
3. Commit message includes `[closes SEC-064]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'limit_req' nginx/nginx.conf
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: Adversarial review confirmed: nginx.conf defines limit_req_zone (line 68) and limit_conn_zone (line 69). location /api applies both (lines 121-122). location / (lines 174-193) and location /_next/static (lines 153-169) have no limit_req or limit_conn directives. Code evidence for lines 174-193 matches verbatim.

**Closed_by:** (empty — TODO)

---

### SA-OBS-013 — AUDIT_HASH_KEY is absent from .env.production.example and from init-env.sh output

- **Status:** TODO
- **Phase:** 3
- **Cluster:** R
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** requires-live-verification
- **Category:** observability · env-template-gap
- **File:** `.env.production.example:1-105`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-013` · audit-confidence: high · found_by: observability

**Description:**
main.ts:69 calls assertAuditHashKey(process.env.AUDIT_HASH_KEY) which refuses to boot in any environment without it. docker-compose.prod.yml:127 passes it as a required variable (AUDIT_HASH_KEY: ${AUDIT_HASH_KEY:?AUDIT_HASH_KEY is required}). However, .env.production.example has no AUDIT_HASH_KEY entry, and scripts/init-env.sh does not generate one — it only generates DATABASE_PASSWORD, REDIS_PASSWORD, and JWT_SECRET. An operator following the documented setup path (copy .env.production.example, or run init-env.sh) will produce a file missing this required variable, causing an immediate boot failure with a cryptic error. The .env.example (dev template) does include AUDIT_HASH_KEY=.

**Root cause:**
.env.production.example was not updated when OBS-028 added the AUDIT_HASH_KEY boot assertion.

**Code evidence:**
```
# ┌──────────────────────────────────────────────────────────────────────────────┐
# │ SECRETS [REQUIRED]                                                           │
# └──────────────────────────────────────────────────────────────────────────────┘
DATABASE_PASSWORD=
# ... REDIS_PASSWORD=, JWT_SECRET= ...
# (AUDIT_HASH_KEY is NOT present in this file)
```

**Suggested fix:**
Add `AUDIT_HASH_KEY=` to the SECRETS section of .env.production.example with a comment matching the one in .env.example ('Keys the HMAC that pseudonymises attempted-login identifiers — min 32 chars, stable across deploys'). Add AUDIT_HASH_KEY=$(generate_secret 32) to scripts/init-env.sh between JWT_SECRET and CORS_ORIGIN generation.

**Acceptance criteria:**
1. .env.production.example contains AUDIT_HASH_KEY in the SECRETS section
2. scripts/init-env.sh generates and writes AUDIT_HASH_KEY to the output file
3. Commit message includes `[closes SA-OBS-013]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep 'AUDIT_HASH_KEY' /home/alex/Documents/REPO/ORCHESTRA/.env.production.example /home/alex/Documents/REPO/ORCHESTRA/scripts/init-env.sh
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-013` to avoid ID collision with the primary run; original id `OBS-013` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Audit note: docker-compose.prod.yml:127 already has the correct :? guard; the gap is only in the template files used during operator setup.

**Closed_by:** (empty — TODO)

---

### SA-SEC-014 — docker-compose.prod.yml uses deprecated ALLOWED_ORIGINS env var instead of canonical CORS_ORIGIN

- **Status:** TODO
- **Phase:** 3
- **Cluster:** R
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** requires-live-verification
- **Category:** security · configuration
- **File:** `docker-compose.prod.yml:130`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-014` · audit-confidence: high · found_by: security

**Description:**
The production compose file passes ALLOWED_ORIGINS to the API container, but the canonical variable name is CORS_ORIGIN as documented in .env.production.example and cors.config.ts (which reads CORS_ORIGIN first, ALLOWED_ORIGINS as deprecated alias). An operator who sets only CORS_ORIGIN (following .env.production.example instructions) will trigger the required-boot assertion error because docker-compose.prod.yml demands ALLOWED_ORIGINS be set. This creates a confusing, inconsistent operator interface.

**Root cause:**
docker-compose.prod.yml was not updated when CORS_ORIGIN was established as the canonical variable in SEC-012.

**Code evidence:**
```
      # CORS
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}
```

**Suggested fix:**
Update docker-compose.prod.yml line 130 to: `CORS_ORIGIN: ${CORS_ORIGIN:-${ALLOWED_ORIGINS}}` to accept both, or migrate exclusively to `CORS_ORIGIN: ${CORS_ORIGIN:?CORS_ORIGIN is required}`.

**Acceptance criteria:**
1. docker-compose.prod.yml uses CORS_ORIGIN as the primary variable name
2. Commit message includes `[closes SA-SEC-014]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'CORS_ORIGIN\|ALLOWED_ORIGINS' docker-compose.prod.yml .env.production.example
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-014` to avoid ID collision with the primary run; original id `SEC-014` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.

**Closed_by:** (empty — TODO)

---

### SA-SEC-018 — JWT_ACCESS_TTL undocumented in prod template — effective access token TTL is 7d not 15m as SEC-019 assumes

- **Status:** TODO
- **Phase:** 3
- **Cluster:** R
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** requires-live-verification
- **Category:** security · configuration
- **File:** `.env.production.example:60`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-018` · audit-confidence: high · found_by: security

**Description:**
The .env.production.example sets JWT_EXPIRES_IN=7d without defining JWT_ACCESS_TTL. The auth.service.ts getAccessTtl() function resolves: JWT_ACCESS_TTL || JWT_EXPIRES_IN || '15m'. In production, this resolves to 7d as the access token TTL. Several security code comments assert '15min access TTL' (e.g., jwt-not-before.service.ts:33: 'the 15-min access TTL caps the residual exposure') — those comments are incorrect for the default production config. The security model of SEC-001/SEC-002 (and the nbf fail-open logic) assumes short-lived access tokens; with 7d TTLs the fail-open on Redis error means tokens are valid for 7 days even if Redis is down.

**Root cause:**
JWT_ACCESS_TTL was added as a more granular control but not set in the production template; JWT_EXPIRES_IN was intended as the refresh token TTL but doubles as the access token TTL due to the fallback chain.

**Code evidence:**
```
# JWT token validity (formats: 1h, 8h, 1d, 7d, 30d)
JWT_EXPIRES_IN=7d
```

**Suggested fix:**
Add `JWT_ACCESS_TTL=15m` (or 1h for a balance) to .env.production.example and docker-compose.prod.yml, separate from JWT_REFRESH_TTL=7d. Update code comments referencing the '15min' assumption.

**Acceptance criteria:**
1. JWT_ACCESS_TTL is set independently in .env.production.example
2. JWT_EXPIRES_IN is used solely as the refresh token TTL or removed in favour of JWT_REFRESH_TTL
3. Commit message includes `[closes SA-SEC-018]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'JWT_ACCESS_TTL\|JWT_EXPIRES_IN\|JWT_REFRESH_TTL' .env.production.example docker-compose.prod.yml
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-018` to avoid ID collision with the primary run; original id `SEC-018` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- **requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.
- Related (same run): SEC-001, SEC-002.
- Audit note: docker-compose.prod.yml:121 confirms: JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}. auth.module.ts uses the same fallback chain. No JWT_ACCESS_TTL appears in any prod template.

**Closed_by:** (empty — TODO)

---

## Phase 4 — Nit

### COR-062 — findAll: default limit is 1000 but page default is 1 — no hard cap when limit param is omitted via service default

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · pagination
- **File:** `apps/api/src/tasks/tasks.service.ts:305`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-062` · audit-confidence: high · found_by: correctness

**Description:**
When limit is not provided (undefined), `limit || 1000` evaluates to 1000 and safeLimit is capped at 1000. This is intentional but means any call to findAll() without a limit returns up to 1000 tasks. Combined with the fact that the controller does not enforce a default limit (it passes undefined if not provided), a caller can retrieve 1000 tasks in one request. The findForPlanningOverview path applies a hard cap of 500 but findAll does not have such a comment explaining the 1000 choice. This is a minor concern — not incorrect per se, but the inconsistency between 500 (planning) and 1000 (findAll) warrants documenting.

**Root cause:**
The two query paths use different hard caps without explanation; findAll cap of 1000 is implicit default, not a named constant.

**Code evidence:**
```
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Define a named constant TASKS_HARD_CAP = 1000 (analogous to PLANNING_HARD_CAP = 500), document why different caps exist, and ensure the default is applied at the controller layer too.

**Acceptance criteria:**
1. GET /tasks without limit param returns at most 1000 results
2. The cap constant is documented
3. Commit message includes `[closes COR-062]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'PLANNING_HARD_CAP\|safeLimit\|Math.min' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary COR-062 ⇄ sessionA PERF-002).
- Audit note: comments/comments.service.ts has the same pattern with default 1000.

**Closed_by:** (empty — TODO)

---

### PER-041 — findAll comments uses default limit=1000 — very high default page size

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · over-fetching
- **File:** `apps/api/src/comments/comments.service.ts:59-65`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-041` · audit-confidence: high · found_by: performance

**Description:**
The default `limit` is 1000 in the function signature, and `safeLimit` is capped at 1000. A caller who hits `GET /comments` without pagination parameters receives up to 1000 comment rows. Each row includes `author` and `task` (with `select: { id, title }`). While comment rows are lighter than task rows, 1000 comments in one response is still over-fetching.

**Root cause:**
Overly high default limit of 1000 — should be 20–50.

**Code evidence:**
```
  async findAll(
    page = 1,
    limit = 1000,
    taskId?: string,
    currentUser?: AccessUser,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Change to `limit = 20` and cap at 100: `const safeLimit = Math.min(limit ?? 20, 100);`

**Acceptance criteria:**
1. GET /comments without limit param returns at most 20 items
2. GET /comments?limit=200 is capped at 100
3. Commit message includes `[closes PER-041]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s 'http://localhost:3001/comments' | jq '.meta.limit'
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-041 ⇄ sessionA PERF-022).

**Closed_by:** (empty — TODO)

---

### PER-051 — captureSnapshots fetches ALL active projects with full task/milestone arrays — no pagination

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/api/src/projects/projects.service.ts:1145-1152`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-051` · audit-confidence: medium · found_by: performance

**Description:**
`captureSnapshots` loads ALL active projects at once, each with their full task and milestone arrays. For 500 active projects with an average of 200 tasks and 20 milestones each, this loads 100,000 task rows and 10,000 milestone rows in a single query. The comment credits this as a 2-query optimization (PER-003), which is correct vs. the N+1 it replaced, but the in-memory data volume is unbounded.

**Root cause:**
The snapshot cron job was optimized from N+1 to 2 queries, but the first query has no `take` ceiling, so the entire active-project table is hydrated in one shot.

**Code evidence:**
```
  async captureSnapshots() {
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: {
        tasks: { select: { status: true } },
        milestones: { select: { status: true, dueDate: true } },
      },
    });
```

**Suggested fix:**
Process snapshots in batches (e.g., 100 projects at a time) using cursor-based pagination: `findMany({ where: { status: 'ACTIVE', id: { gt: cursor } }, take: 100, orderBy: { id: 'asc' } })`. Wrap each batch in its own `createMany`. For very large deployments, replace the in-memory task/milestone array with a `task.groupBy` per batch.

**Acceptance criteria:**
1. captureSnapshots processes at most 100 projects per DB round-trip
2. All active projects still receive a snapshot after the refactor
3. Commit message includes `[closes PER-051]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary PER-051 ⇄ sessionA PERF-019).
- Audit note: For the current scale of use (local government, likely < 200 active projects) this is a nit. It becomes blocking above ~500 active projects. Confirmed verbatim at lines 1145-1152.

**Closed_by:** (empty — TODO)

---

### SEC-042 — CreateLeaveDto.reason and ImportLeaveDto.comment lack @MaxLength, allowing oversized free-text storage

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input validation / missing constraint
- **File:** `apps/api/src/leaves/dto/create-leave.dto.ts:74-81`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-042` · audit-confidence: high · found_by: security

**Description:**
The `reason` field in `CreateLeaveDto` (stored as `comment` in the DB) has no `@MaxLength` annotation. The same issue exists for `comment` in `ImportLeaveDto`. ApproveLeaveDto and RejectLeaveDto correctly enforce `@MaxLength(2000)`. Without a consistent ceiling, a caller can submit a very large `reason` string (up to the global 1 MiB body limit), which will be persisted to the `leaves.comment` column. The DB column may have its own length limit (depends on the Prisma schema type), but no application-level guard surfaces a meaningful error before attempting the write.

**Root cause:**
Missing `@MaxLength` decorator on `CreateLeaveDto.reason` and `ImportLeaveDto.comment`.

**Code evidence:**
```
  @ApiProperty({
    description: 'Raison du congé',
    example: "Vacances d'été",
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
```

**Suggested fix:**
Add `@MaxLength(2000)` to `CreateLeaveDto.reason` and `ImportLeaveDto.comment`, consistent with `ApproveLeaveDto.comment` and `RejectLeaveDto.reason`.

**Acceptance criteria:**
1. POST /leaves with `reason` longer than 2000 chars returns HTTP 400.
2. POST /leaves/import with a `comment` longer than 2000 chars on any row returns HTTP 400.
3. Commit message includes `[closes SEC-042]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: POST /leaves with reason=<2001-char string>, expect 400.
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-042 ⇄ sessionA SEC-008).
- Audit note: Also applies to ImportLeaveDto.comment (import-leaves.dto.ts line 55-58). Adversarial review confirmed verbatim: create-leave.dto.ts lines 74-81 for `reason`, import-leaves.dto.ts lines 55-58 for `comment`. No @MaxLength found in either. ApproveLeaveDto/RejectLeaveDto do have @MaxLength(2000) — inconsistency confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-047 — description fields lack @MaxLength on CreateProjectDto, CreateEpicDto, CreateMilestoneDto

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/projects/dto/create-project.dto.ts:28-36`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-047` · audit-confidence: high · found_by: security

**Description:**
The `description` field in CreateProjectDto, CreateEpicDto (line 24-27), and CreateMilestoneDto (line 20-23) is decorated with @IsString @IsOptional but has no @MaxLength constraint. An attacker can submit a multi-megabyte string as a description, which will be stored verbatim in the database and returned in API responses. The global body size limit (bodyLimit in main.ts / Fastify config) is the only backstop. The name fields in the same DTOs correctly have @MaxLength. Same issue in ImportMilestoneDto (name, description, dueDate all lack @MaxLength/@IsDateString).

**Root cause:**
MaxLength constraints were applied to name fields but not to free-text description fields.

**Code evidence:**
```
  @ApiProperty({
    description: 'Description détaillée du projet',
    example:
      "Refonte complète de l'application de gestion RH avec migration vers une architecture moderne",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add `@MaxLength(2000)` (or appropriate limit) to description fields in CreateProjectDto, CreateEpicDto, CreateMilestoneDto. For ImportMilestoneDto, add @MaxLength(200) on name, @MaxLength(2000) on description, and change dueDate from @IsString to @IsDateString.

**Acceptance criteria:**
1. POST /projects with description.length > 2000 returns 400 Bad Request
2. POST /milestones/project/:id/import with oversized name returns 400 Bad Request
3. Commit message includes `[closes SEC-047]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength\|description' apps/api/src/projects/dto/create-project.dto.ts apps/api/src/epics/dto/create-epic.dto.ts apps/api/src/milestones/dto/create-milestone.dto.ts apps/api/src/milestones/dto/import-milestones.dto.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary SEC-047 ⇄ sessionA SEC-006).
- Audit note: Adversarial check: create-project.dto.ts lines 28-36 confirmed verbatim. description field has only @IsString and @IsOptional — no @MaxLength. name field at lines 22-26 correctly has @MaxLength(100). No mitigating constraint found.

**Closed_by:** (empty — TODO)

---

### OBS-021 — generateResetToken() logs PASSWORD_CHANGED (wrong action) — action mislabeling confirmed, non-persistence claim refuted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** G
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · wrong-audit-action-for-reset-token
- **File:** `apps/api/src/auth/auth.service.ts:524-529`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-021` · audit-confidence: medium · found_by: observability

**Description:**
The `generateResetToken()` path calls `auditService.log()` and misclassifies the event as `PASSWORD_CHANGED`. No password was changed at this point — only a reset token was issued. The correct action would be something like `PASSWORD_RESET_TOKEN_ISSUED`. Note: contrary to the original finding description, `auditService.log()` DOES write to `audit_logs` via the DAT-002 dual-write mechanism in AuditService (lines 152-207 of audit.service.ts). The event IS durably persisted but under the wrong action code, which pollutes analytics querying for PASSWORD_CHANGED events.

**Root cause:**
The action code was copied from the `resetPassword()` path without adapting it to the token-issuance event.

**Code evidence:**
```
    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: createdById,
      details: `Password reset token generated for user ${targetUser.id}`, // OBS-027: opaque id, not login
      success: true,
    });
```

**Suggested fix:**
1. Add `PASSWORD_RESET_TOKEN_ISSUED = 'PASSWORD_RESET_TOKEN_ISSUED'` to AuditAction and ENTITY_TYPE_BY_ACTION. 2. Replace the PASSWORD_CHANGED action code in generateResetToken(). Optionally switch to auditPersistence.log() directly to be explicit about intent.

**Acceptance criteria:**
1. After POST /auth/reset-password-token, an audit_logs row with action='PASSWORD_RESET_TOKEN_ISSUED' exists
2. No action='PASSWORD_CHANGED' row is emitted by this path
3. Commit message includes `[closes OBS-021]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'generateResetToken\|PASSWORD_CHANGED\|auditService.log\|auditPersistence' apps/api/src/auth/auth.service.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary OBS-021 ⇄ sessionA OBS-006).
- Audit note: DOWNGRADED from high to medium. Original finding incorrectly stated auditService.log() goes to 'console/SecurityAudit sink only — NOT persisted to audit_logs'. Adversarial verification of audit.service.ts lines 152-207 shows AuditService.log() performs a DAT-002 dual-write: it calls auditPersistence.log() fire-and-forget for every action. ENTITY_TYPE_BY_ACTION[PASSWORD_CHANGED]='User' is defined, so the persistence call succeeds. The event IS durably logged. The mislabeled action code (PASSWORD_CHANGED vs PASSWORD_RESET_TOKEN_ISSUED) is confirmed real and reduces finding to a data-quality/anal … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### TST-009 — expect(res.statusCode).not.toBe(401) in uploads-auth.hook.spec.ts passes on 200/500/404 — intent is ambiguous

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · weak-assertion
- **File:** `apps/api/src/common/fastify/uploads-auth.hook.spec.ts:83-96`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-009` · audit-confidence: high · found_by: tests

**Description:**
The assertion `expect(res.statusCode).not.toBe(401)` on line 95 is a false-safety assertion: it passes on ANY status code other than 401 — including 200, 404, 500, or 400. The comment acknowledges the expected outcome is 404 (Fastify routing returns 404 for OPTIONS with no CORS plugin), but the assertion does not encode this. If the hook were broken in a way that returned 200 (serving the file for a preflight), the test would still pass. While the overall test suite is well-structured and this specific assertion is intentional, pinning the exact expected status (404) would make the test unambiguous and prevent masking a different class of regression.

**Root cause:**
The test author used .not.toBe(401) to express 'the hook did not block this request' but did not pin the concrete expected status returned by the router.

**Code evidence:**
```
it('does NOT 401 a CORS preflight (OPTIONS carries no Bearer) — lets CORS answer', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: AVATAR_URL,
        headers: {
          origin: 'http://localhost:4001',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      // The hook must pass the preflight through (here, with no CORS plugin
      // registered, Fastify routing yields 404 — the point is it is NOT 401).
      expect(res.statusCode).not.toBe(401);
    });
```

**Suggested fix:**
Replace `expect(res.statusCode).not.toBe(401)` with `expect(res.statusCode).toBe(404)` to pin the exact expected behavior (Fastify routing returns 404 for OPTIONS with no CORS plugin registered).

**Acceptance criteria:**
1. The assertion uses .toBe(404) instead of .not.toBe(401)
2. A comment explains why 404 is expected (no CORS plugin, routing falls through)
3. Commit message includes `[closes TST-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'not.toBe(401)' apps/api/src/common/fastify/uploads-auth.hook.spec.ts
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary TST-009 ⇄ sessionA TEST-017).
- Audit note: Adversarial check: `expect(res.statusCode).not.toBe(401)` confirmed verbatim at line 95. The inline comment confirms the author knows the actual value is 404, making the weak assertion deliberate but still technically incorrect. No mitigation elsewhere changes this — the assertion is weaker than it needs to be.

**Closed_by:** (empty — TODO)

---

### TST-010 — describe.skipIf in leaves-balance-gating.int.spec.ts silently disables mutation witness in default CI

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · conditional-skip
- **File:** `apps/api/src/leaves/leaves-balance-gating.int.spec.ts:269-271`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-010` · audit-confidence: high · found_by: tests

**Description:**
The TST-009 mutation witness describe block (lines 271+) is guarded by `describe.skipIf(!runMutationWitness)` where `runMutationWitness = process.env.MUTATION_WITNESS === '1'`. In default CI runs (no env var set), this entire suite is silently skipped. The comment at lines 259-268 explains this is intentional to avoid dirtying the shared ephemeral DB. However, this means the RED→GREEN regression test for the READ COMMITTED overdraw condition never runs in standard `pnpm test:integration`. If the balance-gating serializable isolation is regressed, the mutation witness (the definitive RED test) is not present in the standard CI pipeline.

**Root cause:**
The mutation witness uses real concurrent DB connections that would dirty shared integration DB state, so it was intentionally gated behind an env var. No separate CI job or Makefile target ensures it runs periodically.

**Code evidence:**
```
const runMutationWitness = process.env.MUTATION_WITNESS === '1';

describe.skipIf(!runMutationWitness)(
  'TST-009 MUTATION WITNESS — READ COMMITTED overdraw (RED on broken code)',
```

**Suggested fix:**
Add a dedicated CI job or scheduled test run that sets MUTATION_WITNESS=1. Document the env var in CLAUDE.md or a test/README. Alternatively, run the mutation witness in an isolated DB environment to avoid shared state pollution.

**Acceptance criteria:**
1. A CI step (workflow or script) exists that runs pnpm test:integration with MUTATION_WITNESS=1
2. OR the mutation witness is documented as a required manual step before releasing balance-gating changes
3. Commit message includes `[closes TST-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'MUTATION_WITNESS' .github/workflows/ 2>/dev/null || echo 'Not in CI'
```

**Notes:**
- Cross-validated: independently flagged by both 2026-06-04 runs (primary TST-010 ⇄ sessionA TEST-016).
- Audit note: Adversarial check: grep for MUTATION_WITNESS in .github/workflows/ returns 'Not in CI' — confirmed no CI job exercises this path. Code evidence verbatim confirmed at lines 269-271. The guard is intentional and documented, but the absence of any CI path to exercise it is the confirmed gap.

**Closed_by:** (empty — TODO)

---

### COR-051 — listProjectClients, listTaskAssignees, listProjectMembers return empty list for non-existent parent — should return 404

- **Status:** TODO
- **Phase:** 4
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · missing existence validation
- **File:** `apps/api/src/clients/clients.service.ts:290-298`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-051` · audit-confidence: high · found_by: correctness

**Description:**
`listProjectClients` (clients.service.ts:290), `listTaskAssignees` (third-parties.service.ts:310), and `listProjectMembers` (third-parties.service.ts:323) all skip any existence check on the parent resource. If the `projectId` or `taskId` does not exist, Prisma returns an empty array. The API then returns HTTP 200 with `[]`, which is misleading — a caller cannot distinguish 'the project exists but has no clients' from 'the project does not exist at all'. This violates the REST contract implied by a nested resource route (`/projects/:projectId/clients`).

**Root cause:**
No `findUnique` or `count` check on the parent entity before querying the child join table.

**Code evidence:**
```
  async listProjectClients(projectId: string) {
    return this.prisma.projectClient.findMany({
      where: { projectId },
      include: {
        client: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
```

**Suggested fix:**
Before calling `findMany`, verify the parent exists with `prisma.project.count({ where: { id: projectId } })` and throw NotFoundException if zero. Similarly for task in listTaskAssignees.

**Acceptance criteria:**
1. GET /projects/:projectId/clients with non-existent projectId returns 404
2. GET /tasks/:taskId/third-party-assignees with non-existent taskId returns 404
3. GET /projects/:projectId/third-party-members with non-existent projectId returns 404
4. Commit message includes `[closes COR-051]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'listProjectClients\|listTaskAssignees\|listProjectMembers' apps/api/src/third-parties/third-parties.service.ts apps/api/src/clients/clients.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The same list methods in the same codebase for getClientProjects (line 119) DO correctly check existence first.

**Closed_by:** (empty — TODO)

---

### COR-057 — milestones complete() bypasses project membership authorization check

- **Status:** TODO
- **Phase:** 4
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/milestones/milestones.service.ts:162-168`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-057` · audit-confidence: high · found_by: correctness

**Description:**
The `complete()` method does not perform an `assertProjectMembership` check, unlike `update()` and `remove()`. Any authenticated user with the `milestones:update` permission (required at the controller level) can mark any milestone as COMPLETED regardless of whether they are a member of the project that owns the milestone. The `update()` and `remove()` methods both enforce membership; `complete()` should do the same.

**Root cause:**
The membership guard was added to update() and remove() but not to complete(), creating an inconsistency in authorization enforcement.

**Code evidence:**
```
  async complete(id: string) {
    await this.findOne(id);
    return this.prisma.milestone.update({
      where: { id },
      data: { status: MilestoneStatus.COMPLETED },
    });
  }
```

**Suggested fix:**
Add the same pattern as update()/remove(): accept currentUserId and currentUserRole parameters, call assertProjectMembership() before the update. Also update the controller to pass the current user's id and role code.

**Acceptance criteria:**
1. POST /milestones/:id/complete by a user not in the milestone's project returns 403
2. POST /milestones/:id/complete by a member of the project returns 200
3. Commit message includes `[closes COR-057]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'complete\|assertProjectMembership' apps/api/src/milestones/milestones.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### SEC-056 — PATCH/DELETE recurring-rules/:id routes lack @OwnershipCheck decorator (rely solely on service-layer check)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-ownership-guard
- **File:** `apps/api/src/telework/telework.controller.ts:310-335`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-056` · audit-confidence: high · found_by: security

**Description:**
The PATCH /telework/recurring-rules/:id and DELETE /telework/recurring-rules/:id routes do not carry @OwnershipCheck + OwnershipGuard, unlike the analogous PATCH/:id and DELETE/:id routes for TeleworkSchedule and for TimeEntry (which use @UseGuards(JwtAuthGuard, OwnershipGuard) + @OwnershipCheck). Ownership enforcement for recurring rules is implemented correctly at the service layer (telework.service.ts updateRecurringRule/removeRecurringRule), but there is no declarative guard-level enforcement. This is a defense-in-depth gap: a future refactor could bypass the service check while the lack of guard annotation goes unnoticed.

**Root cause:**
The recurring-rule sub-resource was added after the ownership guard pattern was established for TeleworkSchedule, and the guard decorator was not applied.

**Code evidence:**
```
  @Patch('recurring-rules/:id')
  @RequirePermissions('telework:update')
  @ApiOperation({ summary: 'Modifier une règle de télétravail récurrent' })
  @ApiResponse({ status: 200, description: 'Règle mise à jour' })
  @ApiResponse({ status: 404, description: 'Règle introuvable' })
  updateRecurringRule(
    @Param('id', ParseUUIDPipe) id: string,
```

**Suggested fix:**
Add OwnershipService support for 'teleworkRecurringRule' resource, then annotate both routes:
ʼʼʼtypescript
@Patch('recurring-rules/:id')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@OwnershipCheck({ resource: 'teleworkRecurringRule', bypassPermission: 'telework:manage_any' })
@RequirePermissions('telework:update')
ʼʼʼ
Or, at minimum, document why guard-level ownership is intentionally omitted.

**Acceptance criteria:**
1. PATCH /api/telework/recurring-rules/<other-user-rule-id> by a non-admin user returns HTTP 403.
2. DELETE /api/telework/recurring-rules/<other-user-rule-id> by a non-admin user returns HTTP 403.
3. Commit message includes `[closes SEC-056]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification (service-level check already enforces this; guard absence is a defense-in-depth gap)
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim code verified at telework.controller.ts lines 310-335. OwnershipGuard is a global APP_GUARD (common.module.ts lines 17-20) but is opt-in: it returns true immediately (line 44-46 of ownership.guard.ts) when no @OwnershipCheck metadata is present on the route. The PATCH/DELETE recurring-rules/:id routes have no @OwnershipCheck decorator, so the guard provides no protection there. Service-level check at telework.service.ts lines 785-793 (updateRecurringRule) and 836-843 (removeRecurringRule) correctly enforces ownership. The service-level check is correct; this is defense-in-depth only.

**Closed_by:** (empty — TODO)

---

### COR-053 — update() recurrenceEndDate child-prune runs outside the update transaction, creating a window where pruned children exist alongside a committed new endDate

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business_invariant — recurrenceEndDate prune outside transaction
- **File:** `apps/api/src/events/events.service.ts:543-557`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-053` · audit-confidence: medium · found_by: correctness

**Description:**
The parent event is updated inside `$transaction` (lines 480–535) which commits before this code runs. The child-prune `deleteMany` at lines 551–556 executes as a separate independent write. If the server crashes or is killed between the transaction commit and this write, the DB is left with a parent whose `recurrenceEndDate` has been shortened but whose out-of-range children still exist. Additionally, shortening an end date prunes children but extending it never regenerates them, which may be intentional by design but is undocumented.

**Root cause:**
Child pruning is implemented as a post-transaction side-effect rather than being included inside the $transaction scope at lines 480–535.

**Code evidence:**
```
    // Si recurrenceEndDate est mise à jour sur un événement parent récurrent,
    // supprimer les enfants dont la date dépasse la nouvelle date de fin
    if (
      updateEventDto.recurrenceEndDate &&
      existingEvent.isRecurring &&
      !existingEvent.parentEventId
    ) {
      const newEndDate = new Date(updateEventDto.recurrenceEndDate);
      await this.prisma.event.deleteMany({
        where: {
          parentEventId: id,
          date: { gt: newEndDate },
        },
      });
    }
```

**Suggested fix:**
Move the child `deleteMany` inside the `$transaction` callback (before or after the `tx.event.update`) so all changes are atomic.

**Acceptance criteria:**
1. Simulated crash between update and deleteMany leaves no stale children after recovery
2. The child prune and parent update either both commit or both roll back
3. Commit message includes `[closes COR-053]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'deleteMany\|\$transaction' apps/api/src/events/events.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Extending recurrenceEndDate never regenerates children; this is a separate limitation (not filed as a separate finding — insufficient confidence that this is unintentional vs. out-of-scope). Adversarial check: $transaction closes at line 535 (closing brace of async tx callback + .catch handler). The deleteMany at lines 551-556 executes via `this.prisma.event.deleteMany` (not `tx.event.deleteMany`), confirming it is outside the transaction scope. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-055 — importLeaves catch block resets result.created=0 but not result.skipped — error response reports misleading skipped count after full tx rollback

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · inconsistent_error_reporting
- **File:** `apps/api/src/leaves/leaves.service.ts:3627-3637`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-055` · audit-confidence: high · found_by: correctness

**Description:**
When the $transaction rolls back due to a DB error, `result.created` is reset to 0 (correctly — no rows were persisted). However, `result.skipped` is NOT reset. Skipped rows are those that failed validation before reaching `tx.leave.create` (bad email, unknown leave type, bad dates, overlap). Since the entire transaction rolls back, no rows were persisted — but `result.skipped` retains any non-zero count accumulated before the error. The API caller receives a response like `{created:0, skipped:3, errors:1}` which implies 3 rows were intentionally skipped, when in reality the skipped rows were also 'not imported' because of the rollback. The caller might retry only the 'error' row, not realising they need to re-submit the entire file.

**Root cause:**
The catch block zeroes `result.created` but does not reset `result.skipped` to match the rolled-back reality.

**Code evidence:**
```
    } catch (error) {
      // A leave.create failure (or any unrecoverable DB error) aborts the
      // entire $transaction. Record a single error for the whole batch.
      result.created = 0;
      result.errors++;
      // COR-037 — translate the DB exclusion-constraint violation to a clean message.
      const message = isLeaveOverlapViolation(error)
        ? 'Chevauchement détecté avec un congé approuvé existant'
        : (error as Error).message || 'Erreur inconnue';
      result.errorDetails.push(`Import annulé: ${message}`);
    }
```

**Suggested fix:**
Add `result.skipped = 0;` in the catch block alongside `result.created = 0;`, and clear `result.errorDetails` before pushing the single 'Import annulé' message (to avoid mixing pre-rollback row-level skip details with the global abort message).

**Acceptance criteria:**
1. A batch with 2 skipped rows + 1 DB error returns {created:0, skipped:0, errors:1} after catch
2. The errorDetails array contains only the 'Import annulé' message, not the per-skip messages
3. Commit message includes `[closes COR-055]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Whether errorDetails should also be cleared depends on desired UX — keeping row-level skip details can help the user fix their file even after a rollback. Adversarial check: result.skipped++ increments confirmed inside the $transaction callback at lines 3478, 3490, 3502, 3508, 3524, 3542. Catch block at lines 3627-3637 only resets result.created. Code verbatim confirmed.

**Closed_by:** (empty — TODO)

---

### COR-060 — SettingsService.bulkUpdate performs sequential un-transacted upserts — partial failure leaves inconsistent state

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · non_atomic_bulk_write
- **File:** `apps/api/src/settings/settings.service.ts:270-279`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-060` · audit-confidence: high · found_by: correctness

**Description:**
Each iteration calls `this.update(key, value)` sequentially with an individual `prisma.appSettings.upsert()`. If the N-th key triggers a `BadRequestException` (unknown key) or a DB error, keys 1..N-1 are already committed while keys N..end are not applied. The caller receives an error but has no way to know which keys were applied. This violates the expected atomicity of a 'bulk update' endpoint.

**Root cause:**
No `$transaction` wrapper around the loop; each `upsert` is committed immediately with no rollback on partial failure.

**Code evidence:**
```
  async bulkUpdate(settings: Record<string, unknown>) {
    const results: ParsedSetting[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const result = await this.update(key, value);
      results.push(result);
    }

    return results;
  }
```

**Suggested fix:**
Wrap the loop in a Prisma interactive transaction (`this.prisma.$transaction(async (tx) => { ... })`) so all-or-nothing semantics are enforced. The inner `update()` should accept an optional `tx` context.

**Acceptance criteria:**
1. POST /settings/bulk with [validKey, invalidKey] does not persist validKey if the call as a whole fails
2. POST /settings/bulk with all valid keys persists all updates atomically
3. Commit message includes `[closes COR-060]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 270-279. Currently the ALLOWED_KEYS guard in update() makes the invalid-key path the most likely trigger of partial failure.

**Closed_by:** (empty — TODO)

---

### COR-050 — auth.service register() and users.service create(): duplicate-check race condition surfaces as 500 instead of 409 when two concurrent registrations collide on the DB unique constraint

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · TOCTOU / error-mapping
- **File:** `apps/api/src/auth/auth.service.ts:286-361`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-050` · audit-confidence: high · found_by: correctness

**Description:**
The duplicate-email/login check is a read-then-write without a transaction. Two concurrent POST /auth/register requests with the same email can both pass the findFirst check (neither row exists yet), proceed to bcrypt.hash(), then reach user.create(). The second create() hits the DB-level LOWER() unique constraint and throws a Prisma PrismaClientKnownRequestError (P2002) which is not caught anywhere in register(). AllExceptionsFilter maps this to a 500 'Internal server error', instead of the expected 409. The same pattern exists in users.service.ts create() (same lines). The DB constraint prevents actual data corruption, but the HTTP response code is wrong.

**Root cause:**
No try/catch around user.create() to translate Prisma P2002 unique-constraint errors into ConflictException.

**Code evidence:**
```
    const existingUser = await this.prisma.user.findFirst({
      where: {
        // DAT-015: case-insensitive lookup matches the LOWER() unique index
        OR: [
          { email: { equals: registerDto.email, mode: 'insensitive' } },
          { login: { equals: registerDto.login, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      // DAT-015: case-fold before comparing
      if (
        existingUser.email.toLowerCase() === registerDto.email.toLowerCase()
      ) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
```

**Suggested fix:**
Wrap user.create() in a try/catch that catches PrismaClientKnownRequestError with code P2002 and re-throws as ConflictException. Same fix for users.service.ts create(). Example: `import { Prisma } from 'database'; catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('...'); throw e; }`

**Acceptance criteria:**
1. Two concurrent POST /auth/register with the same email: both return 409 (not one 201 and one 500).
2. Prisma P2002 error is translated to ConflictException in register() and create().
3. Commit message includes `[closes COR-050]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'PrismaClientKnownRequestError\|P2002' apps/api/src/auth/auth.service.ts apps/api/src/users/users.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same pattern in users.service.ts create() at lines 94-116. The fix is the same in both places. Adversarial check: grep confirmed zero P2002 or PrismaClientKnownRequestError references in auth.service.ts or users.service.ts. Other services (departments, leaves, holidays) do handle P2002 correctly — the omission is specific to these two files. AllExceptionsFilter confirmed: non-HttpException → opaque 500 with no P2002 translation.

**Closed_by:** (empty — TODO)

---

### COR-052 — epics.service update()/remove(): double-read TOCTOU — epic fetched in membership check then again in findOne()

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition
- **File:** `apps/api/src/epics/epics.service.ts:78-99`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-052` · audit-confidence: medium · found_by: correctness

**Description:**
The `update()` and `remove()` methods each make 3 separate DB calls: (1) `assertProjectMembership` fetches the epic (with project+members), (2) `findOne` fetches the epic again, (3) the actual update/delete. Between calls 1 and 3, another actor could delete the epic, causing the final update/delete to fail silently or with an unhandled P2025 Prisma error. The P2025 'Record not found' from `prisma.epic.update()` where the row was deleted between the access check and the update would surface as an unhandled internal server error rather than a clean 404.

**Root cause:**
Authorization check, existence check, and mutation are three separate non-transactional operations with a TOCTOU window.

**Code evidence:**
```
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    return this.prisma.epic.update({
      where: { id },
      data: updateEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
```

**Suggested fix:**
Catch P2025 Prisma errors in update/delete and convert to NotFoundException. Alternatively, consolidate into a single transaction that reads and writes atomically. The membership check could be done once, and the findOne result reused instead of re-fetching.

**Acceptance criteria:**
1. If an epic is deleted by another actor between the membership check and the update, the API returns 404, not 500
2. Commit message includes `[closes COR-052]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findOne\|assertProjectMembership\|epic.update\|epic.delete' apps/api/src/epics/epics.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-054 — addParticipant uses check-then-create pattern susceptible to race; duplicate concurrent request leaks P2002 as HTTP 500

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race_condition — TOCTOU on unique constraint
- **File:** `apps/api/src/events/events.service.ts:762-783`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-054` · audit-confidence: medium · found_by: correctness

**Description:**
Two concurrent requests to add the same (eventId, userId) pair both pass the findUnique existence check before either write commits. The second create hits the DB-level unique constraint `eventId_userId` and Prisma raises P2002, which is unhandled and surfaces as HTTP 500 instead of the intended 400 BadRequestException. DB integrity is maintained; only the error code is wrong. The `update()` path avoids this by wrapping inside a transaction.

**Root cause:**
Check-then-act pattern without unique-constraint error handling; concurrent requests can both pass the guard before the DB serializes them.

**Code evidence:**
```
    const existingParticipation = await this.prisma.eventParticipant.findUnique(
      {
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      },
    );

    if (existingParticipation) {
      throw new BadRequestException('Cet utilisateur est déjà participant');
    }

    // Ajouter le participant
    await this.prisma.eventParticipant.create({
      data: {
        eventId,
        userId,
      },
    });
```

**Suggested fix:**
Wrap the create in a try/catch and map Prisma P2002 on `eventId_userId` to `BadRequestException('Cet utilisateur est déjà participant')`, or use `createMany` with `skipDuplicates: true`.

**Acceptance criteria:**
1. Concurrent duplicate addParticipant calls both return 400 (not 500)
2. Unit test: mock prisma.eventParticipant.create to throw a Prisma P2002 error; service throws BadRequestException
3. Commit message includes `[closes COR-054]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'P2002\|skipDuplicates\|existingParticipation' apps/api/src/events/events.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: DB integrity is safe due to the unique constraint. Only the error response code is affected in the concurrent scenario. Adversarial check: AllExceptionsFilter (apps/api/src/common/filters/all-exceptions.filter.ts) maps all non-HttpException errors to HTTP 500 with opaque 'Internal server error' message (line 71-101). P2002 is a PrismaClientKnownRequestError (not an HttpException), so it will return 500. No P2002 catch in addParticipant(). Other services (holidays, departments, leaves, clients) explicitly catch P2002 — this service does not. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-056 — milestones.service update()/remove(): same double-read TOCTOU as epics — unhandled P2025 on concurrent delete

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition
- **File:** `apps/api/src/milestones/milestones.service.ts:102-135`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-056` · audit-confidence: medium · found_by: correctness

**Description:**
Same triple-fetch TOCTOU pattern as epics.service.ts: assertProjectMembership fetches the milestone (with project+members), findOne fetches it again, then update/delete runs. A concurrent delete between calls 1 and 3 would cause prisma.milestone.update() or delete() to throw an unhandled P2025, surfacing as a 500 instead of a 404.

**Root cause:**
Authorization check, existence check, and mutation are three separate non-transactional operations with a TOCTOU window.

**Code evidence:**
```
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    const { dueDate, ...data } = updateMilestoneDto;

    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...data,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: { project: { select: { id: true, name: true } } },
    });
```

**Suggested fix:**
Same as correctness-S2-5: catch P2025 and map to NotFoundException, or consolidate the reads.

**Acceptance criteria:**
1. If a milestone is deleted by another actor between the membership check and the update, the API returns 404, not 500
2. Commit message includes `[closes COR-056]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'findOne\|assertProjectMembership\|milestone.update\|milestone.delete' apps/api/src/milestones/milestones.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-059 — roles.service createRole()/updateRole(): isDefault singleton management is non-atomic — two concurrent requests can create two roles with isDefault=true

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race-condition / non-atomic
- **File:** `apps/api/src/rbac/roles.service.ts:139-157`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-059` · audit-confidence: medium · found_by: correctness

**Description:**
The isDefault singleton (at most one role with isDefault=true) is managed via a two-step: (1) updateMany({isDefault:true}, {isDefault:false}) to unset the current default, then (2) create/update the new one with isDefault:true. These are non-transactional. Two concurrent createRole(isDefault:true) requests can both read the existing default, both call unsetCurrentDefault(), then both proceed to create with isDefault:true — leaving two rows with isDefault=true. The same race exists in updateRole(). There is no DB-level UNIQUE partial index enforcing the singleton.

**Root cause:**
unsetCurrentDefault() + role.create/update are not wrapped in a $transaction, and there is no database-level unique constraint on isDefault=true.

**Code evidence:**
```
    if (dto.isDefault) {
      if (caller) {
        prevDefaultRoleId = await this.captureCurrentDefaultId();
      }
      await this.unsetCurrentDefault();
    }

    const created = await this.prisma.role.create({
      data: {
        code: dto.code,
        label: dto.label,
        templateKey: dto.templateKey,
        description: dto.description ?? null,
        isSystem: false,
        isDefault: dto.isDefault ?? false,
      },
```

**Suggested fix:**
Wrap unsetCurrentDefault() + create/update in a $transaction. Additionally, consider adding a partial unique index in schema.prisma: @@unique([isDefault]) WHERE isDefault = true (PostgreSQL partial index). This enforces the singleton at the DB level regardless of application-layer races.

**Acceptance criteria:**
1. Two concurrent POST /roles with isDefault:true results in exactly one role with isDefault=true.
2. The second request either sees the first's commit and overwrites it, or receives a constraint error.
3. Commit message includes `[closes COR-059]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification via concurrent HTTP test.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Low exploitability (requires concurrent admin requests to /roles). Marked nit. The partial index fix would be the most robust mitigation. Adversarial check: schema.prisma confirmed Role model has @@index([isDefault]) (an index, not a unique constraint) — no DB-level singleton enforcement. Code evidence verbatim at lines 139-157.

**Closed_by:** (empty — TODO)

---

### COR-061 — SettingsService.remove throws unhandled Prisma P2025 for non-existent non-default keys

- **Status:** TODO
- **Phase:** 4
- **Cluster:** C
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · unguarded_delete
- **File:** `apps/api/src/settings/settings.service.ts:310-321`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-061` · audit-confidence: high · found_by: correctness

**Description:**
When `remove(key)` is called with a key that is neither in `DEFAULT_SETTINGS` nor stored in the database, `prisma.appSettings.delete()` throws Prisma error P2025 (`An operation failed because it depends on one or more records that were required but not found`). This error is unhandled and bubbles up as an uncaught exception, resulting in a generic 500 response rather than an appropriate 404. Because `update()` already validates `isKnownKey()`, only unknown (non-default, non-stored) keys can reach this code path, but the controller does not pre-validate the key before calling `remove()`.

**Root cause:**
`prisma.delete()` throws on missing record; the method does not check existence before deleting and does not catch the P2025 error.

**Code evidence:**
```
  async remove(key: string) {
    // Ne pas supprimer les paramètres par défaut
    if (DEFAULT_SETTINGS[key]) {
      return this.resetToDefault(key);
    }

    await this.prisma.appSettings.delete({
      where: { key },
    });

    return { message: 'Paramètre supprimé' };
  }
```

**Suggested fix:**
Add existence check before delete, or catch PrismaClientKnownRequestError with code P2025 and throw NotFoundException. Example:
ʼʼʼts
const existing = await this.prisma.appSettings.findUnique({ where: { key } });
if (!existing) throw new NotFoundException(`Setting '${key}' not found`);
await this.prisma.appSettings.delete({ where: { key } });
ʼʼʼ

**Acceptance criteria:**
1. DELETE /settings/nonexistent-key returns 404 with a descriptive message
2. DELETE /settings/:known-key still returns 200 and deletes the record
3. Commit message includes `[closes COR-061]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:3000/api/settings/nonexistent-key -H 'Authorization: Bearer <token>'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 310-321. Controller (settings.controller.ts line 108) calls settingsService.remove(key) with no pre-validation. The ALLOWED_KEYS guard lives only in update(), not in remove(). No global Prisma exception filter was found to convert P2025 to 404.

**Closed_by:** (empty — TODO)

---

### PER-037 — SnapshotsQueryDto.projectIds and TasksBreakdownQueryDto.projectIds have no array size limit — unbounded IN-clause fan-out

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fan-out
- **File:** `apps/api/src/analytics/advanced/dto/snapshots-query.dto.ts:12-22`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-037` · audit-confidence: high · found_by: performance

**Description:**
Both `SnapshotsQueryDto.projectIds` and `TasksBreakdownQueryDto.projectIds` accept arrays of UUIDs with no maximum size constraint (`@ArrayMaxSize` is absent). These arrays are passed directly into Prisma `{ id: { in: projectIds } }` and `{ project: { id: { in: projectIds } } }` clauses, generating SQL `IN (...)` lists of arbitrary length. Very large IN lists degrade query plan efficiency in PostgreSQL.

**Root cause:**
Missing `@ArrayMaxSize(N)` decorator on both DTOs.

**Code evidence:**
```
  @ApiProperty({
    description: 'Filter by project IDs (omit for all ACTIVE projects)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Type(() => String)
  projectIds?: string[];
```

**Suggested fix:**
Add `@ArrayMaxSize(200)` (or a suitable cap matching `PROJECT_DETAILS_LIMIT = 50` in analytics.service) to `projectIds` in both DTOs.

**Acceptance criteria:**
1. POST/GET with projectIds array of 201 elements returns 400
2. GET with 50 projectIds executes a well-formed IN clause
3. Commit message includes `[closes PER-037]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'ArrayMaxSize\|projectIds' apps/api/src/analytics/advanced/dto/snapshots-query.dto.ts apps/api/src/analytics/advanced/dto/tasks-breakdown.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified verbatim match in both DTOs. snapshots-query.dto.ts lines 12-22 and tasks-breakdown.dto.ts lines 6-16 both show @IsArray() @IsUUID('all', { each: true }) with no @ArrayMaxSize decorator.

**Closed_by:** (empty — TODO)

---

### PER-040 — JwtStrategy.validate makes a full user.findUnique on every authenticated request

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · redundant-db-query
- **File:** `apps/api/src/auth/strategies/jwt.strategy.ts:60-92`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-040` · audit-confidence: high · found_by: performance

**Description:**
Every HTTP request (after JWT signature verification) triggers a `user.findUnique` with a JOIN on the `role` table to re-read active status, role, and the `forcePasswordChange` flag from the DB. This is intentional for `forcePasswordChange` freshness (the comment on line 83-88 explains this), but it adds 1 DB query to the critical path of every authenticated request. Under moderate load (100 req/s) this is 100 DB queries/s just for auth validation.

**Root cause:**
Security requirement: `forcePasswordChange` and `isActive` must be DB-authoritative. However the full user profile (name, avatarUrl, avatarPreset, email, login) is also fetched but never needed by the guard itself.

**Code evidence:**
```
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        // RBAC V4 : relation vers table `roles`. Les guards/services
        // consomment user.role.code + user.role.templateKey.
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
```

**Suggested fix:**
Narrow the select to only the fields needed for auth decisions: `{ id, isActive, forcePasswordChange, roleId, role: { select: { code, templateKey } } }`. All other profile fields (firstName, lastName, avatarUrl, etc.) can be fetched lazily by `getProfile` only when the client explicitly requests them.

**Acceptance criteria:**
1. JwtStrategy.validate query fetches at most 6 columns (id, isActive, forcePasswordChange, roleId + role.code + role.templateKey)
2. ForcePasswordChange guard still works correctly after the change
3. Commit message includes `[closes PER-040]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: This is a well-known trade-off in stateless JWT architectures; the finding is a nit because the security motivation is documented and the query is indexed on PK. The narrowed select would reduce data transfer by ~60%. Confirmed: select includes firstName, lastName, avatarUrl, avatarPreset, createdAt, updatedAt, email, login, departmentId — none needed for auth decisions.

**Closed_by:** (empty — TODO)

---

### PER-043 — findAll documents uses default limit=1000 — very high default page size

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · over-fetching
- **File:** `apps/api/src/documents/documents.service.ts:75-81`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-043` · audit-confidence: high · found_by: performance

**Description:**
Same pattern as comments: default limit of 1000, hard cap at 1000. Each document row includes `project: { id, name }`. A project with hundreds of documents returns them all in one response without pagination.

**Root cause:**
Overly high default limit of 1000.

**Code evidence:**
```
  async findAll(
    page = 1,
    limit = 1000,
    projectId?: string,
    currentUser?: AccessUser,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Change default to 20, cap at 100.

**Acceptance criteria:**
1. GET /documents without limit param returns at most 20 items
2. Commit message includes `[closes PER-043]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s 'http://localhost:3001/documents' | jq '.meta.limit'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### PER-044 — holidays findAll: unbounded findMany — no limit, no pagination

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/holidays/holidays.service.ts:116-125`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-044` · audit-confidence: high · found_by: performance

**Description:**
GET /holidays returns all holiday rows with no limit. In practice this table is small (~11 rows per year × years in DB), but there is no upper bound enforced at code level. If an organisation retains many years of history and imports recurring holidays, this could grow to hundreds of rows returned on every call.

**Root cause:**
No `take` clause on the `findMany` call.

**Code evidence:**
```
  async findAll(): Promise<Holiday[]> {
    return this.prisma.holiday.findMany({
      orderBy: { date: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
```

**Suggested fix:**
Add an optional `year` filter (already provided by `findByYear`) to the `findAll` controller endpoint, or add a hard cap of `take: 500`.

**Acceptance criteria:**
1. GET /holidays with no query param returns at most 500 rows
2. Commit message includes `[closes PER-044]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 116-125 of holidays.service.ts.

**Closed_by:** (empty — TODO)

---

### PER-046 — getOwnLeaves: unbounded findMany on leave history — no limit

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/leaves/leaves.service.ts:1101-1139`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-046` · audit-confidence: high · found_by: performance

**Description:**
GET /leaves/me returns every leave ever created for the calling user, with no pagination or `take` limit. A user who has been in the organisation for multiple years can accumulate hundreds of leave records. Each row includes joins on user, leaveType, validator, and validatedBy.

**Root cause:**
No `take` parameter is passed to `findMany`; the method has no pagination contract.

**Code evidence:**
```
    const leaves = await this.prisma.leave.findMany({
      where: { userId: currentUserId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
```

**Suggested fix:**
Add optional `page`/`limit` parameters; default to most recent N (e.g. 50) leaves or restrict to current year by default with an opt-in `all` parameter.

**Acceptance criteria:**
1. GET /leaves/me returns at most 50 rows by default
2. A `meta.total` allows the frontend to paginate further
3. Commit message includes `[closes PER-046]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 1101-1139. No take, no skip, no orderBy year-scoping beyond desc startDate.

**Closed_by:** (empty — TODO)

---

### PER-047 — findAll leaves: default limit 1000 with effective cap 500 — higher than recommended 100

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · page-size
- **File:** `apps/api/src/leaves/leaves.service.ts:761-781`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-047` · audit-confidence: high · found_by: performance

**Description:**
The function signature defaults `limit` to 1000, but the effective cap is `Math.min(limit || 500, 500)`. Callers passing `limit=1000` silently receive 500 rows. The default of 500 is 5× the 100-row checklist ceiling; each row includes 4 joined objects (user, leaveType, validator, validatedBy). At 500 rows with 4 joins, the response payload can easily exceed 100 KB in a real organisation.

**Root cause:**
The cap of 500 was chosen without documenting the payload size risk; no upper limit is documented in the API contract.

**Code evidence:**
```
  async findAll(
    page = 1,
    limit = 1000,
    userId?: string,
    status?: LeaveStatus,
    type?: LeaveType,
    startDate?: string,
    endDate?: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    // Lecture globale : vérifier la permission dynamique leaves:readAll
    if (currentUserRole) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('leaves:readAll')) {
        userId = currentUserId;
      }
    }
    const safeLimit = Math.min(limit || 500, 500);
```

**Suggested fix:**
Lower the default to 50 and the cap to 100. Add the `safeLimit` cap documentation to the Swagger description.

**Acceptance criteria:**
1. GET /leaves with no limit param returns at most 50 rows
2. GET /leaves?limit=999 returns at most 100 rows
3. meta.totalPages is correct
4. Commit message includes `[closes PER-047]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code verified: limit default=1000 (line 763), safeLimit=Math.min(limit||500,500) (line 780). The mismatched default vs cap is also a contract confusion issue. time-tracking findAll has the same issue: safeLimit = Math.min(limit || 1000, 1000) at time-tracking.service.ts:363.

**Closed_by:** (empty — TODO)

---

### PER-049 — findAssignments (predefined-tasks): no pagination and no maximum result cap

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:186-231`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-049` · audit-confidence: high · found_by: performance

**Description:**
The `findAssignments` method has no `take` limit. A request with `?startDate=2020-01-01&endDate=2030-01-01` returns all assignments in a 10-year window, potentially thousands of rows with included relations.

**Root cause:**
No `take` argument on the unbounded `findMany`.

**Code evidence:**
```
  async findAssignments(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    predefinedTaskId?: string;
  }) {
    return this.prisma.predefinedTaskAssignment.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.predefinedTaskId && {
          predefinedTaskId: filters.predefinedTaskId,
        }),
```

**Suggested fix:**
Add a reasonable default cap: `take: Math.min(filters.limit ?? 500, 1000)`. Alternatively add pagination params to the query DTO.

**Acceptance criteria:**
1. GET /predefined-tasks/assignments with wide date range returns at most 1000 rows
2. Commit message includes `[closes PER-049]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### PER-050 — findRecurringRules: no pagination — unbounded findMany with includes

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded list
- **File:** `apps/api/src/predefined-tasks/predefined-tasks.service.ts:352-387`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-050` · audit-confidence: medium · found_by: performance

**Description:**
The method returns all active recurring rules matching the optional filters, with no `take` or pagination. Includes nested predefinedTask, user, and createdBy.

**Root cause:**
No `take` argument on the findMany.

**Code evidence:**
```
  async findRecurringRules(filters: {
    userId?: string;
    predefinedTaskId?: string;
  }) {
    return this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.predefinedTaskId && {
          predefinedTaskId: filters.predefinedTaskId,
        }),
      },
```

**Suggested fix:**
Add `take: 500` as a hard cap or accept pagination params.

**Acceptance criteria:**
1. GET /predefined-tasks/recurring-rules returns at most 500 rows
2. Commit message includes `[closes PER-050]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### PER-052 — findAll school-vacations: unbounded findMany — no pagination for year-scoped list

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-query
- **File:** `apps/api/src/school-vacations/school-vacations.service.ts:36-45`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-052` · audit-confidence: high · found_by: performance

**Description:**
GET /school-vacations with no `year` filter returns all school vacation records across all years. The table grows with each import cycle (each zone × year adds up to ~10 rows). Without a limit, an organisation with several years of data will return all records unboundedly.

**Root cause:**
No `take` clause; the `year` filter is optional with no fallback cap.

**Code evidence:**
```
  async findAll(year?: number) {
    return this.prisma.schoolVacation.findMany({
      where: year ? { year } : undefined,
      orderBy: { startDate: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
```

**Suggested fix:**
Add `take: 200` as a hard cap or require the `year` query parameter (set it as required in the controller or default to current year).

**Acceptance criteria:**
1. GET /school-vacations returns at most 200 rows
2. Commit message includes `[closes PER-052]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 36-45 of school-vacations.service.ts.

**Closed_by:** (empty — TODO)

---

### PER-054 — getSkillsMatrix() loads all active users and all skills without pagination — response size grows as O(users × skills)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-matrix-query
- **File:** `apps/api/src/skills/skills.service.ts:362-441`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-054` · audit-confidence: medium · found_by: performance

**Description:**
The skills matrix endpoint fetches ALL active users (with nested department + skills includes) and ALL skills in parallel, then cross-joins them in JavaScript. No pagination, no limit. For a large organisation (500 users × 200 skills), the JSON response encodes 500 × 200 = 100 000 cell objects. At ~100 bytes each that is ~10 MB per request. The `users` findMany also eagerly includes `skills { include: { skill: true } }` which is an O(U×S) JOIN from Postgres.

**Root cause:**
The matrix is designed as a reporting view; pagination was not considered because it is used in a grid component that requires the full dataset client-side.

**Code evidence:**
```
    const [users, skills] = await Promise.all([
      this.prisma.user.findMany({
        where: whereUser,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          avatarPreset: true,
          role: { select: { code: true } },
          departmentId: true,
          department: { select: { id: true, name: true } },
          skills: { include: { skill: true } },
        },
        orderBy: { lastName: 'asc' },
      }),
      this.prisma.skill.findMany({
        where: whereSkill,
        orderBy: { name: 'asc' },
      }),
    ]);
```

**Suggested fix:**
Add pagination on the users axis (`page`/`limit`) with a hard cap (e.g. 200 users per page). For full-matrix exports, offer a streaming CSV endpoint. At minimum document and enforce an org-size assumption in the response type.

**Acceptance criteria:**
1. GET /skills/matrix with 600 active users returns at most 200 user rows by default
2. A `page` parameter allows consumers to paginate through all users
3. Commit message includes `[closes PER-054]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 362-441. `whereUser` only filters `isActive: true` — no limit, no skip, no pagination parameter. The endpoint does require `skills:manage_matrix` permission (ADMIN/RESPONSABLE/MANAGER only), which partially limits blast radius, but the payload-size concern holds at org scale. Classified as nit because this endpoint is a reporting tool with restricted access.

**Closed_by:** (empty — TODO)

---

### PER-056 — findAll time-tracking: effective cap is 1000 rows — far exceeds recommended 100

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · page-size
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:363`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-056` · audit-confidence: high · found_by: performance

**Description:**
The time-tracking `findAll` method allows callers to retrieve up to 1000 time entries per page. Each entry includes user, thirdParty, declaredBy, task, and project joins. At 1000 rows with 5 joins, the serialised payload can approach 500 KB for entries with verbose descriptions.

**Root cause:**
No documented rationale for the 1000-row cap; likely carried over from an earlier iteration without review.

**Code evidence:**
```
    const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Lower the default to 50 and cap to 100, consistent with best practice.

**Acceptance criteria:**
1. GET /time-tracking with no limit returns at most 50 rows
2. GET /time-tracking?limit=2000 returns at most 100 rows
3. Commit message includes `[closes PER-056]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at line 363 of time-tracking.service.ts.

**Closed_by:** (empty — TODO)

---

### PER-057 — validateImport fetches ALL users (email+login) for duplicate detection — unbounded full-table scan

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · unbounded-fetch
- **File:** `apps/api/src/users/users.service.ts:1479-1481`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-057` · audit-confidence: high · found_by: performance

**Description:**
`validateImport` pre-fetches every user row (email + login) into memory to build Sets for duplicate detection. On a deployment with 10,000 users this loads 10,000 rows per dry-run validation call. While this is better than per-row queries (as done by `importUsers`), it does not scale. No `take` or `where` limit is applied.

**Root cause:**
The pre-fetch pattern was chosen as an optimization over per-row queries but was not bounded.

**Code evidence:**
```
      this.prisma.user.findMany({
        select: { email: true, login: true },
      }),
```

**Suggested fix:**
Replace the full-table scan with targeted lookups: extract all unique emails and logins from the import batch, then query `user.findMany({ where: { OR: [{ email: { in: emails } }, { login: { in: logins } }] } })` to fetch only potential duplicates. This reduces the scan to at most `batch_size` matches rather than the full user table.

**Acceptance criteria:**
1. POST /users/import/validate with 50 users makes a single bounded query (WHERE email IN (...) OR login IN (...)) instead of a full-table findMany
2. Commit message includes `[closes PER-057]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed verbatim at lines 1479-1481. No where clause or take limit present.

**Closed_by:** (empty — TODO)

---

### PER-039 — recomputeChainFrom() issues one UPDATE per audit row in a serial for-loop — O(N) round-trips hold the advisory lock for the full duration

- **Status:** TODO
- **Phase:** 4
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-one-maintenance-script
- **File:** `apps/api/src/audit/recompute-chain.ts:87-112`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-039` · audit-confidence: high · found_by: performance

**Description:**
The recompute walk issues one parameterised UPDATE per row inside an async for-loop. For a chain of N rows, this is N sequential DB round-trips within a single long transaction. For a production instance with 50 000 audit rows (login events over ~2 years), this means 50 000 round-trips, taking minutes. Additionally, all rows are loaded into Node.js memory before the walk begins. During this window the `audit_logs_chain` advisory lock is held, blocking all concurrent audit event persistence (every login, leave approval, etc.).

**Root cause:**
Sequential chaining is inherently serial because each row's `prevHash` depends on the previous row's computed `rowHash`. The hashes must be computed in order in JS, but the UPDATEs themselves could be batched.

**Code evidence:**
```
  const rows = await tx.$queryRaw<ChainRow[]>`
    SELECT id, action, "entityType", "entityId", "actorId", "schemaVersion",
           "createdAt", payload, "prevHash", "rowHash"
    FROM audit_logs
    WHERE ("createdAt", id) >= (${from.createdAt}, ${from.id})
    ORDER BY "createdAt" ASC, id ASC
  `;

  let prevHash = anchorPrevHash;
  for (const row of rows) {
    const newRowHash = computeRowHash({ ... });
    await tx.$executeRaw`
      UPDATE audit_logs SET "prevHash" = ${prevHash}, "rowHash" = ${newRowHash}
      WHERE id = ${row.id}
    `;
    prevHash = newRowHash;
  }
```

**Suggested fix:**
Compute all hashes in JS sequentially (unavoidable), collect pairs of `(id, prevHash, rowHash)`, then issue batched `UPDATE … FROM (VALUES …)` SQL statements in chunks of e.g. 1000 rows. This reduces 100K round-trips to ~100. Also stream rows in chunks rather than loading the entire tail at once to bound memory usage.

**Acceptance criteria:**
1. Full-chain recompute of 100K rows completes in <10 seconds
2. The advisory lock window is measured and documented in the runbook
3. Commit message includes `[closes PER-039]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 87-112: all rows loaded at once via unbounded `$queryRaw`, then one `$executeRaw` UPDATE per row inside the `for...of` loop. This is a maintenance script invoked once after schema migrations. Severity is nit because it does not affect the live request path. However, the advisory lock contention makes it operationally risky on a large production DB.

**Closed_by:** (empty — TODO)

---

### PER-045 — leave-types reorder: N individual update queries instead of bulk upsert

- **Status:** TODO
- **Phase:** 4
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1
- **File:** `apps/api/src/leave-types/leave-types.service.ts:192-203`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-045` · audit-confidence: high · found_by: performance

**Description:**
`reorder` issues one `UPDATE` statement per leave type inside an interactive transaction. For N leave types, this produces N round-trips within a single Postgres transaction. While the table is typically small (< 20 rows), the pattern does not scale and adds unnecessary Postgres statement overhead. A `CASE`-based bulk update or raw SQL `UPDATE … SET sortOrder = CASE …` would accomplish this in a single statement.

**Root cause:**
Prisma does not expose a native multi-row `updateMany` with per-row values; the code maps to individual updates without using a raw query alternative.

**Code evidence:**
```
  async reorder(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.leaveTypeConfig.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll();
  }
```

**Suggested fix:**
Use `prisma.$executeRaw` with a `CASE`-based UPDATE, or if admin-only and small-scale, accept the current approach but cap the input array size (e.g. `@MaxLength(50)` on the DTO).

**Acceptance criteria:**
1. Reordering 10 leave types issues at most 2 DB statements (1 batch UPDATE + 1 SELECT for findAll)
2. Commit message includes `[closes PER-045]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 192-203 of leave-types.service.ts. Low priority: admin-only, small table.

**Closed_by:** (empty — TODO)

---

### PER-053 — settings.service `initializeDefaultSettings` issues N×2 sequential DB queries at every module init

- **Status:** TODO
- **Phase:** 4
- **Cluster:** E
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1-sequential-writes
- **File:** `apps/api/src/settings/settings.service.ts:109-126`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-053` · audit-confidence: high · found_by: performance

**Description:**
On every module init (every API startup), the service issues one `findUnique` per default setting key, then one `create` if missing — up to 2×N sequential DB round-trips for N default settings (currently ~10). While the number of settings is small and bounded, this pattern runs on every pod restart including rolling deploys.

**Root cause:**
Sequential loop instead of a single `upsert`-all or `createMany`-on-conflict batch.

**Code evidence:**
```
  private async initializeDefaultSettings() {
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await this.prisma.appSettings.findUnique({
        where: { key },
      });

      if (!existing) {
        await this.prisma.appSettings.create({
          data: {
            key,
            value: JSON.stringify(config.value),
            category: config.category,
            description: config.description,
          },
        });
      }
    }
```

**Suggested fix:**
Replace the loop with `this.prisma.appSettings.createMany({ data: DEFAULT_SETTINGS entries, skipDuplicates: true })` — one round-trip regardless of N.

**Acceptance criteria:**
1. Module init executes exactly 1 DB statement regardless of how many default settings exist
2. Default settings are still created when absent
3. Commit message includes `[closes PER-053]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'initializeDefaultSettings\|for.*DEFAULT_SETTINGS' apps/api/src/settings/settings.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Also applies to `resetAllToDefaults` at line 300 which does sequential awaited `update` calls. Verified verbatim match at lines 109-126.

**Closed_by:** (empty — TODO)

---

### SEC-035 — QueryClientsDto.search and QueryThirdPartyDto.search missing @MaxLength — unbounded query string parameter

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/clients/dto/query-clients.dto.ts:13-16`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-035` · audit-confidence: high · found_by: security

**Description:**
The search parameter in both QueryClientsDto (clients) and QueryThirdPartyDto (third-parties) has no @MaxLength. The value is passed to Prisma as a LIKE pattern (mode: insensitive), which is parameterized (no injection risk), but an arbitrarily long search string could stress the DB full-scan ILIKE query. The GET body limit does not apply to query string parameters; Fastify/nginx URL limits are the only cap (~8KB by default).

**Root cause:**
MaxLength omitted from search fields in both query DTOs.

**Code evidence:**
```
  @ApiPropertyOptional({ description: 'Search on name (ilike)' })
  @IsOptional()
  @IsString()
  search?: string;
```

**Suggested fix:**
Add @MaxLength(200) or @MaxLength(255) to the search fields in both QueryClientsDto and QueryThirdPartyDto.

**Acceptance criteria:**
1. GET /clients?search=<>200-char-string returns 400
2. GET /third-parties?search=<>200-char-string returns 400
3. Normal search queries work unchanged
4. Commit message includes `[closes SEC-035]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'search\|MaxLength' apps/api/src/clients/dto/query-clients.dto.ts apps/api/src/third-parties/dto/query-third-party.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Same pattern in both DTOs. Third-parties has the same omission at line 31-33.

**Closed_by:** (empty — TODO)

---

### SEC-037 — CreateDocumentDto.description missing @MaxLength — unbounded free-text field

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/documents/dto/create-document.dto.ts:53-60`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-037` · audit-confidence: high · found_by: security

**Description:**
The description field has @IsString() and @IsOptional() but no @MaxLength constraint. A client can supply a very long description string. The 1MB global body limit in main.ts provides a hard ceiling, but best practice (and the existing pattern in this same DTO: name has @MaxLength(255), url has @MaxLength(2048)) is to explicitly cap free-text fields. This also documents intent in the API contract.

**Root cause:**
MaxLength decorator omitted from an optional free-text field.

**Code evidence:**
```
  @ApiProperty({
    description: 'Description du document',
    example: 'Document de spécifications techniques',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add @MaxLength(2000) or a similar business-appropriate limit to description, consistent with the notes field cap used in ThirdParty.

**Acceptance criteria:**
1. POST /documents with description longer than the cap returns 400
2. POST /documents with a short description is accepted
3. Commit message includes `[closes SEC-037]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength\|description' apps/api/src/documents/dto/create-document.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Partially mitigated by the 1MB Fastify body limit.

**Closed_by:** (empty — TODO)

---

### SEC-038 — CreateDocumentDto.size missing @IsInt() and @Min(0) — negative or non-integer values accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/documents/dto/create-document.dto.ts:88-90`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-038` · audit-confidence: high · found_by: security

**Description:**
The size field is declared as number with only @IsNotEmpty(). No @IsInt(), @IsNumber(), or @Min(0) decorator is present. A client can submit size: -1 or size: 0 which will pass DTO validation. The service only rejects values > 200_000_000. The DB column is Int (Prisma), but negative values are valid PostgreSQL integers. The self-reported nature of the field means this is primarily a data-quality issue, but it allows storage of semantically invalid metadata (negative file sizes).

**Root cause:**
Incomplete validator coverage on the size field in CreateDocumentDto.

**Code evidence:**
```
  @ApiProperty({ description: 'Taille en bytes', example: 2048576 })
  @IsNotEmpty()
  size: number;
```

**Suggested fix:**
Add @IsInt() @Min(0) to the size field. Also add @Max(MAX_DOCUMENT_SIZE_BYTES) to move the cap from the service layer to the DTO, making the constraint self-documenting.

**Acceptance criteria:**
1. POST /documents with size: -1 returns 400
2. POST /documents with size: 0 is accepted (or rejected if 0-byte files should be disallowed)
3. POST /documents with size: 999999999999 returns 400 if @Max is added
4. Commit message includes `[closes SEC-038]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'IsInt\|IsNumber\|@Min\|@Max' apps/api/src/documents/dto/create-document.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: UpdateDocumentDto inherits this gap via PartialType(CreateDocumentDto). GlobalValidationPipe uses transform:true but NOT enableImplicitConversion, so JSON-native negative numbers pass through as-is. Service-layer check only guards the upper bound (>200_000_000), not negative values.

**Closed_by:** (empty — TODO)

---

### SEC-039 — projectId query filter in epics/milestones findAll not validated as UUID

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/epics/epics.controller.ts:54`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-039` · audit-confidence: high · found_by: security

**Description:**
The projectId query parameter in GET /epics and GET /milestones is accepted as a raw string and passed directly to a Prisma where clause. While Prisma parameterizes the query (no SQL injection), an invalid UUID string will result in a Prisma P2023 error (Invalid value for database column type uuid) that propagates as a 500 rather than a 400. The same issue exists in milestones controller at line 82.

**Root cause:**
No ParseUUIDPipe or DTO-level @IsUUID validation is applied to the projectId query parameter.

**Code evidence:**
```
    @Query('projectId') projectId?: string,
  ) {
    return this.epicsService.findAll(page, limit, projectId);
  }
```

**Suggested fix:**
Add a custom pipe or a DTO with `@IsUUID() @IsOptional() projectId?: string` and use `@Query() query: EpicFilterDto` in the controller.

**Acceptance criteria:**
1. GET /epics?projectId=not-a-uuid returns 400 Bad Request
2. GET /epics?projectId=<valid-uuid> continues to return filtered results
3. Commit message includes `[closes SEC-039]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'projectId' apps/api/src/epics/epics.controller.ts apps/api/src/milestones/milestones.controller.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: epics.controller.ts line 54 confirmed verbatim — @Query('projectId') projectId?: string with no pipe. milestones.controller.ts line 82 same pattern confirmed. No UUID validation on query param.

**Closed_by:** (empty — TODO)

---

### SEC-040 — CreateEventDto.description has no @MaxLength — unbounded DB write

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/events/dto/create-event.dto.ts:36-38`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-040` · audit-confidence: high · found_by: security

**Description:**
The `description` field has `@IsString()` and `@IsOptional()` but no `@MaxLength`. The global ValidationPipe(whitelist:true, forbidNonWhitelisted:true) does not bound the value length. A caller can POST an arbitrarily large string (limited only by network/body size) which gets inserted into PostgreSQL. The Event.description column in schema.prisma is typed as `String?` with no length constraint. The title field correctly has @MaxLength(200).

**Root cause:**
Missing @MaxLength decorator on the optional description field in CreateEventDto.

**Code evidence:**
```
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add `@MaxLength(5000)` (or an appropriate project-wide limit) to the description field, matching any similar DTO convention in the codebase.

**Acceptance criteria:**
1. POST /events with description longer than the configured max returns HTTP 400
2. POST /events with description within the limit succeeds
3. Commit message includes `[closes SEC-040]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: UpdateEventDto extends PartialType(CreateEventDto) so it inherits the same gap. Adversarial verification: lines 36-38 of create-event.dto.ts confirmed verbatim — @IsString() + @IsOptional() with no @MaxLength. Title has @MaxLength(200) at line 28, confirming the pattern gap is real.

**Closed_by:** (empty — TODO)

---

### SEC-041 — GET /holidays/import-french: year query param parsed via parseInt without range bounds or ParseIntPipe

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input validation / missing validation
- **File:** `apps/api/src/holidays/holidays.controller.ts:127-131`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-041` · audit-confidence: high · found_by: security

**Description:**
The `year` query parameter on `POST /holidays/import-french` is received as a raw string and parsed with `parseInt(year, 10)` in the handler body. Unlike the sibling `GET /holidays/year/:year` route (which uses `ParseIntPipe`), this endpoint applies no NestJS pipe validation. A NaN value (e.g. `year=abc`) silently becomes `NaN`, which causes the Easter calculation and Date.UTC calls in `importFrenchHolidays()` to produce invalid dates (`Invalid Date`). No range check is applied either, so `year=1600` or `year=9999` would generate malformed holiday inserts. The endpoint requires `holidays:create` (admin-level) so the attack surface is limited.

**Root cause:**
Manual `parseInt` in the handler instead of `ParseIntPipe` with range validation, inconsistent with the `GET /holidays/year/:year` pattern.

**Code evidence:**
```
  async importFrenchHolidays(
    @Query('year') year: string,
    @CurrentUser() user: User,
  ) {
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
```

**Suggested fix:**
Replace `@Query('year') year: string` with `@Query('year', new ParseIntPipe({ optional: true })) year?: number` and add a range check in the service (e.g., 2000 ≤ year ≤ 2100) consistent with `ImportSchoolVacationDto`.

**Acceptance criteria:**
1. POST /holidays/import-french?year=abc returns HTTP 400.
2. POST /holidays/import-french?year=1600 returns HTTP 400 or is rejected by the service.
3. Commit message includes `[closes SEC-041]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: POST /holidays/import-french?year=NaN (as admin), observe response.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The `GET /holidays/year/:year` endpoint correctly uses ParseIntPipe; this inconsistency in the import endpoint is the gap. Adversarial review confirmed: holidays.controller.ts line 130 verbatim `parseInt(year, 10)` with no pipe on the @Query decorator. holidays.service.ts importFrenchHolidays() has no isNaN guard — `Date.UTC(NaN, 0, 1)` propagates Invalid Date into Prisma upsert calls. Global ValidationPipe does not intercept raw @Query string params without a DTO class. Endpoint is @Post not @Get as the finding notes say, but that does not affect validity.

**Closed_by:** (empty — TODO)

---

### SEC-043 — ImportLeaveDto.userEmail uses @IsString/@IsNotEmpty instead of @IsEmail, and CreateLeaveDto.leaveTypeId / ImportLeaveDto lack @IsUUID

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input validation / missing format check
- **File:** `apps/api/src/leaves/dto/import-leaves.dto.ts:13-20`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-043` · audit-confidence: high · found_by: security

**Description:**
The `userEmail` field in `ImportLeaveDto` is validated only as a non-empty string, not as a valid email address (`@IsEmail()`). Similarly, `CreateLeaveDto.leaveTypeId` and `UpsertLeaveBalanceDto.leaveTypeId`/`userId` accept any non-empty string rather than a UUID (`@IsUUID()`). Although the service resolves these by DB lookup (preventing actual injection), the absence of format validation means malformed payloads only fail at the DB round-trip (returning a generic not-found) rather than producing an early, clear 400 validation error. This also masks enumeration timing differences.

**Root cause:**
Missing `@IsEmail()` on `ImportLeaveDto.userEmail` and `@IsUUID()` on FK-typed string fields in several leave DTOs.

**Code evidence:**
```
export class ImportLeaveDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  userEmail: string;
```

**Suggested fix:**
Add `@IsEmail()` to `ImportLeaveDto.userEmail`. Add `@IsUUID()` to `CreateLeaveDto.leaveTypeId`, `UpsertLeaveBalanceDto.leaveTypeId`, and `UpsertLeaveBalanceDto.userId` (where non-null). Add `@IsUUID()` to `CreateLeaveDto.targetUserId`.

**Acceptance criteria:**
1. POST /leaves/import with userEmail='not-an-email' returns HTTP 400.
2. POST /leaves with leaveTypeId='not-a-uuid' returns HTTP 400.
3. Commit message includes `[closes SEC-043]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: POST /leaves with leaveTypeId='INJECTION_ATTEMPT', expect 400.
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CreateLeaveDto.targetUserId is also @IsString without @IsUUID. Adversarial review confirmed: grep of IsUUID/IsEmail across create-leave.dto.ts, import-leaves.dto.ts, upsert-leave-balance.dto.ts returned zero results. All three files confirmed to use only @IsString/@IsNotEmpty for UUID and email fields.

**Closed_by:** (empty — TODO)

---

### SEC-044 — Milestone bulk import array has no @ArrayMaxSize — DoS via oversized payload

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/milestones/dto/import-milestones.dto.ts:31-39`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-044` · audit-confidence: high · found_by: security

**Description:**
The importMilestones endpoint accepts an array of milestone objects with no upper bound on array size. The service processes them one by one in a for loop (milestones.service.ts:193-235), issuing a separate DB query per item for duplicate detection (findFirst) plus one create per item. A large array (e.g., 10,000 entries) causes a long-running transaction, excessive DB connections, and potential memory exhaustion. The global Fastify body size limit is the only backstop.

**Root cause:**
No @ArrayMaxSize decorator was applied to the milestones array in ImportMilestonesDto.

**Code evidence:**
```
export class ImportMilestonesDto {
  @ApiProperty({
    description: 'Liste des jalons à importer',
    type: [ImportMilestoneDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMilestoneDto)
  milestones: ImportMilestoneDto[];
```

**Suggested fix:**
Add `@ArrayMaxSize(500)` (or a reasonable limit matching business needs) to the milestones field. Also refactor the import loop to use a single findMany for duplicate detection and a single createMany for inserts.

**Acceptance criteria:**
1. POST /milestones/project/:id/import with milestones array length > 500 returns 400 Bad Request
2. Import with <= 500 entries continues to work
3. Commit message includes `[closes SEC-044]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'ArrayMaxSize\|milestones' apps/api/src/milestones/dto/import-milestones.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: import-milestones.dto.ts lines 31-39 confirmed verbatim. No @ArrayMaxSize decorator present. Only @IsArray, @ValidateNested, @Type decorators on the array field.

**Closed_by:** (empty — TODO)

---

### SEC-045 — Unvalidated date query strings passed to new Date() in exportIcs — possible HTTP 500 instead of 400

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/planning-export/planning-export.service.ts:56-57`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-045` · audit-confidence: high · found_by: security

**Description:**
The `start` and `end` query parameters in GET /planning-export/ics are accepted as raw strings from the controller with no @IsISO8601 or @IsDateString validation. They are passed directly to `new Date()`. If the string is not a valid date (e.g. 'foobar'), `new Date('foobar')` produces `Invalid Date`, and passing NaN to Prisma's date filter will likely cause a runtime error (HTTP 500) rather than a clean HTTP 400 Bad Request. The PlanningOverviewQueryDto (planning module) correctly uses @IsISO8601, demonstrating the right pattern. Note: GET /events/range (getEventsByRange) DOES have an isNaN guard at lines 663-665 catching the Invalid Date and returning HTTP 400 — making that endpoint safe. The vulnerability is isolated to exportIcs.

**Root cause:**
No DTO with @IsDateString/@IsISO8601 validation wrapping the date query parameters in exportIcs; no isNaN guard in service method.

**Code evidence:**
```
    const dateFilter: Record<string, unknown> = {};
    if (start) dateFilter['gte'] = new Date(start);
    if (end) dateFilter['lte'] = new Date(end);
```

**Suggested fix:**
Create a typed query DTO for GET /planning-export/ics using @IsISO8601 + @IsOptional on the date parameters, matching the PlanningOverviewQueryDto pattern.

**Acceptance criteria:**
1. GET /planning-export/ics?start=notadate returns HTTP 400 with a validation error message
2. Commit message includes `[closes SEC-045]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: events.service.ts:getEventsByRange lines 660-665 has isNaN checks — that endpoint is safe. The original finding's title has been narrowed to exportIcs only. Confidence remains high for that specific path.

**Closed_by:** (empty — TODO)

---

### SEC-046 — CreatePredefinedTaskDto free-text fields (name, description, color, icon) lack @MaxLength

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/predefined-tasks/dto/create-predefined-task.dto.ts:16-47`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-046` · audit-confidence: high · found_by: security

**Description:**
The `name`, `description`, `color`, and `icon` fields in `CreatePredefinedTaskDto` are validated with @IsString() but have no @MaxLength. The `color` field has a @Matches regex for time fields but not for color itself. `icon` (intended for emoji) is unbounded. A user with `predefined_tasks:create` can store very large strings in these fields.

**Root cause:**
MaxLength constraints were omitted during initial DTO creation.

**Code evidence:**
```
  @IsString()
  @IsNotEmpty()
  name: string;

  ...
  @IsString()
  @IsOptional()
  description?: string;

  ...
  @IsString()
  @IsOptional()
  color?: string;

  ...
  @IsString()
  @IsOptional()
  icon?: string;
```

**Suggested fix:**
Add: `@MaxLength(200)` to `name`, `@MaxLength(2000)` to `description`, `@MaxLength(20)` to `color`, `@MaxLength(10)` to `icon`.

**Acceptance criteria:**
1. POST /predefined-tasks with name > 200 chars returns HTTP 400
2. Commit message includes `[closes SEC-046]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review: verbatim code confirmed at create-predefined-task.dto.ts lines 17-47. The @Matches decorators are for startTime/endTime (HH:mm format), not for color. No @MaxLength on any of name, description, color, or icon. Finding confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-048 — managerId and sponsorId in CreateProjectDto use @IsString instead of @IsUUID

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/projects/dto/create-project.dto.ts:87-103`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-048` · audit-confidence: high · found_by: security

**Description:**
managerId and sponsorId are used as UUID foreign keys to the users table, but are validated only as @IsString. Prisma will accept any string and then fail at the DB level with a foreign-key or UUID cast error if a non-UUID is supplied, returning a 500 instead of a 400. The AddMemberDto correctly uses @IsUUID() for userId. Inconsistent validation contract.

**Root cause:**
Copy/paste inconsistency: userId in AddMemberDto has @IsUUID, but manager/sponsor IDs in CreateProjectDto do not.

**Code evidence:**
```
  @ApiProperty({
    description: 'ID du chef de projet',
    example: 'uuid-du-manager',
    required: false,
  })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiProperty({
    description: 'ID du sponsor',
    example: 'uuid-du-sponsor',
    required: false,
  })
  @IsString()
  @IsOptional()
  sponsorId?: string;
```

**Suggested fix:**
Replace `@IsString()` with `@IsUUID()` for both managerId and sponsorId in CreateProjectDto.

**Acceptance criteria:**
1. POST /projects with managerId='not-a-uuid' returns 400 Bad Request
2. POST /projects with valid UUID managerId continues to work
3. Commit message includes `[closes SEC-048]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'managerId\|sponsorId\|IsString\|IsUUID' apps/api/src/projects/dto/create-project.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: create-project.dto.ts lines 87-103 confirmed verbatim. Both managerId and sponsorId use @IsString() @IsOptional() with no @IsUUID(). No service-level UUID validation found for these fields.

**Closed_by:** (empty — TODO)

---

### SEC-049 — visibleStatuses in UpdateProjectDto uses @IsString (not @IsEnum) allowing arbitrary status strings

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/projects/dto/update-project.dto.ts:18-29`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-049` · audit-confidence: high · found_by: security

**Description:**
The sibling field hiddenStatuses uses `@IsEnum(TaskStatus, { each: true })` to enforce valid enum values. visibleStatuses uses only `@IsString({ each: true })`, allowing any arbitrary string to be stored. These values are stored as a JSON array in the project row and later used to filter Kanban columns. Injecting unknown status codes could cause front-end rendering errors or bypass intended visibility restrictions.

**Root cause:**
hiddenStatuses received enum validation but visibleStatuses was left with the weaker @IsString constraint.

**Code evidence:**
```
  @ApiProperty({
    description:
      'Statuts de tâches visibles dans la vue Kanban de ce projet (vide = tous visibles)',
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleStatuses?: string[];
```

**Suggested fix:**
Replace `@IsString({ each: true })` with `@IsEnum(TaskStatus, { each: true })` for visibleStatuses, mirroring hiddenStatuses.

**Acceptance criteria:**
1. PATCH /projects/:id with visibleStatuses=['INVALID_STATUS'] returns 400 Bad Request
2. PATCH /projects/:id with visibleStatuses=['IN_PROGRESS','TODO'] succeeds
3. Commit message includes `[closes SEC-049]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'visibleStatuses\|hiddenStatuses\|IsEnum\|IsString' apps/api/src/projects/dto/update-project.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: update-project.dto.ts lines 14-29 confirmed verbatim. hiddenStatuses uses @IsEnum(TaskStatus, { each: true }); visibleStatuses uses @IsString({ each: true }). The asymmetry is clearly present.

**Closed_by:** (empty — TODO)

---

### SEC-051 — departmentId query parameter in GET /services and GET /skills/matrix is not validated as UUID — invalid values cause DB-level errors surfaced as 500

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation / missing UUID pipe on query param
- **File:** `apps/api/src/services/services.controller.ts:59-75`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-051` · audit-confidence: high · found_by: security

**Description:**
The `departmentId` query parameter in `GET /api/services` (and `GET /api/skills/matrix` in skills.controller.ts line 92) is accepted as a raw string without a `ParseUUIDPipe`. The value is passed directly to Prisma as a `where.departmentId` filter. If the value is not a valid UUID, the PostgreSQL driver raises an `invalid_text_representation` error (PrismaClientKnownRequestError P2023), which propagates as an HTTP 500. The global `AllExceptionsFilter` masks the stack trace in the response, but generates a 500 log entry instead of a clean 400 validation error.

**Root cause:**
Missing `ParseUUIDPipe` (with `optional: true`) on the `departmentId` query parameter in both controller methods.

**Code evidence:**
```
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.servicesService.findAll(page, limit, departmentId);
  }
```

**Suggested fix:**
Apply `@Query('departmentId', new ParseUUIDPipe({ optional: true })) departmentId?: string` in both `ServicesController.findAll()` and `SkillsController.getMatrix()`. The same pattern is already used for path params (e.g., `@Param('departmentId', ParseUUIDPipe)`).

**Acceptance criteria:**
1. GET /api/services?departmentId=not-a-uuid returns HTTP 400 (not 500)
2. GET /api/skills/matrix?departmentId=not-a-uuid returns HTTP 400 (not 500)
3. GET /api/services?departmentId=<valid-uuid> continues to work correctly
4. Commit message includes `[closes SEC-051]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -o /dev/null -w '%{http_code}' 'http://localhost:4000/api/services?departmentId=not-a-uuid' -H 'Authorization: Bearer <token>'  # expect 400, currently returns 500
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: services.controller.ts line 72 has bare @Query('departmentId') with no pipe. skills.controller.ts line 92 has bare @Query('departmentId') with no pipe. skills.service.ts line 365 assigns departmentId directly to whereUser.departmentId and passes to Prisma — no service-level UUID validation. The pattern with ParseUUIDPipe is already used for path params in both files (e.g., services.controller.ts line 89, skills.controller.ts line 114).

**Closed_by:** (empty — TODO)

---

### SEC-052 — UpdateSettingDto.value and .description lack @MaxLength — unbounded strings stored to DB

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/settings/dto/update-setting.dto.ts:4-20`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-052` · audit-confidence: high · found_by: security

**Description:**
The `value` and `description` fields in UpdateSettingDto have `@IsString()` and `@IsNotEmpty()` but no `@MaxLength()`. An authenticated user with `settings:update` permission (admin-tier) can submit arbitrarily long strings that are persisted to the appSettings table. Although `settings:update` is a privileged permission, defence-in-depth requires bounding free-text inputs at the DTO layer to prevent accidental or deliberate memory/storage exhaustion. The global ValidationPipe bodyLimit of 1 MiB provides a coarse backstop, but no per-field cap exists.

**Root cause:**
Missing @MaxLength decorator on `value` and `description` fields in UpdateSettingDto.

**Code evidence:**
```
export class UpdateSettingDto {
  @ApiProperty({
    description: 'La valeur du paramètre (JSON stringifié)',
    example: '"dd/MM/yyyy"',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Description du paramètre',
    example: "Format de date utilisé dans l'application",
  })
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add `@MaxLength(10000)` to `value` and `@MaxLength(500)` to `description` in UpdateSettingDto. Adjust limits based on realistic maximum setting value sizes.

**Acceptance criteria:**
1. Sending a value longer than 10000 chars to PUT /settings/:key returns 400
2. Sending a description longer than 500 chars returns 400
3. Commit message includes `[closes SEC-052]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength\|IsString\|IsNotEmpty' apps/api/src/settings/dto/update-setting.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial re-check: code_evidence verified verbatim at lines 4-19 of update-setting.dto.ts. No @MaxLength import exists in the file. The settings service isKnownKey allowlist prevents writing to unknown keys but does NOT bound the size of the value written to known keys. The 1 MiB bodyLimit is the only backstop.

**Closed_by:** (empty — TODO)

---

### SEC-053 — description fields in CreateSkillDto, CreateDepartmentDto, CreateServiceDto have no @MaxLength

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation / missing MaxLength
- **File:** `apps/api/src/skills/dto/create-skill.dto.ts:27-35`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-053` · audit-confidence: high · found_by: security

**Description:**
The optional `description` field in `CreateSkillDto`, `CreateDepartmentDto`, and `CreateServiceDto` has `@IsString()` and `@IsOptional()` but no `@MaxLength()`. Any authenticated user with the appropriate create/update permission can submit a description of up to 1 MiB. While the global body limit (1 MiB) provides an outer bound, there is no DTO-level constraint preventing storage of a very large description string that could degrade rendering or storage.

**Root cause:**
No `@MaxLength()` decorator was applied to optional free-text description fields in these DTOs.

**Code evidence:**
```
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add `@MaxLength(1000)` (or a business-appropriate limit) to `description` in `CreateSkillDto`, `CreateDepartmentDto`, and `CreateServiceDto`.

**Acceptance criteria:**
1. POST /api/skills with description > 1000 chars returns HTTP 400
2. POST /api/departments with description > 1000 chars returns HTTP 400
3. POST /api/services with description > 1000 chars returns HTTP 400
4. Commit message includes `[closes SEC-053]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified in all three DTOs: create-skill.dto.ts lines 33-35, create-department.dto.ts lines 29-31, create-service.dto.ts lines 31-32 — all have @IsString() @IsOptional() only on description, no @MaxLength.

**Closed_by:** (empty — TODO)

---

### SEC-054 — ImportSkillDto.name and .description lack @MaxLength — inconsistent with CreateSkillDto which enforces @MaxLength(100)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation / missing MaxLength
- **File:** `apps/api/src/skills/dto/import-skills.dto.ts:15-44`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-054` · audit-confidence: high · found_by: security

**Description:**
The `ImportSkillDto` used for bulk import accepts `name` without `@MaxLength` (nor `@MinLength`), and `description` without `@MaxLength`. By contrast, `CreateSkillDto` enforces `@MinLength(2)` and `@MaxLength(100)` on `name`. A caller can embed a `name` of arbitrary length (up to the 1 MiB body limit) in each array element. The service-side validation in `validateImport()` does check `skillData.name.length < 2 || skillData.name.length > 100` and emits an error line — but the DTO itself is the correct place to enforce this, and the `importSkills()` path trusts the data without that same service-level check.

**Root cause:**
The `ImportSkillDto` was not aligned with `CreateSkillDto` when the bulk import feature was added; length constraints were omitted from the import DTO.

**Code evidence:**
```
export class ImportSkillDto {
  @ApiProperty({
    description: 'Nom de la compétence',
    example: 'React',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add `@MinLength(2)` and `@MaxLength(100)` to `name`, and `@MaxLength(500)` to `description` in `ImportSkillDto`, matching the constraints in `CreateSkillDto`.

**Acceptance criteria:**
1. POST /api/skills/import with a skill name > 100 chars returns 400
2. POST /api/skills/import/validate with a skill name < 2 chars returns an error in the response preview
3. Commit message includes `[closes SEC-054]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The service-side validateImport() catches the length issue in the preview path (skills.service.ts lines 597-605), but importSkills() (lines 693-730) does not perform the same check — confirmed by direct reading. The importSkills() path writes to DB with name directly from skillData.name with no length guard.

**Closed_by:** (empty — TODO)

---

### SEC-055 — ImportTaskDto.assigneeEmail has no @IsEmail — email validation is done by case-insensitive Map lookup instead

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · missing-input-validation
- **File:** `apps/api/src/tasks/dto/import-tasks.dto.ts:39-45`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-055` · audit-confidence: medium · found_by: security

**Description:**
The `assigneeEmail` field in `ImportTaskDto` is typed as a string with @IsString() but no @IsEmail() constraint. The import service resolves assignees by looking up the email in a pre-fetched Map (case-insensitive). While functionally this prevents invalid emails from matching, the lack of a DTO-level @IsEmail() means: (1) any string passes validation, (2) extremely long strings are not capped, and (3) the absence of a format check makes the field semantics opaque.

**Root cause:**
Email validation was deferred to the service lookup logic rather than enforced at the DTO boundary.

**Code evidence:**
```
  @ApiProperty({
    description: "Email de l'utilisateur assigné",
    required: false,
  })
  @IsString()
  @IsOptional()
  assigneeEmail?: string;
```

**Suggested fix:**
Add `@IsEmail()` and `@MaxLength(254)` to `assigneeEmail` in `ImportTaskDto`.

**Acceptance criteria:**
1. POST /tasks/project/:id/import with an assigneeEmail of 'not-an-email' returns HTTP 400
2. Commit message includes `[closes SEC-055]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review: verbatim code confirmed at import-tasks.dto.ts lines 39-45. @IsString() only, no @IsEmail(), no @MaxLength. The service-layer lookup provides functional mitigation for email format issues but not for length. Finding confirmed at medium confidence as originally rated.

**Closed_by:** (empty — TODO)

---

### SEC-057 — CreateThirdPartyDto.contactEmail missing @MaxLength

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/third-parties/dto/create-third-party.dto.ts:36-39`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-057` · audit-confidence: high · found_by: security

**Description:**
contactEmail is validated with @IsEmail() which enforces valid email syntax but imposes no explicit byte-length cap. RFC 5321 limits email addresses to 254 characters; class-validator's @IsEmail() may or may not enforce this internally depending on version. The Prisma schema stores this as String? (TEXT in PostgreSQL) with no DB-level length constraint. Explicit @MaxLength(254) documents intent and adds a defence-in-depth layer.

**Root cause:**
@MaxLength not added alongside @IsEmail() on the contactEmail field.

**Code evidence:**
```
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
```

**Suggested fix:**
Add @MaxLength(254) to contactEmail field, consistent with RFC 5321 limits.

**Acceptance criteria:**
1. POST /third-parties with contactEmail of 300 characters returns 400
2. POST /third-parties with a valid email up to 254 chars is accepted
3. Commit message includes `[closes SEC-057]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'contactEmail\|MaxLength\|IsEmail' apps/api/src/third-parties/dto/create-third-party.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: UpdateThirdPartyDto inherits this gap via PartialType(CreateThirdPartyDto). All other string fields in CreateThirdPartyDto (organizationName @MaxLength(255), contactFirstName @MaxLength(100), contactLastName @MaxLength(100), notes @MaxLength(2000)) have explicit MaxLength — contactEmail is the only exception.

**Closed_by:** (empty — TODO)

---

### SEC-058 — description field in CreateTimeEntryDto lacks @MaxLength constraint

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/time-tracking/dto/create-time-entry.dto.ts:71-73`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-058` · audit-confidence: high · found_by: security

**Description:**
The description field in CreateTimeEntryDto has @IsString() and @IsOptional() but no @MaxLength(). The global ValidationPipe has whitelist: true and forbidNonWhitelisted: true but does not impose length constraints. The server body limit is 1 MiB (set in main.ts), which prevents the worst case, but a description field value of ~1 MB is still legal from the validator's perspective and will be persisted verbatim to the database. This is inconsistent with best practices for free-text fields.

**Root cause:**
No @MaxLength decorator was added when the DTO was authored.

**Code evidence:**
```
  @IsString()
  @IsOptional()
  description?: string;
```

**Suggested fix:**
Add @MaxLength(2000) (or an appropriate business-appropriate limit) to the description field:
ʼʼʼtypescript
@IsString()
@IsOptional()
@MaxLength(2000)
description?: string;
ʼʼʼ

**Acceptance criteria:**
1. POST /api/time-tracking with description longer than 2000 characters returns HTTP 400.
2. Commit message includes `[closes SEC-058]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
python3 -c "import sys; print('a'*2001)" | xargs -I{} curl -s -X POST http://localhost:4000/api/time-tracking -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"date":"2026-06-01","hours":4,"activityType":"DEVELOPMENT","taskId":"<uuid>","description":"{}"}' | jq '.statusCode'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim code verified at create-time-entry.dto.ts lines 71-73. No @MaxLength present. The 1 MiB bodyLimit (main.ts line 98, `bodyLimit: 1048576`) caps the absolute worst case. Impact is storage/query-performance rather than a direct security exploit.

**Closed_by:** (empty — TODO)

---

### SEC-059 — CreateUserDto.login and ImportUserDto.login missing @MaxLength — unbounded login field

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/users/dto/create-user.dto.ts:46-52`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-059` · audit-confidence: high · found_by: security

**Description:**
CreateUserDto.login and ImportUserDto.login (same pattern at import-users.dto.ts lines 28-34) have @IsString and @MinLength(3) but no @MaxLength. The RegisterDto.login correctly has @MaxLength(50). Without a cap, an adversary with 'users:create' or 'users:import' can store an arbitrarily long login string in the DB. The DB column may have its own limit (likely varchar), but the DTO layer should enforce it independently for defense-in-depth and to produce a cleaner 400 rather than a DB-layer 500 on overflow.

**Root cause:**
RegisterDto was hardened with @MaxLength(50) but the same constraint was not copied to CreateUserDto and ImportUserDto when they were defined.

**Code evidence:**
```
  @ApiProperty({
    description: 'Login (format: prenom.nom)',
    example: 'marie.martin',
  })
  @IsString()
  @MinLength(3)
  login: string;
```

**Suggested fix:**
Add @MaxLength(50) to CreateUserDto.login and ImportUserDto.login, matching RegisterDto.login.

**Acceptance criteria:**
1. POST /users with a login longer than 50 characters returns 400 Bad Request.
2. POST /users/import with a login longer than 50 characters reports a per-row error, not a 500.
3. Commit message includes `[closes SEC-059]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength\|MinLength' apps/api/src/users/dto/create-user.dto.ts apps/api/src/users/dto/import-users.dto.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: create-user.dto.ts line 49 confirms @MinLength(3) with no @MaxLength on login. import-users.dto.ts line 29 same pattern. Prisma schema shows `login String @unique` with no @db.VarChar(N) — PostgreSQL will map this to TEXT (unbounded), so there is no DB-level cap either. Finding is fully confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-060 — getUsersPresence accepts arbitrary dateStr with no format validation — invalid date causes NaN Date passed to $queryRaw

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/users/users.service.ts:1679-1684`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-060` · audit-confidence: high · found_by: security

**Description:**
The date query parameter is passed directly to new Date(dateStr) without validation. If dateStr is an invalid date string (e.g. 'not-a-date', 'NaN', ''), new Date() produces an Invalid Date object (whose getTime() returns NaN). This NaN Date is then passed as a bound parameter to the Prisma $queryRaw template literal. Prisma will serialize NaN/Invalid Date in a DB-driver-specific way: PostgreSQL will likely reject it with a type error (500 Internal Server Error), but the error message from AllExceptionsFilter is safely opaqued to 'Internal server error'. The path is: GET /users/presence?date=<badstring> → service crash → 500. This is a denial-of-service concern and a poor user experience. The SQL injection risk is nil because Prisma's tagged template literal parameterizes values.

**Root cause:**
The date query parameter is not validated before use — no regex or isValid() check, no DTO validator.

**Code evidence:**
```
  async getUsersPresence(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
```

**Suggested fix:**
In the controller, add a query parameter validator: either use a custom pipe (@Query('date', new ParseDatePipe())) or add a guard in the service: `if (dateStr && isNaN(new Date(dateStr).getTime())) throw new BadRequestException('Date format invalide — use YYYY-MM-DD');`

**Acceptance criteria:**
1. GET /users/presence?date=not-a-date returns 400 Bad Request.
2. GET /users/presence?date=2026-06-04 returns 200 with presence data.
3. Commit message includes `[closes SEC-060]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: controller at line 185 passes raw string directly: `getUsersPresence(@Query('date') date?: string)` with no pipe. Service line 1679-1684 verbatim confirmed. No isNaN guard present. No injection risk (parameterized), but 500 on invalid date is confirmed real.

**Closed_by:** (empty — TODO)

---

### OBS-022 — comments: create/update/delete emit no audit_log row

- **Status:** TODO
- **Phase:** 4
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/comments/comments.service.ts:160-184`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-022` · audit-confidence: high · found_by: observability

**Description:**
CommentsService has no AuditPersistenceService injected. create() (line 38), update() (line 128), and remove() (line 160) emit no audit_log rows. The remove() path at line 160 explicitly allows a user with comments:delete_any, projects:manage_any, or tasks:manage_any to delete another user's comment; this management-level action on behalf of others warrants an audit trail. Severity is nit because comments are lower-sensitivity than HR/financial data.

**Root cause:**
AuditPersistenceService was never injected into CommentsService.

**Code evidence:**
```
  async remove(id: string, userId: string, currentUser?: AccessUser) {
    const comment = await this.findOne(id, currentUser);

    // Seul l'auteur ou un rôle de gestion globale peut supprimer le commentaire d'autrui.
    if (comment.authorId !== userId) {
      const permissions = (await this.permissionsService.getPermissionsForRole(
        currentUser?.role
          ? typeof currentUser.role === 'string'
            ? currentUser.role
            : currentUser.role.code
          : null,
      )) as readonly string[];
```

**Suggested fix:**
Inject AuditPersistenceService. Emit COMMENT_DELETED (with the comment snapshot) at minimum for the cross-ownership deletion path. COMMENT_CREATED and COMMENT_UPDATED are lower priority.

**Acceptance criteria:**
1. DELETE /comments/:id where actorId != comment.authorId produces an audit_log row
2. Commit message includes `[closes OBS-022]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 160-184 matches verbatim. No AuditPersistenceService import or injection found in comments.service.ts.

**Closed_by:** (empty — TODO)

---

### OBS-024 — events: create/update/delete and participant mutations emit no audit_log row

- **Status:** TODO
- **Phase:** 4
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-log
- **File:** `apps/api/src/events/events.service.ts:578-585`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-024` · audit-confidence: high · found_by: observability

**Description:**
EventsService has no AuditPersistenceService injected. None of create() (line 82), update() (line 411), remove() (line 565), addParticipant() (line 735), removeParticipant() (line 829), or stopRecurrence() (line 791) emit an audit log row. Events can be linked to projects and carry participant lists; their modification or deletion is a lightweight coordination action rather than a sensitive HR/financial mutation. Severity is nit rather than important because events are lower-risk than leave/telework/settings, though completeness of the audit trail is affected.

**Root cause:**
AuditPersistenceService was never injected into EventsService.

**Code evidence:**
```
    await this.prisma.event.delete({
      where: { id },
    });

    return { message: 'Événement supprimé avec succès' };
  }

  /**
   * Récupérer les événements d'un utilisateur
```

**Suggested fix:**
Inject AuditPersistenceService and emit EVENT_CREATED, EVENT_UPDATED, EVENT_DELETED, EVENT_PARTICIPANT_ADDED, EVENT_PARTICIPANT_REMOVED audit rows. Since these are high-frequency, use void + .catch() (fire-and-forget) as per the existing DOCUMENT_READ pattern in documents.service.ts.

**Acceptance criteria:**
1. DELETE /events/:id produces an audit_log row
2. POST /events/:id/participants produces an audit_log row
3. Commit message includes `[closes OBS-024]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code at lines 578-585 matches verbatim (delete at line 580, message return at line 584). No AuditPersistenceService import or injection found in events.service.ts.

**Closed_by:** (empty — TODO)

---

### OBS-025 — Project member add/update/remove emit no audit rows

- **Status:** TODO
- **Phase:** 4
- **Cluster:** G
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-audit-project-members
- **File:** `apps/api/src/projects/projects.service.ts:891-1041`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-025` · audit-confidence: high · found_by: observability

**Description:**
The three project membership methods — `addMember()` (lines 891–951), `updateMember()` (lines 957–1003), and `removeMember()` (lines 1008–1041) — perform DB writes with no audit emission. Project membership defines who has access to a project and in what role (allocation, project role). Adding/removing members changes the project's permission perimeter but is untracked.

**Root cause:**
Project membership management never received audit instrumentation.

**Code evidence:**
```
  async addMember(projectId: string, addMemberDto: AddMemberDto) {
    // ...
    // Ajouter le membre
    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: role || 'Membre',
        ...(allocation !== undefined && { allocation }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
```

**Suggested fix:**
Add PROJECT_MEMBER_ADDED / PROJECT_MEMBER_REMOVED / PROJECT_MEMBER_UPDATED to AuditAction and ENTITY_TYPE_BY_ACTION. Emit in each method after the DB write.

**Acceptance criteria:**
1. After POST /projects/:id/members, an audit_logs row with action='PROJECT_MEMBER_ADDED' exists
2. Commit message includes `[closes OBS-025]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'addMember\|removeMember\|updateMember\|auditPersistence' apps/api/src/projects/projects.service.ts | head -20
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: addMember() at 891-951, updateMember() at 957-1003, removeMember() at 1008-1041 confirmed verbatim. No audit calls present. The only audit calls in projects.service.ts are at lines 710, 748, 855 (all outside member-management range). Finding confirmed.

**Closed_by:** (empty — TODO)

---

### DAT-028 — audit_logs actorId FK retains ON UPDATE CASCADE after migration removes ON DELETE CASCADE — asymmetry can trigger immutability violation

- **Status:** TODO
- **Phase:** 4
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_immutability
- **File:** `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:101-104`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-028` · audit-confidence: high · found_by: data_integrity

**Description:**
The migration's stated rationale (step 5 comment, lines 95-99) is that the previous ON DELETE SET NULL caused a cascade UPDATE on audit_logs rows which would be rejected by the immutability trigger (step 6) — so it was changed to ON DELETE NO ACTION. However the migration then re-adds ON UPDATE CASCADE on the same FK. If a users.id value were ever changed (e.g., by a migration that reassigns primary keys, an admin fix, or a future user-merge feature), the cascade UPDATE on audit_logs would fire the immutability trigger and abort the users UPDATE with a confusing 'audit_logs is append-only' error. The risk is latent since uuid ids are immutable in practice, but the asymmetry contradicts the stated design principle.

**Root cause:**
The migration author correctly removed ON DELETE CASCADE/SET NULL to avoid cascade writes hitting the immutability trigger, but did not extend the same reasoning to ON UPDATE CASCADE.

**Code evidence:**
```
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
```

**Suggested fix:**
Change ON UPDATE CASCADE to ON UPDATE NO ACTION to be consistent with the ON DELETE NO ACTION:
ʼʼʼsql
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ʼʼʼ
The actorEmail/actorLabel snapshot columns already preserve actor identity for the audit record, so there is no data preservation need for cascading an id update.

**Acceptance criteria:**
1. audit_logs actorId FK uses ON UPDATE NO ACTION
2. Attempting to UPDATE users.id raises a FK violation (23503), not an immutability violation (23514)
3. Commit message includes `[closes DAT-028]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql $DATABASE_URL -c "SELECT confupdtype FROM pg_constraint WHERE conname='audit_logs_actorId_fkey';" 2>&1 | grep -E 'a|r'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: pg_constraint.confupdtype: 'a' = NO ACTION, 'c' = CASCADE, 'r' = RESTRICT. Current state after migration: 'c' (CASCADE). Expected after fix: 'a' (NO ACTION). Code evidence verbatim confirmed at lines 101-104. No subsequent migration modifies this FK — the most recent migration touching audit_logs (20260604103344_dat008_026_user_fk_full_erasure) explicitly states 'NOT touched: audit_logs.actorId' in its header comment. users.id uses @default(uuid()) in schema.prisma — UUID reassignment is not done in practice by any existing service method, confirming low probability but non-zero architectural … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### DAT-019 — project_members.allocation has no CHECK BETWEEN 0 AND 100 — negative or impossible percentages accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20251116093059_init/migration.sql:112`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-019` · audit-confidence: low · found_by: data_integrity

**Description:**
project_members.allocation represents a percentage allocation of a team member's time to a project. No CHECK constraint enforces the [0, 100] range. Values like allocation=200 or allocation=-10 are silently accepted, producing misleading capacity planning data.

**Root cause:**
No database-level constraint enforcing the percentage domain; only application-layer DTO validation guards this.

**Code evidence:**
```
    "allocation" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
```

**Suggested fix:**
ALTER TABLE project_members ADD CONSTRAINT project_members_allocation_ck CHECK (allocation BETWEEN 0 AND 100). Fixed by later migration 20260527120000_dat003_dat004_business_invariants.

**Acceptance criteria:**
1. INSERT INTO project_members (allocation) VALUES (101) raises check constraint violation
2. Commit message includes `[closes DAT-019]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='project_members'::regclass AND contype='c';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 112 of init migration. Fixed by migration 20260527120000_dat003_dat004_business_invariants which adds project_members_allocation_ck CHECK (allocation BETWEEN 0 AND 100). Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-020 — tasks.progress and epics.progress have no CHECK BETWEEN 0 AND 100 — negative or >100 values accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20251116093059_init/migration.sql:126-161`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-020` · audit-confidence: low · found_by: data_integrity

**Description:**
Both epics.progress and tasks.progress are INTEGER columns with no CHECK constraint. Values outside [0, 100] are silently accepted at the DB level. While DTO validation exists at the application layer, a buggy service path or direct SQL write can store progress=150 or progress=-5, corrupting dashboards and analytics that assume a percentage.

**Root cause:**
Prisma does not support CHECK constraints in its DSL; hand-authored CHECK migration was not added alongside the column definition.

**Code evidence:**
```
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epics_pkey" PRIMARY KEY ("id")
...
    "progress" INTEGER NOT NULL DEFAULT 0,
```

**Suggested fix:**
ALTER TABLE tasks ADD CONSTRAINT tasks_progress_ck CHECK (progress BETWEEN 0 AND 100); same for epics. Fixed by later migration 20260527120000_dat003_dat004_business_invariants.

**Acceptance criteria:**
1. INSERT INTO tasks (progress) VALUES (101) raises check constraint violation
2. INSERT INTO epics (progress) VALUES (-1) raises check constraint violation
3. Commit message includes `[closes DAT-020]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='tasks'::regclass AND contype='c' AND conname='tasks_progress_ck';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 126 and 161 of init migration. Fixed by migration 20260527120000_dat003_dat004_business_invariants which adds tasks_progress_ck CHECK (progress BETWEEN 0 AND 100) and epics_progress_ck CHECK (progress BETWEEN 0 AND 100). Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-021 — time_entries.hours has no CHECK for positive value or daily cap — zero and negative entries accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20251116093059_init/migration.sql:198`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-021` · audit-confidence: low · found_by: data_integrity

**Description:**
time_entries.hours is NOT NULL but has no CHECK constraint. Negative hours (e.g., -2.0) or absurdly large values (e.g., 1000) are accepted. The DTO layer enforces @Min(0.25) @Max(24) but a buggy service path bypasses this. A row with hours=-5 silently reduces project hour totals and causes incorrect billing calculations.

**Root cause:**
No CHECK constraint at the DB level; only DTO validation at the application boundary.

**Code evidence:**
```
    "hours" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
```

**Suggested fix:**
ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_ck CHECK (hours >= 0 AND hours <= 24). Fixed by later migration 20260528120000_dat032_dat033_position_and_hours_bounds.

**Acceptance criteria:**
1. INSERT INTO time_entries (hours) VALUES (-1) raises check constraint violation
2. INSERT INTO time_entries (hours) VALUES (25) raises check constraint violation
3. Commit message includes `[closes DAT-021]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='time_entries'::regclass AND contype='c' AND conname='time_entries_hours_ck';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 198 of init migration. Fixed by migration 20260528120000_dat032_dat033_position_and_hours_bounds which adds time_entries_hours_ck CHECK (hours >= 0 AND hours <= 24). Note: the fix uses >= 0 (not > 0) to accommodate legitimate dismissal rows with hours=0 (101 such rows existed in dev DB at time of migration). Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-022 — leaves.days has no CHECK > 0 — zero-day and negative leave records accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20251116093059_init/migration.sql:215`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-022` · audit-confidence: low · found_by: data_integrity

**Description:**
leaves.days is NOT NULL but has no CHECK constraint. A zero or negative day count is a logical impossibility for a leave request. Without this guard, a buggy or malicious caller could create a leave with days=0 (a no-op that still blocks approval queues) or days=-5 (that would inflate computed leave balances).

**Root cause:**
No CHECK at the DB level enforcing the business invariant that a leave duration must be strictly positive.

**Code evidence:**
```
    "days" DOUBLE PRECISION NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'APPROVED',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
```

**Suggested fix:**
ALTER TABLE leaves ADD CONSTRAINT leaves_days_ck CHECK (days > 0). Fixed by later migration 20260527120000_dat003_dat004_business_invariants.

**Acceptance criteria:**
1. INSERT INTO leaves (days) VALUES (0) raises check constraint violation
2. INSERT INTO leaves (days) VALUES (-1) raises check constraint violation
3. Commit message includes `[closes DAT-022]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='leaves'::regclass AND contype='c' AND conname='leaves_days_ck';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 215 of init migration. Fixed by migration 20260527120000_dat003_dat004_business_invariants which adds leaves_days_ck CHECK (days > 0). Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-023 — tasks.startTime, tasks.endTime, events.startTime, events.endTime stored as TEXT without format validation at DB level

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · text_time_fields
- **File:** `packages/database/prisma/migrations/20260104102501_add_holidays_and_task_fields/migration.sql:12-13`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-023` · audit-confidence: low · found_by: data_integrity

**Description:**
startTime and endTime for tasks and events are stored as TEXT. No CHECK constraint enforces HH:MM format at the database level. Values like '25:99', '9:5', or empty strings are silently accepted. This allows malformed time values to enter the database and corrupt planning, export, and scheduling features that rely on string comparison and parsing.

**Root cause:**
Using TEXT for time-of-day is a reasonable choice to avoid Prisma DateTime overhead, but without a format CHECK constraint the DB accepts any string.

**Code evidence:**
```
ALTER TABLE "tasks" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;
```

**Suggested fix:**
ADD CONSTRAINT tasks_startTime_format_ck CHECK (startTime ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'); same for endTime. Fixed by later migration 20260527140000_dat013_time_format_check.

**Acceptance criteria:**
1. INSERT INTO tasks (startTime) VALUES ('25:00') raises check constraint violation
2. INSERT INTO tasks (startTime) VALUES ('9:5') raises check constraint violation
3. Commit message includes `[closes DAT-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='tasks'::regclass AND contype='c' AND conname LIKE '%time%';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 12-13 of add_holidays_and_task_fields migration. Fixed by migration 20260527140000_dat013_time_format_check which adds tasks_startTime_format_ck, tasks_endTime_format_ck, events_startTime_format_ck, events_endTime_format_ck, predefined_tasks_startTime_format_ck, predefined_tasks_endTime_format_ck with regex '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'. Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-024 — events.recurrenceDay has no CHECK constraint — invalid day-of-week/month values silently accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260224231534_add_event_recurrence/migration.sql:4`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-024` · audit-confidence: medium · found_by: data_integrity

**Description:**
events.recurrenceDay is a nullable INTEGER representing a day-of-week or day-of-month for recurring event logic. No CHECK constraint bounds the value. A value of 32 or -1 would silently corrupt recurring event expansion. Similarly, recurrenceWeekInterval has no CHECK >= 1 constraint, allowing zero or negative intervals that would create infinite or backward-expanding recurrences.

**Root cause:**
Recurrence columns added as bare INTEGERs without domain constraints; only application-layer validation guards these.

**Code evidence:**
```
ADD COLUMN     "recurrenceDay" INTEGER,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceWeekInterval" INTEGER;
```

**Suggested fix:**
ALTER TABLE events ADD CONSTRAINT events_recurrenceDay_ck CHECK ("recurrenceDay" BETWEEN 0 AND 6); ALTER TABLE events ADD CONSTRAINT events_recurrenceWeekInterval_ck CHECK ("recurrenceWeekInterval" >= 1);

**Acceptance criteria:**
1. INSERT into events with recurrenceDay=8 raises constraint violation
2. INSERT into events with recurrenceWeekInterval=0 raises constraint violation
3. Commit message includes `[closes DAT-024]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='events'::regclass AND contype='c';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 4-6 of add_event_recurrence migration. Searched all migration SQL files for 'recurrenceDay' and 'recurrenceWeekInterval' combined with 'check' or 'constraint' — found zero results. Only the creation migration references these columns; no later migration adds CHECK constraints. REMAINS OPEN — no fix migration exists. Confidence stays medium because recurrenceDay semantic range depends on application logic (may be 0-6 for weekly or 1-31 for monthly).

**Closed_by:** (empty — TODO)

---

### DAT-025 — password_reset_tokens.createdById CASCADE — deleting admin who created token cascades to delete active token

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · cascade_creator_fk
- **File:** `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:121`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-025` · audit-confidence: low · found_by: data_integrity

**Description:**
The createdById FK on password_reset_tokens cascades on delete. If an admin who created a password reset token is themselves deleted before the token is used, the cascade silently deletes the token, causing the password reset link to return 'invalid token' without any explanation. This is a user-facing data loss scenario.

**Root cause:**
Cascade chosen for convenience without considering the lifecycle mismatch between the creator (admin) and the artifact (password reset token).

**Code evidence:**
```
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Suggested fix:**
Change to ON DELETE SET NULL (with createdById nullable) or ON DELETE RESTRICT. Fixed by later migration 20260604103344_dat008_026_user_fk_full_erasure which changes to SET NULL.

**Acceptance criteria:**
1. Deleting an admin user does not delete their issued password_reset_tokens rows
2. password_reset_tokens.createdById is set to NULL when the creator is deleted
3. Commit message includes `[closes DAT-025]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT confdeltype FROM pg_constraint WHERE conname='password_reset_tokens_createdById_fkey';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at line 121 of add_predefined_tasks_telework_recurring_password_reset migration. Fixed by migration 20260604103344_dat008_026_user_fk_full_erasure which drops password_reset_tokens_createdById_fkey, makes createdById nullable, and re-adds it with ON DELETE SET NULL. Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-026 — predefined_tasks.defaultDuration and predefined_task_assignments.period stored as TEXT — any string accepted

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · text_enum_columns
- **File:** `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:22-40`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-026` · audit-confidence: low · found_by: data_integrity

**Description:**
defaultDuration and period are TEXT columns intended to hold closed value sets ('HALF_DAY', 'FULL_DAY', 'TIME_SLOT' and 'MORNING', 'AFTERNOON', 'FULL_DAY' respectively). Without a CHECK constraint or enum type, any string is accepted. A typo like 'HALF_DAI' or 'FULLDAY' would silently corrupt assignment scheduling logic.

**Root cause:**
Closed string value sets were implemented as TEXT without enum type or CHECK constraint; Prisma does not enforce string enums at the DB level.

**Code evidence:**
```
    "defaultDuration" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
...
    "period" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
```

**Suggested fix:**
Promote to native PostgreSQL enum types or add CHECK constraints. Fixed by later migration 20260527130000_dat012_promote_string_enums which converts these to proper enums.

**Acceptance criteria:**
1. INSERT INTO predefined_tasks (defaultDuration) VALUES ('INVALID') raises type error or check violation
2. INSERT INTO predefined_task_assignments (period) VALUES ('INVALID') raises type error or check violation
3. Commit message includes `[closes DAT-026]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "\d predefined_tasks" | grep defaultDuration
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 24 and 37 of add_predefined_tasks_telework_recurring_password_reset migration. Fixed by migration 20260527130000_dat012_promote_string_enums which creates PredefinedTaskDuration, DayPeriod, AssignmentCompletionStatus, RecurrenceType, AppSettingsCategory enums and converts columns accordingly. Downgraded to low confidence — issue resolved in current schema state; retained as historical record only.

**Closed_by:** (empty — TODO)

---

### DAT-027 — telework_recurring_rules.dayOfWeek and predefined_task_recurring_rules.dayOfWeek have no CHECK BETWEEN 0 AND 6

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:7-53`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-027` · audit-confidence: high · found_by: data_integrity

**Description:**
Both telework_recurring_rules.dayOfWeek and predefined_task_recurring_rules.dayOfWeek store a day-of-week as INTEGER. No CHECK constraint ensures the value is in [0, 6] (Sunday=0 to Saturday=6). A value of 7 or -1 would silently corrupt the recurring schedule logic without any database-level rejection. No later migration adds this constraint.

**Root cause:**
Day-of-week semantics encoded as bare INTEGER without domain enforcement; no CHECK added in any subsequent migration.

**Code evidence:**
```
    "dayOfWeek" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
...
    "dayOfWeek" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
```

**Suggested fix:**
ALTER TABLE telework_recurring_rules ADD CONSTRAINT telework_recurring_rules_dayofweek_ck CHECK ("dayOfWeek" BETWEEN 0 AND 6); ALTER TABLE predefined_task_recurring_rules ADD CONSTRAINT predefined_task_recurring_rules_dayofweek_ck CHECK ("dayOfWeek" BETWEEN 0 AND 6);

**Acceptance criteria:**
1. INSERT INTO telework_recurring_rules (dayOfWeek) VALUES (7) raises check constraint violation
2. INSERT INTO predefined_task_recurring_rules (dayOfWeek) VALUES (-1) raises check constraint violation
3. Commit message includes `[closes DAT-027]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
psql -c "SELECT conname FROM pg_constraint WHERE conrelid='telework_recurring_rules'::regclass AND contype='c';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 5 and 52 of add_predefined_tasks_telework_recurring_password_reset migration. Searched all migration SQL files for any 'dayOfWeek' combined with 'check' or 'constraint' — found zero results. Migration 20260424124537_add_recurrence_and_completion makes dayOfWeek nullable in predefined_task_recurring_rules (for MONTHLY_ORDINAL/MONTHLY_DAY recurrence types) but adds no CHECK. REMAINS OPEN — no fix migration exists.

**Closed_by:** (empty — TODO)

---

### DAT-029 — documents.contentSha256 is TEXT with no CHECK constraint — any arbitrary string can be stored as a SHA-256 hash

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_length_check_on_hash_column
- **File:** `packages/database/prisma/migrations/20260603214608_dat025_document_fk_softdelete/migration.sql:2-3`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-029` · audit-confidence: high · found_by: data_integrity

**Description:**
The contentSha256 column stores a SHA-256 hex digest (64 hex characters). It is declared as TEXT (unbounded) with no CHECK constraint. This allows storing values of incorrect length (e.g. 32 chars for MD5, or truncated values) or non-hex characters without DB-level rejection. While the column is described as nullable ('no upload pipeline yet'), once it is populated by the upload service, a corrupted or wrong-format hash will silently pass validation and could later lead to incorrect integrity checks.

**Root cause:**
Column declared as TEXT without a length constraint or format CHECK; SHA-256 hex digests have a fixed length of 64 characters.

**Code evidence:**
```
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contentSha256" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "uploadedBy" DROP NOT NULL;
```

**Suggested fix:**
Change to a fixed-length type or add a CHECK constraint:
ʼʼʼsql
ALTER TABLE "documents" ALTER COLUMN "contentSha256" TYPE CHAR(64);
-- or:
ALTER TABLE "documents" ADD CONSTRAINT "documents_contentSha256_ck" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$');
ʼʼʼ
Also standardize on lowercase hex output in the upload pipeline.

**Acceptance criteria:**
1. INSERT of a 32-character string into documents.contentSha256 fails with a constraint error
2. INSERT of a non-hex string into documents.contentSha256 fails with a constraint error
3. INSERT of a valid 64-character lowercase hex string succeeds
4. Commit message includes `[closes DAT-029]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
SELECT id, contentSha256 FROM documents WHERE contentSha256 IS NOT NULL AND contentSha256 !~ '^[0-9a-f]{64}$'; -- should return 0 rows if data is clean
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CONFIRMED. Code evidence is verbatim. Full search of all migrations confirms contentSha256 appears only once (in dat025_document_fk_softdelete) and no subsequent migration adds a CHECK constraint. Schema.prisma declares it as `String?` (TEXT in PostgreSQL) with comment 'nullable — no upload pipeline yet'. Pre-emptive but appropriate to flag before the pipeline is built.

**Closed_by:** (empty — TODO)

---

### PER-055 — TeleworkSchedule: no index on (userId, date) range queries — only unique constraint

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing-index
- **File:** `apps/api/src/telework/telework.service.ts:431-449`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-055` · audit-confidence: medium · found_by: performance

**Description:**
The `TeleworkSchedule` model (schema line 733) declares `@@unique([userId, date])` but no separate `@@index([userId, date])`. Postgres creates a B-tree index on the unique constraint, which IS usable for range queries on `(userId, date)`. However, `findForPlanningOverview` queries `userId: { in: [...new Set(userIds)] }, date: { gte, lte }` — an IN list on userId with a date range. The unique constraint index on `(userId, date)` would be used for single-user lookups, but for multi-userId IN list queries Postgres may choose a bitmap index scan or sequential scan instead depending on cardinality. The schema has no composite index optimised for this access pattern.

**Root cause:**
The `@@unique` serves integrity, not query performance for multi-user range scans; no dedicated range index exists.

**Code evidence:**
```
    const teleworks = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });
```

**Suggested fix:**
Add `@@index([date, userId])` to `TeleworkSchedule` to complement the unique constraint, optimising the date-range-first queries used in planning overview.

**Acceptance criteria:**
1. EXPLAIN ANALYZE on `SELECT * FROM telework_schedules WHERE user_id IN (...) AND date BETWEEN ? AND ?` shows an Index Scan not a Seq Scan for tables with > 10k rows
2. Commit message includes `[closes PER-055]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Schema confirmed: only @@unique([userId, date]) at line 733, no @@index([date, userId]). The Postgres query planner may already use the unique index effectively for small tables; this finding applies at scale. Verified code evidence at lines 431-449 of telework.service.ts.

**Closed_by:** (empty — TODO)

---

### PER-060 — PredefinedTaskAssignment has no index on predefinedTaskId — per-task assignment lookups may seq-scan

- **Status:** TODO
- **Phase:** 4
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing index
- **File:** `packages/database/prisma/schema.prisma:1081-1108`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-060` · audit-confidence: medium · found_by: performance

**Description:**
The unique constraint on `(predefinedTaskId, userId, date, period)` has `predefinedTaskId` as the leading column, so per-task queries (`WHERE predefinedTaskId = X`) use this unique index. However, queries on `(userId)` alone (which is the second column of the unique) cannot use the unique index efficiently. The `findAssignments` method in the service filters by `userId` and optionally `predefinedTaskId` and `date`; when only `userId` is supplied, the `[date, userId]` composite index can be used (userId is the trailing column), but filtering by `userId` only (no date) would require a full scan.

**Root cause:**
No dedicated `@@index([userId])` for the `predefinedTaskId` + `userId` filter combination when predefinedTaskId is not present.

**Code evidence:**
```
model PredefinedTaskAssignment {
  id                  String    @id @default(uuid())
  predefinedTaskId    String
  userId              String
  date                DateTime
  period              DayPeriod // DAT-012: was String "MORNING"|"AFTERNOON"|"FULL_DAY"
  assignedById        String?
  isRecurring         Boolean   @default(false)
  recurringRuleId     String?   
  completionStatus    AssignmentCompletionStatus @default(NOT_DONE) // DAT-012: was String
  completedAt         DateTime?
  completedById       String?   
  notApplicableReason String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([predefinedTaskId, userId, date, period])
  @@index([date, userId])
  @@index([completionStatus, date])
```

**Suggested fix:**
Add `@@index([userId]) // reverse-lookup for per-user assignment queries` to `PredefinedTaskAssignment`.

**Acceptance criteria:**
1. EXPLAIN on SELECT ... FROM predefined_task_assignments WHERE user_id = $1 shows Index Scan
2. Commit message includes `[closes PER-060]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
docker exec orchestr-a-db psql -U postgres -d orchestra -c "EXPLAIN SELECT * FROM predefined_task_assignments WHERE user_id = 'test';"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The `[date, userId]` composite index covers the common (date-scoped) query path. This finding only applies to unbounded userId-only queries.

**Closed_by:** (empty — TODO)

---

### COR-048 — daysFromNow in MilestonesCompletionService uses fixed MS_PER_DAY, off-by-one across DST transitions

- **Status:** TODO
- **Phase:** 4
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · dst_sensitivity
- **File:** `apps/api/src/analytics/advanced/services/milestones-completion.service.ts:20-98`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-048` · audit-confidence: medium · found_by: correctness

**Description:**
Dividing a millisecond delta by a fixed `MS_PER_DAY` (86400000 ms) is incorrect across DST boundaries. On the Europe/Paris clock (used by the scheduler) the spring-forward transition produces a 23-hour day and the fall-back transition a 25-hour day. A milestone due exactly at midnight on the day after DST change can produce `daysFromNow = 0` when it should be `1` (or vice-versa). `Math.round` mitigates but does not fully eliminate the issue for milestones due within the transition hour.

**Root cause:**
Using a fixed millisecond constant for 'one day' ignores DST; the correct approach is calendar-aware date arithmetic (e.g. UTC midnight difference).

**Code evidence:**
```
const MS_PER_DAY = 1000 * 60 * 60 * 24;
...
      const dayMs = milestone.dueDate.getTime() - now.getTime();
      const daysFromNow = Math.round(dayMs / MS_PER_DAY);
```

**Suggested fix:**
Compute `daysFromNow` using UTC midnight differences: `const nowMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); const dueMidnightUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); const daysFromNow = Math.round((dueMidnightUTC - nowMidnightUTC) / MS_PER_DAY);`

**Acceptance criteria:**
1. daysFromNow is correct on both sides of a Europe/Paris DST boundary
2. Unit test with mocked 'now' at a DST transition date verifies correct daysFromNow value
3. Commit message includes `[closes COR-048]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed: MS_PER_DAY at line 20, daysFromNow computation at lines 97-98. Low blast radius — affects display only. The aggregate overdue/completed/upcoming counts use direct date comparison (milestone.dueDate < now) which is unaffected by this issue.

**Closed_by:** (empty — TODO)

---

### COR-064 — getUsersPresence(): setHours(0,0,0,0) uses local server timezone — presence window is offset when Node.js process timezone differs from UTC

- **Status:** TODO
- **Phase:** 4
- **Cluster:** J
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · date-time / timezone
- **File:** `apps/api/src/users/users.service.ts:1680-1684`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-064` · audit-confidence: medium · found_by: correctness

**Description:**
setHours() operates in the local timezone of the Node.js process. When a client sends dateStr='2026-06-04', new Date('2026-06-04') parses as UTC midnight. Then setHours(0,0,0,0) converts to LOCAL midnight — which may differ from UTC midnight if the container TZ differs from UTC. The resulting timestamps are then passed to PostgreSQL (which stores in UTC) as Prisma tagged-template literals. If the Node process and PostgreSQL are both UTC this is a no-op, but there is no TZ=UTC enforcement in Docker or the runtime. MEMORY.md states 'Prod=UTC' for the DB, but the Node process TZ is not pinned.

**Root cause:**
Using setHours() (local-time) instead of UTC-equivalent operations (setUTCHours or explicit UTC string construction) for day boundary computation.

**Code evidence:**
```
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
```

**Suggested fix:**
Replace setHours(0,0,0,0) with setUTCHours(0,0,0,0) and setHours(23,59,59,999) with setUTCHours(23,59,59,999). Alternatively, construct the boundaries from the date string directly: `new Date(dateStr + 'T00:00:00.000Z')` and `new Date(dateStr + 'T23:59:59.999Z')`.

**Acceptance criteria:**
1. When the Node.js process TZ is set to Europe/Paris, GET /users/presence?date=2026-06-04 returns the same result as when TZ=UTC.
2. PostgreSQL receives timestamps that represent UTC midnight of the requested date.
3. Commit message includes `[closes COR-064]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
TZ=Europe/Paris node -e "const d=new Date('2026-06-04'); d.setHours(0,0,0,0); console.log(d.toISOString());"
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Low practical impact if the Docker container always runs TZ=UTC (common default), but not enforced in code — marked nit rather than blocking. Adversarial check: neither docker-compose.yml nor docker-compose.prod.yml set TZ environment variable for the API container, confirming no enforcement. Code evidence verbatim at lines 1680-1684.

**Closed_by:** (empty — TODO)

---

### OBS-023 — req.body.login not in Fastify redact paths — user identifier would appear in logs if body serialization is enabled

- **Status:** TODO
- **Phase:** 4
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · pii-in-redact-gap
- **File:** `apps/api/src/common/fastify/redact.config.ts:1-37`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-023` · audit-confidence: high · found_by: observability

**Description:**
The login DTO (auth/dto/login.dto.ts) uses the field name 'login' (not 'email') for the user's identifier. The redact config does not include 'req.body.login'. Fastify's built-in pino logger does NOT serialize request bodies by default, so in normal operation this field never reaches log output. However, if a custom serializer or log middleware is added later that serializes the request body, the login identifier (a 'prenom.nom' string that is PII for French public servants) would appear in structured logs unredacted. The risk is latent, not currently exploited.

**Root cause:**
The redact path list was likely built around the password fields specifically; the login identifier was not considered a redaction target because Fastify does not log bodies by default.

**Code evidence:**
```
export const fastifyLoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      // Request headers
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["proxy-authorization"]',

      // Request body — auth / token fields
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.refreshToken',
      'req.body.token',
```

**Suggested fix:**
Add 'req.body.login' to the redact paths array in redact.config.ts as a defensive measure. Also add the corresponding test in redact.config.spec.ts. This is a one-line addition with no functional impact.

**Acceptance criteria:**
1. 'req.body.login' appears in fastifyLoggerOptions.redact.paths
2. redact.config.spec.ts has a test asserting paths contains 'req.body.login'
3. Commit message includes `[closes OBS-023]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep 'req.body.login' apps/api/src/common/fastify/redact.config.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. Code evidence for lines 1-37 is verbatim correct (minor quote style difference: file uses straight quotes, finding uses escaped double quotes, but content is semantically identical). The full redact.config.ts was read: req.body.login does NOT appear in paths. Severity remains nit because Fastify does not serialize bodies by default — the risk is latent.

**Closed_by:** (empty — TODO)

---

### SEC-034 — Stdout audit log uses unkeyed plain SHA256 (8 chars) for attempted-login identifier — rainbow-table reversible for common emails

- **Status:** TODO
- **Phase:** 4
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · information-disclosure
- **File:** `apps/api/src/audit/audit.service.ts:103-104`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-034` · audit-confidence: high · found_by: security

**Description:**
For the stdout security log entry, attempted login emails are hashed with plain SHA256 (no HMAC key, no salt). The 8-character hex truncation reduces brute-force space but SHA256 is publicly computable and preimage-computable for any email in a dictionary. Server logs are 'broadly shipped' (per comments) to log aggregators like CloudWatch/ELK. An attacker with read access to logs can rainbow-table-reverse the 8-char hash against a list of known usernames/emails for the organization. Note: the persisted DB value uses a proper HMAC-keyed hash (hashAttemptedSubject) — only the stdout path is affected.

**Root cause:**
hashAttemptedLogin uses createHash('sha256') without a secret key, making it dictionary-reversible unlike the keyed HMAC used for DB persistence.

**Code evidence:**
```
const hashAttemptedLogin = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 8);
```

**Suggested fix:**
Use the same HMAC key (AUDIT_HASH_KEY) for the stdout digest as for DB persistence: createHmac('sha256', process.env.AUDIT_HASH_KEY).update(value.trim().toLowerCase()).digest('hex').slice(0, 8). This makes the stdout hash correlation-usable without being dictionary-reversible.

**Acceptance criteria:**
1. hashAttemptedLogin is replaced with a keyed HMAC using AUDIT_HASH_KEY
2. Unit test verifies the stdout digest is not equal to unkeyed sha256 of the same input
3. AUDIT_HASH_KEY validation at boot (assertAuditHashKey) already covers this — no new boot assertion needed
4. Commit message includes `[closes SEC-034]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: inspect audit.service.ts hashAttemptedLogin implementation
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 103-104. DB persistence path at line 255 correctly uses createHmac. The asymmetry between stdout (unkeyed SHA256) and DB (HMAC) paths is real. Attempts to disprove: no wrapper or key injection surrounds hashAttemptedLogin — it is called directly at line 142 with attemptedEmail. No mitigating guard found.

**Closed_by:** (empty — TODO)

---

### SEC-036 — uploads-auth.hook.ts skips jti blacklist and nbf checks — logged-out tokens remain valid for avatar reads up to access TTL

- **Status:** TODO
- **Phase:** 4
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · information-disclosure
- **File:** `apps/api/src/common/fastify/uploads-auth.hook.ts:78-83`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-036` · audit-confidence: high · found_by: security

**Description:**
The uploads auth hook (SEC-016) only checks that the Bearer token's signature is valid and has not expired — it does NOT check the jti blacklist (JwtBlacklistService) or the per-user nbf (JwtNotBeforeService). The comment in the file acknowledges this intentionally: 'a logged-out-but-unexpired token revealing a profile photo for ≤ the access TTL is negligible vs. the anonymous hole'. However, this also means that after a forced password reset or account deactivation (both of which bump nbf via JwtNotBeforeService), the old token can still be used to retrieve avatar images for the remaining access TTL. For a public-sector app handling HR data (org chart avatars could be sensitive), this could be a privacy concern. The mitigating factors are: (1) avatarUrl is already returned to every authenticated user in summaries, so avatars are not confidential; (2) the TTL gap is ≤15 min.

**Root cause:**
Intentional design decision documented in the hook's comment — the blacklist/nbf checks were omitted as disproportionate for avatar access.

**Code evidence:**
```
    try {
      verifier.verify(token);
    } catch {
      return unauthorized(reply);
    }
  };
}
```

**Suggested fix:**
Accept as intentional, or optionally add a lightweight blacklist check by injecting JwtBlacklistService into the hook factory: `if (payload.jti && await blacklist.isBlacklisted(payload.jti)) return unauthorized(reply);`. This adds one Redis round-trip per avatar fetch but closes the logout-bypass for avatar reads.

**Acceptance criteria:**
1. After POST /auth/logout, GET /api/uploads/avatars/<id>.jpg with the old token returns 401.
2. Commit message includes `[closes SEC-036]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: code at lines 78-83 verbatim confirmed — only verifier.verify(token) called, no blacklist/nbf check. Finding is intentional by design (documented in hook comment). Retained as confirmed because: (1) the code evidence is accurate, (2) the gap is real even if intentional, (3) operators need to make an explicit accept/close decision. Classified as nit/informational.

**Closed_by:** (empty — TODO)

---

### SEC-061 — CSP policy missing `object-src 'none'` and `base-uri 'self'` directives

- **Status:** TODO
- **Phase:** 4
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · csp-missing-directives
- **File:** `apps/web/src/lib/csp.ts:16-26`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-061` · audit-confidence: high · found_by: security

**Description:**
The CSP policy is missing two recommended directives: `object-src 'none'` (prevents Flash/plugin injection, not covered by `default-src 'self'` in all browsers/configurations) and `base-uri 'self'` (prevents base-tag injection attacks where an attacker inserts a `<base href>` element to redirect relative URLs to an attacker-controlled origin). While `default-src 'self'` covers many fallback scenarios, explicit directives for `object-src` and `base-uri` are recommended by OWASP and CSP Level 3 spec for hardened policies.

**Root cause:**
The CSP was built to cover the main script injection threat; lower-priority directives were not included.

**Code evidence:**
```
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
  ];
  return directives.join("; ");
```

**Suggested fix:**
Add `object-src 'none'` and `base-uri 'self'` to the directives array in `buildCsp()`.

**Acceptance criteria:**
1. The CSP header includes `object-src 'none'`
2. The CSP header includes `base-uri 'self'`
3. SecurityHeaders.com gives grade A or higher
4. Commit message includes `[closes SEC-061]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s -I https://localhost:3000/ | grep -i content-security-policy
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed in apps/web/src/lib/csp.ts lines 16-25. Neither object-src nor base-uri appear in the directives array. Confirmed.

**Closed_by:** (empty — TODO)

---

### SEC-062 — Dev docker-compose.yml exposes Redis (6379) and PostgreSQL (5432) on all host interfaces without authentication

- **Status:** TODO
- **Phase:** 4
- **Cluster:** L
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · Dev environment / credential exposure
- **File:** `docker-compose.yml:28-29`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-062` · audit-confidence: high · found_by: security

**Description:**
The development docker-compose.yml binds both PostgreSQL (port 5432) and Redis (port 6379) to all host interfaces (`0.0.0.0`) via the `ports:` directive. Redis has no password (`requirepass`) configured. PostgreSQL uses a well-known default password (`orchestr_a_dev_password`, hardcoded in docker-compose.yml and ci.yml). On a developer machine connected to a network, both services are reachable by anyone on that network segment without authentication.

**Root cause:**
Default development configuration prioritizes convenience (no auth, exposed ports) without restricting binding to loopback.

**Code evidence:**
```
  redis:
    image: redis:7.4-alpine
    container_name: orchestr-a-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
```

**Suggested fix:**
Bind to loopback only: change `ports: - "${REDIS_PORT:-6379}:6379"` to `ports: - "127.0.0.1:${REDIS_PORT:-6379}:6379"` and similarly for PostgreSQL. Alternatively use `expose:` (internal only) and rely on the docker network. Add a Redis password for dev parity with prod: `command: redis-server --requirepass ${REDIS_PASSWORD:-dev_password}`.

**Acceptance criteria:**
1. netstat/ss on the dev host shows Redis and PostgreSQL bound to 127.0.0.1, not 0.0.0.0
2. An external host on the same network cannot connect to port 5432 or 6379
3. Commit message includes `[closes SEC-062]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
docker compose up -d && ss -tlnp | grep -E '5432|6379'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial review confirmed: docker-compose.yml lines 11-12 (PostgreSQL) and lines 28-29 (Redis) both use bare port mappings without 127.0.0.1 binding. Neither service has password authentication in the dev compose. Prod compose correctly uses `expose:` (not `ports:`) for both and requires REDIS_PASSWORD via requirepass — the discrepancy between dev and prod is real and intentional but creates risk on shared networks.

**Closed_by:** (empty — TODO)

---

### COR-049 — SnapshotSchedulerService creates a Redis connection in constructor with no shutdown hook

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · resource_leak
- **File:** `apps/api/src/analytics/advanced/snapshot-scheduler.service.ts:32-45`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-049` · audit-confidence: high · found_by: correctness

**Description:**
A new `ioredis` client is instantiated directly in the constructor, creating an additional Redis TCP connection on top of any existing CacheService or Bull connections. There is no `onApplicationShutdown()` or `onModuleDestroy()` lifecycle hook that calls `this.redis.disconnect()` or `this.redis.quit()`. During graceful shutdown or in test environments that create/destroy NestJS modules, the connection is left open, preventing the process from exiting cleanly. In tests, this can cause 'open handles' warnings and hang the test runner.

**Root cause:**
Raw `ioredis` client is created in-constructor without registering a shutdown hook to close it; NestJS lifecycle cleanup is never invoked.

**Code evidence:**
```
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      this.redis = new Redis({ host, port, password: password || undefined });
    }
  }
```

**Suggested fix:**
Implement `OnModuleDestroy` and call `await this.redis.quit()` in `onModuleDestroy()`. Alternatively, inject a shared Redis client via a NestJS provider so the connection lifecycle is managed centrally.

**Acceptance criteria:**
1. Jest/Vitest test runner exits without 'open handles' warning when SnapshotSchedulerService is included in test module
2. Redis connection is closed on NestJS graceful shutdown
3. Commit message includes `[closes COR-049]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed at lines 32-45. The service implements OnModuleInit (line 28, 47-51) but only for logging — no OnModuleDestroy or onApplicationShutdown. The redis field is typed as `private readonly redis: Redis` with no teardown. This is a correctness/resource-management issue rather than a functional bug. The cron job itself works correctly.

**Closed_by:** (empty — TODO)

---

### COR-065 — Login/register pages fetch `/auth/me/permissions` redundantly — useAuthBootstrap does this on every mount

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · duplicate-permissions-fetch
- **File:** `apps/web/app/[locale]/login/page.tsx:29-31`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-065` · audit-confidence: high · found_by: correctness

**Description:**
Both `login/page.tsx` and `register/page.tsx` fetch `/auth/me/permissions` after a successful login/register, then call `setAuth`. However, the main layout's `useAuthBootstrap` hook does the exact same thing on mount (fetching `/auth/me` + `/auth/me/permissions` in parallel). After `router.push` redirects to the dashboard, `useAuthBootstrap` fires again and overwrites the in-memory state. The explicit permissions fetch in the login handler is therefore redundant — it adds latency and an extra network request for no benefit.

**Root cause:**
The login flow was built before `useAuthBootstrap` was in place (or as a defensive duplicate), and the redundancy was never cleaned up.

**Code evidence:**
```
      const permsRes = await api.get<{ permissions: string[] }>(
        "/auth/me/permissions",
      );
      setAuth(response.user, permsRes.data.permissions);
```

**Suggested fix:**
Remove the `api.get('/auth/me/permissions')` call and the `setAuth` call from `login/page.tsx` and `register/page.tsx`. Just call `router.push(\`/${locale}/dashboard\`)` after `authService.login()` succeeds; `useAuthBootstrap` in the target layout will handle permission loading.

**Acceptance criteria:**
1. Login redirects to dashboard without making a second /auth/me/permissions call
2. Dashboard loads correctly with permissions populated from useAuthBootstrap
3. Commit message includes `[closes COR-065]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification via network tab in devtools
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed. useAuthBootstrap (src/hooks/useAuthBootstrap.ts:48-53) fetches both /auth/me and /auth/me/permissions in parallel on every mount via Promise.all. The login page also fetches /auth/me/permissions at line 29-31. Confirmed redundancy.

**Closed_by:** (empty — TODO)

---

### COR-066 — Profile 'Preferences' tab has a Save button with no onClick handler — button does nothing

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · dead-ui-element
- **File:** `apps/web/app/[locale]/profile/page.tsx:519-523`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-066` · audit-confidence: high · found_by: correctness

**Description:**
The 'Sauvegarder' button in the Preferences tab has no `onClick` handler and no `type="submit"` inside a form. Clicking it does nothing. The language/theme preferences are already applied immediately on select (via `router.push` and `setTheme`), so the button is visually misleading — it implies unsaved state but is a no-op.

**Root cause:**
The save button was added as a UI scaffold but the corresponding save handler (e.g. `usersService.update` or a settings API call) was never wired up.

**Code evidence:**
```
              <div className="pt-6">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  {t("preferences.save")}
                </button>
              </div>
```

**Suggested fix:**
Either remove the button (since preferences apply immediately) or wire it to an actual save API call if server-side preference persistence is intended. If keeping, at minimum add a comment explaining the button is intentionally a no-op.

**Acceptance criteria:**
1. Either the Save button is removed from the Preferences tab, OR it has an onClick handler that calls an API endpoint
2. No button exists in the UI that has no effect when clicked
3. Commit message includes `[closes COR-066]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at profile/page.tsx lines 519-523. Button has no onClick, no type=submit, not inside a form. Confirmed.

**Closed_by:** (empty — TODO)

---

### COR-067 — fetchThirdPartyMembers and fetchProjectClients close over canRead* flags but effect deps are suppressed

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · stale-closure
- **File:** `apps/web/app/[locale]/projects/[id]/page.tsx:843-875`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-067` · audit-confidence: medium · found_by: correctness

**Description:**
Both useEffect hooks for tab-driven data fetching use `eslint-disable-next-line react-hooks/exhaustive-deps` to suppress the exhaustive-deps rule. The functions `fetchThirdPartyMembers` and `fetchProjectClients` close over `canReadThirdParties`/`canReadClients` and `projectId`, which change only on initial load in practice. However, the pattern hides potential staleness if permissions reload. Additionally, defining async helper functions outside useCallback and referencing them inside effects is an anti-pattern that can lead to stale captures as the component evolves.

**Root cause:**
Helper functions were defined as plain async functions outside useCallback, making ESLint require them as deps. The `disable` comment was used instead of refactoring to useCallback or inlining the logic.

**Code evidence:**
```
  useEffect(() => {
    if (activeTab === "thirdParties") {
      fetchThirdPartyMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projectId]);

  const fetchProjectClients = async () => {
    if (!canReadClients) return;
    try {
      const data = await clientsService.listProjectClients(projectId);
      setProjectClients(data);
    } catch (err) {
      logger.error("Error loading project clients:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "clients") {
      fetchProjectClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projectId]);
```

**Suggested fix:**
Either wrap `fetchThirdPartyMembers` and `fetchProjectClients` in `useCallback` with the correct deps, or inline the logic directly inside the effects and remove the eslint-disable comments.

**Acceptance criteria:**
1. No eslint-disable-next-line react-hooks/exhaustive-deps comment on these two effects
2. Third-party and clients tabs still fetch data correctly on tab switch
3. Commit message includes `[closes COR-067]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'eslint-disable-next-line react-hooks/exhaustive-deps' apps/web/app/\[locale\]/projects/\[id\]/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: both eslint-disable-next-line comments confirmed at lines 857 and 874. canReadThirdParties/canReadClients are derived from hasPermission() at component render time (lines 838-839) — they're boolean values captured by closure, not stable refs. Impact is low since permissions rarely change mid-session, but the disable comment is a real code smell. Confidence kept at medium.

**Closed_by:** (empty — TODO)

---

### COR-068 — reports/page.tsx: canView = !permissionsLoaded || hasPermission('reports:view') — the !permissionsLoaded branch is dead code

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · stale closure / dead code
- **File:** `apps/web/app/[locale]/reports/page.tsx:49`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-068` · audit-confidence: high · found_by: correctness

**Description:**
The `AuthProvider` (apps/web/src/components/AuthProvider.tsx line 63) renders a loading spinner and returns early if `!permissionsLoaded`. This means the reports page only ever renders when `permissionsLoaded === true`. Therefore `!permissionsLoaded` is always `false` by the time this line executes, and `canView` always equals `hasPermission('reports:view')`. The intent appears to have been 'allow access while loading' to avoid a flash of the unauthorized message, but the AuthProvider already handles this at a higher level. The dead code creates a confusing false impression that the permission check is bypassed during loading.

**Root cause:**
The developer added `!permissionsLoaded` as a pessimistic guard without accounting for the AuthProvider's own loading gate above in the tree.

**Code evidence:**
```
  const canView = !permissionsLoaded || hasPermission("reports:view");
```

**Suggested fix:**
Simplify to `const canView = hasPermission('reports:view')`. If the previous intent was to avoid loading flash, it is already handled by AuthProvider.

**Acceptance criteria:**
1. reports/page.tsx uses const canView = hasPermission('reports:view') with no !permissionsLoaded branch
2. No flash of unauthorized message visible in normal page load
3. Commit message includes `[closes COR-068]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'canView' apps/web/app/\[locale\]/reports/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at line 49. AuthProvider.tsx line 63 confirmed: `if (!ready || isLoading || (isAuthenticated && !permissionsLoaded))` returns loading spinner before children render. AuthProvider is in root layout.tsx (app/layout.tsx line 42), wrapping all pages. The permission guard in reports/page.tsx at line 164 already checks `if (permissionsLoaded && !canView)` — consistent with the finding that !permissionsLoaded in canView is dead code.

**Closed_by:** (empty — TODO)

---

### COR-069 — UsersPage: role filter useEffect fires a redundant re-fetch on initial mount when roleFilter='' and availableRoles just loaded

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · race condition in role filter re-fetch
- **File:** `apps/web/app/[locale]/users/page.tsx:190-195`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-069` · audit-confidence: medium · found_by: correctness

**Description:**
The guard `if (availableRoles.length === 0) return` is designed to skip the first mount. However, `availableRoles` is populated inside `fetchUsers()` (via `setAvailableRoles(roles)`). When `fetchUsers` completes on mount, `availableRoles` goes from [] to non-empty. This does NOT re-trigger the `roleFilter` effect (because `roleFilter` did not change). The guard is therefore effective. However, if the user sets a roleFilter BEFORE the first fetch completes (unlikely UI race), the guard fires `return` and the filter is silently ignored until the next filter change. The `eslint-disable-next-line react-hooks/exhaustive-deps` comment suppresses the missing `fetchUsers` dependency warning, masking the real coupling.

**Root cause:**
Two interleaved effects (mount effect + filter effect) share mutable state (`availableRoles`) without proper coordination.

**Code evidence:**
```
  useEffect(() => {
    // Re-fetch when the role filter changes (skip very first mount — handled above).
    if (availableRoles.length === 0) return;
    fetchUsers(roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);
```

**Suggested fix:**
Pass `roleFilter` as a parameter to the initial `fetchUsers` call at mount, remove the secondary effect entirely, and handle filter changes by calling `fetchUsers(roleFilter)` directly in the filter change handler.

**Acceptance criteria:**
1. Setting a role filter before data loads correctly applies the filter
2. No double fetch on initial page load
3. Commit message includes `[closes COR-069]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verified verbatim at lines 190-195. The eslint-disable comment is present. In practice this race is unlikely to be hit. Severity nit.

**Closed_by:** (empty — TODO)

---

### OBS-026 — No error boundary anywhere in the [locale] subtree — unhandled render errors crash the entire app

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing error boundary
- **File:** `apps/web/app/[locale]/layout.tsx:1-30`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-026` · audit-confidence: high · found_by: observability

**Description:**
The `app/[locale]/` directory has no `error.tsx` file (Next.js App Router error boundary). `find apps/web/app/[locale] -name 'error.tsx'` returns nothing. An unhandled JavaScript error in any component within the locale subtree (e.g., SkillsMatrix, reports charts, SuiviPage) will crash the entire application and display a white screen instead of a user-facing error message. This is especially relevant given that several components (SkillsMatrix, ProjectsDetailTable, AdvancedAnalyticsTab sub-components) do their own loading/error state management but their render logic can still throw on malformed API data.

**Root cause:**
No `error.tsx` file created at the `app/[locale]/` or page-level directories.

**Code evidence:**
```
      <QueryProvider>{children}</QueryProvider>
```

**Suggested fix:**
Create `apps/web/app/[locale]/error.tsx` with a user-friendly error boundary component that displays a 'Something went wrong' message and a retry/navigate-home button.

**Acceptance criteria:**
1. An error.tsx file exists at apps/web/app/[locale]/error.tsx
2. Throwing an error in a page component renders the error boundary instead of crashing the app
3. Commit message includes `[closes OBS-026]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find apps/web/app/\[locale\] -name 'error.tsx'
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verified: `find /home/alex/Documents/REPO/ORCHESTRA/apps/web/app/[locale] -name 'error.tsx'` returned no results. The layout.tsx code is verbatim. No error.tsx at any subdirectory level either.

**Closed_by:** (empty — TODO)

---

### OBS-027 — Profile page (`profile/page.tsx`) has no error boundary — uncaught render errors cause a blank screen

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-error-boundary
- **File:** `apps/web/app/[locale]/profile/page.tsx:23-639`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-027` · audit-confidence: high · found_by: observability

**Description:**
The ProfilePage component is a large client component (~640 lines) that integrates avatar upload, ICS import/export, password change modal, and several async service calls. None of these operations are wrapped in a React error boundary. If any of the child components (`IcsExportSection`, `IcsImportSection`, `UserAvatar`) throws during render (e.g. a type error on unexpected API shape), the entire page crashes with a blank screen and no user-facing error message.

**Root cause:**
No error boundary component wraps the page or its sub-sections.

**Code evidence:**
```
export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
```

**Suggested fix:**
Wrap the page content (or individual sections like ICS import/export) in a React error boundary: `<ErrorBoundary fallback={<p>Erreur de chargement</p>}>`. Next.js App Router supports `error.tsx` files at the route segment level as an alternative.

**Acceptance criteria:**
1. A rendering error in IcsImportSection or IcsExportSection shows a user-friendly error message rather than a blank screen
2. The rest of the profile page remains functional when one section errors
3. Commit message includes `[closes OBS-027]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification: throw in IcsExportSection render, confirm error boundary catches it
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed. No error.tsx file exists anywhere under apps/web/app/ (confirmed via find). No ErrorBoundary component import in profile/page.tsx or in the IcsExportSection/IcsImportSection component files. Next.js ErrorBoundary references found are internal framework code only (in .next/ build artifacts), not app-level usage. Confirmed.

**Closed_by:** (empty — TODO)

---

### OBS-028 — No error boundary wrapping any of the three page-level components

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · missing-error-boundary
- **File:** `apps/web/app/[locale]/projects/page.tsx:1`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-028` · audit-confidence: high · found_by: observability

**Description:**
None of the three pages (projects/page.tsx, tasks/page.tsx, planning/page.tsx) or their parent layouts are wrapped in a React Error Boundary. An unhandled render-time error in any child component (e.g. unexpected null from the API, a bug in a component reading task.project.name when project is null) will result in a blank white screen for the user with no actionable message. The planning page in particular delegates entirely to the dynamically loaded PlanningView component with no fallback.

**Root cause:**
No Error Boundary component was added to these routes at the Next.js page level or the MainLayout level.

**Code evidence:**
```
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
```

**Suggested fix:**
Add a Next.js `error.tsx` (App Router convention) next to each `page.tsx`, or wrap `<MainLayout>` in a shared `<ErrorBoundary fallback={...}>` component that displays a user-friendly error message and a retry button.

**Acceptance criteria:**
1. Throwing an error from a child component inside MainLayout displays an error fallback UI instead of a blank page
2. The error is reported (via logger or monitoring service)
3. Commit message includes `[closes OBS-028]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find apps/web/app/\[locale\]/projects apps/web/app/\[locale\]/tasks apps/web/app/\[locale\]/planning -name 'error.tsx' | wc -l
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: no error.tsx found in any of the three directories. No ErrorBoundary import found in these pages. Confirmed.

**Closed_by:** (empty — TODO)

---

### PER-038 — Six advanced analytics endpoints have no caching despite being identical in contract to the cached main analytics endpoint

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · no-cache
- **File:** `apps/api/src/analytics/advanced/services/snapshots-query.service.ts:43-149`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-038` · audit-confidence: high · found_by: performance

**Description:**
The main `AnalyticsService.getAnalytics` wraps its result in a 60-second Redis cache (line 85-87 of analytics.service.ts). None of the six advanced analytics services (`SnapshotsQueryService`, `WorkloadService`, `ProjectHealthService`, `MilestonesCompletionService`, `TasksBreakdownService`, `RecentActivityService`) apply any caching. Each UI tab render triggers full DB scans. The analytics dashboard renders all 7 blocs simultaneously, issuing 7 concurrent uncached queries.

**Root cause:**
Caching was added to the main analytics service but not propagated to the advanced analytics services.

**Code evidence:**
```
  async getSnapshots(
    query: SnapshotsQueryDto,
    currentUser?: AccessUser,
  ): Promise<SnapshotsResponseDto> {
    const projectScope = await this.accessScope.projectScopeWhere(currentUser);
    const archivedClause = archivedWhere(
      query.archived ?? ArchivedFilter.ACTIVE,
    );
    // ── 1. Resolve active projects ─────────────────────────────────────────
    const where: Prisma.ProjectWhereInput = {
```

**Suggested fix:**
Inject `CacheService` into each advanced service and wrap the result with a per-user, per-query-params cache key, TTL=60s (matching the main analytics TTL). Pattern already established in `AnalyticsService.buildAnalyticsCacheKey`.

**Acceptance criteria:**
1. Second request to GET /analytics/advanced/snapshots within 60s is served from cache
2. Cache key includes userId and all query params
3. User A's cached result is never served to user B
4. Commit message includes `[closes PER-038]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'CacheService\|cache.get\|cache.set' apps/api/src/analytics/advanced/services/
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The `projectIds` array in `SnapshotsQueryDto` and `TasksBreakdownQueryDto` has no `@ArrayMaxSize` constraint, meaning a user could pass hundreds of UUIDs and generate a cache-busting unique key every request — limiting cache effectiveness. Verified: grep across all 6 advanced service files returns no CacheService import or cache.get/cache.set calls.

**Closed_by:** (empty — TODO)

---

### PER-042 — CacheService uses TTL-only eviction — no mutation invalidation for analytics endpoints

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · cache-stale-risk
- **File:** `apps/api/src/common/services/cache.service.ts:1-59`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-042` · audit-confidence: medium · found_by: performance

**Description:**
The `CacheService` design comment explicitly documents that it relies on TTL-only eviction. For analytics and report endpoints this means cached results can be stale for up to the configured TTL after mutations (new project, task status change, etc.). The comment references AC#6 as the blocking constraint. If the TTL is set to several minutes, dashboard metrics can lag significantly.

**Root cause:**
Intentional design trade-off documented in the code, with a forward reference to a future fix that has not yet been applied.

**Code evidence:**
```
 * - TTL-only eviction (no mutation-bust hooks) within this initial bounded scope
 *   (AC#6 forbids touching mutation service paths in this commit).
```

**Suggested fix:**
Add targeted cache invalidation calls (`cacheService.del(key)`) in mutation service methods (e.g., in `ProjectsService.create/update/archive`). The key schema must include the userId scope to match the key format used at read time. Alternatively, reduce the TTL from minutes to 30s for endpoints where freshness matters.

**Acceptance criteria:**
1. Creating a project while the analytics cache is populated causes the next analytics request to return updated data (not the stale cached value)
2. Commit message includes `[closes PER-042]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CacheService is used by analytics/planning endpoints (not directly in the scanned paths), but the design is defined here. The scanned modules do not use CacheService directly. CacheService.del() method exists (line 52-58) but is never called by mutation paths.

**Closed_by:** (empty — TODO)

---

### PER-048 — findByUser() (GET /personal-todos) issues an unconditional DELETE on every read — unnecessary write roundtrip on each list call

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · write-on-read-path
- **File:** `apps/api/src/personal-todos/personal-todos.service.ts:18-28`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-048` · audit-confidence: high · found_by: performance

**Description:**
Every GET /personal-todos request executes `cleanupOldCompleted`, which unconditionally issues a `deleteMany` with a date filter. Even when there is nothing to clean up this is an extra DB write round-trip on a read path. With a 7-day window, the cleanup result is empty on ~99% of calls (the average user does not complete 20 todos per week and immediately check again). The semantic of 'list my todos' causing side effects also makes the endpoint non-idempotent.

**Root cause:**
Cleanup was embedded in the read path as a convenience so stale todos are always cleared before presenting the list, avoiding a separate cron or scheduled task.

**Code evidence:**
```
  async findByUser(userId: string) {
    // Auto-cleanup: supprimer les todos complétées depuis > 7 jours
    await this.cleanupOldCompleted(userId);

    return this.prisma.personalTodo.findMany({
      where: { userId },
      orderBy: [
        { completed: 'asc' }, // Non complétées d'abord
        { createdAt: 'desc' }, // Plus récentes en premier
      ],
    });
  }
```

**Suggested fix:**
Move cleanup to a NestJS `@Cron` job. If a synchronous side effect is preferred, at minimum add a cheap count-before-delete check: skip the DELETE if `personalTodo.count({ where: { userId, completed: true, completedAt: { lt: cutoff } } }) === 0`.

**Acceptance criteria:**
1. GET /personal-todos does not issue a DELETE when no completed todos are older than 7 days
2. Stale completed todos are still cleaned up (via cron or lazy count-gated delete)
3. Commit message includes `[closes PER-048]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Verbatim confirmed. `cleanupOldCompleted` at lines 102-115 issues an unconditional `deleteMany` with no guard. Minor severity given the 20-item hard cap on personal todos — the deleteMany will always scan at most 20 rows. Still a semantic issue and unnecessary write latency.

**Closed_by:** (empty — TODO)

---

### PER-058 — All 6 pages use manual fetch + useState with no TanStack Query caching — repeated fetches on every navigation

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · no_query_cache
- **File:** `apps/web/app/[locale]/leaves/page.tsx:1`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-058` · audit-confidence: high · found_by: performance

**Description:**
All 6 pages use the same pattern: `useEffect + manual fetch + useState`. None use TanStack Query which is listed in the project stack (CLAUDE.md). Every navigation to these pages triggers a full re-fetch (no staleTime, no background revalidation, no deduplication). The leaves page fires 8 concurrent requests on every mount. The CLAUDE.md convention specifies TanStack Query for frontend data fetching.

**Root cause:**
Pages were built without adopting TanStack Query, leading to manual fetch orchestration with no caching layer.

**Code evidence:**
```
"use client";

import { useEffect, useState } from "react";
...
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  ...
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

**Suggested fix:**
Migrate to `useQuery` / `useMutation` from TanStack Query. Define query keys per domain (e.g., `['leaves', 'mine']`, `['leaves', 'pending']`). Set `staleTime: 30_000` for relatively static data like leave types and balances. Use `invalidateQueries` after mutations instead of calling `fetchAll()`.

**Acceptance criteria:**
1. Each page uses useQuery for data fetching.
2. Navigating away and back does not trigger a loading spinner if data is fresh.
3. Mutations use useMutation and invalidate relevant query keys.
4. Commit message includes `[closes PER-058]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'useQuery\|useMutation' apps/web/app/\[locale\]/leaves/page.tsx apps/web/app/\[locale\]/events/page.tsx | wc -l
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confirmed: grep for useQuery/useMutation returns 0 matches in leaves/page.tsx and events/page.tsx. Nit severity because it is well-known architectural debt requiring significant refactoring.

**Closed_by:** (empty — TODO)

---

### PER-059 — planning/page.tsx is entirely a shell that could be an RSC with a single client import

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · client-component-rsc-candidate
- **File:** `apps/web/app/[locale]/planning/page.tsx:1-22`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-059` · audit-confidence: medium · found_by: performance

**Description:**
The planning page is marked `"use client"` but does not use any client-only hooks (useState, useEffect, useRef, etc.) itself. It is a pure pass-through shell around a dynamically imported component. If `MainLayout` is also an RSC (or can be made one), this page does not need to be a Client Component — removing `"use client"` from the shell would allow Next.js to server-render the outer layout and only hydrate PlanningView on the client, reducing the client JS bundle for the shell.

**Root cause:**
The `"use client"` directive was added prophylactically or because the developer was unsure if it was needed.

**Code evidence:**
```
"use client";

import dynamic from "next/dynamic";
import { MainLayout } from "@/components/MainLayout";

const PlanningView = dynamic(
  () =>
    import("@/components/planning/PlanningView").then((m) => m.PlanningView),
  { ssr: false }
);

export default function PlanningPage() {
  return (
    <MainLayout>
      <PlanningView
        showFilters={true}
        showControls={true}
        showGroupHeaders={true}
      />
    </MainLayout>
  );
}
```

**Suggested fix:**
Remove `"use client"` from `planning/page.tsx`. If `MainLayout` requires client context, ensure PlanningView is imported with `dynamic` and `ssr: false` (already done). Verify the build still works and the page renders correctly.

**Acceptance criteria:**
1. Removing `"use client"` from planning/page.tsx does not cause a build error
2. PlanningPage renders correctly in production build
3. Commit message includes `[closes PER-059]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n '"use client"' apps/web/app/\[locale\]/planning/page.tsx
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Adversarial check: MainLayout is itself a client component ('use client' + useState + usePathname). In Next.js App Router, a Server Component CAN import and render a Client Component — planning/page.tsx does not need 'use client' just because MainLayout uses it. The finding is valid. Confidence kept at medium since this requires a build-verified check before applying.

**Closed_by:** (empty — TODO)

---

### TST-011 — No migration-level e2e test exists inside e2e/; schema-constraint coverage lives only in apps/api/src/schema-constraints/*.int.spec.ts

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · migration-coverage
- **File:** `e2e/global-setup.ts:1-63`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-011` · audit-confidence: high · found_by: tests

**Description:**
The task checklist asks whether migration assertions exist at all. They do, but not inside e2e/: schema constraint tests (DAT-003 through DAT-038, PER-010 through PER-013, AUD immutability) live at apps/api/src/schema-constraints/*.int.spec.ts and run via `pnpm test:integration`. The e2e/ tree has no migration-specific test. This is expected for the Playwright E2E suite (which tests behavior, not schema), but worth noting that the integration harness is the only coverage of constraint enforcement.

**Root cause:**
Design decision: schema constraint tests live in the integration layer (vitest.int.config.ts), not in Playwright e2e/.

**Code evidence:**
```
export default async function globalSetup(): Promise<void> {
  const apiUrl =
    process.env.API_URL ||
    (process.env.CI ? "http://localhost:4000" : "http://localhost:4000");

  const context = await request.newContext({ baseURL: apiUrl });

  try {
    const response = await context.post("/api/testing/reset");
```

**Suggested fix:**
No immediate action needed. Consider adding a CI step that always runs `pnpm test:integration` before `pnpm test:e2e` to ensure schema coverage is never skipped.

**Acceptance criteria:**
1. CI pipeline runs pnpm test:integration before pnpm test:e2e
2. Commit message includes `[closes TST-011]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find apps/api/src/schema-constraints -name '*.int.spec.ts' | wc -l
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: 17 schema-constraint integration test files found at apps/api/src/schema-constraints/. This is not a gap in test existence, only a location note. VERIFIED: code_evidence verbatim confirmed in e2e/global-setup.ts lines 20-30 (the exact export default function and request.newContext/post lines match). Design-by-intent architectural observation, not a defect.

**Closed_by:** (empty — TODO)

---

### SEC-050 — $executeRawUnsafe used with string-interpolated constant for DDL trigger name — unsafe API pattern in maintenance scripts

- **Status:** TODO
- **Phase:** 4
- **Cluster:** P
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · unsafe-api-usage
- **File:** `apps/api/src/scripts/normalize-action-codes.ts:143-145`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-050` · audit-confidence: medium · found_by: security

**Description:**
Two maintenance scripts (normalize-action-codes.ts, recompute-chain-on-schema-bump.ts) use $executeRawUnsafe with string interpolation of the IMMUTABILITY_TRIGGER constant ('audit_logs_no_update_delete'). While IMMUTABILITY_TRIGGER is a compile-time string constant — never user-supplied — using $executeRawUnsafe establishes a pattern that would immediately become a SQL injection sink if the trigger name were ever refactored to accept a parameter. Prisma $executeRaw tagged template cannot be used for DDL identifier interpolation (PostgreSQL does not support parameterized identifiers), so the safer long-term fix is format_ident() via a separate helper or a hardcoded non-parameterized string.

**Root cause:**
Prisma's $executeRaw tagged template cannot parameterize SQL identifiers (table/trigger names); the developer correctly chose $executeRawUnsafe but the string-interpolation pattern is risky if the constant is ever made dynamic.

**Code evidence:**
```
      await tx.$executeRawUnsafe(
        `ALTER TABLE audit_logs DISABLE TRIGGER ${IMMUTABILITY_TRIGGER}`,
      );
```

**Suggested fix:**
Use a hardcoded string literal directly instead of interpolating the constant: `ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete` — makes it obvious there is no dynamic component. Alternatively, add an allowlist assertion: if (IMMUTABILITY_TRIGGER !== 'audit_logs_no_update_delete') throw new Error('unexpected trigger name').

**Acceptance criteria:**
1. DDL string in $executeRawUnsafe does not use string interpolation of any variable
2. Static analysis (eslint no-restricted-syntax or custom rule) flags $executeRawUnsafe with template literals
3. Commit message includes `[closes SEC-050]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'executeRawUnsafe' apps/api/src/scripts/normalize-action-codes.ts apps/api/src/scripts/recompute-chain-on-schema-bump.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Code evidence verbatim confirmed at lines 143-145 of normalize-action-codes.ts, and at lines 121-123 and 129-131 of recompute-chain-on-schema-bump.ts. IMMUTABILITY_TRIGGER is a module-level const string — no dynamic input path found. Both scripts require DATABASE_MIGRATION_URL, operator-only access. Impact correctly assessed as latent/future risk only. Confidence maintained at medium given compile-time constant safety.

**Closed_by:** (empty — TODO)

---

### COR-058 — captureSnapshots() uses hardcoded string literal 'ACTIVE' instead of ProjectStatus enum

- **Status:** TODO
- **Phase:** 4
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/projects/projects.service.ts:1147`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-058` · audit-confidence: high · found_by: correctness

**Description:**
The `captureSnapshots` method uses the raw string `'ACTIVE'` instead of the `ProjectStatus.ACTIVE` enum imported at line 21. While Prisma accepts strings for enum fields, this bypasses TypeScript's compile-time enum safety: if `ProjectStatus.ACTIVE` were ever renamed or restructured, this hardcoded string would silently stop matching any projects, capturing zero snapshots forever with no type error. The rest of the codebase consistently uses `ProjectStatus.*` enum values for status comparisons.

**Root cause:**
Direct string literal used instead of the imported `ProjectStatus` enum.

**Code evidence:**
```
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
```

**Suggested fix:**
Replace `{ status: 'ACTIVE' }` with `{ status: ProjectStatus.ACTIVE }`. The `ProjectStatus` enum is already imported at line 21.

**Acceptance criteria:**
1. captureSnapshots() uses ProjectStatus.ACTIVE in the where clause
2. No raw string 'ACTIVE' for status filtering in projects.service.ts
3. Commit message includes `[closes COR-058]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n "status: 'ACTIVE'" apps/api/src/projects/projects.service.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.

**Closed_by:** (empty — TODO)

---

### COR-063 — update(): progress not recalculated when status changes and subtasks exist

- **Status:** TODO
- **Phase:** 4
- **Cluster:** —
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · business-invariant
- **File:** `apps/api/src/tasks/tasks.service.ts:797-800`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#COR-063` · audit-confidence: high · found_by: correctness

**Description:**
When a task has subtasks, update() deliberately skips updating progress (the condition `=== 0` is false). This is consistent with the design choice that progress is driven by subtask completion when subtasks exist. However, if the task has subtasks AND the caller explicitly sets `status: DONE`, the task is marked as DONE but progress remains at whatever partial value it had. A task can therefore be DONE at 40% progress which is contradictory. recalcTaskProgress() handles the subtask path, but it is only called from subtask create/update/delete — not from task status update.

**Root cause:**
Progress update when status changes is skipped entirely if subtasks exist; status=DONE with partial subtask completion creates an inconsistent state.

**Code evidence:**
```
          ...(taskData.status &&
            (await tx.subtask.count({ where: { taskId: id } })) === 0 && {
              progress: getTaskProgress(taskData.status),
            }),
```

**Suggested fix:**
When status is set to DONE, override progress to 100 regardless of subtask count, OR prevent setting DONE when not all subtasks are completed. Add a check: `if (taskData.status === TaskStatus.DONE) { progress = 100; }` and apply unconditionally.

**Acceptance criteria:**
1. Setting a task with subtasks to status=DONE results in progress=100
2. Setting status=IN_PROGRESS with subtasks keeps progress driven by subtask completion
3. Commit message includes `[closes COR-063]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'recalcTaskProgress\|getTaskProgress\|progress' apps/api/src/tasks/tasks.service.ts | head -20
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: recalcTaskProgress at line 2063 exits early if subtasks.length === 0, so it would not fix this if called from update().

**Closed_by:** (empty — TODO)

---

### SA-SEC-004 — RefreshTokenDto missing @MaxLength — unbounded refresh token in POST /auth/refresh

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/auth/dto/refresh-token.dto.ts:1-22`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-004` · audit-confidence: high · found_by: security

**Description:**
Both RefreshTokenDto.refreshToken and LogoutDto.refreshToken lack @MaxLength. The refresh flow passes this value to SHA-256 hashing, which is fast and unbounded. While not a bcrypt-level DoS risk, applying @MaxLength is a defence-in-depth measure that prevents surprisingly large payloads from even reaching the service layer. The refresh cookie path is already length-capped (cookies have browser limits) but the body path is not.

**Root cause:**
MaxLength constraint not applied to opaque token fields in auth DTOs.

**Code evidence:**
```
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token opaque (48 bytes base64url)',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token à révoquer (optionnel mais recommandé)',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
```

**Suggested fix:**
Add `@MaxLength(256)` to both refreshToken fields (a 48-byte base64url token is 64 chars; 256 provides generous headroom for variations).

**Acceptance criteria:**
1. POST /auth/refresh with a 10KB refreshToken body field returns 400
2. Commit message includes `[closes SA-SEC-004]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength' apps/api/src/auth/dto/refresh-token.dto.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-004` to avoid ID collision with the primary run; original id `SEC-004` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): SEC-003.

**Closed_by:** (empty — TODO)

---

### SA-SEC-009 — CreateLeaveDto.leaveTypeId uses @IsString() instead of @IsUUID()

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/leaves/dto/create-leave.dto.ts:12-18`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-009` · audit-confidence: medium · found_by: security

**Description:**
The leaveTypeId field is documented as a UUID-like identifier but validated only with @IsString(). The example 'lt-cp-001' suggests this may intentionally be a non-UUID short identifier; however, if leaveTypeId is a database UUID FK (as the schema likely defines), only @IsUUID() is appropriate. If it really is a non-UUID slug, then it should have a @MaxLength and @Matches constraint. Either way, unbounded @IsString() is insufficient.

**Root cause:**
leaveTypeId validation not aligned with the actual data type used in the database schema.

**Code evidence:**
```
  @ApiProperty({
    description: 'ID du type de congé',
    example: 'lt-cp-001',
  })
  @IsString()
  @IsNotEmpty()
  leaveTypeId: string;
```

**Suggested fix:**
If leaveTypeId is a UUID FK in Prisma schema: replace @IsString()/@IsNotEmpty() with @IsUUID('4'). If it is a slug: add @MaxLength(64) @Matches(/^[a-z0-9-]+$/) or similar.

**Acceptance criteria:**
1. POST /leaves with leaveTypeId of invalid format returns 400 instead of 404
2. Commit message includes `[closes SA-SEC-009]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -A3 'leaveTypeId' packages/database/prisma/schema.prisma apps/api/src/leaves/dto/create-leave.dto.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-009` to avoid ID collision with the primary run; original id `SEC-009` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Need to verify leaveTypeId DB type in schema.prisma to confirm whether it should be UUID or slug.

**Closed_by:** (empty — TODO)

---

### SA-SEC-010 — CreateEpicDto.description and CreateMilestoneDto.description missing @MaxLength

- **Status:** TODO
- **Phase:** 4
- **Cluster:** D
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · input-validation
- **File:** `apps/api/src/epics/dto/create-epic.dto.ts:24-27`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-010` · audit-confidence: high · found_by: security

**Description:**
The description fields in CreateEpicDto and CreateMilestoneDto have no @MaxLength constraint. While CreateMilestoneDto similarly lacks it, this applies to all major resource DTOs where optional free-text description fields are not length-capped. Storage abuse by authenticated users is the primary risk.

**Root cause:**
Pattern of omitting @MaxLength on optional description fields across multiple DTOs.

**Code evidence:**
```
  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ID du projet', example: 'uuid-here' })
```

**Suggested fix:**
Add @MaxLength(5000) to description in CreateEpicDto and CreateMilestoneDto.

**Acceptance criteria:**
1. POST /epics with description > 5000 chars returns 400
2. POST /milestones with description > 5000 chars returns 400
3. Commit message includes `[closes SA-SEC-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'MaxLength' apps/api/src/epics/dto/create-epic.dto.ts apps/api/src/milestones/dto/create-milestone.dto.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-010` to avoid ID collision with the primary run; original id `SEC-010` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): SEC-006, SEC-007.

**Closed_by:** (empty — TODO)

---

### SA-OBS-012 — No declared retention policy or partitioning for audit_logs; unbounded table growth

- **Status:** TODO
- **Phase:** 4
- **Cluster:** F
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · audit-log-retention
- **File:** `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:1-123`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-012` · audit-confidence: high · found_by: observability

**Description:**
The audit_logs table is append-only (immutability trigger blocks UPDATE/DELETE) and has no PostgreSQL partitioning, archival cron, or declared retention window. The RGPD treatment record referenced in code comments does not appear to include a data-minimisation timeline. Over time, especially with LEAVE_* events, DOCUMENT_READ events, and LOGIN_SUCCESS events per user per day, the table will grow unboundedly. There is no pg_partman or partitioned-table setup in any migration. The only comment about retention relates to backup tables (migration 20260603120000), not audit_logs itself.

**Root cause:**
OBS-002 focused on integrity/immutability; retention and partitioning were explicitly deferred (no ticket reference found).

**Code evidence:**
```
-- OBS-002 + DAT-009 — audit_logs durability hardening
-- (a) BEFORE UPDATE/DELETE trigger -> RAISE EXCEPTION (immutability)
-- (c) prevHash/rowHash sha256 integrity chain
-- (d) actorEmail/actorLabel snapshot columns
--
-- Ordering is load-bearing: all backfill UPDATEs MUST run BEFORE the
-- immutability trigger is created
```

**Suggested fix:**
Define a retention policy: either (a) pg_partman range partitioning by month on createdAt with archive/detach semantics (rows become read-only in detached partitions, satisfying WORM), or (b) a documented 7-year RGPD retention followed by a controlled purge of non-security-critical action codes. Add the policy as a comment on the audit_logs table and a migration stub.

**Acceptance criteria:**
1. A documented retention policy exists for audit_logs (in migration comment or RGPD register)
2. Either: partition by time is implemented, or a purge mechanism exists for non-critical action codes
3. Commit message includes `[closes SA-OBS-012]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_prod -c "SELECT count(*) FROM audit_logs;"
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-012` to avoid ID collision with the primary run; original id `OBS-012` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-DAT-007 — project_snapshots.progress has no DB-level floor CHECK (>= 0) — Decimal(5,2) admits negatives

- **Status:** TODO
- **Phase:** 4
- **Cluster:** K
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/schema.prisma:216`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-007` · audit-confidence: high · found_by: data_integrity

**Description:**
The DAT-004 migration (20260527120000) adds progress BETWEEN 0 AND 100 checks on tasks and epics, but not on project_snapshots.progress. The DAT-005 comment acknowledges intentional headroom beyond 100 ('an analytics consumer that stores weighted scores >100 isn't broken'), so the upper bound of 100 is deliberately not constrained. However, the same migration family's pattern of applying a floor of >= 0 (as applied to leave_balances.totalDays, documents.size) was not applied here. Decimal(5,2) admits values down to -999.99.

**Root cause:**
project_snapshots.progress was absent from the DAT-004 coverage list, likely because the intent was to defer the analytics headroom question; the floor check was not split from the ceiling check when the ceiling was intentionally omitted.

**Code evidence:**
```
  progress           Decimal  @db.Decimal(5, 2) // 0.00 – 100.00 ; DAT-005 (Decimal exact arithmetic, no IEEE 754 drift)
```

**Suggested fix:**
Add `ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_progress_floor_ck" CHECK ("progress" >= 0);` in a follow-up migration.

**Acceptance criteria:**
1. Integration test: INSERT INTO project_snapshots with progress = -1 fails with check_violation
2. INSERT with progress = 150 succeeds (intentional headroom preserved)
3. Commit message includes `[closes SA-DAT-007]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'project_snapshots.*progress.*ck\|project_snapshots.*CHECK.*progress' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-007` to avoid ID collision with the primary run; original id `DAT-007` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: DAT-005 comment at schema line 216 explicitly documents >100 headroom as intentional. The floor-only fix is non-controversial and does not conflict with that intent.

**Closed_by:** (empty — TODO)

---

### SA-SEC-016 — CI workflow hardcodes DB password and JWT secret in plaintext — appropriate for ephemeral CI but not using GitHub Secrets

- **Status:** TODO
- **Phase:** 4
- **Cluster:** M
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · configuration
- **File:** `.github/workflows/ci.yml:57-58`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-016` · audit-confidence: high · found_by: security

**Description:**
The CI workflow hardcodes `orchestr_a_dev_password` as the Postgres password and `test-jwt-secret-key` as the JWT secret in plaintext in the YAML file. While these are ephemeral CI values used only for test services, they are committed to the repository and will appear in git history indefinitely. If an operator ever reuses these values in a staging or production environment, those credentials are publicly known. The docker-publish.yml and docker-compose.yml also use the same default password.

**Root cause:**
CI DB credentials were not parameterized as GitHub Secrets, likely because they are considered dev-only throwaway values.

**Code evidence:**
```
      postgres:
        image: postgres:18
        env:
          POSTGRES_USER: orchestr_a
          POSTGRES_PASSWORD: orchestr_a_dev_password
          POSTGRES_DB: orchestr_a_v2_test
        options: >-
          --health-cmd pg_isready
```

**Suggested fix:**
Move CI DB passwords to GitHub repository secrets (`${{ secrets.CI_DB_PASSWORD }}`) to establish a good hygiene pattern. Alternatively, document clearly that these values must NEVER be reused outside ephemeral CI.

**Acceptance criteria:**
1. No plaintext passwords appear in ci.yml (use ${{ secrets.CI_DB_PASSWORD }} or similar)
2. Commit message includes `[closes SA-SEC-016]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'orchestr_a_dev_password' .github/workflows/ci.yml
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-016` to avoid ID collision with the primary run; original id `SEC-016` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: The .env files containing real dev secrets are correctly gitignored. This finding applies only to the CI workflow YAML file itself.

**Closed_by:** (empty — TODO)

---

### SA-OBS-014 — No OpenTelemetry or distributed tracing; requestId correlation stops at the API layer

- **Status:** TODO
- **Phase:** 4
- **Cluster:** N
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · no-distributed-tracing
- **File:** `apps/api/src/main.ts:92-112`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-014` · audit-confidence: high · found_by: observability

**Description:**
The application propagates a per-request UUID via AsyncLocalStorage (OBS-009) but has no OpenTelemetry SDK, no trace/span IDs, and no W3C TraceContext header propagation. The Next.js web package's required-server-files.json references @effect/opentelemetry but this is a transitive dependency from an Effect library, not an active instrumentation. When the web layer calls the API, requests carry no traceparent header; the nginx proxy adds no trace headers; Prisma queries are not instrumented. Multi-hop debugging (nginx → Next.js proxy → NestJS → PostgreSQL) requires manual correlation across four separate log streams.

**Root cause:**
OBS-009 covered single-service correlation; distributed tracing was not in scope.

**Code evidence:**
```
    new FastifyAdapter({
      logger: fastifyLoggerOptions,
      trustProxy: [...TRUST_PROXY],
      genReqId,
      bodyLimit: 1048576,
    }),
  );

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, _reply, done) => {
      requestIdStore.enterWith({ requestId: request.id });
```

**Suggested fix:**
Install @opentelemetry/sdk-node and configure it in main.ts before NestFactory.create(). Enable the @nestjs/otel-sdk community package or manual instrumentation for Fastify + Prisma. Export traces to a local Jaeger or OTLP collector. This is a suggestion/nit tier given the current single-node architecture.

**Acceptance criteria:**
1. HTTP requests carry W3C traceparent headers between web and API
2. Spans are emitted for each NestJS handler invocation and each Prisma query
3. Commit message includes `[closes SA-OBS-014]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-014` to avoid ID collision with the primary run; original id `OBS-014` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: The @effect/opentelemetry reference in apps/web/.next/required-server-files.json is a transitive Effect library dependency, NOT active tracing instrumentation.

**Closed_by:** (empty — TODO)

---

### SA-TEST-008 — planning.controller.ts has no controller spec (1 endpoint, @RequirePermissions)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/planning/planning.controller.ts:1-48`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-008` · audit-confidence: high · found_by: tests

**Description:**
PlanningController has a single endpoint (GET /overview) that requires 'users:read'. There is a planning.service.spec.ts but no planning.controller.spec.ts. The planning.spec.ts legacy E2E provides some coverage but uses UI login and only checks page renders. A controller spec would verify query-param forwarding and user context wiring.

**Root cause:**
Controller spec was never created for the planning overview endpoint.

**Code evidence:**
```
@Controller('planning')
export class PlanningController {
  @Get('overview')
  @RequirePermissions('users:read')
  async getOverview(
    @Query() query: PlanningOverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.planningService.getOverview(query.startDate, query.endDate, {
```

**Suggested fix:**
Create apps/api/src/planning/planning.controller.spec.ts with a mock PlanningService, verifying that startDate/endDate and user.id are correctly forwarded.

**Acceptance criteria:**
1. apps/api/src/planning/planning.controller.spec.ts exists
2. Commit message includes `[closes SA-TEST-008]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/planning -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-008` to avoid ID collision with the primary run; original id `TEST-008` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.

**Closed_by:** (empty — TODO)

---

### SA-TEST-009 — personal-todos.controller.ts has no controller spec (@AllowSelfService on all 4 endpoints)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/personal-todos/personal-todos.controller.ts:1-50`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-009` · audit-confidence: high · found_by: tests

**Description:**
PersonalTodosController has 4 endpoints (GET, POST, PATCH /:id, DELETE /:id) all decorated with @AllowSelfService() — i.e., no @RequirePermissions check, scoped to the authenticated user. The service spec covers the ForbiddenException for owner-mismatch, but no controller spec exists to verify that the currentUser.id is correctly threaded through to the service. The hard-coded 20-item limit (known pitfall from CLAUDE.md) is also not tested at the controller layer.

**Root cause:**
Controller spec was never written; the service spec was deemed sufficient.

**Code evidence:**
```
@Controller('personal-todos')
export class PersonalTodosController {
  @Get()
  @AllowSelfService()
  findByUser(@CurrentUser() user: User) {
    return this.personalTodosService.findByUser(user.id);
  }

  @Post()
  @AllowSelfService()
  create(@CurrentUser() user: User, @Body() dto: CreatePersonalTodoDto) {
```

**Suggested fix:**
Create apps/api/src/personal-todos/personal-todos.controller.spec.ts; mock service, verify user.id is passed correctly to findByUser, create, update, delete.

**Acceptance criteria:**
1. apps/api/src/personal-todos/personal-todos.controller.spec.ts exists
2. Commit message includes `[closes SA-TEST-009]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/personal-todos -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-009` to avoid ID collision with the primary run; original id `TEST-009` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.

**Closed_by:** (empty — TODO)

---

### SA-TEST-010 — holidays.controller.ts has no controller spec (9 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/holidays/holidays.controller.ts:1-40`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-010` · audit-confidence: high · found_by: tests

**Description:**
HolidaysController has 9 endpoints for managing public holidays. There is a holidays.service.spec.ts but no holidays.controller.spec.ts. School-vacations.controller.ts also has no spec (see TEST-011). These are configuration-level data accessed by multiple features (planning, leaves).

**Root cause:**
Controller spec was never written for the holidays module.

**Code evidence:**
```
@Controller('holidays')
export class HolidaysController {
  @Get()
  @RequirePermissions('holidays:read')
  @ApiOperation({ summary: 'Récupérer tous les jours fériés' })
  @ApiResponse({ status: 200, description: 'Liste des jours fériés' })
```

**Suggested fix:**
Create apps/api/src/holidays/holidays.controller.spec.ts.

**Acceptance criteria:**
1. apps/api/src/holidays/holidays.controller.spec.ts exists
2. Commit message includes `[closes SA-TEST-010]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/holidays -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-010` to avoid ID collision with the primary run; original id `TEST-010` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004, TEST-011.

**Closed_by:** (empty — TODO)

---

### SA-TEST-011 — school-vacations.controller.ts has no controller spec (6 endpoints, all @RequirePermissions)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/school-vacations/school-vacations.controller.ts:1-60`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-011` · audit-confidence: high · found_by: tests

**Description:**
SchoolVacationsController has 6 endpoints. There is a school-vacations.spec.ts but it covers the service only, not the controller. The controller injects both SchoolVacationsService and SettingsService (to get the default zone), making the controller logic non-trivial enough to warrant its own spec.

**Root cause:**
Controller spec was never written.

**Code evidence:**
```
@Controller('school-vacations')
export class SchoolVacationsController {
  @Get()
  @RequirePermissions('school_vacations:read')
  async findAll(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
```

**Suggested fix:**
Create apps/api/src/school-vacations/school-vacations.controller.spec.ts, specifically testing the SettingsService interaction for the zone-defaulting logic.

**Acceptance criteria:**
1. apps/api/src/school-vacations/school-vacations.controller.spec.ts exists
2. Default-zone fallback logic has a test case
3. Commit message includes `[closes SA-TEST-011]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/school-vacations -name '*.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-011` to avoid ID collision with the primary run; original id `TEST-011` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-010.

**Closed_by:** (empty — TODO)

---

### SA-TEST-012 — Three sub-controllers have no specs: projects-clients, projects-third-party-members, tasks-third-party-assignees

- **Status:** TODO
- **Phase:** 4
- **Cluster:** O
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · controller-coverage
- **File:** `apps/api/src/clients/projects-clients.controller.ts:1-65`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-012` · audit-confidence: high · found_by: tests

**Description:**
ProjectsClientsController (3 endpoints), ProjectsThirdPartyMembersController (3 endpoints), and TasksThirdPartyAssigneesController (3 endpoints) all have no controller specs. They share service-level specs (clients.controller.spec.ts tests the main ClientsController, third-parties.controller.spec.ts tests ThirdPartiesController) but the sub-resource controllers are untested at the unit level. These controllers implement the clients:assign_to_project and third_parties:assign_to_project permissions.

**Root cause:**
Sub-resource controllers were added as routing convenience wrappers; specs were not created.

**Code evidence:**
```
@Controller('projects/:projectId/clients')
export class ProjectsClientsController {
  @Post()
  @RequirePermissions('clients:assign_to_project')
  assign(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AssignClientToProjectDto,
  ) {
    return this.clientsService.assignClientToProject(projectId, dto.clientId);
  }
```

**Suggested fix:**
Add controller specs for ProjectsClientsController, ProjectsThirdPartyMembersController, TasksThirdPartyAssigneesController, or merge them into the existing clients.controller.spec.ts and third-parties.controller.spec.ts.

**Acceptance criteria:**
1. Each of the 3 sub-controllers has at least one test covering its assign endpoint and a 404 error path
2. Commit message includes `[closes SA-TEST-012]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src -name 'projects-clients.controller.spec.ts' -o -name 'projects-third-party-members.controller.spec.ts' -o -name 'tasks-third-party-assignees.controller.spec.ts'
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-012` to avoid ID collision with the primary run; original id `TEST-012` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): TEST-004.
- Audit note: app.controller.ts (GET /) is @Public and trivial — its absence is a nit, not included as a separate finding.

**Closed_by:** (empty — TODO)

---

### SA-TEST-019 — e2e/tests/avatar-screenshots.spec.ts: 8 tests with zero assertions (screenshot-only)

- **Status:** TODO
- **Phase:** 4
- **Cluster:** P
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · e2e-no-assertions
- **File:** `e2e/tests/avatar-screenshots.spec.ts:1-30`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-019` · audit-confidence: high · found_by: tests

**Description:**
avatar-screenshots.spec.ts contains 8 tests across 8 pages that take screenshots and write them to .claude-screenshots/avatar-unification/. There are zero `expect` calls. These tests can never fail on a functional assert — only on navigation error or timeout. They run under the role projects (consuming setup dependencies) but provide no regression value. They appear to be debugging artifacts from the avatar unification work (git context: COR-039 web redeploy).

**Root cause:**
Debugging/visual inspection scripts committed as test files without assertions.

**Code evidence:**
```
for (const zone of ZONES) {
  test(`@avatar-screenshot ${zone.name}`, async ({ page }) => {
    await page.goto(zone.url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // let avatars render
    await page.screenshot({
      path: path.join(OUT, `${zone.name}-after.png`),
      fullPage: true,
    });
  });
}
```

**Suggested fix:**
Either: (a) delete the file (it is a debugging tool, not a regression test), or (b) promote avatar-unification.spec.ts assertions to cover the same zones and delete avatar-screenshots.spec.ts.

**Acceptance criteria:**
1. No Playwright spec file in e2e/ has zero expect() calls
2. Commit message includes `[closes SA-TEST-019]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'expect' /home/alex/Documents/REPO/ORCHESTRA/e2e/tests/avatar-screenshots.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-019` to avoid ID collision with the primary run; original id `TEST-019` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-TEST-015 — e2e/tests/kanban.spec.ts: two unconditional test.skip(true, ...) due to seed-dependency

- **Status:** TODO
- **Phase:** 4
- **Cluster:** Q
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** tests · skipped-tests
- **File:** `e2e/tests/kanban.spec.ts:64`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-015` · audit-confidence: high · found_by: tests

**Description:**
Three tests in kanban.spec.ts skip at runtime when TODO tasks are absent (lines 25-28, 64, 102). While the skip is conditional on data state (not unconditional), the test at line 64 skips with the message 'No TODO task available' and the test at line 102 skips with 'Need at least 2 TODO tasks to verify sort order'. In practice, the E2E DB is reset and seeded by global-setup.ts before each full run (TST-017). If the seed does not create TODO tasks, these tests silently skip in CI. The comment at line 25 ('seed the DB before running smoke') confirms this is a known gap.

**Root cause:**
Test relies on seed data state that may not be present if the seed is incomplete or if the global reset clears data before seeding.

**Code evidence:**
```
    if (!(await todoCard.isVisible().catch(() => false))) {
      test.skip(true, "No TODO task available");
      return;
    }

    const taskId = (await todoCard.getAttribute("data-testid"))!.replace(
      "kanban-card-",
      "",
    );
```

**Suggested fix:**
In a beforeAll/beforeEach, create a TODO task via the API (POST /api/tasks) and delete it in afterAll. This makes the test self-contained and independent of seed data.

**Acceptance criteria:**
1. Kanban tests create their own task fixtures via API
2. No test.skip(true, 'No TODO task available') in CI runs
3. Commit message includes `[closes SA-TEST-015]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'test.skip(true' /home/alex/Documents/REPO/ORCHESTRA/e2e/tests/kanban.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-015` to avoid ID collision with the primary run; original id `TEST-015` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-SEC-012 — METRICS_TOKEN not documented in env templates — metrics endpoint is open by default

- **Status:** TODO
- **Phase:** 4
- **Cluster:** R
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** security · information-disclosure
- **File:** `apps/api/src/metrics/metrics.controller.ts:14-16`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-012` · audit-confidence: high · found_by: security

**Description:**
METRICS_TOKEN is referenced in the controller but absent from both .env.example and .env.production.example. An operator following the env templates to configure production will not set METRICS_TOKEN, leaving /api/metrics fully unauthenticated. The endpoint exposes HTTP request counts, routes, status codes, and latencies — aggregated telemetry that reveals the application's internal route structure and error rates to any unauthenticated requester. This is also not protected by the global JwtAuthGuard due to @Public().

**Root cause:**
METRICS_TOKEN was added to the controller but not to the env template files used for operator onboarding.

**Code evidence:**
```
/**
 * OBS-011 — Exposes /api/metrics in Prometheus text format.
 *
 * Auth logic:
 *  - If METRICS_TOKEN is unset (dev/test), the endpoint is fully open.
 *  - If METRICS_TOKEN is set, the request MUST include an Authorization header
 *    matching "Bearer <METRICS_TOKEN>". Otherwise → 401.
 *
 * We mark the controller @Public() to bypass the global JwtAuthGuard
 */
```

**Suggested fix:**
Add `METRICS_TOKEN=` (with a generation command) to .env.example and .env.production.example with a prominent note that it is required in production. Also add to docker-compose.prod.yml's API environment block.

**Acceptance criteria:**
1. METRICS_TOKEN is documented in .env.example
2. METRICS_TOKEN is documented in .env.production.example
3. GET /api/metrics returns 401 in production when no token is provided
4. Commit message includes `[closes SA-SEC-012]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'METRICS_TOKEN' .env.example .env.production.example
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-012` to avoid ID collision with the primary run; original id `SEC-012` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Related (same run): SEC-011.

**Closed_by:** (empty — TODO)

---

### SA-OBS-010 — console.error() in UsersService.create() bypasses NestJS Logger and Fastify log redaction

- **Status:** TODO
- **Phase:** 4
- **Cluster:** S
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · raw-console-in-business-code
- **File:** `apps/api/src/users/users.service.ts:147-150`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-010` · audit-confidence: high · found_by: observability

**Description:**
UsersService.create() calls console.error() directly at line 147. This bypasses the NestJS Logger (which routes through Fastify's pino logger with structured fields and log-level filtering), and critically bypasses the Fastify redact.config.ts redaction layer. The interpolated value is createUserDto.login — a user-supplied login identifier that could be an email address (PII). Although the message is a critical internal error, the redaction pipeline configured in fastifyLoggerOptions never sees it. All other business-layer log emissions use this.logger (NestJS Logger).

**Root cause:**
Quick defensive log added without checking the Logger pattern.

**Code evidence:**
```
    if (!hashValid) {
      console.error(
        `[CRITICAL] bcrypt hash verification failed for user ${createUserDto.login}`,
      );
      throw new Error('Password hash verification failed');
```

**Suggested fix:**
Replace console.error() with `this.logger.error('[CRITICAL] bcrypt hash verification failed for user ' + createUserDto.login)` — or, since login is PII, log only the userId placeholder before the user is created: `this.logger.error('[CRITICAL] bcrypt hash verification failed (login redacted)')` and rely on the thrown Error to surface the context.

**Acceptance criteria:**
1. No console.* calls remain in apps/api/src/*.ts outside scripts/ and witness files
2. The bcrypt failure log line does not contain the raw login value in production output
3. Commit message includes `[closes SA-OBS-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'console\.' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src --include='*.ts' | grep -v '.spec.ts' | grep -v 'scripts/' | grep -v 'node_modules' | grep -v dist
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-010` to avoid ID collision with the primary run; original id `OBS-010` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-OBS-011 — console.warn() in SettingsService.onModuleInit() bypasses NestJS Logger

- **Status:** TODO
- **Phase:** 4
- **Cluster:** S
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** observability · raw-console-in-business-code
- **File:** `apps/api/src/settings/settings.service.ts:99-103`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-011` · audit-confidence: high · found_by: observability

**Description:**
SettingsService.onModuleInit() uses console.warn() instead of this.logger.warn(). This logs outside Fastify's pino pipeline, losing structured fields (service name, log level as machine-readable field, timestamp format consistency) and bypassing LOG_LEVEL filtering. This is a module-init path that runs on every container boot.

**Root cause:**
SettingsService has no private Logger instance injected.

**Code evidence:**
```
    } catch (error) {
      // Log but don't fail startup if settings table doesn't exist yet
      console.warn(
        'Warning: Could not initialize default settings. Table may not exist yet.',
        error instanceof Error ? error.message : error,
      );
```

**Suggested fix:**
Add `private readonly logger = new Logger(SettingsService.name);` to the class and replace console.warn() with this.logger.warn().

**Acceptance criteria:**
1. No console.* calls remain in SettingsService
2. The startup warning appears in NestJS structured log format
3. Commit message includes `[closes SA-OBS-011]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'console\.' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/settings/settings.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-011` to avoid ID collision with the primary run; original id `OBS-011` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-PERF-024 — fetchManagersAndDepartments called on every Create button click — not cached between invocations

- **Status:** TODO
- **Phase:** 4
- **Cluster:** T
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** performance · frontend-refetch
- **File:** `apps/web/app/[locale]/projects/page.tsx:243-263`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-024` · audit-confidence: high · found_by: performance

**Description:**
Every click of the 'Create Project' button re-fetches the full user list and all departments, even if the modal was opened and closed moments before. These are reference data that change infrequently. The refetch costs 2 sequential network round-trips per modal open.

**Root cause:**
No caching of reference data; fetched on demand per modal open.

**Code evidence:**
```
const fetchManagersAndDepartments = async () => {
    try {
      const [usersResponse, departments] = await Promise.all([
        usersService.getAll(),
        departmentsService.getAll(),
      ]);
      ...
    }
  };
  ...
  onClick={() => {
    setShowCreateModal(true);
    fetchManagersAndDepartments();
```

**Suggested fix:**
Fetch managers and departments once on page mount and cache in state, or use TanStack Query with a long staleTime (5 minutes) for reference data.

**Acceptance criteria:**
1. Opening the Create Project modal does not fire new API requests if data was fetched in the last 5 minutes
2. Commit message includes `[closes SA-PERF-024]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'fetchManagersAndDepartments' apps/web/app/[locale]/projects/page.tsx
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-024` to avoid ID collision with the primary run; original id `PERF-024` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-COR-009 — validateImport (tasks): end <= start is classified as a warning, but create() rejects end < start as an error — inconsistent boundary semantics

- **Status:** TODO
- **Phase:** 4
- **Cluster:** —
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🟡 nit
- **Live-gated:** no (code-verifiable)
- **Category:** correctness · off-by-one / date boundary
- **File:** `apps/api/src/tasks/tasks.service.ts:1673`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#COR-009` · audit-confidence: high · found_by: correctness

**Description:**
The `validateImport` dry-run marks equal-start-and-end-date tasks as `warning` (not `error`). The `create()` method (line 210) explicitly allows equal dates: `if (end < start)` (strict less-than). The validation preview therefore incorrectly flags valid single-day tasks (`start == end`) as warnings, confusing operators. The preview message 'antérieure ou égale' is also misleading since the actual constraint only rejects `end < start`.

**Root cause:**
The validation preview uses `<=` while the runtime constraint uses `<`.

**Code evidence:**
```
      if (end <= start) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            'La date de fin est antérieure ou égale à la date de début',
          );
        }
```

**Suggested fix:**
Change line 1673 to `if (end < start)` to match the runtime constraint and update the message to 'La date de fin est antérieure à la date de début'.

**Acceptance criteria:**
1. validateImport: a task with startDate == endDate is classified as 'valid', not 'warning'
2. validateImport: a task with endDate < startDate is classified as 'error'
3. Commit message includes `[closes SA-COR-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'end <= start\|end < start' apps/api/src/tasks/tasks.service.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-COR-009` to avoid ID collision with the primary run; original id `COR-009` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

## Phase 5 — Suggestion

### SEC-065 — getEventsByRange and findOne RBAC filter defaults to unscoped on null role — inconsistent with findAll

- **Status:** TODO
- **Phase:** 5
- **Cluster:** A
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** security · defense-in-depth
- **File:** `apps/api/src/events/events.service.ts:681-690`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-065` · audit-confidence: medium · found_by: security

**Description:**
In `getEventsByRange` (lines 681-690) and `findOne` (line 390-403), the RBAC scope filter is applied only when `currentUserId && currentUserRole` are both truthy. If `currentUserRole` is null, the filter block is skipped and the query is unscoped (returns all events). By contrast, `findAll` (lines 277-290) calls `getPermissionsForRole(null)` which correctly returns `[]`, and applies the scope filter because `!permissions.includes('events:readAll')` is true. Today, PermissionsGuardV2 (global APP_GUARD, enforce mode) rejects all null-role callers before reaching the controller, so this code path is unreachable in normal operation. However, the default-open pattern is fragile: if the guard configuration changes, or if these service methods are called internally with null roles, the scope filter would silently be omitted.

**Root cause:**
Defensive RBAC filter uses `if (currentUserId && currentUserRole)` (default-open) instead of unconditionally calling `getPermissionsForRole` (which safely returns [] for null role), inconsistent with the findAll pattern.

**Code evidence:**
```
    // Scope events for non-management users: only their own or participated
    if (currentUserId && currentUserRole) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('events:readAll')) {
        where.OR = [
          { participants: { some: { userId: currentUserId } } },
          { createdById: currentUserId },
        ];
      }
    }
```

**Suggested fix:**
Replace `if (currentUserId && currentUserRole)` with unconditional `getPermissionsForRole(currentUserRole)` call (handles null safely), matching the findAll pattern.

**Acceptance criteria:**
1. getEventsByRange applies scope filter even when currentUserRole is null
2. findOne applies IDOR check even when currentUserRole is null
3. Commit message includes `[closes SEC-065]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Confidence downgraded from high to medium: currently not exploitable due to PermissionsGuardV2 enforcement. findOne IDOR check at line 390: `if (currentUserId && currentUserRole && !(await this.hasManagementAccess(currentUserRole)))` — same default-open pattern confirmed verbatim. The inconsistency with findAll (lines 277-278 unconditionally calls getPermissionsForRole) is real and confirmed.

**Closed_by:** (empty — TODO)

---

### PER-061 — getLeaveBalance: Promise.all fan-out issues N×2 DB queries, one resolveAllocatedDays per leave type

- **Status:** TODO
- **Phase:** 5
- **Cluster:** D
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** performance · n-plus-1
- **File:** `apps/api/src/leaves/leaves.service.ts:2678-2732`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#PER-061` · audit-confidence: high · found_by: performance

**Description:**
`getLeaveBalance` loads all active leave types, then fans out into `Promise.all(leaveTypes.map(...))` where each iteration calls `resolveAllocatedDays` — which itself issues 2 sequential queries (individual balance findUnique + global balance findFirst). With N leave types (e.g. 8), this fires 16 concurrent DB queries. While concurrent rather than sequential, this adds per-request DB connection pressure and latency tail. The worker comment (PER-002) documents the bulk allLeaves approach but `resolveAllocatedDays` still fans out.

**Root cause:**
`resolveAllocatedDays` is not batch-aware: it always issues 2 queries for a single (userId, leaveTypeId, year) triple. There is no bulk variant that resolves all types for a user in a single query.

**Code evidence:**
```
    // Pour chaque type, calculer le solde en filtrant le résultat en mémoire
    const balancesByType = await Promise.all(
      leaveTypes.map(async (lt) => {
        const totalDays = await this.resolveAllocatedDays(
          userId,
          lt.id,
          currentYear,
        );
```

**Suggested fix:**
Add a `resolveAllocatedDaysForAll(userId, leaveTypeIds, year)` variant that uses `leaveBalance.findMany({ where: { userId, leaveTypeId: { in: leaveTypeIds }, year } })` and `leaveBalance.findMany({ where: { userId: null, leaveTypeId: { in: leaveTypeIds }, year } })` — two queries total, mapped to a Record<leaveTypeId, days> in memory.

**Acceptance criteria:**
1. GET /leaves/me/balance issues at most 4 DB queries regardless of the number of leave types (1 allLeaves + 2 bulk balance lookups + 1 leaveTypes list)
2. Commit message includes `[closes PER-061]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: Lower priority than P3-3/P3-4 because the fan-out is bounded by the number of leave types (typically < 15) and the queries run in parallel. resolveAllocatedDays verified at lines 2494-2524: exactly 2 sequential DB calls per invocation (findUnique individual + findFirst global).

**Closed_by:** (empty — TODO)

---

### SEC-066 — ICS import processes unbounded VEVENT count with sequential DB writes and no per-field length cap

- **Status:** TODO
- **Phase:** 5
- **Cluster:** F
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** security · resource-exhaustion
- **File:** `apps/api/src/planning-export/planning-export.service.ts:211-269`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#SEC-066` · audit-confidence: high · found_by: security

**Description:**
The `importIcs` function iterates over all VEVENTs in a parsed ICS file without any count cap. ImportIcsDto allows up to 5 MB of ICS content, which can contain thousands of VEVENT entries. Each event triggers a sequential `prisma.event.create` call. Additionally, the title (line 253) and description (line 254) extracted from VEVENT fields are truncated by `stripHtml` for HTML tags but are not length-capped before being written to the DB. The global throttle (30 req/s, 600 req/min) limits repeated calls but a single 5MB ICS can still cause a long-running sequential DB write loop.

**Root cause:**
No maximum VEVENT count guard and no per-field @MaxLength truncation on ICS-extracted data before DB insert.

**Code evidence:**
```
  async importIcs(
    icsContent: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number }> {
    const parsed = nodeIcal.sync.parseICS(icsContent);
    let imported = 0;
    let skipped = 0;

    for (const key of Object.keys(parsed)) {
```

**Suggested fix:**
Add a MAX_VEVENT_IMPORT constant (e.g. 500) and break early once exceeded. Truncate title to 200 chars and description to 5000 chars after stripHtml. Consider using createMany in a single transaction instead of sequential creates.

**Acceptance criteria:**
1. POST /planning-export/ics/import with ICS containing >500 VEVENTs returns HTTP 422 or imports only the first 500
2. ICS VEVENT titles longer than 200 chars are truncated on import
3. Commit message includes `[closes SEC-066]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: previewImport (line 172-209) has the same no-count-cap issue but is read-only so impact is lower.

**Closed_by:** (empty — TODO)

---

### DAT-030 — dat037 cascade UPDATE of task.projectId produces no audit_logs rows — N tasks silently rewritten under Cour-des-Comptes scope

- **Status:** TODO
- **Phase:** 5
- **Cluster:** H
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · audit_completeness
- **File:** `packages/database/prisma/migrations/20260528150000_dat037_task_project_consistency/migration.sql:40-47`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-030` · audit-confidence: high · found_by: data_integrity

**Description:**
The epics_cascade_projectid_trg and milestones_cascade_projectid_trg AFTER UPDATE triggers silently rewrite task.projectId on potentially many rows (e.g. moving a large epic to another project rewrites all its tasks). The audit_logs table records the parent (epic/milestone) UPDATE, but none of the N cascaded task rewrites appear in audit_logs. A Cour-des-Comptes auditor examining a task's project attribution history has no DB-level evidence of the cascade; they must infer it from the parent's audit entry, which requires cross-referencing epicId/milestoneId and timing. This is acknowledged in the migration comment as deliberate out-of-scope, but the gap is real and worth a future task.

**Root cause:**
The cascade is implemented as an AFTER UPDATE trigger on epics/milestones that issues a silent UPDATE on tasks, bypassing the application's AuditService which is the only path that writes to audit_logs.

**Code evidence:**
```
-- AUDIT IMPLICATIONS (documented for Cour des Comptes): the parent-side CASCADE
-- silently rewrites N task rows in one DDL fire. Today this is invariant maintenance
-- (the task's "true" project IS the parent's), but a future auditor may want a row in
-- audit_logs for each affected task. NOT added here — the existing OBS-002 trigger
-- pipeline doesn't cover system-derived consistency writes (only user mutations
-- through the app), and adding it now would be scope creep.
```

**Suggested fix:**
File a follow-up task (e.g. DAT-037b) to add audit_logs INSERT rows inside the cascade trigger functions for each affected task row, bracketed by a SYSTEM_CONSISTENCY action code. This is non-trivial because the cascade trigger runs at the DB level without access to the app's AuditService; it would require a plpgsql INSERT into audit_logs directly (similar to how OBS-002 inserts RELEASE_DEPLOYED rows). Alternatively, move the cascade logic from a DB trigger into the application service layer (EpicsService.update) where AuditService is already wired.

**Acceptance criteria:**
1. When an epic's projectId is changed, audit_logs contains one row per affected task with action='TASK_PROJECT_REASSIGNED' or equivalent
2. The audit chain remains intact (rowHash chains correctly through the new rows)
3. Commit message includes `[closes DAT-030]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The migration author explicitly documented this gap. Severity is suggestion only because the parent's audit row provides indirect derivability and the comment discloses the limitation. Code evidence verbatim confirmed at lines 40-47 of the migration file. EpicsService (apps/api/src/epics/epics.service.ts) contains no AuditService injection or audit logging for cascade task updates — confirmed via grep. The cascade trigger functions (epics_cascade_projectid_to_tasks, milestones_cascade_projectid_to_tasks) issue bare UPDATE statements with no audit side-effects.

**Closed_by:** (empty — TODO)

---

### DAT-031 — password_reset_tokens index (userId, usedAt) is non-partial — hot query path WHERE usedAt IS NULL will scan all rows including consumed tokens

- **Status:** TODO
- **Phase:** 5
- **Cluster:** I
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · non_partial_index_on_nullable_hot_filter
- **File:** `packages/database/prisma/migrations/20260604050007_dat028_password_reset_token_indexes/migration.sql:2-3`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#DAT-031` · audit-confidence: high · found_by: data_integrity

**Description:**
The auth service's hot query is `updateMany({ where: { userId, usedAt: null } })` (auth.service.ts:501) — finding all unused tokens for a user. The composite index (userId, usedAt) includes all rows, both used (usedAt IS NOT NULL, historical) and unused (usedAt IS NULL, active). Over time, as users request password resets repeatedly, the index grows with consumed token rows. A partial index WHERE usedAt IS NULL would be far smaller and faster for the hot path, since the active token set is always a tiny fraction of the historical set.

**Root cause:**
The index was created as a full composite index; the access pattern (filter on usedAt IS NULL) would be more efficiently served by a partial index.

**Code evidence:**
```
-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_usedAt_idx" ON "password_reset_tokens"("userId", "usedAt");
```

**Suggested fix:**
Replace with a partial index:
ʼʼʼsql
DROP INDEX IF EXISTS "password_reset_tokens_userId_usedAt_idx";
CREATE INDEX "password_reset_tokens_userId_active_idx" ON "password_reset_tokens"("userId") WHERE "usedAt" IS NULL;
ʼʼʼ
Keep the expiresAt index for GC scans.

**Acceptance criteria:**
1. EXPLAIN ANALYZE on `SELECT * FROM password_reset_tokens WHERE userId = 'x' AND usedAt IS NULL` uses the partial index (Index Scan) rather than a full composite index scan
2. Commit message includes `[closes DAT-031]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM password_reset_tokens WHERE "userId" = 'test-uuid' AND "usedAt" IS NULL;
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: CONFIRMED. Index code evidence is verbatim. auth.service.ts line 501: `where: { userId, usedAt: null }` confirmed. The existing index does provide a benefit over no index, but a partial index would be strictly superior for this access pattern.

**Closed_by:** (empty — TODO)

---

### OBS-029 — CI pipeline has no real VPS deployment step — 'notify-success' job only echoes, docker-publish does not SSH to prod

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** observability · no-real-deploy-workflow
- **File:** `.github/workflows/ci.yml:579-592`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#OBS-029` · audit-confidence: high · found_by: observability

**Description:**
The CI pipeline's final job ('notify-success') only echoes to stdout. docker-publish.yml pushes Docker images to GHCR but does not SSH to the production VPS (92.222.35.25) to perform a docker compose pull + up. There is no deployment workflow: the production deployment is a manual operation (confirmed by MEMORY.md: 'deploy workflow is fake'). This means CI green ≠ prod updated, and there is no audit trail of which CI run led to which prod deployment. The RELEASE_DEPLOYED audit action exists in the codebase and writes to audit_logs, but it is only triggered by DeploymentsService on container boot — the Github Actions pipeline cannot trigger it.

**Root cause:**
Deployment to the VPS was never automated in the GitHub Actions pipeline; it is performed manually via SSH. The ci.yml workflow was built as a CI-only pipeline, not a CD pipeline.

**Code evidence:**
```
  notify-success:
    name: Notify Success
    runs-on: ubuntu-latest
    needs: [lint, backend-tests, frontend-tests, build]
    if: success()

    steps:
      - name: Success Notification
        run: |
          echo "✅ CI/CD Pipeline completed successfully!"
          echo "All tests passed and build validated."
          echo "Commit: ${{ github.sha }}"
          echo "Branch: ${{ github.ref_name }}"
```

**Suggested fix:**
Add a deployment job after docker-build that: (1) SSHs to the VPS using a GitHub secret (PROD_SSH_KEY), (2) pulls the new image via docker compose pull, (3) runs docker compose up -d --env-file .env.production, (4) waits for the health endpoint. Alternatively, add a webhook-based trigger on the VPS that pulls and restarts on new GHCR image availability. Either approach should be gated on a manual approval step for production.

**Acceptance criteria:**
1. A GitHub Actions job exists that performs an actual docker compose pull + up on the VPS after a successful build
2. The job is gated on manual approval (environment protection rule) for the production environment
3. Deployment failures surface as failed workflow runs with actionable error output
4. Commit message includes `[closes OBS-029]`.
5. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'ssh\|rsync\|appleboy/ssh-action' .github/workflows/*.yml
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: ADVERSARIAL REVIEW: Fully confirmed. Code evidence at lines 579-592 is verbatim correct. This is a known, intentional gap documented in project MEMORY.md ('Deploy workflow is fake'). No SSH action, no appleboy/ssh-action, no real VPS deployment step found in any workflow file. Finding stands at severity=suggestion.

**Closed_by:** (empty — TODO)

---

### TST-012 — Permission matrix has no entry for GET /api/analytics/advanced/* endpoints (6 routes using reports:view)

- **Status:** TODO
- **Phase:** 5
- **Cluster:** O
- **Confidence:** primary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** tests · matrix-endpoint-gap
- **File:** `e2e/fixtures/permission-matrix.ts:389-407`
- **Source:** `audits/2026-06-04-adversarial-review/findings.json#TST-012` · audit-confidence: high · found_by: tests

**Description:**
The analytics controller has a sibling `AnalyticsAdvancedController` at path `analytics/advanced` with 6 GET endpoints (snapshots, workload, project-health, milestones-completion, tasks-breakdown, recent-activity), all gated by `@RequirePermissions('reports:view')`. The permission matrix only tests `reports:view` on `/api/analytics` and `/api/analytics/export`. While the permission code is covered, the advanced endpoints are never individually exercised by the matrix test loop. Additionally, `GET /api/projects/:id/snapshots` also uses `reports:view` (projects.controller.ts line 184) and is absent from the matrix.

**Root cause:**
Matrix design is permission-code-based (by intent — see TST-001 comment). Additional endpoints that reuse already-covered codes were not added as supplementary entries.

**Code evidence:**
```
  {
    action: "reports:view",
    resource: "analytics",
    method: "GET",
    apiEndpoint: "/api/analytics",
    allowedRoles: ["admin", "responsable", "manager", "observateur"],
    deniedRoles: ["referent", "contributeur"],
    description:
      "Accéder aux analytics — Admin, Responsable, Manager, Observateur (OBSERVER_FULL a reports:view)",
  },
```

**Suggested fix:**
Add at least one entry per new endpoint group to the matrix, or create a separate integration test for the advanced analytics controller. At minimum add an entry for `/api/analytics/advanced/workload` (representative) with the same allowedRoles/deniedRoles as `reports:view`.

**Acceptance criteria:**
1. At least one analytics/advanced endpoint is represented in the permission matrix or a dedicated RBAC test
2. Commit message includes `[closes TST-012]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'analytics/advanced' e2e/fixtures/permission-matrix.ts
```

**Notes:**
- Primary-run-only (268-run); not independently surfaced by the sessionA run.
- Audit note: The matrix TST-001 design goal is 100% coverage of @RequirePermissions codes, which is achieved. This finding is about endpoint-level coverage beyond that goal. Severity is suggestion. VERIFIED: code_evidence verbatim confirmed in permission-matrix.ts lines 389-407. AnalyticsAdvancedController confirmed at apps/api/src/analytics/advanced/analytics-advanced.controller.ts with 6 @RequirePermissions('reports:view') GET endpoints. `grep -n 'analytics/advanced' e2e/fixtures/permission-matrix.ts` returns empty — no matrix entries. analytics-advanced.spec.ts only tests UI behavior for admin/manager, … [truncated — full text in findings.json]

**Closed_by:** (empty — TODO)

---

### SA-OBS-015 — PermissionsGuardV2 deny due to missing decorator (uncovered route in enforce mode) logs but does not audit

- **Status:** TODO
- **Phase:** 5
- **Cluster:** E
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** observability · audit-trail-gap
- **File:** `apps/api/src/rbac/permissions.guard.ts:104-112`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#OBS-015` · audit-confidence: high · found_by: observability

**Description:**
When a route lacks both @RequirePermissions and @AllowSelfService in enforce mode, PermissionsGuardV2 logs a structured warn and returns false (403). The log includes the routeId but not the requesting user's ID or IP. This is a different code path from OBS-003 (which covers routes WITH a permission decorator where the user lacks the permission). Both paths result in 403 but are currently both unaudited. This path additionally risks hiding misconfiguration — a route returning 403 to all users due to a missing decorator looks identical in logs to a legitimate permission denial.

**Root cause:**
The guard has no AuditService injection; the warn() is the extent of observability on this path.

**Code evidence:**
```
    if (!hasAll && !hasAny) {
      const routeId = `${klass?.name ?? '?'}.${(handler as unknown as { name: string })?.name ?? '?'}`;
      if (this.mode === 'enforce') {
        this.logger.warn(
          `[RBAC enforce] route refusée (sans @RequirePermissions ni @AllowSelfService) : ${routeId}`,
        );
        return false;
      }
```

**Suggested fix:**
Inject AuditService into PermissionsGuardV2 and emit ACCESS_DENIED on both the 'no decorator' and 'missing permission' deny paths. Alternatively, add the user ID to the existing warn() log line.

**Acceptance criteria:**
1. A 403 from a route missing its RBAC decorator includes the requesting userId in the log line
2. Commit message includes `[closes SA-OBS-015]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
N/A — manual verification
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-OBS-015` to avoid ID collision with the primary run; original id `OBS-015` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: This is distinct from OBS-003 (which covers the permission-check failure path); both paths share the remediation approach.

**Closed_by:** (empty — TODO)

---

### SA-PERF-025 — AuditLog has no index on createdAt+id — ORDER BY createdAt DESC, id DESC scans the full table

- **Status:** TODO
- **Phase:** 5
- **Cluster:** F
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** performance · missing-index
- **File:** `apps/api/src/audit/audit-persistence.service.ts:154-156`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#PERF-025` · audit-confidence: medium · found_by: performance

**Description:**
The prevHash lookup inside every audit write sorts by (createdAt DESC, id DESC) LIMIT 1. Without a composite index on (createdAt, id), Postgres must sort the full audit_logs table to find the last row. As the audit table grows (the hash chain is immutable so rows are never deleted), this sort cost increases with table size.

**Root cause:**
No composite index on (createdAt DESC, id DESC) on audit_logs.

**Code evidence:**
```
      const prevRows = await tx.$queryRaw<Array<{ rowHash: string }>>`
        SELECT "rowHash" FROM audit_logs ORDER BY "createdAt" DESC, id DESC LIMIT 1
      `;
```

**Suggested fix:**
Add `@@index([createdAt(sort: Desc), id(sort: Desc)])` to the AuditLog model in schema.prisma. Verify with EXPLAIN ANALYZE.

**Acceptance criteria:**
1. schema.prisma has a composite index on AuditLog(createdAt DESC, id DESC)
2. EXPLAIN ANALYZE for the prevHash query shows Index Scan not Sort+Seq Scan
3. Commit message includes `[closes SA-PERF-025]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -A10 'model AuditLog' packages/database/prisma/schema.prisma
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-PERF-025` to avoid ID collision with the primary run; original id `PERF-025` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Prisma may not support sort-direction indexes in schema.prisma PSL — a raw SQL migration may be required.

**Closed_by:** (empty — TODO)

---

### SA-DAT-012 — User.roleId remains nullable — users without a role bypass RBAC entirely

- **Status:** TODO
- **Phase:** 5
- **Cluster:** J
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · schema_design
- **File:** `packages/database/prisma/schema.prisma:35-38`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-012` · audit-confidence: high · found_by: data_integrity

**Description:**
User.roleId is nullable as a transitional state documented in contract-03 §9. The RBAC V4 migration (20260420120000) dropped the legacy `users.role` enum column and backfilled roleId. However, the column remains nullable in the current schema (git HEAD 0997b30e). Any user with roleId IS NULL has no role and no permissions, effectively becoming a zero-permission user. The comment 'passera NOT NULL après backfill stable' has no associated migration in the 74-migration history.

**Root cause:**
The NOT NULL promotion step was deferred during the RBAC V4 migration to allow gradual rollout; the follow-up migration enforcing NOT NULL has not been written.

**Code evidence:**
```
  // RBAC V4 : FK vers Role (table `roles`). Nullable pendant la transition ;
  // passera NOT NULL après backfill stable. Cf. contract-03 §9.
  roleId              String?
  role                Role?    @relation(name: "UserRoleEntity", fields: [roleId], references: [id])
```

**Suggested fix:**
Add a migration: (1) verify 0 users have roleId IS NULL (`SELECT COUNT(*) FROM users WHERE roleId IS NULL`), (2) if clean: `ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;`, (3) update schema.prisma to `roleId String` (non-optional). Also update the UserCreateDto to require roleId.

**Acceptance criteria:**
1. psql: `\d users` shows roleId NOT NULL
2. Integration test: creating a user without roleId fails at the DB level
3. Commit message includes `[closes SA-DAT-012]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -n 'roleId.*NOT NULL\|roleId.*SET NOT NULL' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/20260419192835_rbac_v0_add_roles_table/migration.sql
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-012` to avoid ID collision with the primary run; original id `DAT-012` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: Schema comment explicitly flags this as deferred; no later migration promotes to NOT NULL. This is a known pending item per contract-03 §9.

**Closed_by:** (empty — TODO)

---

### SA-DAT-008 — Event.recurrenceDay, TeleworkRecurringRule.dayOfWeek, and PredefinedTaskRecurringRule.dayOfWeek have no BETWEEN 0 AND 6 DB CHECK

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/schema.prisma:968, 1007, 1114`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-008` · audit-confidence: high · found_by: data_integrity

**Description:**
Three columns encode day-of-week as Int with the documented valid range 0–6. No DB-level CHECK constraint was added in the DAT-003/004 migration family or any subsequent migration. The DTO layer validates these values at the application layer, but a direct SQL INSERT or a buggy service path could write day value 7 or -1. All three columns are commented with their range but have no DB floor.

**Root cause:**
The DAT-003/004 family focused on temporal range (startDate/endDate) and scalar bounds (progress, allocation, weight) but did not enumerate the smaller day-of-week columns.

**Code evidence:**
```
  recurrenceDay          Int? // 0=Monday, 1=Tuesday, ..., 6=Sunday
  ...
  dayOfWeek   Int // 0=Monday, 1=Tuesday, ..., 6=Sunday
  ...
  dayOfWeek         Int? // 0=Monday..6=Sunday ; NULL pour MONTHLY_DAY
```

**Suggested fix:**
Add three CHECK constraints in a single migration: `ALTER TABLE "events" ADD CONSTRAINT "events_recurrenceDay_ck" CHECK ("recurrenceDay" BETWEEN 0 AND 6); ALTER TABLE "telework_recurring_rules" ADD CONSTRAINT "telework_recurring_rules_dayofweek_ck" CHECK ("dayOfWeek" BETWEEN 0 AND 6); ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "predefined_task_recurring_rules_dayofweek_ck" CHECK ("dayOfWeek" BETWEEN 0 AND 6);`

**Acceptance criteria:**
1. Integration test: INSERT INTO events with recurrenceDay = 7 fails with check_violation
2. Integration test: INSERT INTO events with recurrenceDay = NULL passes (nullable column)
3. Commit message includes `[closes SA-DAT-008]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'recurrenceDay.*BETWEEN\|dayOfWeek.*BETWEEN\|recurrenceDay.*ck\|dayOfWeek.*ck' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-008` to avoid ID collision with the primary run; original id `DAT-008` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: All three columns documented as 0-6 range in schema comments but no DB CHECK found across all 74 migrations.

**Closed_by:** (empty — TODO)

---

### SA-DAT-009 — PredefinedTaskRecurringRule.weekInterval, monthlyOrdinal, monthlyDayOfMonth and Event.recurrenceWeekInterval have no DB-level range CHECKs

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/schema.prisma:1116-1119, 967`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-009` · audit-confidence: high · found_by: data_integrity

**Description:**
Four columns carry documented numeric bounds in comments but no DB CHECK: weekInterval (>= 1, otherwise a 0-interval recurrence loops infinitely), monthlyOrdinal (1–5 per comment), monthlyDayOfMonth (1–31 per comment), Event.recurrenceWeekInterval (nullable Int, should be > 0 when set). No migration in the 74-migration history adds a CHECK on any of these columns.

**Root cause:**
The DAT-004 migration family enumerated the bounded columns explicitly; these scheduling-specific bounds were not included in that pass.

**Code evidence:**
```
  weekInterval      Int       @default(1) // 1=weekly, 2=biweekly... pour WEEKLY uniquement
  recurrenceType    RecurrenceType @default(WEEKLY)
  monthlyOrdinal    Int? // 1..5 (5 = dernière occurrence du mois) pour MONTHLY_ORDINAL
  monthlyDayOfMonth Int? // 1..31 pour MONTHLY_DAY
  ...
  recurrenceWeekInterval Int?
```

**Suggested fix:**
Add CHECKs in a migration: `ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "predefined_task_recurring_rules_weekinterval_ck" CHECK ("weekInterval" >= 1); ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "predefined_task_recurring_rules_monthlyordinal_ck" CHECK ("monthlyOrdinal" BETWEEN 1 AND 5); ALTER TABLE "predefined_task_recurring_rules" ADD CONSTRAINT "predefined_task_recurring_rules_monthlyday_ck" CHECK ("monthlyDayOfMonth" BETWEEN 1 AND 31); ALTER TABLE "events" ADD CONSTRAINT "events_recurrenceweekinterval_ck" CHECK ("recurrenceWeekInterval" > 0);`

**Acceptance criteria:**
1. Integration test: INSERT predefined_task_recurring_rules with weekInterval = 0 fails with check_violation
2. INSERT with monthlyDayOfMonth = 32 fails, INSERT with monthlyDayOfMonth = NULL passes
3. Commit message includes `[closes SA-DAT-009]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'weekInterval.*CHECK\|monthlyOrdinal.*CHECK\|monthlyDayOfMonth.*CHECK\|recurrenceWeekInterval.*CHECK' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-009` to avoid ID collision with the primary run; original id `DAT-009` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: weekInterval added in migration 20260330185549 with DEFAULT 1 but no CHECK. monthlyOrdinal and monthlyDayOfMonth added in 20260424124537 with no CHECK.

**Closed_by:** (empty — TODO)

---

### SA-DAT-010 — startTime/endTime string columns have no DB CHECK enforcing endTime >= startTime

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/schema.prisma:326-328, 956-958, 1062-1063`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-010` · audit-confidence: high · found_by: data_integrity

**Description:**
Six time-of-day columns (Task.startTime/endTime, Event.startTime/endTime, PredefinedTask.startTime/endTime) have their format checked by the DAT-013 migration (HH:MM regex). However, no DB CHECK enforces that endTime >= startTime within a given row. A task with startTime='17:00' and endTime='09:00' passes all current DB constraints. The DTO layer could enforce ordering but string comparison of HH:MM works for 00:00–23:59, making a DB check simple and unambiguous.

**Root cause:**
DAT-013 focused solely on format validity; the intra-row ordering invariant was not included in scope.

**Code evidence:**
```
  startTime              String? // Horaire de début optionnel (format HH:MM)
  endTime                String? // Horaire de fin optionnel (format HH:MM)
  ...
  startTime              String? // Format HH:MM
  endTime                String? // Format HH:MM
```

**Suggested fix:**
Add a cross-column CHECK per table. String comparison of HH:MM format works correctly for 00:00–23:59: `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_time_order_ck" CHECK ("startTime" IS NULL OR "endTime" IS NULL OR "endTime" >= "startTime");` (same pattern for events and predefined_tasks).

**Acceptance criteria:**
1. Integration test: INSERT a task with startTime='17:00', endTime='09:00' fails with check_violation
2. INSERT with startTime='09:00', endTime=NULL passes (NULL is valid)
3. Commit message includes `[closes SA-DAT-010]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'tasks_time_order\|events_time_order\|predefined_tasks_time_order' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-010` to avoid ID collision with the primary run; original id `DAT-010` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: DAT-013 migration confirms format CHECKs exist but contains no ordering constraint. HH:MM lexicographic comparison is a reliable ordering for this format.

**Closed_by:** (empty — TODO)

---

### SA-DAT-011 — ProjectMember.startDate/endDate has no date-ordering CHECK (endDate >= startDate)

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** data_integrity · missing_check_constraint
- **File:** `packages/database/prisma/schema.prisma:242-259`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#DAT-011` · audit-confidence: high · found_by: data_integrity

**Description:**
The DAT-003 migration (20260527120000) adds endDate >= startDate CHECKs on leaves, projects, epics, telework_recurring_rules, leave_validation_delegates, and school_vacations. ProjectMember has optional startDate and endDate but is absent from that migration. An inverted membership period (startDate after endDate) is accepted by the DB.

**Root cause:**
ProjectMember was not included in the DAT-003 scope, possibly because both dates are optional — however the NULL semantics of the existing CHECKs show this is handled correctly (NULL passes a CHECK).

**Code evidence:**
```
model ProjectMember {
  id         String    @id @default(uuid())
  projectId  String
  userId     String
  role       String
  allocation Int?
  startDate  DateTime?
  endDate    DateTime?
  createdAt  DateTime  @default(now())
```

**Suggested fix:**
Add to a follow-up migration: `ALTER TABLE "project_members" ADD CONSTRAINT "project_members_dates_ck" CHECK ("endDate" >= "startDate");`

**Acceptance criteria:**
1. Integration test: INSERT project_member with startDate='2027-01-01', endDate='2026-01-01' fails with check_violation
2. INSERT with startDate='2026-01-01', endDate=NULL passes
3. Commit message includes `[closes SA-DAT-011]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -rn 'project_members.*dates_ck\|project_members.*CHECK.*date' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-DAT-011` to avoid ID collision with the primary run; original id `DAT-011` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: DAT-003 migration covers six tables but not project_members. NULL semantics are handled in that migration's preamble and would apply here without changes.

**Closed_by:** (empty — TODO)

---

### SA-SEC-017 — AppController GET / exposes docs and internal API endpoint list publicly without auth

- **Status:** TODO
- **Phase:** 5
- **Cluster:** M
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** security · information-disclosure
- **File:** `apps/api/src/app.controller.ts:1-24`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#SEC-017` · audit-confidence: high · found_by: security

**Description:**
The root GET / endpoint is @Public() and returns the application name, version, status, and a structured list of key API endpoints including the path to the Swagger docs (/api/docs). This is an information-disclosure endpoint that aids reconnaissance. The Swagger endpoint path leakage is especially relevant if SWAGGER_ENABLED=true is ever set without noticing this public disclosure point. The version field (2.0.0) helps attackers correlate known vulnerabilities.

**Root cause:**
Root endpoint was designed for developer convenience with no auth and includes rich metadata.

**Code evidence:**
```
@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return {
      name: "ORCHESTR'A V2 API",
      version: '2.0.0',
      status: 'operational',
      endpoints: {
        api: '/api',
        docs: '/api/docs',
        auth: '/api/auth',
        users: '/api/users',
        projects: '/api/projects',
        tasks: '/api/tasks',
      },
      message: 'API is running. Access endpoints via /api/*',
```

**Suggested fix:**
Remove the `endpoints` object and `version` from the root response, or restrict the endpoint to authenticated requests. A minimal `{ status: 'operational' }` response is sufficient for health discovery while minimizing information disclosure.

**Acceptance criteria:**
1. GET / does not return version information or endpoint listing
2. GET /api/health continues to function for container health checks
3. Commit message includes `[closes SA-SEC-017]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
curl -s http://localhost:4000/ | jq .
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-SEC-017` to avoid ID collision with the primary run; original id `SEC-017` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-TEST-014 — e2e/tests/reports/analytics-advanced.spec.ts: no RBAC denial test for contributeur/observateur

- **Status:** TODO
- **Phase:** 5
- **Cluster:** Q
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** tests · e2e-coverage
- **File:** `e2e/tests/reports/analytics-advanced.spec.ts:1-90`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-014` · audit-confidence: high · found_by: tests

**Description:**
The analytics-advanced E2E spec tests only the happy path (admin/manager can view the tab) and includes no denial assertions for roles lacking reports:view (contributeur, observateur). The permission-matrix covers reports:view and reports:export at the API level via api-permissions.spec.ts, but the analytics-advanced E2E only verifies the UI renders correctly — it does not assert that unauthorized roles are redirected or see an error. The spec imports from @playwright/test directly (not test-fixtures) but relies on storageState from the parent project.

**Root cause:**
Spec was written for happy-path smoke, RBAC denial was delegated entirely to api-permissions.spec.ts.

**Code evidence:**
```
import { test, expect } from "@playwright/test";

test.describe("Analytics Avancés tab", () => {
  test(
    "loads, switches to Avancés, renders 7 blocks, period & project filter work",
    { tag: "@smoke" },
    async ({ page }) => {
      // ── 1. Naviguer sur /reports ────────────────────────────────────────────
      await page.goto("/fr/reports");
```

**Suggested fix:**
Add a test that runs under the contributeur/observateur project: navigate to /fr/reports, verify the 'Avancés' tab is absent or the API calls return 403 (via network intercept).

**Acceptance criteria:**
1. Test exists that verifies contributeur cannot access the analytics-advanced UI tab
2. Commit message includes `[closes SA-TEST-014]`.
3. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
grep -c 'contributeur\|observateur\|403\|denied' /home/alex/Documents/REPO/ORCHESTRA/e2e/tests/reports/analytics-advanced.spec.ts
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-014` to avoid ID collision with the primary run; original id `TEST-014` in audits/2026-06-04-adversarial-review-sessionA/findings.json.

**Closed_by:** (empty — TODO)

---

### SA-TEST-018 — 73 migrations total; 50 have no dedicated integration spec (only schema-constraint-named ones covered)

- **Status:** TODO
- **Phase:** 5
- **Cluster:** Q
- **Confidence:** secondary-only
- **Blocked_by:** (none)
- **Severity:** 🔵 suggestion
- **Live-gated:** no (code-verifiable)
- **Category:** tests · migration-coverage
- **File:** `packages/database/prisma/migrations:start-end`
- **Source:** `audits/2026-06-04-adversarial-review-sessionA/findings.json#TEST-018` · audit-confidence: high · found_by: tests

**Description:**
73 migrations exist in packages/database/prisma/migrations. Integration specs (*.int.spec.ts in schema-constraints/) exist for: dat003, dat004, dat010, dat011, dat012, dat013, dat014, dat016, dat017, dat018, dat022, dat023, dat028, dat029, dat032, dat033, dat035, dat036, dat037, dat038, per010, per011, per012, per013 (23 specs). Migrations without any dedicated integration assertion include: dat015 (email length + case-insensitive indexes), dat021 (audit_logs.schemaVersion column + GIN index), dat025 (document FK soft-delete), dat026 (user deletedat shell), dat022 (department FK restrict — NOTE: dat022 IS covered by dat022-department-setnull.int.spec.ts), and the 47 early structural migrations (add_missing_tables, add_task_assignees, add_holidays_and_task_fields, and so on). Early migrations are low-risk (additive columns), but dat015, dat021, dat025 introduce behavioral constraints that have no regression test.

**Root cause:**
The schema-constraint integration test pattern was introduced mid-project; early and some later migrations were not backfilled.

**Code evidence:**
```
-- DAT-015: Add VarChar(254) length cap on email (RFC 5321) and
-- functional LOWER() unique indexes on email and login for case-insensitive uniqueness.
--
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);
CREATE UNIQUE INDEX "users_email_lower_uk" ON "users" (LOWER(email));
CREATE UNIQUE INDEX "users_login_lower_uk" ON "users" (LOWER(login));
```

**Suggested fix:**
Add apps/api/src/schema-constraints/dat015-email-case-insensitive.int.spec.ts that inserts two users with same email in different case and verifies the unique constraint rejects the duplicate. Add dat021-audit-schema-version.int.spec.ts verifying the schemaVersion column exists and GIN index is present (using information_schema).

**Acceptance criteria:**
1. At least one int spec asserts that duplicate email with different case is rejected
2. At least one int spec asserts schemaVersion column exists on audit_logs
3. Commit message includes `[closes SA-TEST-018]`.
4. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE.

**Verification command:**
```
find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/schema-constraints -name '*.int.spec.ts' | wc -l
```

**Notes:**
- sessionA-only finding (99-run). Namespaced `SA-TEST-018` to avoid ID collision with the primary run; original id `TEST-018` in audits/2026-06-04-adversarial-review-sessionA/findings.json.
- Audit note: dat022-department-setnull.int.spec.ts covers dat022. The count of uncovered migrations is approximately 50 (73 total minus 23 with dedicated specs). The high-risk uncovered migrations are dat015 and dat021.

**Closed_by:** (empty — TODO)

---

