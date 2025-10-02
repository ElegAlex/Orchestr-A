/**
 * Dashboard Hub V2 Service
 * Service dédié pour le nouveau Dashboard Hub opérationnel
 * Gère les données personnelles de l'utilisateur connecté
 */

import { Task, Project } from '../types';
import { taskService } from './task.service';
import { projectService } from './project.service';
import { simpleTaskService } from './simpleTask.service';

export interface TasksByUrgency {
  overdue: Task[];      // En retard (dueDate < now)
  dueSoon: Task[];      // Échéance proche (dueDate dans les 3 prochains jours)
  inProgress: Task[];   // En cours sans urgence
  todo: Task[];         // À faire sans urgence
  blocked: Task[];      // Bloquées
}

export interface ProjectWithMetrics extends Project {
  myTasksCount: number;
  myTasksOverdue: number;
  myTasksInProgress: number;
  myTasksTodo: number;
}

export interface DashboardHubData {
  // Projets où l'utilisateur est membre
  myProjects: ProjectWithMetrics[];

  // Tâches où l'utilisateur est Responsible (R du RACI)
  myTasksByUrgency: TasksByUrgency;

  // Métriques
  metrics: {
    totalProjects: number;
    totalTasks: number;
    tasksOverdue: number;
    tasksDueSoon: number;
  };
}

class DashboardHubV2Service {
  /**
   * Récupère uniquement les tâches où l'utilisateur est Responsible (R du RACI)
   * ET qui ne sont PAS terminées (statut !== DONE)
   */
  async getMyResponsibleTasks(userId: string): Promise<Task[]> {
    try {
      // Récupérer toutes les tâches où l'utilisateur est assigné (via getTasksByAssignee qui gère déjà le RACI)
      const allMyTasks = await taskService.getTasksByAssignee(userId);

      // Filtrer uniquement celles qui ne sont pas terminées
      const incompleteTasks = allMyTasks.filter(task => task.status !== 'DONE');

      return incompleteTasks;
    } catch (error) {
      console.error('Error getting responsible tasks:', error);
      return [];
    }
  }

  /**
   * Trie les tâches par urgence :
   * 1. En retard (dueDate < now)
   * 2. Échéance proche (dueDate dans les 3 prochains jours)
   * 3. En cours
   * 4. À faire
   * 5. Bloquées
   */
  sortTasksByUrgency(tasks: Task[]): TasksByUrgency {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const overdue: Task[] = [];
    const dueSoon: Task[] = [];
    const inProgress: Task[] = [];
    const todo: Task[] = [];
    const blocked: Task[] = [];

    tasks.forEach(task => {
      // Bloquées en premier
      if (task.status === 'BLOCKED') {
        blocked.push(task);
        return;
      }

      // Tâches avec échéance
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);

        // En retard
        if (dueDate < now) {
          overdue.push(task);
        }
        // Échéance proche (dans les 3 prochains jours)
        else if (dueDate <= threeDaysFromNow) {
          dueSoon.push(task);
        }
        // En cours
        else if (task.status === 'IN_PROGRESS') {
          inProgress.push(task);
        }
        // À faire
        else {
          todo.push(task);
        }
      }
      // Tâches sans échéance
      else {
        if (task.status === 'IN_PROGRESS') {
          inProgress.push(task);
        } else {
          todo.push(task);
        }
      }
    });

    // Trier chaque catégorie par priorité (P0 > P1 > P2 > P3) puis par date
    const sortByPriorityAndDate = (a: Task, b: Task) => {
      // Tri par priorité
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const priorityA = priorityOrder[a.priority] ?? 99;
      const priorityB = priorityOrder[b.priority] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Puis par date (plus ancien d'abord)
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;

      return dateA - dateB;
    };

    return {
      overdue: overdue.sort(sortByPriorityAndDate),
      dueSoon: dueSoon.sort(sortByPriorityAndDate),
      inProgress: inProgress.sort(sortByPriorityAndDate),
      todo: todo.sort(sortByPriorityAndDate),
      blocked: blocked.sort(sortByPriorityAndDate),
    };
  }

  /**
   * Récupère les projets où l'utilisateur est membre d'équipe avec métriques
   */
  async getMyProjectsWithMetrics(userId: string, myTasks: Task[]): Promise<ProjectWithMetrics[]> {
    try {
      // Récupérer les projets où l'utilisateur est membre
      const projects = await projectService.getProjectsByTeamMember(userId);

      // Enrichir avec les métriques de tâches
      const projectsWithMetrics: ProjectWithMetrics[] = projects.map(project => {
        // Filtrer les tâches du projet qui sont assignées à l'utilisateur
        const projectTasks = myTasks.filter(task => task.projectId === project.id);

        return {
          ...project,
          myTasksCount: projectTasks.length,
          myTasksOverdue: projectTasks.filter(task =>
            task.dueDate && new Date(task.dueDate) < new Date()
          ).length,
          myTasksInProgress: projectTasks.filter(task =>
            task.status === 'IN_PROGRESS'
          ).length,
          myTasksTodo: projectTasks.filter(task =>
            task.status === 'TODO' || task.status === 'BACKLOG'
          ).length,
        };
      });

      // Trier par nombre de tâches en retard DESC, puis par date de mise à jour
      return projectsWithMetrics.sort((a, b) => {
        if (a.myTasksOverdue !== b.myTasksOverdue) {
          return b.myTasksOverdue - a.myTasksOverdue;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } catch (error) {
      console.error('Error getting projects with metrics:', error);
      return [];
    }
  }

  /**
   * Charge toutes les données du Dashboard Hub pour un utilisateur
   */
  async getDashboardData(userId: string): Promise<DashboardHubData> {
    try {
      // 1. Récupérer mes tâches (Responsible uniquement, non terminées)
      const myTasks = await this.getMyResponsibleTasks(userId);

      // 2. Trier par urgence
      const myTasksByUrgency = this.sortTasksByUrgency(myTasks);

      // 3. Récupérer mes projets avec métriques
      const myProjects = await this.getMyProjectsWithMetrics(userId, myTasks);

      // 4. Calculer les métriques
      const metrics = {
        totalProjects: myProjects.length,
        totalTasks: myTasks.length,
        tasksOverdue: myTasksByUrgency.overdue.length,
        tasksDueSoon: myTasksByUrgency.dueSoon.length,
      };

      return {
        myProjects,
        myTasksByUrgency,
        metrics,
      };
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      throw error;
    }
  }
}

export const dashboardHubV2Service = new DashboardHubV2Service();
