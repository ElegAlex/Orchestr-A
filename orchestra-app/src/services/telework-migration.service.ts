import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { teleworkServiceV2 } from './telework-v2.service';
import {
  UserTeleworkProfile,
  TeleworkOverride,
  TeleworkMode
} from '../types/telework.types';

/**
 * Service de migration des données télétravail v1 vers v2
 * 
 * Migre les données depuis l'ancien système:
 * - Collection 'teleworkDays' (jours déclarés)
 * - Collection 'teleworkPatterns' (patterns récurrents)
 * - Collection 'teleworkExceptions' (exceptions ponctuelles)
 * 
 * Vers le nouveau système:
 * - Collection 'teleworkProfiles' (profils utilisateurs)
 * - Collection 'teleworkOverrides' (exceptions)
 * - Collection 'teamTeleworkRules' (règles équipe)
 */
class TeleworkMigrationService {

  // Collections de l'ancien système
  private readonly OLD_TELEWORK_DAYS = 'teleworkDays';
  private readonly OLD_TELEWORK_PATTERNS = 'teleworkPatterns';
  private readonly OLD_TELEWORK_EXCEPTIONS = 'teleworkExceptions';

  // Collections du nouveau système
  private readonly NEW_PROFILES = 'teleworkProfiles';
  private readonly NEW_OVERRIDES = 'teleworkOverrides';
  private readonly NEW_TEAM_RULES = 'teamTeleworkRules';

  /**
   * Exécuter la migration complète
   */
  async runFullMigration(options: {
    dryRun?: boolean;
    deleteOldData?: boolean;
    onProgress?: (message: string) => void;
  } = {}): Promise<{
    success: boolean;
    migratedProfiles: number;
    migratedOverrides: number;
    errors: string[];
  }> {
    const { dryRun = false, deleteOldData = false, onProgress } = options;
    const errors: string[] = [];
    let migratedProfiles = 0;
    let migratedOverrides = 0;

    try {
      onProgress?.('Starting telework migration...');

      // 1. Migrer les patterns récurrents vers les profils
      onProgress?.('Migrating recurring patterns to profiles...');
      const profilesResult = await this.migrateRecurringPatterns(dryRun);
      migratedProfiles = profilesResult.count;
      errors.push(...profilesResult.errors);

      // 2. Migrer les jours télétravail vers les overrides
      onProgress?.('Migrating telework days to overrides...');
      const daysResult = await this.migrateTeleworkDays(dryRun);
      migratedOverrides += daysResult.count;
      errors.push(...daysResult.errors);

      // 3. Migrer les exceptions vers les overrides
      onProgress?.('Migrating exceptions to overrides...');
      const exceptionsResult = await this.migrateExceptions(dryRun);
      migratedOverrides += exceptionsResult.count;
      errors.push(...exceptionsResult.errors);

      // 4. Nettoyer les données anciennes si demandé
      if (deleteOldData && !dryRun) {
        onProgress?.('Cleaning up old data...');
        await this.cleanupOldData();
      }

      onProgress?.(`Migration completed: ${migratedProfiles} profiles, ${migratedOverrides} overrides`);

      return {
        success: errors.length === 0,
        migratedProfiles,
        migratedOverrides,
        errors
      };

    } catch (error) {
      console.error('Migration error:', error);
      errors.push(`Critical error: ${error}`);
      return {
        success: false,
        migratedProfiles,
        migratedOverrides,
        errors
      };
    }
  }

  /**
   * Migrer les patterns récurrents vers les profils utilisateur
   */
  private async migrateRecurringPatterns(dryRun: boolean): Promise<{
    count: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Récupérer tous les patterns de l'ancien système
      const patternsSnapshot = await getDocs(
        collection(db, this.OLD_TELEWORK_PATTERNS)
      );

      const batch = writeBatch(db);

      for (const patternDoc of patternsSnapshot.docs) {
        try {
          const oldPattern = patternDoc.data();
          const userId = oldPattern.userId || patternDoc.id.split('_')[0];

          // Créer le nouveau profil
          const newProfile: UserTeleworkProfile = {
            id: `profile_${userId}`,
            userId,
            displayName: oldPattern.userName || 'User',
            defaultMode: 'office',
            weeklyPattern: this.convertOldPatternToWeekly(oldPattern),
            constraints: {
              maxRemoteDaysPerWeek: oldPattern.maxDaysPerWeek || 2,
              maxConsecutiveRemoteDays: 2,
              requiresApproval: oldPattern.requiresApproval || false
            },
            isActive: oldPattern.isActive !== false,
            createdAt: oldPattern.createdAt || Timestamp.now(),
            createdBy: oldPattern.createdBy || userId,
            updatedAt: Timestamp.now(),
            updatedBy: 'migration_script'
          };

          if (!dryRun) {
            const profileRef = doc(db, this.NEW_PROFILES, newProfile.id);
            batch.set(profileRef, newProfile);
          }

          count++;
        } catch (error) {
          errors.push(`Failed to migrate pattern ${patternDoc.id}: ${error}`);
        }
      }

      if (!dryRun) {
        await batch.commit();
      }

    } catch (error) {
      errors.push(`Pattern migration error: ${error}`);
    }

    return { count, errors };
  }

  /**
   * Migrer les jours télétravail déclarés vers les overrides
   */
  private async migrateTeleworkDays(dryRun: boolean): Promise<{
    count: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Récupérer tous les jours télétravail
      const daysSnapshot = await getDocs(
        collection(db, this.OLD_TELEWORK_DAYS)
      );

      const batch = writeBatch(db);
      const processedKeys = new Set<string>();

      for (const dayDoc of daysSnapshot.docs) {
        try {
          const oldDay = dayDoc.data();
          
          // Parser l'ID pour extraire userId et date
          // Format attendu: "userId_YYYY-MM-DD"
          const parts = dayDoc.id.split('_');
          if (parts.length < 2) continue;
          
          const userId = parts[0];
          const dateStr = parts[1];
          
          // Créer une clé unique pour éviter les doublons
          const uniqueKey = `${userId}_${dateStr}`;
          if (processedKeys.has(uniqueKey)) continue;
          processedKeys.add(uniqueKey);

          // Convertir la date string en Date
          const dateParts = dateStr.split('-');
          const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          );

          // Créer le nouvel override
          const newOverride: TeleworkOverride = {
            id: `override_${uniqueKey}_${Date.now()}`,
            userId,
            date: Timestamp.fromDate(date),
            mode: oldDay.isRemote ? 'remote' : 'office',
            source: oldDay.source === 'recurring' ? 'user_request' : 'user_request',
            priority: 1,
            reason: oldDay.reason || 'Migré depuis ancien système',
            approvalStatus: 'approved', // Les jours existants sont considérés approuvés
            createdAt: oldDay.createdAt || Timestamp.fromDate(date),
            createdBy: oldDay.createdBy || userId,
            approvedAt: oldDay.approvedAt || Timestamp.fromDate(date),
            approvedBy: oldDay.approvedBy || 'auto_migration'
          };

          if (!dryRun) {
            const overrideRef = doc(db, this.NEW_OVERRIDES, newOverride.id);
            batch.set(overrideRef, newOverride);
          }

          count++;
        } catch (error) {
          errors.push(`Failed to migrate day ${dayDoc.id}: ${error}`);
        }
      }

      if (!dryRun) {
        await batch.commit();
      }

    } catch (error) {
      errors.push(`Days migration error: ${error}`);
    }

    return { count, errors };
  }

  /**
   * Migrer les exceptions ponctuelles vers les overrides
   */
  private async migrateExceptions(dryRun: boolean): Promise<{
    count: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Récupérer toutes les exceptions
      const exceptionsSnapshot = await getDocs(
        collection(db, this.OLD_TELEWORK_EXCEPTIONS)
      );

      const batch = writeBatch(db);

      for (const exceptionDoc of exceptionsSnapshot.docs) {
        try {
          const oldException = exceptionDoc.data();

          // Créer le nouvel override
          const newOverride: TeleworkOverride = {
            id: `override_ex_${exceptionDoc.id}`,
            userId: oldException.userId,
            date: oldException.date || Timestamp.now(),
            mode: oldException.mode || 'remote',
            source: 'user_request',
            priority: 2, // Priority plus élevée pour les exceptions
            reason: oldException.reason || 'Exception ponctuelle',
            approvalStatus: oldException.status || 'approved',
            createdAt: oldException.createdAt || Timestamp.now(),
            createdBy: oldException.createdBy || oldException.userId
          };

          if (oldException.approvedAt) {
            newOverride.approvedAt = oldException.approvedAt;
            newOverride.approvedBy = oldException.approvedBy || 'manager';
          }

          if (oldException.rejectedAt) {
            newOverride.rejectedAt = oldException.rejectedAt;
            newOverride.rejectedBy = oldException.rejectedBy || 'manager';
            newOverride.rejectionReason = oldException.rejectionReason;
          }

          if (!dryRun) {
            const overrideRef = doc(db, this.NEW_OVERRIDES, newOverride.id);
            batch.set(overrideRef, newOverride);
          }

          count++;
        } catch (error) {
          errors.push(`Failed to migrate exception ${exceptionDoc.id}: ${error}`);
        }
      }

      if (!dryRun) {
        await batch.commit();
      }

    } catch (error) {
      errors.push(`Exceptions migration error: ${error}`);
    }

    return { count, errors };
  }

  /**
   * Convertir un ancien pattern en nouveau format weekly
   */
  private convertOldPatternToWeekly(oldPattern: any): UserTeleworkProfile['weeklyPattern'] {
    const weeklyPattern: UserTeleworkProfile['weeklyPattern'] = {
      monday: 'default',
      tuesday: 'default',
      wednesday: 'default',
      thursday: 'default',
      friday: 'default',
      saturday: 'default',
      sunday: 'default'
    };

    // Si l'ancien système avait des jours spécifiques
    if (oldPattern.remoteDays && Array.isArray(oldPattern.remoteDays)) {
      const dayMapping: Record<string, keyof UserTeleworkProfile['weeklyPattern']> = {
        '1': 'monday',
        '2': 'tuesday',
        '3': 'wednesday',
        '4': 'thursday',
        '5': 'friday',
        '6': 'saturday',
        '0': 'sunday'
      };

      oldPattern.remoteDays.forEach((day: string | number) => {
        const dayKey = dayMapping[String(day)];
        if (dayKey) {
          weeklyPattern[dayKey] = 'remote';
        }
      });
    }

    // Si l'ancien système utilisait un pattern différent
    if (oldPattern.pattern) {
      Object.keys(oldPattern.pattern).forEach(key => {
        if (key in weeklyPattern) {
          const dayKey = key as keyof UserTeleworkProfile['weeklyPattern'];
          weeklyPattern[dayKey] = oldPattern.pattern[key] ? 'remote' : 'office';
        }
      });
    }

    return weeklyPattern;
  }

  /**
   * Nettoyer les anciennes données après migration
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Marquer les anciennes collections comme migrées plutôt que de les supprimer
      // Pour permettre un rollback si nécessaire
      const migrationMarker = {
        migratedAt: Timestamp.now(),
        migratedBy: 'telework_migration_service',
        version: 'v2'
      };

      // Ajouter un document de marquage dans chaque ancienne collection
      await setDoc(
        doc(db, this.OLD_TELEWORK_DAYS, '_migration_completed'),
        migrationMarker
      );

      await setDoc(
        doc(db, this.OLD_TELEWORK_PATTERNS, '_migration_completed'),
        migrationMarker
      );

      await setDoc(
        doc(db, this.OLD_TELEWORK_EXCEPTIONS, '_migration_completed'),
        migrationMarker
      );

      console.log('Old data marked as migrated');
    } catch (error) {
      console.error('Error marking old data:', error);
    }
  }

  /**
   * Vérifier l'état de la migration
   */
  async checkMigrationStatus(): Promise<{
    isComplete: boolean;
    oldDataCount: {
      days: number;
      patterns: number;
      exceptions: number;
    };
    newDataCount: {
      profiles: number;
      overrides: number;
      teamRules: number;
    };
  }> {
    try {
      // Compter les données anciennes
      const [daysSnapshot, patternsSnapshot, exceptionsSnapshot] = await Promise.all([
        getDocs(collection(db, this.OLD_TELEWORK_DAYS)),
        getDocs(collection(db, this.OLD_TELEWORK_PATTERNS)),
        getDocs(collection(db, this.OLD_TELEWORK_EXCEPTIONS))
      ]);

      // Compter les données nouvelles
      const [profilesSnapshot, overridesSnapshot, rulesSnapshot] = await Promise.all([
        getDocs(collection(db, this.NEW_PROFILES)),
        getDocs(collection(db, this.NEW_OVERRIDES)),
        getDocs(collection(db, this.NEW_TEAM_RULES))
      ]);

      // Vérifier si la migration est marquée comme complète
      const migrationDoc = await getDoc(
        doc(db, this.OLD_TELEWORK_DAYS, '_migration_completed')
      );

      return {
        isComplete: migrationDoc.exists(),
        oldDataCount: {
          days: daysSnapshot.size,
          patterns: patternsSnapshot.size,
          exceptions: exceptionsSnapshot.size
        },
        newDataCount: {
          profiles: profilesSnapshot.size,
          overrides: overridesSnapshot.size,
          teamRules: rulesSnapshot.size
        }
      };
    } catch (error) {
      console.error('Error checking migration status:', error);
      throw error;
    }
  }

  /**
   * Rollback de la migration (supprime les nouvelles données)
   */
  async rollbackMigration(): Promise<void> {
    try {
      // Supprimer toutes les données du nouveau système
      const [profilesSnapshot, overridesSnapshot] = await Promise.all([
        getDocs(collection(db, this.NEW_PROFILES)),
        getDocs(collection(db, this.NEW_OVERRIDES))
      ]);

      const batch = writeBatch(db);
      let count = 0;

      profilesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });

      overridesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();

      // Supprimer les marqueurs de migration
      await deleteDoc(doc(db, this.OLD_TELEWORK_DAYS, '_migration_completed'));
      await deleteDoc(doc(db, this.OLD_TELEWORK_PATTERNS, '_migration_completed'));
      await deleteDoc(doc(db, this.OLD_TELEWORK_EXCEPTIONS, '_migration_completed'));

      console.log(`Rollback completed: ${count} documents deleted`);
    } catch (error) {
      console.error('Rollback error:', error);
      throw error;
    }
  }
}

export const teleworkMigrationService = new TeleworkMigrationService();