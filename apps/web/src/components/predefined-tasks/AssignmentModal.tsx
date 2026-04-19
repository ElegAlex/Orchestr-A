"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskAssignment,
  TaskDuration,
} from "@/services/predefined-tasks.service";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";
import Link from "next/link";

const DURATION_LABELS: Record<string, string> = {
  HALF_DAY: "Demi-journée",
  FULL_DAY: "Journée entière",
  TIME_SLOT: "Créneau horaire",
  MORNING: "Matin",
  AFTERNOON: "Après-midi",
};

function formatDuration(task: PredefinedTask): string {
  if (task.defaultDuration === "TIME_SLOT" && task.startTime && task.endTime) {
    return `${task.startTime} - ${task.endTime}`;
  }
  return DURATION_LABELS[task.defaultDuration];
}

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
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isBulk = dates.length > 1 || userIds.length > 1;
  const isViewMode =
    !!existingAssignment && dates.length === 1 && userIds.length === 1;

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    if (!hasPermission("predefined_tasks:view")) {
      setTasks([]);
      setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  // Convertir defaultDuration (config tâche) en period (assignment API)
  const toPeriod = (duration: TaskDuration): "MORNING" | "AFTERNOON" | "FULL_DAY" => {
    if (duration === "HALF_DAY") return "MORNING";
    return "FULL_DAY"; // FULL_DAY et TIME_SLOT → FULL_DAY
  };

  const handleAssign = async (task: PredefinedTask) => {
    setAssigning(true);
    try {
      const period = toPeriod(task.defaultDuration);
      if (isBulk) {
        await predefinedTasksService.bulkAssign({
          predefinedTaskId: task.id,
          userIds,
          dates: dates.map((d) => format(d, "yyyy-MM-dd")),
          period,
        });
        toast.success(
          `${dates.length * userIds.length} assignation(s) créée(s)`,
        );
      } else {
        await predefinedTasksService.createAssignment({
          predefinedTaskId: task.id,
          userId: userIds[0],
          date: format(dates[0], "yyyy-MM-dd"),
          period,
        });
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
      setAssigning(false);
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
            {isBulk && (
              <p className="text-xs text-blue-600 mt-0.5">
                {dates.length} jour(s) x {userIds.length} personne(s)
              </p>
            )}
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

        {/* Content */}
        {isViewMode && existingAssignment ? (
          /* View mode: show existing assignment */
          <div className="space-y-4">
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
                      {existingAssignment.predefinedTask
                        ? formatDuration(existingAssignment.predefinedTask)
                        : DURATION_LABELS[existingAssignment.period]}
                    </p>
                  </div>
                </>
              )}
            </div>

            {existingAssignment.note && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Note</p>
                <p className="text-sm text-gray-700">
                  {existingAssignment.note}
                </p>
              </div>
            )}

            {/* Footer for view mode */}
            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          /* Assignment mode: clickable task list */
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-sm text-gray-500">
                  Chargement des tâches...
                </span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 italic mb-3">
                  Aucune tâche prédéfinie configurée
                </p>
                {hasPermission("predefined_tasks:edit") && (
                  <Link
                    href="/admin/predefined-tasks"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Configurer les tâches prédéfinies
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleAssign(task)}
                    disabled={assigning}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
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
                      {formatDuration(task)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Footer for assignment mode */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              {hasPermission("predefined_tasks:create") && tasks.length > 0 ? (
                <Link
                  href="/admin/predefined-tasks"
                  className="text-xs text-gray-500 hover:text-blue-600 transition"
                >
                  Gérer les tâches prédéfinies
                </Link>
              ) : (
                <span />
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
