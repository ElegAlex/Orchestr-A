import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MilestoneStatus } from '@prisma/client';
import { MilestonesCompletionService } from './milestones-completion.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const past = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const future = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
};

const makeMilestone = (
  overrides: Partial<{
    id: string;
    status: MilestoneStatus;
    dueDate: Date;
    projectId: string;
    projectName: string;
  }>,
) => ({
  id: overrides.id ?? 'ms-1',
  name: 'Milestone',
  description: null,
  dueDate: overrides.dueDate ?? future(10),
  status: overrides.status ?? MilestoneStatus.PENDING,
  projectId: overrides.projectId ?? 'proj-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  project: {
    id: overrides.projectId ?? 'proj-1',
    name: overrides.projectName ?? 'Project Alpha',
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MilestonesCompletionService', () => {
  let service: MilestonesCompletionService;

  const mockPrisma = {
    milestone: {
      findMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesCompletionService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<MilestonesCompletionService>(
      MilestonesCompletionService,
    );
  });

  // -------------------------------------------------------------------------
  // 1. No milestones
  // -------------------------------------------------------------------------
  it('returns all zeros and empty byProject when there are no milestones', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([]);

    const result = await service.getMilestonesCompletion();

    // total = completed + overdue + upcoming = 0
    expect(result).toEqual({
      onTime: 0,
      total: 0,
      ratio: 0,
      completed: 0,
      overdue: 0,
      upcoming: 0,
      byProject: [],
      details: [],
    });
  });

  // -------------------------------------------------------------------------
  // 2. Mixed scenario (COMPLETED + overdue + upcoming)
  // -------------------------------------------------------------------------
  it('counts completed, overdue, and upcoming correctly in a mixed scenario', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(5),
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(3),
      }),
      makeMilestone({
        id: 'ms-3',
        status: MilestoneStatus.PENDING,
        dueDate: past(2),
      }), // overdue
      makeMilestone({
        id: 'ms-4',
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: future(7),
      }), // upcoming
      makeMilestone({
        id: 'ms-5',
        status: MilestoneStatus.DELAYED,
        dueDate: future(1),
      }), // upcoming (not past due yet)
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.completed).toBe(2);
    expect(result.overdue).toBe(1);
    expect(result.upcoming).toBe(2);
    expect(result.total).toBe(5); // true total: completed + overdue + upcoming
    expect(result.onTime).toBe(2);
    expect(result.ratio).toBeCloseTo(2 / 3, 5); // ratio = completed / (completed + overdue)
  });

  // -------------------------------------------------------------------------
  // 3. Ratio: 3 completed + 2 overdue → ratio = 0.6
  // -------------------------------------------------------------------------
  it('computes ratio = 0.6 when 3 completed and 2 overdue', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(10),
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(9),
      }),
      makeMilestone({
        id: 'ms-3',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(8),
      }),
      makeMilestone({
        id: 'ms-4',
        status: MilestoneStatus.PENDING,
        dueDate: past(7),
      }),
      makeMilestone({
        id: 'ms-5',
        status: MilestoneStatus.DELAYED,
        dueDate: past(6),
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.completed).toBe(3);
    expect(result.overdue).toBe(2);
    expect(result.upcoming).toBe(0);
    expect(result.total).toBe(5); // true total: 3 completed + 2 overdue + 0 upcoming
    expect(result.onTime).toBe(3);
    expect(result.ratio).toBeCloseTo(0.6, 5); // ratio = 3 / (3 + 2)
  });

  // -------------------------------------------------------------------------
  // 4. Edge case: only completed milestones → ratio = 1.0
  // -------------------------------------------------------------------------
  it('returns ratio = 1 when all milestones are COMPLETED', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(5),
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(3),
      }),
      makeMilestone({
        id: 'ms-3',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(1),
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.completed).toBe(3);
    expect(result.overdue).toBe(0);
    expect(result.upcoming).toBe(0);
    expect(result.total).toBe(3); // true total: 3 + 0 + 0
    expect(result.onTime).toBe(3);
    expect(result.ratio).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 5. Edge case: only upcoming milestones → total = 0, ratio = 0
  // -------------------------------------------------------------------------
  it('returns total = 0 and ratio = 0 when all milestones are upcoming', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.PENDING,
        dueDate: future(5),
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: future(10),
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.completed).toBe(0);
    expect(result.overdue).toBe(0);
    expect(result.upcoming).toBe(2);
    expect(result.total).toBe(2); // true total: 0 + 0 + 2 upcoming
    expect(result.onTime).toBe(0);
    expect(result.ratio).toBe(0); // ratio = 0 / (0 + 0) = 0 (no due milestones)
  });

  // -------------------------------------------------------------------------
  // 6. byProject: 2 distinct projects, correct counts, sorted by name
  // -------------------------------------------------------------------------
  it('aggregates byProject correctly for 2 projects and sorts by name', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      // Project Zebra: 2 completed, 1 overdue → reached=2, total=3
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(5),
        projectId: 'proj-z',
        projectName: 'Zebra Project',
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(3),
        projectId: 'proj-z',
        projectName: 'Zebra Project',
      }),
      makeMilestone({
        id: 'ms-3',
        status: MilestoneStatus.PENDING,
        dueDate: past(1),
        projectId: 'proj-z',
        projectName: 'Zebra Project',
      }),
      // Project Alpha: 1 completed, 1 upcoming → reached=1, total=2
      makeMilestone({
        id: 'ms-4',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(2),
        projectId: 'proj-a',
        projectName: 'Alpha Project',
      }),
      makeMilestone({
        id: 'ms-5',
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: future(7),
        projectId: 'proj-a',
        projectName: 'Alpha Project',
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    // Sorted alphabetically by name: Alpha Project first, Zebra Project second
    expect(result.byProject).toHaveLength(2);

    expect(result.byProject[0]).toEqual({
      projectId: 'proj-a',
      name: 'Alpha Project',
      reached: 1,
      total: 2,
    });

    expect(result.byProject[1]).toEqual({
      projectId: 'proj-z',
      name: 'Zebra Project',
      reached: 2,
      total: 3,
    });

    // Overall counters
    expect(result.completed).toBe(3);
    expect(result.overdue).toBe(1);
    expect(result.upcoming).toBe(1);
    expect(result.total).toBe(5); // true total: 3 completed + 1 overdue + 1 upcoming
    expect(result.onTime).toBe(3);
    expect(result.ratio).toBeCloseTo(3 / 4, 5); // ratio = completed / (completed + overdue)
  });

  // -------------------------------------------------------------------------
  // 7. DELAYED status with past dueDate counts as overdue (not upcoming)
  // -------------------------------------------------------------------------
  it('treats DELAYED milestone with past dueDate as overdue', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.DELAYED,
        dueDate: past(3),
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.overdue).toBe(1);
    expect(result.upcoming).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(1); // true total: 0 + 1 + 0
    expect(result.ratio).toBe(0);
  });

  // -------------------------------------------------------------------------
  // COR-004 — total must equal completed + overdue + upcoming (true total)
  // -------------------------------------------------------------------------
  it('COR-004 — total equals completed + overdue + upcoming, not just completed + overdue', async () => {
    // 2 completed + 1 overdue + 3 upcoming → true total = 6, due = 3
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(5),
      }),
      makeMilestone({
        id: 'ms-2',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(3),
      }),
      makeMilestone({
        id: 'ms-3',
        status: MilestoneStatus.PENDING,
        dueDate: past(2),
      }), // overdue
      makeMilestone({
        id: 'ms-4',
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: future(7),
      }), // upcoming
      makeMilestone({
        id: 'ms-5',
        status: MilestoneStatus.PENDING,
        dueDate: future(3),
      }), // upcoming
      makeMilestone({
        id: 'ms-6',
        status: MilestoneStatus.DELAYED,
        dueDate: future(1),
      }), // upcoming
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.completed).toBe(2);
    expect(result.overdue).toBe(1);
    expect(result.upcoming).toBe(3);
    // total must be the TRUE total (all milestones), not just due milestones
    expect(result.total).toBe(6); // 2 + 1 + 3
    // ratio is still completed / (completed + overdue) — completion rate of actionable milestones
    expect(result.ratio).toBeCloseTo(2 / 3, 5);
  });

  // -------------------------------------------------------------------------
  // archived filter: default excludes archived projects
  // -------------------------------------------------------------------------
  it('default excludes archived projects (archivedAt: null in milestone project where)', async () => {
    mockPrisma.milestone.findMany.mockResolvedValue([]);
    await service.getMilestonesCompletion();
    const callArgs = mockPrisma.milestone.findMany.mock.calls[0][0] as {
      where: unknown;
    };
    expect(JSON.stringify(callArgs.where)).toContain('"archivedAt":null');
  });

  // -------------------------------------------------------------------------
  // COR-048 — daysFromNow uses UTC-midnight diff, not raw ms delta
  // -------------------------------------------------------------------------
  it('COR-048 — daysFromNow is 1 when due date is next UTC midnight and now is 18:00 UTC', async () => {
    // now = 2024-03-10T18:00:00Z, dueDate = 2024-03-11T00:00:00Z (next midnight)
    // Raw-ms approach: Math.round(6h / 24h) = Math.round(0.25) = 0  ← WRONG
    // UTC-midnight approach: 2024-03-11 - 2024-03-10 = 1             ← CORRECT
    const fixedNow = new Date('2024-03-10T18:00:00.000Z');
    const dueDate = new Date('2024-03-11T00:00:00.000Z');

    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-cor048-a',
        status: MilestoneStatus.PENDING,
        dueDate,
      }),
    ]);

    const result = await service.getMilestonesCompletion();
    vi.useRealTimers();

    expect(result.details[0].daysFromNow).toBe(1);
  });

  it('COR-048 — daysFromNow is 2 when due date is 30h ahead (now=18:00 UTC, due=next+1 midnight)', async () => {
    // now = 2024-03-10T18:00:00Z, dueDate = 2024-03-12T00:00:00Z (30h ahead)
    // Raw-ms approach: Math.round(30h / 24h) = Math.round(1.25) = 1  ← WRONG
    // UTC-midnight approach: 2024-03-12 - 2024-03-10 = 2             ← CORRECT
    const fixedNow = new Date('2024-03-10T18:00:00.000Z');
    const dueDate = new Date('2024-03-12T00:00:00.000Z');

    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-cor048-b',
        status: MilestoneStatus.PENDING,
        dueDate,
      }),
    ]);

    const result = await service.getMilestonesCompletion();
    vi.useRealTimers();

    expect(result.details[0].daysFromNow).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 8. Projects with 0 milestones are excluded from byProject
  // -------------------------------------------------------------------------
  it('excludes projects with no milestones from byProject', async () => {
    // Only one project has milestones; the other project has none
    // (projects with no milestones simply never appear in the findMany result)
    mockPrisma.milestone.findMany.mockResolvedValue([
      makeMilestone({
        id: 'ms-1',
        status: MilestoneStatus.COMPLETED,
        dueDate: past(1),
        projectId: 'proj-1',
        projectName: 'Solo Project',
      }),
    ]);

    const result = await service.getMilestonesCompletion();

    expect(result.byProject).toHaveLength(1);
    expect(result.byProject[0].projectId).toBe('proj-1');
  });
});
