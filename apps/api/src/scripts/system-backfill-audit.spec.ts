import { describe, it, expect, vi } from 'vitest';
import {
  emitSystemBackfill,
  resolveBackfillActor,
} from './system-backfill-audit';

// OBS-018 — backfill/seed scripts don't run under vitest, so the emission is
// extracted into a pure helper tested directly at the AuditPersistenceService
// .log boundary (AUD-EMIT-001 / OBS-002+DAT-009 manual-verification precedent).
describe('system-backfill-audit (OBS-018)', () => {
  describe('emitSystemBackfill', () => {
    it('emits a SYSTEM_BACKFILL STARTED row with script + args (no affectedCount)', async () => {
      const log = vi.fn().mockResolvedValue(undefined);

      await emitSystemBackfill(
        { log },
        'STARTED',
        { script: 'backfill-snapshots', args: ['2025'] },
        'deployer-1',
      );

      expect(log).toHaveBeenCalledTimes(1);
      const entry = log.mock.calls[0][0];
      expect(entry.action).toBe('SYSTEM_BACKFILL');
      expect(entry.entityType).toBe('SystemMaintenance');
      expect(entry.entityId).toBe('backfill-snapshots');
      expect(entry.actorId).toBe('deployer-1');
      expect(entry.payload).toEqual({
        script: 'backfill-snapshots',
        args: ['2025'],
        phase: 'STARTED',
        dryRun: false,
      });
      // affectedCount is unknown at start → omitted, not a misleading 0.
      expect('affectedCount' in entry.payload).toBe(false);
    });

    it('emits a SYSTEM_BACKFILL COMPLETED row with affectedCount', async () => {
      const log = vi.fn().mockResolvedValue(undefined);

      await emitSystemBackfill(
        { log },
        'COMPLETED',
        { script: 'backfill-snapshots', args: [], affectedCount: 42 },
        'deployer-1',
      );

      const entry = log.mock.calls[0][0];
      expect(entry.payload.phase).toBe('COMPLETED');
      expect(entry.payload.affectedCount).toBe(42);
    });

    it('surfaces fromValue/toValue top-level for value-normalization runs (AUD-READ-001)', async () => {
      const log = vi.fn().mockResolvedValue(undefined);

      await emitSystemBackfill(
        { log },
        'STARTED',
        {
          script: 'normalize-action-codes',
          fromValue: 'PASSWORD_RESET_ADMIN',
          toValue: 'PASSWORD_RESET_BY_ADMIN',
          dryRun: true,
        },
        'deployer-1',
      );

      const entry = log.mock.calls[0][0];
      expect(entry.payload.fromValue).toBe('PASSWORD_RESET_ADMIN');
      expect(entry.payload.toValue).toBe('PASSWORD_RESET_BY_ADMIN');
      expect(entry.payload.dryRun).toBe(true);
    });

    it('omits fromValue/toValue when not provided (no leakage into other scripts)', async () => {
      const log = vi.fn().mockResolvedValue(undefined);

      await emitSystemBackfill({ log }, 'STARTED', {
        script: 'backfill-snapshots',
      });

      const entry = log.mock.calls[0][0];
      expect('fromValue' in entry.payload).toBe(false);
      expect('toValue' in entry.payload).toBe(false);
    });

    it('records a null actor when no operator identity is provided', async () => {
      const log = vi.fn().mockResolvedValue(undefined);

      await emitSystemBackfill({ log }, 'STARTED', { script: 's' }, null);

      expect(log.mock.calls[0][0].actorId).toBeNull();
    });
  });

  describe('resolveBackfillActor', () => {
    it('prefers DEPLOYED_BY (OBS-012 deploy identity) over DEPLOY_USER', () => {
      expect(
        resolveBackfillActor({ DEPLOYED_BY: 'alice', DEPLOY_USER: 'bob' }),
      ).toBe('alice');
    });

    it('falls back to DEPLOY_USER when DEPLOYED_BY is unset', () => {
      expect(resolveBackfillActor({ DEPLOY_USER: 'bob' })).toBe('bob');
    });

    it('returns null when neither is set (honest, not fabricated)', () => {
      expect(resolveBackfillActor({})).toBeNull();
    });
  });
});
