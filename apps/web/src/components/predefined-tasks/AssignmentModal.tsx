"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskAssignment,
  TaskDuration,
  BulkAssignmentDto,
  CreateAssignmentDto,
} from "@/services/predefined-tasks.service";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

const DURATION_LABELS: Record<TaskDuration, string> = {
  HALF_DAY: "Demi-journée",
  FULL_DAY: "Journée entière",
};

interface AssignmentModalProps {
  /** Date(s) sélectionnée(s) — si plusieurs, mode bulk */
  dates: Date[];
  /** Utilisateur(s) cible(s) — si plusieurs, mode bulk */
  userIds: string[];
  /** Assignation existante à afficher / supprimer (mode consultation) */
  existingAssignment?: PredefinedTaskAssignment | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignmentModal({
  dates,
  userIds,
  existingAssignment,
  onClose,
  onSuccess,
}: AssignmentModalProps) {
  const { hasPermission } = usePermissions();
  const [tasks, setTasks] = useState<PredefinedTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [duration, setDuration] = useState<TaskDuration>("FULL_DAY");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isBulk = dates.length > 1 || userIds.length > 1;
  const isViewMode =
    !!existingAssignment && dates.length === 1 && userIds.length === 1;

  useEffect(() => {
    loadTasks();
    if (existingAssignment) {
      setSelectedTaskId(existingAssignment.predefinedTaskId);
      setDuration(existingAssignment.duration);
      setNote(existingAssignment.note ?? "");
    }
  }, [existingAssignment]);

  const loadTasks = async () => {
    if (!hasPermission("predefined_tasks:view")) {
      setTasks([]);
      return;
    }
    try {
      const response = await predefinedTasksService.getAll();
      const list = Array.isArray(response)
        ? (response as PredefinedTask[])
        : (response.data ?? []);
      setTasks(list.filter((t) => t.isActive));
    } catch {
      setTasks([]);
    }
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleAssign = async () => {
    if (!selectedTaskId) {
      toast.error("Sélectionnez une tâche");
      return;
    }
    setSaving(true);
    try {
      if (isBulk) {
        const dto: BulkAssignmentDto = {
          predefinedTaskId: selectedTaskId,
          userIds,
          dates: dates.map((d) => format(d, "yyyy-MM-dd")),
          duration,
          note: note || undefined,
        };
        await predefinedTasksService.bulkAssign(dto);
        toast.success(
          `${dates.length * userIds.length} assignation(s) créée(s)`,
        );
      } else {
        const dto: CreateAssignmentDto = {
          predefinedTaskId: selectedTaskId,
          userId: userIds[0],
          date: format(dates[0], "yyyy-MM-dd"),
          duration,
          note: note || undefined,
        };
        await predefinedTasksService.createAssignment(dto);
        toast.success("Assignation créée");
      }
      onSuccess();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de l'assignation",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingAssignment) return;
    if (!confirm("Supprimer cette assignation ?")) return;
    setDeleting(true);
    try {
      await predefinedTasksService.deleteAssignment(existingAssignment.id);
      toast.success("Assignation supprimée");
      onSuccess();
      onClose();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const dateLabel =
    dates.length === 1
      ? format(dates[0], "EEEE d MMMM yyyy", { locale: fr })
      : `${dates.length} jours sélectionnés`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isViewMode ? "Tâche prédéfinie" : "Assigner une tâche"}
            </h2>
            <p className="text-sm text-gray-500">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Task selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tâche prédéfinie *
            </label>
            {isViewMode && existingAssignment ? (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                {existingAssignment.predefinedTask && (
                  <>
                    <span
                      className="text-xl w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${existingAssignment.predefinedTask.color}20`,
                      }}
                    >
                      {existingAssignment.predefinedTask.icon}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {existingAssignment.predefinedTask.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {DURATION_LABELS[existingAssignment.duration]}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucune tâche prédéfinie disponible
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {tasks.map((task) => (
                      <label
                        key={task.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          selectedTaskId === task.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="task"
                          value={task.id}
                          checked={selectedTaskId === task.id}
                          onChange={() => {
                            setSelectedTaskId(task.id);
                            setDuration(task.defaultDuration);
                          }}
                          className="sr-only"
                        />
                        <span
                          className="text-xl w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ backgroundColor: `${task.color}20` }}
                        >
                          {task.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">
                            {task.name}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: `${task.color}20`,
                            color: task.color,
                          }}
                        >
                          {DURATION_LABELS[task.defaultDuration]}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duration selector (only in edit mode) */}
          {!isViewMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée
              </label>
              <div className="flex space-x-3">
                {(["FULL_DAY", "HALF_DAY"] as TaskDuration[]).map((d) => (
                  <label
                    key={d}
                    className={`flex-1 flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer transition text-sm ${
                      duration === d
                        ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="duration"
                      value={d}
                      checked={duration === d}
                      onChange={() => setDuration(d)}
                      className="sr-only"
                    />
                    {DURATION_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Selected task preview */}
          {!isViewMode && selectedTask && (
            <div
              className="flex items-center space-x-3 p-3 rounded-lg border"
              style={{
                borderColor: selectedTask.color,
                backgroundColor: `${selectedTask.color}10`,
              }}
            >
              <span className="text-xl">{selectedTask.icon}</span>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {selectedTask.name}
                </p>
                <p className="text-xs" style={{ color: selectedTask.color }}>
                  {DURATION_LABELS[duration]}
                  {isBulk &&
                    ` • ${dates.length} jours × ${userIds.length} personne(s) = ${dates.length * userIds.length} assignation(s)`}
                </p>
              </div>
            </div>
          )}

          {/* Note */}
          {!isViewMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optionnel)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Informations complémentaires..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* View mode: note */}
          {isViewMode && existingAssignment?.note && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Note</p>
              <p className="text-sm text-gray-700">{existingAssignment.note}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          {isViewMode ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Fermer
            </button>
            {!isViewMode && (
              <button
                onClick={handleAssign}
                disabled={saving || !selectedTaskId}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                )}
                <span>Assigner</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
