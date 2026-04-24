"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  predefinedTasksService,
  PredefinedTask,
  PredefinedTaskRecurringRule,
  DayOfWeek,
  RecurrenceType,
  TaskDuration,
} from "@/services/predefined-tasks.service";
import { usersService } from "@/services/users.service";
import { User } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

// ── Static constants ─────────────────────────────────────────────────────────

const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; short: string }[] = [
  { value: "MONDAY", short: "Lun" },
  { value: "TUESDAY", short: "Mar" },
  { value: "WEDNESDAY", short: "Mer" },
  { value: "THURSDAY", short: "Jeu" },
  { value: "FRIDAY", short: "Ven" },
  { value: "SATURDAY", short: "Sam" },
  { value: "SUNDAY", short: "Dim" },
];

const DOW_FULL_OPTIONS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const ORDINAL_OPTIONS = [1, 2, 3, 4, 5] as const;

const DURATION_LABELS: Record<TaskDuration, string> = {
  HALF_DAY: "Demi-journée",
  FULL_DAY: "Journée entière",
  TIME_SLOT: "Créneau horaire",
};

const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

const WEEK_INTERVAL_LABELS: Record<number, string> = {
  1: "Chaque semaine",
  2: "Toutes les 2 semaines",
  3: "Toutes les 3 semaines",
  4: "Toutes les 4 semaines",
};

// ── Prop types ────────────────────────────────────────────────────────────────

export interface RecurringRulesModalProps {
  task: PredefinedTask;
  rules: PredefinedTaskRecurringRule[];
  onClose: () => void;
  onRulesChanged: () => Promise<void>;
}

// ── Form state ────────────────────────────────────────────────────────────────

interface RuleFormData {
  recurrenceType: RecurrenceType;
  // WEEKLY
  daysOfWeek: DayOfWeek[];
  weekInterval: number;
  // MONTHLY_DAY
  monthlyDayOfMonth: number;
  // MONTHLY_ORDINAL
  monthlyOrdinal: number;
  dayOfWeek: DayOfWeek; // used for MONTHLY_ORDINAL + single-day WEEKLY edit
  // Common
  userIds: string[];
  duration: TaskDuration;
  startDate: string;
  endDate: string;
}

function defaultFormData(task: PredefinedTask): RuleFormData {
  return {
    recurrenceType: "WEEKLY",
    daysOfWeek: [],
    weekInterval: 1,
    monthlyDayOfMonth: 1,
    monthlyOrdinal: 1,
    dayOfWeek: "MONDAY",
    userIds: [],
    duration: task.defaultDuration,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  };
}

function formDataFromRule(rule: PredefinedTaskRecurringRule): Partial<RuleFormData> {
  const type: RecurrenceType = rule.recurrenceType ?? "WEEKLY";
  return {
    recurrenceType: type,
    daysOfWeek: [rule.dayOfWeek],
    weekInterval: rule.weekInterval ?? 1,
    monthlyDayOfMonth: rule.monthlyDayOfMonth ?? 1,
    monthlyOrdinal: rule.monthlyOrdinal ?? 1,
    dayOfWeek: rule.dayOfWeek,
    userIds: [rule.userId],
    duration: rule.period,
    startDate: rule.startDate ? rule.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    endDate: rule.endDate ? rule.endDate.slice(0, 10) : "",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecurringRulesModal({
  task,
  rules,
  onClose,
  onRulesChanged,
}: RecurringRulesModalProps) {
  const t = useTranslations("predefinedTasks");
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData(task));

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingRuleId(null);
    setFormData(defaultFormData(task));
    setShowForm(true);
  };

  const openEditForm = (rule: PredefinedTaskRecurringRule) => {
    setEditingRuleId(rule.id);
    setFormData({ ...defaultFormData(task), ...formDataFromRule(rule) });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRuleId(null);
    setFormData(defaultFormData(task));
  };

  const setField = <K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (formData.userIds.length === 0) return "Sélectionnez au moins un collaborateur";
    if (formData.recurrenceType === "WEEKLY" && formData.daysOfWeek.length === 0) {
      return "Sélectionnez au moins un jour";
    }
    return null;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      if (formData.recurrenceType === "WEEKLY") {
        // Bulk create: multiple users × multiple days
        const result = await predefinedTasksService.bulkCreateRecurringRules({
          predefinedTaskId: task.id,
          userIds: formData.userIds,
          daysOfWeek: formData.daysOfWeek,
          period: formData.duration,
          weekInterval: formData.weekInterval,
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
          recurrenceType: "WEEKLY",
        });
        const nUsers = formData.userIds.length;
        const nDays = formData.daysOfWeek.length;
        toast.success(
          `${result.created} règle${result.created > 1 ? "s" : ""} créée${result.created > 1 ? "s" : ""} (${nUsers} collaborateur${nUsers > 1 ? "s" : ""} × ${nDays} jour${nDays > 1 ? "s" : ""})`,
        );
      } else if (formData.recurrenceType === "MONTHLY_DAY") {
        // Per-user single rule (no dayOfWeek/weekInterval)
        for (const userId of formData.userIds) {
          await predefinedTasksService.createRecurringRule({
            predefinedTaskId: task.id,
            userId,
            recurrenceType: "MONTHLY_DAY",
            monthlyDayOfMonth: formData.monthlyDayOfMonth,
            dayOfWeek: null,
            weekInterval: null,
            period: formData.duration,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
          });
        }
        toast.success(
          `${formData.userIds.length} règle${formData.userIds.length > 1 ? "s" : ""} créée${formData.userIds.length > 1 ? "s" : ""}`,
        );
      } else {
        // MONTHLY_ORDINAL — per-user single rule
        for (const userId of formData.userIds) {
          await predefinedTasksService.createRecurringRule({
            predefinedTaskId: task.id,
            userId,
            recurrenceType: "MONTHLY_ORDINAL",
            monthlyOrdinal: formData.monthlyOrdinal,
            dayOfWeek: formData.dayOfWeek,
            weekInterval: null,
            period: formData.duration,
            startDate: formData.startDate,
            endDate: formData.endDate || undefined,
          });
        }
        toast.success(
          `${formData.userIds.length} règle${formData.userIds.length > 1 ? "s" : ""} créée${formData.userIds.length > 1 ? "s" : ""}`,
        );
      }
      closeForm();
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRuleId) return;
    setSaving(true);
    try {
      if (formData.recurrenceType === "MONTHLY_DAY") {
        await predefinedTasksService.updateRecurringRule(editingRuleId, {
          recurrenceType: "MONTHLY_DAY",
          monthlyDayOfMonth: formData.monthlyDayOfMonth,
          dayOfWeek: null,
          weekInterval: null,
          period: formData.duration,
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
        });
      } else if (formData.recurrenceType === "MONTHLY_ORDINAL") {
        await predefinedTasksService.updateRecurringRule(editingRuleId, {
          recurrenceType: "MONTHLY_ORDINAL",
          monthlyOrdinal: formData.monthlyOrdinal,
          dayOfWeek: formData.dayOfWeek,
          weekInterval: null,
          period: formData.duration,
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
        });
      } else {
        // WEEKLY edit: single day from the select
        await predefinedTasksService.updateRecurringRule(editingRuleId, {
          recurrenceType: "WEEKLY",
          dayOfWeek: formData.dayOfWeek,
          weekInterval: formData.weekInterval,
          period: formData.duration,
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
        });
      }
      toast.success("Règle mise à jour");
      closeForm();
      await onRulesChanged();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la mise à jour",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle / Delete ──────────────────────────────────────────────────────────

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

  // ── Rule description helper ───────────────────────────────────────────────────

  const ruleDescription = (rule: PredefinedTaskRecurringRule): string => {
    const type = rule.recurrenceType ?? "WEEKLY";
    if (type === "MONTHLY_DAY") {
      return `Le ${rule.monthlyDayOfMonth ?? "?"} du mois`;
    }
    if (type === "MONTHLY_ORDINAL") {
      const ordinalLabels: Record<number, string> = { 1: "1er", 2: "2e", 3: "3e", 4: "4e", 5: "Dernier" };
      const ord = rule.monthlyOrdinal ?? 1;
      return `${ordinalLabels[ord] ?? ord} ${DAY_OF_WEEK_LABELS[rule.dayOfWeek]?.toLowerCase() ?? rule.dayOfWeek}`;
    }
    // WEEKLY
    return rule.weekInterval && rule.weekInterval > 1
      ? `Un ${DAY_OF_WEEK_LABELS[rule.dayOfWeek]?.toLowerCase() ?? rule.dayOfWeek} sur ${rule.weekInterval}`
      : `Chaque ${DAY_OF_WEEK_LABELS[rule.dayOfWeek]?.toLowerCase() ?? rule.dayOfWeek}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const isEditing = editingRuleId !== null;

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
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
                        {ruleDescription(rule)}
                        {" • "}
                        {DURATION_LABELS[rule.period]}
                        {rule.startDate &&
                          ` • À partir du ${new Date(rule.startDate).toLocaleDateString("fr-FR")}`}
                        {rule.endDate &&
                          ` • Jusqu'au ${new Date(rule.endDate).toLocaleDateString("fr-FR")}`}
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
                      onClick={() => openEditForm(rule)}
                      className="text-xs text-blue-600 hover:text-blue-800 transition"
                    >
                      Modifier
                    </button>
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

        {/* Create / Edit form */}
        {showForm ? (
          <form
            onSubmit={isEditing ? handleUpdate : handleCreate}
            className="border border-gray-200 rounded-lg p-4 space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-sm">
              {isEditing ? "Modifier la règle" : "Nouvelles règles récurrentes"}
            </h3>

            {/* ── Recurrence type radio group ─────────────────────────────── */}
            <fieldset>
              <legend
                id="recurrence-type-legend"
                className="block text-xs font-medium text-gray-700 mb-2"
              >
                {t("recurrence.type.label")}
              </legend>
              <div
                role="radiogroup"
                aria-labelledby="recurrence-type-legend"
                className="flex flex-wrap gap-2"
              >
                {(["WEEKLY", "MONTHLY_DAY", "MONTHLY_ORDINAL"] as RecurrenceType[]).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={formData.recurrenceType === type}
                      tabIndex={formData.recurrenceType === type ? 0 : -1}
                      onClick={() => setField("recurrenceType", type)}
                      className={[
                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition focus:outline-none focus:ring-2 focus:ring-blue-500",
                        formData.recurrenceType === type
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:border-zinc-400",
                      ].join(" ")}
                    >
                      {t(`recurrence.type.${type}`)}
                    </button>
                  ),
                )}
              </div>
            </fieldset>

            {/* ── User selector (hidden in edit mode — editing a single rule) ─ */}
            {!isEditing && (
              <div>
                <label
                  className="block text-xs font-medium text-gray-700 mb-1"
                  id="users-label"
                >
                  Collaborateurs *
                </label>
                <div
                  className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1"
                  aria-labelledby="users-label"
                >
                  {users.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        aria-label={`${u.firstName} ${u.lastName}`}
                        checked={formData.userIds.includes(u.id)}
                        onChange={(e) => {
                          setField(
                            "userIds",
                            e.target.checked
                              ? [...formData.userIds, u.id]
                              : formData.userIds.filter((id) => id !== u.id),
                          );
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
                    {formData.userIds.length} sélectionné
                    {formData.userIds.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* ── WEEKLY fields ─────────────────────────────────────────────── */}
            {formData.recurrenceType === "WEEKLY" && (
              <>
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
                            setField(
                              "daysOfWeek",
                              selected
                                ? formData.daysOfWeek.filter((d) => d !== value)
                                : [...formData.daysOfWeek, value],
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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

                <div>
                  <label
                    htmlFor="weekInterval"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {t("recurrence.weekInterval.label")}
                  </label>
                  <p
                    id="weekInterval-hint"
                    className="text-xs text-gray-500 mb-1"
                  >
                    {t("recurrence.weekInterval.hint")}
                  </p>
                  <select
                    id="weekInterval"
                    aria-describedby="weekInterval-hint"
                    value={formData.weekInterval}
                    onChange={(e) =>
                      setField("weekInterval", parseInt(e.target.value, 10))
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
              </>
            )}

            {/* ── MONTHLY_DAY fields ────────────────────────────────────────── */}
            {formData.recurrenceType === "MONTHLY_DAY" && (
              <div>
                <label
                  htmlFor="monthlyDayOfMonth"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  {t("recurrence.monthlyDay.label")}
                </label>
                <p
                  id="monthlyDayOfMonth-hint"
                  className="text-xs text-gray-500 mb-1"
                >
                  {t("recurrence.monthlyDay.hint")}
                </p>
                <input
                  id="monthlyDayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  required
                  aria-describedby="monthlyDayOfMonth-hint"
                  value={formData.monthlyDayOfMonth}
                  onChange={(e) =>
                    setField("monthlyDayOfMonth", parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* ── MONTHLY_ORDINAL fields ────────────────────────────────────── */}
            {formData.recurrenceType === "MONTHLY_ORDINAL" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="monthlyOrdinal"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {t("recurrence.monthlyOrdinal.label")}
                  </label>
                  <select
                    id="monthlyOrdinal"
                    value={formData.monthlyOrdinal}
                    onChange={(e) =>
                      setField("monthlyOrdinal", parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {ORDINAL_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {t(`recurrence.monthlyOrdinal.options.${n}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="dayOfWeekOrdinal"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    {t("recurrence.dayOfWeek.label")}
                  </label>
                  <select
                    id="dayOfWeekOrdinal"
                    aria-label={t("recurrence.dayOfWeek.label")}
                    value={formData.dayOfWeek}
                    onChange={(e) =>
                      setField("dayOfWeek", e.target.value as DayOfWeek)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {DOW_FULL_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {t(`recurrence.dayOfWeek.options.${d}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ── Common fields: duration + dates ───────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="duration"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Durée *
                </label>
                <select
                  id="duration"
                  value={formData.duration}
                  onChange={(e) =>
                    setField("duration", e.target.value as TaskDuration)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FULL_DAY">Journée entière</option>
                  <option value="HALF_DAY">Demi-journée</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Date de début *
                </label>
                <input
                  id="startDate"
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label
                  htmlFor="endDate"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Date de fin (optionnel)
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* WEEKLY summary */}
            {formData.recurrenceType === "WEEKLY" &&
              formData.userIds.length > 0 &&
              formData.daysOfWeek.length > 0 && (
                <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  {formData.userIds.length} collaborateur
                  {formData.userIds.length > 1 ? "s" : ""}
                  {" × "}
                  {formData.daysOfWeek.length} jour
                  {formData.daysOfWeek.length > 1 ? "s" : ""}
                  {" = "}
                  <strong>
                    {formData.userIds.length * formData.daysOfWeek.length} règles
                  </strong>
                  {formData.weekInterval > 1 &&
                    ` (toutes les ${formData.weekInterval} semaines)`}
                </div>
              )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  (!isEditing && formData.userIds.length === 0) ||
                  (!isEditing &&
                    formData.recurrenceType === "WEEKLY" &&
                    formData.daysOfWeek.length === 0)
                }
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving
                  ? isEditing
                    ? "Sauvegarde..."
                    : "Création..."
                  : isEditing
                    ? "Sauvegarder"
                    : "Créer les règles"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={openCreateForm}
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
