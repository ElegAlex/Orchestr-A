import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface CacheData {
  projects: any[];
  tasks: any[];
  users: any[];
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheData>();

export const useDashboardCache = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CacheData | null>(null);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return null;

    const cacheKey = `dashboard-${user.id}`;
    const cached = cache.get(cacheKey);
    
    // Utiliser le cache si valide et pas de refresh forcé
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached);
      return cached;
    }

    setLoading(true);
    try {
      // Charger les données en parallèle avec des limites strictes
      const [projectsSnapshot, tasksSnapshot, usersSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'projects'),
          where('teamMembers', 'array-contains', user.id),
          where('status', 'in', ['active', 'in_progress']),
          orderBy('updatedAt', 'desc'),
          limit(10)
        )),
        getDocs(query(
          collection(db, 'tasks'),
          where('assigneeId', '==', user.id),
          where('status', 'in', ['TODO', 'IN_PROGRESS']),
          orderBy('priority', 'asc'),
          limit(20)
        )),
        getDocs(query(
          collection(db, 'users'),
          where('isActive', '==', true),
          limit(50)
        ))
      ]);

      const newData: CacheData = {
        projects: projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        tasks: tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        users: usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        timestamp: Date.now()
      };

      // Mettre en cache
      cache.set(cacheKey, newData);
      setData(newData);
      return newData;
    } catch (error) {
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Pré-charger les données au montage
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Nettoyer le cache périodiquement
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      cache.forEach((value, key) => {
        if (now - value.timestamp > CACHE_DURATION * 2) {
          cache.delete(key);
        }
      });
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, []);

  return {
    data,
    loading,
    refresh: () => loadDashboardData(true)
  };
};

// Hook pour pré-charger les métriques communes
export const usePreloadMetrics = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadMetrics = async () => {
      const cacheKey = `metrics-${user.id}`;
      const cached = cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setMetrics(cached);
        return;
      }

      try {
        // Calculer les métriques de base une seule fois
        const [tasksSnapshot, projectsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'tasks'),
            where('assigneeId', '==', user.id),
            limit(100)
          )),
          getDocs(query(
            collection(db, 'projects'),
            where('teamMembers', 'array-contains', user.id),
            limit(20)
          ))
        ]);

        const tasks = tasksSnapshot.docs.map(doc => doc.data());
        const projects = projectsSnapshot.docs.map(doc => doc.data());

        const metrics = {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'DONE').length,
          inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
          todoTasks: tasks.filter(t => t.status === 'TODO').length,
          activeProjects: projects.filter(p => ['active', 'in_progress'].includes(p.status)).length,
          completionRate: tasks.length > 0 
            ? Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
            : 0,
          timestamp: Date.now()
        };

        cache.set(cacheKey, metrics as any);
        setMetrics(metrics);
      } catch (error) {
        
      }
    };

    loadMetrics();
  }, [user]);

  return metrics;
};