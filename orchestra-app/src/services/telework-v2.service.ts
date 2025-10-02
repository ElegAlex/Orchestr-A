import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UserTeleworkProfile,
  TeleworkOverride,
  TeamTeleworkRule,
  TeleworkMode,
  WeekdayPattern,
  WeekdayKey,
  WEEKDAYS,
  ApprovalStatus,
  ValidationResult,
  TeleworkConflict
} from '../types/telework.types';

class TeleworkServiceV2 {
  private readonly PROFILES_COLLECTION = 'userTeleworkProfiles';
  private readonly OVERRIDES_COLLECTION = 'teleworkOverrides';
  private readonly TEAM_RULES_COLLECTION = 'teamTeleworkRules';
  private readonly CONFIG_COLLECTION = 'teleworkSystemConfig';

  // =============================================
  // GESTION DES PROFILS UTILISATEUR
  // =============================================

  /**
   * Créer un profil télétravail par défaut pour un utilisateur
   */
  async createDefaultProfile(userId: string, displayName: string, createdBy: string): Promise<UserTeleworkProfile> {
    const profile: UserTeleworkProfile = {
      id: userId,
      userId,
      displayName,
      defaultMode: 'office',
      weeklyPattern: {
        monday: 'default',
        tuesday: 'default',
        wednesday: 'default',
        thursday: 'default',
        friday: 'default',
        saturday: 'default',
        sunday: 'default'
      },
      constraints: {
        maxRemoteDaysPerWeek: 2,
        maxConsecutiveRemoteDays: 2,
        requiresApproval: false
      },
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy,
      updatedBy: createdBy
    };

    await setDoc(doc(db, this.PROFILES_COLLECTION, userId), profile);
    return profile;
  }

  /**
   * Récupérer le profil télétravail d'un utilisateur
   */
  async getUserProfile(userId: string): Promise<UserTeleworkProfile | null> {
    try {
      const docSnap = await getDoc(doc(db, this.PROFILES_COLLECTION, userId));

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as UserTeleworkProfile;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      return null;
    }
  }

  /**
   * Mettre à jour un profil télétravail
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<UserTeleworkProfile>,
    updatedBy: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.PROFILES_COLLECTION, userId);

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
        updatedBy
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les profils (pour admin)
   */
  async getAllProfiles(): Promise<UserTeleworkProfile[]> {
    try {
      const q = query(
        collection(db, this.PROFILES_COLLECTION),
        where('isActive', '==', true),
        orderBy('displayName')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserTeleworkProfile[];
    } catch (error) {
      console.error('Erreur lors de la récupération des profils:', error);
      return [];
    }
  }

  /**
   * Récupérer les profils télétravail pour une liste d'utilisateurs spécifiques
   */
  async getAllUserProfiles(userIds: string[]): Promise<UserTeleworkProfile[]> {
    if (userIds.length === 0) return [];

    try {
      // Firestore limite les requêtes "in" à 10 éléments
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }

      const allProfiles: UserTeleworkProfile[] = [];

      for (const chunk of chunks) {
        const q = query(
          collection(db, this.PROFILES_COLLECTION),
          where('userId', 'in', chunk)
        );

        const querySnapshot = await getDocs(q);
        const profiles = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserTeleworkProfile[];

        allProfiles.push(...profiles);
      }

      return allProfiles;
    } catch (error) {
      console.error('Erreur lors de la récupération des profils par IDs:', error);
      return [];
    }
  }

  // =============================================
  // GESTION DES EXCEPTIONS (OVERRIDES)
  // =============================================

  /**
   * Créer une demande d'exception
   */
  async requestOverride(override: Omit<TeleworkOverride, 'id' | 'createdAt' | 'approvalStatus'>): Promise<string> {
    try {
      const overrideId = this.generateOverrideId(override.userId, override.date.toDate());
      const docRef = doc(db, this.OVERRIDES_COLLECTION, overrideId);

      // Validation avant création
      const validation = await this.validateOverrideRequest(override.userId, override.date.toDate(), override.mode);

      const cleanOverride = { ...override };
      if (cleanOverride.reason === undefined) {
        delete cleanOverride.reason;
      }

      const newOverride: TeleworkOverride = {
        ...cleanOverride,
        id: overrideId,
        approvalStatus: validation.requiresApproval ? 'pending' : 'approved',
        createdAt: Timestamp.now()
      };

      // Si pas besoin d'approbation, approuver automatiquement
      if (!validation.requiresApproval) {
        newOverride.approvedBy = override.createdBy;
        newOverride.approvedAt = Timestamp.now();
      }

      await setDoc(docRef, newOverride);
      return overrideId;
    } catch (error) {
      console.error('Erreur lors de la création de l\'exception:', error);
      throw error;
    }
  }

  /**
   * Approuver une exception
   */
  async approveOverride(overrideId: string, approvedBy: string, reason?: string): Promise<void> {
    try {
      const docRef = doc(db, this.OVERRIDES_COLLECTION, overrideId);

      await updateDoc(docRef, {
        approvalStatus: 'approved',
        approvedBy,
        approvedAt: Timestamp.now(),
        rejectionReason: reason || null,
        updatedAt: Timestamp.now(),
        updatedBy: approvedBy
      });
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      throw error;
    }
  }

  /**
   * Rejeter une exception
   */
  async rejectOverride(overrideId: string, rejectedBy: string, reason: string): Promise<void> {
    try {
      const docRef = doc(db, this.OVERRIDES_COLLECTION, overrideId);

      await updateDoc(docRef, {
        approvalStatus: 'rejected',
        approvedBy: rejectedBy,
        approvedAt: Timestamp.now(),
        rejectionReason: reason,
        updatedAt: Timestamp.now(),
        updatedBy: rejectedBy
      });
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      throw error;
    }
  }

  /**
   * Supprimer une exception
   */
  async deleteOverride(overrideId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.OVERRIDES_COLLECTION, overrideId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      throw error;
    }
  }

  /**
   * Récupérer les exceptions d'un utilisateur pour une période
   */
  async getUserOverrides(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeleworkOverride[]> {
    try {
      const q = query(
        collection(db, this.OVERRIDES_COLLECTION),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeleworkOverride[];
    } catch (error) {
      console.error('Erreur lors de la récupération des exceptions:', error);
      return [];
    }
  }

  /**
   * Récupérer les exceptions en attente d'approbation
   */
  async getPendingOverrides(approverId?: string): Promise<TeleworkOverride[]> {
    try {
      const q = query(
        collection(db, this.OVERRIDES_COLLECTION),
        where('approvalStatus', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const overrides = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeleworkOverride[];

      // Filtrer par approbateur si spécifié
      if (approverId) {
        // Logique pour déterminer qui peut approuver (manager, RH, admin)
        // Pour l'instant, retourner toutes les demandes
      }

      return overrides;
    } catch (error) {
      console.error('Erreur lors de la récupération des approbations:', error);
      return [];
    }
  }

  // =============================================
  // GESTION DES RÈGLES ÉQUIPE
  // =============================================

  /**
   * Créer une règle équipe
   */
  async createTeamRule(rule: Omit<TeamTeleworkRule, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = doc(collection(db, this.TEAM_RULES_COLLECTION));
      const newRule: TeamTeleworkRule = {
        ...rule,
        id: docRef.id,
        createdAt: Timestamp.now()
      };

      await setDoc(docRef, newRule);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la règle équipe:', error);
      throw error;
    }
  }

  /**
   * Récupérer les règles équipe actives pour un utilisateur
   */
  async getTeamRulesForUser(userId: string): Promise<TeamTeleworkRule[]> {
    try {
      const q = query(
        collection(db, this.TEAM_RULES_COLLECTION),
        where('isActive', '==', true),
        where('affectedUserIds', 'array-contains', userId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamTeleworkRule[];
    } catch (error) {
      console.error('Erreur lors de la récupération des règles équipe:', error);
      return [];
    }
  }

  // =============================================
  // VALIDATION ET LOGIQUE MÉTIER
  // =============================================

  /**
   * Valider une demande d'exception
   */
  async validateOverrideRequest(
    userId: string,
    date: Date,
    requestedMode: TeleworkMode
  ): Promise<ValidationResult> {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return {
          isValid: false,
          canProceed: false,
          reason: 'Profil télétravail non trouvé',
          conflicts: [],
          requiresApproval: false
        };
      }

      const conflicts: TeleworkConflict[] = [];

      // 1. Vérifier les contraintes hebdomadaires
      if (requestedMode === 'remote') {
        const weekStart = this.getWeekStart(date);
        const weekEnd = this.getWeekEnd(date);
        const remoteDaysInWeek = await this.countRemoteDaysInWeek(userId, weekStart, weekEnd, date);

        if (remoteDaysInWeek >= profile.constraints.maxRemoteDaysPerWeek) {
          conflicts.push({
            type: 'constraint_violation',
            severity: 'error',
            message: `Limite hebdomadaire de ${profile.constraints.maxRemoteDaysPerWeek} jours de télétravail atteinte`,
            source: 'weekly_limit',
            resolutionSuggestions: [
              'Choisir un autre jour de la semaine',
              'Demander une exception à votre manager'
            ]
          });
        }
      }

      // 2. Vérifier les règles équipe
      const teamRules = await this.getTeamRulesForUser(userId);
      const conflictingRules = teamRules.filter(rule =>
        this.isRuleActiveOnDate(rule, date) &&
        rule.requiredMode !== requestedMode &&
        !rule.exemptions.includes(userId)
      );

      if (conflictingRules.length > 0) {
        conflictingRules.forEach(rule => {
          conflicts.push({
            type: 'team_rule_conflict',
            severity: 'warning',
            message: `Conflit avec la règle équipe "${rule.name}"`,
            source: rule.id,
            resolutionSuggestions: [
              'Demander une exemption à votre manager',
              'Choisir un autre jour'
            ]
          });
        });
      }

      // 3. Déterminer si approbation nécessaire
      const requiresApproval =
        profile.constraints.requiresApproval ||
        conflicts.some(c => c.type === 'team_rule_conflict') ||
        conflicts.some(c => c.severity === 'error');

      return {
        isValid: conflicts.filter(c => c.severity === 'error').length === 0,
        canProceed: true,
        conflicts,
        requiresApproval
      };

    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      return {
        isValid: false,
        canProceed: false,
        reason: 'Erreur lors de la validation',
        conflicts: [],
        requiresApproval: false
      };
    }
  }

  // =============================================
  // UTILITAIRES
  // =============================================

  /**
   * Générer un ID unique pour une exception
   */
  private generateOverrideId(userId: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${userId}_${year}-${month}-${day}`;
  }

  /**
   * Vérifier si une règle équipe est active à une date donnée
   */
  private isRuleActiveOnDate(rule: TeamTeleworkRule, date: Date): boolean {
    if (!rule.isActive) return false;

    switch (rule.recurrence.type) {
      case 'weekly':
        if (rule.recurrence.weeklyPattern) {
          const dayOfWeek = date.getDay();
          return dayOfWeek === rule.recurrence.weeklyPattern.dayOfWeek;
        }
        break;

      case 'specific_dates':
        if (rule.recurrence.specificDates) {
          return rule.recurrence.specificDates.some(d =>
            d.toDateString() === date.toDateString()
          );
        }
        break;
    }

    return false;
  }

  /**
   * Compter les jours de télétravail dans une semaine
   */
  private async countRemoteDaysInWeek(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
    excludeDate?: Date
  ): Promise<number> {
    const overrides = await this.getUserOverrides(userId, weekStart, weekEnd);

    let count = 0;
    const current = new Date(weekStart);

    while (current <= weekEnd) {
      // Exclure la date spécifiée du décompte
      if (excludeDate && current.toDateString() === excludeDate.toDateString()) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Vérifier s'il y a une exception pour ce jour
      const override = overrides.find(o =>
        o.date.toDate().toDateString() === current.toDateString() &&
        o.approvalStatus === 'approved'
      );

      if (override && override.mode === 'remote') {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Obtenir le début de semaine
   */
  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lundi comme début de semaine
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Obtenir la fin de semaine
   */
  private getWeekEnd(date: Date): Date {
    const end = this.getWeekStart(date);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Nettoyer les exceptions expirées
   */
  async cleanupExpiredOverrides(): Promise<number> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, this.OVERRIDES_COLLECTION),
        where('expiresAt', '<=', now)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return querySnapshot.size;
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      return 0;
    }
  }

  /**
   * Obtenir un profil avec création automatique si inexistant
   */
  async getOrCreateUserProfile(userId: string, displayName: string, createdBy: string): Promise<UserTeleworkProfile> {
    let profile = await this.getUserProfile(userId);

    if (!profile) {
      profile = await this.createDefaultProfile(userId, displayName, createdBy);
    }

    return profile;
  }
}

export const teleworkServiceV2 = new TeleworkServiceV2();