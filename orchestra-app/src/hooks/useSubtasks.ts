import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { taskService } from '../services/task.service';

/**
 * Hook pour gérer les sous-tâches d'une tâche parente
 * Les sous-tâches sont des tâches normales avec parentTaskId défini
 */
export const useSubtasks = (parentTaskId: string | undefined) => {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubtasks = useCallback(async () => {
    if (!parentTaskId) return;

    try {
      setLoading(true);
      setError(null);
      const tasks = await taskService.getTasksByParentId(parentTaskId);
      setSubtasks(tasks || []);
    } catch (err) {
      console.error('Erreur lors du chargement des sous-tâches:', err);
      setError('Impossible de charger les sous-tâches');
      setSubtasks([]);
    } finally {
      setLoading(false);
    }
  }, [parentTaskId]);

  useEffect(() => {
    if (parentTaskId) {
      loadSubtasks();
    } else {
      setSubtasks([]);
    }
  }, [parentTaskId, loadSubtasks]);

  const createSubtask = useCallback(async (subtaskData: Partial<Task>) => {
    if (!parentTaskId) {
      console.error('[useSubtasks] parentTaskId manquant');
      return null;
    }

    if (!subtaskData.title || !subtaskData.projectId || !subtaskData.createdBy) {
      console.error('[useSubtasks] Données manquantes:', { title: subtaskData.title, projectId: subtaskData.projectId, createdBy: subtaskData.createdBy });
      setError('Titre, projet et créateur sont requis');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useSubtasks] Création sous-tâche:', { parentTaskId, title: subtaskData.title });

      // Créer un objet Task complet avec toutes les propriétés requises
      const taskToCreate: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        parentTaskId,
        projectId: subtaskData.projectId,
        type: subtaskData.type || 'TASK',
        status: subtaskData.status || 'TODO',
        priority: subtaskData.priority || 'P2',
        title: subtaskData.title,
        description: subtaskData.description || '',
        createdBy: subtaskData.createdBy,
        dependencies: [],
        labels: [],
        attachments: [],
        comments: [],
      };

      const newSubtask = await taskService.createTask(taskToCreate);
      console.log('[useSubtasks] Sous-tâche créée:', newSubtask.id);

      await loadSubtasks();
      return newSubtask;
    } catch (err) {
      console.error('[useSubtasks] Erreur lors de la création de la sous-tâche:', err);
      setError('Impossible de créer la sous-tâche: ' + (err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [parentTaskId, loadSubtasks]);

  const updateSubtask = useCallback(async (subtaskId: string, updates: Partial<Task>) => {
    try {
      setLoading(true);
      setError(null);
      await taskService.updateTask(subtaskId, updates);
      await loadSubtasks();
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la sous-tâche:', err);
      setError('Impossible de mettre à jour la sous-tâche');
    } finally {
      setLoading(false);
    }
  }, [loadSubtasks]);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    try {
      setLoading(true);
      setError(null);
      await taskService.deleteTask(subtaskId);
      await loadSubtasks();
    } catch (err) {
      console.error('Erreur lors de la suppression de la sous-tâche:', err);
      setError('Impossible de supprimer la sous-tâche');
    } finally {
      setLoading(false);
    }
  }, [loadSubtasks]);

  const getCompletionStats = useCallback(() => {
    const total = subtasks.length;
    const completed = subtasks.filter(st => st.status === 'DONE').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending: total - completed,
      percentage,
    };
  }, [subtasks]);

  return {
    subtasks,
    loading,
    error,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    refreshSubtasks: loadSubtasks,
    stats: getCompletionStats(),
  };
};
