import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditAction } from './audit-action.enum';
import { validatePayloadForAction } from './payload-schemas';

/**
 * DAT-021 — the payload schema version of every row this build writes. The Zod
 * registry (`payload-schemas.ts`) describes the v1 shape; a future v2 would bump
 * this and dispatch validation per-row on the stored value. Folded into the hash
 * (see `computeRowHash`) so schema-version drift propagates to `rowHash` and
 * cannot be backdated without breaking the chain.
 */
export const CURRENT_AUDIT_SCHEMA_VERSION = 1;

/**
 * Deterministic, stable-key JSON serialization. Object keys are sorted
 * recursively so the same logical payload always serializes to the same
 * string — inconsistent serialization would silently break the hash chain.
 * Inlined (no fast-json-stable-stringify dependency) to keep the audit module
 * dependency-free.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
      .join(',') +
    '}'
  );
}

/**
 * Computes the integrity hash for one audit row (OBS-002 / DAT-009).
 *
 *   rowHash = sha256( action | entityType | entityId | actorId? |
 *                     schemaVersion | createdAt.toISOString() |
 *                     stableStringify(payload) | prevHash? )
 *
 * sha256, hex, lowercase, no truncation. Empty string stands in for a NULL
 * actorId / prevHash. Exported so an external verifier (production runbook,
 * chain-audit script) can recompute and compare against stored values.
 *
 * DAT-021 — `schemaVersion` is folded into the canonical concat (positioned
 * between actorId and createdAt) so a row's payload-schema version is part of
 * its integrity hash. Without this, a schema-version edit on a stored row would
 * leave `rowHash` unchanged, defeating tamper detection on that metadata. Adding
 * the column to every existing row therefore changes every `rowHash` and
 * mandates a full-chain recompute (scripts/recompute-chain-on-schema-bump.ts).
 */
export function computeRowHash(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  schemaVersion: number;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  prevHash: string | null;
}): string {
  const canonical = [
    input.action,
    input.entityType,
    input.entityId,
    input.actorId ?? '',
    String(input.schemaVersion),
    input.createdAt.toISOString(),
    stableStringify(input.payload ?? null),
    input.prevHash ?? '',
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * AuditPersistenceService — persiste les événements dans la table `audit_logs`.
 *
 * Distinct de AuditService (logging console SecurityAudit) : ce service écrit
 * en base pour l'audit trail métier (transitions de statut, actions système).
 *
 * OBS-002 / DAT-009 — chaque INSERT :
 *  - se sérialise sur un advisory lock transactionnel (`pg_advisory_xact_lock`)
 *    pour garantir un journal totalement ordonné (chaîne d'intégrité linéaire) ;
 *  - lit le `rowHash` de la dernière ligne (prevHash), calcule son propre
 *    `rowHash` sha256, et fige `actorEmail`/`actorLabel` depuis la table users.
 *
 * W2.4 — Orchestr'A
 */
@Injectable()
export class AuditPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * DAT-006 — tx-aware overload contract:
   *   - No `tx` supplied (default): opens its own `prisma.$transaction`, acquires
   *     the advisory lock inside it, and commits independently.
   *   - Caller-supplied `tx` (Prisma.TransactionClient): the advisory lock is
   *     acquired on that transaction, so it stays held until the outer transaction
   *     commits, making the project mutation and the audit insert fully atomic.
   *
   * Important: when `tx` is supplied the advisory lock is acquired on the caller's
   * transaction, ensuring the lock holds until the outer COMMIT.  The caller MUST
   * NOT commit the outer transaction before this method returns.
   */
  async log(
    event: {
      // OBS-024 — AuditAction enum ONLY. The compile-time witness
      // (`audit-action.compile-witness.ts`) guards against regressing this to
      // `string`. The enum's string value is what lands in `audit_logs.action`,
      // so the persisted codes are unchanged.
      action: AuditAction;
      entityType: string;
      entityId: string;
      actorId?: string | null;
      payload?: Record<string, unknown> | null;
    },
    outerTx?: Prisma.TransactionClient,
  ): Promise<void> {
    const actorId = event.actorId ?? null;
    const payload = event.payload ?? null;

    // DAT-021 — validation gate. Runs BEFORE the transaction (it needs no DB
    // connection): a malformed payload fails fast without opening a tx or
    // holding the chain advisory lock. Throws AuditPayloadValidationError — the
    // write is rejected, no partial row. A present payload whose top-level shape
    // is unexpected for `action` (per the Zod registry) never reaches the chain.
    validatePayloadForAction(event.action, payload);

    const schemaVersion = CURRENT_AUDIT_SCHEMA_VERSION;
    // createdAt is generated here (not via @default(now())) so the value we hash
    // is exactly the value stored — the chain must be recomputable from the row.
    const createdAt = new Date();

    const write = async (tx: Prisma.TransactionClient) => {
      // Totally order all audit inserts on a single transaction-scoped advisory
      // lock. The contract's "SELECT … FOR UPDATE on the prior row" option forks
      // the chain under READ COMMITTED: lock release re-checks the locked row via
      // EvalPlanQual, NOT the result set, so a concurrent insert of the next row
      // is missed and two rows chain off the same prevHash. The advisory lock is
      // the minimum-complexity correct alternative; it auto-releases at COMMIT so
      // the window is one short read + one insert.
      // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns `void`, which
      // $queryRaw cannot deserialize — $executeRaw runs it for the side effect
      // and returns only an affected-row count.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))`;

      const prevRows = await tx.$queryRaw<Array<{ rowHash: string }>>`
        SELECT "rowHash" FROM audit_logs ORDER BY "createdAt" DESC, id DESC LIMIT 1
      `;
      const prevHash = prevRows.length > 0 ? prevRows[0].rowHash : null;

      // Snapshot the actor's identity at log time (RGPD: survives user deletion,
      // additive to actorId which stays as the FK reference).
      let actorEmail: string | null = null;
      let actorLabel: string | null = null;
      if (actorId) {
        const user = await tx.user.findUnique({
          where: { id: actorId },
          select: { email: true, firstName: true, lastName: true },
        });
        if (user) {
          actorEmail = user.email ?? null;
          const label = [user.firstName, user.lastName]
            .filter((p) => p && p.trim().length > 0)
            .join(' ')
            .trim();
          actorLabel = label.length > 0 ? label : null;
        }
      }

      const rowHash = computeRowHash({
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId,
        schemaVersion,
        createdAt,
        payload,
        prevHash,
      });

      await tx.auditLog.create({
        data: {
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          actorId,
          actorEmail,
          actorLabel,
          schemaVersion,
          payload: (payload as Prisma.InputJsonValue) ?? undefined,
          prevHash,
          rowHash,
          createdAt,
        },
      });
    };

    // DAT-006 — if the caller supplied an outer transaction client, execute the
    // write directly on it (advisory lock is acquired inside the caller's tx, so
    // it holds until the outer COMMIT, making the whole operation atomic).
    // Otherwise open a self-contained transaction as before.
    if (outerTx) {
      await write(outerTx);
    } else {
      await this.prisma.$transaction(write);
    }
  }
}
