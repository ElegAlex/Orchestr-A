import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditService, AuditAction } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should log successful events with logger.log', () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

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
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

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
      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

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
      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

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
  });
});
