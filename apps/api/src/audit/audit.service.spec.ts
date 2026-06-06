import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { AuditService, AuditAction } from './audit.service';
import { AuditPersistenceService } from './audit-persistence.service';
import { runWithRequestId } from '../common/fastify/request-id.context';

describe('AuditService', () => {
  let service: AuditService;
  let persistence: { log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    persistence = { log: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditPersistenceService, useValue: persistence },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should log successful events with logger.log', () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_SUCCESS,
        userId: 'user-1',
        ip: '127.0.0.1',
        success: true,
      });

      // Find the call that logged JSON with our action (ignore NestJS internal logs)
      const auditCall = logSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.action === AuditAction.LOGIN_SUCCESS;
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const entry = JSON.parse(auditCall![0] as string);
      expect(entry.userId).toBe('user-1');
      expect(entry.success).toBe(true);
      expect(entry.timestamp).toBeDefined();
    });

    it('should log failed events with logger.warn', () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_FAILURE,
        userId: 'user-1',
        ip: '127.0.0.1',
        success: false,
      });

      const auditCall = warnSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.action === AuditAction.LOGIN_FAILURE;
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const entry = JSON.parse(auditCall![0] as string);
      expect(entry.action).toBe(AuditAction.LOGIN_FAILURE);
      expect(entry.success).toBe(false);
    });

    it('should include optional fields when provided', () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});

      service.log({
        action: AuditAction.ROLE_CHANGE,
        userId: 'admin-1',
        targetId: 'user-2',
        details: 'Role changed from CONTRIBUTEUR to MANAGER',
        success: true,
      });

      const auditCall = logSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.action === AuditAction.ROLE_CHANGE;
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const entry = JSON.parse(auditCall![0] as string);
      expect(entry.targetId).toBe('user-2');
      expect(entry.details).toBe('Role changed from CONTRIBUTEUR to MANAGER');
    });

    it('should work without optional fields', () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});

      service.log({
        action: AuditAction.LEAVE_APPROVED,
        success: true,
      });

      const auditCall = logSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.action === AuditAction.LEAVE_APPROVED;
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const entry = JSON.parse(auditCall![0] as string);
      expect(entry.userId).toBeUndefined();
      expect(entry.ip).toBeUndefined();
    });

    // DAT-002 — security events must be durably persisted, not logger-only.
    // The logger emission (asserted above) stays; AuditService must ALSO
    // dual-write through AuditPersistenceService with the mapped payload shape.
    it('should persist the event via AuditPersistenceService (dual-write)', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_SUCCESS,
        userId: 'user-1',
        ip: '127.0.0.1',
        details: 'User u1 logged in successfully',
        success: true,
      });

      expect(persistence.log).toHaveBeenCalledTimes(1);
      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_SUCCESS,
          entityType: 'Auth', // OBS-001 refined DAT-002's flat 'SecurityEvent'
          entityId: 'user-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            ip: '127.0.0.1',
            success: true,
            details: 'User u1 logged in successfully',
          }),
        }),
      );
    });

    // DAT-002 — actor vs subject mapping: for a ROLE_CHANGE the actor is the
    // admin (userId) and the subject/entity is the target user (targetId).
    it('should map userId→actorId and targetId→entityId for targeted events', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      service.log({
        action: AuditAction.ROLE_CHANGE,
        userId: 'admin-1',
        targetId: 'user-2',
        details: 'Role changed from CONTRIBUTEUR to MANAGER',
        success: true,
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_CHANGE,
          entityType: 'User', // OBS-001 refined DAT-002's flat 'SecurityEvent'
          entityId: 'user-2',
          actorId: 'admin-1',
        }),
      );
    });

    // DAT-002 — failed login carries neither userId nor targetId; the entity
    // falls back to 'unknown' and actorId is null (no FK violation risk).
    it('should fall back to entityId=unknown and actorId=null when no user ids', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_FAILURE,
        details: 'Failed login attempt for login: ghost',
        success: false,
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILURE,
          entityType: 'Auth', // OBS-001 refined DAT-002's flat 'SecurityEvent'
          entityId: 'unknown',
          actorId: null,
          payload: expect.objectContaining({ success: false }),
        }),
      );
    });

    // OBS-001 (a) — per-action entityType. The single 'SecurityEvent' constant
    // from DAT-002 is refined to subject types so an auditor can filter by what
    // the event is about: User for account mutations, Auth for login/access,
    // Leave for leave decisions.
    it('should stamp entityType per action (User / Auth / Leave / Role)', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const expectations: Array<[AuditAction, string]> = [
        [AuditAction.ROLE_CHANGE, 'User'],
        [AuditAction.USER_DEACTIVATED, 'User'],
        [AuditAction.USER_REACTIVATED, 'User'],
        [AuditAction.PASSWORD_CHANGED, 'User'],
        [AuditAction.PASSWORD_RESET_BY_ADMIN, 'User'],
        [AuditAction.SERVICE_MEMBERSHIP_CHANGED, 'User'],
        [AuditAction.DEPARTMENT_CHANGED, 'User'],
        [AuditAction.REGISTER, 'User'],
        // OBS-005 — institutional-role lifecycle subjects.
        [AuditAction.ROLE_CREATED, 'Role'],
        [AuditAction.ROLE_UPDATED, 'Role'],
        [AuditAction.ROLE_DELETED, 'Role'],
        [AuditAction.ROLE_DEFAULT_CHANGED, 'Role'],
        // OBS-006 — document access subjects (read / download).
        [AuditAction.DOCUMENT_READ, 'Document'],
        [AuditAction.DOCUMENT_DOWNLOADED, 'Document'],
        // OBS-012 — deploy/boot lifecycle subject (release pinned at boot).
        [AuditAction.RELEASE_DEPLOYED, 'Deployment'],
        // OBS-007 — personal-data egress subject.
        [AuditAction.DATA_EXPORTED, 'Export'],
        [AuditAction.LOGIN_SUCCESS, 'Auth'],
        [AuditAction.LOGIN_FAILURE, 'Auth'],
        [AuditAction.ACCESS_DENIED, 'Auth'],
        [AuditAction.LEAVE_APPROVED, 'Leave'],
        [AuditAction.LEAVE_REJECTED, 'Leave'],
        // OBS-021 — full leave lifecycle subjects.
        [AuditAction.LEAVE_CANCELLED, 'Leave'],
        [AuditAction.LEAVE_CANCELLATION_REQUESTED, 'Leave'],
        [AuditAction.LEAVE_UPDATED, 'Leave'],
        [AuditAction.LEAVE_DELETED, 'Leave'],
        [AuditAction.LEAVE_BALANCE_ADJUSTED, 'Leave'],
        // OBS-018 — operational backfill/seed/maintenance script subject.
        [AuditAction.SYSTEM_BACKFILL, 'SystemMaintenance'],
        // OBS-024 — project lifecycle subjects, converged from free-strings.
        [AuditAction.PROJECT_ARCHIVED, 'Project'],
        [AuditAction.PROJECT_UNARCHIVED, 'Project'],
        [AuditAction.PROJECT_DELETED, 'Project'],
      ];

      for (const [action, expectedEntityType] of expectations) {
        persistence.log.mockClear();
        service.log({ action, userId: 'u1', success: true });
        expect(persistence.log).toHaveBeenCalledWith(
          expect.objectContaining({ action, entityType: expectedEntityType }),
        );
      }
    });

    // OBS-028 — the attempted identifier (OBS-001 captured it so an auditor can
    // answer "who was targeted") must NOT enter the immutable trail raw. entityId
    // is now a KEYED HMAC over the normalised (trim+lowercase) value: deterministic
    // (forensic correlation of repeat attempts / lockouts per target) but not
    // dictionary-reversible.
    it('HMACs the LOGIN_FAILURE attemptedEmail into entityId (keyed, never raw)', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const expected = createHmac(
        'sha256',
        process.env.AUDIT_HASH_KEY as string,
      )
        .update('ghost.user@example.com')
        .digest('hex');

      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: 'Ghost.User@Example.COM',
        details: 'Failed login attempt',
        success: false,
      });

      const call = persistence.log.mock.calls[0][0] as {
        action: AuditAction;
        entityType: string;
        entityId: string;
        actorId: string | null;
      };
      expect(call.action).toBe(AuditAction.LOGIN_FAILURE);
      expect(call.entityType).toBe('Auth');
      expect(call.actorId).toBeNull();
      // Keyed HMAC of the normalised identifier — 64-hex, never the raw value.
      expect(call.entityId).toBe(expected);
      expect(call.entityId).toMatch(/^[0-9a-f]{64}$/);
      expect(call.entityId).not.toContain('ghost');
      expect(call.entityId).not.toContain('@');
    });

    // OBS-028 — correlation: differing case/whitespace of the SAME identifier
    // yields the SAME hash, so forensics still group attempts per target.
    it('produces the same entityId hash for the same normalised attempted identifier (LOGIN_FAILURE + ACCOUNT_LOCKED)', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      service.log({
        action: AuditAction.ACCOUNT_LOCKED,
        attemptedEmail: 'Target@Example.com',
        success: false,
      });
      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: '  target@example.com  ',
        success: false,
      });

      const a = (persistence.log.mock.calls[0][0] as { entityId: string })
        .entityId;
      const b = (persistence.log.mock.calls[1][0] as { entityId: string })
        .entityId;
      expect(a).toBe(b);
    });

    // OBS-001 (c) — ua + reason enrichment round-trip into the JSONB payload.
    it('should round-trip ua and reason into the persisted payload', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: 'ghost',
        ua: 'Mozilla/5.0 (sentinel-UA)',
        reason: 'invalid_credentials',
        success: false,
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            ua: 'Mozilla/5.0 (sentinel-UA)',
            reason: 'invalid_credentials',
          }),
        }),
      );
    });

    // OBS-001 (d) — structured before/after for role mutations.
    it('should carry before.roleCode + after.roleCode in ROLE_CHANGE payload', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      service.log({
        action: AuditAction.ROLE_CHANGE,
        userId: 'admin-1',
        targetId: 'user-2',
        before: { roleCode: 'CONTRIBUTEUR' },
        after: { roleCode: 'MANAGER' },
        success: true,
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            before: { roleCode: 'CONTRIBUTEUR' },
            after: { roleCode: 'MANAGER' },
          }),
        }),
      );
    });

    // COR-006 — ip and details must be absent from the payload when undefined,
    // so that computeRowHash(storedRow) === storedRow.rowHash. PostgreSQL JSONB
    // drops undefined-valued keys (JSON.stringify semantics) while stableStringify
    // maps them to 'null', causing a hash divergence. Conditional-spread prevents
    // the key from entering the in-memory object in the first place.
    it('COR-006 — payload omits ip and details keys when event carries no ip/details', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      service.log({
        action: AuditAction.LEAVE_APPROVED,
        userId: 'actor-1',
        targetId: 'leave-1',
        success: true,
        // ip and details intentionally absent (undefined)
      });

      const call = persistence.log.mock.calls[0];
      expect(call).toBeDefined();
      const { payload } = call[0] as { payload: Record<string, unknown> };
      // Key must be completely absent, not present with value undefined.
      expect(payload).not.toHaveProperty('ip');
      expect(payload).not.toHaveProperty('details');
    });

    // OBS-002 — requestId must be injected into the persisted payload from the
    // ALS context (getRequestId). Rows written outside an HTTP request have no
    // requestId key (field absent). runWithRequestId() establishes the scope.
    it('OBS-002 — payload carries requestId from ALS context when inside an HTTP request scope', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      runWithRequestId('req-test-123', () => {
        service.log({
          action: AuditAction.LOGIN_SUCCESS,
          userId: 'user-1',
          ip: '10.0.0.1',
          success: true,
        });
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ requestId: 'req-test-123' }),
        }),
      );
    });

    // SEC-034 — hashAttemptedLogin uses unkeyed SHA256: rainbow-reversible.
    // After fix it must use HMAC with AUDIT_HASH_KEY.
    // Witness: stdout digest !== unkeyed SHA256 of the same input AND === the HMAC.
    it('SEC-034: stdout attemptedEmailHash uses keyed HMAC, not plain SHA256', () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});

      const rawLogin = 'test.user@example.com';
      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: rawLogin,
        success: false,
      });

      const auditCall = warnSpy.mock.calls.find((call) => {
        try {
          return (
            JSON.parse(call[0] as string).action === AuditAction.LOGIN_FAILURE
          );
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const entry = JSON.parse(auditCall![0] as string);
      const digest: string = entry.attemptedEmailHash;
      expect(digest).toMatch(/^[0-9a-f]{8}$/);

      // Must NOT equal the unkeyed SHA256 of the same input
      const unkeyed = createHash('sha256')
        .update(rawLogin)
        .digest('hex')
        .slice(0, 8);
      expect(digest).not.toBe(unkeyed);

      // Must equal the HMAC of the normalised (trim+lower) value
      const expected = createHmac('sha256', process.env['AUDIT_HASH_KEY']!)
        .update(rawLogin.trim().toLowerCase())
        .digest('hex')
        .slice(0, 8);
      expect(digest).toBe(expected);
    });

    it('OBS-002 — payload has no requestId key outside an HTTP request scope', () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      // Called without runWithRequestId — getRequestId() returns undefined.
      service.log({
        action: AuditAction.LOGIN_SUCCESS,
        userId: 'user-2',
        success: true,
      });

      const call = persistence.log.mock.calls[0];
      expect(call).toBeDefined();
      const { payload } = call[0] as { payload: Record<string, unknown> };
      expect(payload).not.toHaveProperty('requestId');
    });

    // OBS-001 design decision #2 — the mapping MUST never write a bcrypt-shaped
    // string (the password) into entityId or payload. Even if a caller mistakes
    // the password for the login identifier, the mapping redacts it.
    it('should never persist a bcrypt-shaped string for LOGIN_FAILURE', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      // Simulate a client that fat-fingered the password into the login field:
      // the new attemptedEmail→entityId path must NOT turn into a hash-leak.
      const bcryptHash =
        '$2b$12$abcdefghijklmnopqrstuv.wxyz0123456789ABCDEFGHIJKLMNO';
      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: bcryptHash,
        success: false,
      });

      const persistedArg = persistence.log.mock.calls[0][0];
      const serialized = JSON.stringify(persistedArg);
      expect(serialized).not.toMatch(/\$2[aby]\$/);
      expect(persistedArg.entityId).not.toMatch(/\$2[aby]\$/);
    });

    // OBS-013 — the stdout warn line for a LOGIN_FAILURE must NOT carry the raw
    // attempted login (email PII / attacker free-text). The persisted entityId
    // keeps the readable-sanitized subject (OBS-001) inside the controlled
    // audit_logs table; stdout gets only a non-reversible 8-char digest.
    // FAILS before the fix (raw `attemptedEmail` was spread into the warn JSON),
    // PASSES after.
    it('should not leak the raw login to the stdout warn line (hash only)', () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});

      const rawLogin = 'Victim.User@Example.COM';
      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: rawLogin,
        details: 'Failed login attempt',
        success: false,
      });

      const auditCall = warnSpy.mock.calls.find((call) => {
        try {
          return (
            JSON.parse(call[0] as string).action === AuditAction.LOGIN_FAILURE
          );
        } catch {
          return false;
        }
      });
      expect(auditCall).toBeDefined();
      const logged = auditCall![0] as string;

      // No raw identifier (in any case) reaches stdout.
      expect(logged).not.toContain(rawLogin);
      expect(logged.toLowerCase()).not.toContain(rawLogin.toLowerCase());

      // A short, non-reversible digest IS present so operators can still
      // correlate repeated attempts on the same target.
      const entry = JSON.parse(logged);
      expect(entry.attemptedEmail).toBeUndefined();
      expect(entry.attemptedEmailHash).toMatch(/^[0-9a-f]{8}$/);

      // OBS-028 — the persisted row's entityId is the keyed HMAC of the
      // normalised identifier, never the raw value (in any case).
      const expectedHmac = createHmac(
        'sha256',
        process.env.AUDIT_HASH_KEY as string,
      )
        .update(rawLogin.trim().toLowerCase())
        .digest('hex');
      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: expectedHmac }),
      );
      const persistedEntityId = (
        persistence.log.mock.calls[0][0] as { entityId: string }
      ).entityId;
      expect(persistedEntityId).not.toContain('victim');
      expect(persistedEntityId).not.toContain('@');
    });
  });
});
