import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Timestamp } from 'firebase/firestore';
import { RootState } from '../store';
import {
  teleworkCalendarService,
  TeleworkDay,
  WeeklyPattern
} from '../services/telework-calendar.service';

export interface UseTeleworkCalendarReturn {
  teleworkDays: Map<string, TeleworkDay>;
  loading: boolean;
  error: string | null;
  toggleDay: (userId: string, date: Date) => Promise<void>;
  removeDay: (userId: string, date: Date) => Promise<void>;
  createWeeklyPattern: (
    userId: string,
    pattern: WeeklyPattern,
    startDate: Date,
    endDate: Date
  ) => Promise<number>;
  refreshPeriod: (startDate: Date, endDate: Date, userIds?: string[]) => Promise<void>;
  getStats: (userId: string, startDate: Date, endDate: Date) => Promise<{
    totalDays: number;
    remoteDays: number;
    officeDays: number;
    remotePercentage: number;
  }>;
}

export const useTeleworkCalendar = (
  initialStartDate: Date,
  initialEndDate: Date,
  userIds: string[] = []
): UseTeleworkCalendarReturn => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [teleworkDays, setTeleworkDays] = useState<Map<string, TeleworkDay>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Génère une clé unique pour un jour donné
  const getDayKey = useCallback((userId: string, date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${userId}_${year}-${month}-${day}`;
  }, []);

  // Charge les données télétravail pour une période et des utilisateurs
  const refreshPeriod = useCallback(async (
    startDate: Date,
    endDate: Date,
    targetUserIds: string[] = []
  ) => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    try {
      const usersToLoad = targetUserIds.length > 0 ? targetUserIds : userIds;
      const allDays = new Map<string, TeleworkDay>();

      // Charger les données pour tous les utilisateurs en parallèle
      await Promise.all(
        usersToLoad.map(async (userId) => {
          try {
            const userDays = await teleworkCalendarService.getUserDays(userId, startDate, endDate);
            userDays.forEach((day, key) => {
              allDays.set(key, day);
            });
          } catch (err) {
            console.error(`Erreur chargement télétravail pour ${userId}:`, err);
          }
        })
      );

      setTeleworkDays(allDays);

    } catch (err) {
      console.error('Erreur lors du chargement télétravail:', err);
      setError('Erreur lors du chargement des données télétravail');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Basculer l'état télétravail d'un jour
  const toggleDay = useCallback(async (userId: string, date: Date) => {
    if (!currentUser) {
      setError('Utilisateur non connecté');
      return;
    }

    try {
      setError(null);

      const newIsRemote = await teleworkCalendarService.toggleDay(userId, date, currentUser.id);
      const dayKey = getDayKey(userId, date);

      // Mettre à jour l'état local
      setTeleworkDays(prev => {
        const updated = new Map(prev);

        if (newIsRemote) {
          // Jour ajouté ou modifié
          const updatedDay: TeleworkDay = {
            id: dayKey,
            userId,
            date,
            isRemote: newIsRemote,
            source: 'user_override',
            createdAt: Timestamp.now(),
            createdBy: currentUser.id
          };
          updated.set(dayKey, updatedDay);
        } else {
          // Si c'était true et maintenant false, on garde l'entrée mais on update
          const existingDay = updated.get(dayKey);
          if (existingDay) {
            updated.set(dayKey, {
              ...existingDay,
              isRemote: false,
              source: 'user_override'
            });
          }
        }

        return updated;
      });

    } catch (err) {
      console.error('Erreur lors du basculement:', err);
      setError('Erreur lors de la modification');
    }
  }, [currentUser, getDayKey]);

  // Supprimer complètement un jour (retour à défaut)
  const removeDay = useCallback(async (userId: string, date: Date) => {
    if (!currentUser) {
      setError('Utilisateur non connecté');
      return;
    }

    try {
      setError(null);

      await teleworkCalendarService.removeDay(userId, date);
      const dayKey = getDayKey(userId, date);

      // Supprimer de l'état local
      setTeleworkDays(prev => {
        const updated = new Map(prev);
        updated.delete(dayKey);
        return updated;
      });

    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression');
    }
  }, [currentUser, getDayKey]);

  // Créer un pattern hebdomadaire
  const createWeeklyPattern = useCallback(async (
    userId: string,
    pattern: WeeklyPattern,
    startDate: Date,
    endDate: Date
  ): Promise<number> => {
    if (!currentUser) {
      setError('Utilisateur non connecté');
      return 0;
    }

    try {
      setError(null);

      const createdCount = await teleworkCalendarService.createWeeklyPattern(
        userId,
        pattern,
        startDate,
        endDate,
        currentUser.id
      );

      // Recharger les données pour cette période
      await refreshPeriod(startDate, endDate, [userId]);

      return createdCount;

    } catch (err) {
      console.error('Erreur lors de la création du pattern:', err);
      setError('Erreur lors de la création du pattern');
      return 0;
    }
  }, [currentUser, refreshPeriod]);

  // Obtenir les statistiques
  const getStats = useCallback(async (
    userId: string,
    startDate: Date,
    endDate: Date
  ) => {
    return await teleworkCalendarService.getStats(userId, startDate, endDate);
  }, []);

  // Chargement télétravail quand les paramètres changent
  useEffect(() => {
    if (!currentUser) return;

    if (userIds.length > 0) {
      console.log('🔄 Chargement télétravail pour users:', userIds.length);

      // Appel direct au service au lieu de refreshPeriod pour éviter la cascade de dépendances
      const loadTeleworkData = async () => {
        setLoading(true);
        setError(null);

        try {
          const allDays = new Map<string, TeleworkDay>();

          await Promise.all(
            userIds.map(async (userId) => {
              try {
                const userDays = await teleworkCalendarService.getUserDays(userId, initialStartDate, initialEndDate);
                userDays.forEach((day, key) => {
                  allDays.set(key, day);
                });
              } catch (err) {
                console.error(`Erreur chargement télétravail pour ${userId}:`, err);
              }
            })
          );

          setTeleworkDays(allDays);
        } catch (err) {
          console.error('Erreur lors du chargement télétravail:', err);
          setError('Erreur lors du chargement des données télétravail');
        } finally {
          setLoading(false);
        }
      };

      loadTeleworkData();
    } else {
      console.log('⚠️ Aucun utilisateur pour charger le télétravail');
    }
  }, [initialStartDate, initialEndDate, userIds, currentUser]);

  return {
    teleworkDays,
    loading,
    error,
    toggleDay,
    removeDay,
    createWeeklyPattern,
    refreshPeriod,
    getStats
  };
};