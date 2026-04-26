import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksBreakdownService } from './tasks-breakdown.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

describe('TasksBreakdownService', () => {
  let service: TasksBreakdownService;

  const mockPrismaService = {
    task: {
      findMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksBreakdownService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<TasksBreakdownService>(TasksBreakdownService);
  });

  // ─── Where-clause tests ──────────────────────────────────────────────────────

  it('queries tasks from all ACTIVE projects when projectIds is undefined', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);

    await service.getTasksBreakdown({});

    const callArgs = mockPrismaService.task.findMany.mock.calls[0][0] as {
      where: { project: { status: string; id?: unknown } };
    };
    expect(callArgs.where.project.status).toBe('ACTIVE');
    expect(callArgs.where.project.id).toBeUndefined();
  });

  it('queries tasks from all ACTIVE projects when projectIds is empty array', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);

    await service.getTasksBreakdown({ projectIds: [] });

    const callArgs = mockPrismaService.task.findMany.mock.calls[0][0] as {
      where: { project: { status: string; id?: unknown } };
    };
    expect(callArgs.where.project.status).toBe('ACTIVE');
    expect(callArgs.where.project.id).toBeUndefined();
  });

  it('filters to provided projectIds intersected with ACTIVE status', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);
    const ids = ['uuid-1', 'uuid-2'];

    await service.getTasksBreakdown({ projectIds: ids });

    const callArgs = mockPrismaService.task.findMany.mock.calls[0][0] as {
      where: { project: { status: string; id: { in: string[] } } };
    };
    expect(callArgs.where.project.status).toBe('ACTIVE');
    expect(callArgs.where.project.id).toEqual({ in: ids });
  });

  // ─── Priority counting ────────────────────────────────────────────────────────

  it('counts all 4 priority values correctly with a mixed dataset', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([
      { priority: 'CRITICAL', status: 'TODO' },
      { priority: 'CRITICAL', status: 'TODO' },
      { priority: 'HIGH', status: 'TODO' },
      { priority: 'NORMAL', status: 'TODO' },
      { priority: 'NORMAL', status: 'TODO' },
      { priority: 'NORMAL', status: 'TODO' },
      { priority: 'LOW', status: 'TODO' },
    ]);

    const result = await service.getTasksBreakdown({});

    expect(result.byPriority).toEqual({
      CRITICAL: 2,
      HIGH: 1,
      NORMAL: 3,
      LOW: 1,
    });
  });

  // ─── Status counting ─────────────────────────────────────────────────────────

  it('counts all 5 status values correctly with a mixed dataset', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([
      { priority: 'NORMAL', status: 'TODO' },
      { priority: 'NORMAL', status: 'TODO' },
      { priority: 'NORMAL', status: 'IN_PROGRESS' },
      { priority: 'NORMAL', status: 'IN_REVIEW' },
      { priority: 'NORMAL', status: 'IN_REVIEW' },
      { priority: 'NORMAL', status: 'BLOCKED' },
      { priority: 'NORMAL', status: 'DONE' },
      { priority: 'NORMAL', status: 'DONE' },
      { priority: 'NORMAL', status: 'DONE' },
    ]);

    const result = await service.getTasksBreakdown({});

    expect(result.byStatus).toEqual({
      TODO: 2,
      IN_PROGRESS: 1,
      IN_REVIEW: 2,
      BLOCKED: 1,
      DONE: 3,
    });
  });

  // ─── Zero initialization ──────────────────────────────────────────────────────

  it('returns all priority categories at 0 when no tasks exist', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);

    const result = await service.getTasksBreakdown({});

    expect(result.byPriority).toEqual({
      CRITICAL: 0,
      HIGH: 0,
      NORMAL: 0,
      LOW: 0,
    });
  });

  it('returns all status categories at 0 when no tasks exist', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);

    const result = await service.getTasksBreakdown({});

    expect(result.byStatus).toEqual({
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      BLOCKED: 0,
      DONE: 0,
    });
  });

  it('includes all priority keys even when some categories have 0 tasks', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([
      { priority: 'CRITICAL', status: 'DONE' },
    ]);

    const result = await service.getTasksBreakdown({});

    expect(Object.keys(result.byPriority)).toEqual(
      expect.arrayContaining(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
    );
    expect(result.byPriority.HIGH).toBe(0);
    expect(result.byPriority.NORMAL).toBe(0);
    expect(result.byPriority.LOW).toBe(0);
  });

  it('includes all status keys even when some categories have 0 tasks', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([
      { priority: 'NORMAL', status: 'DONE' },
    ]);

    const result = await service.getTasksBreakdown({});

    expect(Object.keys(result.byStatus)).toEqual(
      expect.arrayContaining(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']),
    );
    expect(result.byStatus.TODO).toBe(0);
    expect(result.byStatus.IN_PROGRESS).toBe(0);
    expect(result.byStatus.IN_REVIEW).toBe(0);
    expect(result.byStatus.BLOCKED).toBe(0);
  });

  // ─── Select projection ────────────────────────────────────────────────────────

  it('selects only priority and status fields (no over-fetching)', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);

    await service.getTasksBreakdown({});

    const callArgs = mockPrismaService.task.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(callArgs.select).toEqual({ priority: true, status: true });
  });
});
