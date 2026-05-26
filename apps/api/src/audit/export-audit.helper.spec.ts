import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { emitDataExported } from './export-audit.helper';
import type { AuditPersistenceService } from './audit-persistence.service';

// TST-011 / OBS-026 — the shared CSV-export emitter is exercised transitively by
// tasks.service.spec and milestones.service.spec, but its own DATA_EXPORTED shape
// and the fire-and-forget resilience contract ("a rejecting audit log must never
// throw on a successful read/export") had no dedicated coverage. Tested directly
// at the AuditPersistenceService.log boundary, mirroring system-backfill-audit.spec.
describe('export-audit.helper (OBS-026)', () => {
  const makeLogger = () => ({ error: vi.fn() }) as unknown as Logger;

  describe('emitDataExported', () => {
    it('emits DATA_EXPORTED with the full RGPD egress shape', () => {
      const log = vi.fn().mockResolvedValue(undefined);

      emitDataExported({ log } as unknown as AuditPersistenceService, makeLogger(), {
        actorId: 'user-1',
        format: 'csv',
        scope: 'project-tasks',
        recordCount: 12,
        subject: { projectId: 'proj-9' },
        meta: { ip: '10.0.0.5', ua: 'vitest' },
      });

      expect(log).toHaveBeenCalledTimes(1);
      const entry = log.mock.calls[0][0];
      expect(entry.action).toBe('DATA_EXPORTED');
      expect(entry.entityType).toBe('Export');
      // The caller is both the actor and the event subject (entityId).
      expect(entry.entityId).toBe('user-1');
      expect(entry.actorId).toBe('user-1');
      expect(entry.payload).toEqual({
        format: 'csv',
        scope: 'project-tasks',
        recordCount: 12,
        subject: { projectId: 'proj-9' },
        ip: '10.0.0.5',
        ua: 'vitest',
      });
    });

    it('omits subject/ip/ua when not provided (no misleading empty keys)', () => {
      const log = vi.fn().mockResolvedValue(undefined);

      emitDataExported({ log } as unknown as AuditPersistenceService, makeLogger(), {
        actorId: 'user-2',
        format: 'csv',
        scope: 'milestones',
        recordCount: 0,
      });

      const payload = log.mock.calls[0][0].payload;
      expect(payload).toEqual({ format: 'csv', scope: 'milestones', recordCount: 0 });
      expect('subject' in payload).toBe(false);
      expect('ip' in payload).toBe(false);
      expect('ua' in payload).toBe(false);
    });

    it('swallows a rejected audit log without throwing and logs the failure', async () => {
      const log = vi.fn().mockRejectedValue(new Error('audit db down'));
      const logger = makeLogger();

      // Fire-and-forget: the synchronous call must not throw even though the
      // underlying persistence rejects — a read/export must never 500.
      expect(() =>
        emitDataExported({ log } as unknown as AuditPersistenceService, logger, {
          actorId: 'user-3',
          format: 'csv',
          scope: 'project-tasks',
          recordCount: 1,
        }),
      ).not.toThrow();

      // Flush the microtask queue so the .catch handler runs.
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist DATA_EXPORTED audit event'),
      );
    });
  });
});
