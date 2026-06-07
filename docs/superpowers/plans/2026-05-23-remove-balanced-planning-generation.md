# Remove Balanced Planning Auto-Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Planning équilibré" automatic balanced planning generation feature — backend algorithm, endpoint, service method, frontend modal/hook/button, RBAC permission, tests, and i18n strings — while preserving predefined-tasks module, the three planning views (week/month/activity), and manual assignment.

**Architecture:** Pure feature deletion. The balancer is self-contained: no other code imports `PlanningBalancerService`, no other endpoint composes balancer output, no DB schema change (the `task_assignments` table is shared with manual assignments and stays untouched). The work is a series of surgical deletions in known files plus catalog-count adjustments in RBAC tests.

**Tech Stack:** NestJS 11 / Vitest backend, Next.js 16 / Jest frontend, Playwright e2e, RBAC compile-time templates in `packages/rbac`.

**Work directly on `master`** per project convention (no feature branch).

---

## File Structure

### Files to delete (10)

Backend:

- `apps/api/src/predefined-tasks/planning-balancer.service.ts`
- `apps/api/src/predefined-tasks/planning-balancer.service.spec.ts`
- `apps/api/src/predefined-tasks/planning-balancer.types.ts`
- `apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts`

Frontend:

- `apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx`
- `apps/web/src/components/predefined-tasks/__tests__/BalancedPlanningModal.test.tsx`
- `apps/web/src/hooks/usePlanningBalancer.ts`
- `apps/web/src/hooks/__tests__/usePlanningBalancer.test.ts`

E2E:

- `e2e/tests/workflows/balanced-planning.spec.ts`

### Files to edit (8)

Backend:

- `apps/api/src/predefined-tasks/predefined-tasks.controller.ts` — drop `generate-balanced` route + DTO import
- `apps/api/src/predefined-tasks/predefined-tasks.controller.spec.ts` — drop `generateBalanced` mock entry + describe block
- `apps/api/src/predefined-tasks/predefined-tasks.service.ts` — drop balancer imports, constructor injection, `generateBalanced()` method + section comment
- `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts` — drop balancer import, mock provider, mock object, and the entire `describe('generateBalanced', …)` block
- `apps/api/src/predefined-tasks/predefined-tasks.module.ts` — drop `PlanningBalancerService` import + provider

RBAC:

- `packages/rbac/atomic-permissions.ts` — drop the `predefined_tasks:balance` literal from union type, from `PREDEFINED_TASKS_ADMIN`, and from `CATALOG_PERMISSIONS`
- `packages/rbac/__tests__/templates.spec.ts` — adjust `EXPECTED_COUNTS` and the catalog-length assertion (117 → 116)

Frontend:

- `apps/web/src/services/predefined-tasks.service.ts` — drop balancer types + service method
- `apps/web/src/components/planning/PlanningView.tsx` — drop import, state, button, modal render
- `apps/web/messages/fr/predefinedTasks.json` — drop `balancer` block
- `apps/web/messages/en/predefinedTasks.json` — drop `balancer` block

Docs:

- `docs/adr/2026-04-24-03-balancer-algorithm.md` — flip Status to "Superseded — feature removed 2026-05-23"

---

## Task 1: Backend — remove balancer files (algorithm, types, DTO, unit spec)

**Files:**

- Delete: `apps/api/src/predefined-tasks/planning-balancer.service.ts`
- Delete: `apps/api/src/predefined-tasks/planning-balancer.service.spec.ts`
- Delete: `apps/api/src/predefined-tasks/planning-balancer.types.ts`
- Delete: `apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts`

After this task the codebase will not compile — that is expected; subsequent tasks remove the consumers.

- [ ] **Step 1: Confirm files exist**

```bash
ls apps/api/src/predefined-tasks/planning-balancer.service.ts \
   apps/api/src/predefined-tasks/planning-balancer.service.spec.ts \
   apps/api/src/predefined-tasks/planning-balancer.types.ts \
   apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts
```

Expected: all four paths listed, no errors.

- [ ] **Step 2: Delete the four files**

```bash
rm apps/api/src/predefined-tasks/planning-balancer.service.ts \
   apps/api/src/predefined-tasks/planning-balancer.service.spec.ts \
   apps/api/src/predefined-tasks/planning-balancer.types.ts \
   apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts
```

- [ ] **Step 3: Verify deletion**

```bash
ls apps/api/src/predefined-tasks/planning-balancer.service.ts 2>&1 | grep -q "No such" && echo OK
ls apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts 2>&1 | grep -q "No such" && echo OK
```

Expected: `OK` twice.

- [ ] **Step 4: Stage deletions (do not commit yet — commit at end of Task 4 once backend compiles again)**

```bash
git add -A apps/api/src/predefined-tasks/
git status -s
```

Expected: four `D` lines for the deleted files.

---

## Task 2: Backend — remove balancer wiring from PredefinedTasksModule

**Files:**

- Modify: `apps/api/src/predefined-tasks/predefined-tasks.module.ts`

- [ ] **Step 1: Edit the module file**

Use the Edit tool to replace the entire file content with the version below (the only changes are: drop the `PlanningBalancerService` import line and drop it from `providers`).

Target final state of `apps/api/src/predefined-tasks/predefined-tasks.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { PredefinedTasksService } from "./predefined-tasks.service";
import { PredefinedTasksController } from "./predefined-tasks.controller";
import { AuditModule } from "../audit/audit.module";
import { LeavesModule } from "../leaves/leaves.module";

@Module({
  imports: [AuditModule, LeavesModule],
  controllers: [PredefinedTasksController],
  providers: [PredefinedTasksService],
  exports: [PredefinedTasksService],
})
export class PredefinedTasksModule {}
```

- [ ] **Step 2: Verify no stray references remain in the file**

```bash
grep -n "Balancer\|balancer" apps/api/src/predefined-tasks/predefined-tasks.module.ts
```

Expected: no output (exit code 1).

---

## Task 3: Backend — remove `generateBalanced` from controller

**Files:**

- Modify: `apps/api/src/predefined-tasks/predefined-tasks.controller.ts` (drop import at line 32 and the route handler at lines 276-295)

- [ ] **Step 1: Remove the DTO import**

Use Edit to replace:

```typescript
import { GenerateBalancedDto } from "./dto/generate-balanced.dto";
```

with an empty string (delete the line). The surrounding imports are at lines 26-32 — the engineer can locate it via the unique `GenerateBalancedDto` token.

- [ ] **Step 2: Remove the route handler block (lines 276-295 inclusive)**

Use Edit to delete the entire block below (it ends at line 295, immediately before the final `}` closing the controller class). Match on the unique decorator `@Post('recurring-rules/generate-balanced')`.

Block to remove verbatim (including the blank line above `@Post` if present — but keep exactly one blank line between the previous handler's closing brace and the class closing brace):

```typescript
  @Post('recurring-rules/generate-balanced')
  @RequirePermissions('predefined_tasks:balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Générer des assignations équilibrées via PlanningBalancerService (preview ou apply)',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan d\'assignations équilibrées (preview) ou assignations créées (apply)',
  })
  @ApiResponse({ status: 400, description: 'Données invalides ou périmètre manquant' })
  @ApiResponse({ status: 403, description: 'Utilisateurs hors périmètre' })
  @ApiResponse({ status: 404, description: 'Tâches introuvables ou inactives' })
  generateBalanced(
    @Body() dto: GenerateBalancedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.predefinedTasksService.generateBalanced(dto, user);
  }
```

- [ ] **Step 3: Verify**

```bash
grep -n "generate-balanced\|generateBalanced\|GenerateBalancedDto\|predefined_tasks:balance" \
  apps/api/src/predefined-tasks/predefined-tasks.controller.ts
```

Expected: no output.

---

## Task 4: Backend — remove `generateBalanced` from controller spec

**Files:**

- Modify: `apps/api/src/predefined-tasks/predefined-tasks.controller.spec.ts`

- [ ] **Step 1: Remove the mock entry**

In the `mockPredefinedTasksService` literal (around line 81), remove the line:

```typescript
    generateBalanced: vi.fn(),
```

- [ ] **Step 2: Remove the describe block (lines 394-431 region)**

Remove the section starting with the comment header and ending at the closing `});` of the describe — the block is:

```typescript
// ===========================
// generateBalanced — smoke test (W3.2)
// ===========================

describe("generateBalanced", () => {
  it("smoke: POST retourne 200 avec le résultat du service", async () => {
    const mockUser = {
      id: "admin-1",
      role: {
        code: "ADMIN",
        templateKey: "ADMIN",
        id: "r-admin",
        label: "Admin",
        isSystem: true,
      },
    };
    const balancedResult = {
      mode: "preview",
      proposedAssignments: [],
      workloadByAgent: [],
      equityRatio: 1,
      unassignedOccurrences: [],
      assignmentsCreated: 0,
    };
    mockPredefinedTasksService.generateBalanced.mockResolvedValue(
      balancedResult,
    );

    const dto = {
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      userIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
      taskIds: ["11111111-1111-1111-1111-111111111111"],
      mode: "preview" as const,
    };

    const result = await controller.generateBalanced(
      dto as any,
      mockUser as any,
    );

    expect(mockPredefinedTasksService.generateBalanced).toHaveBeenCalledWith(
      dto,
      mockUser,
    );
    expect(result.mode).toBe("preview");
    expect(result.assignmentsCreated).toBe(0);
  });
});
```

The outer `});` on the final line (closing `describe('PredefinedTasksController', …)`) must remain. After removal, the last describe block in the file should be `generateFromRules` (whose closing `});` is at the line right before the previous block).

- [ ] **Step 3: Verify**

```bash
grep -n "generateBalanced\|balancer\|Balancer" \
  apps/api/src/predefined-tasks/predefined-tasks.controller.spec.ts
```

Expected: no output.

---

## Task 5: Backend — remove `generateBalanced` from service

**Files:**

- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.ts`

- [ ] **Step 1: Remove the balancer-related imports (lines 24-30 region)**

Delete these three import groups exactly (in the import section at the top of the file):

```typescript
import { PlanningBalancerService } from "./planning-balancer.service";
import type { BalancerOccurrence } from "./planning-balancer.types";
```

and

```typescript
import {
  GenerateBalancedDto,
  GenerateBalancedResult,
} from "./dto/generate-balanced.dto";
```

- [ ] **Step 2: Remove the constructor injection (line 38)**

In the constructor argument list, remove this exact line (keep all other constructor args intact, including trailing commas on neighbours):

```typescript
    private readonly planningBalancer: PlanningBalancerService,
```

The constructor's final shape after the edit should be:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPersistence: AuditPersistenceService,
    private readonly permissionsService: PermissionsService,
    private readonly leavesService: LeavesService,
  ) {}
```

- [ ] **Step 3: Remove the section header + method (lines 668-898)**

Remove the entire span: the section banner comment, the JSDoc for `generateBalanced`, and the method body. Match on the unique `// Génération équilibrée (W3.2)` banner to locate the start, and on the closing `}` immediately before the class's own closing `}` to locate the end.

The block to remove starts with:

```typescript
  // ===========================
  // Génération équilibrée (W3.2)
  // ===========================

  /**
   * Orchestre PlanningBalancerService pour générer des assignations équilibrées
```

and ends with the method's closing brace (line 898 in the current file):

```typescript
    return {
      mode: 'apply',
      ...output,
      assignmentsCreated: count,
    };
  }
```

After removal, the class closing `}` (line 899 in the current file) must remain — i.e. the file ends with the closing `}` of the previous method (`generateFromRules`, which ends with `return { ...results, rulesProcessed: rules.length };` then `}`) followed directly by the class closing `}`.

- [ ] **Step 4: Verify**

```bash
grep -n "Balancer\|balancer\|generateBalanced\|GenerateBalanced" \
  apps/api/src/predefined-tasks/predefined-tasks.service.ts
```

Expected: no output.

- [ ] **Step 5: Type-check the backend in isolation**

```bash
pnpm --filter=@orchestra/api typecheck 2>&1 | tail -20
```

(If the workspace exposes `typecheck`; otherwise: `pnpm --filter=@orchestra/api build 2>&1 | tail -20`.)

Expected: no errors mentioning balancer/Balancer/generate-balanced. Other unrelated errors should not appear; if they do, stop and report.

---

## Task 6: Backend — remove `generateBalanced` block from service spec

**Files:**

- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`

- [ ] **Step 1: Remove the balancer import (line 17)**

Delete this line:

```typescript
import { PlanningBalancerService } from "./planning-balancer.service";
```

- [ ] **Step 2: Remove the mock object definition (lines 58-60)**

Delete this exact block:

```typescript
const mockPlanningBalancerService = {
  balance: vi.fn(),
};
```

- [ ] **Step 3: Remove the provider entry (lines 159-162)**

In the `providers: [ … ]` array inside `beforeEach`, delete this exact block (including the comma at the end if present — keep the array well-formed):

```typescript
        {
          provide: PlanningBalancerService,
          useValue: mockPlanningBalancerService,
        },
```

The final providers array shape after the edit:

```typescript
      providers: [
        PredefinedTasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistenceService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: LeavesService,
          useValue: mockLeavesService,
        },
      ],
```

- [ ] **Step 4: Remove the `describe('generateBalanced', …)` block (lines 1209-1578)**

Delete the entire block starting from the banner comment and ending at the closing `});` of the describe — locate the start via the unique `// generateBalanced — W3.2` comment and the end via the `});` immediately preceding the outer-describe closing `});` (the very last `});` in the file must stay — it closes `describe('PredefinedTasksService', …)`).

Concretely, the block to remove is:

```
  // ===========================
  // generateBalanced — W3.2
  // ===========================

  describe('generateBalanced', () => {
    … 365 lines of tests …
  });
```

After removal, the previous describe (`CreateRecurringRuleDto — cross-field validator (@IsValidRecurrenceConfig)`) at line 1108 should be the last inner describe before the outer-describe closing `});`.

- [ ] **Step 5: Verify**

```bash
grep -n "Balancer\|balancer\|generateBalanced\|GenerateBalanced\|BALANCER_APPLIED" \
  apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts
```

Expected: no output.

- [ ] **Step 6: Run backend tests for the predefined-tasks module**

```bash
pnpm --filter=@orchestra/api test -- predefined-tasks 2>&1 | tail -30
```

Expected: green, no failures, no references to balancer in the run output.

- [ ] **Step 7: Commit backend changes**

```bash
git add apps/api/src/predefined-tasks/
git status -s apps/api/src/predefined-tasks/
git commit -m "Remove balanced planning generation: backend (algorithm, endpoint, service, tests)"
```

Expected: clean commit, no lint/hook failures.

---

## Task 7: RBAC — remove `predefined_tasks:balance` from atomic permissions

**Files:**

- Modify: `packages/rbac/atomic-permissions.ts`

Three edits in one file.

- [ ] **Step 1: Remove from the `PermissionCode` union type (around line 97)**

Delete this exact line from the union (keeping the leading `|` punctuation on the neighbours):

```typescript
  | "predefined_tasks:balance"
```

The `// predefined_tasks (8)` comment above the block should be updated to `// predefined_tasks (7)` — there will be 7 codes after removal (`assign`, `create`, `delete`, `edit`, `update-any-status`, `update-own-status`, `view`).

- [ ] **Step 2: Remove from `PREDEFINED_TASKS_ADMIN` (around line 484)**

In the `PREDEFINED_TASKS_ADMIN` array, delete this exact line:

```typescript
  "predefined_tasks:balance",
```

Also update the JSDoc above the constant to drop the phrase `+ génération équilibrée`. Concretely, change:

```typescript
/**
 * Administration des tâches prédéfinies + assignment aux agents + génération
 * équilibrée + mise à jour du statut de toute assignation (scope service via
 * @OwnershipCheck côté code).
 */
```

to:

```typescript
/**
 * Administration des tâches prédéfinies + assignment aux agents + mise à jour
 * du statut de toute assignation (scope service via @OwnershipCheck côté code).
 */
```

- [ ] **Step 3: Remove from `CATALOG_PERMISSIONS` (around line 688)**

In the `CATALOG_PERMISSIONS` sorted array, delete this exact line:

```typescript
  "predefined_tasks:balance",
```

- [ ] **Step 4: Verify the permission is gone**

```bash
grep -n "predefined_tasks:balance" packages/rbac/atomic-permissions.ts
```

Expected: no output.

```bash
pnpm --filter=@orchestra/rbac build 2>&1 | tail -10
```

(or `pnpm --filter=@orchestra/rbac typecheck` if that script exists)

Expected: no TypeScript errors.

---

## Task 8: RBAC — update expected catalog and template counts

**Files:**

- Modify: `packages/rbac/__tests__/templates.spec.ts`

The catalog drops from 117 to 116. Every template using `PREDEFINED_TASKS_ADMIN` drops by 1 permission. Use TDD: let the failing test tell you which templates need updating.

- [ ] **Step 1: Update the catalog comment and assertion**

In `packages/rbac/__tests__/templates.spec.ts`:

(a) Update the historical comment (around lines 22-30) by appending a new line at the end:

```typescript
// Mise à jour 2026-05-23 : suppression de predefined_tasks:balance (catalogue 117 → 116).
// Retirée de PREDEFINED_TASKS_ADMIN (-1 sur tous les templates utilisant ce bundle).
```

(b) Update the catalog length assertions (around lines 62-63):

Replace:

```typescript
  it("CATALOG_PERMISSIONS contient exactement 117 permissions", () => {
    expect(CATALOG_PERMISSIONS.length).toBe(117);
```

with:

```typescript
  it("CATALOG_PERMISSIONS contient exactement 116 permissions", () => {
    expect(CATALOG_PERMISSIONS.length).toBe(116);
```

- [ ] **Step 2: Run the test to discover which templates fail**

```bash
pnpm --filter=@orchestra/rbac test -- templates 2>&1 | tail -40
```

Expected: failures listing every template whose actual `tpl.permissions.length` is one below the value in `EXPECTED_COUNTS`. Note them.

- [ ] **Step 3: Update `EXPECTED_COUNTS` based on the failure output**

For each template flagged by the failing assertions, decrement its value in the `EXPECTED_COUNTS` map by 1.

ADMIN explicitly: change `ADMIN: 117,` to `ADMIN: 116,`.

For other templates, only decrement those that the test output reports as off-by-one. Do not guess — the failures are authoritative.

- [ ] **Step 4: Re-run the test**

```bash
pnpm --filter=@orchestra/rbac test -- templates 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 5: Run the full rbac package tests**

```bash
pnpm --filter=@orchestra/rbac test 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 6: Commit RBAC changes**

```bash
git add packages/rbac/
git status -s packages/rbac/
git commit -m "Remove RBAC permission predefined_tasks:balance from catalog and templates"
```

---

## Task 9: Frontend — remove balancer types and service method

**Files:**

- Modify: `apps/web/src/services/predefined-tasks.service.ts`

- [ ] **Step 1: Remove the type definitions block (lines 160-197)**

Delete the entire block delimited by the `// BALANCER TYPES` banner:

```typescript
// ===========================
// BALANCER TYPES
// ===========================

export interface GenerateBalancedDto {
  startDate: string;
  endDate: string;
  serviceId?: string;
  userIds?: string[];
  taskIds: string[];
  mode: "preview" | "apply";
}

export interface BalancerProposedAssignment {
  taskId: string;
  userId: string;
  date: string;
  period: AssignmentPeriod;
  weight: number;
}

export interface BalancerResult {
  mode: "preview" | "apply";
  proposedAssignments: BalancerProposedAssignment[];
  workloadByAgent: Array<{ userId: string; weightedLoad: number }>;
  equityRatio: number;
  unassignedOccurrences: Array<{
    taskId: string;
    date: string;
    period: AssignmentPeriod;
    reason:
      | "NO_ELIGIBLE_AGENT"
      | "ABSENCE_CONFLICT"
      | "TELEWORK_CONFLICT"
      | "SKILL_CONFLICT";
  }>;
  assignmentsCreated: number;
}
```

- [ ] **Step 2: Remove the service method (lines 385-391)**

Inside the exported `predefinedTasksService` object, delete this block (keep the trailing object closer `};`):

```typescript
  async generateBalanced(dto: GenerateBalancedDto): Promise<BalancerResult> {
    const res = await api.post<BalancerResult>(
      "/predefined-tasks/recurring-rules/generate-balanced",
      dto,
    );
    return res.data;
  },
```

- [ ] **Step 3: Verify**

```bash
grep -n "Balancer\|balancer\|generateBalanced\|GenerateBalanced" \
  apps/web/src/services/predefined-tasks.service.ts
```

Expected: no output.

---

## Task 10: Frontend — delete balancer modal, hook, and tests

**Files:**

- Delete: `apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx`
- Delete: `apps/web/src/components/predefined-tasks/__tests__/BalancedPlanningModal.test.tsx`
- Delete: `apps/web/src/hooks/usePlanningBalancer.ts`
- Delete: `apps/web/src/hooks/__tests__/usePlanningBalancer.test.ts`

- [ ] **Step 1: Delete the four files**

```bash
rm apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx \
   apps/web/src/components/predefined-tasks/__tests__/BalancedPlanningModal.test.tsx \
   apps/web/src/hooks/usePlanningBalancer.ts \
   apps/web/src/hooks/__tests__/usePlanningBalancer.test.ts
```

- [ ] **Step 2: Verify**

```bash
ls apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx 2>&1 | grep -q "No such" && echo OK1
ls apps/web/src/hooks/usePlanningBalancer.ts 2>&1 | grep -q "No such" && echo OK2
```

Expected: `OK1` and `OK2`.

---

## Task 11: Frontend — remove balancer integration from PlanningView

**Files:**

- Modify: `apps/web/src/components/planning/PlanningView.tsx`

- [ ] **Step 1: Remove the import (line 11)**

Delete this exact line:

```typescript
import { BalancedPlanningModal } from "@/components/predefined-tasks/BalancedPlanningModal";
```

- [ ] **Step 2: Remove the state declaration (line 67)**

Delete this exact line:

```typescript
const [showBalancer, setShowBalancer] = useState(false);
```

- [ ] **Step 3: Remove the "Planning équilibré" button block (lines 323-344)**

Delete this exact block (the comment line plus the `{hasPermission(...) && ( … )}` wrapper):

```tsx
{
  /* Bouton Planning équilibré — gated sur predefined_tasks:balance */
}
{
  hasPermission("predefined_tasks:balance") && (
    <button
      onClick={() => setShowBalancer(true)}
      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm flex items-center gap-1.5"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
      {tPredefined("balancer.openButton")}
    </button>
  );
}
```

- [ ] **Step 4: Remove the modal render (lines 794-801)**

Delete this exact block:

```tsx
<BalancedPlanningModal
  open={showBalancer}
  onClose={() => setShowBalancer(false)}
  onApplied={() => {
    refetch();
    setRefreshTrigger((prev) => prev + 1);
  }}
/>
```

- [ ] **Step 5: Check the `tPredefined` import is still needed**

```bash
grep -n "tPredefined" apps/web/src/components/planning/PlanningView.tsx
```

If the only remaining hit is the import / declaration line and nothing else uses it, also remove its declaration:

```typescript
const tPredefined = useTranslations("predefinedTasks");
```

Otherwise leave it alone.

- [ ] **Step 6: Verify the file is balancer-free**

```bash
grep -n "Balancer\|balancer\|showBalancer\|BalancedPlanning\|predefined_tasks:balance" \
  apps/web/src/components/planning/PlanningView.tsx
```

Expected: no output.

---

## Task 12: Frontend — remove balancer i18n strings

**Files:**

- Modify: `apps/web/messages/fr/predefinedTasks.json`
- Modify: `apps/web/messages/en/predefinedTasks.json`

- [ ] **Step 1: Open the French file and remove the `balancer` block (lines 14-60)**

Delete the entire `"balancer": { … },` block. The block to delete in `apps/web/messages/fr/predefinedTasks.json`:

```json
  "balancer": {
    "openButton": "Générer un planning équilibré",
    "title": "Planning équilibré automatique",
    "description": "Répartit les occurrences de tâches récurrentes entre les agents sur la plage choisie.",
    "config": {
      "range": "Plage",
      "startDate": "Date de début",
      "endDate": "Date de fin",
      "service": "Service",
      "users": "Agents",
      "tasks": "Tâches à équilibrer",
      "preview": "Prévisualiser",
      "apply": "Appliquer",
      "validation": {
        "noAgent": "Sélectionnez au moins un agent ou un service",
        "noTask": "Sélectionnez au moins une tâche",
        "datesInvalid": "Plage de dates invalide"
      }
    },
    "preview": {
      "empty": "Cliquez sur Prévisualiser pour voir la proposition d'équilibrage",
      "loading": "Calcul en cours...",
      "equityRatio": "Ratio d'équité",
      "workloadByAgent": "Charge par agent",
      "agent": "Agent",
      "load": "Charge pondérée",
      "count": "Nombre d'occurrences",
      "proposedAssignments": "Assignations proposées",
      "unassignedOccurrences": "Occurrences non assignées",
      "reasons": {
        "NO_ELIGIBLE_AGENT": "Aucun agent éligible",
        "ABSENCE_CONFLICT": "Aucun agent éligible : congés ou absences",
        "TELEWORK_CONFLICT": "Aucun agent éligible : télétravail incompatible avec une tâche présentielle",
        "SKILL_CONFLICT": "Aucun agent éligible : compétences manquantes"
      },
      "warningLowEquity": "Équilibre faible — envisagez d'ajuster la configuration"
    },
    "toast": {
      "applied": "{count} assignation(s) créée(s)",
      "appliedIdempotent": "Aucune nouvelle assignation (plage déjà couverte)",
      "forbidden": "Permission refusée",
      "error": "Erreur lors de la génération"
    },
    "footer": {
      "escHint": "Échap pour fermer"
    }
  },
```

Also clean up the `weight.hint` line (line 4) which mentions the auto-balancer. Change:

```json
    "hint": "Pondération utilisée par l'équilibrage automatique (1 = très légère, 5 = très lourde)",
```

to:

```json
    "hint": "Pondération de la charge (1 = très légère, 5 = très lourde)",
```

Be careful with trailing commas: after removing `"balancer": {…},`, the previous key (`"weight": {…}`) must still have its terminating comma if there are more keys after, or no trailing comma if it becomes the last key. Use the JSON file as-is and adjust commas to keep it valid.

- [ ] **Step 2: Repeat for `apps/web/messages/en/predefinedTasks.json`**

Delete the equivalent `"balancer": { … }` block from the English file. Also adjust the English `weight.hint` similarly (rephrase to drop the "automatic balancer" reference).

The engineer should open the file and produce the English equivalent: `"hint": "Weight of the workload (1 = very light, 5 = very heavy)"` (or follow the existing English-file wording for consistency).

- [ ] **Step 3: Validate JSON syntax**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/fr/predefinedTasks.json','utf8')); console.log('fr OK')"
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en/predefinedTasks.json','utf8')); console.log('en OK')"
```

Expected: `fr OK` and `en OK`. No `SyntaxError`.

- [ ] **Step 4: Verify no `balancer` key left**

```bash
grep -n "balancer\|équilibr\|equilib" \
  apps/web/messages/fr/predefinedTasks.json apps/web/messages/en/predefinedTasks.json
```

Expected: no output (the `weight.hint` line has been rephrased to drop the term too).

---

## Task 13: Frontend — verify build and tests, then commit

- [ ] **Step 1: Run the full web typecheck/build**

```bash
pnpm --filter=@orchestra/web build 2>&1 | tail -25
```

Expected: build success, no TypeScript errors.

- [ ] **Step 2: Run the full web unit tests**

```bash
pnpm --filter=@orchestra/web test 2>&1 | tail -25
```

Expected: all green. There should be no orphaned test referring to balancer.

- [ ] **Step 3: Verify no frontend reference to balancer remains**

```bash
grep -rn "Balancer\|balancer\|generateBalanced\|BalancedPlanning\|usePlanningBalancer\|predefined_tasks:balance" \
  apps/web/src apps/web/messages 2>/dev/null
```

Expected: no output.

- [ ] **Step 4: Commit frontend changes**

```bash
git add apps/web/
git status -s apps/web/
git commit -m "Remove balanced planning generation: frontend (modal, hook, button, i18n)"
```

---

## Task 14: E2E — remove balanced-planning workflow spec

**Files:**

- Delete: `e2e/tests/workflows/balanced-planning.spec.ts`

- [ ] **Step 1: Verify the file exists**

```bash
ls e2e/tests/workflows/balanced-planning.spec.ts
```

Expected: path listed.

- [ ] **Step 2: Delete the file**

```bash
rm e2e/tests/workflows/balanced-planning.spec.ts
```

- [ ] **Step 3: Verify no e2e file still references the feature**

```bash
grep -rn "generate-balanced\|BalancedPlanning\|balancer" e2e/ 2>/dev/null
```

Expected: no output.

---

## Task 15: ADR — flip status to Superseded

**Files:**

- Modify: `docs/adr/2026-04-24-03-balancer-algorithm.md`

- [ ] **Step 1: Update the status header**

Replace this line in the ADR:

```markdown
**Statut :** Accepté
```

with:

```markdown
**Statut :** Superseded — feature removed 2026-05-23 (no real-world usage value, complexity removed from the activity view)
```

Leave the rest of the ADR intact — ADRs are historical artifacts and the design rationale is preserved for future reference.

- [ ] **Step 2: Verify**

```bash
head -10 docs/adr/2026-04-24-03-balancer-algorithm.md
```

Expected: status line shows `Superseded`.

---

## Task 16: Final verification across the monorepo

- [ ] **Step 1: Full repo grep — should be zero hits in source code**

```bash
grep -rn "generate-balanced\|generateBalanced\|GenerateBalancedDto\|GenerateBalancedResult\|PlanningBalancer\|BalancedPlanningModal\|usePlanningBalancer\|BalancerResult\|BalancerProposedAssignment\|BalancerOccurrence\|predefined_tasks:balance\|BALANCER_APPLIED" \
  apps/ packages/ e2e/ 2>/dev/null
```

Expected: empty output. (The ADR may still mention the term in prose — that's fine; ADRs document history. Same for `docs/superpowers/mockups/`. The grep is intentionally scoped to source roots.)

- [ ] **Step 2: Full monorepo build**

```bash
pnpm run build 2>&1 | tail -30
```

Expected: success.

- [ ] **Step 3: Full monorepo unit tests**

```bash
pnpm run test 2>&1 | tail -30
```

Expected: success across all workspaces (API + Web + rbac).

- [ ] **Step 4: Manual smoke (record output, do not block on it)**

If `docker ps` shows postgres and redis up, restart the API + Web dev servers and verify:

- `/planning` loads, the three view tabs (week / month / activity) work
- No "Planning équilibré" button anywhere
- POST to `/predefined-tasks/recurring-rules/generate-balanced` returns 404

Curl check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:3001/predefined-tasks/recurring-rules/generate-balanced \
  -H 'Content-Type: application/json' \
  -d '{"startDate":"2026-04-01","endDate":"2026-04-30","userIds":["x"],"taskIds":["y"],"mode":"preview"}'
```

Expected: `404` (or `401` if no auth header — either is fine; `200` would be a failure).

If the dev environment is not up, skip this step and note "not verified locally".

- [ ] **Step 5: Commit e2e + ADR changes**

```bash
git add e2e/ docs/adr/2026-04-24-03-balancer-algorithm.md
git status -s
git commit -m "Remove balanced planning generation: e2e spec and ADR superseded marker"
```

- [ ] **Step 6: Push to origin/master and deploy to VPS**

Per project convention (memory: "After commit, push to origin/master and deploy to VPS").

```bash
git push origin master
```

Then on the VPS (the deploy path may be project-specific — confirm with the user before SSH'ing into prod; do NOT rely on the `.github/workflows/deploy.yml` which is known to be cosmetic):

Ask the user to confirm before deploying. If confirmed, follow the project's documented VPS deploy procedure (rebuild containers with `--env-file .env.production`). After deploy, purge Redis `role-permissions:*` cache so that the permission removal takes effect:

```bash
ssh <vps> "docker exec orchestra-redis redis-cli --scan --pattern 'role-permissions:*' | xargs -r docker exec -i orchestra-redis redis-cli del"
```

Expected: a count of keys deleted (or 0 if cache was empty).

---

## Self-review notes (engineer)

- **Type consistency:** `BalancerResult`, `BalancerProposedAssignment`, `BalancerUnassignedReason`, `BalancerMode`, `GenerateBalancedDto`, `GenerateBalancedResult`, `PlanningBalancerService`, `BalancerOccurrence`, `usePlanningBalancer`, `BalancedPlanningModal`, `generateBalanced`, `planningBalancer`, `predefined_tasks:balance` — all of these names appear exactly once each in their declaration site and at most a handful of times at use sites. The plan addresses every use site located by Task 0's reconnaissance grep.
- **Catalog count assertion**: Task 8 uses TDD (run failing test, get authoritative list of templates needing decrement) rather than hard-coding a guess. This avoids cascading mistakes if a future template was added in a way the spec author missed.
- **i18n weight.hint**: editing this line is a minor scope expansion — the line is preserved but rephrased to drop the now-misleading "automatic balancer" reference. Alternative: leave the hint untouched. The plan rephrases it because the wording is now factually wrong post-removal.
- **No DB migration needed**: `task_assignments` table is shared with manual assignments and stays. No Prisma schema change. No rollback complexity.
- **ADR preserved**: kept as Superseded per convention. Not deleted.
- **Mockup HTML left in place**: not referenced by any code, documented as historical in the spec.

## Acceptance criteria (recap, verified at Task 16)

1. `pnpm run build` passes.
2. `pnpm run test` passes (all workspaces).
3. Repo grep for the 12+ balancer-related symbols returns zero hits in `apps/`, `packages/`, `e2e/`.
4. Planning page shows three views (week / month / activity) without the "Planning équilibré" button.
5. `POST /predefined-tasks/recurring-rules/generate-balanced` returns 404.
6. No role retains `predefined_tasks:balance`; Redis `role-permissions:*` purged post-deploy.
7. ADR-03 status reads "Superseded".
