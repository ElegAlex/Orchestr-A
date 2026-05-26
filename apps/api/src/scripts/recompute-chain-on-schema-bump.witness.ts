/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { PrismaClient } from 'database';
import {
  computeRowHash,
  stableStringify,
} from '../audit/audit-persistence.service';
import {
  IMMUTABILITY_TRIGGER,
  recomputeChainOnSchemaBump,
} from './recompute-chain-on-schema-bump';

/**
 * DAT-021 — direct-DB witness for the schemaVersion bump + GIN index + full-chain
 * recompute.
 *
 * NOT a vitest spec: the repo's vitest harness globally mocks `database`, so the
 * real migration (schemaVersion column, GIN index, immutability trigger), the
 * DISABLE/ENABLE DDL, the advisory lock and the chain recompute can only be
 * exercised against a real Postgres. This is the faithful test — run against a
 * throwaway DB whose schema is the actual Prisma migration set.
 *
 * Runner (operator / CI): create a throwaway DB, `prisma migrate deploy` into it,
 * point DATABASE_URL at it, run `node dist/scripts/recompute-chain-on-schema-bump.witness.js`,
 * drop it. Exits 0 on all-pass, 1 on any failure.
 *
 *   W-3  the GIN index audit_logs_payload_gin exists USING gin (payload jsonb_path_ops),
 *        and a containment query (payload @> '…') is plannable against it.
 *   W-4  seed a chain whose rowHashes were computed WITHOUT schemaVersion (the
 *        post-migration / pre-recompute state). Assert the chain is INVALID under
 *        the new computeRowHash (FAIL-pre). Run the recompute. Assert every rowHash
 *        now recomputes WITH schemaVersion folded in (PASS-post), and the trigger
 *        is re-ENABLED. This mirrors the prod transition: migration adds the column
 *        + default → stale hashes → recompute fixes the chain.
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

async function readChain(prisma: PrismaClient): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT id, action, "entityType", "entityId", "actorId", "schemaVersion",
           "createdAt", payload, "prevHash", "rowHash"
    FROM audit_logs
    ORDER BY "createdAt" ASC, id ASC
  `;
}

/** Verify the chain under the CURRENT computeRowHash (which folds schemaVersion). */
function verifyChain(rows: Row[]): { ok: boolean; detail: string } {
  let prev: string | null = null;
  for (const r of rows) {
    if (r.prevHash !== prev) {
      return { ok: false, detail: `prevHash break at ${r.id}` };
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
      return { ok: false, detail: `rowHash mismatch at ${r.id}` };
    }
    prev = r.rowHash;
  }
  return { ok: true, detail: `${rows.length} rows chain-valid` };
}

/** The PRE-DAT-021 hash formula (no schemaVersion) — used only to seed "stale" rows. */
function legacyRowHash(row: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  prevHash: string | null;
}): string {
  const canonical = [
    row.action,
    row.entityType,
    row.entityId,
    row.actorId ?? '',
    row.createdAt.toISOString(),
    stableStringify(row.payload ?? null),
    row.prevHash ?? '',
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function seedStale(
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
  const rowHash = legacyRowHash({ ...row, actorId: null, prevHash });
  await prisma.auditLog.create({
    data: {
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: null,
      // schemaVersion left to the DB DEFAULT 1 — the post-migration state.
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
  return rows.length === 1 && rows[0].tgenabled === 'O';
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    // ---- W-3: GIN index exists with jsonb_path_ops --------------------------------
    console.log('W-3 — JSONB GIN index (payload jsonb_path_ops):');
    const idx = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'audit_logs_payload_gin'
    `;
    check('W-3 index audit_logs_payload_gin exists', idx.length === 1);
    const def = idx[0]?.indexdef ?? '';
    check(
      'W-3 index is USING gin (payload jsonb_path_ops)',
      /USING gin/i.test(def) && /jsonb_path_ops/i.test(def),
      def,
    );
    const svIdx = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE indexname = 'audit_logs_schemaVersion_idx'
    `;
    check('W-3 btree index on schemaVersion exists', svIdx.length === 1);

    const existing = await prisma.auditLog.count();
    if (existing > 0) {
      throw new Error(
        `witness expects a virgin throwaway audit_logs; found ${existing} rows.`,
      );
    }

    // ---- W-4: stale chain → recompute → valid -------------------------------------
    console.log('W-4 — full-chain recompute folds schemaVersion:');
    const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 8, min, 0, 0));
    const h0 = await seedStale(prisma, null, {
      action: 'LOGIN_SUCCESS',
      entityType: 'Auth',
      entityId: 'user-0',
      createdAt: t(0),
      payload: { success: true, timestamp: t(0).toISOString() },
    });
    const h1 = await seedStale(prisma, h0, {
      action: 'PROJECT_ARCHIVED',
      entityType: 'Project',
      entityId: 'proj-1',
      createdAt: t(1),
      payload: { archivedAt: t(1).toISOString() },
    });
    await seedStale(prisma, h1, {
      action: 'DATA_EXPORTED',
      entityType: 'Export',
      entityId: 'export-2',
      createdAt: t(2),
      payload: {
        format: 'ics',
        scope: 'planning',
        recordCount: 7,
        nested: { z: 1, a: [3, 2, 1], u: 'é"\\/\n' },
      },
    });

    const before = await readChain(prisma);
    check('W-4 three rows seeded', before.length === 3, `got ${before.length}`);
    // FAIL-pre: with stale (no-schemaVersion) hashes, the chain is INVALID under the
    // current computeRowHash.
    const vBefore = verifyChain(before);
    check(
      'W-4 (FAIL-pre) stale chain is INVALID under schemaVersion-folded hash',
      !vBefore.ok,
      vBefore.detail,
    );

    const result = await recomputeChainOnSchemaBump({ prisma, dryRun: false });
    check('W-4 recomputed all 3 rows', result.recomputedCount === 3, `got ${result.recomputedCount}`);
    check('W-4 in-tx verify passed', result.verified === true);

    const after = await readChain(prisma);
    const vAfter = verifyChain(after);
    check('W-4 (PASS-post) chain valid with schemaVersion folded in', vAfter.ok, vAfter.detail);
    check('W-4 every row schemaVersion=1', after.every((r) => r.schemaVersion === 1));
    check('W-4 trigger ENABLED after run', await triggerEnabled(prisma));

    // ---- W-6: containment query is plannable against the GIN index ----------------
    console.log('W-6 — containment query plan (documented, not asserted):');
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN SELECT * FROM audit_logs WHERE payload @> '{"scope":"planning"}'`,
    );
    console.log(plan.map((p) => `    ${p['QUERY PLAN']}`).join('\n'));
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
