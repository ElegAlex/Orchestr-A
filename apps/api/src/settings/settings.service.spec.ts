import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const mockPrismaService = {
    appSettings: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
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
      ],
    }).compile();

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
});
