import { dashboardHubService } from './dashboard-hub.service';
import { userSimulationService } from './user-simulation.service';

/**
 * Extension du DashboardHubService qui prend en compte la simulation d'utilisateur
 */
class SimulatedDashboardHubService {

  /**
   * Récupère les KPIs pour l'utilisateur effectif (simulé ou réel)
   */
  async getPersonalKPIs(currentUserId: string) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getPersonalKPIs(effectiveUserId || currentUserId);
  }

  /**
   * Récupère les tâches pour l'utilisateur effectif
   */
  async getMyTasks(currentUserId: string, maxTasks: number = 10) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getMyTasks(effectiveUserId || currentUserId, maxTasks);
  }

  /**
   * Récupère les événements pour l'utilisateur effectif
   */
  async getUpcomingEvents(currentUserId: string, days: number = 14) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getUpcomingEvents(effectiveUserId || currentUserId, days);
  }

  /**
   * Récupère l'analyse de charge pour l'utilisateur effectif
   */
  async getWorkloadAnalysis(currentUserId: string) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getWorkloadAnalysis(effectiveUserId || currentUserId);
  }

  /**
   * Récupère le statut de l'équipe pour l'utilisateur effectif
   */
  async getTeamStatus(currentUserId: string) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getTeamStatus(effectiveUserId || currentUserId);
  }

  /**
   * Récupère les notifications pour l'utilisateur effectif
   */
  async getUnreadNotifications(currentUserId: string) {
    const effectiveUserId = userSimulationService.getEffectiveUserId(currentUserId);
    return dashboardHubService.getUnreadNotifications(effectiveUserId || currentUserId);
  }

  /**
   * Indique si on est en mode simulation
   */
  isSimulating(): boolean {
    return userSimulationService.isSimulating();
  }

  /**
   * Obtient l'utilisateur simulé
   */
  getSimulatedUser() {
    return userSimulationService.getSimulatedUser();
  }

  /**
   * Obtient l'utilisateur admin qui fait la simulation
   */
  getOriginalUserId(): string {
    return userSimulationService.getOriginalUserId();
  }
}

export const simulatedDashboardHubService = new SimulatedDashboardHubService();