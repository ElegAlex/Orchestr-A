import { capacityService } from './capacity.service';
import { userService } from './user.service';
import { taskService } from './task.service';
import { leaveService } from './leave.service';
import { holidayService } from './holiday.service';
import { projectService } from './project.service';
import { 
  User, 
  Task, 
  DatePeriod, 
  WorkloadCalculation,
  WorkloadSnapshot,
  CapacityAlert,
  ResourceAllocation,
  UserCapacity
} from '../types';
import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  startOfMonth, 
  endOfMonth,
  addMonths,
  isSameWeek,
  differenceInDays,
  format
} from 'date-fns';

/**
 * Service principal pour le calcul intelligent de charge de travail
 * C'est le coeur du module Gestion des Ressources
 */
class WorkloadCalculatorService {
  
  // ========================================
  // CALCUL DE CHARGE PRINCIPALE
  // ========================================

  /**
   * Calcule la charge de travail complète d'un utilisateur
   * Algorithme principal du système de gestion des ressources
   */
  async calculateUserWorkload(
    userId: string, 
    timeframe: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<any> {
    try {
      console.log(`🔄 Calcul workload pour utilisateur ${userId} (${timeframe})`);
      
      // 1. Définir la période de calcul
      const period = this.getCalculationPeriod(timeframe);
      
      // 2. Récupérer les données utilisateur
      const user = await userService.getUser(userId);
      if (!user) {
        throw new Error(`Utilisateur ${userId} non trouvé`);
      }

      // 3. Calculer la capacité théorique (via CapacityService existant)
      const capacity = await capacityService.calculateUserCapacity(userId, period);
      
      // 4. Récupérer les tâches assignées
      const assignedTasks = await this.getUserAssignedTasks(userId, period);
      
      // 5. Calculer la charge planifiée avec les allocations projets
      const plannedWorkload = await this.calculatePlannedWorkloadWithAllocations(userId, assignedTasks, period);
      
      // 6. Détecter les surcharges et conflits
      const overloadAnalysis = this.analyzeOverload(capacity, plannedWorkload);
      
      // 7. Générer les suggestions d'optimisation
      const suggestions = await this.generateOptimizationSuggestions(
        userId, 
        capacity, 
        plannedWorkload, 
        overloadAnalysis
      );
      
      // 8. Calculer les métriques avancées
      const metrics = this.calculateAdvancedMetrics(capacity, plannedWorkload);
      
      const workloadCalculation = {
        userId,
        period: { start: period.startDate, end: period.endDate },
        timeframe,
        calculatedAt: new Date(),
        
        // Capacité de base
        theoreticalHours: capacity.theoreticalDays * 7, // 7h/jour standard
        availableHours: capacity.availableDays * 7,
        
        // Charge planifiée
        plannedHours: plannedWorkload.totalEstimatedHours,
        confirmedHours: plannedWorkload.confirmedHours,
        
        // Disponibilité
        remainingHours: capacity.remainingDays * 7,
        overloadHours: capacity.overallocationDays ? capacity.overallocationDays * 7 : 0,
        
        // Analyse des risques
        overloadRisk: overloadAnalysis.riskLevel,
        conflictsDetected: overloadAnalysis.conflicts.length,
        
        // Suggestions
        optimizationSuggestions: suggestions,
        
        // Métriques
        utilizationRate: metrics.utilizationRate,
        efficiencyScore: metrics.efficiencyScore,
        burnoutRisk: metrics.burnoutRisk,
        
        // Détails
        taskBreakdown: plannedWorkload.taskBreakdown,
        projectDistribution: plannedWorkload.projectDistribution,
        weeklyDistribution: plannedWorkload.weeklyDistribution,
        allocationDetails: plannedWorkload.allocationDetails || {},
        
        // Alertes - convertir CapacityAlert en WorkloadAlert
        alerts: (capacity.alerts || []).map((alert: any) => ({
          id: `alert_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type: alert.type.toLowerCase() === 'overallocation' ? 'overload' : 'underload',
          severity: alert.severity.toLowerCase(),
          message: alert.message,
          createdAt: new Date()
        }))
      };

      
      return workloadCalculation;
      
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Calcule la charge pour toute une équipe
   */
  async calculateTeamWorkload(
    userIds: string[],
    timeframe: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{ [userId: string]: any }> {
    const calculations: { [userId: string]: any } = {};
    
    console.log(`🔄 Calcul workload équipe: ${userIds.length} utilisateurs`);
    
    // Calcul en parallèle pour la performance
    const promises = userIds.map(async (userId) => {
      try {
        const calculation = await this.calculateUserWorkload(userId, timeframe);
        return { userId, calculation };
      } catch (error) {
        
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    
    results.forEach((result) => {
      if (result) {
        calculations[result.userId] = result.calculation;
      }
    });
    
    
    return calculations;
  }

  /**
   * Détecte automatiquement les surcharges dans une équipe
   */
  async detectTeamOverloads(userIds: string[]): Promise<{
    overloadedUsers: string[];
    criticalUsers: string[];
    suggestions: string[];
    totalRiskScore: number;
  }> {
    const teamWorkloads = await this.calculateTeamWorkload(userIds);
    
    const overloadedUsers: string[] = [];
    const criticalUsers: string[] = [];
    const suggestions: string[] = [];
    let totalRiskScore = 0;
    
    Object.entries(teamWorkloads).forEach(([userId, workload]) => {
      // Détection surcharge
      if (workload.overloadRisk === 'high' || workload.overloadRisk === 'critical') {
        overloadedUsers.push(userId);
        
        if (workload.overloadRisk === 'critical') {
          criticalUsers.push(userId);
        }
      }
      
      // Accumulation du score de risque
      const riskValues: { [key: string]: number } = { low: 1, medium: 3, high: 7, critical: 10 };
      totalRiskScore += riskValues[workload.overloadRisk] || 0;
      
      // Suggestions automatiques
      if (workload.overloadHours > 0) {
        suggestions.push(`Réaffecter ${workload.overloadHours}h de ${userId} vers d'autres ressources`);
      }
    });
    
    return {
      overloadedUsers,
      criticalUsers,
      suggestions: Array.from(new Set(suggestions)), // Déduplication
      totalRiskScore
    };
  }

  // ========================================
  // FONCTIONS PRIVÉES ALGORITHMES
  // ========================================

  /**
   * Définit la période de calcul selon le timeframe
   */
  private getCalculationPeriod(timeframe: string): DatePeriod {
    const now = new Date();
    
    switch (timeframe) {
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'quarter':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(addMonths(now, 2))
        };
      case 'month':
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
    }
  }

  /**
   * Récupère les tâches assignées à un utilisateur pour une période
   */
  private async getUserAssignedTasks(userId: string, period: DatePeriod): Promise<Task[]> {
    try {
      // Récupérer toutes les tâches assignées à l'utilisateur
      const allTasks = await taskService.getTasksByAssignee(userId);
      
      // Filtrer les tâches dans la période et non terminées
      const periodTasks = allTasks.filter(task => {
        // Exclure les tâches terminées
        if (task.status === 'DONE') {
          return false;
        }
        
        // Inclure si dueDate dans la période OU si pas de dueDate mais tâche active
        if (task.dueDate) {
          return task.dueDate >= period.startDate && task.dueDate <= period.endDate;
        }
        
        // Tâches actives sans date limite
        return ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(task.status);
      });
      
      return periodTasks;
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Calcule la charge planifiée à partir des tâches avec prise en compte des allocations projets
   */
  private async calculatePlannedWorkloadWithAllocations(userId: string, tasks: Task[], period: DatePeriod): Promise<{
    totalEstimatedHours: number;
    confirmedHours: number;
    taskBreakdown: { [priority: string]: number };
    projectDistribution: { [projectId: string]: number };
    weeklyDistribution: { [week: string]: number };
    allocationDetails: { [projectId: string]: { rawHours: number; allocatedHours: number; percentage: number } };
  }> {
    let totalEstimatedHours = 0;
    let confirmedHours = 0;
    const taskBreakdown: { [priority: string]: number } = {};
    const projectDistribution: { [projectId: string]: number } = {};
    const weeklyDistribution: { [week: string]: number } = {};
    const allocationDetails: { [projectId: string]: { rawHours: number; allocatedHours: number; percentage: number } } = {};
    
    // Récupérer tous les projets uniques des tâches
    const projectIds = Array.from(new Set(tasks.map(task => task.projectId).filter(Boolean)));
    const projectAllocations: { [projectId: string]: number } = {};
    
    // Récupérer les allocations pour chaque projet
    for (const projectId of projectIds) {
      if (!projectId) continue; // Skip si projectId est undefined
      try {
        const project = await projectService.getProject(projectId);
        if (project && project.teamMembers) {
          const userMember = project.teamMembers.find(member => member.userId === userId);
          projectAllocations[projectId] = userMember?.allocationPercentage || 100; // Par défaut 100%
        } else {
          projectAllocations[projectId] = 100; // Par défaut si pas d'info
        }
      } catch (error) {
        console.warn(`Erreur lors de la récupération du projet ${projectId}:`, error);
        projectAllocations[projectId] = 100; // Par défaut en cas d'erreur
      }
    }
    
    // Calculer la charge en tenant compte des allocations
    tasks.forEach(task => {
      // Estimation en heures (storyPoints * 4h ou estimatedHours directement)
      const rawEstimatedHours = task.estimatedHours || (task.storyPoints || 0) * 4;
      
      // Appliquer le pourcentage d'allocation du projet
      const allocationPercentage = task.projectId ? projectAllocations[task.projectId] || 100 : 100;
      const adjustedEstimatedHours = rawEstimatedHours * (allocationPercentage / 100);
      
      // Enregistrer les détails d'allocation
      if (task.projectId) {
        if (!allocationDetails[task.projectId]) {
          allocationDetails[task.projectId] = { rawHours: 0, allocatedHours: 0, percentage: allocationPercentage };
        }
        allocationDetails[task.projectId].rawHours += rawEstimatedHours;
        allocationDetails[task.projectId].allocatedHours += adjustedEstimatedHours;
      }
      
      totalEstimatedHours += adjustedEstimatedHours;
      
      // Heures confirmées (tâches en cours)
      if (task.status === 'IN_PROGRESS') {
        confirmedHours += adjustedEstimatedHours;
      }
      
      // Répartition par priorité
      const priority = task.priority || 'P3';
      taskBreakdown[priority] = (taskBreakdown[priority] || 0) + adjustedEstimatedHours;
      
      // Répartition par projet
      if (task.projectId) {
        projectDistribution[task.projectId] = (projectDistribution[task.projectId] || 0) + adjustedEstimatedHours;
      }
      
      // Répartition hebdomadaire (si dueDate disponible)
      if (task.dueDate) {
        const weekKey = format(startOfWeek(task.dueDate), 'yyyy-MM-dd');
        weeklyDistribution[weekKey] = (weeklyDistribution[weekKey] || 0) + adjustedEstimatedHours;
      }
    });
    
    console.log(`💡 Charge ajustée pour ${userId}:`, {
      totalRawHours: tasks.reduce((sum, task) => sum + (task.estimatedHours || (task.storyPoints || 0) * 4), 0),
      totalAdjustedHours: totalEstimatedHours,
      allocationDetails
    });
    
    return {
      totalEstimatedHours,
      confirmedHours,
      taskBreakdown,
      projectDistribution,
      weeklyDistribution,
      allocationDetails
    };
  }

  /**
   * Calcule la charge planifiée à partir des tâches (ancienne méthode conservée pour compatibilité)
   */
  private calculatePlannedWorkload(tasks: Task[], period: DatePeriod): {
    totalEstimatedHours: number;
    confirmedHours: number;
    taskBreakdown: { [priority: string]: number };
    projectDistribution: { [projectId: string]: number };
    weeklyDistribution: { [week: string]: number };
  } {
    let totalEstimatedHours = 0;
    let confirmedHours = 0;
    const taskBreakdown: { [priority: string]: number } = {};
    const projectDistribution: { [projectId: string]: number } = {};
    const weeklyDistribution: { [week: string]: number } = {};
    
    tasks.forEach(task => {
      // Estimation en heures (storyPoints * 4h ou estimatedHours directement)
      const estimatedHours = task.estimatedHours || (task.storyPoints || 0) * 4;
      totalEstimatedHours += estimatedHours;
      
      // Heures confirmées (tâches en cours)
      if (task.status === 'IN_PROGRESS') {
        confirmedHours += estimatedHours;
      }
      
      // Répartition par priorité
      const priority = task.priority || 'P3';
      taskBreakdown[priority] = (taskBreakdown[priority] || 0) + estimatedHours;
      
      // Répartition par projet (seulement pour les tâches avec projet)
      if (task.projectId) {
        projectDistribution[task.projectId] = (projectDistribution[task.projectId] || 0) + estimatedHours;
      }
      
      // Répartition hebdomadaire (si dueDate disponible)
      if (task.dueDate) {
        const weekKey = format(startOfWeek(task.dueDate), 'yyyy-MM-dd');
        weeklyDistribution[weekKey] = (weeklyDistribution[weekKey] || 0) + estimatedHours;
      }
    });
    
    return {
      totalEstimatedHours,
      confirmedHours,
      taskBreakdown,
      projectDistribution,
      weeklyDistribution
    };
  }

  /**
   * Analyse les surcharges et conflits
   */
  private analyzeOverload(capacity: UserCapacity, planned: any): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    conflicts: string[];
    recommendations: string[];
  } {
    const availableHours = capacity.availableDays * 7;
    const plannedHours = planned.totalEstimatedHours;
    const overloadRatio = plannedHours / availableHours;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    const conflicts: string[] = [];
    const recommendations: string[] = [];
    
    // Détermination du niveau de risque
    if (overloadRatio <= 0.8) {
      riskLevel = 'low';
    } else if (overloadRatio <= 1.0) {
      riskLevel = 'medium';
      recommendations.push('Surveiller la charge de travail');
    } else if (overloadRatio <= 1.3) {
      riskLevel = 'high';
      conflicts.push(`Surcharge détectée: ${Math.round(overloadRatio * 100)}% de capacité utilisée`);
      recommendations.push('Réaffecter certaines tâches ou négocier les délais');
    } else {
      riskLevel = 'critical';
      conflicts.push(`Surcharge critique: ${Math.round(overloadRatio * 100)}% de capacité`);
      conflicts.push('Risque de burnout élevé');
      recommendations.push('Action immédiate requise: redistribution des tâches');
    }
    
    // Détection conflits spécifiques
    if (capacity.leaveDays > 0 && plannedHours > 0) {
      conflicts.push(`${capacity.leaveDays} jours de congé prévus durant la période`);
    }
    
    if (planned.taskBreakdown.P0 && planned.taskBreakdown.P0 > availableHours * 0.5) {
      conflicts.push('Trop de tâches critiques (P0) concentrées');
    }
    
    return { riskLevel, conflicts, recommendations };
  }

  /**
   * Génère des suggestions d'optimisation IA
   */
  private async generateOptimizationSuggestions(
    userId: string,
    capacity: UserCapacity,
    planned: any,
    overloadAnalysis: any
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const availableHours = capacity.availableDays * 7;
    const plannedHours = planned.totalEstimatedHours;
    
    // Suggestions basées sur la surcharge
    if (overloadAnalysis.riskLevel === 'high' || overloadAnalysis.riskLevel === 'critical') {
      const excessHours = plannedHours - availableHours;
      suggestions.push(`Réaffecter ${Math.ceil(excessHours)}h vers d'autres ressources`);
      
      // Suggérer les tâches à réaffecter (priorité faible en premier)
      const lowPriorityHours = planned.taskBreakdown.P3 || 0;
      if (lowPriorityHours > 0) {
        suggestions.push(`Commencer par réaffecter ${Math.ceil(lowPriorityHours)}h de tâches P3`);
      }
    }
    
    // Suggestions basées sur la distribution
    const projectCount = Object.keys(planned.projectDistribution).length;
    if (projectCount > 5) {
      suggestions.push(`Concentrer sur moins de projets (actuellement ${projectCount})`);
    }
    
    // Suggestions basées sur les congés
    if (capacity.leaveDays > 0) {
      suggestions.push(`Anticiper les ${capacity.leaveDays} jours de congé dans la planification`);
    }
    
    // Suggestions d'efficacité
    if (planned.confirmedHours < plannedHours * 0.3) {
      suggestions.push('Démarrer plus de tâches pour maintenir le momentum');
    }
    
    return suggestions;
  }

  /**
   * Calcule les métriques avancées
   */
  private calculateAdvancedMetrics(capacity: UserCapacity, planned: any): {
    utilizationRate: number;
    efficiencyScore: number;
    burnoutRisk: number;
  } {
    const availableHours = capacity.availableDays * 7;
    const plannedHours = planned.totalEstimatedHours;
    
    // Taux d'utilisation (0-100%)
    const utilizationRate = Math.min((plannedHours / availableHours) * 100, 100);
    
    // Score d'efficacité basé sur la répartition des priorités
    const criticalHours = planned.taskBreakdown.P0 || 0;
    const highHours = planned.taskBreakdown.P1 || 0;
    const mediumHours = planned.taskBreakdown.P2 || 0;
    
    const efficiencyScore = plannedHours > 0 
      ? ((criticalHours * 4 + highHours * 3 + mediumHours * 2) / (plannedHours * 4)) * 100
      : 0;
    
    // Risque de burnout (0-100%)
    let burnoutRisk = 0;
    if (utilizationRate > 100) {
      burnoutRisk = Math.min(((utilizationRate - 100) / 50) * 100, 100);
    } else if (utilizationRate > 85) {
      burnoutRisk = ((utilizationRate - 85) / 15) * 30;
    }
    
    return {
      utilizationRate: Math.round(utilizationRate),
      efficiencyScore: Math.round(efficiencyScore),
      burnoutRisk: Math.round(burnoutRisk)
    };
  }

  // ========================================
  // API PUBLIQUES POUR COMPOSANTS
  // ========================================

  /**
   * API simplifiée pour les composants React
   */
  async getWorkloadSummary(userId: string): Promise<{
    isOverloaded: boolean;
    utilizationRate: number;
    remainingCapacity: number;
    alertCount: number;
    nextDeadline?: Date;
  }> {
    try {
      const workload = await this.calculateUserWorkload(userId, 'week');
      
      return {
        isOverloaded: workload.overloadRisk === 'high' || workload.overloadRisk === 'critical',
        utilizationRate: workload.utilizationRate,
        remainingCapacity: Math.max(workload.remainingHours, 0),
        alertCount: workload.alerts.length,
        nextDeadline: undefined // TODO: calculer depuis les tâches
      };
    } catch (error) {
      return {
        isOverloaded: false,
        utilizationRate: 0,
        remainingCapacity: 0,
        alertCount: 0
      };
    }
  }

  /**
   * Suggestions de réaffectation automatique
   */
  async suggestReallocation(fromUserId: string, overloadHours: number): Promise<{
    candidates: { userId: string; availableHours: number; matchScore: number }[];
    recommendations: string[];
  }> {
    try {
      // Récupérer tous les utilisateurs actifs
      const allUsers = await userService.getAllUsers();
      const candidates: { userId: string; availableHours: number; matchScore: number }[] = [];
      
      // Calculer la disponibilité de chaque utilisateur
      for (const user of allUsers) {
        if (user.id === fromUserId) continue;
        
        const workload = await this.calculateUserWorkload(user.id, 'week');
        if (workload.remainingHours > 0) {
          candidates.push({
            userId: user.id,
            availableHours: workload.remainingHours,
            matchScore: this.calculateMatchScore(user, workload) // TODO: implémenter
          });
        }
      }
      
      // Trier par score de compatibilité
      candidates.sort((a, b) => b.matchScore - a.matchScore);
      
      const recommendations = [
        `Réaffecter ${overloadHours}h vers ${candidates.length} ressources disponibles`,
        'Prioriser les ressources avec compétences similaires',
        'Vérifier la disponibilité avant réaffectation'
      ];
      
      return { candidates: candidates.slice(0, 5), recommendations };
    } catch (error) {
      return { candidates: [], recommendations: ['Erreur lors du calcul des suggestions'] };
    }
  }

  private calculateMatchScore(user: User, workload: any): number {
    // Score basique basé sur la disponibilité et l'utilisation actuelle
    let score = Math.max(0, 100 - (workload.utilizationRate || 0));
    
    // Bonus si peu de projets (moins de contexte switching)
    const projectCount = Object.keys(workload.projectDistribution || {}).length;
    if (projectCount < 3) score += 20;
    
    return Math.min(score, 100);
  }
}

export const workloadCalculatorService = new WorkloadCalculatorService();