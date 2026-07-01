import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';
import { UsersService } from './users.service';

/**
 * COR-070 — Real-Postgres integration witness for UsersService.getUsersPresence().
 *
 * THE GAP this closes
 * -------------------
 * users.service.spec.ts mocks `$queryRaw` to return canned rows, so the SQL text
 * is never sent to a real engine. The PER-016 refactor wrote the presence query
 * with UNQUOTED snake_case identifiers (u.first_name, ts.is_telework, …). The
 * physical columns are camelCase (Prisma default: no per-field @map), so Postgres
 * folds the identifiers to lowercase and errors with "column u.first_name does not
 * exist" — the query throws (500) and the dashboard "Présence" dialog shows
 * "Erreur lors du chargement des données". Every mock-based assertion still passes.
 *
 * WHAT IS TESTED
 * --------------
 * Seed four active users into distinct presence buckets on a fixed date, then run
 * the real getUsersPresence() against the migrated ephemeral DB and assert each
 * user is classified correctly. A single wrong identifier makes the query throw,
 * turning this spec RED — which no mock-based test can do.
 *
 * RED/GREEN mutation method
 * -------------------------
 * Revert any quoted identifier in the query back to unquoted snake_case
 * (e.g. u."firstName" → u.first_name) → getUsersPresence() rejects with
 * "column u.first_name does not exist" → this spec fails → RED.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

// getUsersPresence only touches `this.prisma`; the other six collaborators are
// never called on this path, so real-service instantiation needs only Prisma.
const service = new UsersService(
  db as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

// Fixed reference day well clear of any other spec's data.
const DAY = '2031-03-12';
const DAY_START = new Date('2031-03-12T00:00:00.000Z');

const tag = randomUUID().slice(0, 8);
const ids = {
  onSite: `cor070-onsite-${tag}`,
  remote: `cor070-remote-${tag}`,
  absent: `cor070-absent-${tag}`,
  external: `cor070-external-${tag}`,
};
const departmentId = `cor070-dept-${tag}`;
const serviceId = `cor070-svc-${tag}`;
const taskId = `cor070-task-${tag}`;
const leaveTypeId = `cor070-lt-${tag}`;
const leaveId = `cor070-leave-${tag}`;

async function mkUser(id: string, lastName: string) {
  await db.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      login: id,
      passwordHash: 'x',
      firstName: 'Test',
      lastName,
      isActive: true,
      departmentId,
    },
  });
}

beforeAll(async () => {
  await db.department.create({
    data: { id: departmentId, name: `COR-070 Dept ${tag}` },
  });
  await db.service.create({
    data: { id: serviceId, name: `COR-070 Svc ${tag}`, departmentId },
  });

  await mkUser(ids.onSite, 'AaOnSite');
  await mkUser(ids.remote, 'BbRemote');
  await mkUser(ids.absent, 'CcAbsent');
  await mkUser(ids.external, 'DdExternal');

  // onSite user gets a service membership → exercises the LATERAL serviceName join.
  await db.userService.create({
    data: { userId: ids.onSite, serviceId },
  });

  // REMOTE: telework flagged on DAY.
  await db.teleworkSchedule.create({
    data: { userId: ids.remote, date: new Date(DAY), isTelework: true },
  });

  // ABSENT: approved leave spanning DAY (precedence over everything).
  await db.leaveTypeConfig.create({
    data: { id: leaveTypeId, code: `COR070_${tag}`, name: `COR-070 ${tag}` },
  });
  await db.leave.create({
    data: {
      id: leaveId,
      userId: ids.absent,
      type: 'OTHER',
      leaveTypeId,
      startDate: new Date(DAY),
      endDate: new Date(DAY),
      days: 1,
      status: 'APPROVED',
    },
  });

  // EXTERNAL: assigned to an external-intervention task spanning DAY.
  await db.task.create({
    data: {
      id: taskId,
      title: `COR-070 external ${tag}`,
      status: 'TODO',
      isExternalIntervention: true,
      startDate: new Date('2031-03-11T00:00:00.000Z'),
      endDate: new Date('2031-03-13T00:00:00.000Z'),
    },
  });
  await db.taskAssignee.create({
    data: { taskId, userId: ids.external },
  });
});

afterAll(async () => {
  await db.taskAssignee.deleteMany({ where: { taskId } });
  await db.task.deleteMany({ where: { id: taskId } });
  await db.leave.deleteMany({ where: { id: leaveId } });
  await db.leaveTypeConfig.deleteMany({ where: { id: leaveTypeId } });
  await db.teleworkSchedule.deleteMany({ where: { userId: ids.remote } });
  await db.userService.deleteMany({ where: { serviceId } });
  await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.department.deleteMany({ where: { id: departmentId } });
  await db.$disconnect();
});

describe('COR-070 — getUsersPresence real-DB witness', () => {
  it('runs the raw query without a column-name error and classifies each status', async () => {
    // The mere fact this resolves proves every quoted identifier exists — the
    // unquoted-snake_case regression rejects here before any assertion runs.
    const result = await service.getUsersPresence(DAY);

    expect(result.date).toBe(DAY);
    expect(result.onSite.some((u) => u.id === ids.onSite)).toBe(true);
    expect(result.remote.some((u) => u.id === ids.remote)).toBe(true);
    expect(result.absent.some((u) => u.id === ids.absent)).toBe(true);
    expect(result.external.some((u) => u.id === ids.external)).toBe(true);

    // serviceName round-trips through the LATERAL join (also camelCase-quoted).
    const onSite = result.onSite.find((u) => u.id === ids.onSite);
    expect(onSite?.serviceName).toBe(`COR-070 Svc ${tag}`);
    expect(onSite?.departmentName).toBe(`COR-070 Dept ${tag}`);
  });

  it('does not misclassify: each seeded user appears in exactly one bucket', async () => {
    const result = await service.getUsersPresence(DAY);
    const seeded = new Set<string>(Object.values(ids));
    const buckets = [
      result.onSite,
      result.remote,
      result.absent,
      result.external,
    ];
    for (const id of seeded) {
      const hits = buckets.filter((b) => b.some((u) => u.id === id)).length;
      expect(hits).toBe(1);
    }
  });
});
