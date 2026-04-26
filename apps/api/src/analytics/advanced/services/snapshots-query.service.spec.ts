import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsQueryService } from './snapshots-query.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessScopeService } from '../../../common/services/access-scope.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal snapshot row as Prisma would return it. */
function makeSnap(
  projectId: string,
  progress: number,
  dateStr: string,
): { projectId: string; progress: number; date: Date } {
  return { projectId, progress, date: new Date(dateStr) };
}

/** Build a minimal project row as Prisma would return it. */
function makeProject(id: string, name: string) {
  return { id, name };
}

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  project: { findMany: vi.fn() },
  projectSnapshot: { findMany: vi.fn() },
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SnapshotsQueryService', () => {
  let service: SnapshotsQueryService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsQueryService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AccessScopeService,
          useValue: {
            projectScopeWhere: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<SnapshotsQueryService>(SnapshotsQueryService);
  });

  // ── Test 1 — no projectIds → query all ACTIVE ──────────────────────────
  it('queries all ACTIVE projects when projectIds is not provided', async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    await service.getSnapshots({});

    expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.project.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    // No id filter when projectIds is absent
    expect(where.id).toBeUndefined();
  });

  // ── Test 2 — projectIds provided → intersect with ACTIVE ───────────────
  it('restricts query to given projectIds while still filtering by ACTIVE', async () => {
    const id1 = 'aaaaaaaa-0000-0000-0000-000000000001';
    const id2 = 'aaaaaaaa-0000-0000-0000-000000000002';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id1, 'P1')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    await service.getSnapshots({ projectIds: [id1, id2] });

    const where = mockPrisma.project.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.id).toEqual({ in: [id1, id2] });
  });

  // ── Test 3 — from/to applied to snapshot where clause ──────────────────
  it('passes from/to as gte/lte on the date field', async () => {
    const id = 'bbbbbbbb-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P1')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    const from = '2025-01-01';
    const to = '2025-06-30';
    await service.getSnapshots({ from, to });

    const snapWhere = mockPrisma.projectSnapshot.findMany.mock.calls[0][0].where;
    expect(snapWhere.date).toEqual({
      gte: new Date(from),
      lte: new Date(to),
    });
  });

  it('omits the date filter entirely when neither from nor to is given', async () => {
    const id = 'cccccccc-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P1')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    await service.getSnapshots({});

    const snapWhere = mockPrisma.projectSnapshot.findMany.mock.calls[0][0].where;
    expect(snapWhere.date).toBeUndefined();
  });

  // ── Test 4 — perProject points ordered by date, dedup (max date) ───────
  it('deduplicates intra-day snapshots by keeping the latest one', async () => {
    const id = 'dddddddd-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P1')]);

    // Two snapshots on the same UTC day: earlier with progress=20, later=80
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([
      makeSnap(id, 20, '2025-03-15T10:00:00.000Z'), // earlier — must lose
      makeSnap(id, 80, '2025-03-15T22:00:00.000Z'), // latest — must win
    ]);

    const result = await service.getSnapshots({});

    expect(result.perProject).toHaveLength(1);
    const points = result.perProject[0].points;
    expect(points).toHaveLength(1);
    expect(points[0].progress).toBe(80);
    expect(points[0].date).toBe('2025-03-15T00:00:00.000Z');
  });

  it('returns perProject points sorted ascending by date', async () => {
    const id = 'eeeeeeee-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P1')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([
      makeSnap(id, 60, '2025-02-10T20:00:00.000Z'),
      makeSnap(id, 30, '2025-01-05T20:00:00.000Z'),
      makeSnap(id, 90, '2025-03-20T20:00:00.000Z'),
    ]);

    const result = await service.getSnapshots({});
    const dates = result.perProject[0].points.map((p) => p.date);
    expect(dates).toEqual([
      '2025-01-05T00:00:00.000Z',
      '2025-02-10T00:00:00.000Z',
      '2025-03-20T00:00:00.000Z',
    ]);
  });

  // ── Test 5 — portfolioAverage is arithmetic mean over all snapshots ─────
  it('computes portfolioAverage as mean over ALL snapshots per day (not mean-of-means)', async () => {
    const idA = 'ffffffff-0000-0000-0000-000000000001';
    const idB = 'ffffffff-0000-0000-0000-000000000002';
    mockPrisma.project.findMany.mockResolvedValue([
      makeProject(idA, 'A'),
      makeProject(idB, 'B'),
    ]);

    // Day 2025-04-01:
    //   Project A has 2 snapshots: progress 20 and 40  → A-day-mean = 30
    //   Project B has 1 snapshot:  progress 60          → B-day-mean = 60
    //   All-snapshots mean = (20 + 40 + 60) / 3 = 40
    //   Mean-of-means = (30 + 60) / 2 = 45  ← must NOT be returned
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([
      makeSnap(idA, 20, '2025-04-01T08:00:00.000Z'),
      makeSnap(idA, 40, '2025-04-01T22:00:00.000Z'),
      makeSnap(idB, 60, '2025-04-01T12:00:00.000Z'),
    ]);

    const result = await service.getSnapshots({});

    expect(result.portfolioAverage).toHaveLength(1);
    const avg = result.portfolioAverage[0];
    expect(avg.date).toBe('2025-04-01T00:00:00.000Z');
    // (20 + 40 + 60) / 3 = 40
    expect(avg.progress).toBeCloseTo(40, 6);
  });

  it('sorts portfolioAverage ascending by date', async () => {
    const id = 'aaaabbbb-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P1')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([
      makeSnap(id, 50, '2025-06-15T20:00:00.000Z'),
      makeSnap(id, 20, '2025-03-10T20:00:00.000Z'),
      makeSnap(id, 80, '2025-09-01T20:00:00.000Z'),
    ]);

    const result = await service.getSnapshots({});
    const dates = result.portfolioAverage.map((p) => p.date);
    expect(dates).toEqual([
      '2025-03-10T00:00:00.000Z',
      '2025-06-15T00:00:00.000Z',
      '2025-09-01T00:00:00.000Z',
    ]);
  });

  // ── Test 6 — empty results ──────────────────────────────────────────────
  it('returns empty arrays when no ACTIVE projects are found', async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);
    // projectSnapshot.findMany should NOT be called (early exit)
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    const result = await service.getSnapshots({});

    expect(result).toEqual({ perProject: [], portfolioAverage: [] });
    expect(mockPrisma.projectSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('returns a project with empty points when it has no snapshots in range', async () => {
    const id = 'aabbccdd-0000-0000-0000-000000000001';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'NoSnaps')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    const result = await service.getSnapshots({});

    expect(result.perProject).toHaveLength(1);
    expect(result.perProject[0].projectId).toBe(id);
    expect(result.perProject[0].points).toEqual([]);
    expect(result.portfolioAverage).toEqual([]);
  });

  // ── Edge: projectIds given but none are ACTIVE → early exit ────────────
  it('returns empty arrays when given projectIds match no ACTIVE project', async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);

    const result = await service.getSnapshots({
      projectIds: ['11111111-1111-1111-1111-111111111111'],
    });

    expect(result).toEqual({ perProject: [], portfolioAverage: [] });
    expect(mockPrisma.projectSnapshot.findMany).not.toHaveBeenCalled();
  });

  // ── Edge: only from provided (no to) ───────────────────────────────────
  it('applies only gte when only from is supplied', async () => {
    const id = 'aabbccdd-0000-0000-0000-000000000002';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    await service.getSnapshots({ from: '2025-01-01' });

    const snapWhere = mockPrisma.projectSnapshot.findMany.mock.calls[0][0].where;
    expect(snapWhere.date).toEqual({ gte: new Date('2025-01-01') });
    expect(snapWhere.date.lte).toBeUndefined();
  });

  // ── Edge: only to provided (no from) ───────────────────────────────────
  it('applies only lte when only to is supplied', async () => {
    const id = 'aabbccdd-0000-0000-0000-000000000003';
    mockPrisma.project.findMany.mockResolvedValue([makeProject(id, 'P')]);
    mockPrisma.projectSnapshot.findMany.mockResolvedValue([]);

    await service.getSnapshots({ to: '2025-12-31' });

    const snapWhere = mockPrisma.projectSnapshot.findMany.mock.calls[0][0].where;
    expect(snapWhere.date).toEqual({ lte: new Date('2025-12-31') });
    expect(snapWhere.date.gte).toBeUndefined();
  });
});
