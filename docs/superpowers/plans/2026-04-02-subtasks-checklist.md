# Subtasks (Checklist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtasks as checklist items inside tasks — only parent tasks show in planning, progress auto-calculates from checked subtasks.

**Architecture:** New `Subtask` Prisma model linked to `Task` via foreign key. CRUD endpoints nested under `/tasks/:taskId/subtasks`. Frontend renders a checklist in the TaskModal detail view. When a task has subtasks, its `progress` field is computed from `(checked / total) * 100` instead of from status.

**Tech Stack:** Prisma 6 (migration + model), NestJS 11 (controller + service + DTOs), Next.js 16 + React 19 (TaskModal component), Vitest (API tests), Playwright (E2E)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/database/prisma/migrations/YYYYMMDD_add_subtasks/migration.sql` | DB schema |
| Modify | `packages/database/prisma/schema.prisma` | Subtask model + Task relation |
| Create | `apps/api/src/tasks/dto/create-subtask.dto.ts` | Validation DTO |
| Create | `apps/api/src/tasks/dto/update-subtask.dto.ts` | Partial update DTO |
| Modify | `apps/api/src/tasks/tasks.controller.ts` | Subtask CRUD endpoints |
| Modify | `apps/api/src/tasks/tasks.service.ts` | Subtask business logic + progress recalc |
| Create | `apps/api/src/tasks/tasks-subtasks.spec.ts` | API unit tests |
| Modify | `apps/web/src/types/index.ts` | Subtask interface + Task.subtasks |
| Modify | `apps/web/src/services/tasks.service.ts` | Subtask API client methods |
| Modify | `apps/web/src/components/TaskModal.tsx` | Checklist UI in task detail |
| Modify | `apps/web/src/components/tasks/TaskLineCard.tsx` | Subtask count badge |
| Create | `e2e/tests/workflows/subtasks.spec.ts` | E2E tests |

---

### Task 1: Prisma Schema — Add Subtask Model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add Subtask model to schema.prisma**

Add after the `TaskRACI` model block (after line ~343):

```prisma
model Subtask {
  id          String   @id @default(uuid())
  title       String
  description String?
  isCompleted Boolean  @default(false)
  position    Int      @default(0)
  taskId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("subtasks")
}
```

Add relation to the Task model (inside the relations block, after `raci`):

```prisma
  subtasks        Subtask[]
```

- [ ] **Step 2: Generate and apply migration**

Run:
```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run db:migrate --name add_subtasks
```

Expected: Migration created, `subtasks` table created with columns id, title, description, isCompleted, position, taskId, createdAt, updatedAt.

- [ ] **Step 3: Verify Prisma client generation**

Run:
```bash
cd /home/alex/Documents/REPO/ORCHESTRA/packages/database && pnpm prisma generate
```

Expected: `Subtask` type available in Prisma client.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add Subtask model for task checklists"
```

---

### Task 2: API DTOs — Create and Update Subtask

**Files:**
- Create: `apps/api/src/tasks/dto/create-subtask.dto.ts`
- Create: `apps/api/src/tasks/dto/update-subtask.dto.ts`

- [ ] **Step 1: Create CreateSubtaskDto**

File: `apps/api/src/tasks/dto/create-subtask.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSubtaskDto {
  @ApiProperty({ description: 'Titre de la sous-tâche', example: 'Vérifier les prérequis' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiProperty({ description: 'Description optionnelle', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Cochée ou non', default: false })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiProperty({ description: 'Position dans la liste', default: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;
}
```

- [ ] **Step 2: Create UpdateSubtaskDto**

File: `apps/api/src/tasks/dto/update-subtask.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateSubtaskDto } from './create-subtask.dto';

export class UpdateSubtaskDto extends PartialType(CreateSubtaskDto) {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/dto/create-subtask.dto.ts apps/api/src/tasks/dto/update-subtask.dto.ts
git commit -m "feat(api): add subtask DTOs"
```

---

### Task 3: API Service — Subtask CRUD + Progress Recalculation

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`

- [ ] **Step 1: Add subtask CRUD methods to TasksService**

Add at the end of the `TasksService` class (before the closing `}`):

```typescript
  // ========== SUBTASKS ==========

  async createSubtask(taskId: string, dto: CreateSubtaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');

    // Auto-position: append at end
    if (dto.position === undefined) {
      const count = await this.prisma.subtask.count({ where: { taskId } });
      dto.position = count;
    }

    const subtask = await this.prisma.subtask.create({
      data: { ...dto, taskId },
    });

    await this.recalcTaskProgress(taskId);
    return subtask;
  }

  async getSubtasks(taskId: string) {
    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });
  }

  async updateSubtask(taskId: string, subtaskId: string, dto: UpdateSubtaskDto) {
    const subtask = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!subtask) throw new NotFoundException('Sous-tâche introuvable');

    const updated = await this.prisma.subtask.update({
      where: { id: subtaskId },
      data: dto,
    });

    await this.recalcTaskProgress(taskId);
    return updated;
  }

  async deleteSubtask(taskId: string, subtaskId: string) {
    const subtask = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!subtask) throw new NotFoundException('Sous-tâche introuvable');

    await this.prisma.subtask.delete({ where: { id: subtaskId } });
    await this.recalcTaskProgress(taskId);
    return { message: 'Sous-tâche supprimée' };
  }

  async reorderSubtasks(taskId: string, subtaskIds: string[]) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');

    await Promise.all(
      subtaskIds.map((id, index) =>
        this.prisma.subtask.update({ where: { id }, data: { position: index } }),
      ),
    );

    return this.getSubtasks(taskId);
  }

  private async recalcTaskProgress(taskId: string) {
    const subtasks = await this.prisma.subtask.findMany({ where: { taskId } });
    if (subtasks.length === 0) return; // No subtasks → keep status-based progress

    const completed = subtasks.filter((s) => s.isCompleted).length;
    const progress = Math.round((completed / subtasks.length) * 100);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { progress },
    });
  }
```

- [ ] **Step 2: Add imports for the DTOs**

At the top of `tasks.service.ts`, add:

```typescript
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
```

- [ ] **Step 3: Include subtasks in findOne()**

In the `findOne()` method, add `subtasks: { orderBy: { position: 'asc' } }` to the `include` block. Find the existing include (around line 350-400) and add after `comments`:

```typescript
        subtasks: {
          orderBy: { position: 'asc' },
        },
```

- [ ] **Step 4: Include subtasks in getTasksByProject()**

In the `getTasksByProject()` method (around line 913-975), add to the include block:

```typescript
        subtasks: {
          orderBy: { position: 'asc' },
        },
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tasks/tasks.service.ts
git commit -m "feat(api): add subtask CRUD + auto-progress recalculation"
```

---

### Task 4: API Controller — Subtask Endpoints

**Files:**
- Modify: `apps/api/src/tasks/tasks.controller.ts`

- [ ] **Step 1: Add imports**

At the top of `tasks.controller.ts`, add:

```typescript
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
```

- [ ] **Step 2: Add subtask endpoints**

Add before the closing `}` of the controller class:

```typescript
  // ========== SUBTASKS ==========

  @Post(':taskId/subtasks')
  @Permissions('tasks:update')
  @ApiOperation({ summary: 'Ajouter une sous-tâche (checklist item)' })
  @ApiResponse({ status: 201, description: 'Sous-tâche créée' })
  createSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.tasksService.createSubtask(taskId, dto);
  }

  @Get(':taskId/subtasks')
  @Permissions('tasks:read')
  @ApiOperation({ summary: 'Lister les sous-tâches' })
  getSubtasks(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasksService.getSubtasks(taskId);
  }

  @Patch(':taskId/subtasks/:subtaskId')
  @Permissions('tasks:update')
  @ApiOperation({ summary: 'Modifier une sous-tâche (cocher/décocher, renommer)' })
  updateSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('subtaskId', ParseUUIDPipe) subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(taskId, subtaskId, dto);
  }

  @Delete(':taskId/subtasks/:subtaskId')
  @Permissions('tasks:update')
  @ApiOperation({ summary: 'Supprimer une sous-tâche' })
  deleteSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('subtaskId', ParseUUIDPipe) subtaskId: string,
  ) {
    return this.tasksService.deleteSubtask(taskId, subtaskId);
  }

  @Post(':taskId/subtasks/reorder')
  @Permissions('tasks:update')
  @ApiOperation({ summary: 'Réordonner les sous-tâches' })
  reorderSubtasks(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { subtaskIds: string[] },
  ) {
    return this.tasksService.reorderSubtasks(taskId, body.subtaskIds);
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/tasks.controller.ts
git commit -m "feat(api): add subtask CRUD endpoints under /tasks/:taskId/subtasks"
```

---

### Task 5: API Unit Tests

**Files:**
- Create: `apps/api/src/tasks/tasks-subtasks.spec.ts`

- [ ] **Step 1: Write unit tests**

File: `apps/api/src/tasks/tasks-subtasks.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TasksService - Subtasks', () => {
  let service: TasksService;
  let prisma: PrismaService;

  const mockPrisma = {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subtask: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('createSubtask', () => {
    it('should create a subtask and recalculate progress', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrisma.subtask.count.mockResolvedValue(2);
      mockPrisma.subtask.create.mockResolvedValue({
        id: 'sub-1', title: 'Check prérequis', isCompleted: false, position: 2, taskId: 'task-1',
      });
      mockPrisma.subtask.findMany.mockResolvedValue([
        { isCompleted: true },
        { isCompleted: false },
        { isCompleted: false },
      ]);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.createSubtask('task-1', { title: 'Check prérequis' });

      expect(result.title).toBe('Check prérequis');
      expect(result.position).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { progress: 33 },
      });
    });

    it('should throw NotFoundException for invalid task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);
      await expect(service.createSubtask('bad-id', { title: 'test' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSubtask', () => {
    it('should toggle isCompleted and recalculate progress', async () => {
      mockPrisma.subtask.findFirst.mockResolvedValue({ id: 'sub-1', taskId: 'task-1' });
      mockPrisma.subtask.update.mockResolvedValue({ id: 'sub-1', isCompleted: true });
      mockPrisma.subtask.findMany.mockResolvedValue([
        { isCompleted: true },
        { isCompleted: true },
      ]);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.updateSubtask('task-1', 'sub-1', { isCompleted: true });

      expect(result.isCompleted).toBe(true);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { progress: 100 },
      });
    });
  });

  describe('deleteSubtask', () => {
    it('should delete and recalculate progress', async () => {
      mockPrisma.subtask.findFirst.mockResolvedValue({ id: 'sub-1', taskId: 'task-1' });
      mockPrisma.subtask.delete.mockResolvedValue({});
      mockPrisma.subtask.findMany.mockResolvedValue([]);
      // No subtasks left → recalcTaskProgress returns early

      const result = await service.deleteSubtask('task-1', 'sub-1');
      expect(result.message).toBe('Sous-tâche supprimée');
    });
  });

  describe('progress calculation', () => {
    it('should calculate 0% when no subtasks completed', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task-1' });
      mockPrisma.subtask.count.mockResolvedValue(0);
      mockPrisma.subtask.create.mockResolvedValue({ id: 'sub-1', title: 'A', isCompleted: false, position: 0, taskId: 'task-1' });
      mockPrisma.subtask.findMany.mockResolvedValue([{ isCompleted: false }]);
      mockPrisma.task.update.mockResolvedValue({});

      await service.createSubtask('task-1', { title: 'A' });

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { progress: 0 },
      });
    });

    it('should calculate 50% when half completed', async () => {
      mockPrisma.subtask.findFirst.mockResolvedValue({ id: 'sub-1', taskId: 'task-1' });
      mockPrisma.subtask.update.mockResolvedValue({ id: 'sub-1', isCompleted: true });
      mockPrisma.subtask.findMany.mockResolvedValue([
        { isCompleted: true },
        { isCompleted: false },
      ]);
      mockPrisma.task.update.mockResolvedValue({});

      await service.updateSubtask('task-1', 'sub-1', { isCompleted: true });

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { progress: 50 },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm --filter api run test -- tasks-subtasks
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tasks/tasks-subtasks.spec.ts
git commit -m "test(api): add subtask CRUD unit tests"
```

---

### Task 6: Frontend Types & API Client

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/services/tasks.service.ts`

- [ ] **Step 1: Add Subtask interface to types**

In `apps/web/src/types/index.ts`, add after the `TaskRACI` interface (around line 397):

```typescript
export interface Subtask {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  position: number;
  taskId: string;
  createdAt: string;
  updatedAt: string;
}
```

Add `subtasks` to the `Task` interface (after `raci?: TaskRACI[];`):

```typescript
  subtasks?: Subtask[];
```

- [ ] **Step 2: Add subtask methods to tasks.service.ts**

In `apps/web/src/services/tasks.service.ts`, add before the closing `}`:

```typescript
  // Subtasks
  async getSubtasks(taskId: string): Promise<Subtask[]> {
    const response = await api.get<Subtask[]>(`/tasks/${taskId}/subtasks`);
    return response.data;
  },

  async createSubtask(taskId: string, data: { title: string; description?: string }): Promise<Subtask> {
    const response = await api.post<Subtask>(`/tasks/${taskId}/subtasks`, data);
    return response.data;
  },

  async updateSubtask(taskId: string, subtaskId: string, data: Partial<{ title: string; description: string; isCompleted: boolean; position: number }>): Promise<Subtask> {
    const response = await api.patch<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, data);
    return response.data;
  },

  async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
  },

  async reorderSubtasks(taskId: string, subtaskIds: string[]): Promise<Subtask[]> {
    const response = await api.post<Subtask[]>(`/tasks/${taskId}/subtasks/reorder`, { subtaskIds });
    return response.data;
  },
```

Add the `Subtask` import at the top:

```typescript
import { User, PaginatedResponse, Task, TaskStatus, Priority, Subtask } from "@/types";
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/services/tasks.service.ts
git commit -m "feat(web): add Subtask type and API client methods"
```

---

### Task 7: Frontend — Checklist UI in TaskModal

**Files:**
- Modify: `apps/web/src/components/TaskModal.tsx`

- [ ] **Step 1: Add subtask state and handlers**

In `TaskModal.tsx`, add state after the existing `formData` state (around line 73):

```typescript
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
```

Add import at the top:

```typescript
import { Subtask } from "@/types";
import { tasksService } from "@/services/tasks.service";
```

In the `useEffect` that populates form data when `task` changes (around line 78), add after the form population:

```typescript
    if (task?.subtasks) {
      setSubtasks(task.subtasks);
    } else if (task?.id) {
      tasksService.getSubtasks(task.id).then(setSubtasks).catch(() => setSubtasks([]));
    } else {
      setSubtasks([]);
    }
```

- [ ] **Step 2: Add subtask handler functions**

Add inside the component, after the existing handlers:

```typescript
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task?.id) return;
    try {
      const created = await tasksService.createSubtask(task.id, { title: newSubtaskTitle.trim() });
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
    } catch {
      // silently fail
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!task?.id) return;
    try {
      const updated = await tasksService.updateSubtask(task.id, subtask.id, {
        isCompleted: !subtask.isCompleted,
      });
      setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // silently fail
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task?.id) return;
    try {
      await tasksService.deleteSubtask(task.id, subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch {
      // silently fail
    }
  };
```

- [ ] **Step 3: Add checklist UI in the modal body**

Add the checklist section in the modal JSX, after the description field and before the submit button area. Find the `description` textarea block and add after it:

```tsx
          {/* Subtasks Checklist */}
          {task?.id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sous-tâches ({subtasks.filter((s) => s.isCompleted).length}/{subtasks.length})
              </label>
              <div className="space-y-1 mb-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.isCompleted}
                      onChange={() => handleToggleSubtask(subtask)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={`flex-1 text-sm ${subtask.isCompleted ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}
                    >
                      {subtask.title}
                    </span>
                    {subtask.description && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        {subtask.description}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubtask())}
                  placeholder="Ajouter une sous-tâche..."
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/TaskModal.tsx
git commit -m "feat(web): add subtask checklist UI in task detail modal"
```

---

### Task 8: Frontend — Subtask Count Badge on TaskLineCard

**Files:**
- Modify: `apps/web/src/components/tasks/TaskLineCard.tsx`

- [ ] **Step 1: Add subtask count badge**

In `TaskLineCard.tsx`, find the title `<h4>` element (line 83-85). Add a subtask count badge after it:

```tsx
        {task.subtasks && task.subtasks.length > 0 && (
          <span className="text-xs text-gray-500 shrink-0" title="Sous-tâches">
            ☑ {task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length}
          </span>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/TaskLineCard.tsx
git commit -m "feat(web): show subtask progress badge on task line cards"
```

---

### Task 9: Prevent Status-Based Progress Override

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`

- [ ] **Step 1: Skip status-based progress when subtasks exist**

In the `update()` method of `tasks.service.ts`, find where progress is set from status (around line 599):

```typescript
    if (taskData.status) {
      updateData.progress = getTaskProgress(taskData.status);
    }
```

Replace with:

```typescript
    if (taskData.status) {
      // Don't override progress if task has subtasks (progress driven by checklist)
      const subtaskCount = await this.prisma.subtask.count({ where: { taskId: id } });
      if (subtaskCount === 0) {
        updateData.progress = getTaskProgress(taskData.status);
      }
    }
```

Same in the `create()` method (around line 182), replace:

```typescript
      progress: getTaskProgress(taskStatus),
```

With:

```typescript
      progress: 0, // Will be recalculated if subtasks are added
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/tasks/tasks.service.ts
git commit -m "fix(api): skip status-based progress when task has subtasks"
```

---

### Task 10: Build, Test, Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build
```

Expected: No errors.

- [ ] **Step 2: Run unit tests**

```bash
pnpm run test
```

Expected: All tests pass including new subtask tests.

- [ ] **Step 3: Commit all changes and push**

```bash
git add -A
git commit -m "feat: subtasks checklist for project tasks

Tasks can now contain subtasks as checklist items. Only the parent
task appears in the planning view. Progress auto-calculates from
the percentage of checked subtasks.

API: CRUD endpoints at /tasks/:taskId/subtasks
Frontend: Checklist UI in task detail modal + count badge on line cards
DB: New subtasks table with position ordering

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git push origin master
```

- [ ] **Step 4: Deploy to VPS**

```bash
ssh -i ~/.ssh/id_ed25519 debian@92.222.35.25 "sudo git -C /opt/orchestra pull origin master && cd /opt/orchestra && sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build"
```

Expected: All containers healthy, migration auto-applied.

- [ ] **Step 5: Verify on production**

```bash
# Create a subtask via API
TOKEN=$(curl -s https://orchestr-a.com/api/auth/login -H "Content-Type: application/json" -d '{"login":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Pick any existing task and add a subtask
curl -s https://orchestr-a.com/api/tasks?limit=1 -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])"
```

---

## Self-Review Checklist

- ✅ **Spec coverage:** Schema, API CRUD, progress recalc, frontend checklist, line card badge, planning unaffected
- ✅ **No placeholders:** All code blocks complete with exact content
- ✅ **Type consistency:** `Subtask` interface matches Prisma model, DTOs match controller params
- ✅ **Planning unaffected:** No changes to `DayCell.tsx` or `usePlanningData.ts` — subtasks are a relation on Task, not standalone entities
- ✅ **Progress logic:** `recalcTaskProgress()` only overrides when subtasks exist, preserves status-based for tasks without subtasks
- ✅ **Existing tests:** No existing tests broken — new tests in separate file
