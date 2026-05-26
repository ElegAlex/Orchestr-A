import { computeRowHash } from './audit-persistence.service';

/**
 * Shared audit-chain recompute primitive (extracted DAT-021).
 *
 * Both one-shot maintenance scripts re-hash a contiguous tail of `audit_logs`:
 *   - AUD-READ-001 (`normalize-action-codes.ts`) after rewriting one action code,
 *     anchored at the first row carrying the legacy code;
 *   - DAT-021 (`recompute-chain-on-schema-bump.ts`) after the schemaVersion
 *     backfill changed EVERY row's hash input, anchored at the genesis row (=> the
 *     whole chain is rehashed; the OBS-002 SQL-canonical "sealed legacy segment"
 *     is retired and the entire chain becomes uniformly computeRowHash-canonical).
 *
 * The chain order is deterministic `(createdAt ASC, id ASC)`. Both callers share
 * the actual hash math, so it lives here ONCE and imports `computeRowHash` from
 * the write path — the hash is NEVER reimplemented (write-time / migration-time
 * divergence would silently desync the chain).
 *
 * Caller contract: this function issues `UPDATE`s on `audit_logs`, so the OBS-002
 * immutability trigger (`audit_logs_no_update_delete`) MUST already be disabled by
 * the caller within the same transaction, and the caller MUST already hold the
 * `audit_logs_chain` advisory lock. This primitive does neither — it does the
 * recompute walk + an in-transaction re-verification + a predecessor-untouched
 * assertion, and nothing else.
 */

/** Row shape pulled for the recompute walk. */
export interface ChainRow {
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
}

/** Minimal transaction-client surface used here (satisfied by Prisma's
 *  TransactionClient and by a raw PrismaClient for the direct-DB witness). */
export interface ChainTxClient {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
}

export interface RecomputeResult {
  /** Rows whose prevHash/rowHash were recomputed (the anchor row + all after it). */
  recomputedCount: number;
  /** Whether the in-transaction chain re-verification passed. */
  verified: boolean;
}

/**
 * Recompute prevHash + rowHash for every row from `from` (inclusive) to the tail,
 * in chain order, anchoring on the (untouched) stored rowHash of the row
 * immediately before `from`. Then re-read the segment and assert every stored
 * hash recomputes, and that the predecessor row was not modified.
 *
 * @param from the first row to rehash, in (createdAt, id) order. Pass the genesis
 *             row to rehash the entire chain (anchorPrevHash resolves to null).
 * @throws if the post-walk verification fails (off-by-one / logic error) — the
 *         caller's transaction then rolls back, re-enabling the trigger.
 */
export async function recomputeChainFrom(
  tx: ChainTxClient,
  from: { id: string; createdAt: Date },
): Promise<RecomputeResult> {
  // Anchor: the row immediately BEFORE `from` in chain order. Its stored rowHash
  // becomes the opaque prevHash of `from` and must remain UNTOUCHED.
  const predRows = await tx.$queryRaw<Array<{ id: string; rowHash: string }>>`
    SELECT id, "rowHash" FROM audit_logs
    WHERE ("createdAt", id) < (${from.createdAt}, ${from.id})
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 1
  `;
  const anchorPrevHash = predRows.length > 0 ? predRows[0].rowHash : null;
  const predecessor = predRows.length > 0 ? predRows[0] : null;

  const rows = await tx.$queryRaw<ChainRow[]>`
    SELECT id, action, "entityType", "entityId", "actorId", "schemaVersion",
           "createdAt", payload, "prevHash", "rowHash"
    FROM audit_logs
    WHERE ("createdAt", id) >= (${from.createdAt}, ${from.id})
    ORDER BY "createdAt" ASC, id ASC
  `;

  let prevHash = anchorPrevHash;
  for (const row of rows) {
    const newRowHash = computeRowHash({
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      payload: row.payload,
      prevHash,
    });
    await tx.$executeRaw`
      UPDATE audit_logs SET "prevHash" = ${prevHash}, "rowHash" = ${newRowHash}
      WHERE id = ${row.id}
    `;
    prevHash = newRowHash;
  }

  // In-transaction verification: re-read the segment fresh and assert every stored
  // rowHash recomputes from its own fields + (new) prevHash. Catches a walk error
  // before commit.
  const verifyRows = await tx.$queryRaw<ChainRow[]>`
    SELECT id, action, "entityType", "entityId", "actorId", "schemaVersion",
           "createdAt", payload, "prevHash", "rowHash"
    FROM audit_logs
    WHERE ("createdAt", id) >= (${from.createdAt}, ${from.id})
    ORDER BY "createdAt" ASC, id ASC
  `;
  let expectedPrev = anchorPrevHash;
  for (const row of verifyRows) {
    if (row.prevHash !== expectedPrev) {
      throw new Error(
        `[recompute-chain] chain verify failed at row ${row.id}: prevHash mismatch`,
      );
    }
    const expected = computeRowHash({
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      payload: row.payload,
      prevHash: row.prevHash,
    });
    if (row.rowHash !== expected) {
      throw new Error(
        `[recompute-chain] chain verify failed at row ${row.id}: rowHash mismatch`,
      );
    }
    expectedPrev = row.rowHash;
  }

  // Guard against a tuple-comparison off-by-one: the predecessor must be exactly
  // as it was — we must NOT have rewritten any sealed prefix row.
  if (predecessor) {
    const afterPred = await tx.$queryRaw<Array<{ rowHash: string }>>`
      SELECT "rowHash" FROM audit_logs WHERE id = ${predecessor.id}
    `;
    if (
      afterPred.length !== 1 ||
      afterPred[0].rowHash !== predecessor.rowHash
    ) {
      throw new Error(
        `[recompute-chain] predecessor row ${predecessor.id} was unexpectedly modified`,
      );
    }
  }

  return { recomputedCount: rows.length, verified: true };
}
