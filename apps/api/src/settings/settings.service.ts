import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppSettingsCategory } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit-action.enum';

// Types for settings
type SettingValue = string | number | boolean | number[];

interface SettingConfig {
  value: SettingValue;
  // DAT-012: promoted to enum. Adding a new settings category requires adding
  // a value to the AppSettingsCategory enum (one Prisma migration) — the
  // deliberate compile-time coupling that prevents free-string drift.
  category: AppSettingsCategory;
  description: string;
}

export interface ParsedSetting {
  id?: string;
  key: string;
  value: SettingValue;
  category: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  isDefault?: boolean;
}

// Paramètres par défaut de l'application
const DEFAULT_SETTINGS: Record<string, SettingConfig> = {
  // Display settings
  dateFormat: {
    value: 'dd/MM/yyyy',
    category: 'display',
    description: 'Format de date (ex: dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd)',
  },
  timeFormat: {
    value: 'HH:mm',
    category: 'display',
    description: "Format d'heure (ex: HH:mm, hh:mm a)",
  },
  dateTimeFormat: {
    value: 'dd/MM/yyyy HH:mm',
    category: 'display',
    description: 'Format date et heure combiné',
  },
  locale: {
    value: 'fr-FR',
    category: 'display',
    description: 'Locale pour le formatage (fr-FR, en-US, etc.)',
  },
  weekStartsOn: {
    value: 1,
    category: 'display',
    description: 'Premier jour de la semaine (0=Dimanche, 1=Lundi)',
  },
  // General settings
  appName: {
    value: "ORCHESTR'A",
    category: 'general',
    description: "Nom de l'application",
  },
  defaultLeaveDays: {
    value: 25,
    category: 'general',
    description: 'Nombre de jours de congés payés par défaut par an',
  },
  maxTeleworkDaysPerWeek: {
    value: 3,
    category: 'general',
    description: 'Nombre maximum de jours de télétravail par semaine',
  },
  // Planning settings
  'planning.visibleDays': {
    value: [1, 2, 3, 4, 5],
    category: 'planning',
    description:
      'Jours visibles dans le planning (1=Lundi, 2=Mardi, ..., 7=Dimanche)',
  },
  'planning.specialDays': {
    value: [],
    category: 'planning',
    description:
      'Jours marqués comme spéciaux (fond distinctif) - numéros 1=Lundi à 7=Dimanche',
  },
};

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  /**
   * Initialiser les paramètres par défaut au démarrage
   */
  async onModuleInit() {
    try {
      await this.initializeDefaultSettings();
    } catch (error) {
      // Log but don't fail startup if settings table doesn't exist yet
      this.logger.warn(
        `Warning: Could not initialize default settings. Table may not exist yet. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Initialiser les paramètres par défaut s'ils n'existent pas
   */
  private async initializeDefaultSettings() {
    // PER-053: single round-trip instead of N×2 sequential findUnique+create calls
    await this.prisma.appSettings.createMany({
      data: Object.entries(DEFAULT_SETTINGS).map(([key, config]) => ({
        key,
        value: JSON.stringify(config.value),
        category: config.category,
        description: config.description ?? null,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Récupérer tous les paramètres
   */
  async findAll() {
    const settings = await this.prisma.appSettings.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Convertir en objet pour faciliter l'utilisation côté client
    const settingsMap: Record<string, SettingValue> = {};
    const settingsList: ParsedSetting[] = [];

    for (const setting of settings) {
      try {
        const parsedValue = JSON.parse(setting.value) as SettingValue;
        settingsMap[setting.key] = parsedValue;
        settingsList.push({
          ...setting,
          value: parsedValue,
        });
      } catch {
        settingsMap[setting.key] = setting.value;
        settingsList.push({
          ...setting,
          value: setting.value,
        });
      }
    }

    return {
      settings: settingsMap,
      list: settingsList,
    };
  }

  /**
   * Récupérer les paramètres par catégorie
   */
  async findByCategory(category: string) {
    // DAT-012: category is now a native enum. An unknown category string would
    // make Postgres reject the WHERE comparison (22P02); short-circuit to []
    // to preserve the prior "unknown category → empty result" read behaviour.
    if (!(Object.values(AppSettingsCategory) as string[]).includes(category)) {
      return [];
    }
    const settings = await this.prisma.appSettings.findMany({
      where: { category: category as AppSettingsCategory },
      orderBy: { key: 'asc' },
    });

    return settings.map((setting) => ({
      ...setting,
      value: this.parseValue(setting.value),
    }));
  }

  /**
   * Récupérer un paramètre par sa clé
   */
  async findOne(key: string) {
    const setting = await this.prisma.appSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      // Retourner la valeur par défaut si elle existe
      if (DEFAULT_SETTINGS[key]) {
        return {
          key,
          value: DEFAULT_SETTINGS[key].value,
          category: DEFAULT_SETTINGS[key].category,
          description: DEFAULT_SETTINGS[key].description,
          isDefault: true,
        };
      }
      return null;
    }

    return {
      ...setting,
      value: this.parseValue(setting.value),
    };
  }

  /**
   * Récupérer la valeur d'un paramètre
   */
  async getValue<T = SettingValue>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.findOne(key);
    if (!setting) {
      return defaultValue as T;
    }
    return setting.value as T;
  }

  /**
   * Mettre à jour un paramètre
   */
  /**
   * Known setting keys that are allowed to be created/updated
   */
  private static readonly ALLOWED_KEYS = Object.keys(DEFAULT_SETTINGS);

  static isKnownKey(key: string): boolean {
    return SettingsService.ALLOWED_KEYS.includes(key);
  }

  async update(
    key: string,
    value: unknown,
    description?: string,
    actorId?: string,
  ) {
    if (!SettingsService.isKnownKey(key)) {
      throw new BadRequestException(`Unknown setting key: ${key}`);
    }

    // OBS-011 — read the prior value first so the audit row carries before/after.
    // Validation (isKnownKey) runs before any DB read, so a rejected key never
    // touches the DB. before=null when the key is being created for the first time.
    const previous = await this.prisma.appSettings.findUnique({
      where: { key },
    });
    const before = previous ? this.parseValue(previous.value) : null;

    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await this.prisma.appSettings.upsert({
      where: { key },
      update: {
        value: stringValue,
        ...(description && { description }),
      },
      create: {
        // isKnownKey(key) above guarantees DEFAULT_SETTINGS[key] is defined, so
        // category always resolves to a valid enum value (DAT-012: the prior
        // `|| 'custom'` fallback was unreachable dead code and 'custom' is not a
        // valid AppSettingsCategory).
        key,
        value: stringValue,
        category: DEFAULT_SETTINGS[key].category,
        description: description || DEFAULT_SETTINGS[key]?.description,
      },
    });

    const parsed = this.parseValue(setting.value);

    // OBS-011 — settings carry security-relevant values (entitlements); audit
    // every change with before/after + actor. This is the single chokepoint —
    // bulkUpdate / resetToDefault / resetAllToDefaults all funnel through here.
    await this.auditPersistence.log({
      action: AuditAction.SETTINGS_CHANGED,
      entityType: 'Settings',
      entityId: key,
      actorId: actorId ?? null,
      payload: { key, before, after: parsed },
    });

    return {
      ...setting,
      value: parsed,
    };
  }

  /**
   * Mettre à jour plusieurs paramètres en une fois
   */
  async bulkUpdate(settings: Record<string, unknown>, actorId?: string) {
    const results: ParsedSetting[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const result = await this.update(key, value, undefined, actorId);
      results.push(result);
    }

    return results;
  }

  /**
   * Réinitialiser un paramètre à sa valeur par défaut
   */
  async resetToDefault(key: string, actorId?: string) {
    if (!DEFAULT_SETTINGS[key]) {
      throw new Error(`Pas de valeur par défaut pour le paramètre: ${key}`);
    }

    return this.update(
      key,
      DEFAULT_SETTINGS[key].value,
      DEFAULT_SETTINGS[key].description,
      actorId,
    );
  }

  /**
   * Réinitialiser tous les paramètres à leurs valeurs par défaut
   */
  async resetAllToDefaults(actorId?: string) {
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      await this.update(key, config.value, config.description, actorId);
    }

    return this.findAll();
  }

  /**
   * Supprimer un paramètre personnalisé
   */
  async remove(key: string, actorId?: string) {
    // Ne pas supprimer les paramètres par défaut
    if (DEFAULT_SETTINGS[key]) {
      return this.resetToDefault(key, actorId);
    }

    // OBS-011 — snapshot the custom value before the delete so the audit row
    // records what was removed (before=prior value, after=null = deleted).
    const previous = await this.prisma.appSettings.findUnique({
      where: { key },
    });
    // COR-061 — prisma.delete() throws P2025 for a missing record; surface a
    // 404 before reaching the delete so the caller gets a clean NotFoundException
    // instead of an unhandled 500.
    if (!previous) throw new NotFoundException(`Setting '${key}' not found`);
    const before = this.parseValue(previous.value);

    await this.prisma.appSettings.delete({
      where: { key },
    });

    await this.auditPersistence.log({
      action: AuditAction.SETTINGS_CHANGED,
      entityType: 'Settings',
      entityId: key,
      actorId: actorId ?? null,
      payload: { key, before, after: null },
    });

    return { message: 'Paramètre supprimé' };
  }

  /**
   * Parser une valeur JSON
   */
  private parseValue(value: string): SettingValue {
    try {
      return JSON.parse(value) as SettingValue;
    } catch {
      return value;
    }
  }
}
