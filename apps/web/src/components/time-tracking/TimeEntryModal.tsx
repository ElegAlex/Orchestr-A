"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import { timeTrackingService } from "@/services/time-tracking.service";
import { projectsService } from "@/services/projects.service";
import { tasksService } from "@/services/tasks.service";
import {
  ActivityType,
  CreateTimeEntryDto,
  Project,
  Task,
  TimeEntry,
} from "@/types";
import { ThirdPartySelector } from "@/components/third-parties/ThirdPartySelector";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (entry: TimeEntry) => void;
  mode: "create" | "edit";
  /** Entrée existante pour le mode édition (non utilisée par V5, prévu pour V6+). */
  initialEntry?: TimeEntry;
  /** Pré-remplissage pour un appel depuis une tâche (dashboard). */
  prefill?: {
    taskId?: string;
    projectId?: string | null;
  };
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Modal partagée "Saisir du temps".
 *
 * Utilisée par :
 *   - `/time-tracking` (création manuelle).
 *   - Dashboard (quick time entry depuis une tâche à venir — cf. D3).
 *
 * Contenu visuel strictement identique au rendu inline historique de
 * `time-tracking/page.tsx` (V4 / pré-V5). Toute modification de label,
 * couleur ou ordre d'affichage est proscrite par décision D3.
 */
export function TimeEntryModal({
  open,
  onClose,
  onSuccess,
  mode,
  initialEntry,
  prefill,
}: Props) {
  const t = useTranslations("hr.timeTracking");
  const tc = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateTimeEntryDto>({
    projectId: "",
    taskId: "",
    date: todayISO(),
    hours: 0,
    description: "",
    activityType: ActivityType.DEVELOPMENT,
  });
  const [declareForThirdParty, setDeclareForThirdParty] = useState(false);
  const [thirdPartyId, setThirdPartyId] = useState<string | null>(null);
  const canDeclareForThirdParty = hasPermission(
    "time_tracking:declare_for_third_party",
  );

  // Charge projets + tâches à l'ouverture (même politique que /time-tracking).
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadRefs = async () => {
      if (!user?.id) return;

      if (hasPermission("projects:read")) {
        try {
          const projectsData = await projectsService.getByUser(user.id);
          if (!cancelled) {
            setProjects(Array.isArray(projectsData) ? projectsData : []);
          }
        } catch (err) {
          if (!cancelled) setProjects([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            console.error("Error fetching projects:", err);
          }
        }
      }

      try {
        const tasksData = await tasksService.getByAssignee(user.id);
        if (!cancelled) {
          setTasks(Array.isArray(tasksData) ? tasksData : []);
        }
      } catch (err) {
        if (!cancelled) setTasks([]);
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status !== 404) {
          console.error("Error fetching tasks:", err);
        }
      }
    };

    void loadRefs();
    return () => {
      cancelled = true;
    };
    // `hasPermission` est une fermeture non-mémoïsée du hook usePermissions :
    // l'inclure dans les deps ferait ré-exécuter l'effet à chaque rerender du
    // parent et spammerait les endpoints projets/tâches. On suit le pattern
    // historique de `/time-tracking` (cf. useCallback `[user]` only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Reset/prefill form à chaque ouverture.
  const resetForm = useCallback(() => {
    setFormData({
      projectId: prefill?.projectId ?? "",
      taskId: prefill?.taskId ?? "",
      date: todayISO(),
      hours: 0,
      description: "",
      activityType: ActivityType.DEVELOPMENT,
    });
    setDeclareForThirdParty(false);
    setThirdPartyId(null);
  }, [prefill?.projectId, prefill?.taskId]);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialEntry) {
        setFormData({
          projectId: initialEntry.projectId ?? "",
          taskId: initialEntry.taskId ?? "",
          date: initialEntry.date.split("T")[0],
          hours: initialEntry.hours,
          description: initialEntry.description ?? "",
          activityType: initialEntry.activityType,
        });
        setDeclareForThirdParty(!!initialEntry.thirdPartyId);
        setThirdPartyId(initialEntry.thirdPartyId ?? null);
      } else {
        resetForm();
      }
    }
  }, [open, mode, initialEntry, resetForm]);

  const getAvailableTasksForProject = () => {
    if (!formData.projectId) return [];
    return tasks.filter((tk) => tk.projectId === formData.projectId);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (declareForThirdParty && !thirdPartyId) {
      toast.error("Sélectionnez un tiers pour déclarer en son nom");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: CreateTimeEntryDto = {
        ...formData,
        thirdPartyId: declareForThirdParty
          ? (thirdPartyId ?? undefined)
          : undefined,
      };
      const entry = await timeTrackingService.create(payload);
      toast.success(t("messages.created"));
      onSuccess(entry);
      onClose();
      resetForm();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.saveError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
    resetForm();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Saisir du temps
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée (heures) *
            </label>
            <input
              type="number"
              required
              min="0.25"
              step="0.25"
              value={formData.hours || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  hours: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("fields.hoursPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d&apos;activité *
            </label>
            <select
              required
              value={formData.activityType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  activityType: e.target.value as ActivityType,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={ActivityType.DEVELOPMENT}>Développement</option>
              <option value={ActivityType.MEETING}>Réunion</option>
              <option value={ActivityType.SUPPORT}>Support</option>
              <option value={ActivityType.TRAINING}>Formation</option>
              <option value={ActivityType.OTHER}>Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Projet (optionnel)
            </label>
            <select
              value={formData.projectId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  projectId: e.target.value,
                  taskId: "", // Reset task when project changes
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("fields.noProject")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {formData.projectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tâche (optionnel)
              </label>
              <select
                value={formData.taskId}
                onChange={(e) =>
                  setFormData({ ...formData, taskId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t("fields.noTask")}</option>
                {getAvailableTasksForProject().map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canDeclareForThirdParty && (
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={declareForThirdParty}
                  onChange={(e) => {
                    setDeclareForThirdParty(e.target.checked);
                    if (!e.target.checked) setThirdPartyId(null);
                  }}
                  className="h-4 w-4"
                />
                Déclarer pour le compte d&apos;un tiers
              </label>
              {declareForThirdParty && (
                <div className="mt-2">
                  <ThirdPartySelector
                    value={thirdPartyId}
                    onChange={setThirdPartyId}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Le tiers doit être rattaché au projet ou à la tâche
                    sélectionnée.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("fields.descriptionPlaceholder")}
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {tc("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {tc("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TimeEntryModal;
