"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { useSettingsStore } from "@/stores/settings.store";
import { settingsService, AppSetting } from "@/services/settings.service";
import { Role } from "@/types";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { HolidaysManager } from "@/components/holidays/HolidaysManager";
import { useTranslations, useLocale } from "next-intl";

type CategoryTab = "display" | "planning" | "holidays";

const WEEKDAY_OPTIONS = [
  { isoDay: 1, labelKey: "planning.days.monday" },
  { isoDay: 2, labelKey: "planning.days.tuesday" },
  { isoDay: 3, labelKey: "planning.days.wednesday" },
  { isoDay: 4, labelKey: "planning.days.thursday" },
  { isoDay: 5, labelKey: "planning.days.friday" },
  { isoDay: 6, labelKey: "planning.days.saturday" },
  { isoDay: 7, labelKey: "planning.days.sunday" },
];

const DATE_FORMAT_OPTIONS = [
  {
    value: "dd/MM/yyyy",
    label: "JJ/MM/AAAA (31/12/2025)",
    example: "31/12/2025",
  },
  {
    value: "MM/dd/yyyy",
    label: "MM/JJ/AAAA (12/31/2025)",
    example: "12/31/2025",
  },
  {
    value: "yyyy-MM-dd",
    label: "AAAA-MM-JJ (2025-12-31)",
    example: "2025-12-31",
  },
  {
    value: "d MMMM yyyy",
    label: "J Mois AAAA (31 décembre 2025)",
    example: "31 décembre 2025",
  },
  {
    value: "EEEE d MMMM yyyy",
    label: "Jour J Mois AAAA (mercredi 31 décembre 2025)",
    example: "mercredi 31 décembre 2025",
  },
];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { fetchSettings } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryTab>("display");
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [, setSettingsList] = useState<AppSetting[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const isAdmin = user?.role === Role.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      router.push(`/${locale}/dashboard`);
      return;
    }
    loadSettings();
  }, [isAdmin, router]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getAll();
      setSettings(response.settings);
      setSettingsList(response.list);
    } catch (err) {
      console.error("Error loading settings:", err);
      toast.error(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.bulkUpdate(settings);
      await fetchSettings(); // Refresh global settings
      setHasChanges(false);
      toast.success(t("messages.saveSuccess"));
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      console.error("Error saving settings:", err);
      toast.error(
        axiosError.response?.data?.message || t("messages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t("messages.resetConfirm"))) {
      return;
    }

    setSaving(true);
    try {
      const response = await settingsService.resetAllToDefaults();
      setSettings(response.settings);
      setSettingsList(response.list);
      await fetchSettings();
      setHasChanges(false);
      toast.success(t("messages.resetSuccess"));
    } catch (err) {
      console.error("Error resetting settings:", err);
      toast.error(t("messages.resetError"));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {t("reset")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t("saving")}</span>
                </>
              ) : (
                <span>{t("save")}</span>
              )}
            </button>
          </div>
        </div>

        {hasChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">{t("unsavedChanges")}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("display")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "display"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t("tabs.display")}
            </button>
            <button
              onClick={() => setActiveTab("planning")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "planning"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t("tabs.planning")}
            </button>
            <button
              onClick={() => setActiveTab("holidays")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "holidays"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t("tabs.holidays")}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Display Settings */}
          {activeTab === "display" && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("display.title")}
              </h2>

              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("display.dateFormat.label")}
                </label>
                <select
                  value={(settings.dateFormat as string) || "dd/MM/yyyy"}
                  onChange={(e) => handleChange("dateFormat", e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="dd/MM/yyyy">
                    {t("display.dateFormat.options.ddMMyyyy")}
                  </option>
                  <option value="MM/dd/yyyy">
                    {t("display.dateFormat.options.MMddyyyy")}
                  </option>
                  <option value="yyyy-MM-dd">
                    {t("display.dateFormat.options.yyyyMMdd")}
                  </option>
                  <option value="d MMMM yyyy">
                    {t("display.dateFormat.options.dMMMMyyyy")}
                  </option>
                  <option value="EEEE d MMMM yyyy">
                    {t("display.dateFormat.options.EEEEdMMMMyyyy")}
                  </option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {t("display.dateFormat.example")}{" "}
                  {DATE_FORMAT_OPTIONS.find(
                    (o) => o.value === (settings.dateFormat as string),
                  )?.example || "31/12/2025"}
                </p>
              </div>

              {/* Time Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("display.timeFormat.label")}
                </label>
                <select
                  value={(settings.timeFormat as string) || "HH:mm"}
                  onChange={(e) => handleChange("timeFormat", e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HH:mm">
                    {t("display.timeFormat.options.HHmm")}
                  </option>
                  <option value="HH:mm:ss">
                    {t("display.timeFormat.options.HHmmss")}
                  </option>
                  <option value="hh:mm a">
                    {t("display.timeFormat.options.hhmmaa")}
                  </option>
                </select>
              </div>

              {/* Week Starts On */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("display.weekStart.label")}
                </label>
                <select
                  value={(settings.weekStartsOn as number) ?? 1}
                  onChange={(e) =>
                    handleChange("weekStartsOn", parseInt(e.target.value))
                  }
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>
                    {t("display.weekStart.options.monday")}
                  </option>
                  <option value={0}>
                    {t("display.weekStart.options.sunday")}
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Planning Settings */}
          {activeTab === "planning" && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("planning.title")}
              </h2>

              {/* Visible Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("planning.visibleDays.label")}
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  {t("planning.visibleDays.hint")}
                </p>
                <div className="space-y-2">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const currentDays = (settings["planning.visibleDays"] as number[]) || [1, 2, 3, 4, 5];
                    const isChecked = currentDays.includes(day.isoDay);
                    const isLastChecked = isChecked && currentDays.length === 1;

                    return (
                      <label
                        key={day.isoDay}
                        className="flex items-center space-x-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLastChecked}
                          onChange={() => {
                            const newDays = isChecked
                              ? currentDays.filter((d) => d !== day.isoDay)
                              : [...currentDays, day.isoDay].sort((a, b) => a - b);
                            handleChange("planning.visibleDays", newDays);
                          }}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`text-sm ${isLastChecked ? "text-gray-400" : "text-gray-700"}`}>
                          {t(day.labelKey)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {((settings["planning.visibleDays"] as number[]) || []).length === 1 && (
                  <p className="text-xs text-amber-600 mt-2">
                    {t("planning.visibleDays.minWarning")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Holidays Settings */}
          {activeTab === "holidays" && (
            <div className="p-6">
              <HolidaysManager />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
