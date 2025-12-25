import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Types for settings
type SettingValue = string | number | boolean;

interface SettingConfig {
  value: SettingValue;
  category: string;
  description: string;
}

interface ParsedSetting {
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
  // Notifications settings
  emailNotifications: {
    value: true,
    category: 'notifications',
    description: 'Activer les notifications par email',
  },
  leaveRequestNotifications: {
    value: true,
    category: 'notifications',
    description: 'Notifier les managers des nouvelles demandes de congés',
  },
};

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialiser les paramètres par défaut au démarrage
   */
  async onModuleInit() {
    await this.initializeDefaultSettings();
  }

  /**
   * Initialiser les paramètres par défaut s'ils n'existent pas
   */
  private async initializeDefaultSettings() {
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await this.prisma.appSettings.findUnique({
        where: { key },
      });

      if (!existing) {
        await this.prisma.appSettings.create({
          data: {
            key,
            value: JSON.stringify(config.value),
            category: config.category,
            description: config.description,
          },
        });
      }
    }
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
    const settings = await this.prisma.appSettings.findMany({
      where: { category },
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
  async update(key: string, value: unknown, description?: string) {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await this.prisma.appSettings.upsert({
      where: { key },
      update: {
        value: stringValue,
        ...(description && { description }),
      },
      create: {
        key,
        value: stringValue,
        category: DEFAULT_SETTINGS[key]?.category || 'custom',
        description: description || DEFAULT_SETTINGS[key]?.description,
      },
    });

    return {
      ...setting,
      value: this.parseValue(setting.value),
    };
  }

  /**
   * Mettre à jour plusieurs paramètres en une fois
   */
  async bulkUpdate(settings: Record<string, unknown>) {
    const results: ParsedSetting[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const result = await this.update(key, value);
      results.push(result);
    }

    return results;
  }

  /**
   * Réinitialiser un paramètre à sa valeur par défaut
   */
  async resetToDefault(key: string) {
    if (!DEFAULT_SETTINGS[key]) {
      throw new Error(`Pas de valeur par défaut pour le paramètre: ${key}`);
    }

    return this.update(
      key,
      DEFAULT_SETTINGS[key].value,
      DEFAULT_SETTINGS[key].description,
    );
  }

  /**
   * Réinitialiser tous les paramètres à leurs valeurs par défaut
   */
  async resetAllToDefaults() {
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      await this.update(key, config.value, config.description);
    }

    return this.findAll();
  }

  /**
   * Supprimer un paramètre personnalisé
   */
  async remove(key: string) {
    // Ne pas supprimer les paramètres par défaut
    if (DEFAULT_SETTINGS[key]) {
      return this.resetToDefault(key);
    }

    await this.prisma.appSettings.delete({
      where: { key },
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
