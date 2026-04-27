"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";
import {
  predefinedTasksService,
  PredefinedTask,
  CreatePredefinedTaskDto,
  UpdatePredefinedTaskDto,
  TaskDuration,
  PredefinedTaskRecurringRule,
} from "@/services/predefined-tasks.service";
import toast from "react-hot-toast";
import { RecurringRulesModal } from "@/components/predefined-tasks/RecurringRulesModal";
import { WeightInput } from "@/components/predefined-tasks/WeightInput";

const DURATION_LABELS: Record<TaskDuration, string> = {
  HALF_DAY: "Demi-journée",
  FULL_DAY: "Journée entière",
  TIME_SLOT: "Créneau horaire",
};

const DEFAULT_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
];

const DEFAULT_ICONS = [
  "📋",
  "🔧",
  "📊",
  "🎯",
  "🚀",
  "📝",
  "⚡",
  "🏗️",
  "🔍",
  "📌",
  "🛠️",
  "📈",
  "🎨",
  "💼",
  "🔑",
  "🌐",
  "📡",
  "🏛️",
  "🌿",
  "⭐",
];

interface TaskFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  defaultDuration: TaskDuration;
  startTime: string;
  endTime: string;
  isExternalIntervention: boolean;
  isTeleworkAllowed: boolean;
  weight: number;
}

const EMPTY_FORM: TaskFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  icon: "📋",
  defaultDuration: "FULL_DAY",
  startTime: "09:00",
  endTime: "12:00",
  isExternalIntervention: false,
  isTeleworkAllowed: true,
  weight: 1,
};

function formatDuration(task: PredefinedTask): string {
  if (task.defaultDuration === "TIME_SLOT" && task.startTime && task.endTime) {
    return `${task.startTime} - ${task.endTime}`;
  }
  return DURATION_LABELS[task.defaultDuration];
}

export default function PredefinedTasksAdminPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission("predefined_tasks:view");
  const canCreate = hasPermission("predefined_tasks:create");

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<PredefinedTask[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PredefinedTask | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesTask, setRulesTask] = useState<PredefinedTask | null>(null);
  const [rulesForTask, setRulesForTask] = useState<
    PredefinedTaskRecurringRule[]
  >([]);

  useEffect(() => {
    if (canView) {
      fetchTasks();
    }
  }, [canView]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const list = await predefinedTasksService.getAll();
      setTasks(list);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement des tâches prédéfinies");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setShowCreateModal(true);
  };

  const openEdit = (task: PredefinedTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      description: task.description ?? "",
      color: task.color,
      icon: task.icon,
      defaultDuration: task.defaultDuration,
      startTime: task.startTime ?? "09:00",
      endTime: task.endTime ?? "12:00",
      isExternalIntervention: task.isExternalIntervention ?? false,
      isTeleworkAllowed: task.isTeleworkAllowed ?? true,
      weight: task.weight ?? 1,
    });
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dto: CreatePredefinedTaskDto = {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
        defaultDuration: formData.defaultDuration,
        isExternalIntervention: formData.isExternalIntervention,
        isTeleworkAllowed: formData.isTeleworkAllowed,
        weight: formData.weight,
        ...(formData.defaultDuration === "TIME_SLOT" && {
          startTime: formData.startTime,
          endTime: formData.endTime,
        }),
      };
      await predefinedTasksService.create(dto);
      toast.success("Tâche prédéfinie créée");
      setShowCreateModal(false);
      fetchTasks();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la création",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    try {
      const dto: UpdatePredefinedTaskDto = {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
        defaultDuration: formData.defaultDuration,
        isExternalIntervention: formData.isExternalIntervention,
        isTeleworkAllowed: formData.isTeleworkAllowed,
        weight: formData.weight,
        ...(formData.defaultDuration === "TIME_SLOT" && {
          startTime: formData.startTime,
          endTime: formData.endTime,
        }),
      };
      await predefinedTasksService.update(editingTask.id, dto);
      toast.success("Tâche prédéfinie mise à jour");
      setShowEditModal(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la mise à jour",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (task: PredefinedTask) => {
    try {
      await predefinedTasksService.update(task.id, {
        isActive: !task.isActive,
      });
      toast.success(task.isActive ? "Tâche désactivée" : "Tâche réactivée");
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (task: PredefinedTask) => {
    if (
      !confirm(
        `Supprimer la tâche "${task.name}" ? Cette action est irréversible.`,
      )
    )
      return;
    try {
      await predefinedTasksService.delete(task.id);
      toast.success("Tâche supprimée");
      fetchTasks();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la suppression",
      );
    }
  };

  const openRulesModal = async (task: PredefinedTask) => {
    setRulesTask(task);
    try {
      const rules = await predefinedTasksService.getRecurringRules({
        predefinedTaskId: task.id,
      });
      setRulesForTask(rules);
    } catch (err) {
      console.error(err);
      setRulesForTask([]);
    }
    setShowRulesModal(true);
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Accès restreint
            </h2>
            <p className="text-gray-600">
              Vous n&apos;avez pas les permissions pour accéder à cette page.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tâches prédéfinies
            </h1>
            <p className="text-gray-600 mt-1">
              Gérez les types de tâches récurrentes assignables dans le planning
            </p>
          </div>
          {canCreate && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Nouvelle tâche
            </button>
          )}
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">Aucune tâche prédéfinie créée</p>
            {canCreate && (
              <button
                onClick={openCreate}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                Créer la première tâche
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-lg shadow-sm border-2 p-5 flex flex-col space-y-3 transition ${
                  task.isActive
                    ? "border-gray-200"
                    : "border-gray-100 opacity-60"
                }`}
                style={task.isActive ? { borderTopColor: task.color } : {}}
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${task.color}20` }}
                    >
                      {task.icon}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {task.name}
                      </h3>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${task.color}20`,
                          color: task.color,
                        }}
                      >
                        {formatDuration(task)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {task.isExternalIntervention && (
                      <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                        🔴 Ext.
                      </span>
                    )}
                    {task.isTeleworkAllowed === false && (
                      <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                        Présentiel requis
                      </span>
                    )}
                    {!task.isActive && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Inactif
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {task.description}
                  </p>
                )}

                {/* Color swatch */}
                <div className="flex items-center space-x-2">
                  <span
                    className="inline-block w-4 h-4 rounded-full border border-gray-200"
                    style={{ backgroundColor: task.color }}
                  />
                  <span className="text-xs text-gray-500 font-mono">
                    {task.color}
                  </span>
                </div>

                {/* Actions */}
                {canCreate && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      onClick={() => openRulesModal(task)}
                      className="text-xs text-purple-600 hover:text-purple-800 transition"
                    >
                      Règles récurrentes
                    </button>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleActive(task)}
                        className={`text-xs transition ${
                          task.isActive
                            ? "text-amber-600 hover:text-amber-800"
                            : "text-green-600 hover:text-green-800"
                        }`}
                      >
                        {task.isActive ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => openEdit(task)}
                        className="text-xs text-blue-600 hover:text-blue-800 transition"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        className="text-xs text-red-600 hover:text-red-800 transition"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <TaskFormModal
          title="Nouvelle tâche prédéfinie"
          formData={formData}
          saving={saving}
          onChange={setFormData}
          onSubmit={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingTask && (
        <TaskFormModal
          title={`Modifier — ${editingTask.name}`}
          formData={formData}
          saving={saving}
          onChange={setFormData}
          onSubmit={handleEdit}
          onClose={() => {
            setShowEditModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* Recurring Rules Modal */}
      {showRulesModal && rulesTask && (
        <RecurringRulesModal
          task={rulesTask}
          rules={rulesForTask}
          onClose={() => {
            setShowRulesModal(false);
            setRulesTask(null);
            setRulesForTask([]);
          }}
          onRulesChanged={async () => {
            if (rulesTask) {
              const updated = await predefinedTasksService.getRecurringRules({
                predefinedTaskId: rulesTask.id,
              });
              setRulesForTask(updated);
            }
          }}
        />
      )}
    </MainLayout>
  );
}

// ===========================
// Sub-component: TaskFormModal
// ===========================

interface TaskFormModalProps {
  title: string;
  formData: TaskFormData;
  saving: boolean;
  onChange: (data: TaskFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function TaskFormModal({
  title,
  formData,
  saving,
  onChange,
  onSubmit,
  onClose,
}: TaskFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="Ex : Permanence guichet"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                onChange({ ...formData, description: e.target.value })
              }
              placeholder="Description optionnelle..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée par défaut *
            </label>
            <select
              value={formData.defaultDuration}
              onChange={(e) =>
                onChange({
                  ...formData,
                  defaultDuration: e.target.value as TaskDuration,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="FULL_DAY">Journée entière</option>
              <option value="HALF_DAY">Demi-journée</option>
              <option value="TIME_SLOT">Créneau horaire</option>
            </select>
          </div>

          {/* Time slot inputs */}
          {formData.defaultDuration === "TIME_SLOT" && (
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Début *
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    onChange({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fin *
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    onChange({ ...formData, endTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* External intervention */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isExternalIntervention"
              checked={formData.isExternalIntervention}
              onChange={(e) =>
                onChange({
                  ...formData,
                  isExternalIntervention: e.target.checked,
                })
              }
              className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <label
              htmlFor="isExternalIntervention"
              className="ml-2 block text-sm font-medium text-gray-700"
            >
              🔴 Intervention extérieure
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isTeleworkAllowed"
              checked={formData.isTeleworkAllowed}
              onChange={(e) =>
                onChange({
                  ...formData,
                  isTeleworkAllowed: e.target.checked,
                })
              }
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label
              htmlFor="isTeleworkAllowed"
              className="ml-2 block text-sm font-medium text-gray-700"
            >
              Réalisable en télétravail
            </label>
          </div>

          {/* Weight */}
          <div>
            <WeightInput
              id="pt-weight"
              value={formData.weight}
              onChange={(v) => onChange({ ...formData, weight: v })}
              disabled={saving}
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icône
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onChange({ ...formData, icon })}
                  className={`w-9 h-9 text-xl rounded-lg border-2 transition ${
                    formData.icon === icon
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => onChange({ ...formData, icon: e.target.value })}
              placeholder="Ou saisir un emoji"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    formData.color === color
                      ? "border-gray-900 scale-110"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  onChange({ ...formData, color: e.target.value })
                }
                className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) =>
                  onChange({ ...formData, color: e.target.value })
                }
                placeholder="#3B82F6"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Aperçu</p>
            <div className="flex items-center space-x-3">
              <span
                className="text-xl w-9 h-9 flex items-center justify-center rounded-lg"
                style={{ backgroundColor: `${formData.color}20` }}
              >
                {formData.icon}
              </span>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {formData.name || "Nom de la tâche"}
                </p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${formData.color}20`,
                    color: formData.color,
                  }}
                >
                  {formData.defaultDuration === "TIME_SLOT" &&
                  formData.startTime &&
                  formData.endTime
                    ? `${formData.startTime} - ${formData.endTime}`
                    : DURATION_LABELS[formData.defaultDuration]}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
