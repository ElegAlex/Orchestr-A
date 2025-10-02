import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { RootState } from '../store';
import {
  UserTeleworkProfile,
  TeleworkOverride,
  TeleworkDayResolution,
  TeleworkWeekViewData,
  TeleworkMode,
  TeleworkModalState,
  TeleworkStats,
  ValidationResult
} from '../types/telework.types';
import { teleworkServiceV2 } from '../services/telework-v2.service';
import { teleworkResolverService } from '../services/telework-resolver.service';

interface UseTeleworkV2Props {
  userIds: string[];
  dateRange: { start: Date; end: Date };
  autoRefresh?: boolean;
}

interface UseTeleworkV2Return {
  // État des données
  profiles: Map<string, UserTeleworkProfile>;
  weekResolutions: Map<string, TeleworkWeekViewData>;
  pendingOverrides: TeleworkOverride[];

  // État UI
  loading: boolean;
  error: string | null;
  modalState: TeleworkModalState;

  // Actions principales
  refreshData: () => Promise<void>;
  resolveDayMode: (userId: string, date: Date) => Promise<TeleworkDayResolution>;
  requestOverride: (userId: string, date: Date, mode: TeleworkMode, reason?: string) => Promise<string>;
  updateProfile: (userId: string, profile: Partial<UserTeleworkProfile>) => Promise<void>;

  // Actions UI
  openProfileModal: (userId: string) => void;
  openOverrideModal: (userId: string, date: Date) => void;
  openStatsModal: (userId: string) => void;
  closeModal: () => void;

  // Utilitaires
  getResolutionForDay: (userId: string, date: Date) => TeleworkDayResolution | null;
  validateRequest: (userId: string, date: Date, mode: TeleworkMode) => Promise<ValidationResult>;
  getStats: (userId: string, startDate: Date, endDate: Date) => Promise<TeleworkStats>;

  // Gestion des approbations (pour managers)
  approveOverride: (overrideId: string, reason?: string) => Promise<void>;
  rejectOverride: (overrideId: string, reason: string) => Promise<void>;
}

export const useTeleworkV2 = ({
  userIds,
  dateRange,
  autoRefresh = true
}: UseTeleworkV2Props): UseTeleworkV2Return => {

  const currentUser = useSelector((state: RootState) => state.auth.user);

  // État local
  const [profiles, setProfiles] = useState<Map<string, UserTeleworkProfile>>(new Map());
  const [weekResolutions, setWeekResolutions] = useState<Map<string, TeleworkWeekViewData>>(new Map());
  const [pendingOverrides, setPendingOverrides] = useState<TeleworkOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<TeleworkModalState>({ isOpen: false, mode: 'profile' });

  const stableUserIds = useMemo(() => userIds, [userIds.join(',')]);
  const { start: periodStart, end: periodEnd } = dateRange;

  // Chargement des données
  const loadProfiles = useCallback(async () => {
    if (!currentUser || stableUserIds.length === 0) return;

    try {
      const profilesMap = new Map<string, UserTeleworkProfile>();

      await Promise.all(
        stableUserIds.map(async (userId) => {
          try {
            let profile = await teleworkServiceV2.getUserProfile(userId);

            if (!profile) {
              const userDisplayName = `User ${userId}`;
              profile = await teleworkServiceV2.getOrCreateUserProfile(userId, userDisplayName, currentUser.id);
            }

            profilesMap.set(userId, profile);
          } catch (err: any) {
            console.error(`Erreur chargement profil ${userId}:`, err);
          }
        })
      );

      setProfiles(profilesMap);
    } catch (err: any) {
      console.error('Erreur lors du chargement des profils:', err);
      setError('Erreur lors du chargement des profils télétravail');
    }
  }, [currentUser, stableUserIds]);

  const loadWeekResolutions = useCallback(async () => {
    if (stableUserIds.length === 0) return;

    try {
      const resolutionsMap = new Map<string, TeleworkWeekViewData>();

      // Charger les vraies données depuis la BDD
      await Promise.all(
        stableUserIds.map(async (userId) => {
          try {
            // Charger les overrides pour toute la période visible
            const overrides = await teleworkServiceV2.getUserOverrides(userId, periodStart, periodEnd);
            const profile = profiles.get(userId);
            const days = [];

            // Générer tous les jours de la période avec les vraies données
            const dayCount = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            for (let i = 0; i < dayCount; i++) {
              const currentDate = addDays(periodStart, i);
              const dayOfWeek = currentDate.getDay();
              const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

              // Chercher un override pour ce jour
              const override = overrides.find(o => isSameDay(o.date.toDate(), currentDate));

              let resolvedMode: 'office' | 'remote' = 'office';
              let source = 'default';

              if (override && override.approvalStatus === 'approved') {
                // Override approuvé
                resolvedMode = override.mode;
                source = 'override';
              } else if (profile?.weeklyPattern && !isWeekendDay) {
                // Pattern du profil
                const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek] as keyof typeof profile.weeklyPattern;
                const dayPattern = profile.weeklyPattern[dayName];
                if (dayPattern === 'remote') resolvedMode = 'remote';
                else if (dayPattern === 'office') resolvedMode = 'office';
                else resolvedMode = profile.defaultMode || 'office';
                source = 'pattern';
              }

              days.push({
                date: currentDate,
                userId,
                resolvedMode: isWeekendDay ? 'office' : resolvedMode,
                source: source as any,
                confidence: 100,
                conflicts: [],
                warnings: [],
                appliedRules: { override, profile }
              });
            }

            resolutionsMap.set(userId, {
              weekStart: periodStart,
              weekEnd: periodEnd,
              days,
              weeklyStats: {
                remoteDays: days.filter(d => d.resolvedMode === 'remote').length,
                officeDays: days.filter(d => d.resolvedMode === 'office').length,
                conflicts: 0,
                pendingApprovals: overrides.filter(o => o.approvalStatus === 'pending').length
              }
            });
          } catch (err: any) {
            console.error(`Erreur résolution semaine ${userId}:`, err);
          }
        })
      );

      setWeekResolutions(resolutionsMap);
    } catch (err: any) {
      console.error('Erreur lors de la résolution des semaines:', err);
      setError('Erreur lors du calcul des plannings');
    }
  }, [stableUserIds, periodStart, periodEnd, profiles]);

  const loadPendingOverrides = useCallback(async () => {
    if (!currentUser) return;

    try {
      const overrides = await teleworkServiceV2.getPendingOverrides(currentUser.id);
      setPendingOverrides(overrides);
    } catch (err) {
      console.error('Erreur chargement des approbations:', err);
    }
  }, [currentUser]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Charger les profils d'abord
      await loadProfiles();
      // Puis les résolutions basées sur les profils
      await loadWeekResolutions();
      // Enfin les approbations
      await loadPendingOverrides();
    } finally {
      setLoading(false);
    }
  }, [loadProfiles, loadWeekResolutions, loadPendingOverrides]);

  // Actions principales
  const resolveDayMode = useCallback(async (userId: string, date: Date): Promise<TeleworkDayResolution> => {
    try {
      return await teleworkResolverService.resolveDayMode(userId, date);
    } catch (err) {
      console.error('Erreur résolution jour:', err);
      throw err;
    }
  }, []);

  const requestOverride = useCallback(async (
    userId: string,
    date: Date,
    mode: TeleworkMode,
    reason?: string
  ): Promise<string> => {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      const validation = await teleworkServiceV2.validateOverrideRequest(userId, date, mode);

      if (!validation.isValid && validation.conflicts.some(c => c.severity === 'error')) {
        throw new Error(validation.reason || 'Demande non valide');
      }

      const overrideId = await teleworkServiceV2.requestOverride({
        userId,
        date: Timestamp.fromDate(date),
        mode,
        reason,
        source: 'user_request',
        priority: 1,
        createdBy: currentUser.id
      });

      await refreshData();
      return overrideId;
    } catch (err) {
      console.error('Erreur création demande:', err);
      throw err;
    }
  }, [currentUser, refreshData]);

  const updateProfile = useCallback(async (
    userId: string,
    profileUpdates: Partial<UserTeleworkProfile>
  ): Promise<void> => {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      await teleworkServiceV2.updateUserProfile(userId, profileUpdates, currentUser.id);
      await refreshData();
    } catch (err) {
      console.error('Erreur mise à jour profil:', err);
      throw err;
    }
  }, [currentUser, refreshData]);

  // Actions UI
  const openProfileModal = useCallback((userId: string) => {
    setModalState({
      isOpen: true,
      mode: 'profile',
      targetUserId: userId,
      data: profiles.get(userId)
    });
  }, [profiles]);

  const openOverrideModal = useCallback((userId: string, date: Date) => {
    setModalState({
      isOpen: true,
      mode: 'override',
      targetUserId: userId,
      selectedDate: date
    });
  }, []);

  const openStatsModal = useCallback((userId: string) => {
    setModalState({
      isOpen: true,
      mode: 'stats',
      targetUserId: userId
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, mode: 'profile' });
  }, []);

  // Utilitaires
  const getResolutionForDay = useCallback((userId: string, date: Date): TeleworkDayResolution | null => {
    const weekData = weekResolutions.get(userId);
    if (!weekData) {
      // Retourner une résolution par défaut
      return {
        date,
        userId,
        resolvedMode: 'office',
        source: 'default',
        confidence: 100,
        conflicts: [],
        warnings: [],
        appliedRules: {}
      };
    }

    return weekData.days.find(day => isSameDay(day.date, date)) || {
      date,
      userId,
      resolvedMode: 'office',
      source: 'default',
      confidence: 100,
      conflicts: [],
      warnings: [],
      appliedRules: {}
    };
  }, [weekResolutions]);

  const validateRequest = useCallback(async (
    userId: string,
    date: Date,
    mode: TeleworkMode
  ): Promise<ValidationResult> => {
    try {
      return await teleworkServiceV2.validateOverrideRequest(userId, date, mode);
    } catch (err) {
      console.error('Erreur validation:', err);
      return {
        isValid: false,
        canProceed: false,
        reason: 'Erreur lors de la validation',
        conflicts: [],
        requiresApproval: false
      };
    }
  }, []);

  const getStats = useCallback(async (
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeleworkStats> => {
    try {
      return await teleworkResolverService.calculateStats(userId, startDate, endDate);
    } catch (err) {
      console.error('Erreur calcul stats:', err);
      throw err;
    }
  }, []);

  // Gestion des approbations
  const approveOverride = useCallback(async (overrideId: string, reason?: string): Promise<void> => {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      await teleworkServiceV2.approveOverride(overrideId, currentUser.id, reason);
      await refreshData();
    } catch (err) {
      console.error('Erreur approbation:', err);
      throw err;
    }
  }, [currentUser, refreshData]);

  const rejectOverride = useCallback(async (overrideId: string, reason: string): Promise<void> => {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      await teleworkServiceV2.rejectOverride(overrideId, currentUser.id, reason);
      await refreshData();
    } catch (err) {
      console.error('Erreur rejet:', err);
      throw err;
    }
  }, [currentUser, refreshData]);

  // Effets
  useEffect(() => {
    if (stableUserIds.length > 0 && currentUser) {
      refreshData();
    }
  }, [stableUserIds, currentUser, periodStart, periodEnd, refreshData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (!loading) {
        loadPendingOverrides();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, loading, loadPendingOverrides]);

  return {
    // État des données
    profiles,
    weekResolutions,
    pendingOverrides,

    // État UI
    loading,
    error,
    modalState,

    // Actions principales
    refreshData,
    resolveDayMode,
    requestOverride,
    updateProfile,

    // Actions UI
    openProfileModal,
    openOverrideModal,
    openStatsModal,
    closeModal,

    // Utilitaires
    getResolutionForDay,
    validateRequest,
    getStats,

    // Gestion des approbations
    approveOverride,
    rejectOverride
  };
};