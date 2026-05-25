import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

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
 *                     createdAt.toISOString() | stableStringify(payload) | prevHash? )
 *
 * sha256, hex, lowercase, no truncation. Empty string stands in for a NULL
 * actorId / prevHash. Exported so an external verifier (production runbook,
 * chain-audit script) can recompute and compare against stored values.
 */
export function computeRowHash(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  prevHash: string | null;
}): string {
  const canonical = [
    input.action,
    input.entityType,
    input.entityId,
    input.actorId ?? '',
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

  async log(event: {
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    const actorId = event.actorId ?? null;
    const payload = event.payload ?? null;
    // createdAt is generated here (not via @default(now())) so the value we hash
    // is exactly the value stored — the chain must be recomputable from the row.
    const createdAt = new Date();

    await this.prisma.$transaction(async (tx) => {
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
          payload: (payload as Prisma.InputJsonValue) ?? undefined,
          prevHash,
          rowHash,
          createdAt,
        },
      });
    });
  }
}
