import { Task, Milestone } from '../types';
import { taskService } from './task.service';
import { milestoneService } from './milestone.service';
import { differenceInDays, min, max, addDays, subDays } from 'date-fns';

export type DateAdjustmentStrategy = 'milestone_follows_tasks' | 'tasks_follow_milestone' | 'no_adjustment';

interface TaskDateRange {
  earliestStart: Date;
  latestEnd: Date;
  taskCount: number;
  tasks: Task[];
}

interface MilestoneAdjustmentResult {
  suggestedDate: Date;
  needsAdjustment: boolean;
  conflictingTasks: Task[];
  adjustmentReason: string;
}

class MilestoneTaskService {
  /**
   * Lier des tâches à un milestone avec ajustement automatique des dates
   */
  async linkTasksToMilestone(
    milestoneId: string,
    taskIds: string[],
    strategy: DateAdjustmentStrategy = 'milestone_follows_tasks'
  ): Promise<{ milestone: Milestone; adjustedTasks: Task[] }> {
    try {
      const [milestone, tasks] = await Promise.all([
        milestoneService.getMilestoneById(milestoneId),
        Promise.all(taskIds.map(id => taskService.getTask(id)))
      ]);

      if (!milestone) {
        throw new Error('Milestone not found');
      }

      const validTasks = tasks.filter(Boolean) as Task[];
      
      // Calculer la plage de dates des tâches
      const taskDateRange = this.calculateTaskDateRange(validTasks);
      
      let updatedMilestone = milestone;
      let adjustedTasks: Task[] = [];

      // Ajuster les dates selon la stratégie
      switch (strategy) {
        case 'milestone_follows_tasks':
          updatedMilestone = await this.adjustMilestoneToTasks(milestone, taskDateRange);
          break;
        
        case 'tasks_follow_milestone':
          adjustedTasks = await this.adjustTasksToMilestone(validTasks, milestone);
          break;
        
        case 'no_adjustment':
          // Aucun ajustement, juste lier
          break;
      }

      // Mettre à jour le milestone avec les nouvelles tâches liées
      const existingTaskIds = milestone.taskIds || [];
      const allTaskIds = [...existingTaskIds, ...taskIds];
      const newTaskIds = Array.from(new Set(allTaskIds));
      
      await milestoneService.updateMilestone(milestoneId, {
        taskIds: newTaskIds,
        startDate: updatedMilestone.startDate,
        dueDate: updatedMilestone.dueDate
      });

      // Mettre à jour les tâches ajustées
      for (const task of adjustedTasks) {
        await taskService.updateTask(task.id, {
          startDate: task.startDate,
          dueDate: task.dueDate
        });
      }

      const finalMilestone = await milestoneService.getMilestoneById(milestoneId);
      return {
        milestone: finalMilestone!,
        adjustedTasks
      };
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Calculer la plage de dates optimale pour un ensemble de tâches
   */
  private calculateTaskDateRange(tasks: Task[]): TaskDateRange {
    if (tasks.length === 0) {
      return {
        earliestStart: new Date(),
        latestEnd: new Date(),
        taskCount: 0,
        tasks: []
      };
    }

    const validTasks = tasks.filter(task => task.startDate && task.dueDate);
    
    if (validTasks.length === 0) {
      return {
        earliestStart: new Date(),
        latestEnd: addDays(new Date(), 7),
        taskCount: 0,
        tasks: []
      };
    }

    const startDates = validTasks.map(t => new Date(t.startDate!));
    const endDates = validTasks.map(t => new Date(t.dueDate!));

    return {
      earliestStart: min(startDates),
      latestEnd: max(endDates),
      taskCount: validTasks.length,
      tasks: validTasks
    };
  }

  /**
   * Ajuster la date du milestone selon les tâches liées
   */
  private async adjustMilestoneToTasks(
    milestone: Milestone, 
    taskDateRange: TaskDateRange
  ): Promise<Milestone> {
    if (taskDateRange.taskCount === 0) {
      return milestone;
    }

    // Si c'est un milestone de type "delivery" ou "release", 
    // il doit être après la dernière tâche
    const shouldBeAfterTasks = ['delivery', 'release', 'demo'].includes(milestone.type);
    
    let suggestedDate: Date;
    
    if (shouldBeAfterTasks) {
      // Placer le milestone après la dernière tâche (avec buffer d'1 jour)
      suggestedDate = addDays(taskDateRange.latestEnd, 1);
    } else {
      // Pour les autres types (review, decision), placer au milieu de la période
      const totalDays = differenceInDays(taskDateRange.latestEnd, taskDateRange.earliestStart);
      const middleDays = Math.floor(totalDays / 2);
      suggestedDate = addDays(taskDateRange.earliestStart, middleDays);
    }

    return {
      ...milestone,
      startDate: taskDateRange.earliestStart, // Date de début = première tâche
      dueDate: shouldBeAfterTasks ? suggestedDate : taskDateRange.latestEnd, // Date de fin selon le type
      followsTasks: true // Marquer que ce jalon suit les tâches
    };
  }

  /**
   * Ajuster les dates des tâches selon le milestone
   */
  private async adjustTasksToMilestone(tasks: Task[], milestone: Milestone): Promise<Task[]> {
    const adjustedTasks: Task[] = [];
    const milestoneDate = new Date(milestone.dueDate || milestone.startDate || new Date());

    for (const task of tasks) {
      if (!task.startDate || !task.dueDate) continue;

      const taskStartDate = new Date(task.startDate);
      const taskEndDate = new Date(task.dueDate);
      const taskDuration = differenceInDays(taskEndDate, taskStartDate);

      let newStartDate = taskStartDate;
      let newEndDate = taskEndDate;

      // Si la tâche se termine après le milestone, l'ajuster
      if (taskEndDate > milestoneDate) {
        newEndDate = subDays(milestoneDate, 1); // Finir 1 jour avant le milestone
        newStartDate = subDays(newEndDate, taskDuration);
      }

      // Si les dates ont changé, ajouter à la liste des tâches ajustées
      if (newStartDate.getTime() !== taskStartDate.getTime() || 
          newEndDate.getTime() !== taskEndDate.getTime()) {
        adjustedTasks.push({
          ...task,
          startDate: newStartDate,
          dueDate: newEndDate
        });
      }
    }

    return adjustedTasks;
  }

  /**
   * Analyser les conflits potentiels entre tâches et milestone
   */
  async analyzeMilestoneTaskConflicts(
    milestoneId: string,
    taskIds: string[]
  ): Promise<MilestoneAdjustmentResult> {
    try {
      const [milestone, tasks] = await Promise.all([
        milestoneService.getMilestoneById(milestoneId),
        Promise.all(taskIds.map(id => taskService.getTask(id)))
      ]);

      if (!milestone) {
        throw new Error('Milestone not found');
      }

      const validTasks = tasks.filter(Boolean) as Task[];
      const taskDateRange = this.calculateTaskDateRange(validTasks);
      const milestoneDate = new Date(milestone.dueDate || milestone.startDate || new Date());

      // Identifier les tâches en conflit
      const conflictingTasks = validTasks.filter(task => {
        if (!task.dueDate) return false;
        const taskEndDate = new Date(task.dueDate);
        return taskEndDate > milestoneDate;
      });

      let suggestedDate = milestoneDate;
      let needsAdjustment = false;
      let adjustmentReason = '';

      if (conflictingTasks.length > 0) {
        needsAdjustment = true;
        suggestedDate = addDays(taskDateRange.latestEnd, 1);
        adjustmentReason = `${conflictingTasks.length} tâche(s) se termine(nt) après la date du jalon`;
      } else if (taskDateRange.taskCount > 0 && milestoneDate < taskDateRange.earliestStart) {
        needsAdjustment = true;
        suggestedDate = taskDateRange.earliestStart;
        adjustmentReason = 'Le jalon est programmé avant le début des tâches';
      }

      return {
        suggestedDate,
        needsAdjustment,
        conflictingTasks,
        adjustmentReason
      };
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Délier des tâches d'un milestone
   */
  async unlinkTasksFromMilestone(milestoneId: string, taskIds: string[]): Promise<void> {
    try {
      const milestone = await milestoneService.getMilestoneById(milestoneId);
      if (!milestone) return;

      const currentTaskIds = milestone.taskIds || [];
      const updatedTaskIds = currentTaskIds.filter(id => !taskIds.includes(id));

      await milestoneService.updateMilestone(milestoneId, {
        taskIds: updatedTaskIds
      });
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir toutes les tâches liées à un milestone avec leurs informations détaillées
   */
  async getMilestoneLinkedTasks(milestoneId: string): Promise<Task[]> {
    try {
      const milestone = await milestoneService.getMilestoneById(milestoneId);
      if (!milestone || !milestone.taskIds?.length) {
        return [];
      }

      const tasks = await Promise.all(
        milestone.taskIds.map(taskId => taskService.getTask(taskId))
      );

      return tasks.filter(Boolean) as Task[];
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Calculer le pourcentage de progression d'un milestone basé sur ses tâches liées
   */
  async calculateMilestoneProgressFromTasks(milestoneId: string): Promise<number> {
    try {
      const tasks = await this.getMilestoneLinkedTasks(milestoneId);
      
      if (tasks.length === 0) return 0;

      const completedTasks = tasks.filter(task => task.status === 'DONE').length;
      const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;

      // Calculer le progrès : tâches terminées = 100%, en cours = 50%
      const totalProgress = (completedTasks * 100) + (inProgressTasks * 50);
      const averageProgress = totalProgress / tasks.length;

      return Math.round(averageProgress);
    } catch (error) {
      
      return 0;
    }
  }

  /**
   * Réorganiser automatiquement tous les milestones d'un projet selon leurs tâches
   */
  async reorderProjectMilestones(projectId: string): Promise<void> {
    try {
      const milestones = await milestoneService.getMilestonesByProject(projectId);
      
      for (const milestone of milestones) {
        if (!milestone.taskIds?.length || milestone.isKeyDate) {
          continue; // Skip milestones without tasks or key dates
        }

        const tasks = await this.getMilestoneLinkedTasks(milestone.id);
        const taskDateRange = this.calculateTaskDateRange(tasks);
        
        if (taskDateRange.taskCount > 0) {
          const adjustedMilestone = await this.adjustMilestoneToTasks(milestone, taskDateRange);
          
          await milestoneService.updateMilestone(milestone.id, {
            dueDate: adjustedMilestone.dueDate,
            completionRate: await this.calculateMilestoneProgressFromTasks(milestone.id)
          });
        }
      }
    } catch (error) {
      
      throw error;
    }
  }
}

export const milestoneTaskService = new MilestoneTaskService();