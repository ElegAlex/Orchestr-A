# Recurring PredefinedTask Extensions — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Scope:** Extend the existing PredefinedTask system with weekInterval, bulk rule creation (multi-user, multi-day)

## Context

The CPAM needs to schedule recurring "permanences" (Permanence accueil, Permanence telephonique, etc.) — named activity templates assigned to specific collaborators on specific recurring days.

The existing `PredefinedTask` system already handles:
- Task templates (name, color, icon, duration)
- Assignments (user + date + period)
- Recurring rules (dayOfWeek, startDate, endDate)
- Bulk assignment & generate-from-rules endpoints
- Display in the planning grid (DayCell)

Three gaps were identified:
1. No `weekInterval` on recurring rules (only weekly, no biweekly)
2. Rules are per-user — no multi-user creation in one operation
3. No multi-day rule creation in one shot (e.g. Monday AND Wednesday)

**Decision:** Extend the existing system (Approach A — atomic rules + bulk creation API) rather than creating a new module or composite rule model. The "multi" aspect is a UX convenience for creation, not a data model relationship. Once created, each rule lives independently.

## 1. Schema Change

One field added to `PredefinedTaskRecurringRule`:

```prisma
model PredefinedTaskRecurringRule {
  // ... existing fields ...
  weekInterval  Int      @default(1)  // 1=weekly, 2=biweekly, 3=every 3 weeks...
}
```

- No new models, no breaking changes
- Default `1` = all existing rules continue working as weekly
- Migration: `ALTER TABLE ADD COLUMN weekInterval INTEGER DEFAULT 1 NOT NULL`

## 2. Backend Changes

### 2a. New DTO: CreateBulkRecurringRulesDto

```typescript
{
  predefinedTaskId: string       // @IsUUID()
  userIds: string[]              // @IsArray(), @ArrayMinSize(1), @IsUUID(each)
  daysOfWeek: number[]           // @IsArray(), @ArrayMinSize(1), @IsInt(each), @Min(0), @Max(6)
  period: string                 // @IsIn(['MORNING','AFTERNOON','FULL_DAY'])
  weekInterval: number           // @IsInt(), @Min(1), @Max(52), @IsOptional(), default 1
  startDate: string              // @IsDateString()
  endDate?: string               // @IsDateString(), @IsOptional()
}
```

Creates `userIds.length x daysOfWeek.length` atomic rules in a single Prisma transaction.

### 2b. Update existing DTOs

- `CreateRecurringRuleDto`: add `weekInterval?: number` (optional, default 1)
- `UpdateRecurringRuleDto`: add `weekInterval?: number` (optional)

### 2c. New endpoint

```
POST /predefined-tasks/recurring-rules/bulk
Permission: predefined_tasks:assign
```

Returns: `{ created: number, rules: PredefinedTaskRecurringRule[] }`

### 2d. Generation algorithm update

Current logic iterates day-by-day and checks `dayOfWeek` match. New logic:

```
For each rule:
  anchor = first day matching rule.dayOfWeek on or after rule.startDate
  For each day in [rangeStart, rangeEnd]:
    if dayOfWeek matches AND day is within rule window:
      weeksDiff = floor((day - anchor) / 7)
      if weeksDiff % rule.weekInterval === 0:
        create assignment
```

The anchor is always relative to the rule's startDate, ensuring biweekly rules skip the correct weeks regardless of generation window.

### 2e. Permission verification

`predefined_tasks:assign` exists in seed (line 1593) and is granted to:
- **ADMIN**: all permissions
- **RESPONSABLE**: all permissions except users:manage_roles and settings:update
- **MANAGER**: explicitly listed (line 1715)

Missing: E2E permission matrix entry for `predefined_tasks:assign` — to be added during implementation.

## 3. Frontend Changes

### 3a. Enhanced RecurringRulesModal.tsx

The current modal creates 1 rule (1 user x 1 day). Extended to:

| Current field | New field |
|---|---|
| Collaborateur (single select) | Collaborateurs (multi-select with chips, filterable by service) |
| Jour de la semaine (single select) | Jours de la semaine (7 toggle-pill buttons, multi-select) |
| Duree (HALF_DAY / FULL_DAY) | Unchanged |
| Date de debut | Unchanged |
| Date de fin (optional) | Unchanged |
| — | **Frequence**: Chaque semaine / Toutes les 2 semaines / Toutes les 3 semaines / Toutes les 4 semaines |

Behavior:
- Multi-user: dropdown with checkboxes, filter by service
- Multi-day: 7 toggle buttons Lun-Dim (pill style, highlighted when selected)
- Frequency: select dropdown, values 1-4 (covers 99% of real cases; API accepts up to 52)
- Submit calls `POST /recurring-rules/bulk`
- Confirmation message: "12 regles creees (3 collaborateurs x 4 jours)"

### 3b. weekInterval display in rules list

Each rule in the list shows frequency:
- `weekInterval === 1`: "Chaque lundi" (no visual change)
- `weekInterval === 2`: "Un lundi sur deux"
- `weekInterval === 3`: "Un lundi sur trois"

### 3c. Service update

Add to `predefined-tasks.service.ts`:
- Type `PredefinedTaskRecurringRule`: add `weekInterval: number`
- New method `bulkCreateRecurringRules(data)` calling `POST /recurring-rules/bulk`

## 4. Files to modify

### Backend
- `packages/database/prisma/schema.prisma` — add weekInterval field
- `apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts` — add weekInterval
- `apps/api/src/predefined-tasks/dto/` — new `create-bulk-recurring-rules.dto.ts`
- `apps/api/src/predefined-tasks/predefined-tasks.controller.ts` — new bulk endpoint
- `apps/api/src/predefined-tasks/predefined-tasks.service.ts` — bulk creation + generation fix

### Frontend
- `apps/web/src/services/predefined-tasks.service.ts` — types + bulkCreateRecurringRules method
- `apps/web/src/components/predefined-tasks/RecurringRulesModal.tsx` — enhanced form

### Tests
- `e2e/fixtures/permission-matrix.ts` — add predefined_tasks:assign entry
- Backend specs for new endpoint + generation algorithm
- E2E tests for bulk rule creation flow

## 5. Out of scope

- Monthly/yearly recurrence patterns (weekly with interval covers the need)
- Auto-generation via cron job (manual generate endpoint is the existing pattern)
- Slot-based system (not the CPAM use case)
- PredefinedTask template CRUD changes (templates already work fine)
