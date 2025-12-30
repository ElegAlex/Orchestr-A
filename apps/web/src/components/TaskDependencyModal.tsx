'use client';

import { useState, useEffect } from 'react';
import { Task, TaskDependency, TaskStatus } from '@/types';
import { TaskDependencySelector } from './TaskDependencySelector';
import { DependencyValidationBanner } from './DependencyValidationBanner';
import {
  detectDateConflicts,
  getStatusColorClass,
  getStatusLabel,
} from '@/utils/dependencyValidation';
import { tasksService } from '@/services/tasks.service';
import toast from 'react-hot-toast';

interface TaskDependencyModalProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onSave: () => void;
}

export function TaskDependencyModal({
  task,
  allTasks,
  onClose,
  onSave,
}: TaskDependencyModalProps) {
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize selected dependency IDs from task
  useEffect(() => {
    const depIds = task.dependencies?.map((d) => d.dependsOnTaskId) || [];
    setSelectedDependencyIds(depIds);
  }, [task.dependencies]);

  // Get the selected tasks to calculate conflicts
  const selectedTasks = allTasks.filter((t) => selectedDependencyIds.includes(t.id));
  const mockDependencies: TaskDependency[] = selectedTasks.map((t) => ({
    dependsOnTaskId: t.id,
    dependsOnTask: {
      id: t.id,
      title: t.title,
      status: t.status,
      endDate: t.endDate,
    },
  }));
  const conflicts = detectDateConflicts({ startDate: task.startDate }, mockDependencies);

  const handleDependencyChange = (newIds: string[]) => {
    setSelectedDependencyIds(newIds);
    const originalIds = task.dependencies?.map((d) => d.dependsOnTaskId) || [];
    const hasChanged =
      newIds.length !== originalIds.length ||
      newIds.some((id) => !originalIds.includes(id));
    setHasChanges(hasChanged);
  };

  const handleSave = async () => {
    const currentIds = task.dependencies?.map((d) => d.dependsOnTaskId) || [];
    const toAdd = selectedDependencyIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !selectedDependencyIds.includes(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // Remove dependencies
      for (const depId of toRemove) {
        const dependency = task.dependencies?.find((d) => d.dependsOnTaskId === depId);
        if (dependency?.id) {
          await tasksService.removeDependency(task.id, dependency.id);
        }
      }

      // Add new dependencies
      for (const depId of toAdd) {
        await tasksService.addDependency(task.id, depId);
      }

      toast.success('Dependances mises a jour');
      onSave();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || 'Erreur lors de la mise a jour des dependances'
      );
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, saving]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[500px] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Modifier les dependances
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600 truncate">{task.title}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColorClass(
                    task.status
                  )}`}
                >
                  {getStatusLabel(task.status)}
                </span>
              </div>
              {task.startDate && task.endDate && (
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(task.startDate).toLocaleDateString('fr-FR')} -{' '}
                  {new Date(task.endDate).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          {/* Validation Banner */}
          <DependencyValidationBanner conflicts={conflicts} />

          {/* Dependency Selector */}
          <TaskDependencySelector
            currentTaskId={task.id}
            currentTaskStartDate={task.startDate}
            selectedDependencyIds={selectedDependencyIds}
            availableTasks={allTasks}
            onChange={handleDependencyChange}
            disabled={saving}
            label="Taches prealables"
            placeholder="Selectionner les taches dont depend cette tache"
          />

          {/* Summary */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{selectedDependencyIds.length}</span> dependance
              {selectedDependencyIds.length !== 1 ? 's' : ''} selectionnee
              {selectedDependencyIds.length !== 1 ? 's' : ''}
              {conflicts.length > 0 && (
                <span className="text-amber-600">
                  {' '}
                  dont <span className="font-medium">{conflicts.length}</span> conflit
                  {conflicts.length > 1 ? 's' : ''} de dates
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
