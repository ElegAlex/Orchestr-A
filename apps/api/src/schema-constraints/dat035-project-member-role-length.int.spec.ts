import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-035 — real-DB witness for the role-length CHECK constraint added in
 * migration 20260528160000_dat035_project_member_role_length.
 *
 *   ALTER TABLE project_members ADD CONSTRAINT project_members_role_length_ck
 *     CHECK (char_length("role") BETWEEN 1 AND 100);
 *
 * Structural floor only (length bounds) — the value space stays open per the
 * audit's free-form decision (DAT-012 bail rationale). The DTO `AddMemberDto`
 * / `UpdateMemberDto` carries the layer-of-rejection partner (trim + 400);
 * this witness pins the DB floor directly via raw SQL so the CHECK signature
 * (SQLSTATE 23514 + constraint name) is visible verbatim.
 *
 * Whitespace-only is intentionally accepted by the CHECK (the DTO trims
 * before write; defense-in-depth at the DB layer doesn't second-guess that
 * canonicalization decision). A separate test pins this design contract so
 * a future reviewer doesn't tighten the CHECK to `length(btrim(role)) >= 1`
 * without first updating that contract.
 *
 * Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

async function expectCheckViolation(
  insert: Promise<unknown>,
  constraint: string,
): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected a check_violation (23514) but the INSERT was accepted',
  ).toMatch(/23514/);
  expect(message).toContain(constraint);
}

describe('DAT-035 — project_members.role length CHECK (real DB)', () => {
  let projectId: string;
  const userPool: string[] = [];
  let userCursor = 0;

  beforeAll(async () => {
    await db.$connect();
    const project = await db.project.create({
      data: { name: `DAT-035 project ${randomUUID()}` },
    });
    projectId = project.id;
    // The (projectId, userId) UNIQUE means each row needs a fresh user; pre-create
    // enough users for all assertions in this suite (6 INSERTs total).
    for (let i = 0; i < 6; i++) {
      const u = await db.user.create({
        data: {
          email: `dat035-${i}-${randomUUID()}@witness.test`,
          login: `dat035-${i}-${randomUUID()}`,
          passwordHash: 'x',
          firstName: 'Dat035',
          lastName: `Witness${i}`,
        },
      });
      userPool.push(u.id);
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function nextUser(): string {
    if (userCursor >= userPool.length) {
      throw new Error('DAT-035 witness: ran out of pre-created users');
    }
    return userPool[userCursor++];
  }

  function insertMember(role: string): Promise<unknown> {
    return db.$executeRawUnsafe(
      `INSERT INTO project_members (id, "projectId", "userId", role)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      projectId,
      nextUser(),
      role,
    );
  }

  // Negative — empty string. The dominant audit failure mode (a careless write
  // of role = '' would have landed silently pre-fix).
  it('rejects role = "" (project_members_role_length_ck, lower bound)', async () => {
    await expectCheckViolation(
      insertMember(''),
      'project_members_role_length_ck',
    );
  });

  // Negative — 101 chars. Pins the upper bound at 100 (anything >100 rejects).
  it('rejects role > 100 chars (project_members_role_length_ck, upper bound)', async () => {
    await expectCheckViolation(
      insertMember('x'.repeat(101)),
      'project_members_role_length_ck',
    );
  });

  // Positive — typical institutional label (16 chars; well within bounds).
  it('accepts the canonical leader label "Chef de projet"', async () => {
    await expect(insertMember('Chef de projet')).resolves.toBe(1);
  });

  // Positive — boundary upper (exactly 100 chars).
  it('accepts role at exactly 100 chars (inclusive upper bound)', async () => {
    await expect(insertMember('x'.repeat(100))).resolves.toBe(1);
  });

  // Positive — boundary lower (single char). Cheap-and-cheerful seed default
  // could in principle be 1 char; the CHECK admits it.
  it('accepts role at exactly 1 char (inclusive lower bound)', async () => {
    await expect(insertMember('A')).resolves.toBe(1);
  });

  // Design-contract pin: whitespace-only is NOT a CHECK concern (DTO trims).
  // This test exists to make a future reviewer who would tighten the CHECK
  // (e.g. to `length(btrim(role)) >= 1`) notice that whitespace-only is an
  // intentional design point and update the DTO contract / migration comment
  // at the same time.
  it('accepts whitespace-only role at the DB layer (DTO trims at the API boundary — design contract)', async () => {
    await expect(insertMember('   ')).resolves.toBe(1);
  });
});
