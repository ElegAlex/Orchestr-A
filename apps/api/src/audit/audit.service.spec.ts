import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditService, AuditAction } from './audit.service';
import { AuditPersistenceService } from './audit-persistence.service';

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

    // OBS-001 (b) — LOGIN_FAILURE subject capture. DAT-002 landed entityId
    // 'unknown' for anonymous failures; OBS-001 captures the attempted
    // identifier so an auditor can answer "who was targeted", lowercased and
    // length-capped.
    it('should capture LOGIN_FAILURE attemptedEmail as entityId (lowercased, capped)', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      service.log({
        action: AuditAction.LOGIN_FAILURE,
        attemptedEmail: 'Ghost.User@Example.COM',
        details: 'Failed login attempt',
        success: false,
      });

      expect(persistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_FAILURE,
          entityType: 'Auth',
          entityId: 'ghost.user@example.com',
          actorId: null,
        }),
      );
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
  });
});
