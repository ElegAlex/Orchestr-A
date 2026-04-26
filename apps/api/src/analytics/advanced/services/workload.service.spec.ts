import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkloadService } from './workload.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

// ---------------------------------------------------------------------------
// Helpers — mirror the exact Prisma select shape used in WorkloadService
// ---------------------------------------------------------------------------

type MockTask = { id: string; status: string };
type MockTaskAssignment = { task: MockTask };

interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  tasks: MockTask[];
  taskAssignments: MockTaskAssignment[];
}

function makeUser(
  partial: Partial<MockUser> & Pick<MockUser, 'id' | 'firstName' | 'lastName'>,
): MockUser {
  return {
    tasks: [],
    taskAssignments: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WorkloadService', () => {
  let service: WorkloadService;
  let mockPrisma: { user: { findMany: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    mockPrisma = {
      user: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkloadService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<WorkloadService>(WorkloadService);
  });

  // 1. User with tasks via assigneeId only (Task.assigneeId = user.id → user.tasks)
  it('counts tasks assigned via assigneeId (primary assignee)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u1',
        firstName: 'Alice',
        lastName: 'Martin',
        tasks: [
          { id: 't1', status: 'TODO' },
          { id: 't2', status: 'IN_PROGRESS' },
        ],
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
    expect(result[0].name).toBe('Alice Martin');
    expect(result[0].total).toBe(2);
    expect(result[0].counts.TODO).toBe(1);
    expect(result[0].counts.IN_PROGRESS).toBe(1);
    expect(result[0].counts.IN_REVIEW).toBe(0);
    expect(result[0].counts.BLOCKED).toBe(0);
  });

  // 2. User with tasks via TaskAssignee only (co-assignee, no primary)
  it('counts tasks assigned via TaskAssignee (co-assignee)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u2',
        firstName: 'Bob',
        lastName: 'Dupont',
        tasks: [],
        taskAssignments: [
          { task: { id: 't3', status: 'IN_REVIEW' } },
          { task: { id: 't4', status: 'BLOCKED' } },
        ],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u2');
    expect(result[0].total).toBe(2);
    expect(result[0].counts.IN_REVIEW).toBe(1);
    expect(result[0].counts.BLOCKED).toBe(1);
    expect(result[0].counts.TODO).toBe(0);
    expect(result[0].counts.IN_PROGRESS).toBe(0);
  });

  // 3. DISTINCT dedup — same task appears in both relations → counted once
  it('counts a doubly-assigned task (assigneeId + TaskAssignee) exactly once', async () => {
    const SHARED_TASK_ID = 'task-shared';
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u3',
        firstName: 'Carol',
        lastName: 'Leblanc',
        // Task appears as primary assignee
        tasks: [{ id: SHARED_TASK_ID, status: 'TODO' }],
        // Same task appears again as co-assignee
        taskAssignments: [{ task: { id: SHARED_TASK_ID, status: 'TODO' } }],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(1); // counted once, not twice
    expect(result[0].counts.TODO).toBe(1);
  });

  // 4. DONE tasks are excluded — service filters them at DB level (mock simulates that)
  //    and does not count them even if accidentally present
  it('excludes DONE tasks from counts', async () => {
    // The DB filter (status: { in: ACTIVE_STATUSES }) would exclude DONE at query time.
    // Here we verify the service logic: if a DONE task leaked through, it is not counted.
    // In production, Prisma where clause prevents this; we test the mock-simulated path.
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u4',
        firstName: 'Dave',
        lastName: 'Renard',
        tasks: [{ id: 't-done', status: 'DONE' }], // DONE should not be counted
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    // User has no active tasks → excluded from result (total = 0)
    expect(result).toHaveLength(0);
  });

  // 5. Sort by total descending
  it('sorts results by total descending', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u-low',
        firstName: 'Zara',
        lastName: 'Petit',
        tasks: [{ id: 't5', status: 'TODO' }], // total 1
        taskAssignments: [],
      }),
      makeUser({
        id: 'u-high',
        firstName: 'Alice',
        lastName: 'Martin',
        tasks: [
          { id: 't6', status: 'TODO' },
          { id: 't7', status: 'IN_PROGRESS' },
          { id: 't8', status: 'BLOCKED' },
        ], // total 3
        taskAssignments: [],
      }),
      makeUser({
        id: 'u-mid',
        firstName: 'Bob',
        lastName: 'Dupont',
        tasks: [
          { id: 't9', status: 'IN_REVIEW' },
          { id: 't10', status: 'TODO' },
        ], // total 2
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(3);
    expect(result[0].userId).toBe('u-high'); // 3
    expect(result[1].userId).toBe('u-mid');  // 2
    expect(result[2].userId).toBe('u-low');  // 1
  });

  // 5b. Stable tiebreaker: alphabetical by name when totals are equal
  it('uses name ascending as stable tiebreaker when totals are equal', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u-z',
        firstName: 'Zara',
        lastName: 'Petit',
        tasks: [{ id: 't-z', status: 'TODO' }],
        taskAssignments: [],
      }),
      makeUser({
        id: 'u-a',
        firstName: 'Alice',
        lastName: 'Martin',
        tasks: [{ id: 't-a', status: 'TODO' }],
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result[0].name).toBe('Alice Martin');
    expect(result[1].name).toBe('Zara Petit');
  });

  // 6. Limit applied after sorting
  it('respects the limit parameter (top N users)', async () => {
    const users: MockUser[] = [];
    for (let i = 1; i <= 5; i++) {
      users.push(
        makeUser({
          id: `u${i}`,
          firstName: `User`,
          lastName: `${i}`,
          tasks: Array.from({ length: i }, (_, j) => ({
            id: `t${i}-${j}`,
            status: 'TODO' as string,
          })),
          taskAssignments: [],
        }),
      );
    }
    mockPrisma.user.findMany.mockResolvedValue(users);

    const result = await service.getWorkload({ limit: 3 });

    expect(result).toHaveLength(3);
    // Top 3 should be users with 5, 4, 3 tasks respectively
    expect(result[0].total).toBe(5);
    expect(result[1].total).toBe(4);
    expect(result[2].total).toBe(3);
  });

  // 7. Users with no active tasks are excluded (total = 0 → absent from result)
  it('excludes users with no active tasks from the result', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u-empty',
        firstName: 'Ghost',
        lastName: 'User',
        tasks: [],
        taskAssignments: [],
      }),
      makeUser({
        id: 'u-active',
        firstName: 'Active',
        lastName: 'User',
        tasks: [{ id: 't-active', status: 'TODO' }],
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u-active');
  });

  // 8. Empty database — no users at all
  it('returns empty array when no users exist', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await service.getWorkload({});

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  // 9. Default limit is 15 when not provided
  it('applies default limit of 15', async () => {
    // Generate 20 users each with 1 active task
    const users: MockUser[] = Array.from({ length: 20 }, (_, i) =>
      makeUser({
        id: `u${i}`,
        firstName: `User`,
        lastName: `${i + 1}`,
        tasks: [{ id: `t${i}`, status: 'TODO' }],
        taskAssignments: [],
      }),
    );
    mockPrisma.user.findMany.mockResolvedValue(users);

    const result = await service.getWorkload({}); // no limit → default 15

    expect(result).toHaveLength(15);
  });

  // 10. counts shape always includes all 4 status keys, even if count is 0
  it('always returns all 4 status keys in counts (shape stability)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      makeUser({
        id: 'u-shape',
        firstName: 'Shape',
        lastName: 'Test',
        tasks: [{ id: 't-shape', status: 'TODO' }],
        taskAssignments: [],
      }),
    ]);

    const result = await service.getWorkload({});

    expect(result[0].counts).toHaveProperty('TODO');
    expect(result[0].counts).toHaveProperty('IN_PROGRESS');
    expect(result[0].counts).toHaveProperty('IN_REVIEW');
    expect(result[0].counts).toHaveProperty('BLOCKED');
    expect(result[0].counts.IN_PROGRESS).toBe(0);
    expect(result[0].counts.IN_REVIEW).toBe(0);
    expect(result[0].counts.BLOCKED).toBe(0);
  });

  // 11. Prisma is called with isActive: true filter
  it('queries only active users (isActive: true)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.getWorkload({ limit: 10 });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });
});
