import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-016 — real-DB witness for the name-uniqueness UNIQUE indexes added in
 * migration 20260527160000_dat016_unique_name_constraints.
 *
 * Two departments, or two services within the same department, could be created
 * with identical names — the UI showed indistinguishable duplicates and RBAC
 * scope decisions pivot on department/service membership, so name ambiguity is a
 * security concern. The application layer pre-checks uniqueness, but that check
 * is racy (TOCTOU) and a direct admin SQL write bypasses it entirely. The UNIQUE
 * indexes are the DB-level floor.
 *
 * Semantics asserted here (the load-bearing distinction):
 *   - Department.name is GLOBALLY unique             → departments_name_key
 *   - Service.name is unique PER department (composite, NOT global)
 *                                                    → services_departmentId_name_key
 *     i.e. two services with the SAME name in DIFFERENT departments stay legal.
 *
 * Raw SQL ($executeRawUnsafe) is used for the negative cases (not the ORM) so the
 * driver's unique_violation code (SQLSTATE 23505) + the offending key columns
 * surface in the error message verbatim. NOTE: Prisma's query engine reformats a
 * unique violation to `Key (<cols>)=(<vals>) already exists` — it surfaces the
 * KEY COLUMNS but NOT the index name (unlike a CHECK 23514, which keeps the
 * constraint name). The key-column tuple is the discriminating assertion here: it
 * proves WHICH index fired — `Key (name)=` for the global Department index,
 * `Key ("departmentId", name)=` for the composite Service index — so a vacuous
 * green on an unrelated 23505 (e.g. an accidental PK collision, which would read
 * `Key (id)=`) is impossible. The exact Prisma-convention index NAMES are locked
 * in by the separate pg_indexes test below.
 *
 * Pre-migration the duplicate INSERTs are accepted (the FAIL-pre the task
 * demands); post-migration Postgres rejects them. Runs against the ephemeral
 * migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a raw INSERT is rejected by a UNIQUE constraint. Teeth by construction: if the
 * index is absent (FAIL-pre), the INSERT is accepted, `message` stays empty, and the
 * 23505 assertion fails loudly — a vacuous green is impossible. `keySignature` is the
 * `Key (<cols>)=` substring of the Postgres DETAIL surfaced by Prisma, which pins the
 * violation to the intended index columns (not, e.g., an accidental PK collision).
 */
async function expectUniqueViolation(
  insert: Promise<unknown>,
  keySignature: string,
): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected a unique_violation (23505) but the INSERT was accepted',
  ).toMatch(/23505/);
  expect(message).toContain(keySignature);
}

/** Insert a department with a given name. Raw so the 23505 surfaces on the dup attempt. */
function insertDepartment(name: string): Promise<unknown> {
  return db.$executeRawUnsafe(
    `INSERT INTO departments (id, name, "updatedAt") VALUES (gen_random_uuid(), $1, now())`,
    name,
  );
}

/** Insert a service into a department. Raw so the 23505 surfaces on the dup attempt. */
function insertService(departmentId: string, name: string): Promise<unknown> {
  return db.$executeRawUnsafe(
    `INSERT INTO services (id, name, "departmentId", "updatedAt")
     VALUES (gen_random_uuid(), $2, $1, now())`,
    departmentId,
    name,
  );
}

/** Create a department via the ORM and return its id (used as a parent for service tests). */
async function makeDepartment(): Promise<string> {
  const dept = await db.department.create({
    data: { name: `DAT-016 parent ${randomUUID()}` },
  });
  return dept.id;
}

describe('DAT-016 — name-uniqueness UNIQUE indexes (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('departments: rejects a second row with an identical name (departments_name_key)', async () => {
    const name = `DAT-016 dept ${randomUUID()}`;
    await insertDepartment(name); // first row: accepted
    await expectUniqueViolation(insertDepartment(name), 'Key (name)=');
  });

  it('services: rejects a second row with the same name in the SAME department (services_departmentId_name_key)', async () => {
    const departmentId = await makeDepartment();
    const name = `DAT-016 svc ${randomUUID()}`;
    await insertService(departmentId, name); // first row: accepted
    await expectUniqueViolation(
      insertService(departmentId, name),
      'Key ("departmentId", name)=',
    );
  });

  it('services: ACCEPTS the same name in DIFFERENT departments (composite, not global)', async () => {
    const deptA = await makeDepartment();
    const deptB = await makeDepartment();
    const sharedName = `DAT-016 shared ${randomUUID()}`;
    // Same service name, two distinct departments — both must succeed. This is the
    // test that proves the index is composite ([departmentId, name]) and NOT a global
    // unique on services.name.
    await insertService(deptA, sharedName);
    await insertService(deptB, sharedName);
    const count = await db.service.count({ where: { name: sharedName } });
    expect(count).toBe(2);
  });

  it('indexes carry the exact Prisma-convention names (drift-clean migrate dev sees no diff)', async () => {
    // The hand-authored migration is byte-equivalent to `migrate dev` output only if
    // the index names match Prisma's <table>_<col[_col]>_key convention. Locking the
    // names here guards a future drift-clean `migrate dev` from generating a shadow diff.
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE indexname IN ('departments_name_key', 'services_departmentId_name_key')
       ORDER BY indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual([
      'departments_name_key',
      'services_departmentId_name_key',
    ]);
  });
});
