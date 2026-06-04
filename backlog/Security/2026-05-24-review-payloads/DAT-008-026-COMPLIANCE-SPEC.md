# DAT-008 / DAT-026 — User deletion & retention compliance spec (DECISION-PREP)

> **Status: HALTED — awaiting operator compliance decisions.**
> This document PREPARES the work. It does NOT decide and does NOT implement.
> Nothing here closes DAT-008 or DAT-026. Three operator decisions (§5) gate
> implementation; do not start coding until they are answered.
>
> Author: post-run cleanup pass, 2026-06-04. Reviewer/decider: operator (DSI).

---

## 1. The problem (verified from primary source)

**DAT-008** — `schema.prisma`: the User back-relations cascade-delete on hard
delete of a user:
- `Leave.user` (`"UserLeaves"`) → `onDelete: Cascade` (schema.prisma ~626)
- `TimeEntry.user` (`"TimeEntryUser"`) → `onDelete: Cascade` (~454)
- `LeaveBalance.user` → `onDelete: Cascade` (~701)

A hard delete therefore **erases approved leave history, time entries and leave
balances**. French *Code du Travail* requires conservation of leave/working-time
records for **5 years** (and payslip-adjacent records up to 5 years; some social
documents longer). Cascade-on-delete conflicts with that obligation.

**DAT-026** — User has **no `deletedAt` soft-delete column**. (`@@index([isActive])`
already exists — added by PER-011 — so the audit's "no `@@index([isActive])`"
sub-point is already addressed; only the soft-delete column + index and the
"hard delete → soft delete + anonymization (RGPD)" posture remain.) Today a
"deletion" is either an `isActive=false` toggle (no erasure) or
`UsersService.hardDelete` (full cascade erasure).

**Current `hardDelete` behaviour** (`users.service.ts` ~916) — important context:
- It is **reserved for trail-less accounts**: `checkDependencies()` blocks the
  delete (409) when the user has active dependencies, and the design comment
  states it only runs for users who authored **zero `audit_logs` rows**.
- It emits a `USER_DELETED` audit snapshot (allow-listed fields, never the
  password hash) **before** erasing, then in one transaction deletes
  personalTodos, timeEntries, comments, userSkills, teleworkSchedules,
  validation-delegates, projectMembers, userServices, the user's
  `APPROVED`/`REJECTED` leaves, their `DONE` tasks, and finally the user row.

So the erasure of retained records (DAT-008) happens **inside `hardDelete`**, and
the RGPD tension is: *right-to-erasure* (delete the person's data) vs.
*legal retention* (keep leave/time records for 5 years). These pull in opposite
directions; **anonymisation reconciles them** (see §2).

---

## 2. Recommended posture — anonymise, don't delete

**Keep the records, erase the person.** Instead of cascading deletes, the user
row is **soft-deleted and its direct identifiers wiped**, while the
leave/time/balance rows are **retained** (their `userId` FK still points at the
now-anonymised user). The legal retention obligation is satisfied (records
persist, attributable to an internal pseudonymous id), and RGPD erasure is
satisfied (the person is no longer identifiable).

Concretely the posture is:

1. **Add `User.deletedAt DateTime?`** + `@@index([deletedAt])` (DAT-026). All
   read paths filter `deletedAt: null` (mirror the DAT-025 Document soft-delete
   precedent: `remove()` sets `deletedAt`, `findAll`/`findOne` filter it).
2. **Anonymise the direct identifiers** on the soft-deleted row (which PII
   fields exactly = **OPEN DECISION 1**, §5). At minimum the direct identifiers:
   `firstName`, `lastName`, `email`, `login`, `avatarUrl`/`avatarPreset`.
3. **UNIQUE tombstone for `email` / `login`** — DAT-015 added `@db.VarChar(254)`
   + a `@unique` constraint AND a **functional `LOWER()` unique index** (raw SQL)
   on both `email` and `login`. Anonymisation **cannot blank them to a constant**
   (the 2nd anonymised user would collide on the unique / LOWER-unique index).
   Each anonymised user must get a **unique, non-reversible tombstone**, e.g.
   `email = "deleted-<uuid>@anonymized.invalid"`, `login = "deleted-<uuid>"`
   (lower-cased, ≤254 chars, RFC-invalid TLD so it can never be a real address).
   The `<uuid>` is the user's own id (already opaque) or a fresh random — see
   OPEN DECISION 3 (reversibility).
4. **Retain Leave / TimeEntry / LeaveBalance** rows and their `userId` links —
   do **not** cascade. This requires **flipping the three FKs off `Cascade`**
   (to `Restrict`, so a hard delete is refused while rows exist, OR keeping the
   relation and never hard-deleting — the soft-delete path never deletes the
   user row at all). The exact FK action depends on whether hard delete is
   retired entirely or kept as an admin escape hatch (tied to OPEN DECISION 3).

This is the **same shape DAT-025 already applied to `Document`** (soft-delete via
`deletedAt`, filtered reads) and is consistent with the existing
`USER_DELETED` audit snapshot (the snapshot becomes the controlled,
RGPD-governed record of who was anonymised and when).

---

## 3. Coherence constraints (already-landed decisions this work must respect)

- **DAT-022 set `User.department` → `onDelete: Restrict`** (schema.prisma ~48,
  migration `20260603215133_dat022_department_fk_restrict`). A department cannot
  be deleted while users reference it; users must be reassigned first. The
  soft-delete/anonymisation posture must stay coherent with this — an anonymised
  user keeps its `departmentId` (or it is nulled as PII? = OPEN DECISION 1), and
  must not reintroduce a path that silently strips RBAC scope (the original
  DAT-022 concern).
- **DAT-015 unique + `LOWER()` indexes on `email`/`login`** — the tombstone
  scheme (§2.3) is mandatory; a blanked/constant identifier breaks the unique
  and the functional `LOWER()` unique index. `email` is `@db.VarChar(254)` so the
  tombstone must fit 254 chars.
- **`hardDelete` is trail-less-only today** — any user with `audit_logs` history
  already cannot be hard-deleted (409). So for the majority of real users the
  ONLY available "deletion" is `isActive=false`; anonymisation gives them a
  proper erasure path that does not violate retention.
- **`USER_DELETED` audit emit + chain** — the audit trail is hash-chained
  (`audit_logs` 5-layer defense-in-depth, live in prod). An anonymisation action
  should emit its own audited event (before/after, AC#4 of the backlog template)
  rather than silently mutating identifiers.

---

## 4. Implementation sketch (for AFTER the decisions — NOT to be built yet)

- **Schema** (`schema.prisma`): add `User.deletedAt DateTime?` + `@@index([deletedAt])`;
  change `Leave.user` / `TimeEntry.user` / `LeaveBalance.user` `onDelete`
  per OPEN DECISION 3 (Cascade → Restrict, or remove the hard-delete path).
  One forward migration (append-only; respects TOOL-DBSYNC-001 dev-DB hygiene).
- **Service** (`users.service.ts`): new `anonymise(userId)` (soft-delete + wipe
  identifiers + UNIQUE tombstone + `deletedAt=now` + `isActive=false`), emitting
  an audited `USER_ANONYMISED` (or reuse `USER_DELETED`) event. Repurpose / gate
  `hardDelete` per OPEN DECISION 3. Add `deletedAt: null` filters to user reads.
- **Witness (AC#2)**: a test proving (a) anonymise wipes identifiers + sets a
  unique tombstone that does not collide on the email/login (+LOWER) unique
  indexes, and (b) Leave/TimeEntry/LeaveBalance rows survive — FAILS before
  (cascade erases / blank identifier collides), PASSES after.
- **Gate**: tests + types + lint (now green) + build; one migration; coherence
  gate stays green; `[closes DAT-008]` and `[closes DAT-026]` once both land.

---

## 5. The three OPEN DECISIONS (operator-owned — answer these to unblock)

These are the under-specifications that caused DAT-008/026 to HALT. They are
compliance/policy calls, not engineering calls — they must NOT be auto-decided.

### DECISION 1 — Which PII fields are anonymised vs. kept?
For an anonymised user, which columns are wiped/tombstoned and which are kept for
the retained records to remain meaningful?
- **Direct identifiers** (clearly wipe): `firstName`, `lastName`, `email`,
  `login`, `avatarUrl`, `avatarPreset`.
- **Borderline (you decide)**: `departmentId` / service memberships (keep for
  workforce statistics on the retained leave/time records? or strip as PII?),
  `roleId`, `createdAt`. Stripping `departmentId` interacts with DAT-022 and with
  any analytics that aggregate retained records by department.
- **Question**: keep department/service linkage on retained records (statistics)
  or strip it (stricter minimisation)?

### DECISION 2 — Retention window?
How long are the retained Leave / TimeEntry / LeaveBalance records kept after a
user is anonymised, before a *second-stage* purge (if any)?
- French *Code du Travail* baseline ≈ **5 years** for leave/working-time records.
- **Question**: is there a hard purge at N years (e.g. a scheduled job deleting
  anonymised users' leave/time rows older than 5 years), or are they kept
  indefinitely (anonymised, so RGPD-safe)? If purge: what triggers it and what is
  N?

### DECISION 3 — Reversibility / when does it become irreversible?
- **Question A**: should anonymisation be **reversible** for a window (e.g. an
  "undo" within X days using a sealed mapping of `<uuid>` → original identifiers
  held in a restricted store) or **irreversible from the first commit** (tombstone
  derived from a fresh random uuid, original identifiers never persisted anywhere
  except the immutable `USER_DELETED`/`USER_ANONYMISED` audit snapshot)?
- **Question B**: is `hardDelete` (true row erasure) **retired entirely** (only
  anonymisation remains), or **kept as an admin escape hatch** for genuinely
  trail-less accounts (in which case the Cascade FKs may stay, since such users
  have no retained records by definition)? This determines the `onDelete` FK
  action in §4.
- Note: the audit snapshot itself contains the original identifiers (PII). If
  anonymisation must be **fully** irreversible/erasing, the audit snapshot's PII
  fields may also need redaction — which conflicts with the hash-chained
  immutability of `audit_logs`. **This tension is itself an operator call.**

---

## 6. Status

**DAT-008 and DAT-026 remain HALTED / TODO.** No schema change, no service
change, no migration has been made. Resume only after DECISIONS 1–3 are answered;
then implement §4 and close both with `[closes DAT-008]` / `[closes DAT-026]`.
