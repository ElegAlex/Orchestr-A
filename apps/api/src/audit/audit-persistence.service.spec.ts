import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditPersistenceService } from './audit-persistence.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from './audit-action.enum';
import {
  AUDIT_PAYLOAD_SCHEMAS,
  AuditPayloadValidationError,
  validatePayloadForAction,
} from './payload-schemas';

// ---------------------------------------------------------------------------
// Independent re-implementation of the documented hash-chain formula
// (decision #2 of the OBS-002 + DAT-009 contract). Kept deliberately separate
// from the service code: the witness must recompute from stored fields and
// catch any disconnect (tamper signal). If this helper and the service drift,
// the round-trip assertions fail — which is the point.
// ---------------------------------------------------------------------------
function stableStringify(value: unknown): string {
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

function recomputeRowHash(row: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null | undefined;
  schemaVersion: number;
  createdAt: Date;
  payload: Record<string, unknown> | null | undefined;
  prevHash: string | null | undefined;
}): string {
  const canonical = [
    row.action,
    row.entityType,
    row.entityId,
    row.actorId ?? '',
    String(row.schemaVersion),
    row.createdAt.toISOString(),
    stableStringify(row.payload ?? null),
    row.prevHash ?? '',
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

describe('AuditPersistenceService', () => {
  let service: AuditPersistenceService;

  // Mutable chain state: simulates the audit_logs table for the prior-row read.
  let chainTip: { rowHash: string } | null;
  // Records every create() data arg, in insertion order.
  let created: Array<Record<string, unknown>>;
  // Stubbed users table for actor-snapshot lookups.
  let users: Record<
    string,
    { email: string | null; firstName: string | null; lastName: string | null }
  >;

  const txMock = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(async () => (chainTip ? [chainTip] : [])),
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          users[where.id] ?? null,
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        // advance the simulated chain tip so the next log() reads this rowHash
        if (typeof data.rowHash === 'string') {
          chainTip = { rowHash: data.rowHash };
        }
        return { id: `log-${created.length}`, ...data };
      }),
    },
  };

  const mockPrismaService = {
    // Interactive transaction: run the callback against the tx mock.
    $transaction: vi.fn(
      async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
    ),
  };

  beforeEach(async () => {
    chainTip = null;
    created = [];
    users = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditPersistenceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditPersistenceService>(AuditPersistenceService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('log — basic persistence (existing contract)', () => {
    it('1. persiste action/entityType/entityId/actorId/payload', async () => {
      await service.log({
        action: 'ASSIGNMENT_STATUS_CHANGED',
        entityType: 'PredefinedTaskAssignment',
        entityId: 'assignment-1',
        actorId: 'user-1',
        payload: { before: 'NOT_DONE', after: 'DONE', reason: null },
      });

      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        action: 'ASSIGNMENT_STATUS_CHANGED',
        entityType: 'PredefinedTaskAssignment',
        entityId: 'assignment-1',
        actorId: 'user-1',
        payload: { before: 'NOT_DONE', after: 'DONE', reason: null },
      });
    });

    it('2. persiste actorId: null quand actorId est absent (événement système)', async () => {
      await service.log({
        action: 'SYSTEM_BACKFILL',
        entityType: 'SystemMaintenance',
        entityId: 'backfill-1',
      });

      expect(created[0].actorId).toBeNull();
    });

    it('3. ne crashe pas quand payload est absent', async () => {
      await expect(
        service.log({
          action: 'ASSIGNMENT_STATUS_CHANGED',
          entityType: 'PredefinedTaskAssignment',
          entityId: 'assignment-3',
          actorId: 'user-1',
        }),
      ).resolves.not.toThrow();
      expect(created[0].payload).toBeUndefined();
    });
  });

  // ===========================================================================
  // WITNESS W-c — hash chain (OBS-002 + DAT-009)
  // FAILS on master (log() persists no rowHash/prevHash), PASSES after the fix.
  // ===========================================================================
  describe('WITNESS W-c — hash chain', () => {
    it('persiste un rowHash sha256 hex (64 chars) sur chaque ligne', async () => {
      await service.log({
        action: 'LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId: 'user-1',
        actorId: 'user-1',
        // DAT-021 — LOGIN_SUCCESS routes the AuditService security envelope, so a
        // valid payload carries success + timestamp (the gate would reject a bare
        // { ip }). Hash mechanics are unaffected by the payload's exact shape.
        payload: { success: true, timestamp: new Date().toISOString(), ip: '10.0.0.1' },
      });

      expect(created[0].rowHash).toBeDefined();
      expect(created[0].rowHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('chaîne 3 lignes: prevHash[n] === rowHash[n-1], première ligne prevHash null', async () => {
      const events = [
        { action: 'A', entityType: 'Auth', entityId: 'e1', payload: { k: 1 } },
        {
          action: 'B',
          entityType: 'User',
          entityId: 'e2',
          payload: { z: 2, a: 1 },
        },
        { action: 'C', entityType: 'Leave', entityId: 'e3', payload: null },
      ];
      for (const ev of events) {
        await service.log(ev);
      }

      expect(created).toHaveLength(3);
      expect(created[0].prevHash).toBeNull();
      expect(created[1].prevHash).toBe(created[0].rowHash);
      expect(created[2].prevHash).toBe(created[1].rowHash);
    });

    it('rowHash stocké === recomputation indépendante depuis les champs (intégrité)', async () => {
      await service.log({
        action: 'LEAVE_APPROVED',
        entityType: 'Leave',
        entityId: 'leave-9',
        actorId: 'validator-1',
        payload: {
          after: { status: 'APPROVED' },
          before: { status: 'PENDING' },
        },
      });

      const row = created[0];
      const recomputed = recomputeRowHash({
        action: row.action as string,
        entityType: row.entityType as string,
        entityId: row.entityId as string,
        actorId: row.actorId as string | null,
        schemaVersion: row.schemaVersion as number,
        createdAt: row.createdAt as Date,
        payload: row.payload as Record<string, unknown> | null,
        prevHash: row.prevHash as string | null,
      });
      expect(row.rowHash).toBe(recomputed);
    });

    it('toute mutation du payload casse le rowHash recalculé (tamper signal)', async () => {
      await service.log({
        action: 'LEAVE_APPROVED',
        entityType: 'Leave',
        entityId: 'leave-9',
        actorId: 'validator-1',
        payload: { before: { status: 'PENDING' }, after: { status: 'APPROVED' } },
      });
      const row = created[0];
      const tampered = recomputeRowHash({
        action: row.action as string,
        entityType: row.entityType as string,
        entityId: row.entityId as string,
        actorId: row.actorId as string | null,
        schemaVersion: row.schemaVersion as number,
        createdAt: row.createdAt as Date,
        payload: { status: 'REJECTED' }, // mutated
        prevHash: row.prevHash as string | null,
      });
      expect(tampered).not.toBe(row.rowHash);
    });

    it('persiste createdAt explicitement (la valeur hachée doit égaler la valeur stockée)', async () => {
      await service.log({
        action: 'LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId: 'user-1',
        actorId: 'user-1',
      });
      expect(created[0].createdAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // WITNESS W-d — actor snapshot (DAT-009)
  // FAILS on master (no actorEmail/actorLabel columns populated).
  // ===========================================================================
  describe('WITNESS W-d — actor snapshot', () => {
    it('capture actorEmail + actorLabel depuis User au moment du log()', async () => {
      users['validator-1'] = {
        email: 'validator@cpam92.fr',
        firstName: 'Marie',
        lastName: 'Dupont',
      };

      await service.log({
        action: 'LEAVE_APPROVED',
        entityType: 'Leave',
        entityId: 'leave-1',
        actorId: 'validator-1',
        payload: { after: { status: 'APPROVED' } },
      });

      expect(created[0].actorEmail).toBe('validator@cpam92.fr');
      expect(created[0].actorLabel).toBe('Marie Dupont');
    });

    it('actorEmail/actorLabel null pour un événement système (actorId absent)', async () => {
      await service.log({
        action: 'SYSTEM_BACKFILL',
        entityType: 'SystemMaintenance',
        entityId: 'backfill-1',
      });

      expect(created[0].actorEmail).toBeNull();
      expect(created[0].actorLabel).toBeNull();
    });

    it('actorEmail/actorLabel null si actorId ne résout aucun User (suppression antérieure)', async () => {
      await service.log({
        action: 'LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId: 'ghost',
        actorId: 'deleted-user',
      });

      expect(created[0].actorEmail).toBeNull();
      expect(created[0].actorLabel).toBeNull();
    });
  });

  // ===========================================================================
  // WITNESS W-1 / W-2 — DAT-021 payload validation gate
  // FAILS on master (no validatePayloadForAction; malformed payloads accepted).
  // ===========================================================================
  describe('WITNESS W-1/W-2 — payload Zod validation gate', () => {
    it('W-1 — rejects a malformed payload for a registered action; no row inserted', async () => {
      await expect(
        service.log({
          action: AuditAction.LOGIN_SUCCESS,
          entityType: 'Auth',
          entityId: 'user-1',
          actorId: 'user-1',
          // LOGIN_SUCCESS expects the security envelope (success + timestamp).
          payload: { intentionally_malformed: true } as Record<string, unknown>,
        }),
      ).rejects.toBeInstanceOf(AuditPayloadValidationError);

      // The write is rejected BEFORE the transaction — no partial row.
      expect(created).toHaveLength(0);
    });

    it('W-2 — accepts a valid payload; row inserted with schemaVersion=1', async () => {
      await service.log({
        action: AuditAction.LOGIN_SUCCESS,
        entityType: 'Auth',
        entityId: 'user-1',
        actorId: 'user-1',
        payload: {
          success: true,
          timestamp: new Date().toISOString(),
          ip: '10.0.0.1',
        },
      });

      expect(created).toHaveLength(1);
      expect(created[0].schemaVersion).toBe(1);
    });

    it('every audit row persists schemaVersion (folded into the hash chain)', async () => {
      await service.log({
        action: AuditAction.SYSTEM_BACKFILL,
        entityType: 'SystemMaintenance',
        entityId: 'backfill-1',
      });
      expect(created[0].schemaVersion).toBe(1);
    });
  });

  // ===========================================================================
  // Payload registry unit tests (DAT-021 (c)) — the runtime half of the
  // exhaustive Record; the compile-time half is audit-payload-registry.compile-witness.ts.
  // ===========================================================================
  describe('AUDIT_PAYLOAD_SCHEMAS registry', () => {
    it('has a schema for every AuditAction enum member (runtime exhaustiveness)', () => {
      for (const action of Object.values(AuditAction)) {
        expect(AUDIT_PAYLOAD_SCHEMAS[action]).toBeDefined();
      }
    });

    it('accepts the observed shape of representative direct emitters', () => {
      expect(() =>
        validatePayloadForAction(AuditAction.USER_DELETED, {
          snapshot: { id: 'u1', email: 'a@b.fr', createdAt: new Date() },
        }),
      ).not.toThrow();
      expect(() =>
        validatePayloadForAction(AuditAction.ROLE_CHANGE, {
          before: { roleCode: 'X' },
          after: { roleCode: 'Y' },
        }),
      ).not.toThrow();
      expect(() =>
        validatePayloadForAction(AuditAction.DATA_EXPORTED, {
          format: 'ics',
          scope: 'planning',
          dateRange: { start: null, end: null },
          recordCount: 3,
        }),
      ).not.toThrow();
      expect(() =>
        validatePayloadForAction(AuditAction.SYSTEM_BACKFILL, {
          script: 's',
          args: [],
          phase: 'STARTED',
          dryRun: false,
        }),
      ).not.toThrow();
    });

    it('LEAVE_APPROVED accepts BOTH provenances (rich direct row and envelope self-approval)', () => {
      // Rich direct row (leaves.service approve()).
      expect(() =>
        validatePayloadForAction(AuditAction.LEAVE_APPROVED, {
          actor: { id: 'v1' },
          subject: { leaveId: 'l1', userId: 'u1' },
          before: { status: 'PENDING' },
          after: { status: 'APPROVED' },
          targetUserId: 'u1',
          validatorAssigned: 'v1',
          selfApproved: false,
        }),
      ).not.toThrow();
      // Security envelope (leaves.service self-approval via AuditService).
      expect(() =>
        validatePayloadForAction(AuditAction.LEAVE_APPROVED, {
          ip: undefined,
          details: 'Auto-validation',
          success: true,
          timestamp: new Date().toISOString(),
        }),
      ).not.toThrow();
    });

    it('rejects an unexpected top-level key (.strict()) for a known action', () => {
      expect(() =>
        validatePayloadForAction(AuditAction.ROLE_CHANGE, {
          before: {},
          after: {},
          surprise: true,
        }),
      ).toThrow(AuditPayloadValidationError);
    });

    it('absent payload is a no-op (no shape to be malformed)', () => {
      expect(() =>
        validatePayloadForAction(AuditAction.LOGIN_SUCCESS, null),
      ).not.toThrow();
      expect(() =>
        validatePayloadForAction(AuditAction.LOGIN_SUCCESS, undefined),
      ).not.toThrow();
    });

    it('unknown (non-enum) action is a no-op — unreachable in prod via the OBS-024 type gate', () => {
      expect(() =>
        validatePayloadForAction(
          'NOT_A_REAL_ACTION' as AuditAction,
          { anything: true },
        ),
      ).not.toThrow();
    });
  });
});
