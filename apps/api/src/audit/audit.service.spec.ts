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
          entityType: 'SecurityEvent',
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
          entityType: 'SecurityEvent',
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
          entityType: 'SecurityEvent',
          entityId: 'unknown',
          actorId: null,
          payload: expect.objectContaining({ success: false }),
        }),
      );
    });
  });
});
