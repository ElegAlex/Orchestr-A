"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { teleworkService } from "@/services/telework.service";
import { usersService } from "@/services/users.service";
import { usePermissions } from "@/hooks/usePermissions";
import {
  TeleworkSchedule,
  TeleworkRecurringRule,
  CreateRecurringRuleDto,
  User,
} from "@/types";
import toast from "react-hot-toast";
import { format, isSameDay } from "date-fns";

// ─────────────────────────────────────────────
// Recurring Rule Modal
// ─────────────────────────────────────────────

const DAY_NAMES_FR: Record<number, string> = {
  0: "lundi",
  1: "mardi",
  2: "mercredi",
  3: "jeudi",
  4: "vendredi",
  5: "samedi",
  6: "dimanche",
};

function buildPreview(
  selectedDays: number[],
  startDate: string,
  endDate: string,
): string {
  if (selectedDays.length === 0 || !startDate) return "";
  const dayLabels = selectedDays
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES_FR[d])
    .join(" et ");
  const start = startDate
    ? new Date(startDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const end = endDate
    ? new Date(endDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  if (end) {
    return `Tous les ${dayLabels} du ${start} au ${end}`;
  }
  return `Tous les ${dayLabels} à partir du ${start}`;
}

interface RecurringRuleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  targetUserId: string;
  currentUserId: string;
  editRule?: TeleworkRecurringRule | null;
}

function RecurringRuleModal({
  open,
  onClose,
  onSaved,
  targetUserId,
  currentUserId,
  editRule,
}: RecurringRuleModalProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRule) {
      setSelectedDays([editRule.dayOfWeek]);
      setStartDate(editRule.startDate.slice(0, 10));
      setEndDate(editRule.endDate ? editRule.endDate.slice(0, 10) : "");
    } else {
      setSelectedDays([]);
      setStartDate("");
      setEndDate("");
    }
  }, [editRule, open]);

  const toggleDay = (day: number) => {
    if (editRule) {
      // Edit mode: single day
      setSelectedDays([day]);
    } else {
      setSelectedDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
      );
    }
  };

  const handleSave = async () => {
    if (selectedDays.length === 0 || !startDate) {
      toast.error(
        "Veuillez sélectionner au moins un jour et une date de début",
      );
      return;
    }
    setSaving(true);
    try {
      if (editRule) {
        await teleworkService.updateRecurringRule(editRule.id, {
          dayOfWeek: selectedDays[0],
          startDate,
          endDate: endDate || undefined,
        });
        toast.success("Règle récurrente mise à jour");
      } else {
        // Create one rule per selected day
        for (const day of selectedDays) {
          const dto: CreateRecurringRuleDto = {
            dayOfWeek: day,
            startDate,
            endDate: endDate || undefined,
          };
          if (targetUserId !== currentUserId) {
            dto.userId = targetUserId;
          }
          await teleworkService.createRecurringRule(dto);
        }
        toast.success(`${selectedDays.length} règle(s) récurrente(s) créée(s)`);
      }
      onSaved();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const preview = buildPreview(selectedDays, startDate, endDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editRule
              ? "Modifier un jour fixe"
              : "Configurer des jours fixes de télétravail"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Day selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Jours de la semaine
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2, 3, 4].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedDays.includes(day)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {DAY_NAMES_FR[day].slice(0, 3).toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Start date */}
        <div>
          <label
            htmlFor="rule-start-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date de début <span className="text-red-500">*</span>
          </label>
          <input
            id="rule-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* End date */}
        <div>
          <label
            htmlFor="rule-end-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date de fin{" "}
            <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            id="rule-end-date"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 font-medium">Aperçu :</p>
            <p className="text-sm text-blue-700 mt-1 italic">{preview}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedDays.length === 0 || !startDate}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Generate Modal
// ─────────────────────────────────────────────

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

function GenerateModal({ open, onClose, onGenerated }: GenerateModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error("Veuillez renseigner les deux dates");
      return;
    }
    setLoading(true);
    try {
      const result = await teleworkService.generateSchedules({
        startDate,
        endDate,
      });
      toast.success(
        `Génération terminée : ${result.created} créé(s), ${result.skipped} ignoré(s)`,
      );
      onGenerated();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la génération",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Générer les plannings récurrents
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Matérialise les jours fixes dans le planning pour la plage choisie.
          Les jours déjà déclarés sont conservés.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Du
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Au
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Génération…" : "Générer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function TeleworkPage() {
  const t = useTranslations("hr.telework");
  const tc = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [teleworkDays, setTeleworkDays] = useState<TeleworkSchedule[]>([]);
  const [recurringRules, setRecurringRules] = useState<TeleworkRecurringRule[]>(
    [],
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const canManageOthers = hasPermission("telework:manage_others");
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || "");
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Modal states
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TeleworkRecurringRule | null>(
    null,
  );
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Charger les utilisateurs si autorisé à gérer les autres
  useEffect(() => {
    if (!user) return;
    setSelectedUserId(user.id);

    if (canManageOthers) {
      usersService.getAll().then((data) => {
        setAllUsers(Array.isArray(data) ? data : []);
      });
    }
  }, [user, canManageOthers]);

  // Charger les données de télétravail
  const fetchTeleworkData = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      setLoading(true);
      const startDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
      );
      const endDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 6,
        0,
      );

      const [data, rules] = await Promise.all([
        teleworkService.getByDateRange(
          format(startDate, "yyyy-MM-dd"),
          format(endDate, "yyyy-MM-dd"),
          selectedUserId,
        ),
        teleworkService.getRecurringRules(selectedUserId),
      ]);

      setTeleworkDays(Array.isArray(data) ? data : []);
      setRecurringRules(Array.isArray(rules) ? rules : []);
    } catch (err) {
      console.error("Erreur chargement télétravail:", err);
      toast.error(tc("errors.serverError"));
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedUserId, tc]);

  useEffect(() => {
    fetchTeleworkData();
  }, [fetchTeleworkData]);

  // Générer les 6 prochains mois
  const getMonthsToDisplay = () => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + i,
        1,
      );
      months.push(date);
    }
    return months;
  };

  // Obtenir les jours d'un mois
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const startPadding = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatDate = (date: Date): string => {
    return format(date, "yyyy-MM-dd");
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getTeleworkStatus = (date: Date): TeleworkSchedule | undefined => {
    if (!selectedUserId) return undefined;
    return teleworkDays.find(
      (d) => d.userId === selectedUserId && isSameDay(new Date(d.date), date),
    );
  };

  /** Returns true if a recurring rule covers this date for the selected user */
  const isRecurringDay = (date: Date): boolean => {
    if (isWeekend(date)) return false;
    const jsDay = date.getDay(); // 0=Sun..6=Sat
    const modelDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
    const dateMs = date.getTime();
    return recurringRules.some((rule) => {
      if (!rule.isActive) return false;
      if (rule.dayOfWeek !== modelDay) return false;
      const ruleStart = new Date(rule.startDate).getTime();
      const ruleEnd = rule.endDate
        ? new Date(rule.endDate).getTime()
        : Infinity;
      return dateMs >= ruleStart && dateMs <= ruleEnd;
    });
  };

  const handleDayClick = async (date: Date) => {
    if (isWeekend(date) || !selectedUserId) return;

    try {
      const existingStatus = getTeleworkStatus(date);

      if (!existingStatus) {
        await teleworkService.create({
          date: formatDate(date),
          isTelework: true,
          isException: false,
          userId: selectedUserId,
        });
        toast.success(t("messages.recorded"));
      } else if (existingStatus.isTelework) {
        await teleworkService.delete(existingStatus.id);
        toast.success(t("messages.deleted"));
      } else {
        await teleworkService.update(existingStatus.id, { isTelework: true });
        toast.success(t("messages.recorded"));
      }

      fetchTeleworkData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tc("errors.validationError"),
      );
    }
  };

  const getDayStyle = (date: Date) => {
    if (isWeekend(date)) {
      return "bg-gray-50 text-gray-400 cursor-not-allowed";
    }

    const status = getTeleworkStatus(date);
    if (status?.isTelework) {
      return "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200 cursor-pointer";
    }

    if (status && !status.isTelework) {
      return "bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200 cursor-pointer";
    }

    // Recurring but not yet materialized
    if (isRecurringDay(date)) {
      return "bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100 cursor-pointer";
    }

    return "bg-white text-gray-900 hover:bg-gray-100 cursor-pointer border-gray-200";
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  };

  const getTeleworkStats = () => {
    return teleworkDays.filter(
      (d) => d.userId === selectedUserId && d.isTelework,
    ).length;
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await teleworkService.deleteRecurringRule(id);
      toast.success(t("messages.ruleDeleted"));
      setDeleteConfirmId(null);
      fetchTeleworkData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la suppression",
      );
    }
  };

  const selectedUser = allUsers.find((u) => u.id === selectedUserId) ?? user;

  const weekDays = [
    t("weekDays.mon"),
    t("weekDays.tue"),
    t("weekDays.wed"),
    t("weekDays.thu"),
    t("weekDays.fri"),
    t("weekDays.sat"),
    t("weekDays.sun"),
  ];

  const activeRules = recurringRules.filter((r) => r.isActive);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{tc("actions.loading")}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">
              {t("stats", { count: getTeleworkStats() })}
            </p>
          </div>

          {canManageOthers && allUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="user-selector"
                className="text-sm font-medium text-gray-700"
              >
                Collaborateur :
              </label>
              <select
                id="user-selector"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                    {u.id === user?.id ? " (moi)" : ""}
                  </option>
                ))}
              </select>
              {selectedUser && selectedUser.id !== user?.id && (
                <span className="text-xs text-blue-600 font-medium">
                  Vue de {selectedUser.firstName} {selectedUser.lastName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900">
                {t("howItWorks.title")}
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                {t("howItWorks.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Recurring Rules Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-900">
              {t("recurringRules.title")}
              {activeRules.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {activeRules.length} règle(s) active(s)
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingRule(null);
                  setRuleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
              >
                <span>+</span>
                {t("recurringRules.configureButton")}
              </button>
              {activeRules.length > 0 && (
                <button
                  onClick={() => setGenerateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
                >
                  ↻ {t("recurringRules.generate")}
                </button>
              )}
            </div>
          </div>

          {recurringRules.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              {t("recurringRules.noRules")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recurringRules.map((rule) => {
                const dayLabel =
                  DAY_NAMES_FR[rule.dayOfWeek] ?? `Jour ${rule.dayOfWeek}`;
                const start = new Date(rule.startDate).toLocaleDateString(
                  "fr-FR",
                  { day: "numeric", month: "long", year: "numeric" },
                );
                const end = rule.endDate
                  ? new Date(rule.endDate).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null;

                return (
                  <li
                    key={rule.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                          rule.isActive ? "bg-indigo-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm text-gray-800">
                        <span className="font-medium capitalize">
                          {dayLabel}
                        </span>
                        {" · "}
                        {end ? `du ${start} au ${end}` : `à partir du ${start}`}
                      </span>
                      {!rule.isActive && (
                        <span className="text-xs text-gray-400">(inactif)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setRuleModalOpen(true);
                        }}
                        className="px-2 py-1 text-xs rounded text-blue-600 hover:bg-blue-50 transition"
                        title="Modifier"
                      >
                        Modifier
                      </button>
                      {deleteConfirmId === rule.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100 transition"
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(rule.id)}
                          className="px-2 py-1 text-xs rounded text-red-600 hover:bg-red-50 transition"
                          title="Supprimer"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            {t("legend.title")}
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 border border-blue-300 rounded"></div>
              <span className="text-sm text-gray-700">
                {t("legend.telework")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-indigo-50 border border-indigo-200 rounded"></div>
              <span className="text-sm text-gray-700">
                {t("recurringRules.legend.recurring")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-100 border border-gray-300 rounded"></div>
              <span className="text-sm text-gray-700">
                {t("legend.office")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
              <span className="text-sm text-gray-700">
                {t("legend.notDeclared")}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-50 border border-gray-200 rounded"></div>
              <span className="text-sm text-gray-700">
                {t("legend.weekend")}
              </span>
            </div>
          </div>
        </div>

        {/* Calendar for 6 months */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getMonthsToDisplay().map((month, monthIndex) => (
            <div
              key={monthIndex}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Month header */}
              <div className="bg-blue-600 text-white px-4 py-3">
                <h3 className="font-semibold text-center capitalize">
                  {getMonthName(month)}
                </h3>
              </div>

              {/* Week days */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 border-b border-gray-200">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="bg-gray-50 text-center py-2 text-xs font-medium text-gray-600"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 p-px">
                {getDaysInMonth(month).map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    onClick={() => day && handleDayClick(day)}
                    className={`aspect-square flex items-center justify-center text-sm font-medium border ${
                      day ? getDayStyle(day) : "bg-gray-50"
                    }`}
                  >
                    {day && (
                      <div className="flex flex-col items-center justify-center">
                        <span>{day.getDate()}</span>
                        {getTeleworkStatus(day)?.isTelework && (
                          <span className="text-xs">🏠</span>
                        )}
                        {!getTeleworkStatus(day) && isRecurringDay(day) && (
                          <span className="text-xs">🔄</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() - 1,
                  1,
                ),
              )
            }
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            ← {t("navigation.previousMonth")}
          </button>
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() + 1,
                  1,
                ),
              )
            }
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            {t("navigation.nextMonth")} →
          </button>
        </div>
      </div>

      {/* Modals */}
      <RecurringRuleModal
        open={ruleModalOpen}
        onClose={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSaved={fetchTeleworkData}
        targetUserId={selectedUserId}
        currentUserId={user?.id ?? ""}
        editRule={editingRule}
      />
      <GenerateModal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onGenerated={fetchTeleworkData}
      />
    </MainLayout>
  );
}
