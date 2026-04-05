"use client";

import { useState, useEffect } from "react";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskRecurringRule,
  DayOfWeek,
  TaskDuration,
} from "@/services/predefined-tasks.service";
import { usersService } from "@/services/users.service";
import { User } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
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
  TIME_SLOT: "Créneau horaire",
};

const WEEK_INTERVAL_LABELS: Record<number, string> = {
  1: "Chaque semaine",
  2: "Toutes les 2 semaines",
  3: "Toutes les 3 semaines",
  4: "Toutes les 4 semaines",
};

const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; short: string }[] = [
  { value: "MONDAY", short: "Lun" },
  { value: "TUESDAY", short: "Mar" },
  { value: "WEDNESDAY", short: "Mer" },
  { value: "THURSDAY", short: "Jeu" },
  { value: "FRIDAY", short: "Ven" },
  { value: "SATURDAY", short: "Sam" },
  { value: "SUNDAY", short: "Dim" },
];

interface RecurringRulesModalProps {
  task: PredefinedTask;
  rules: PredefinedTaskRecurringRule[];
  onClose: () => void;
  onRulesChanged: () => Promise<void>;
}

interface RuleFormData {
  userIds: string[];
  daysOfWeek: DayOfWeek[];
  duration: TaskDuration;
  weekInterval: number;
  startDate: string;
  endDate: string;
}

export function RecurringRulesModal({
  task,
  rules,
  onClose,
  onRulesChanged,
}: RecurringRulesModalProps) {
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>({
    userIds: [],
    daysOfWeek: [],
    duration: task.defaultDuration,
    weekInterval: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!hasPermission("users:read")) {
      setUsers([]);
      return;
    }
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
    if (formData.userIds.length === 0) {
      toast.error("Sélectionnez au moins un collaborateur");
      return;
    }
    if (formData.daysOfWeek.length === 0) {
      toast.error("Sélectionnez au moins un jour");
      return;
    }
    setSaving(true);
    try {
      const result = await predefinedTasksService.bulkCreateRecurringRules({
        predefinedTaskId: task.id,
        userIds: formData.userIds,
        daysOfWeek: formData.daysOfWeek,
        period: formData.duration,
        weekInterval: formData.weekInterval,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      });
      const nUsers = formData.userIds.length;
      const nDays = formData.daysOfWeek.length;
      toast.success(
        `${result.created} règle${result.created > 1 ? "s" : ""} créée${result.created > 1 ? "s" : ""} (${nUsers} collaborateur${nUsers > 1 ? "s" : ""} × ${nDays} jour${nDays > 1 ? "s" : ""})`,
      );
      setShowForm(false);
      setFormData({
        userIds: [],
        daysOfWeek: [],
        duration: task.defaultDuration,
        weekInterval: 1,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
      });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
                        {rule.weekInterval && rule.weekInterval > 1
                          ? `Un ${DAY_OF_WEEK_LABELS[rule.dayOfWeek].toLowerCase()} sur ${rule.weekInterval}`
                          : `Chaque ${DAY_OF_WEEK_LABELS[rule.dayOfWeek].toLowerCase()}`}
                        {" \u2022 "}
                        {DURATION_LABELS[rule.period]}
                        {rule.startDate &&
                          ` \u2022 À partir du ${new Date(rule.startDate).toLocaleDateString("fr-FR")}`}
                        {rule.endDate &&
                          ` \u2022 Jusqu'au ${new Date(rule.endDate).toLocaleDateString("fr-FR")}`}
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
              Nouvelles règles récurrentes
            </h3>

            {/* Multi-user select */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Collaborateurs *
              </label>
              <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.userIds.includes(u.id)}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          userIds: e.target.checked
                            ? [...prev.userIds, u.id]
                            : prev.userIds.filter((id) => id !== u.id),
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">
                      {u.firstName} {u.lastName}
                    </span>
                  </label>
                ))}
              </div>
              {formData.userIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {formData.userIds.length} sélectionné{formData.userIds.length > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Multi-day toggle pills */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Jours de la semaine *
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OF_WEEK_OPTIONS.map(({ value, short }) => {
                  const selected = formData.daysOfWeek.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          daysOfWeek: selected
                            ? prev.daysOfWeek.filter((d) => d !== value)
                            : [...prev.daysOfWeek, value],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Week interval */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Fréquence *
                </label>
                <select
                  value={formData.weekInterval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weekInterval: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(WEEK_INTERVAL_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
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

              {/* Start date */}
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

              {/* End date */}
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

            {/* Summary */}
            {formData.userIds.length > 0 && formData.daysOfWeek.length > 0 && (
              <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                {formData.userIds.length} collaborateur{formData.userIds.length > 1 ? "s" : ""}
                {" × "}
                {formData.daysOfWeek.length} jour{formData.daysOfWeek.length > 1 ? "s" : ""}
                {" = "}
                <strong>{formData.userIds.length * formData.daysOfWeek.length} règles</strong>
                {formData.weekInterval > 1 && ` (toutes les ${formData.weekInterval} semaines)`}
              </div>
            )}

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
                disabled={saving || formData.userIds.length === 0 || formData.daysOfWeek.length === 0}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Création..." : "Créer les règles"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
          >
            + Ajouter des règles récurrentes
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
