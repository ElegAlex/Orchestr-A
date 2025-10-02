/**
 * Simple Task - Tâche rapide sans projet
 * Architecture propre, séparée des Project Tasks
 */

export interface SimpleTask {
  id: string;
  title: string;
  description: string;

  // Date unique (pas de multi-jours)
  date: Date;

  // Créneau horaire
  timeSlot: {
    start: string; // Format "HH:mm" (ex: "09:00")
    end: string;   // Format "HH:mm" (ex: "17:00")
  };

  // Un seul assigné
  assignedTo: string; // User ID

  // Métadonnées simples
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';

  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Données pour créer une Simple Task
 */
export interface CreateSimpleTaskInput {
  title: string;
  description?: string;
  date: Date;
  timeSlot: {
    start: string;
    end: string;
  };
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}
