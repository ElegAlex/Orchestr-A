import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectHealthService } from './project-health.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAST = new Date('2020-01-01T00:00:00.000Z');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

function makeProject(overrides: {
  id?: string;
  name?: string;
  endDate?: Date | null;
  snapshots?: { progress: number }[];
  milestones?: { status: string; dueDate: Date }[];
  tasks?: { id: string }[];
  members?: { id: string }[];
}) {
  return {
    id: overrides.id ?? 'proj-1',
    name: overrides.name ?? 'Test Project',
    status: 'ACTIVE',
    endDate: overrides.endDate ?? null,
    snapshots: overrides.snapshots ?? [],
    milestones: overrides.milestones ?? [],
    tasks: overrides.tasks ?? [],
    members: overrides.members ?? [],
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ProjectHealthService', () => {
  let service: ProjectHealthService;
  let prismaFindMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    prismaFindMany = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectHealthService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findMany: prismaFindMany,
            },
          },
        },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectHealthService>(ProjectHealthService);
  });

  // 10 — empty case
  it('returns [] when no ACTIVE projects exist', async () => {
    prismaFindMany.mockResolvedValue([]);
    const result = await service.getProjectHealth();
    expect(result).toEqual([]);
  });

  // 1 — project without snapshot → progressPct = 0
  it('returns progressPct = 0 when no snapshot exists', async () => {
    prismaFindMany.mockResolvedValue([makeProject({ snapshots: [] })]);
    const [row] = await service.getProjectHealth();
    expect(row.progressPct).toBe(0);
  });

  // 2 — project with snapshot → progressPct = last snapshot progress
  it('returns progressPct from the latest snapshot', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({ snapshots: [{ progress: 72.5 }] }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.progressPct).toBe(72.5);
  });

  // 3 — milestone counters
  it('computes reached / overdue / upcoming milestones correctly', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        milestones: [
          // reached
          { status: 'COMPLETED', dueDate: PAST },
          { status: 'COMPLETED', dueDate: FUTURE },
          // overdue (non-COMPLETED, past)
          { status: 'PENDING', dueDate: PAST },
          { status: 'IN_PROGRESS', dueDate: PAST },
          // upcoming (non-COMPLETED, future)
          { status: 'PENDING', dueDate: FUTURE },
        ],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.milestones.reached).toBe(2);
    expect(row.milestones.overdue).toBe(2);
    expect(row.milestones.upcoming).toBe(1);
  });

  // 4 — activeTasks only counts active statuses (DONE excluded)
  it('counts activeTasks excluding DONE', async () => {
    // The Prisma query already filters on the service side — the mock returns
    // only what Prisma would return after the where clause.
    prismaFindMany.mockResolvedValue([
      makeProject({
        tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    // 3 tasks returned by Prisma (DONE was filtered out at query level)
    expect(row.activeTasks).toBe(3);
  });

  // 5 — teamSize
  it('returns correct teamSize from ProjectMember count', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        members: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.teamSize).toBe(4);
  });

  // 6 — health green (0 overdue)
  it('health is green when overdueMilestones === 0 and endDate is null', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({ milestones: [], endDate: null }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('green');
  });

  // extra — health green when endDate is future and 0 overdue
  it('health is green when endDate is in the future and 0 overdue', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({ milestones: [], endDate: FUTURE }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('green');
  });

  // 7 — health orange (1 overdue)
  it('health is orange when overdueMilestones === 1', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        endDate: null,
        milestones: [{ status: 'PENDING', dueDate: PAST }],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('orange');
  });

  it('health is orange when overdueMilestones === 2', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        endDate: null,
        milestones: [
          { status: 'PENDING', dueDate: PAST },
          { status: 'IN_PROGRESS', dueDate: PAST },
        ],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('orange');
  });

  // 8 — health red (3+ overdue)
  it('health is red when overdueMilestones >= 3', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        endDate: null,
        milestones: [
          { status: 'PENDING', dueDate: PAST },
          { status: 'PENDING', dueDate: PAST },
          { status: 'IN_PROGRESS', dueDate: PAST },
        ],
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('red');
  });

  // 9 — health red (endDate past, 0 overdue) — isolates the endDate rule
  it('health is red when endDate is past with 0 overdue milestones', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({
        endDate: PAST,
        milestones: [], // explicitly 0 overdue to isolate endDate rule
      }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('red');
  });

  // — null endDate + 0 overdue should NOT trigger red (no endDate rule)
  it('health is green when endDate is null and 0 overdue (null endDate does not trigger red)', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({ endDate: null, milestones: [] }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.health).toBe('green');
  });

  // — correct shape / field mapping
  it('maps projectId and name correctly', async () => {
    prismaFindMany.mockResolvedValue([
      makeProject({ id: 'abc-123', name: 'My Project' }),
    ]);
    const [row] = await service.getProjectHealth();
    expect(row.projectId).toBe('abc-123');
    expect(row.name).toBe('My Project');
  });

  // — Prisma query uses correct where clause
  it('queries only ACTIVE projects', async () => {
    prismaFindMany.mockResolvedValue([]);
    await service.getProjectHealth();
    expect(prismaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });
});
