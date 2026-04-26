import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RecentActivityService } from './recent-activity.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal task fixture. Defaults to a non-done, non-overdue, recent task. */
function makeTask(overrides: {
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  endDate?: Date | null;
}) {
  return {
    status: overrides.status ?? 'TODO',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    endDate: overrides.endDate !== undefined ? overrides.endDate : null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('RecentActivityService', () => {
  let service: RecentActivityService;

  // Pinned "now" so all date arithmetic is deterministic
  const NOW = new Date('2026-04-23T12:00:00.000Z');

  const mockPrisma = {
    task: {
      findMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecentActivityService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<RecentActivityService>(RecentActivityService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. days default = 30
  // -------------------------------------------------------------------------

  it('uses 30 days by default and returns a trend with 30 points', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity({});

    expect(result.trend).toHaveLength(30);
  });

  // -------------------------------------------------------------------------
  // 2. custom days = 7 → 7 trend points
  // -------------------------------------------------------------------------

  it('respects custom days value (days=7 → 7 trend points)', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity({ days: 7 });

    expect(result.trend).toHaveLength(7);
  });

  // -------------------------------------------------------------------------
  // 3. completed correctly counted (DONE + updatedAt in window)
  // -------------------------------------------------------------------------

  it('counts tasks with status DONE and updatedAt within the window as completed', async () => {
    // windowStart = start of UTC day that is (days-1) days before today
    // NOW = 2026-04-23T12:00:00Z, days=30 → oldest bucket = 2026-03-25T00:00:00Z
    const windowStart = new Date(Date.UTC(2026, 2, 25, 0, 0, 0)); // 2026-03-25

    mockPrisma.task.findMany.mockResolvedValue([
      // Within window → counted
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() + 1000) }),
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() + 2000) }),
      // DONE but before the window → NOT counted
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() - 1000) }),
      // Not DONE but updatedAt in window → NOT counted
      makeTask({ status: 'IN_PROGRESS', updatedAt: new Date(windowStart.getTime() + 1000) }),
    ]);

    const result = await service.getRecentActivity({ days: 30 });

    expect(result.completed).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 4. created correctly counted (createdAt in window)
  // -------------------------------------------------------------------------

  it('counts tasks created within the window regardless of status', async () => {
    // windowStart = 2026-03-25T00:00:00Z for days=30 with NOW = 2026-04-23T12:00:00Z
    const windowStart = new Date(Date.UTC(2026, 2, 25, 0, 0, 0)); // 2026-03-25

    mockPrisma.task.findMany.mockResolvedValue([
      // Within window
      makeTask({ status: 'TODO', createdAt: new Date(windowStart.getTime() + 1000) }),
      makeTask({ status: 'DONE', createdAt: new Date(windowStart.getTime() + 2000) }),
      // Before window → NOT counted
      makeTask({ status: 'TODO', createdAt: new Date(windowStart.getTime() - 1000) }),
    ]);

    const result = await service.getRecentActivity({ days: 30 });

    expect(result.created).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 5. overdue correctly counted (not DONE + endDate < now)
  // -------------------------------------------------------------------------

  it('counts tasks that are not DONE and have endDate in the past as overdue', async () => {
    const pastDate = new Date(NOW.getTime() - 1000);
    const futureDate = new Date(NOW.getTime() + 1000);

    mockPrisma.task.findMany.mockResolvedValue([
      // Overdue: not DONE, endDate in past
      makeTask({ status: 'TODO', endDate: pastDate }),
      makeTask({ status: 'IN_PROGRESS', endDate: pastDate }),
      // DONE with past endDate → NOT overdue
      makeTask({ status: 'DONE', endDate: pastDate }),
      // Not DONE, future endDate → NOT overdue
      makeTask({ status: 'TODO', endDate: futureDate }),
      // Not DONE, null endDate → NOT overdue
      makeTask({ status: 'TODO', endDate: null }),
    ]);

    const result = await service.getRecentActivity({ days: 30 });

    expect(result.overdue).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 6a. completionRatio calculated correctly
  // -------------------------------------------------------------------------

  it('calculates completionRatio as completed / (completed + created)', async () => {
    // windowStart = 2026-03-25T00:00:00Z for days=30 with NOW = 2026-04-23T12:00:00Z
    const windowStart = new Date(Date.UTC(2026, 2, 25, 0, 0, 0)); // 2026-03-25

    // completed = 2 DONE within window
    // created = 3 tasks created within window (both DONE + 1 TODO)
    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({
        status: 'DONE',
        createdAt: new Date(windowStart.getTime() + 1000),
        updatedAt: new Date(windowStart.getTime() + 5000),
      }),
      makeTask({
        status: 'DONE',
        createdAt: new Date(windowStart.getTime() + 2000),
        updatedAt: new Date(windowStart.getTime() + 6000),
      }),
      makeTask({
        status: 'TODO',
        createdAt: new Date(windowStart.getTime() + 3000),
        updatedAt: new Date(windowStart.getTime() + 3000),
      }),
    ]);

    const result = await service.getRecentActivity({ days: 30 });

    // completed=2, created=3 → ratio = 2/5 = 0.4
    expect(result.completed).toBe(2);
    expect(result.created).toBe(3);
    expect(result.completionRatio).toBeCloseTo(2 / 5, 10);
  });

  // -------------------------------------------------------------------------
  // 6b. completionRatio edge case: 0 completed + 0 created → 0
  // -------------------------------------------------------------------------

  it('returns completionRatio=0 when both completed and created are 0', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity({ days: 30 });

    expect(result.completionRatio).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 7a. trend has exactly `days` elements
  // -------------------------------------------------------------------------

  it('trend always has exactly `days` elements, even with no completions', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result14 = await service.getRecentActivity({ days: 14 });
    const result1 = await service.getRecentActivity({ days: 1 });
    const result365 = await service.getRecentActivity({ days: 365 });

    expect(result14.trend).toHaveLength(14);
    expect(result1.trend).toHaveLength(1);
    expect(result365.trend).toHaveLength(365);
  });

  // -------------------------------------------------------------------------
  // 7b. days with no completions have count=0
  // -------------------------------------------------------------------------

  it('fills trend days with no completions as 0', async () => {
    // windowStart for days=7, NOW=2026-04-23: oldest bucket = 2026-04-17T00:00:00Z
    const windowStart = new Date(Date.UTC(2026, 3, 17, 0, 0, 0)); // 2026-04-17

    // One completion on the second bucket day
    const completionDate = new Date(windowStart.getTime() + 1 * 24 * 60 * 60 * 1000); // 2026-04-18
    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ status: 'DONE', updatedAt: completionDate }),
    ]);

    const result = await service.getRecentActivity({ days: 7 });

    expect(result.trend).toHaveLength(7);

    const zeroPoints = result.trend.filter((p) => p.completed === 0);
    expect(zeroPoints).toHaveLength(6);

    const nonZeroPoints = result.trend.filter((p) => p.completed > 0);
    expect(nonZeroPoints).toHaveLength(1);
    expect(nonZeroPoints[0].completed).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 7c. sum of trend counts equals `completed`
  // -------------------------------------------------------------------------

  it('sum of trend completed counts equals the top-level completed count', async () => {
    // windowStart for days=7, NOW=2026-04-23: oldest bucket = 2026-04-17T00:00:00Z
    const windowStart = new Date(Date.UTC(2026, 3, 17, 0, 0, 0)); // 2026-04-17

    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() + 1000) }),
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() + 2000) }),
      makeTask({ status: 'DONE', updatedAt: new Date(windowStart.getTime() + 1 * 24 * 60 * 60 * 1000) }),
    ]);

    const result = await service.getRecentActivity({ days: 7 });

    const trendSum = result.trend.reduce((acc, p) => acc + p.completed, 0);
    expect(trendSum).toBe(result.completed);
    expect(result.completed).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 7d. trend dates are in ISO YYYY-MM-DD format, sorted ascending
  // -------------------------------------------------------------------------

  it('trend dates are in YYYY-MM-DD format and sorted ascending', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity({ days: 7 });

    const iso8601Date = /^\d{4}-\d{2}-\d{2}$/;
    for (const point of result.trend) {
      expect(point.date).toMatch(iso8601Date);
    }

    // Verify ascending order
    for (let i = 1; i < result.trend.length; i++) {
      expect(result.trend[i].date >= result.trend[i - 1].date).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // 8. empty database
  // -------------------------------------------------------------------------

  it('returns all zeros when no tasks exist', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity({ days: 30 });

    expect(result.completed).toBe(0);
    expect(result.created).toBe(0);
    expect(result.overdue).toBe(0);
    expect(result.completionRatio).toBe(0);
    expect(result.trend).toHaveLength(30);
    expect(result.trend.every((p) => p.completed === 0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Regression: task completed today (within same UTC day) appears in trend
  // -------------------------------------------------------------------------

  it('task completed today lands in the last trend bucket and is counted in completed', async () => {
    // NOW = 2026-04-23T12:00:00Z — one hour before "now" is still today
    const completedTodayAt = new Date(NOW.getTime() - 60 * 60 * 1000); // 2026-04-23T11:00:00Z

    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ status: 'DONE', updatedAt: completedTodayAt }),
    ]);

    const result = await service.getRecentActivity({ days: 7 });

    expect(result.completed).toBe(1);

    // The last bucket is today's date
    const lastBucket = result.trend[result.trend.length - 1];
    expect(lastBucket.date).toBe('2026-04-23');
    expect(lastBucket.completed).toBe(1);

    // Invariant: sum(trend) == completed
    const trendSum = result.trend.reduce((acc, p) => acc + p.completed, 0);
    expect(trendSum).toBe(result.completed);
  });

  // -------------------------------------------------------------------------
  // Extra: Prisma is called with project status ACTIVE filter
  // -------------------------------------------------------------------------

  it('queries only tasks belonging to ACTIVE projects', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    await service.getRecentActivity({ days: 30 });

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      }),
    );
  });
});
