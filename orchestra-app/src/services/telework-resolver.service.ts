import {
  startOfWeek,
  endOfWeek,
  format,
  addDays,
  isSameDay,
  isWeekend
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  UserTeleworkProfile,
  TeleworkOverride,
  TeamTeleworkRule,
  TeleworkDayResolution,
  TeleworkMode,
  WeekdayKey,
  WEEKDAYS,
  TeleworkConflict,
  TeleworkWeekViewData,
  TeleworkStats
} from '../types/telework.types';
import { teleworkServiceV2 } from './telework-v2.service';

class TeleworkResolverService {

  // =============================================
  // RÉSOLUTION JOUR PAR JOUR
  // =============================================

  /**
   * Résoudre le mode télétravail pour un jour donné
   */
  async resolveDayMode(userId: string, date: Date): Promise<TeleworkDayResolution> {
    try {
      // 1. Récupérer toutes les données nécessaires
      const [profile, overrides, teamRules] = await Promise.all([
        teleworkServiceV2.getUserProfile(userId),
        teleworkServiceV2.getUserOverrides(userId, date, date),
        teleworkServiceV2.getTeamRulesForUser(userId)
      ]);

      if (!profile) {
        return this.createErrorResolution(userId, date, 'Profil télétravail non trouvé');
      }

      // 2. Appliquer la hiérarchie de résolution
      const resolution = this.applyResolutionHierarchy(date, profile, overrides, teamRules);

      // 3. Détecter les conflits
      const conflicts = this.detectConflicts(date, profile, overrides, teamRules);

      return {
        date,
        userId,
        resolvedMode: resolution.mode,
        source: resolution.source,
        confidence: resolution.confidence,
        appliedRules: {
          profile,
          override: overrides[0] || undefined,
          teamRules: teamRules.filter(rule => this.isRuleActiveOnDate(rule, date))
        },
        conflicts,
        warnings: this.generateWarnings(date, profile, resolution, conflicts)
      };

    } catch (error) {
      console.error('Erreur lors de la résolution du jour:', error);
      return this.createErrorResolution(userId, date, 'Erreur lors de la résolution');
    }
  }

  /**
   * Résoudre une semaine complète
   */
  async resolveWeekMode(userId: string, weekStart: Date): Promise<TeleworkWeekViewData> {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Lundi = début de semaine
    const days: TeleworkDayResolution[] = [];

    // Résoudre chaque jour de la semaine
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(weekStart, i);
      const resolution = await this.resolveDayMode(userId, currentDate);
      days.push(resolution);
    }

    // Calculer les statistiques de la semaine
    const weeklyStats = {
      remoteDays: days.filter(d => d.resolvedMode === 'remote').length,
      officeDays: days.filter(d => d.resolvedMode === 'office').length,
      conflicts: days.reduce((sum, d) => sum + d.conflicts.length, 0),
      pendingApprovals: days.filter(d =>
        d.appliedRules.override?.approvalStatus === 'pending'
      ).length
    };

    return {
      weekStart,
      weekEnd,
      days,
      weeklyStats
    };
  }

  /**
   * Résoudre une période donnée (pour export ou stats)
   */
  async resolvePeriodMode(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeleworkDayResolution[]> {
    const resolutions: TeleworkDayResolution[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Exclure les weekends par défaut (configurable)
      if (!isWeekend(currentDate)) {
        const resolution = await this.resolveDayMode(userId, new Date(currentDate));
        resolutions.push(resolution);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return resolutions;
  }

  // =============================================
  // LOGIQUE DE HIÉRARCHIE
  // =============================================

  /**
   * Appliquer la hiérarchie de résolution
   * Ordre: Admin Override > Team Rule > User Override > Weekly Pattern > Default Mode
   */
  private applyResolutionHierarchy(
    date: Date,
    profile: UserTeleworkProfile,
    overrides: TeleworkOverride[],
    teamRules: TeamTeleworkRule[]
  ): { mode: TeleworkMode; source: 'default' | 'pattern' | 'override' | 'team_rule' | 'admin_imposed'; confidence: number } {

    // 1. Vérifier les overrides admin (priorité absolue)
    const adminOverride = overrides.find(o =>
      o.source === 'admin_imposed' &&
      o.approvalStatus === 'approved' &&
      isSameDay(o.date.toDate(), date)
    );

    if (adminOverride) {
      return {
        mode: adminOverride.mode,
        source: 'admin_imposed',
        confidence: 100
      };
    }

    // 2. Vérifier les règles équipe actives
    const activeTeamRules = teamRules.filter(rule =>
      this.isRuleActiveOnDate(rule, date) &&
      !rule.exemptions.includes(profile.userId)
    );

    if (activeTeamRules.length > 0) {
      // Prendre la règle avec la priorité la plus haute
      const highestPriorityRule = activeTeamRules.reduce((prev, current) =>
        current.priority > prev.priority ? current : prev
      );

      return {
        mode: highestPriorityRule.requiredMode,
        source: 'team_rule',
        confidence: 90
      };
    }

    // 3. Vérifier les overrides utilisateur approuvés
    const userOverride = overrides.find(o =>
      o.source === 'user_request' &&
      o.approvalStatus === 'approved' &&
      isSameDay(o.date.toDate(), date)
    );

    if (userOverride) {
      return {
        mode: userOverride.mode,
        source: 'override',
        confidence: 85
      };
    }

    // 4. Appliquer le pattern hebdomadaire
    const dayOfWeek = WEEKDAYS[date.getDay()] as WeekdayKey;
    const dayPattern = profile.weeklyPattern[dayOfWeek];

    if (dayPattern !== 'default') {
      return {
        mode: dayPattern as TeleworkMode,
        source: 'pattern',
        confidence: 80
      };
    }

    // 5. Mode par défaut
    return {
      mode: profile.defaultMode,
      source: 'default',
      confidence: 70
    };
  }

  // =============================================
  // DÉTECTION DE CONFLITS
  // =============================================

  /**
   * Détecter les conflits potentiels
   */
  private detectConflicts(
    date: Date,
    profile: UserTeleworkProfile,
    overrides: TeleworkOverride[],
    teamRules: TeamTeleworkRule[]
  ): TeleworkConflict[] {
    const conflicts: TeleworkConflict[] = [];

    // 1. Conflits entre overrides et team rules
    const userOverride = overrides.find(o =>
      o.source === 'user_request' &&
      isSameDay(o.date.toDate(), date)
    );

    const activeTeamRule = teamRules.find(rule =>
      this.isRuleActiveOnDate(rule, date) &&
      !rule.exemptions.includes(profile.userId)
    );

    if (userOverride && activeTeamRule && userOverride.mode !== activeTeamRule.requiredMode) {
      conflicts.push({
        type: 'team_rule_conflict',
        severity: userOverride.approvalStatus === 'pending' ? 'warning' : 'info',
        message: `Conflit entre demande utilisateur (${userOverride.mode}) et règle équipe (${activeTeamRule.requiredMode})`,
        source: activeTeamRule.id,
        resolutionSuggestions: [
          'La règle équipe prend la priorité',
          'Demander une exemption au manager'
        ]
      });
    }

    // 2. Violations de contraintes
    if (userOverride && userOverride.mode === 'remote') {
      // Vérification asynchrone des limites hebdomadaires serait nécessaire ici
      // Pour simplifier, on ajoute un avertissement générique
      conflicts.push({
        type: 'constraint_violation',
        severity: 'info',
        message: 'Vérifier la limite hebdomadaire de télétravail',
        source: 'weekly_limit',
        resolutionSuggestions: ['Consulter le planning de la semaine']
      });
    }

    // 3. Demandes en attente d'approbation
    if (userOverride && userOverride.approvalStatus === 'pending') {
      conflicts.push({
        type: 'approval_required',
        severity: 'info',
        message: 'Demande en attente d\'approbation',
        source: userOverride.id,
        resolutionSuggestions: ['Contacter votre manager']
      });
    }

    return conflicts;
  }

  // =============================================
  // GÉNÉRATION D'ALERTES ET AVERTISSEMENTS
  // =============================================

  /**
   * Générer des avertissements contextuels
   */
  private generateWarnings(
    date: Date,
    profile: UserTeleworkProfile,
    resolution: { mode: TeleworkMode; source: 'default' | 'pattern' | 'override' | 'team_rule' | 'admin_imposed'; confidence: number },
    conflicts: TeleworkConflict[]
  ): string[] {
    const warnings: string[] = [];

    // Avertissement de confiance faible
    if (resolution.confidence < 80) {
      warnings.push('Résolution incertaine - vérifier les règles');
    }

    // Avertissement weekend
    if (isWeekend(date) && resolution.mode === 'remote') {
      warnings.push('Travail en weekend détecté');
    }

    // Avertissement pattern par défaut
    if (resolution.source === 'default' && profile.defaultMode === 'remote') {
      warnings.push('Mode télétravail par défaut - vérifier si approprié');
    }

    // Avertissements de conflits
    if (conflicts.length > 0) {
      warnings.push(`${conflicts.length} conflit(s) détecté(s)`);
    }

    return warnings;
  }

  // =============================================
  // STATISTIQUES ET ANALYTICS
  // =============================================

  /**
   * Calculer les statistiques télétravail pour une période
   */
  async calculateStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeleworkStats> {
    const resolutions = await this.resolvePeriodMode(userId, startDate, endDate);

    const totalWorkDays = resolutions.length;
    const remoteDays = resolutions.filter(r => r.resolvedMode === 'remote').length;
    const officeDays = totalWorkDays - remoteDays;
    const remotePercentage = totalWorkDays > 0 ? Math.round((remoteDays / totalWorkDays) * 100) : 0;

    // Breakdown par source
    const bySource = resolutions.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Breakdown par jour de la semaine
    const byWeekday = resolutions.reduce((acc, r) => {
      const dayName = format(r.date, 'EEEE', { locale: fr }).toLowerCase();
      if (!acc[dayName]) {
        acc[dayName] = { remote: 0, office: 0 };
      }
      acc[dayName][r.resolvedMode]++;
      return acc;
    }, {} as Record<string, { remote: number; office: number }>);

    // Violations et conflits
    const violations = resolutions.flatMap(r => r.conflicts);

    return {
      userId,
      period: { start: startDate, end: endDate },
      summary: {
        totalWorkDays,
        remoteDays,
        officeDays,
        remotePercentage,
        averageRemoteDaysPerWeek: totalWorkDays > 0 ? (remoteDays / (totalWorkDays / 5)) : 0
      },
      breakdown: {
        bySource,
        byWeekday,
        trends: {
          lastMonth: 0, // À implémenter
          currentMonth: remoteDays,
          change: 0
        }
      },
      compliance: {
        withinLimits: violations.filter(v => v.severity === 'error').length === 0,
        exceedDays: Math.max(0, remoteDays - 10), // Exemple de limite
        violations
      }
    };
  }

  // =============================================
  // UTILITAIRES
  // =============================================

  /**
   * Vérifier si une règle équipe est active à une date
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

      case 'monthly':
        if (rule.recurrence.monthlyPattern) {
          return date.getDate() === rule.recurrence.monthlyPattern.dayOfMonth;
        }
        break;

      case 'specific_dates':
        if (rule.recurrence.specificDates) {
          return rule.recurrence.specificDates.some(d =>
            isSameDay(d, date)
          );
        }
        break;
    }

    return false;
  }

  /**
   * Créer une résolution d'erreur
   */
  private createErrorResolution(
    userId: string,
    date: Date,
    errorMessage: string
  ): TeleworkDayResolution {
    return {
      date,
      userId,
      resolvedMode: 'office', // Mode par défaut en cas d'erreur
      source: 'default',
      confidence: 0,
      appliedRules: {},
      conflicts: [{
        type: 'constraint_violation',
        severity: 'error',
        message: errorMessage,
        source: 'system',
        resolutionSuggestions: ['Contacter le support technique']
      }],
      warnings: ['Erreur lors de la résolution - mode bureau par défaut appliqué']
    };
  }

  /**
   * Prévisualiser l'impact d'un changement de pattern
   */
  async previewPatternChange(
    userId: string,
    newPattern: UserTeleworkProfile['weeklyPattern'],
    startDate: Date,
    endDate: Date
  ): Promise<{
    current: TeleworkDayResolution[];
    preview: TeleworkDayResolution[];
    changes: number;
  }> {
    // Résolution actuelle
    const current = await this.resolvePeriodMode(userId, startDate, endDate);

    // Simulation avec nouveau pattern
    const profile = await teleworkServiceV2.getUserProfile(userId);
    if (!profile) {
      throw new Error('Profil non trouvé');
    }

    const tempProfile = { ...profile, weeklyPattern: newPattern };
    const preview: TeleworkDayResolution[] = [];

    // Simuler chaque jour avec le nouveau pattern
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (!isWeekend(currentDate)) {
        const dayOfWeek = WEEKDAYS[currentDate.getDay()] as WeekdayKey;
        const dayPattern = newPattern[dayOfWeek];

        const mode = dayPattern !== 'default' ? dayPattern as TeleworkMode : profile.defaultMode;

        preview.push({
          date: new Date(currentDate),
          userId,
          resolvedMode: mode,
          source: dayPattern !== 'default' ? 'pattern' : 'default',
          confidence: 80,
          appliedRules: { profile: tempProfile },
          conflicts: [],
          warnings: []
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Compter les changements
    const changes = current.reduce((count, curr, index) => {
      const prev = preview[index];
      return prev && curr.resolvedMode !== prev.resolvedMode ? count + 1 : count;
    }, 0);

    return { current, preview, changes };
  }
}

export const teleworkResolverService = new TeleworkResolverService();