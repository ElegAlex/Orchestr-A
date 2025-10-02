/**
 * Utilitaires pour les Jalons (Milestones)
 *
 * Calcul automatique du statut basé sur l'état des tâches liées
 */

import { Task, MilestoneStatus } from '../types';

/**
 * Calcule automatiquement le statut d'un jalon basé sur ses tâches
 *
 * Logique :
 * - `completed` : Toutes les tâches sont terminées (DONE)
 * - `in_progress` : Au moins une tâche est en cours (IN_PROGRESS) ou terminée
 * - `upcoming` : Aucune tâche n'a été commencée (toutes en BACKLOG ou TODO)
 *
 * @param tasks - Liste des tâches liées au jalon
 * @returns Le statut calculé du jalon
 */
export const calculateMilestoneStatus = (tasks: Task[]): MilestoneStatus => {
  // Si pas de tâches, le jalon est à venir
  if (tasks.length === 0) {
    return 'upcoming';
  }

  const completedTasks = tasks.filter(task => task.status === 'DONE');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');

  // Si toutes les tâches sont terminées
  if (completedTasks.length === tasks.length) {
    return 'completed';
  }

  // Si au moins une tâche est en cours ou terminée
  if (inProgressTasks.length > 0 || completedTasks.length > 0) {
    return 'in_progress';
  }

  // Sinon toutes les tâches sont à venir (BACKLOG, TODO, BLOCKED)
  return 'upcoming';
};

/**
 * Obtient le label localisé du statut d'un jalon
 *
 * @param status - Le statut du jalon
 * @returns Le label en français
 */
export const getMilestoneStatusLabel = (status: MilestoneStatus): string => {
  const labels: Record<MilestoneStatus, string> = {
    'upcoming': 'À venir',
    'in_progress': 'En cours',
    'completed': 'Terminé',
  };
  return labels[status] || status;
};

/**
 * Obtient la couleur Material-UI associée à un statut de jalon
 *
 * @param status - Le statut du jalon
 * @returns La couleur Material-UI
 */
export const getMilestoneStatusColor = (status: MilestoneStatus): 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'upcoming':
      return 'info';
    case 'in_progress':
      return 'warning';
    case 'completed':
      return 'success';
    default:
      return 'info';
  }
};
