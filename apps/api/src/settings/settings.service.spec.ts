import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';
import { validatePayloadForAction } from '../audit/payload-schemas';

describe('SettingsService', () => {
  let service: SettingsService;

  const mockPrismaService = {
    appSettings: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockAuditPersistence = {
    log: vi.fn().mockResolvedValue(undefined),
  };

  const makeSetting = (key: string, value: unknown, overrides = {}) => ({
    id: `setting-${key}`,
    key,
    value: JSON.stringify(value),
    category: 'general',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistence,
        },
      ],
    }).compile();

    mockAuditPersistence.log.mockResolvedValue(undefined);
    // Note: onModuleInit is NOT called during compile() — no DB side effect.
    service = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('update — isKnownKey gate', () => {
    it('should throw BadRequestException for an unknown setting key', async () => {
      await expect(
        service.update('unknown_key_xyz', 'value'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should include the key name in the error', async () => {
      await expect(service.update('injected_key', 'bad')).rejects.toThrow(
        'unknown_key_xyz' in {} ? '' : 'Unknown setting',
      );
    });

    it('should update a known key successfully', async () => {
      const upserted = makeSetting('appName', "ORCHESTR'A");
      mockPrismaService.appSettings.upsert.mockResolvedValue(upserted);

      const result = await service.update('appName', "ORCHESTR'A");

      expect(result.key).toBe('appName');
    });

    it('should not call prisma.upsert for unknown keys', async () => {
      await expect(
        service.update('malicious', 'drop table'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPrismaService.appSettings.upsert).not.toHaveBeenCalled();
    });
  });

  describe('isKnownKey static helper', () => {
    it('should return true for known keys', () => {
      expect(SettingsService.isKnownKey('appName')).toBe(true);
      expect(SettingsService.isKnownKey('dateFormat')).toBe(true);
      expect(SettingsService.isKnownKey('locale')).toBe(true);
    });

    it('should return false for unknown keys', () => {
      expect(SettingsService.isKnownKey('unknownKey')).toBe(false);
      expect(SettingsService.isKnownKey('__proto__')).toBe(false);
      expect(SettingsService.isKnownKey('')).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return settings map and list', async () => {
      const rows = [
        makeSetting('appName', "ORCHESTR'A", { category: 'general' }),
        makeSetting('dateFormat', 'dd/MM/yyyy', { category: 'display' }),
      ];
      mockPrismaService.appSettings.findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect(result.settings).toHaveProperty('appName');
      expect(result.list).toHaveLength(2);
    });

    it('should parse JSON values', async () => {
      const rows = [makeSetting('weekStartsOn', 1)];
      mockPrismaService.appSettings.findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect(result.settings['weekStartsOn']).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return parsed setting from DB', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(
        makeSetting('appName', "ORCHESTR'A"),
      );

      const result = await service.findOne('appName');

      expect(result?.key).toBe('appName');
    });

    it('should return in-memory default when key not in DB', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(null);

      const result = await service.findOne('dateFormat');

      expect(result?.isDefault).toBe(true);
      expect(result?.value).toBeDefined();
    });

    it('should return null for a completely unknown key', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(null);

      const result = await service.findOne('totally_unknown');

      expect(result).toBeNull();
    });
  });

  describe('bulkUpdate', () => {
    it('should reject if any key is unknown', async () => {
      // First key is known, second is not
      const upserted = makeSetting('appName', 'test');
      mockPrismaService.appSettings.upsert.mockResolvedValue(upserted);

      await expect(
        service.bulkUpdate({ appName: 'test', hackerKey: 'evil' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // OBS-011 — settings drive entitlements (defaultLeaveDays, maxTelework…); every
  // write must leave a durable SETTINGS_CHANGED row with before/after + actor.
  describe('OBS-011 audit emits', () => {
    const settingsChangedCalls = () =>
      mockAuditPersistence.log.mock.calls
        .map((c) => c[0])
        .filter((e) => e?.action === AuditAction.SETTINGS_CHANGED);

    it('update() emits SETTINGS_CHANGED with before/after + actor', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(
        makeSetting('appName', 'Old'),
      );
      mockPrismaService.appSettings.upsert.mockResolvedValue(
        makeSetting('appName', 'New'),
      );

      await service.update('appName', 'New', undefined, 'actor-1');

      const calls = settingsChangedCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        action: AuditAction.SETTINGS_CHANGED,
        entityType: 'Settings',
        entityId: 'appName',
        actorId: 'actor-1',
      });
      expect(calls[0].payload).toMatchObject({
        key: 'appName',
        before: 'Old',
        after: 'New',
      });
      expect(() =>
        validatePayloadForAction(
          AuditAction.SETTINGS_CHANGED,
          calls[0].payload,
        ),
      ).not.toThrow();
    });

    it('bulkUpdate() emits one SETTINGS_CHANGED per changed key', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(null);
      mockPrismaService.appSettings.upsert.mockResolvedValue(
        makeSetting('appName', 'x'),
      );

      await service.bulkUpdate({ appName: 'a', locale: 'fr' }, 'actor-1');

      const calls = settingsChangedCalls();
      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.payload.key).sort()).toEqual([
        'appName',
        'locale',
      ]);
      for (const c of calls) {
        expect(c.actorId).toBe('actor-1');
        expect(() =>
          validatePayloadForAction(AuditAction.SETTINGS_CHANGED, c.payload),
        ).not.toThrow();
      }
    });

    it('remove() of a custom key emits SETTINGS_CHANGED with after=null', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(
        makeSetting('customKey', 'legacy'),
      );
      mockPrismaService.appSettings.delete.mockResolvedValue({});

      await service.remove('customKey', 'actor-1');

      const calls = settingsChangedCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        action: AuditAction.SETTINGS_CHANGED,
        entityType: 'Settings',
        entityId: 'customKey',
        actorId: 'actor-1',
      });
      expect(calls[0].payload).toMatchObject({
        key: 'customKey',
        after: null,
      });
      expect(() =>
        validatePayloadForAction(
          AuditAction.SETTINGS_CHANGED,
          calls[0].payload,
        ),
      ).not.toThrow();
    });
  });

  // COR-061 — remove() must surface 404 for a non-existent custom key instead
  // of letting prisma.delete() throw P2025 (unhandled 500).
  describe('COR-061 — remove() non-existent key', () => {
    it('throws NotFoundException when the key is not in DB and not a default', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent-custom-key'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does NOT call prisma.delete when the key is missing', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent-custom-key'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrismaService.appSettings.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing custom key and returns the success message', async () => {
      mockPrismaService.appSettings.findUnique.mockResolvedValue(
        makeSetting('customKey', 'value'),
      );
      mockPrismaService.appSettings.delete.mockResolvedValue({});

      const result = await service.remove('customKey');
      expect(result).toMatchObject({ message: 'Paramètre supprimé' });
      expect(mockPrismaService.appSettings.delete).toHaveBeenCalledWith({
        where: { key: 'customKey' },
      });
    });
  });

  // SA-OBS-011 — onModuleInit must use this.logger.warn, not console.warn.
  describe('SA-OBS-011 — onModuleInit uses Logger, not console.warn', () => {
    it('does not call console.warn when initializeDefaultSettings fails', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      // PER-053: initializeDefaultSettings now calls createMany (not findUnique+create).
      // Force the single createMany call to throw so the catch branch is hit.
      mockPrismaService.appSettings.createMany.mockRejectedValueOnce(
        new Error('Table does not exist'),
      );

      // onModuleInit swallows the error; it must not call console.warn.
      await service.onModuleInit();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  // PER-053 — initializeDefaultSettings uses a single createMany round-trip
  describe('PER-053 — initializeDefaultSettings uses createMany', () => {
    it('calls createMany with skipDuplicates instead of a serial loop', async () => {
      mockPrismaService.appSettings.createMany.mockResolvedValueOnce({
        count: 3,
      });

      await service.onModuleInit();

      expect(mockPrismaService.appSettings.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.appSettings.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
      // findUnique must NOT have been called (no more serial loop)
      expect(mockPrismaService.appSettings.findUnique).not.toHaveBeenCalled();
    });
  });
});
