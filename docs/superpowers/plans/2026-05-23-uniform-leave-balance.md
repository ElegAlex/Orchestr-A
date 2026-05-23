# Uniform Leave-Balance Gating + Self-Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Replace the hardcoded CP-only balance check and the `maxDaysPerYear` annual cap with a single generic `LeaveBalance`-based gate that applies to all leave types. (2) Add a new RBAC permission `leaves:self_approve` granting ADMIN and RESPONSABLE users immediate `APPROVED` status on their own leave requests.

**Architecture:** Drop `LeaveTypeConfig.maxDaysPerYear` (column NULL across all production rows — no migration of data needed). `LeaveBalance` (existing table, individual override + global default) becomes the single source of truth: presence ⇒ gating; absence ⇒ unlimited. Add `leaves:self_approve` to the RBAC catalog, give it to templates ADMIN (automatic via `CATALOG_PERMISSIONS`) and RESPONSABLE (via the existing `LEAVES_SELF_SERVICE` bundle or an explicit entry, as the failing test will dictate). The leave-creation gate consults the permission to decide initial status when the leave is for oneself.

**Tech Stack:** Prisma 6 (migration), NestJS 11 / Vitest (backend), Next.js 16 / Jest (frontend), Playwright (E2E), `packages/rbac` compile-time templates.

**Work directly on `master`** per project convention.

**Spec reference:** `docs/superpowers/specs/2026-05-23-uniform-leave-balance-design.md`

---

## File Structure

### Files to modify

Backend:
- `packages/database/prisma/schema.prisma` — drop `maxDaysPerYear` column from `LeaveTypeConfig`
- `packages/database/prisma/migrations/2026XXXX_drop_max_days_per_year/migration.sql` — new migration (Prisma generates the file)
- `apps/api/src/leaves/leaves.service.ts` — replace lines 367-386 (gate) + lines 393-403 (validator/status); add helpers
- `apps/api/src/leaves/leaves.service.spec.ts` — update mock fixture (line 108), drop `maxDaysPerYear` test (line 331), add new gate + self-approval tests
- `apps/api/src/leave-types/dto/create-leave-type.dto.ts` — drop `maxDaysPerYear` field (lines 78-82)
- `apps/api/src/leave-types/dto/update-leave-type.dto.ts` — drop `maxDaysPerYear` field (line 62)
- `apps/api/src/leave-types/leave-types.service.ts` — drop assignment (line 39)
- `apps/api/src/rbac/__tests__/permissions.service.spec.ts` — bump catalog count (116 → 117)

RBAC:
- `packages/rbac/atomic-permissions.ts` — add `"leaves:self_approve"` to `PermissionCode` union (alphabetical in leaves group), to `LEAVES_SELF_SERVICE` bundle, and to `CATALOG_PERMISSIONS` (alphabetical)
- `packages/rbac/__tests__/templates.spec.ts` — bump catalog assertion (116 → 117), update `EXPECTED_COUNTS` for every template that gains the permission (TDD-driven)

Frontend:
- `apps/web/src/types/index.ts` — drop `maxDaysPerYear` (line 666)
- `apps/web/src/services/leave-types.service.ts` — drop `maxDaysPerYear` from 3 interfaces (lines 12, 31, 42)
- `apps/web/src/services/__tests__/leave-types.service.test.ts` — drop `maxDaysPerYear` from mock + tests (lines 23, 93)
- `apps/web/src/components/LeaveTypesManager.tsx` — drop `maxDaysPerYear` initial state (lines 35, 65), drop handler assignment (line 103), drop reset (line 171), drop table column (lines 322-326), drop form fields (lines 549-569, 725-746)
- `apps/web/app/[locale]/leaves/page.tsx` — drop `(N j/an)` suffix in two `<option>` renderings (lines 1299, 1444)

E2E:
- `e2e/tests/workflows/leave-balance-gating.spec.ts` — new file: scenarios for balanced/unlimited types + self-approval

### Files to read (no changes) for context

- `apps/api/src/leaves/leaves.service.ts:1750-1865` — `resolveAllocatedDays` and `getLeaveBalance` helpers (used by the new gate)
- `apps/api/src/leaves/leaves.service.ts:35-50` — `roleHasPermission` helper (used by self-approve check)
- `packages/rbac/templates.ts:304-310` — ADMIN template definition (uses `CATALOG_PERMISSIONS` directly)

---

## Task 1: Drop `maxDaysPerYear` column from Prisma schema and generate migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma:556`
- Create: `packages/database/prisma/migrations/<timestamp>_drop_max_days_per_year/migration.sql`

The Prisma migration tool will generate the SQL automatically. After this task the codebase compiles but tests still reference the dropped field — that's expected; subsequent tasks clean them up.

- [ ] **Step 1: Edit `schema.prisma` to remove the column**

Open `packages/database/prisma/schema.prisma`, locate line 556 inside model `LeaveTypeConfig`:

```prisma
  maxDaysPerYear   Int? // Limite annuelle (null = illimité)
```

Delete the entire line. The model after the edit:

```prisma
model LeaveTypeConfig {
  id               String   @id @default(uuid())
  code             String   @unique
  name             String
  description      String?
  color            String   @default("#10B981")
  icon             String   @default("🌴")
  isPaid           Boolean  @default(true)
  requiresApproval Boolean  @default(true)
  isActive         Boolean  @default(true)
  isSystem         Boolean  @default(false)
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Relations
  leaves        Leave[]
  leaveBalances LeaveBalance[]

  @@map("leave_type_configs")
}
```

- [ ] **Step 2: Generate the migration**

Run from repo root:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter database exec prisma migrate dev --name drop_max_days_per_year --create-only 2>&1 | tail -15
```

Expected: a new directory under `packages/database/prisma/migrations/<timestamp>_drop_max_days_per_year/` with a `migration.sql` file containing:

```sql
-- AlterTable
ALTER TABLE "leave_type_configs" DROP COLUMN "maxDaysPerYear";
```

(or equivalent — Prisma may add a `IF EXISTS` clause depending on settings).

- [ ] **Step 3: Apply the migration locally to verify it runs**

```bash
pnpm --filter database exec prisma migrate dev 2>&1 | tail -10
```

Expected: migration applied, Prisma client regenerated, no errors.

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm --filter database exec prisma generate 2>&1 | tail -5
```

Expected: `Generated Prisma Client (v6.x.x) to ./node_modules/@prisma/client in Xs`.

- [ ] **Step 5: Verify the column is gone from the TypeScript types**

```bash
grep -n "maxDaysPerYear" node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/index.d.ts 2>/dev/null | head -5 || echo "OK: type removed"
```

Expected: `OK: type removed` (or no matches).

- [ ] **Step 6: Do NOT commit yet** — wait for Task 5 to bundle backend deletions in one commit. Continue to Task 2.

---

## Task 2: Add helpers `hasConfiguredBalance` and `getAvailableDays` to `LeavesService`

**Files:**
- Modify: `apps/api/src/leaves/leaves.service.ts` (add two helper methods near `resolveAllocatedDays` at line 1750)

These two helpers split the concerns of the existing `resolveAllocatedDays` so the create-gate can ask "is there a configured balance?" separately from "how many days are available?".

- [ ] **Step 1: Add `hasConfiguredBalance` near line 1779 (right after `resolveAllocatedDays`)**

Insert this method immediately after the closing brace of `resolveAllocatedDays` (after line 1779):

```typescript
/**
 * Indique si une allocation de congés est configurée pour ce user/type/year.
 * Retourne true s'il existe une ligne LeaveBalance individuelle OU globale.
 * Absence de ligne ⇒ type illimité pour ce user/year.
 */
async hasConfiguredBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
): Promise<boolean> {
  const individual = await this.prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: { userId, leaveTypeId, year },
    },
    select: { id: true },
  });
  if (individual) return true;

  const global = await this.prisma.leaveBalance.findFirst({
    where: { userId: null, leaveTypeId, year },
    select: { id: true },
  });
  return global !== null;
}
```

- [ ] **Step 2: Add `getAvailableDays` immediately after `hasConfiguredBalance`**

```typescript
/**
 * Jours encore disponibles pour ce user/type/year :
 *   total alloué (override individuel sinon global)
 *   − jours APPROVED ou CANCELLATION_REQUESTED sur l'année
 *   − jours PENDING sur l'année
 * Suppose qu'une allocation est configurée (à vérifier avec hasConfiguredBalance).
 */
async getAvailableDays(
  userId: string,
  leaveTypeId: string,
  year: number,
): Promise<number> {
  const totalDays = await this.resolveAllocatedDays(userId, leaveTypeId, year);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const approvedLeaves = await this.prisma.leave.findMany({
    where: {
      userId,
      leaveTypeId,
      status: {
        in: [LeaveStatus.APPROVED, LeaveStatus.CANCELLATION_REQUESTED],
      },
      startDate: { gte: yearStart, lte: yearEnd },
    },
    select: { days: true },
  });
  const usedDays = approvedLeaves.reduce((sum, l) => sum + l.days, 0);

  const pendingLeaves = await this.prisma.leave.findMany({
    where: {
      userId,
      leaveTypeId,
      status: LeaveStatus.PENDING,
      startDate: { gte: yearStart, lte: yearEnd },
    },
    select: { days: true },
  });
  const pendingDays = pendingLeaves.reduce((sum, l) => sum + l.days, 0);

  return Math.max(0, totalDays - usedDays - pendingDays);
}
```

- [ ] **Step 3: Verify both methods are now exported on the class**

```bash
grep -n "hasConfiguredBalance\|getAvailableDays" apps/api/src/leaves/leaves.service.ts
```

Expected: each name appears at least twice (declaration + later usage that we'll add in Task 3).

---

## Task 3: Replace the leave-creation gate (uniform balance check)

**Files:**
- Modify: `apps/api/src/leaves/leaves.service.ts:367-386`

- [ ] **Step 1: Replace the CP-only + maxDaysPerYear blocks with the generic gate**

Locate the existing block at line 367-386:

```typescript
    // Vérifier le solde pour les congés payés (code CP)
    if (leaveTypeConfig.code === 'CP') {
      const balance = await this.getLeaveBalance(userId);

      if (balance.available < days) {
        throw new BadRequestException(
          `Solde de congés insuffisant. Disponible: ${balance.available} jours, Demandé: ${days} jours`,
        );
      }
    }

    // Vérifier la limite annuelle si définie
    if (leaveTypeConfig.maxDaysPerYear) {
      const usedDays = await this.getUsedDaysForType(userId, leaveTypeId);
      if (usedDays + days > leaveTypeConfig.maxDaysPerYear) {
        throw new BadRequestException(
          `Limite annuelle dépassée pour ${leaveTypeConfig.name}. Disponible: ${leaveTypeConfig.maxDaysPerYear - usedDays} jours, Demandé: ${days} jours`,
        );
      }
    }
```

Replace it with:

```typescript
    // Vérifier le solde si la typologie en a un de configuré (sinon : illimité).
    const requestYear = start.getFullYear();
    const hasBalance = await this.hasConfiguredBalance(
      userId,
      leaveTypeId,
      requestYear,
    );
    if (hasBalance) {
      const available = await this.getAvailableDays(
        userId,
        leaveTypeId,
        requestYear,
      );
      if (available < days) {
        throw new BadRequestException(
          `Solde insuffisant pour ${leaveTypeConfig.name}. Disponible: ${available} jours, Demandé: ${days} jours`,
        );
      }
    }
```

Note: `start` is the parsed `Date` already available in scope from line 280-281.

- [ ] **Step 2: Verify the file compiles (will still fail tests until Task 4)**

```bash
pnpm --filter=@orchestra/api build 2>&1 | tail -15
```

Expected: build clean. If there's a TypeScript error about `getUsedDaysForType` being unused, that's fine — it will be flagged but build still passes. If a hard error appears, fix it (likely the import of `LeaveStatus` enum needed by Task 2 helpers — verify it's already imported at the top of the file; if not, add it).

---

## Task 4: Update `LeavesService` spec for the new gate

**Files:**
- Modify: `apps/api/src/leaves/leaves.service.spec.ts`

- [ ] **Step 1: Update the mock leave type fixture (line 108) to drop the dropped field**

Delete the `maxDaysPerYear: null,` line from `mockLeaveTypeConfig` (around line 108):

```typescript
const mockLeaveTypeConfig = {
  id: 'leave-type-1',
  name: 'Congés payés',
  code: 'CP',
  color: '#10B981',
  icon: '🌴',
  isPaid: true,
  isActive: true,
  requiresApproval: true,
  // (maxDaysPerYear line removed)
};
```

- [ ] **Step 2: Delete the obsolete test "should throw BadRequestException when annual limit is exceeded"**

Locate the `it(...)` block starting around line 331 (`it('should throw BadRequestException when annual limit is exceeded'`). Delete the entire `it` block including its trailing `});`. The test is obsolete because `maxDaysPerYear` no longer exists.

- [ ] **Step 3: Find the existing CP-balance test and adapt it to the new generic gate**

Locate the test that asserts CP balance refusal (around line 320-330, the one that currently sets up `leaveTypeConfig.code === 'CP'` and expects a `BadRequestException`). Read it carefully — under the new logic, that test must be re-keyed: now the refusal happens because **a `LeaveBalance` row exists**, not because the code is 'CP'.

Rewrite the test to:

```typescript
it('should throw BadRequestException when configured balance is exceeded', async () => {
  // Type quelconque (par ex. RTT) avec une LeaveBalance globale de 10 jours
  const typeWithBalance = { ...mockLeaveTypeConfig, code: 'RTT' };
  mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
  mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(typeWithBalance);

  // hasConfiguredBalance : pas d'override individuel, un global existe
  mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null); // individual
  mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({ id: 'g1' }); // global presence

  // getAvailableDays → resolveAllocatedDays : individual null, global 10
  mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
  mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({ totalDays: 10 });

  mockPrismaService.leave.findMany
    .mockResolvedValueOnce([]) // overlap check
    .mockResolvedValueOnce([]) // approved leaves (0 used)
    .mockResolvedValueOnce([]); // pending leaves

  // Le DTO demande 12 jours, donc 10 - 0 - 0 = 10 < 12 → rejet
  await expect(
    service.create('user-1', { ...createLeaveDto, /* days will be computed to >10 by the date range */ }),
  ).rejects.toThrow(BadRequestException);
});
```

The exact mock-resolution order depends on the helpers' internal calls; verify by reading `hasConfiguredBalance` and `resolveAllocatedDays` carefully. Adjust the mock resolution chain so:
1. `hasConfiguredBalance` returns `true` (one individual lookup returning null, one global lookup returning a row)
2. `getAvailableDays` calls `resolveAllocatedDays` (one individual lookup returning null, one global lookup returning `{ totalDays: 10 }`) then the two `findMany` calls for approved and pending

- [ ] **Step 4: Add a new test: "should allow leave when type has no configured balance"**

Add after the test above:

```typescript
it('should allow leave when type has no configured balance (unlimited)', async () => {
  const typeWithoutBalance = { ...mockLeaveTypeConfig, code: 'OTHER' };
  mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
  mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(typeWithoutBalance);

  // hasConfiguredBalance : aucune ligne (individual + global tous deux null)
  mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
  mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

  mockPrismaService.leave.findMany.mockResolvedValueOnce([]); // overlap check only
  mockPrismaService.leave.create.mockResolvedValue(mockLeave);

  const result = await service.create('user-1', createLeaveDto);
  expect(result).toBeDefined();
  expect(mockPrismaService.leave.create).toHaveBeenCalled();
});
```

- [ ] **Step 5: Add a new test: "individual override beats global balance"**

```typescript
it('should use individual override when both individual and global balances exist', async () => {
  const typeRtt = { ...mockLeaveTypeConfig, code: 'RTT' };
  mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
  mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(typeRtt);

  // hasConfiguredBalance : individual existe
  mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce({ id: 'i1' });
  // hasConfiguredBalance returns immediately, no global lookup

  // getAvailableDays → resolveAllocatedDays : individual gives totalDays=3 (override)
  mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce({ totalDays: 3 });

  mockPrismaService.leave.findMany
    .mockResolvedValueOnce([]) // overlap
    .mockResolvedValueOnce([]) // approved
    .mockResolvedValueOnce([]); // pending

  // Demande 5 jours, override = 3 → rejet
  await expect(
    service.create('user-1', { ...createLeaveDto /* shape that produces 5 days */ }),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 6: Run only the leaves spec, expect green**

```bash
pnpm --filter=@orchestra/api test -- leaves.service 2>&1 | tail -20
```

Expected: all leave-service tests pass. If a test fails with `getUsedDaysForType is not a function` or similar, that means the obsolete tests still reference the legacy helper — find and delete those (or update them).

---

## Task 5: Drop `maxDaysPerYear` from backend DTOs and service mapping; commit Batch 1

**Files:**
- Modify: `apps/api/src/leave-types/dto/create-leave-type.dto.ts:75-83`
- Modify: `apps/api/src/leave-types/dto/update-leave-type.dto.ts` (line 62 region)
- Modify: `apps/api/src/leave-types/leave-types.service.ts:39`

- [ ] **Step 1: Edit `create-leave-type.dto.ts`**

Delete this block (around lines 78-82):

```typescript
  @ApiPropertyOptional({ description: 'Limite annuelle (jours)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDaysPerYear?: number;
```

If the `Min` import becomes unused after deletion, also remove it from the `class-validator` import list at the top of the file. Verify by grepping:

```bash
grep -n "@Min" apps/api/src/leave-types/dto/create-leave-type.dto.ts
```

If no other `@Min` decorators remain, remove `Min` from the import.

- [ ] **Step 2: Edit `update-leave-type.dto.ts`**

Locate the same `maxDaysPerYear` block (around line 62) and delete it. Same cleanup rule for `Min` import if it becomes unused.

- [ ] **Step 3: Edit `leave-types.service.ts:39`**

Locate the line:

```typescript
        maxDaysPerYear: createLeaveTypeDto.maxDaysPerYear,
```

Delete it. Be careful with surrounding commas — the data object should remain syntactically valid.

- [ ] **Step 4: Verify the backend builds cleanly**

```bash
pnpm --filter=@orchestra/api build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 5: Run the relevant tests**

```bash
pnpm --filter=@orchestra/api test -- leave 2>&1 | tail -15
```

Expected: green. If `leave-types.service.spec.ts` (if it exists) still references `maxDaysPerYear`, drop those references too. Verify:

```bash
grep -rn "maxDaysPerYear" apps/api 2>/dev/null
```

Expected: zero hits in `apps/api`.

- [ ] **Step 6: Commit Batch 1 (schema + migration + service + DTOs + tests)**

Targeted stage — do NOT include unrelated working-tree changes:

```bash
git add packages/database/prisma/schema.prisma \
        packages/database/prisma/migrations/ \
        apps/api/src/leaves/leaves.service.ts \
        apps/api/src/leaves/leaves.service.spec.ts \
        apps/api/src/leave-types/

git status -s
git commit -m "Uniform leave balance gating: drop maxDaysPerYear, use LeaveBalance only"
```

---

## Task 6: Add `leaves:self_approve` to the RBAC catalog

**Files:**
- Modify: `packages/rbac/atomic-permissions.ts` (3 edits)

- [ ] **Step 1: Add to the `PermissionCode` union (alphabetical in `leaves` group)**

Locate the `leaves` group in the `PermissionCode` union (around line 78-87) and insert in alphabetical order:

```typescript
  | "leaves:read"
  | "leaves:readAll"
  | "leaves:self_approve"
  | "leaves:update"
```

Also update the comment count above the leaves group: change `// leaves (10)` (or whatever count exists) to `// leaves (11)`.

- [ ] **Step 2: Add to a bundle**

Decide where to add. Three reasonable options:
- (a) Add to `LEAVES_SELF_SERVICE` (line 263-267). This is the simplest, but it grants self-approval to every template using that bundle (likely too broad — `LEAVES_SELF_SERVICE` is typically given to all employees).
- (b) Create a new dedicated bundle `LEAVES_SELF_APPROVE` and add it only to ADMIN_DELEGATED + RESPONSABLE explicitly.
- (c) Add the literal `"leaves:self_approve"` directly to RESPONSABLE's `compose(...)` array.

**Recommended: option (b) — a new dedicated bundle.** Add this constant near the other `LEAVES_*` bundles (after `LEAVES_GLOBAL` around line 444):

```typescript
/**
 * Permet d'auto-valider ses propres demandes de congés (statut APPROVED
 * direct, sans entrée dans la liste des PENDING). Attribué aux rôles
 * d'encadrement de haut niveau (ADMIN, RESPONSABLE, ADMIN_DELEGATED).
 */
export const LEAVES_SELF_APPROVE = [
  "leaves:self_approve",
] as const satisfies readonly PermissionCode[];
```

- [ ] **Step 3: Add to `CATALOG_PERMISSIONS`**

Locate `CATALOG_PERMISSIONS` (around line 660+) and find the alphabetical position in the `leaves` block. Insert:

```typescript
  "leaves:read",
  "leaves:readAll",
  "leaves:self_approve",
  "leaves:update",
```

Also update the doc comment around line 615 (`Liste exhaustive des 116 permissions canoniques`) to `117` if a count is mentioned.

- [ ] **Step 4: Verify the catalog compiles**

```bash
pnpm --filter=@orchestra/rbac build 2>&1 | tail -10
```

Expected: clean (or no build script — at minimum, run the test in next task to validate via vitest's tsc pass).

---

## Task 7: Wire `leaves:self_approve` into RESPONSABLE template + update catalog tests

**Files:**
- Modify: `packages/rbac/templates.ts` (locate RESPONSABLE template, add bundle or permission)
- Modify: `packages/rbac/__tests__/templates.spec.ts` (update catalog and EXPECTED_COUNTS)
- Modify: `apps/api/src/rbac/__tests__/permissions.service.spec.ts` (catalog count 116 → 117)

**Note:** ADMIN gets the permission automatically because its template is `permissions: CATALOG_PERMISSIONS` (line 310). ADMIN_DELEGATED gets it via `without(CATALOG_PERMISSIONS, [<exclusions>])` (line 334) unless explicitly excluded. RESPONSABLE needs an explicit add.

- [ ] **Step 1: Add the bundle to RESPONSABLE**

Locate the RESPONSABLE template in `packages/rbac/templates.ts`. It uses `compose(...)` like other templates. Add `LEAVES_SELF_APPROVE` to its compose list. Import it from `./atomic-permissions` at the top of the file if not already imported.

To find RESPONSABLE:

```bash
grep -n "^  RESPONSABLE:" packages/rbac/templates.ts
```

The block looks like:

```typescript
  RESPONSABLE: {
    key: "RESPONSABLE",
    defaultLabel: "Responsable",
    category: "...",
    description: "...",
    permissions: compose(
      // ... existing bundles ...
    ),
  },
```

Add `LEAVES_SELF_APPROVE` to the `compose(...)` call in a place consistent with the alphabetical/categorical order used in the file.

- [ ] **Step 2: Update the catalog assertion in `templates.spec.ts`**

In `packages/rbac/__tests__/templates.spec.ts`, find:

```typescript
  it("CATALOG_PERMISSIONS contient exactement 116 permissions", () => {
    expect(CATALOG_PERMISSIONS.length).toBe(116);
```

Change to:

```typescript
  it("CATALOG_PERMISSIONS contient exactement 117 permissions", () => {
    expect(CATALOG_PERMISSIONS.length).toBe(117);
```

Also append a new line to the historical comments block:

```typescript
// Mise à jour 2026-05-23 : ajout de leaves:self_approve (catalogue 116 → 117).
// Distribué via LEAVES_SELF_APPROVE à ADMIN (catalogue complet), ADMIN_DELEGATED
// (catalogue moins exclusions), et RESPONSABLE (ajout explicite via compose).
```

- [ ] **Step 3: Update EXPECTED_COUNTS via TDD**

Run the templates test:

```bash
pnpm --filter=@orchestra/rbac test -- templates 2>&1 | tail -40
```

Expected: each template that gained the permission reports an off-by-one (`expected X, received X+1`). Increment those entries in `EXPECTED_COUNTS` by 1 (the failing tests are authoritative).

Expected templates to bump (predicted, verify with the test output):
- `ADMIN` (catalog grows by 1)
- `ADMIN_DELEGATED` (catalog minus exclusions grows by 1, unless `leaves:self_approve` ends up in the exclusion list — it shouldn't)
- `RESPONSABLE` (explicit add)

Other templates should remain unchanged.

- [ ] **Step 4: Re-run until green**

```bash
pnpm --filter=@orchestra/rbac test 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 5: Update the API catalog count assertion**

In `apps/api/src/rbac/__tests__/permissions.service.spec.ts:241-243`, change:

```typescript
    it('CATALOG_PERMISSIONS contient 116 permissions', () => {
      expect(CATALOG_PERMISSIONS.length).toBe(116);
```

to:

```typescript
    it('CATALOG_PERMISSIONS contient 117 permissions', () => {
      expect(CATALOG_PERMISSIONS.length).toBe(117);
```

- [ ] **Step 6: Verify the API permissions spec passes**

```bash
pnpm --filter=@orchestra/api test -- permissions.service 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 7: Update the atomic-permissions header doc comment if it mentions a count**

```bash
grep -n "Liste exhaustive des" packages/rbac/atomic-permissions.ts
```

If it says `116`, change to `117`.

---

## Task 8: Implement self-approval in `LeavesService.create()` + tests

**Files:**
- Modify: `apps/api/src/leaves/leaves.service.ts` (around line 388-403, the validator + initialStatus block)
- Modify: `apps/api/src/leaves/leaves.service.spec.ts` (add 4 tests)

- [ ] **Step 1: Update the validator/initialStatus block**

Locate this block (around line 388-403):

```typescript
    // Trouver le validateur approprié (manager du département ou délégué actif)
    const validatorId = leaveTypeConfig.requiresApproval
      ? await this.findValidatorForUser(userId)
      : null;

    // Statut initial selon si validation requise
    // Un congé déclaré par un manager/responsable pour un collaborateur → APPROVED directement
    const initialStatus =
      declaredByManager || !leaveTypeConfig.requiresApproval
        ? LeaveStatus.APPROVED
        : LeaveStatus.PENDING;
```

Replace with:

```typescript
    // Auto-validation : un utilisateur ayant `leaves:self_approve` qui crée
    // un congé pour lui-même obtient directement APPROVED. La voie
    // "déclaration pour autrui" (declaredByManager) garde sa logique propre.
    const isForSelf = !declaredByManager;
    const canSelfApprove =
      isForSelf &&
      (await this.roleHasPermission(requestingUserRole, 'leaves:self_approve'));

    // Trouver le validateur approprié (sauf cas d'auto-approbation)
    const requiresValidator =
      leaveTypeConfig.requiresApproval && !declaredByManager && !canSelfApprove;
    const validatorId = requiresValidator
      ? await this.findValidatorForUser(userId)
      : null;

    // Statut initial : APPROVED si déclaré pour autrui par manager, si type
    // sans approbation requise, ou si auto-validation autorisée.
    const initialStatus =
      declaredByManager || !leaveTypeConfig.requiresApproval || canSelfApprove
        ? LeaveStatus.APPROVED
        : LeaveStatus.PENDING;
```

- [ ] **Step 2: Verify backend still builds**

```bash
pnpm --filter=@orchestra/api build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 3: Add tests for self-approval in `leaves.service.spec.ts`**

Add a new `describe('self-approval', ...)` block near the create tests. Use this structure:

```typescript
describe('self-approval (leaves:self_approve)', () => {
  it('grants APPROVED status when requesting user has leaves:self_approve and creates for self', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
      ...mockLeaveTypeConfig,
      requiresApproval: true,
    });

    // hasConfiguredBalance: no balance (unlimited)
    mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);

    // overlap check
    mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

    // roleHasPermission('ADMIN', 'leaves:self_approve') → true (via mock)
    // The test should mock the prisma call backing roleHasPermission accordingly.
    // Verify by reading roleHasPermission impl around line 35-50; mock the
    // table it queries (`role.findUnique` with permissions include, or
    // role_permissions.findFirst — depends on implementation).
    mockPrismaService.role.findUnique.mockResolvedValue({
      code: 'ADMIN',
      // template-based check: mock whatever roleHasPermission reads
    });

    mockPrismaService.leave.create.mockResolvedValue({
      ...mockLeave,
      status: LeaveStatus.APPROVED,
      validatorId: null,
    });

    const result = await service.create('user-1', createLeaveDto, 'ADMIN');
    expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaveStatus.APPROVED,
          validatorId: null,
        }),
      }),
    );
  });

  it('keeps PENDING status when user does not have leaves:self_approve', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue({
      ...mockLeaveTypeConfig,
      requiresApproval: true,
    });
    mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce(null);
    mockPrismaService.leave.findMany.mockResolvedValueOnce([]);

    // roleHasPermission returns false
    mockPrismaService.role.findUnique.mockResolvedValue({
      code: 'CONTRIBUTEUR',
      // mock the permissions to NOT include leaves:self_approve
    });

    mockPrismaService.leave.create.mockResolvedValue({
      ...mockLeave,
      status: LeaveStatus.PENDING,
    });

    await service.create('user-1', createLeaveDto, 'CONTRIBUTEUR');
    expect(mockPrismaService.leave.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaveStatus.PENDING,
        }),
      }),
    );
  });

  it('does not self-approve when leave is for another user (targetUserId)', async () => {
    // declaredByManager path — separate test confirming that having
    // leaves:self_approve does NOT bypass the manager-for-other workflow
    // (which has its own auto-approval logic).
    // (Concrete mocks: declaredByManager = true via targetUserId !== requestingUserId,
    // role having both leaves:declare_for_others AND leaves:self_approve.)
    // Assert that the path stays in the existing branch.
    // ... See existing 'declared for collaborator' tests for the full mock shape.
  });

  it('still respects balance check before self-approving', async () => {
    // Even with self_approve, if balance is configured AND insufficient,
    // the request is rejected with BadRequestException BEFORE the status is set.
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.leaveTypeConfig.findUnique.mockResolvedValue(mockLeaveTypeConfig);

    // Balance configured globally
    mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({ id: 'g1' });
    mockPrismaService.leaveBalance.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.leaveBalance.findFirst.mockResolvedValueOnce({ totalDays: 1 });

    mockPrismaService.leave.findMany
      .mockResolvedValueOnce([]) // overlap
      .mockResolvedValueOnce([]) // approved
      .mockResolvedValueOnce([]); // pending

    await expect(
      service.create('user-1', createLeaveDto, 'ADMIN'),
    ).rejects.toThrow(BadRequestException);
  });
});
```

For the third test (manager-for-other path), copy the mock shape from an existing test that exercises `declaredByManager`. The exact mock setup is identical to that test; the only assertion is that the leave is created with the expected status.

- [ ] **Step 4: Run the leaves spec**

```bash
pnpm --filter=@orchestra/api test -- leaves.service 2>&1 | tail -25
```

Expected: green. If `roleHasPermission` mock setup is wrong (test fails with "cannot read property X of undefined"), read its implementation in `leaves.service.ts:35-50` and align the mock chain to whatever Prisma calls it makes.

- [ ] **Step 5: Commit Batch 2 (RBAC permission + self-approval flow)**

```bash
git add packages/rbac/ \
        apps/api/src/rbac/__tests__/permissions.service.spec.ts \
        apps/api/src/leaves/leaves.service.ts \
        apps/api/src/leaves/leaves.service.spec.ts

git commit -m "Add leaves:self_approve permission and auto-approve own leaves for ADMIN/RESPONSABLE"
```

---

## Task 9: Drop `maxDaysPerYear` from frontend types and services

**Files:**
- Modify: `apps/web/src/types/index.ts:666`
- Modify: `apps/web/src/services/leave-types.service.ts:12, 31, 42`
- Modify: `apps/web/src/services/__tests__/leave-types.service.test.ts:23, 93`

- [ ] **Step 1: Edit `apps/web/src/types/index.ts:666`**

Find and delete:

```typescript
  maxDaysPerYear?: number | null;
```

- [ ] **Step 2: Edit `apps/web/src/services/leave-types.service.ts`**

Delete the three occurrences (lines 12, 31, 42) inside `LeaveTypeConfig`, `CreateLeaveTypeDto`, and `UpdateLeaveTypeDto` interfaces:

```typescript
  maxDaysPerYear?: number;
```

Verify there are no remaining references in the file:

```bash
grep -n "maxDaysPerYear" apps/web/src/services/leave-types.service.ts
```

Expected: zero hits.

- [ ] **Step 3: Edit the service test fixture**

In `apps/web/src/services/__tests__/leave-types.service.test.ts`:

- Line 23: delete `maxDaysPerYear: 25,` from `mockLeaveType`.
- Line 93: delete `maxDaysPerYear: 25,` from the `createData` test fixture in the `create` test.

- [ ] **Step 4: Verify the web workspace builds**

```bash
pnpm --filter=@orchestra/web build 2>&1 | tail -20
```

Expected: clean. Any remaining TS error about `maxDaysPerYear` not existing on a type means a consumer wasn't migrated — fix it in place by removing the reference.

---

## Task 10: Drop `maxDaysPerYear` from frontend UI

**Files:**
- Modify: `apps/web/src/components/LeaveTypesManager.tsx` (5 sites)
- Modify: `apps/web/app/[locale]/leaves/page.tsx` (2 sites)

- [ ] **Step 1: `LeaveTypesManager.tsx` — initial state (line 35)**

Delete the line `maxDaysPerYear: undefined,` from the `useState` initializer for `formData`.

- [ ] **Step 2: `LeaveTypesManager.tsx` — reset function (line 65)**

Delete the line `maxDaysPerYear: undefined,` from the `resetForm` function.

- [ ] **Step 3: `LeaveTypesManager.tsx` — handleEdit update payload (line 103)**

Delete the line:

```typescript
      updateData.maxDaysPerYear = formData.maxDaysPerYear;
```

- [ ] **Step 4: `LeaveTypesManager.tsx` — edit form reset (line 171)**

Delete the line `maxDaysPerYear: type.maxDaysPerYear || undefined,`.

- [ ] **Step 5: `LeaveTypesManager.tsx` — table column (lines 322-326)**

Delete this entire `<td>...</td>` block:

```tsx
                <td className="px-4 py-3 text-sm text-gray-600">
                  {type.maxDaysPerYear
                    ? `${type.maxDaysPerYear} jours`
                    : t("unlimited")}
                </td>
```

Also find the `<th>` corresponding to this column in the table header and delete it. Search for `Limite/an` or the equivalent header in the file:

```bash
grep -n "Limite/an\|Limite annuelle" apps/web/src/components/LeaveTypesManager.tsx
```

Delete the `<th>` whose text is the "Limite/an" column header (likely earlier in the same table).

- [ ] **Step 6: `LeaveTypesManager.tsx` — create form field (lines 549-569)**

Delete this entire `<div>` block (the input for "Limite annuelle"):

```tsx
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite annuelle
                  </label>
                  <input
                    type="number"
                    value={formData.maxDaysPerYear || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxDaysPerYear: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t("unlimited")}
                    min={0}
                  />
                </div>
```

The parent `<div className="grid grid-cols-3 gap-4">` will then have one fewer column — verify the grid still looks balanced; if it becomes `grid-cols-2`, update the class accordingly.

- [ ] **Step 7: `LeaveTypesManager.tsx` — edit form field (lines 725-746)**

Same deletion as above but inside the edit-form section (around lines 725-746). Adjust the parent grid class if appropriate.

- [ ] **Step 8: `apps/web/app/[locale]/leaves/page.tsx` — option label cleanup (line 1299 + 1444)**

Delete the suffix from both `<option>` renderings. The current code:

```tsx
                      {type.icon} {type.name}
                      {type.maxDaysPerYear && ` (${type.maxDaysPerYear}j/an)`}
                      {!type.isPaid && " - Non rémunéré"}
```

Becomes:

```tsx
                      {type.icon} {type.name}
                      {!type.isPaid && " - Non rémunéré"}
```

- [ ] **Step 9: Verify all maxDaysPerYear references are gone from the frontend**

```bash
grep -rn "maxDaysPerYear" apps/web 2>/dev/null
```

Expected: zero hits.

- [ ] **Step 10: Verify the web workspace builds + tests pass**

```bash
pnpm --filter=@orchestra/web build 2>&1 | tail -15
pnpm --filter=@orchestra/web test 2>&1 | tail -15
```

Expected: both green.

- [ ] **Step 11: Commit Batch 3 (frontend cleanup)**

```bash
git add apps/web/
git commit -m "Drop maxDaysPerYear from frontend types, services, admin UI, and leaves page"
```

---

## Task 11: Add Playwright E2E for the new gating + self-approval

**Files:**
- Create: `e2e/tests/workflows/leave-balance-gating.spec.ts`

This task assumes the standard E2E fixtures exist (`asRole`, `playwright/.auth/`, etc.) — read `e2e/fixtures/` to confirm shape.

- [ ] **Step 1: Read the existing leave E2E to copy the request pattern**

```bash
cat e2e/tests/multi-role/leave-lifecycle.spec.ts | head -80
```

Note the API endpoints, the leave type lookup pattern, and the asRole/storageState idiom.

- [ ] **Step 2: Create the new spec file**

Create `e2e/tests/workflows/leave-balance-gating.spec.ts` with these scenarios (use the project's existing test fixture style; the snippet below is a structural template — adapt to the real fixture API):

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Leave balance gating', () => {
  test('@smoke type without configured balance allows arbitrary leave', async ({
    asRole,
  }) => {
    const page = await asRole('CONTRIBUTEUR');
    // 1) GET /api/leave-types → pick a type with code = 'OTHER' (no LeaveBalance configured)
    // 2) POST /api/leaves with that type, 5 days
    // 3) Expect 201 Created, status = PENDING
    const types = (await page.request.get('/api/leave-types')).json();
    const otherType = (await types).find((t: any) => t.code === 'OTHER');
    const res = await page.request.post('/api/leaves', {
      data: {
        leaveTypeId: otherType.id,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      },
    });
    expect(res.status()).toBe(201);
  });

  test('@smoke ADMIN auto-approves own leave (self_approve)', async ({
    asRole,
  }) => {
    const adminPage = await asRole('ADMIN');
    const types = await (await adminPage.request.get('/api/leave-types')).json();
    const cp = types.find((t: any) => t.code === 'CP');
    const res = await adminPage.request.post('/api/leaves', {
      data: {
        leaveTypeId: cp.id,
        startDate: '2026-10-12',
        endDate: '2026-10-14',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('APPROVED');
    expect(body.validatorId).toBeNull();
  });

  test('CONTRIBUTEUR own leave stays PENDING', async ({ asRole }) => {
    const page = await asRole('CONTRIBUTEUR');
    const types = await (await page.request.get('/api/leave-types')).json();
    const cp = types.find((t: any) => t.code === 'CP');
    const res = await page.request.post('/api/leaves', {
      data: {
        leaveTypeId: cp.id,
        startDate: '2026-11-09',
        endDate: '2026-11-13',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('PENDING');
  });
});
```

The third test asserts the negative case (no self_approve → PENDING). The first test guards against regression in the new gating.

A fourth test for "balance configured → request above limit returns 400" requires setting up `LeaveBalance` rows via API; defer that to the smoke run on the local dev DB after the migration is applied. If the existing fixture has a "seed with custom data" helper, add a fourth test that creates a LeaveBalance via the admin API and verifies the rejection.

- [ ] **Step 3: Verify locally**

If the dev environment is up:

```bash
pnpm --filter=e2e test -- leave-balance-gating 2>&1 | tail -25
```

Expected: green. If not, debug and fix the fixture usage. **Do not commit failing tests.**

If the dev environment is not up, document this as "not run locally" in the report and proceed.

- [ ] **Step 4: Commit Batch 4 (E2E)**

```bash
git add e2e/tests/workflows/leave-balance-gating.spec.ts
git commit -m "E2E: leave balance gating and ADMIN self-approval"
```

---

## Task 12: Spec + plan docs + final verification + push + deploy

- [ ] **Step 1: Commit the spec + plan docs**

```bash
git add docs/superpowers/specs/2026-05-23-uniform-leave-balance-design.md \
        docs/superpowers/plans/2026-05-23-uniform-leave-balance.md
git commit -m "Add spec and plan for uniform leave balance gating + self-approval"
```

- [ ] **Step 2: Run full monorepo build + tests**

```bash
pnpm run build 2>&1 | tail -10
pnpm run test 2>&1 | tail -15
```

Expected: both green.

- [ ] **Step 3: Sanity grep**

```bash
grep -rn "maxDaysPerYear" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.prisma" 2>/dev/null | grep -v "node_modules\|.next\|.turbo\|dist"
```

Expected: zero hits (the migration SQL file `DROP COLUMN "maxDaysPerYear"` is in `.sql`, not `.ts`, so the grep won't flag it).

- [ ] **Step 4: Push to origin/master**

```bash
git push origin master 2>&1 | tail -10
```

- [ ] **Step 5: Deploy on VPS (with explicit user confirmation)**

The migration is **destructive** (drops a column). Before SSH'ing into prod:

- Confirm with the user. State: "About to apply `prisma migrate deploy` on prod, which will DROP COLUMN `maxDaysPerYear` from `leave_type_configs`. Per the audit (2026-05-23), this column is NULL across all rows in prod. Proceed?"
- If the user confirms, proceed:

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'cd /opt/orchestra && git pull origin master && docker compose -f docker-compose.prod.yml --env-file .env.production build api web'
```

After build succeeds:

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'cd /opt/orchestra && docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api npx prisma migrate deploy 2>&1' | tail -15
```

Expected: `Applying migration drop_max_days_per_year` and `All migrations have been successfully applied.`

Then restart api + web with the new images:

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'cd /opt/orchestra && docker compose -f docker-compose.prod.yml --env-file .env.production up -d api web'
```

- [ ] **Step 6: Purge Redis `role-permissions:*` cache (post-deploy of new RBAC permission)**

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'docker exec orchestr-a-redis-prod redis-cli -a "$(grep ^REDIS_PASSWORD /opt/orchestra/.env.production | cut -d= -f2)" --no-auth-warning --scan --pattern "role-permissions:*" > /tmp/keys && wc -l /tmp/keys && if [ -s /tmp/keys ]; then cat /tmp/keys | xargs -r docker exec -i orchestr-a-redis-prod redis-cli -a "$(grep ^REDIS_PASSWORD /opt/orchestra/.env.production | cut -d= -f2)" --no-auth-warning del; fi'
```

Expected: count of keys purged (may be 0 if cache is cold).

- [ ] **Step 7: Production smoke**

From inside the API container (curl is not present; use node fetch):

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'docker exec orchestr-a-api-prod node -e "fetch(\"http://localhost:4000/api/health\").then(r => console.log(\"health:\", r.status))"'
```

Expected: `health: 200`.

Then verify the column is gone in DB:

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 'docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c "\\d leave_type_configs" | grep -i maxDays'
```

Expected: empty (column not listed in the table description).

---

## Self-review checks (controller)

- **Spec coverage:** Spec sections "What changes / Behavior matrix / Self-approval permission / Acceptance criteria 1-12" all map to tasks 1-12 above.
- **Type/name consistency:** `hasConfiguredBalance` and `getAvailableDays` are declared in Task 2 and used in Task 3. `LEAVES_SELF_APPROVE` and `leaves:self_approve` are consistent across tasks 6-8. The Prisma migration name `drop_max_days_per_year` appears in tasks 1 and 12.
- **No placeholders:** Every step has concrete code or a concrete command. The one TDD step (Task 8 self-approval test) deliberately leaves the `roleHasPermission` mock-shape open because it depends on the existing helper's implementation; the step gives the location to read and the rule to follow.
- **YAGNI:** No unused helpers, no speculative features. The new bundle `LEAVES_SELF_APPROVE` is justified by the spec's "alphabetical add fits in existing structure" requirement, alternative is a one-off in compose which is uglier.

## Acceptance criteria recap (verified by Task 12)

1-8: Same as the spec's Acceptance criteria 1-8 (uniform balance gating).
9-12: Same as the spec's Acceptance criteria 9-12 (self-approval permission).
