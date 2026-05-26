/* eslint-disable no-console */
import { PrismaClient } from 'database';
import {
  AuditPersistenceService,
  computeRowHash,
} from '../audit/audit-persistence.service';
import type { PrismaService } from '../prisma/prisma.service';
import { emitSystemBackfill } from './system-backfill-audit';
import {
  FROM_VALUE,
  IMMUTABILITY_TRIGGER,
  type NormalizeResult,
  normalizeActionCodes,
  SCRIPT_NAME,
  TO_VALUE,
} from './normalize-action-codes';

/**
 * AUD-READ-001 — direct-DB witness for normalize-action-codes.
 *
 * NOT a vitest spec: the repo's vitest harness globally mocks the `database` module,
 * so the immutability trigger, the DISABLE/ENABLE DDL, the advisory lock and the real
 * hash-chain recompute CANNOT be exercised under vitest. This is the faithful test —
 * run against a real, throwaway Postgres whose schema is the actual Prisma migration
 * set (so the real `audit_logs_no_update_delete` trigger is present).
 *
 * Runner (operator / CI): create a throwaway DB, `prisma migrate deploy` into it,
 * point DATABASE_URL at it, run `node dist/scripts/normalize-action-codes.witness.js`,
 * then drop it. Exits 0 on all-pass, 1 on any failure.
 *
 *   W-1  seed A(PASSWORD_RESET_ADMIN)/B(LOGIN_SUCCESS)/C(PASSWORD_RESET_ADMIN)
 *        + D(complex nested payload) via the write-time hash path; chain valid.
 *   W-2  run → 2 rows (A,C) → TO_VALUE; all rows recomputed; chain verifies; trigger ENABLED.
 *   W-3  idempotency: 2nd run → 0 updated, 0 recomputed; chain still valid.
 *   W-4  post-run direct UPDATE on a row raises the immutability exception.
 *   W-5  two SYSTEM_BACKFILL rows (phase STARTED + COMPLETED) after the first run.
 *   W-6  the complex/nested payload round-trips jsonb ↔ stableStringify through recompute
 *        (covered by D being in the chain at W-1 and W-2).
 */

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

type Row = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  schemaVersion: number;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  prevHash: string | null;
  rowHash: string;
};

/** Read the full chain in deterministic order. */
async function readChain(prisma: PrismaClient): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT id, action, "entityType", "entityId", "actorId", "schemaVersion",
           "createdAt", payload, "prevHash", "rowHash"
    FROM audit_logs
    ORDER BY "createdAt" ASC, id ASC
  `;
}

/** Recompute the whole chain from genesis and assert every stored rowHash matches. */
function verifyChain(rows: Row[]): { ok: boolean; detail: string } {
  let prev: string | null = null;
  for (const r of rows) {
    if (r.prevHash !== prev) {
      return { ok: false, detail: `prevHash break at ${r.id} (action=${r.action})` };
    }
    const expected = computeRowHash({
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorId: r.actorId,
      schemaVersion: r.schemaVersion,
      createdAt: r.createdAt,
      payload: r.payload,
      prevHash: r.prevHash,
    });
    if (r.rowHash !== expected) {
      return { ok: false, detail: `rowHash mismatch at ${r.id} (action=${r.action})` };
    }
    prev = r.rowHash;
  }
  return { ok: true, detail: `${rows.length} rows chain-valid` };
}

/** Seed one row directly (INSERT bypasses the enum-only write API; the column is text). */
async function seed(
  prisma: PrismaClient,
  prevHash: string | null,
  row: {
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    payload: Record<string, unknown> | null;
  },
): Promise<string> {
  // DAT-021 — rows get schemaVersion=1 (the DB column default); the seed hash must
  // fold the same version the recompute walk will read back.
  const rowHash = computeRowHash({
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorId: null,
    schemaVersion: 1,
    createdAt: row.createdAt,
    payload: row.payload,
    prevHash,
  });
  await prisma.auditLog.create({
    data: {
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: null,
      schemaVersion: 1,
      payload: row.payload === null ? undefined : (row.payload as object),
      prevHash,
      rowHash,
      createdAt: row.createdAt,
    },
  });
  return rowHash;
}

async function triggerEnabled(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ tgenabled: string }>>`
    SELECT tgenabled FROM pg_trigger WHERE tgname = ${IMMUTABILITY_TRIGGER}
  `;
  // 'O' = enabled (origin), 'D' = disabled.
  return rows.length === 1 && rows[0].tgenabled === 'O';
}

async function countSystemBackfill(
  prisma: PrismaClient,
): Promise<{ total: number; phases: string[] }> {
  const rows = await prisma.$queryRaw<Array<{ phase: string }>>`
    SELECT payload->>'phase' AS phase FROM audit_logs
    WHERE action = 'SYSTEM_BACKFILL'
    ORDER BY "createdAt" ASC, id ASC
  `;
  return { total: rows.length, phases: rows.map((r) => r.phase) };
}

/** Replicates the CLI main() sequence: STARTED emit → normalize → COMPLETED emit. */
async function runOnce(
  prisma: PrismaClient,
  audit: AuditPersistenceService,
): Promise<NormalizeResult> {
  await emitSystemBackfill(audit, 'STARTED', {
    script: SCRIPT_NAME,
    fromValue: FROM_VALUE,
    toValue: TO_VALUE,
    dryRun: false,
  });
  const result = await normalizeActionCodes({ prisma, dryRun: false });
  await emitSystemBackfill(audit, 'COMPLETED', {
    script: SCRIPT_NAME,
    fromValue: FROM_VALUE,
    toValue: TO_VALUE,
    affectedCount: result.affectedCount,
    dryRun: false,
  });
  return result;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const audit = new AuditPersistenceService(prisma as unknown as PrismaService);

  try {
    const existing = await prisma.auditLog.count();
    if (existing > 0) {
      throw new Error(
        `witness expects a virgin throwaway audit_logs; found ${existing} rows. ` +
          `Point DATABASE_URL at a freshly-migrated throwaway DB.`,
      );
    }

    // ---- W-1: seed a genesis chain (A, B, C, D) ------------------------------------
    const t = (min: number) =>
      new Date(Date.UTC(2026, 0, 1, 8, min, 0, 0));
    const hA = await seed(prisma, null, {
      action: FROM_VALUE,
      entityType: 'User',
      entityId: 'user-A',
      createdAt: t(0),
      payload: { targetUserId: 'user-A', by: 'admin-1' },
    });
    const hB = await seed(prisma, hA, {
      action: 'LOGIN_SUCCESS',
      entityType: 'Auth',
      entityId: 'user-B',
      createdAt: t(1),
      payload: { ip: '10.0.0.1' },
    });
    const hC = await seed(prisma, hB, {
      action: FROM_VALUE,
      entityType: 'User',
      entityId: 'user-C',
      createdAt: t(2),
      payload: { targetUserId: 'user-C', by: 'admin-2' },
    });
    // W-6: deliberately complex payload — nested object, array, number, float, large
    // int, boolean, null, unicode + escape chars — to stress jsonb ↔ stableStringify.
    await seed(prisma, hC, {
      action: 'DATA_EXPORTED',
      entityType: 'SystemMaintenance',
      entityId: 'export-1',
      createdAt: t(3),
      payload: {
        nested: { z: 1, a: [3, 2, 1], mid: 'é"\\/\n\t', flag: true, none: null },
        count: 42,
        ratio: 3.5,
        big: 9007199254740991,
        tags: ['gamma', 'alpha', 'beta'],
      },
    });

    console.log('W-1 — seeded chain (A,B,C,D) valid:');
    const seeded = await readChain(prisma);
    check('W-1 four rows seeded', seeded.length === 4, `got ${seeded.length}`);
    const v1 = verifyChain(seeded);
    check('W-1 seeded chain verifies (incl. complex payload D / W-6)', v1.ok, v1.detail);

    // ---- W-2: first run ------------------------------------------------------------
    console.log('W-2 — first normalization run:');
    const r1 = await runOnce(prisma, audit);
    check('W-2 affectedCount === 2 (A,C)', r1.affectedCount === 2, `got ${r1.affectedCount}`);

    const afterFrom = await prisma.auditLog.count({ where: { action: FROM_VALUE } });
    check('W-2 zero legacy rows remain', afterFrom === 0, `count(${FROM_VALUE})=${afterFrom}`);
    const afterTo = await prisma.auditLog.count({ where: { action: TO_VALUE } });
    check('W-2 two canonical rows present', afterTo === 2, `count(${TO_VALUE})=${afterTo}`);

    const chain2 = await readChain(prisma);
    const v2 = verifyChain(chain2);
    check('W-2 full chain verifies post-recompute (incl. STARTED row re-hashed)', v2.ok, v2.detail);
    check('W-2 recomputed the whole tail', r1.recomputedCount >= 4, `recomputed=${r1.recomputedCount}`);
    check('W-2 trigger ENABLED after run', await triggerEnabled(prisma));
    check('W-2 in-tx verify passed', r1.verified === true, `verified=${r1.verified}`);

    // ---- W-5: SYSTEM_BACKFILL trace after the first run ----------------------------
    console.log('W-5 — SYSTEM_BACKFILL trace:');
    const sb = await countSystemBackfill(prisma);
    check('W-5 exactly 2 SYSTEM_BACKFILL rows', sb.total === 2, `got ${sb.total}`);
    check(
      'W-5 phases STARTED + COMPLETED',
      sb.phases.includes('STARTED') && sb.phases.includes('COMPLETED'),
      sb.phases.join(','),
    );

    // ---- W-4: immutability still enforced ------------------------------------------
    console.log('W-4 — immutability trigger blocks direct UPDATE:');
    const targetId = chain2.find((r) => r.action === 'LOGIN_SUCCESS')?.id;
    let blocked = false;
    let errMsg = '';
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE audit_logs SET action = 'TAMPERED' WHERE id = $1`,
        targetId,
      );
    } catch (e) {
      blocked = true;
      errMsg = e instanceof Error ? e.message : String(e);
    }
    check('W-4 direct UPDATE raised', blocked, errMsg.split('\n')[0].slice(0, 120));

    // ---- W-3: idempotency ----------------------------------------------------------
    console.log('W-3 — idempotency (second run):');
    const r2 = await runOnce(prisma, audit);
    check('W-3 affectedCount === 0', r2.affectedCount === 0, `got ${r2.affectedCount}`);
    check('W-3 recomputedCount === 0', r2.recomputedCount === 0, `got ${r2.recomputedCount}`);
    const chain3 = await readChain(prisma);
    const v3 = verifyChain(chain3);
    check('W-3 chain still verifies after idempotent run', v3.ok, v3.detail);
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  if (failures > 0) {
    console.error(`WITNESS FAILED: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('WITNESS PASSED: all checks green.');
  process.exit(0);
}

main().catch((err) => {
  console.error('witness crashed:', err);
  process.exit(1);
});
