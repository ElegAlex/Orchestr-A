# Recurring PredefinedTask Extensions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the PredefinedTask recurring rules system with `weekInterval` (biweekly+), bulk rule creation (multi-user x multi-day), and enhanced frontend UX.

**Architecture:** Add one column to `PredefinedTaskRecurringRule`, one new DTO + endpoint for bulk creation, update the generation algorithm with anchor+modulo logic, and enhance the `RecurringRulesModal` with multi-select UI. All changes extend existing patterns — no new modules.

**Tech Stack:** Prisma 6 (migration), NestJS 11 (controller/service/DTO), Vitest (backend tests), React 19 + Tailwind 4 (frontend modal), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-30-recurring-predefined-tasks-design.md`

---

## Task 1: Prisma Schema Migration — Add `weekInterval`

**Files:**
- Modify: `packages/database/prisma/schema.prisma:793-813`

- [ ] **Step 1: Add `weekInterval` field to PredefinedTaskRecurringRule model**

In `packages/database/prisma/schema.prisma`, find the `PredefinedTaskRecurringRule` model (line ~799) and add the field after `period`:

```prisma
  period           String    // "MORNING" | "AFTERNOON" | "FULL_DAY"
  weekInterval     Int       @default(1)  // 1=weekly, 2=biweekly, 3=every 3 weeks...
  startDate        DateTime
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run db:migrate --name add-week-interval-to-recurring-rules
```

Expected: Migration created successfully. The SQL should contain:
```sql
ALTER TABLE "predefined_task_recurring_rules" ADD COLUMN "weekInterval" INTEGER NOT NULL DEFAULT 1;
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec prisma generate --schema=packages/database/prisma/schema.prisma
```

Expected: `Generated Prisma Client` success message.

- [ ] **Step 4: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/ && git commit -m "feat(schema): add weekInterval to PredefinedTaskRecurringRule"
```

---

## Task 2: Backend — Update Existing DTOs with `weekInterval`

**Files:**
- Modify: `apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts`

- [ ] **Step 1: Write the failing test for weekInterval in createRecurringRule**

In `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`, add this test inside the existing `describe` block (after the existing tests, around line ~260):

```typescript
  describe('createRecurringRule with weekInterval', () => {
    it('devrait créer une règle récurrente avec weekInterval', async () => {
      const ruleWithInterval = { ...mockRecurringRule, weekInterval: 2 };
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(ruleWithInterval);

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
        weekInterval: 2,
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(mockPrismaService.predefinedTaskRecurringRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekInterval: 2,
          }),
        }),
      );
      expect(result.weekInterval).toBe(2);
    });

    it('devrait utiliser weekInterval=1 par défaut', async () => {
      const ruleDefault = { ...mockRecurringRule, weekInterval: 1 };
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(ruleDefault);

      const dto = {
        predefinedTaskId: 'task-1',
        userId: 'user-1',
        dayOfWeek: 0,
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
        // no weekInterval — should default to 1
      };

      const result = await service.createRecurringRule('admin-1', dto);

      expect(result.weekInterval).toBe(1);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `weekInterval` not passed to Prisma create call.

- [ ] **Step 3: Add `weekInterval` to `CreateRecurringRuleDto`**

In `apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts`, add after the `endDate` field (line ~66):

```typescript
  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo, etc.)',
    example: 1,
    minimum: 1,
    maximum: 52,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weekInterval?: number;
```

- [ ] **Step 4: Add `weekInterval` to `UpdateRecurringRuleDto`**

In the same file, add after the `isActive` field (line ~108):

```typescript
  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo, etc.)',
    minimum: 1,
    maximum: 52,
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weekInterval?: number;
```

- [ ] **Step 5: Update `createRecurringRule` in service to pass `weekInterval`**

In `apps/api/src/predefined-tasks/predefined-tasks.service.ts`, update the `createRecurringRule` method (line ~300). Change the `data` block to include `weekInterval`:

```typescript
      data: {
        predefinedTaskId: dto.predefinedTaskId,
        userId: dto.userId,
        dayOfWeek: dto.dayOfWeek,
        period: dto.period,
        weekInterval: dto.weekInterval ?? 1,
        startDate: new Date(dto.startDate),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        createdById,
        isActive: true,
      },
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts apps/api/src/predefined-tasks/predefined-tasks.service.ts apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts && git commit -m "feat(predefined-tasks): add weekInterval to CreateRecurringRuleDto and UpdateRecurringRuleDto"
```

---

## Task 3: Backend — Update Generation Algorithm with weekInterval

**Files:**
- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.ts:367-433`
- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`

- [ ] **Step 1: Write the failing test for weekInterval-aware generation**

In `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`, add:

```typescript
  describe('generateFromRules with weekInterval', () => {
    it('devrait respecter weekInterval=2 (bihebdo) et ne generer que les semaines paires', async () => {
      // Rule: every 2 weeks on Monday, starting 2026-01-05 (a Monday)
      const biweeklyRule = {
        ...mockRecurringRule,
        id: 'rule-biweekly',
        dayOfWeek: 0, // Monday
        weekInterval: 2,
        startDate: new Date('2026-01-05'), // Monday
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([biweeklyRule]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(mockAssignment);

      // Generate for 4 weeks: Jan 5 - Jan 31
      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-05T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      });

      // 4 Mondays in range: Jan 5, 12, 19, 26
      // With weekInterval=2, anchor=Jan 5: Jan 5 (week 0, 0%2=0 YES), Jan 12 (week 1, 1%2=1 NO), Jan 19 (week 2, 2%2=0 YES), Jan 26 (week 3, 3%2=1 NO)
      expect(result.created).toBe(2);
      expect(mockPrismaService.predefinedTaskAssignment.create).toHaveBeenCalledTimes(2);
    });

    it('devrait generer chaque semaine quand weekInterval=1 (defaut)', async () => {
      const weeklyRule = {
        ...mockRecurringRule,
        id: 'rule-weekly',
        dayOfWeek: 0, // Monday
        weekInterval: 1,
        startDate: new Date('2026-01-05'),
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([weeklyRule]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(mockAssignment);

      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-05T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      });

      // 4 Mondays in range, all generated
      expect(result.created).toBe(4);
    });

    it('devrait calculer le weekInterval relativement au startDate de la regle, pas au debut de la plage', async () => {
      // Rule starts Jan 5 (Monday), weekInterval=2
      // Generate range starts Jan 19 (2 weeks later)
      const rule = {
        ...mockRecurringRule,
        dayOfWeek: 0,
        weekInterval: 2,
        startDate: new Date('2026-01-05'),
        endDate: null,
      };
      mockPrismaService.predefinedTaskRecurringRule.findMany.mockResolvedValue([rule]);
      mockPrismaService.predefinedTaskAssignment.create.mockResolvedValue(mockAssignment);

      const result = await service.generateFromRules('admin-1', {
        startDate: '2026-01-19T00:00:00Z', // 2 weeks after rule start
        endDate: '2026-02-15T00:00:00Z',
      });

      // Mondays in range: Jan 19, 26, Feb 2, 9
      // Weeks since anchor (Jan 5): 2, 3, 4, 5
      // 2%2=0 YES, 3%2=1 NO, 4%2=0 YES, 5%2=1 NO
      expect(result.created).toBe(2);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -30
```

Expected: FAIL — current algorithm creates 4 assignments (ignores weekInterval).

- [ ] **Step 3: Update `generateFromRules` to respect weekInterval**

In `apps/api/src/predefined-tasks/predefined-tasks.service.ts`, replace the `generateFromRules` method (lines 367-433) with:

```typescript
  async generateFromRules(assignedById: string, dto: GenerateFromRulesDto) {
    const rangeStart = new Date(dto.startDate);
    const rangeEnd = new Date(dto.endDate);

    // Find all active recurring rules that overlap with the date range
    const rules = await this.prisma.predefinedTaskRecurringRule.findMany({
      where: {
        isActive: true,
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
    });

    const results = { created: 0, skipped: 0 };

    for (const rule of rules) {
      // Compute anchor: first day matching rule.dayOfWeek on or after rule.startDate
      const anchor = new Date(rule.startDate);
      const anchorJsDay = anchor.getDay();
      const anchorOurDay = anchorJsDay === 0 ? 6 : anchorJsDay - 1;
      const daysUntilTarget = (rule.dayOfWeek - anchorOurDay + 7) % 7;
      anchor.setDate(anchor.getDate() + daysUntilTarget);

      const weekInterval = rule.weekInterval ?? 1;

      // Iterate over each day in the range
      const current = new Date(rangeStart);
      while (current <= rangeEnd) {
        const jsDayOfWeek = current.getDay();
        const ourDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;

        if (ourDayOfWeek === rule.dayOfWeek) {
          // Check date is within rule's active window
          const ruleStart = new Date(rule.startDate);
          const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;

          if (current >= ruleStart && (!ruleEnd || current <= ruleEnd)) {
            // Check weekInterval: weeks since anchor, modulo weekInterval
            const diffMs = current.getTime() - anchor.getTime();
            const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

            if (diffWeeks % weekInterval === 0) {
              try {
                await this.prisma.predefinedTaskAssignment.create({
                  data: {
                    predefinedTaskId: rule.predefinedTaskId,
                    userId: rule.userId,
                    date: new Date(current),
                    period: rule.period,
                    assignedById,
                    isRecurring: true,
                    recurringRuleId: rule.id,
                  },
                });
                results.created++;
              } catch (error: unknown) {
                if (
                  typeof error === 'object' &&
                  error !== null &&
                  'code' in error &&
                  (error as { code: string }).code === 'P2002'
                ) {
                  results.skipped++;
                } else {
                  throw error;
                }
              }
            }
          }
        }

        current.setDate(current.getDate() + 1);
      }
    }

    return { ...results, rulesProcessed: rules.length };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -30
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add apps/api/src/predefined-tasks/predefined-tasks.service.ts apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts && git commit -m "feat(predefined-tasks): update generateFromRules to respect weekInterval with anchor+modulo"
```

---

## Task 4: Backend — Bulk Recurring Rules Endpoint

**Files:**
- Create: `apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts`
- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- Modify: `apps/api/src/predefined-tasks/predefined-tasks.controller.ts`
- Modify: `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`

- [ ] **Step 1: Write the failing test for bulkCreateRecurringRules**

In `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts`, add:

```typescript
  describe('bulkCreateRecurringRules', () => {
    it('devrait creer N users x M jours regles atomiques', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      // Mock $transaction to execute the callback
      (mockPrismaService as any).$transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(mockRecurringRule);

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1', 'user-2'],
        daysOfWeek: [0, 2], // Monday, Wednesday
        period: 'FULL_DAY',
        weekInterval: 2,
        startDate: '2026-01-06T00:00:00Z',
      };

      const result = await service.bulkCreateRecurringRules('admin-1', dto);

      // 2 users x 2 days = 4 rules
      expect(result.created).toBe(4);
      expect(mockPrismaService.predefinedTaskRecurringRule.create).toHaveBeenCalledTimes(4);
    });

    it('devrait lever NotFoundException si la tache est inactive', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue({
        ...mockTask,
        isActive: false,
      });

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1'],
        daysOfWeek: [0],
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
      };

      await expect(service.bulkCreateRecurringRules('admin-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('devrait utiliser weekInterval=1 par defaut', async () => {
      mockPrismaService.predefinedTask.findUnique.mockResolvedValue(mockTask);
      (mockPrismaService as any).$transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.predefinedTaskRecurringRule.create.mockResolvedValue(mockRecurringRule);

      const dto = {
        predefinedTaskId: 'task-1',
        userIds: ['user-1'],
        daysOfWeek: [0],
        period: 'FULL_DAY',
        startDate: '2026-01-06T00:00:00Z',
        // no weekInterval
      };

      await service.bulkCreateRecurringRules('admin-1', dto);

      expect(mockPrismaService.predefinedTaskRecurringRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            weekInterval: 1,
          }),
        }),
      );
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `service.bulkCreateRecurringRules is not a function`.

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
  IsIn,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateBulkRecurringRulesDto {
  @ApiProperty({
    description: 'ID de la tache predéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: 'IDs des utilisateurs',
    example: ['uuid-user-1', 'uuid-user-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Jours de la semaine (0=Lundi, ..., 6=Dimanche)',
    example: [0, 2],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @ApiProperty({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period: string;

  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo)',
    example: 1,
    minimum: 1,
    maximum: 52,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weekInterval?: number;

  @ApiProperty({
    description: 'Date de début (ISO)',
    example: '2026-01-06T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Date de fin (ISO)',
    example: '2026-12-31T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
```

- [ ] **Step 4: Add `bulkCreateRecurringRules` method to service**

In `apps/api/src/predefined-tasks/predefined-tasks.service.ts`, add this import at the top (line 1):

```typescript
import { CreateBulkRecurringRulesDto } from './dto/create-bulk-recurring-rules.dto';
```

Then add this method after `createRecurringRule` (after line ~323):

```typescript
  async bulkCreateRecurringRules(
    createdById: string,
    dto: CreateBulkRecurringRulesDto,
  ) {
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tache predéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }

    const weekInterval = dto.weekInterval ?? 1;
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
            include: {
              predefinedTask: {
                select: { id: true, name: true, color: true, icon: true },
              },
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
              createdBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });
          created.push(rule);
        }
      }
      return created;
    });

    return { created: rules.length, rules };
  }
```

- [ ] **Step 5: Add the bulk endpoint to controller**

In `apps/api/src/predefined-tasks/predefined-tasks.controller.ts`, add the import (line ~30 area):

```typescript
import { CreateBulkRecurringRulesDto } from './dto/create-bulk-recurring-rules.dto';
```

Then add this endpoint after the `createRecurringRule` method (after line ~208):

```typescript
  @Post('recurring-rules/bulk')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({ summary: 'Créer des règles récurrentes en masse (multi-utilisateurs x multi-jours)' })
  @ApiResponse({ status: 201, description: 'Règles récurrentes créées' })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  bulkCreateRecurringRules(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBulkRecurringRulesDto,
  ) {
    return this.predefinedTasksService.bulkCreateRecurringRules(userId, dto);
  }
```

**IMPORTANT:** This endpoint MUST be placed BEFORE the `@Patch('recurring-rules/:id')` route in the controller, otherwise NestJS will interpret `bulk` as a UUID parameter for `:id`. Place it right after `@Post('recurring-rules')`.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts --reporter=verbose 2>&1 | tail -30
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts apps/api/src/predefined-tasks/predefined-tasks.service.ts apps/api/src/predefined-tasks/predefined-tasks.controller.ts apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts && git commit -m "feat(predefined-tasks): add POST /recurring-rules/bulk endpoint for multi-user multi-day rule creation"
```

---

## Task 5: Frontend — Update Service Types and Add Bulk Method

**Files:**
- Modify: `apps/web/src/services/predefined-tasks.service.ts`

- [ ] **Step 1: Add `weekInterval` to `PredefinedTaskRecurringRule` interface**

In `apps/web/src/services/predefined-tasks.service.ts`, update the `PredefinedTaskRecurringRule` interface (line ~48-67). Add `weekInterval` after `duration`:

```typescript
export interface PredefinedTaskRecurringRule {
  id: string;
  predefinedTaskId: string;
  userId: string;
  dayOfWeek: DayOfWeek;
  duration: TaskDuration;
  weekInterval: number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  predefinedTask?: PredefinedTask;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}
```

- [ ] **Step 2: Add `weekInterval` to `CreateRecurringRuleDto`**

Update the interface (line ~106-113):

```typescript
export interface CreateRecurringRuleDto {
  predefinedTaskId: string;
  userId: string;
  dayOfWeek: DayOfWeek;
  duration: TaskDuration;
  weekInterval?: number;
  startDate: string;
  endDate?: string;
}
```

- [ ] **Step 3: Add `BulkCreateRecurringRulesDto` interface and method**

After `GenerateAssignmentsDto` (line ~126), add:

```typescript
export interface BulkCreateRecurringRulesDto {
  predefinedTaskId: string;
  userIds: string[];
  daysOfWeek: DayOfWeek[];
  duration: TaskDuration;
  weekInterval?: number;
  startDate: string;
  endDate?: string;
}

export interface BulkCreateRecurringRulesResponse {
  created: number;
  rules: PredefinedTaskRecurringRule[];
}
```

Then add the method to the `predefinedTasksService` object, after `createRecurringRule` (line ~262):

```typescript
  async bulkCreateRecurringRules(
    data: BulkCreateRecurringRulesDto,
  ): Promise<BulkCreateRecurringRulesResponse> {
    const response = await api.post<BulkCreateRecurringRulesResponse>(
      "/predefined-tasks/recurring-rules/bulk",
      data,
    );
    return response.data;
  },
```

- [ ] **Step 4: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add apps/web/src/services/predefined-tasks.service.ts && git commit -m "feat(web): add weekInterval to recurring rule types and bulk creation method"
```

---

## Task 6: Frontend — Enhanced RecurringRulesModal

**Files:**
- Modify: `apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx`

- [ ] **Step 1: Update imports and add new types/constants**

In `apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx`, update the imports (lines 1-15):

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskRecurringRule,
  DayOfWeek,
  TaskDuration,
} from "@/services/predefined-tasks.service";
import { usersService } from "@/services/users.service";
import { User } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";
```

Add a new constant after `DURATION_LABELS` (line ~30):

```typescript
const WEEK_INTERVAL_LABELS: Record<number, string> = {
  1: "Chaque semaine",
  2: "Toutes les 2 semaines",
  3: "Toutes les 3 semaines",
  4: "Toutes les 4 semaines",
};

const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; short: string }[] = [
  { value: "MONDAY", short: "Lun" },
  { value: "TUESDAY", short: "Mar" },
  { value: "WEDNESDAY", short: "Mer" },
  { value: "THURSDAY", short: "Jeu" },
  { value: "FRIDAY", short: "Ven" },
  { value: "SATURDAY", short: "Sam" },
  { value: "SUNDAY", short: "Dim" },
];
```

- [ ] **Step 2: Update form state type and initial state**

Replace `RuleFormData` interface and the initial state (lines 39-63):

```typescript
interface RuleFormData {
  userIds: string[];
  daysOfWeek: DayOfWeek[];
  duration: TaskDuration;
  weekInterval: number;
  startDate: string;
  endDate: string;
}
```

Update the initial `formData` in the component (line ~57):

```typescript
  const [formData, setFormData] = useState<RuleFormData>({
    userIds: [],
    daysOfWeek: [],
    duration: task.defaultDuration,
    weekInterval: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });
```

- [ ] **Step 3: Update `handleCreate` to call bulk endpoint**

Replace the `handleCreate` function (lines 85-113):

```typescript
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.userIds.length === 0) {
      toast.error("Selectionnez au moins un collaborateur");
      return;
    }
    if (formData.daysOfWeek.length === 0) {
      toast.error("Selectionnez au moins un jour");
      return;
    }
    setSaving(true);
    try {
      const result = await predefinedTasksService.bulkCreateRecurringRules({
        predefinedTaskId: task.id,
        userIds: formData.userIds,
        daysOfWeek: formData.daysOfWeek,
        duration: formData.duration,
        weekInterval: formData.weekInterval,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      });
      const nUsers = formData.userIds.length;
      const nDays = formData.daysOfWeek.length;
      toast.success(
        `${result.created} regle${result.created > 1 ? "s" : ""} creee${result.created > 1 ? "s" : ""} (${nUsers} collaborateur${nUsers > 1 ? "s" : ""} x ${nDays} jour${nDays > 1 ? "s" : ""})`,
      );
      setShowForm(false);
      setFormData({
        userIds: [],
        daysOfWeek: [],
        duration: task.defaultDuration,
        weekInterval: 1,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
      });
      await onRulesChanged();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la creation",
      );
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 4: Update the rule list display to show weekInterval**

Update the rule display text (line ~202-207). Replace the `<p className="text-xs text-gray-500">` block:

```typescript
                      <p className="text-xs text-gray-500">
                        {rule.weekInterval && rule.weekInterval > 1
                          ? `Un ${DAY_OF_WEEK_LABELS[rule.dayOfWeek].toLowerCase()} sur ${rule.weekInterval}`
                          : `Chaque ${DAY_OF_WEEK_LABELS[rule.dayOfWeek].toLowerCase()}`}
                        {" "}&bull; {DURATION_LABELS[rule.duration]}
                        {rule.startDate &&
                          ` \u2022 A partir du ${new Date(rule.startDate).toLocaleDateString("fr-FR")}`}
                        {rule.endDate &&
                          ` \u2022 Jusqu'au ${new Date(rule.endDate).toLocaleDateString("fr-FR")}`}
                      </p>
```

- [ ] **Step 5: Replace the form with multi-select UI**

Replace the entire form content (lines 241-360) — from `<form` to `</form>` — with:

```tsx
          <form
            onSubmit={handleCreate}
            className="border border-gray-200 rounded-lg p-4 space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-sm">
              Nouvelles regles recurrentes
            </h3>

            {/* Multi-user select */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Collaborateurs *
              </label>
              <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.userIds.includes(u.id)}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          userIds: e.target.checked
                            ? [...prev.userIds, u.id]
                            : prev.userIds.filter((id) => id !== u.id),
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">
                      {u.firstName} {u.lastName}
                    </span>
                  </label>
                ))}
              </div>
              {formData.userIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {formData.userIds.length} selectionne{formData.userIds.length > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Multi-day toggle pills */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Jours de la semaine *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OF_WEEK_OPTIONS.map(({ value, short }) => {
                  const selected = formData.daysOfWeek.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          daysOfWeek: selected
                            ? prev.daysOfWeek.filter((d) => d !== value)
                            : [...prev.daysOfWeek, value],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Week interval */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Frequence *
                </label>
                <select
                  value={formData.weekInterval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weekInterval: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(WEEK_INTERVAL_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Duree *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: e.target.value as TaskDuration,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FULL_DAY">Journee entiere</option>
                  <option value="HALF_DAY">Demi-journee</option>
                </select>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date de debut *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date de fin (optionnel)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Summary */}
            {formData.userIds.length > 0 && formData.daysOfWeek.length > 0 && (
              <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                {formData.userIds.length} collaborateur{formData.userIds.length > 1 ? "s" : ""}
                {" x "}
                {formData.daysOfWeek.length} jour{formData.daysOfWeek.length > 1 ? "s" : ""}
                {" = "}
                <strong>{formData.userIds.length * formData.daysOfWeek.length} regles</strong>
                {formData.weekInterval > 1 && ` (toutes les ${formData.weekInterval} semaines)`}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || formData.userIds.length === 0 || formData.daysOfWeek.length === 0}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Creation..." : "Creer les regles"}
              </button>
            </div>
          </form>
```

- [ ] **Step 6: Verify build**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx && git commit -m "feat(web): enhanced RecurringRulesModal with multi-user, multi-day, weekInterval"
```

---

## Task 7: E2E Permission Matrix — Add Missing Entry

**Files:**
- Modify: `e2e/fixtures/permission-matrix.ts`

- [ ] **Step 1: Add `predefined_tasks:assign` entry to the permission matrix**

In `e2e/fixtures/permission-matrix.ts`, add after the `predefined_tasks:create` entry (line ~399, before the closing `];`):

```typescript
  {
    action: "predefined_tasks:assign",
    resource: "predefined-tasks",
    method: "POST",
    apiEndpoint: "/api/predefined-tasks/recurring-rules/bulk",
    allowedRoles: ["admin", "responsable", "manager"],
    deniedRoles: ["referent", "contributeur", "observateur"],
    testBody: {
      predefinedTaskId: "{{predefinedTaskId}}",
      userIds: ["{{userId}}"],
      daysOfWeek: [0],
      period: "FULL_DAY",
      weekInterval: 1,
      startDate: "2026-04-01T00:00:00Z",
    },
    description:
      "Creer des regles recurrentes en masse — Admin, Responsable, Manager",
  },
```

- [ ] **Step 2: Commit**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && git add e2e/fixtures/permission-matrix.ts && git commit -m "test(e2e): add predefined_tasks:assign entry to permission matrix"
```

---

## Task 8: Full Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all predefined-tasks tests**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm exec vitest run apps/api/src/predefined-tasks/ --reporter=verbose 2>&1 | tail -30
```

Expected: All tests PASS.

- [ ] **Step 3: Run lint**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run lint 2>&1 | tail -10
```

Expected: No new lint errors.

- [ ] **Step 4: Final commit if any fixes needed**

Only if Steps 1-3 revealed issues that needed fixing.
