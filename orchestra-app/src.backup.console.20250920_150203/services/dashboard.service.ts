import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { analyticsService, KPIMetric } from './analytics.service';
import { startOfDay, endOfDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// =======================================================================================
// TYPES & INTERFACES
// =======================================================================================

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'progress' | 'alert' | 'activity';
  title: string;
  subtitle?: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number; w: number; h: number };
  config: WidgetConfig;
  permissions: string[];
  lastUpdated: Date;
}

export interface WidgetConfig {
  // Configuration KPI
  metric?: string;
  threshold?: { warning: number; critical: number };
  format?: 'number' | 'percentage' | 'currency' | 'time';
  
  // Configuration graphique
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'funnel';
  dataSource?: string;
  dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  filters?: { [key: string]: any };
  
  // Configuration tableau
  columns?: ColumnConfig[];
  maxRows?: number;
  sortBy?: string;
  
  // Configuration activité
  activityType?: 'tasks' | 'projects' | 'users';
  maxItems?: number;
}

export interface ColumnConfig {
  key: string;
  title: string;
  type: 'text' | 'number' | 'date' | 'status' | 'user' | 'progress';
  sortable?: boolean;
  width?: string;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  permissions: {
    view: string[];
    edit: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RealtimeMetric {
  key: string;
  value: number | string;
  timestamp: Date;
  metadata?: { [key: string]: any };
}

export interface ActivityFeedItem {
  id: string;
  type: 'task_completed' | 'project_created' | 'user_joined' | 'alert_triggered';
  title: string;
  description: string;
  userId?: string;
  userName?: string;
  entityId?: string;
  entityType?: string;
  timestamp: Date;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export interface DashboardAlert {
  id: string;
  type: 'deadline' | 'budget' | 'resource' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  threshold?: number;
  currentValue?: number;
  isRead: boolean;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}

// Types de compatibilité avec l'ancien service
export interface DashboardStats {
  activeProjects: number;
  activeTasks: number;
  teamMembers: number;
  completionRate: number;
}

export interface RecentProject {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: 'active' | 'review' | 'completed' | 'on_hold';
  deadline: Date;
  teamMembers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskSummary {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueDate: Date;
  projectName: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed';
}

export interface TeamMemberWorkload {
  userId: string;
  displayName: string;
  email: string;
  workload: number;
  activeProjects: number;
  role: string;
}

// =======================================================================================
// SERVICE PRINCIPAL
// =======================================================================================

class DashboardService {
  private readonly DASHBOARDS_COLLECTION = 'dashboards';
  private readonly WIDGETS_COLLECTION = 'dashboard_widgets';
  private readonly METRICS_COLLECTION = 'realtime_metrics';
  private readonly ACTIVITIES_COLLECTION = 'activity_feed';
  private readonly ALERTS_COLLECTION = 'dashboard_alerts';

  // Listeners temps réel
  private metricsListeners: Map<string, () => void> = new Map();
  private activityListeners: Map<string, () => void> = new Map();

  // =======================================================================================
  // MÉTHODES DE COMPATIBILITÉ (ancien service)
  // =======================================================================================

  /**
   * Obtenir les statistiques du dashboard (compatibilité)
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    try {
      // Utilisation de Promise.all pour des requêtes parallèles
      const [
        activeProjectsSnapshot,
        activeTasksSnapshot,
        teamSnapshot,
        completedTasksSnapshot
      ] = await Promise.all([
        // Projets actifs - requête simplifiée
        getDocs(query(
          collection(db, 'projects'),
          where('status', 'in', ['active', 'in_progress']),
          where('teamMembers', 'array-contains', userId),
          limit(20) // Limiter pour les performances
        )),
        
        // Tâches actives - requête simplifiée
        getDocs(query(
          collection(db, 'tasks'),
          where('assigneeId', '==', userId),
          where('status', 'in', ['TODO', 'IN_PROGRESS']),
          limit(50) // Limiter pour les performances
        )),
        
        // Membres de l'équipe - requête limitée
        getDocs(query(
          collection(db, 'users'),
          where('isActive', '==', true),
          limit(100) // Limiter pour les performances
        )),
        
        // Tâches complétées - requête limitée
        getDocs(query(
          collection(db, 'tasks'),
          where('assigneeId', '==', userId),
          where('status', '==', 'DONE'),
          limit(50) // Limiter pour les performances
        ))
      ]);

      const activeProjects = activeProjectsSnapshot.size;
      const activeTasks = activeTasksSnapshot.size;
      const teamMembers = teamSnapshot.size;
      const completedTasks = completedTasksSnapshot.size;

      const totalTasks = activeTasks + completedTasks;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        activeProjects,
        activeTasks,
        teamMembers,
        completionRate,
      };
    } catch (error) {
      
      return {
        activeProjects: 0,
        activeTasks: 0,
        teamMembers: 0,
        completionRate: 0,
      };
    }
  }

  /**
   * Obtenir les projets récents (compatibilité)
   */
  async getRecentProjects(userId: string): Promise<RecentProject[]> {
    try {
      // Requête optimisée: filtrer directement par teamMembers
      const q = query(
        collection(db, 'projects'),
        where('teamMembers', 'array-contains', userId),
        orderBy('updatedAt', 'desc'),
        limit(5) // Limiter directement à 5 projets
      );
      
      const snapshot = await getDocs(q);
      const projects: RecentProject[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const progress = data.progress || 0;

        projects.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || '',
          progress,
          status: data.status || 'active',
          deadline: data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline),
          teamMembers: data.teamMembers || [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        });
      }

      return projects;
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Obtenir les tâches à venir (compatibilité)
   */
  async getUpcomingTasks(userId: string): Promise<TaskSummary[]> {
    try {
      // Requête optimisée: filtrer directement par statut
      const q = query(
        collection(db, 'tasks'),
        where('assigneeId', '==', userId),
        where('status', 'in', ['TODO', 'IN_PROGRESS']),
        limit(5) // Limiter directement à 5 tâches
      );
      
      const snapshot = await getDocs(q);
      
      // Récupérer les IDs de projets uniques
      const projectIds = new Set<string>();
      const tasksData: any[] = [];
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.projectId) {
          projectIds.add(data.projectId);
        }
        tasksData.push({ id: docSnap.id, ...data });
      });

      // Récupérer tous les projets en une seule requête
      const projectsMap = new Map<string, string>();
      if (projectIds.size > 0) {
        const projectsQuery = query(
          collection(db, 'projects'),
          where('__name__', 'in', Array.from(projectIds))
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        projectsSnapshot.docs.forEach(doc => {
          projectsMap.set(doc.id, doc.data().name);
        });
      }

      // Construire la liste des tâches
      const tasks: TaskSummary[] = tasksData.map(data => ({
        id: data.id,
        title: data.title,
        priority: data.priority || 'P2',
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
        projectName: projectsMap.get(data.projectId) || 'Projet inconnu',
        status: data.status === 'TODO' ? 'todo' : data.status === 'IN_PROGRESS' ? 'in_progress' : data.status.toLowerCase(),
      }));

      // Trier par date d'échéance
      tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      return tasks;
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Obtenir les tâches groupées par projet (vue utilisateur)
   */
  async getTasksByProject(userId: string): Promise<{ [projectId: string]: { projectName: string; tasks: (TaskSummary & { estimatedHours?: number; loggedHours?: number })[] } }> {
    try {
      // Récupérer d'abord les projets où l'utilisateur participe
      const userProjectsQuery = query(
        collection(db, 'projects'),
        where('teamMembers', 'array-contains', userId)
      );
      const userProjectsSnapshot = await getDocs(userProjectsQuery);
      
      const projectsMap: { [key: string]: string } = {};
      userProjectsSnapshot.docs.forEach(doc => {
        projectsMap[doc.id] = doc.data().name;
      });

      // Si aucun projet actif, retourner un objet vide
      const projectIds = Object.keys(projectsMap);
      if (projectIds.length === 0) {
        return {};
      }

      // Récupérer toutes les tâches non clôturées dans ces projets
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('status', 'in', ['TODO', 'IN_PROGRESS', 'BACKLOG']),
        where('projectId', 'in', projectIds)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const groupedTasks: { [projectId: string]: { projectName: string; tasks: (TaskSummary & { estimatedHours?: number; loggedHours?: number })[] } } = {};

      for (const taskDoc of tasksSnapshot.docs) {
        const data = taskDoc.data();
        const projectId = data.projectId;
        const projectName = projectsMap[projectId] || 'Projet inconnu';

        if (!groupedTasks[projectId]) {
          groupedTasks[projectId] = {
            projectName,
            tasks: []
          };
        }

        groupedTasks[projectId].tasks.push({
          id: taskDoc.id,
          title: data.title,
          priority: data.priority || 'P2',
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
          projectName,
          status: data.status,
          estimatedHours: data.estimatedHours,
          loggedHours: data.loggedHours
        });
      }

      // Trier les tâches par échéance dans chaque projet
      Object.keys(groupedTasks).forEach(projectId => {
        groupedTasks[projectId].tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      });

      return groupedTasks;
    } catch (error) {
      
      return {};
    }
  }

  /**
   * Sauvegarder une entrée de temps de travail
   */
  async saveTimeEntry(timeEntry: {
    taskId: string;
    userId: string;
    date: Date;
    hours: number;
    description?: string;
  }): Promise<void> {
    try {
      // Sauvegarder l'entrée de temps
      await addDoc(collection(db, 'time_entries'), {
        ...timeEntry,
        date: Timestamp.fromDate(timeEntry.date),
        createdAt: serverTimestamp()
      });

      // Mettre à jour les heures loggées dans la tâche
      const taskRef = doc(db, 'tasks', timeEntry.taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const currentLoggedHours = taskSnap.data().loggedHours || 0;
        await updateDoc(taskRef, {
          loggedHours: currentLoggedHours + timeEntry.hours,
          updatedAt: serverTimestamp()
        });
      }

      // Ajouter à l'activité
      await this.addActivityFeedItem({
        type: 'task_completed',
        title: `Temps saisi: ${timeEntry.hours}h`,
        description: timeEntry.description || 'Temps de travail enregistré',
        userId: timeEntry.userId,
        entityId: timeEntry.taskId,
        entityType: 'task',
        severity: 'info'
      });
    } catch (error) {
      console.error('Error saving time entry:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'une tâche
   */
  async updateTaskStatus(taskId: string, newStatus: string, userId?: string): Promise<void> {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      if (userId) {
        await this.addActivityFeedItem({
          type: 'task_completed',
          title: `Statut mis à jour`,
          description: `Tâche passée en ${newStatus}`,
          userId,
          entityId: taskId,
          entityType: 'task',
          severity: 'info'
        });
      }
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir la charge de travail de l'équipe (compatibilité)
   */
  async getTeamWorkload(): Promise<TeamMemberWorkload[]> {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('isActive', '==', true),
        limit(10)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const workloads: TeamMemberWorkload[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        const projectsQuery = query(
          collection(db, 'projects'),
          where('teamMembers', 'array-contains', userDoc.id),
          where('status', 'in', ['active', 'in_progress'])
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        const activeProjects = projectsSnapshot.size;

        const tasksQuery = query(
          collection(db, 'tasks'),
          where('assigneeId', '==', userDoc.id),
          where('status', 'in', ['todo', 'in_progress'])
        );
        const tasksSnapshot = await getDocs(tasksQuery);
        const activeTasks = tasksSnapshot.size;

        const workload = Math.min((activeTasks * 15) + (activeProjects * 10), 100);

        workloads.push({
          userId: userDoc.id,
          displayName: userData.displayName,
          email: userData.email,
          workload,
          activeProjects,
          role: userData.role,
        });
      }

      return workloads.sort((a, b) => b.workload - a.workload);
    } catch (error) {
      
      return [];
    }
  }

  // =======================================================================================
  // GESTION DES DASHBOARDS AVANCÉS
  // =======================================================================================

  /**
   * Créer un nouveau dashboard
   */
  async createDashboard(dashboard: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardLayout> {
    try {
      const docRef = await addDoc(collection(db, this.DASHBOARDS_COLLECTION), {
        ...dashboard,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        id: docRef.id,
        ...dashboard,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir les dashboards accessibles à un utilisateur
   */
  async getUserDashboards(userId: string): Promise<DashboardLayout[]> {
    try {
      const q = query(
        collection(db, this.DASHBOARDS_COLLECTION),
        where('permissions.view', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as DashboardLayout));
    } catch (error) {
      
      return [];
    }
  }

  // =======================================================================================
  // MÉTRIQUES TEMPS RÉEL
  // =======================================================================================

  /**
   * Publier une métrique temps réel
   */
  async publishRealtimeMetric(metric: Omit<RealtimeMetric, 'timestamp'>): Promise<void> {
    try {
      await addDoc(collection(db, this.METRICS_COLLECTION), {
        ...metric,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      
    }
  }

  /**
   * S'abonner aux métriques temps réel
   */
  subscribeToRealtimeMetrics(
    keys: string[],
    callback: (metrics: RealtimeMetric[]) => void
  ): () => void {
    // Si aucune clé, retourner une fonction vide
    if (keys.length === 0) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, this.METRICS_COLLECTION),
      where('key', 'in', keys),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const metrics: RealtimeMetric[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as RealtimeMetric));

      callback(metrics);
    });

    return unsubscribe;
  }

  // =======================================================================================
  // FEED D'ACTIVITÉ
  // =======================================================================================

  /**
   * Ajouter une activité au feed
   */
  async addActivityFeedItem(activity: Omit<ActivityFeedItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      await addDoc(collection(db, this.ACTIVITIES_COLLECTION), {
        ...activity,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      
    }
  }

  /**
   * Obtenir le feed d'activité
   */
  async getActivityFeed(maxItems: number = 50): Promise<ActivityFeedItem[]> {
    try {
      const q = query(
        collection(db, this.ACTIVITIES_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as ActivityFeedItem));
    } catch (error) {
      
      return [];
    }
  }

  // =======================================================================================
  // ALERTES DASHBOARD
  // =======================================================================================

  /**
   * Créer une alerte
   */
  async createAlert(alert: Omit<DashboardAlert, 'id' | 'createdAt'>): Promise<DashboardAlert> {
    try {
      const docRef = await addDoc(collection(db, this.ALERTS_COLLECTION), {
        ...alert,
        createdAt: serverTimestamp()
      });

      const createdAlert = {
        id: docRef.id,
        ...alert,
        createdAt: new Date()
      };

      // Publier dans le feed d'activité
      await this.addActivityFeedItem({
        type: 'alert_triggered',
        title: 'Nouvelle alerte',
        description: alert.title,
        severity: alert.severity === 'critical' ? 'error' : 'warning',
        entityId: alert.entityId,
        entityType: alert.entityType
      });

      return createdAlert;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir les alertes actives
   */
  async getActiveAlerts(maxItems: number = 20): Promise<DashboardAlert[]> {
    try {
      const q = query(
        collection(db, this.ALERTS_COLLECTION),
        where('isResolved', '==', false),
        orderBy('createdAt', 'desc'),
        limit(maxItems)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      } as DashboardAlert));
    } catch (error) {
      
      return [];
    }
  }

  // =======================================================================================
  // DONNÉES WIDGET
  // =======================================================================================

  /**
   * Obtenir les données pour un widget KPI
   */
  async getKPIWidgetData(config: WidgetConfig): Promise<KPIMetric | null> {
    try {
      if (!config.metric) return null;

      const kpis = await analyticsService.calculateGlobalKPIs();
      return kpis.find(kpi => kpi.id === config.metric) || null;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Obtenir les données pour un widget graphique
   */
  async getChartWidgetData(config: WidgetConfig): Promise<any[]> {
    try {
      if (!config.dataSource) return [];

      const dateRange = this.getDateRangeFromConfig(config.dateRange || 'week');

      switch (config.dataSource) {
        case 'task_completion':
          return await this.getTaskCompletionChartData(dateRange);
        
        case 'project_progress':
          return await this.getProjectProgressChartData(dateRange);
        
        case 'resource_utilization':
          return await this.getResourceUtilizationChartData(dateRange);
        
        
        default:
          return [];
      }
    } catch (error) {
      
      return [];
    }
  }

  // =======================================================================================
  // HELPERS PRIVÉS
  // =======================================================================================

  private getDateRangeFromConfig(dateRange: string): { start: Date; end: Date } {
    const now = new Date();

    switch (dateRange) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      
      case 'week':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };
      
      case 'month':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
      
      default:
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };
    }
  }

  private async getTaskCompletionChartData(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      const data: any[] = [];
      const days = Math.floor((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
      
      // Récupérer les vraies données de tâches depuis Firestore
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('createdAt', '>=', Timestamp.fromDate(dateRange.start)),
        where('createdAt', '<=', Timestamp.fromDate(dateRange.end))
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Grouper par jour
      const dailyStats: { [key: string]: { completed: number; created: number } } = {};
      
      for (let i = 0; i <= days; i++) {
        const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = format(date, 'dd/MM', { locale: fr });
        dailyStats[dateKey] = { completed: 0, created: 0 };
      }
      
      // Compter les tâches par jour
      tasks.forEach((task: any) => {
        if (task.createdAt) {
          const taskDate = (task.createdAt as Timestamp).toDate();
          const dateKey = format(taskDate, 'dd/MM', { locale: fr });
          
          if (dailyStats[dateKey]) {
            dailyStats[dateKey].created++;
            if (task.status === 'DONE') {
              dailyStats[dateKey].completed++;
            }
          }
        }
      });
      
      // Convertir en format pour les graphiques
      Object.keys(dailyStats).forEach(dateKey => {
        data.push({
          date: dateKey,
          completed: dailyStats[dateKey].completed,
          created: dailyStats[dateKey].created
        });
      });
      
      return data;
    } catch (error) {
      
      return [];
    }
  }

  private async getProjectProgressChartData(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // Récupérer les vrais projets depuis Firestore
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Grouper par statut
      const statusCounts: { [key: string]: number } = {
        'BACKLOG': 0,
        'TODO': 0,
        'IN_PROGRESS': 0,
        'DONE': 0
      };
      
      projects.forEach((project: any) => {
        const status = project.status || 'TODO';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });
      
      return [
        { name: 'Planification', value: statusCounts.BACKLOG + statusCounts.TODO, color: '#8884d8' },
        { name: 'En cours', value: statusCounts.IN_PROGRESS, color: '#82ca9d' },
        { name: 'Terminés', value: statusCounts.DONE, color: '#ff7300' }
      ];
    } catch (error) {
      
      return [];
    }
  }

  private async getResourceUtilizationChartData(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // Récupérer les données d'utilisation des ressources depuis Firestore
      const resourcesQuery = query(collection(db, 'users'), where('isActive', '==', true));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const resources = resourcesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const data: any[] = [];
      const days = 7;
      
      for (let i = 0; i < days; i++) {
        const date = new Date(dateRange.end.getTime() - (days - i) * 24 * 60 * 60 * 1000);
        
        // Calculer l'utilisation basée sur les tâches assignées
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('dueDate', '>=', Timestamp.fromDate(startOfDay(date))),
          where('dueDate', '<=', Timestamp.fromDate(endOfDay(date)))
        );
        
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasks = tasksSnapshot.docs.map(doc => doc.data());
        
        const assignedTasks = tasks.filter(task => task.assigneeId).length;
        const totalResources = resources.length || 1;
        const utilization = Math.round((assignedTasks / totalResources) * 100);
        
        data.push({
          date: format(date, 'dd/MM', { locale: fr }),
          utilization: Math.min(utilization, 100),
          capacity: 100
        });
      }
      
      return data;
    } catch (error) {
      
      return [];
    }
  }
  /**
   * Nettoyer les anciennes métriques
   */
  async cleanupOldMetrics(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      const q = query(
        collection(db, this.METRICS_COLLECTION),
        where('timestamp', '<', Timestamp.fromDate(cutoffDate))
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`Cleaned up ${snapshot.docs.length} old metrics`);
      }
    } catch (error) {
      
    }
  }

  /**
   * Nettoyer les resources
   */
  cleanup(): void {
    this.metricsListeners.forEach(unsubscribe => unsubscribe());
    this.activityListeners.forEach(unsubscribe => unsubscribe());
    
    this.metricsListeners.clear();
    this.activityListeners.clear();
  }
}

export const dashboardService = new DashboardService();