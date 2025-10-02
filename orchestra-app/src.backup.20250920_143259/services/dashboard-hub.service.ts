import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  getDocsFromServer,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { robustQueryService } from './robust-query.service';
import { cacheManagerService } from './cache-manager.service';
import { Task, Project, LeaveRequest, User } from '../types';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfDay, 
  endOfDay,
  addDays,
  isWeekend,
  differenceInDays,
  format
} from 'date-fns';
import { fr } from 'date-fns/locale';

interface PersonalKPIs {
  // Tâches
  tasksInProgress: number;
  tasksCompletedThisWeek: number;
  overdueTasksCount: number;
  upcomingDeadlines: number;
  
  // Productivité
  productivityRate: number;
  productivityTrend: number;
  averageTaskCompletionTime: number;
  
  // Charge de travail
  currentWorkload: number;
  workloadTrend: number;
  hoursLoggedThisWeek: number;
  averageHoursPerDay: number;
  
  // Projets et équipe
  activeProjects: number;
  teamSize: number;
  collaborationScore: number;
  
  // Congés et absences
  remainingLeaveDays: number;
  nextLeaveDate?: Date;
  upcomingTeamAbsences: number;
}

interface TaskWidget {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueDate: Date;
  projectName: string;
  projectId: string | undefined;
  status: string;
  timeSpent?: number;
  estimatedHours?: number;
  assignedBy?: string;
  dependencies?: string[];
  isBlocked?: boolean;
}

interface UpcomingEvent {
  id: string;
  type: 'meeting' | 'deadline' | 'leave' | 'milestone' | 'review';
  title: string;
  date: Date;
  endDate?: Date;
  description?: string;
  participants?: string[];
  location?: string;
  color: string;
  priority?: 'high' | 'medium' | 'low';
}

interface WorkloadAnalysis {
  weekDays: {
    date: Date;
    label: string;
    hours: number;
    tasks: number;
    isToday: boolean;
    isWeekend: boolean;
  }[];
  totalWeekHours: number;
  averageDailyHours: number;
  peakDay: string;
  recommendedActions: string[];
}

interface TeamMemberStatus {
  userId: string;
  name: string;
  avatar?: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  currentTask?: string;
  workload: number;
  nextAvailable?: Date;
}

class DashboardHubService {
  /**
   * Récupère toutes les tâches où l'utilisateur est impliqué (RACI)
   * @param userId ID de l'utilisateur
   * @param statusFilter Filtres de statut optionnels
   */
  private async getAllUserTasks(userId: string, statusFilter?: string[]): Promise<Task[]> {
    console.log('🔍 getAllUserTasks ROBUSTE appelé pour:', userId);
    
    try {
      // REQUÊTE ROBUSTE avec retry automatique et gestion de cache
      console.log('📥 Récupération ROBUSTE de toutes les tâches...');
      const simpleQuery = query(collection(db, 'tasks'), limit(200));
      
      // Utiliser le service de requête robuste
      const snapshot = await robustQueryService.queryWithRetry(simpleQuery, {
        maxRetries: 3,
        useServerOnly: true,
        autoCleanCache: true,
        delay: 1000
      });
      
      console.log('📊 Nombre total de tâches récupérées (ROBUSTE):', snapshot.size);
      
      let tasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Task)
        .filter(task => {
          // Fonction helper pour vérifier si l'user est dans un array RACI
          const isUserInRaciArray = (raciArray?: string[]): boolean => {
            if (!Array.isArray(raciArray)) return false;
            return raciArray.includes(userId);
          };

          // RACI comprehensive check
          const hasResponsible = isUserInRaciArray(task.responsible);
          const hasCreatedBy = task.createdBy === userId;
          const hasAccountable = isUserInRaciArray(task.accountable);
          const hasConsulted = isUserInRaciArray(task.consulted);
          const hasInformed = isUserInRaciArray(task.informed);

          const isUserTask = hasResponsible || hasCreatedBy || hasAccountable || hasConsulted || hasInformed;
          
          if (isUserTask) {
            console.log('✅ Tâche trouvée pour user:', task.id, task.title);
          }
          
          return isUserTask;
        });

      console.log('🎯 Tâches filtrées pour l\'utilisateur (ROBUSTE):', tasks.length);

      if (statusFilter) {
        tasks = tasks.filter(task => statusFilter.includes(task.status));
        console.log('📋 Tâches après filtre statut (ROBUSTE):', tasks.length);
      }

      // Trier côté client par createdAt
      tasks.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate; // DESC
      });

      return tasks;
    } catch (error) {
      console.error('💥 ÉCHEC COMPLET requête robuste, tentative fallback...', error);
      
      // FALLBACK ULTIME avec requête simple
      try {
        console.log('🆘 Tentative fallback simple...');
        const fallbackQuery = query(collection(db, 'tasks'), limit(50));
        const fallbackSnapshot = await robustQueryService.queryWithFallback(fallbackQuery);
        
        const fallbackTasks = fallbackSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }) as Task)
          .filter(task => {
            return task.createdBy === userId ||
                   (Array.isArray(task.responsible) && task.responsible.includes(userId));
          });
          
        console.log('🆘 Fallback réussi:', fallbackTasks.length, 'tâches');
        return fallbackTasks;
        
      } catch (fallbackError) {
        console.error('💀 FALLBACK AUSSI ÉCHOUÉ:', fallbackError);
        
        // Diagnostic complet
        const diagnosis = await cacheManagerService.diagnoseCache();
        console.error('🩺 Diagnostic final:', diagnosis);
        
        // Auto-récupération en dernier recours
        await cacheManagerService.autoRecover();
        
        return [];
      }
    }
  }

  /**
   * Récupère les KPIs personnalisés pour un utilisateur
   */
  async getPersonalKPIs(userId: string): Promise<PersonalKPIs> {
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: fr });
      const weekEnd = endOfWeek(now, { locale: fr });

      // Requêtes parallèles pour optimiser les performances
      const [
        tasks, // Utiliser la nouvelle fonction
        projectsSnapshot,
        timeEntriesSnapshot,
        leavesSnapshot,
        userDoc
      ] = await Promise.all([
        // Toutes les tâches de l'utilisateur (RACI)
        this.getAllUserTasks(userId),
        
        // Projets - requête simplifiée
        getDocs(collection(db, 'projects')),
        
        // Entrées de temps - récupération complète
        getDocs(collection(db, 'time_entries')),
        
        // Congés - récupération complète
        getDocs(collection(db, 'leaves')),
        
        // Infos utilisateur
        getDoc(doc(db, 'users', userId))
      ]);

      // Les tâches sont déjà formatées par getAllUserTasks
      // const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      const tasksInProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const tasksCompletedThisWeek = tasks.filter(t => 
        t.status === 'DONE' && 
        t.completedDate && 
        new Date(t.completedDate) >= weekStart
      ).length;
      
      const now2 = new Date();
      const overdueTasksCount = tasks.filter(t => 
        t.dueDate && 
        new Date(t.dueDate) < now2 && 
        t.status !== 'DONE'
      ).length;
      
      const upcomingDeadlines = tasks.filter(t => 
        t.dueDate && 
        t.status !== 'DONE' &&
        differenceInDays(new Date(t.dueDate), now2) <= 7 &&
        differenceInDays(new Date(t.dueDate), now2) >= 0
      ).length;

      // Calcul de la productivité
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'DONE').length;
      const productivityRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Tendance de productivité (comparaison avec semaine précédente)
      const prevWeekStart = addDays(weekStart, -7);
      const prevWeekEnd = addDays(weekEnd, -7);
      const prevWeekCompleted = tasks.filter(t => 
        t.status === 'DONE' && 
        t.completedDate && 
        new Date(t.completedDate) >= prevWeekStart &&
        new Date(t.completedDate) <= prevWeekEnd
      ).length;
      const productivityTrend = tasksCompletedThisWeek - prevWeekCompleted;

      // Temps moyen de complétion (en jours)
      const completedWithDates = tasks.filter(t => 
        t.status === 'DONE' && t.createdAt && t.completedDate
      );
      const averageTaskCompletionTime = completedWithDates.length > 0
        ? Math.round(
            completedWithDates.reduce((acc, t) => 
              acc + differenceInDays(new Date(t.completedDate!), new Date(t.createdAt)), 0
            ) / completedWithDates.length
          )
        : 0;

      // Analyse de la charge de travail - filtrer par userId et dates
      const timeEntries = timeEntriesSnapshot.docs
        .map(doc => doc.data())
        .filter(entry => entry.userId === userId);
      
      const weekTimeEntries = timeEntries.filter(entry => {
        const entryDate = this.toDate(entry.date);
        return entryDate && entryDate >= weekStart && entryDate <= weekEnd;
      });
      const hoursLoggedThisWeek = weekTimeEntries.reduce((acc, entry) => acc + (entry.hours || 0), 0);
      const workingDays = 5; // Lundi à vendredi
      const averageHoursPerDay = hoursLoggedThisWeek / workingDays;
      
      // Charge actuelle (basée sur les tâches en cours et leur estimation)
      const currentTasksHours = tasks
        .filter(t => t.status === 'IN_PROGRESS')
        .reduce((acc, t) => acc + (t.estimatedHours || 8), 0);
      const dailyCapacity = 8; // 8 heures par jour
      const remainingDaysInWeek = 5 - new Date().getDay() + 1;
      const currentWorkload = Math.round((currentTasksHours / (dailyCapacity * remainingDaysInWeek)) * 100);
      
      // Tendance de la charge - utiliser les variables déjà définies
      const prevWeekEntries = timeEntries.filter(entry => {
        const entryDate = this.toDate(entry.date);
        return entryDate && entryDate >= prevWeekStart && entryDate <= prevWeekEnd;
      });
      const prevWeekHours = prevWeekEntries.reduce((acc, entry) => acc + (entry.hours || 0), 0);
      const workloadTrend = hoursLoggedThisWeek - prevWeekHours;

      // Projets et équipe
      // Filtrer les projets où l'utilisateur est membre et qui sont actifs
      const userActiveProjects = projectsSnapshot.docs.filter(doc => {
        const project = doc.data();
        const isTeamMember = Array.isArray(project.teamMembers) 
          ? project.teamMembers.includes(userId)
          : project.teamMembers === userId;
        const isActive = ['active', 'in_progress'].includes(project.status);
        return isTeamMember && isActive;
      });
      const activeProjects = userActiveProjects.length;
      
      // Calcul de la taille de l'équipe (tous les membres uniques des projets de l'utilisateur)
      const teamMembersSet = new Set<string>();
      userActiveProjects.forEach(doc => {
        const project = doc.data() as Project;
        project.teamMembers?.forEach(member => {
          if (typeof member === 'string') {
            teamMembersSet.add(member);
          } else if (member.userId) {
            teamMembersSet.add(member.userId);
          }
        });
      });
      const teamSize = teamMembersSet.size;
      
      // Score de collaboration (basé sur les interactions)
      const collaborationScore = Math.min(100, (activeProjects * 10) + (teamSize * 5));

      // Analyse des congés
      const userData = userDoc.data() as User;
      const remainingLeaveDays = 25; // Par défaut 25 jours - TODO: Ajouter au contrat
      
      const approvedLeaves = leavesSnapshot.docs
        .map(doc => doc.data() as LeaveRequest)
        .filter(leave => leave.userId === userId && leave.status === 'APPROVED');
      
      const nextLeave = approvedLeaves
        .filter(leave => new Date(leave.startDate) > now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
      
      // Congés de l'équipe à venir - utiliser les données déjà récupérées
      const upcomingTeamAbsences = leavesSnapshot.docs.filter(doc => {
        const leave = doc.data();
        const startDate = this.toDate(leave.startDate);
        return leave.status === 'APPROVED' && 
               startDate && startDate >= now && startDate <= addDays(now, 30);
      }).length;

      return {
        // Tâches
        tasksInProgress,
        tasksCompletedThisWeek,
        overdueTasksCount,
        upcomingDeadlines,
        
        // Productivité
        productivityRate,
        productivityTrend,
        averageTaskCompletionTime,
        
        // Charge de travail
        currentWorkload,
        workloadTrend,
        hoursLoggedThisWeek,
        averageHoursPerDay,
        
        // Projets et équipe
        activeProjects,
        teamSize,
        collaborationScore,
        
        // Congés
        remainingLeaveDays,
        nextLeaveDate: nextLeave?.startDate,
        upcomingTeamAbsences
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des KPIs:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        tasksInProgress: 0,
        tasksCompletedThisWeek: 0,
        overdueTasksCount: 0,
        upcomingDeadlines: 0,
        productivityRate: 0,
        productivityTrend: 0,
        averageTaskCompletionTime: 0,
        currentWorkload: 0,
        workloadTrend: 0,
        hoursLoggedThisWeek: 0,
        averageHoursPerDay: 0,
        activeProjects: 0,
        teamSize: 0,
        collaborationScore: 0,
        remainingLeaveDays: 0,
        upcomingTeamAbsences: 0
      };
    }
  }

  /**
   * Récupère les tâches prioritaires de l'utilisateur
   */
  async getMyTasks(userId: string, maxTasks: number = 10): Promise<TaskWidget[]> {
    try {
      // Récupérer toutes les tâches de l'utilisateur (RACI) en cours ou à faire
      const allTasks = await this.getAllUserTasks(userId, ['TODO', 'IN_PROGRESS']);
      
      // Trier par priorité puis par date d'échéance
      const sortedTasks = allTasks.sort((a, b) => {
        const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Si même priorité, trier par date d'échéance
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return aDate - bDate;
      });

      const tasks = sortedTasks.slice(0, maxTasks);

      // Récupérer les noms des projets
      const projectIdsSet = new Set(tasks.map(t => t.projectId).filter(Boolean));
      const projectIds = Array.from(projectIdsSet);
      const projectsMap = new Map<string, string>();
      
      if (projectIds.length > 0) {
        // Récupérer les projets nécessaires
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        const filteredProjects = projectsSnapshot.docs.filter(doc => projectIds.includes(doc.id));
        
        filteredProjects.forEach(doc => {
          const project = doc.data() as Project;
          projectsMap.set(doc.id, project.name);
        });
      }

      // Transformer en format TaskWidget
      return tasks.map(task => ({
        id: task.id,
        title: task.title,
        priority: task.priority || 'P2',
        dueDate: task.dueDate || addDays(new Date(), 7),
        projectName: task.projectId ? (projectsMap.get(task.projectId) || 'Projet inconnu') : 'Tâche simple',
        projectId: task.projectId,
        status: task.status,
        timeSpent: task.loggedHours,
        estimatedHours: task.estimatedHours,
        assignedBy: task.createdBy,
        dependencies: task.dependencies?.map(d => d.taskId),
        isBlocked: task.isBlocked
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des tâches:', error);
      return [];
    }
  }

  /**
   * Récupère les événements à venir
   */
  async getUpcomingEvents(userId: string, days: number = 14): Promise<UpcomingEvent[]> {
    try {
      const now = new Date();
      const endDate = addDays(now, days);
      const events: UpcomingEvent[] = [];

      // 1. Échéances de tâches - récupérer toutes les tâches RACI puis filtrer
      const allUserTasks = await this.getAllUserTasks(userId, ['TODO', 'IN_PROGRESS']);
      const upcomingTasks = allUserTasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate >= now && taskDate <= endDate;
      }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      upcomingTasks.forEach(task => {
        if (task.dueDate) {
          events.push({
            id: `task-${task.id}`,
            type: 'deadline',
            title: `📅 ${task.title}`,
            date: task.dueDate,
            description: `Échéance de tâche - Priorité ${task.priority}`,
            color: task.priority === 'P0' ? '#f44336' : task.priority === 'P1' ? '#ff9800' : '#2196f3',
            priority: task.priority === 'P0' ? 'high' : task.priority === 'P1' ? 'medium' : 'low'
          });
        }
      });

      // 2. Congés approuvés - requête simplifiée
      const leavesQuery = query(
        collection(db, 'leaves'),
      );
      
      const leavesSnapshot = await getDocs(leavesQuery);
      leavesSnapshot.docs.forEach(doc => {
        const leave = doc.data() as LeaveRequest;
        const leaveStartDate = this.toDate(leave.startDate);
        // Filtrer côté client
        if (leave.status === 'APPROVED' && leaveStartDate && 
            leaveStartDate >= now && leaveStartDate <= endDate) {
          events.push({
            id: `leave-${doc.id}`,
            type: 'leave',
            title: `🏖️ Congé ${this.getLeaveTypeLabel(leave.type)}`,
            date: leave.startDate,
            endDate: leave.endDate,
            description: leave.reason,
            color: '#4caf50'
          });
        }
      });

      // 3. Jalons de projets
      const projectsQuery = query(
        collection(db, 'projects'),
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectIds = projectsSnapshot.docs.map(doc => doc.id);
      
      if (projectIds.length > 0) {
        const milestonesQuery = query(
          collection(db, 'milestones'),
        );
        
        const milestonesSnapshot = await getDocs(milestonesQuery);
        milestonesSnapshot.docs.forEach(doc => {
          const milestone = doc.data();
          events.push({
            id: `milestone-${doc.id}`,
            type: 'milestone',
            title: `🎯 ${milestone.name}`,
            date: milestone.dueDate.toDate(),
            description: milestone.description,
            color: '#9c27b0'
          });
        });
      }

      // 4. Réunions (si disponibles dans la base)
      const meetingsQuery = query(
        collection(db, 'meetings'),
      );
      
      try {
        const meetingsSnapshot = await getDocs(meetingsQuery);
        meetingsSnapshot.docs.forEach(doc => {
          const meeting = doc.data();
          events.push({
            id: `meeting-${doc.id}`,
            type: 'meeting',
            title: `👥 ${meeting.title}`,
            date: meeting.date.toDate(),
            description: meeting.agenda,
            participants: meeting.participants,
            location: meeting.location,
            color: '#00bcd4'
          });
        });
      } catch (error) {
        // La collection meetings n'existe peut-être pas encore
        console.log('Collection meetings non disponible');
      }

      // Trier les événements par date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return events.slice(0, 10); // Limiter à 10 événements
    } catch (error) {
      console.error('Erreur lors de la récupération des événements:', error);
      return [];
    }
  }

  /**
   * Analyse la charge de travail de la semaine
   */
  async getWorkloadAnalysis(userId: string): Promise<WorkloadAnalysis> {
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: fr });
      const weekDays = [];
      let totalWeekHours = 0;

      // Récupérer toutes les tâches une seule fois pour optimiser
      const allUserTasks = await this.getAllUserTasks(userId, ['TODO', 'IN_PROGRESS']);

      // Analyser chaque jour de la semaine
      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(weekStart, i);
        const dayStart = startOfDay(currentDay);
        const dayEnd = endOfDay(currentDay);
        
        // Filtrer les tâches pour ce jour spécifique
        const dayTasks = allUserTasks.filter(task => {
          if (!task.dueDate) return false;
          const taskDate = new Date(task.dueDate);
          return taskDate >= dayStart && taskDate <= dayEnd;
        });
        
        // Calculer les heures estimées pour la journée
        const dayHours = dayTasks.reduce((acc, task) => 
          acc + (task.estimatedHours || 4), 0 // 4h par défaut si pas d'estimation
        );
        
        totalWeekHours += dayHours;
        
        weekDays.push({
          date: currentDay,
          label: format(currentDay, 'EEE', { locale: fr }),
          hours: dayHours,
          tasks: dayTasks.length,
          isToday: currentDay.toDateString() === now.toDateString(),
          isWeekend: isWeekend(currentDay)
        });
      }

      const workingDays = weekDays.filter(d => !d.isWeekend);
      const averageDailyHours = workingDays.length > 0 
        ? totalWeekHours / workingDays.length 
        : 0;
      
      const peakDay = weekDays.reduce((max, day) => 
        day.hours > max.hours ? day : max
      );

      // Recommandations basées sur l'analyse
      const recommendedActions = [];
      if (averageDailyHours > 8) {
        recommendedActions.push("⚠️ Charge élevée détectée - Envisagez de déléguer certaines tâches");
      }
      if (peakDay.hours > 10) {
        recommendedActions.push(`📅 Pic de charge ${peakDay.label} - Répartissez mieux vos tâches`);
      }
      if (totalWeekHours < 20) {
        recommendedActions.push("✅ Capacité disponible - Vous pouvez prendre des tâches supplémentaires");
      }

      return {
        weekDays,
        totalWeekHours,
        averageDailyHours: Math.round(averageDailyHours * 10) / 10,
        peakDay: peakDay.label,
        recommendedActions
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse de la charge:', error);
      return {
        weekDays: [],
        totalWeekHours: 0,
        averageDailyHours: 0,
        peakDay: '',
        recommendedActions: []
      };
    }
  }

  /**
   * Récupère le statut des membres de l'équipe
   */
  async getTeamStatus(userId: string): Promise<TeamMemberStatus[]> {
    try {
      // Récupérer les projets de l'utilisateur
      const projectsQuery = query(
        collection(db, 'projects'),
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const teamMembersSet = new Set<string>();
      
      // Collecter tous les membres de l'équipe
      projectsSnapshot.docs.forEach(doc => {
        const project = doc.data() as Project;
        project.teamMembers?.forEach(member => {
          if (typeof member === 'string') {
            teamMembersSet.add(member);
          } else if (member.userId) {
            teamMembersSet.add(member.userId);
          }
        });
      });

      const teamStatus: TeamMemberStatus[] = [];
      
      // Récupérer le statut de chaque membre
      const memberIds = Array.from(teamMembersSet);
      for (const memberId of memberIds) {
        if (memberId === userId) continue; // Exclure l'utilisateur actuel
        
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (!userDoc.exists()) continue;
        
        const userData = userDoc.data() as User;
        
        // Vérifier les tâches en cours
        const currentTasksQuery = query(
          collection(db, 'tasks'),
          limit(1)
        );
        
        const currentTasksSnapshot = await getDocs(currentTasksQuery);
        const currentTask = currentTasksSnapshot.docs[0]?.data()?.title;
        
        // Calculer la charge de travail
        const workloadQuery = query(
          collection(db, 'tasks'),
        );
        
        const workloadSnapshot = await getDocs(workloadQuery);
        const workload = Math.min(100, workloadSnapshot.size * 15);
        
        // Vérifier les congés - requête simplifiée
        const now = new Date();
        const leavesQuery = query(
          collection(db, 'leaves'),
        );
        
        const leavesSnapshot = await getDocs(leavesQuery);
        // Filtrer côté client pour éviter l'index complexe
        const activeLeavesDoc = leavesSnapshot.docs.find(doc => {
          const leave = doc.data();
          const startDate = this.toDate(leave.startDate);
          const endDate = this.toDate(leave.endDate);
          return leave.status === 'APPROVED' && 
                 startDate && endDate && 
                 startDate <= now && endDate >= now;
        });
        const isOnLeave = !!activeLeavesDoc;
        
        teamStatus.push({
          userId: memberId,
          name: userData.displayName || `${userData.firstName} ${userData.lastName}`,
          avatar: userData.avatarUrl,
          status: isOnLeave ? 'away' : workload > 80 ? 'busy' : 'available',
          currentTask,
          workload,
          nextAvailable: isOnLeave && activeLeavesDoc ? activeLeavesDoc.data().endDate.toDate() : undefined
        });
      }

      return teamStatus;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut de l\'équipe:', error);
      return [];
    }
  }

  /**
   * Récupère le nombre de notifications non lues
   */
  async getUnreadNotifications(userId: string): Promise<number> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
      );
      
      const snapshot = await getDocs(notificationsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      return 0;
    }
  }

  /**
   * Helper pour obtenir le label d'un type de congé
   */
  private toDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
    return null;
  }

  /**
   * Obtenir le libellé d'un type de congé
   */
  private getLeaveTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'PAID_LEAVE': 'payés',
      'RTT': 'RTT',
      'SICK_LEAVE': 'maladie',
      'MATERNITY_LEAVE': 'maternité',
      'PATERNITY_LEAVE': 'paternité',
      'EXCEPTIONAL_LEAVE': 'exceptionnel',
      'UNPAID_LEAVE': 'sans solde',
      'TRAINING': 'formation'
    };
    return labels[type] || type;
  }
}

export const dashboardHubService = new DashboardHubService();