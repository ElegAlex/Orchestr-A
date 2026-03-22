"use client";

import { useState, useEffect } from "react";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskRecurringRule,
  CreateRecurringRuleDto,
  DayOfWeek,
  TaskDuration,
} from "@/services/predefined-tasks.service";
import { usersService } from "@/services/users.service";
import { User } from "@/types";
import toast from "react-hot-toast";

const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

const DURATION_LABELS: Record<TaskDuration, string> = {
  HALF_DAY: "Demi-journée",
  FULL_DAY: "Journée entière",
};

interface RecurringRulesModalProps {
  task: PredefinedTask;
  rules: PredefinedTaskRecurringRule[];
  onClose: () => void;
  onRulesChanged: () => Promise<void>;
}

interface RuleFormData {
  userId: string;
  dayOfWeek: DayOfWeek;
  duration: TaskDuration;
  startDate: string;
  endDate: string;
}

export function RecurringRulesModal({
  task,
  rules,
  onClose,
  onRulesChanged,
}: RecurringRulesModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>({
    userId: "",
    dayOfWeek: "MONDAY",
    duration: task.defaultDuration,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await usersService.getAll();
      const usersList = Array.isArray(data)
        ? data
        : ((data as { data: User[] }).data ?? []);
      setUsers(usersList.filter((u) => u.isActive));
    } catch {
      setUsers([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) {
      toast.error("Sélectionnez un collaborateur");
      return;
    }
    setSaving(true);
    try {
      const dto: CreateRecurringRuleDto = {
        predefinedTaskId: task.id,
        userId: formData.userId,
        dayOfWeek: formData.dayOfWeek,
        duration: formData.duration,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      };
      await predefinedTasksService.createRecurringRule(dto);
      toast.success("Règle récurrente créée");
      setShowForm(false);
      await onRulesChanged();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la création",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (rule: PredefinedTaskRecurringRule) => {
    try {
      await predefinedTasksService.updateRecurringRule(rule.id, {
        isActive: !rule.isActive,
      });
      toast.success(rule.isActive ? "Règle désactivée" : "Règle réactivée");
      await onRulesChanged();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (rule: PredefinedTaskRecurringRule) => {
    if (!confirm("Supprimer cette règle récurrente ?")) return;
    try {
      await predefinedTasksService.deleteRecurringRule(rule.id);
      toast.success("Règle supprimée");
      await onRulesChanged();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span
              className="text-xl w-9 h-9 flex items-center justify-center rounded-lg"
              style={{ backgroundColor: `${task.color}20` }}
            >
              {task.icon}
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Règles récurrentes
              </h2>
              <p className="text-sm text-gray-500">{task.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg
              className="w-6 h-6"
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

        {/* Rules list */}
        {rules.length === 0 && !showForm ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune règle récurrente définie</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {rules.map((rule) => {
              const userName = rule.user
                ? `${rule.user.firstName} ${rule.user.lastName}`
                : rule.userId;
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    rule.isActive
                      ? "border-gray-200 bg-white"
                      : "border-gray-100 bg-gray-50 opacity-70"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {userName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {DAY_OF_WEEK_LABELS[rule.dayOfWeek]} •{" "}
                        {DURATION_LABELS[rule.duration]}
                        {rule.startDate && ` • À partir du ${rule.startDate}`}
                        {rule.endDate && ` • Jusqu'au ${rule.endDate}`}
                      </p>
                    </div>
                    {!rule.isActive && (
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                        Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`text-xs transition ${
                        rule.isActive
                          ? "text-amber-600 hover:text-amber-800"
                          : "text-green-600 hover:text-green-800"
                      }`}
                    >
                      {rule.isActive ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      className="text-xs text-red-600 hover:text-red-800 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create form */}
        {showForm ? (
          <form
            onSubmit={handleCreate}
            className="border border-gray-200 rounded-lg p-4 space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-sm">
              Nouvelle règle
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Collaborateur *
                </label>
                <select
                  required
                  value={formData.userId}
                  onChange={(e) =>
                    setFormData({ ...formData, userId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choisir...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Jour de la semaine *
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dayOfWeek: e.target.value as DayOfWeek,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(DAY_OF_WEEK_LABELS) as DayOfWeek[]).map(
                    (day) => (
                      <option key={day} value={day}>
                        {DAY_OF_WEEK_LABELS[day]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Durée *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: e.target.value as TaskDuration,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FULL_DAY">Journée entière</option>
                  <option value="HALF_DAY">Demi-journée</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date de début *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date de fin (optionnel)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Création..." : "Créer la règle"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
          >
            + Ajouter une règle récurrente
          </button>
        )}

        {/* Footer */}
        <div className="flex justify-end mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
