import { UserRole } from '../types';

/**
 * Mappage des rôles techniques vers leurs libellés d'affichage
 */
const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  responsable: 'Responsable',
  manager: 'Manager',
  teamLead: 'Référent technique',
  contributor: 'Contributeur',
  viewer: 'Observateur'
};

/**
 * Retourne le libellé d'affichage d'un rôle
 */
export function getRoleDisplayLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}

/**
 * Retourne la couleur associée à un rôle pour les chips Material-UI
 */
export function getRoleColor(role: UserRole): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' {
  const colors: Record<UserRole, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
    admin: 'error',
    responsable: 'warning', 
    manager: 'primary',
    teamLead: 'secondary',
    contributor: 'success',
    viewer: 'default',
  };
  return colors[role] || 'default';
}