# DAT-008 / DAT-026 — User deletion: FULL ERASURE; audit-bearing users → anonymised shell (no retention, OBS-002 untouched)

> **Status: IMPLEMENTED & CLOSED.** Supersedes the original "anonymise-don't-delete
> + 5-year retention" prep (false premise) and the interim "option A/B pending" draft.
>
> Operator decision (A′, 2026-06-04): user deletion = **full erasure of PII +
> owned operational data in ALL cases**. This app is **NOT the SIRH of legal
> record** → no *Code du Travail* retention obligation. Where the **immutable**
> audit trail (`audit_logs.actorId`, OBS-002) blocks physical row deletion, keep an
> **anonymised shell** of the User row instead — **the audit subsystem is never
> touched**.

---

## 1. The decision (A′)

Two deletion paths, one invariant. **Invariant (both paths): PII gone + owned
operational data gone.**

- **Trail-less user** (authored zero `audit_logs` rows) → **physical row delete**.
- **Audit-bearing user** (authored ≥1 `audit_logs` row — i.e. anyone who has ever
  logged in, since `LOGIN_SUCCESS` sets `actorId = self`) → **anonymised shell**:
  the User row is kept (so the immutable `audit_logs.actorId` references stay
  valid) but **anonymised in place**, with all owned operational data erased.

There is **no retention window, no second-stage purge, no soft-delete of live
users, no anonymisation of the audit trail**. `audit_logs.actorId` stays
`ON DELETE NO ACTION`; the OBS-002 immutability trigger is **not** carved or
altered. The audit rows simply now point at an anonymised shell id.

### Anonymise-shell mechanics (inside `hardDelete`, one transaction)
1. Delete the user's **OWNED** records (§2a) — identical to the trail-less path.
2. **SET NULL** the secondary references — done at the DB by the FKs (§2b/§2c).
3. **Anonymise the User row in place**:
   - `email` → `deleted-{id}@anonymized.invalid`, `login` → `deleted-{id}`
     (UNIQUE tombstone keyed by the opaque id → respects the DAT-015 unique +
     `LOWER()` indexes; lowercase, ≤254 chars, RFC-invalid TLD).
   - `firstName`/`lastName` → constant tombstone (`'Utilisateur'`/`'supprimé'`).
     **NOTE:** these columns are NOT NULL, so they get a constant tombstone rather
     than literal `null` (the operator's "→ null" intent, realised the same way the
     operator tombstones email/login; making them nullable would be a
     high-blast-radius migration touching every name-display path — bounded out).
   - `avatarUrl` → null, `avatarPreset` → null; the on-disk avatar file is removed.
   - `deletedAt` = now → excludes the shell from active reads; `isActive` = false →
     blocks login (`auth.service.ts:101`).
   - `id` and non-identifying fields kept.
4. **Remove the on-disk uploaded avatar file** (PII) — in BOTH paths.
5. **Keep** the User row + its `audit_logs` rows intact.

---

## 2. FK classification table (every FK referencing `User`, re-derived from schema.prisma)

42 back-relations reference `User`. (`User.roleId`→Role and `User.departmentId`→
Department are the user's OWN forward FKs — columns on the user row; they never
block a user deletion.)

### 2a. OWNED → deleted explicitly in `hardDelete` (17)

`UserService.userId`, `ProjectMember.userId`, `TaskAssignee.userId`,
`Leave.userId` (ALL statuses), `LeaveValidationDelegate.delegatorId` +
`.delegateId`, `LeaveBalance.userId`, `TeleworkSchedule.userId`,
`TeleworkRecurringRule.userId`, `UserSkill.userId`, `TimeEntry.userId`,
`Comment.authorId`, `PersonalTodo.userId`, `EventParticipant.userId`,
`PredefinedTaskAssignment.userId`, `PredefinedTaskRecurringRule.userId`,
`PasswordResetToken.userId`, `RefreshToken.userId`.

> Scope choice (flagged): owned FKs are **left `Cascade`** and deleted **explicitly**
> in the service transaction (explicit deletes are the operative, auditable path;
> `Cascade` is only a backstop). No owned FK was ever `Restrict` (DAT-022 touched no
> user-referencing FK — §4), so flipping ~17 Cascade→Restrict would be a large,
> correctness-neutral migration. Bounded out; easy to add later for DB-layer
> defence-in-depth.

### 2b. SECONDARY → already `SET NULL` (unchanged, 11)

`Department.managerId`, `Service.managerId`, `Project.{createdById, managerId,
sponsorId, archivedById}`, `Task.assigneeId`, `Leave.{validatorId, validatedById}`,
`PredefinedTaskAssignment.completedById`, `Document.uploadedBy` (DAT-025).

### 2c. SECONDARY → flipped to nullable + `SET NULL` (12) — migration `20260604103344`

| Model.field | Before | Failure mode it caused |
|---|---|---|
| `TimeEntry.declaredById` | Restrict | BLOCKED delete (P2003) |
| `ThirdParty.createdById` | Restrict | BLOCKED delete |
| `TaskThirdPartyAssignee.assignedById` | Restrict | BLOCKED delete |
| `ProjectThirdPartyMember.assignedById` | Restrict | BLOCKED delete |
| `Holiday.createdById` | Restrict* | BLOCKED delete |
| `SchoolVacation.createdById` | Restrict* | BLOCKED delete |
| `Event.createdById` | Cascade | ORPHANED shared event + others' participants |
| `PredefinedTask.createdById` | Cascade | ORPHANED shared template |
| `PredefinedTaskAssignment.assignedById` | Cascade | ORPHANED another user's assignment |
| `PredefinedTaskRecurringRule.createdById` | Cascade | ORPHANED shared rule |
| `TeleworkRecurringRule.createdById` | Cascade | ORPHANED another user's rule |
| `PasswordResetToken.createdById` | Cascade | ORPHANED another user's token |

\* required relation, no explicit `onDelete` → Postgres default Restrict/NO ACTION.

### 2d. SECONDARY → kept immutable (1) — the reason the shell exists

`AuditLog.actorId` (`onDelete: NoAction`, OBS-002 immutability trigger). **Not
changed.** A user referenced here cannot be physically deleted → the
anonymised-shell path (§1) keeps the row and references intact.

---

## 3. Implemented changes

- **Migration `20260604103344_dat008_026_user_fk_full_erasure`**: the 12 §2c FKs →
  nullable + `ON DELETE SET NULL`. Relation fields made optional in `schema.prisma`.
- **Migration `20260604110510_dat026_user_deletedat_shell`**: `User.deletedAt
  DateTime?` + `@@index([deletedAt])` (the soft-delete marker for the shell path —
  this is DAT-026's "index half", now valid under A′).
- **`UsersService.hardDelete`**: one transaction; explicit `deleteMany` over the
  full §2a owned set, then **branch** on `auditLog.count({ actorId: id })`:
  `> 0` → `tx.user.update` to the anonymised shell (tombstone + `deletedAt` +
  `isActive:false`); `= 0` → `tx.user.delete`. Keeps the self-delete guard and the
  `USER_DELETED` audit snapshot (captured before, allow-list, never the password
  hash). On-disk avatar removed after the tx (both paths) via the shared
  SEC-015/017-hardened `removeAvatarFiles` helper.
- **`UsersService.checkDependencies`**: no longer blocks (deletion always succeeds);
  the audit count is reported as an INFORMATIONAL `AUDIT_LOGS` entry so the UI can
  signal "anonymised shell, not physical delete". `canDelete` is always true.
- **Read paths**: `findAll` + `findOne` filter `deletedAt: null` (mirror DAT-025) so
  shells are excluded from the directory and profile reads. `isActive=false` +
  tombstoned credentials keep the shell out of auth/active-user queries.
- **Witnesses** (RED→GREEN):
  - `user-harddelete-secondary-fk.int.spec.ts` (real DB): declaredBy no longer
    BLOCKS; `Event.createdBy` no longer ORPHANS.
  - `user-harddelete-fk.int.spec.ts` (real DB): the existing FK-NO-ACTION witness
    PLUS a new anonymised-shell witness — the row is anonymised in place, the audit
    row persists referencing the id, and a raw physical delete is STILL rejected
    (proving `audit_logs`/OBS-002 were not weakened).
  - `users.service.spec.ts` (unit): audit-bearing → anonymise (not 409, not delete);
    trail-less → physical delete; the new `checkDependencies`/read-filter semantics.

---

## 4. DAT-022 coherence — re-derived: **no change needed** (already closed)

DAT-022 set `User.departmentId → onDelete: Restrict` (migration `20260603215133`,
already DONE, Closed_by `0ac82e3`). That is the **User→Department** direction — a
column on the user's OWN row. Its `onDelete` fires when a **Department** is deleted,
**never** when a **User** is. It does **not** block user deletion, is **not**
touched by this work, and stays `Restrict` (preserving the DAT-022 RBAC-scope
protection). The operator's "DAT-022 coherence" branch assumed it had set a Restrict
on a user-*referencing* FK; it did not — the real user-referencing Restrict FKs were
`declaredBy` / the `createdBy` / `assignedBy` set (§2c), now flipped to SetNull.

---

## 5. Task status

- **DAT-008** — DONE. The retention premise is rejected; owned leave/time/balance
  records are erased intentionally (full erasure), and the immutable audit trail is
  preserved on the audit-bearing path (shell). No anonymisation of the audit trail,
  no SetNull-for-retention.
- **DAT-026** — DONE. "soft-delete + anonymisation of live users" dropped; instead
  `deletedAt` is the shell marker (the "index half"), `@@index([isActive])` already
  existed (PER-011), and the deletion-semantics rework (§1–§3) is implemented.
- **DAT-022** — already DONE (`0ac82e3`); re-derivation confirms no change.

---

## 6. Confirmation: `audit_logs` / OBS-002 untouched

- No change to `audit_logs.actorId` (`onDelete: NoAction` retained).
- No carve-out / alteration of the OBS-002 immutability trigger.
- No new audit-subsystem migration. The two new migrations touch only the 12
  secondary FKs (§2c) and add `User.deletedAt`.
- Witnessed: the existing `audit-immutability.int.spec.ts` (trigger rejects audit
  mutation) and the `user-harddelete-fk.int.spec.ts` FK-NO-ACTION test stay green;
  the new shell witness shows a raw user delete is still P2003-rejected.
