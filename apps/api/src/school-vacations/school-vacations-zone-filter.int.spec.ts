import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, SchoolVacationZone } from 'database';
import { SchoolVacationsService } from './school-vacations.service';

/**
 * COR-071 — Real-Postgres integration witness for the multi-zone planning filter.
 *
 * THE FEATURE
 * -----------
 * The planning must show 1, 2 or all 3 school-vacation zones. findByRange() gained
 * an optional `zones` filter and the planning overview calls findByRangeForDisplay(),
 * which restricts the result to the zones selected in settings. This spec proves the
 * Prisma `zone: { in: [...] }` filter behaves correctly against a real engine.
 *
 * WHY A REAL DB
 * -------------
 * The unit spec mocks Prisma, so it asserts the `where` SHAPE but not that Postgres
 * actually filters by the enum column. This runs the query for real.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

// findByRange never touches SettingsService — a stub satisfies the constructor.
const service = new SchoolVacationsService(db as never, {} as never);

const tag = randomUUID().slice(0, 8);
const YEAR = 2039;
const START = '2039-02-01';
const END = '2039-02-28';

const nameA = `COR-071 A ${tag}`;
const nameB = `COR-071 B ${tag}`;
const nameC = `COR-071 C ${tag}`;

beforeAll(async () => {
  await db.schoolVacation.createMany({
    data: [
      {
        name: nameA,
        zone: SchoolVacationZone.A,
        year: YEAR,
        startDate: new Date('2039-02-10'),
        endDate: new Date('2039-02-20'),
      },
      {
        name: nameB,
        zone: SchoolVacationZone.B,
        year: YEAR,
        startDate: new Date('2039-02-10'),
        endDate: new Date('2039-02-20'),
      },
      {
        name: nameC,
        zone: SchoolVacationZone.C,
        year: YEAR,
        startDate: new Date('2039-02-10'),
        endDate: new Date('2039-02-20'),
      },
    ],
  });
});

afterAll(async () => {
  await db.schoolVacation.deleteMany({
    where: { name: { in: [nameA, nameB, nameC] } },
  });
  await db.$disconnect();
});

// Restrict assertions to this spec's own rows (the shared DB may hold others).
const mine = (rows: { name: string }[]) =>
  rows
    .map((r) => r.name)
    .filter((n) => [nameA, nameB, nameC].includes(n))
    .sort();

describe('COR-071 — findByRange zone filter (real DB)', () => {
  it('returns all three zones when no filter is given', async () => {
    const rows = await service.findByRange(START, END);
    expect(mine(rows)).toEqual([nameA, nameB, nameC].sort());
  });

  it('returns only the single selected zone', async () => {
    const rows = await service.findByRange(START, END, [SchoolVacationZone.A]);
    expect(mine(rows)).toEqual([nameA]);
  });

  it('returns exactly the two selected zones (1, 2 or 3 supported)', async () => {
    const rows = await service.findByRange(START, END, [
      SchoolVacationZone.A,
      SchoolVacationZone.C,
    ]);
    expect(mine(rows)).toEqual([nameA, nameC].sort());
  });

  it('an empty zone list is treated as "no filter" (all zones)', async () => {
    const rows = await service.findByRange(START, END, []);
    expect(mine(rows)).toEqual([nameA, nameB, nameC].sort());
  });
});
