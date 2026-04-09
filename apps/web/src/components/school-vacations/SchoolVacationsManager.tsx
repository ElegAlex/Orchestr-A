"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  SchoolVacation,
  SchoolVacationSource,
  SCHOOL_VACATION_SOURCE_LABELS,
  SCHOOL_VACATION_SOURCE_COLORS,
} from "@/types";
import { schoolVacationsService } from "@/services/school-vacations.service";
import { SchoolVacationModal } from "./SchoolVacationModal";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export function SchoolVacationsManager() {
  const t = useTranslations("settings.schoolVacations");
  const tCommon = useTranslations("common.actions");

  // School year logic: if month >= September (8), use current year; else use current year - 1
  const now = new Date();
  const currentSchoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const [selectedYear, setSelectedYear] = useState(currentSchoolYear);
  const [vacations, setVacations] = useState<SchoolVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<SchoolVacation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchVacations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await schoolVacationsService.getAll(selectedYear);
      setVacations(data);
    } catch {
      toast.error(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, t]);

  useEffect(() => {
    fetchVacations();
  }, [fetchVacations]);

  const sortedVacations = useMemo(() => {
    return [...vacations].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [vacations]);

  const handleCreate = () => {
    setEditingVacation(null);
    setIsModalOpen(true);
  };

  const handleEdit = (vacation: SchoolVacation) => {
    setEditingVacation(vacation);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await schoolVacationsService.delete(id);
      toast.success(t("messages.deleteSuccess"));
      fetchVacations();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t("messages.deleteError"));
    }
    setDeleteConfirmId(null);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await schoolVacationsService.importFromOpenData(selectedYear);
      toast.success(
        t("messages.importSuccess", {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      fetchVacations();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t("messages.importError"));
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handlePrevYear = () => setSelectedYear((y) => y - 1);
  const handleNextYear = () => setSelectedYear((y) => y + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">*</span>
            {t("title")}
          </h2>

          {/* Selecteur d'annee scolaire */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2">
            <button
              onClick={handlePrevYear}
              className="p-2 hover:bg-gray-200 rounded transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="font-medium w-24 text-center">
              {selectedYear}-{selectedYear + 1}
            </span>
            <button
              onClick={handleNextYear}
              className="p-2 hover:bg-gray-200 rounded transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isImporting ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            )}
            <span>{t("importButton", { year: `${selectedYear}-${selectedYear + 1}` })}</span>
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{t("addButton")}</span>
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.name")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.startDate")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.endDate")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.source")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">{tCommon("loading")}</p>
                </td>
              </tr>
            ) : sortedVacations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {t("table.empty", { year: `${selectedYear}-${selectedYear + 1}` })}
                </td>
              </tr>
            ) : (
              sortedVacations.map((vacation) => (
                <tr
                  key={vacation.id}
                  className="hover:bg-gray-100 transition"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {vacation.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">
                      {formatDate(vacation.startDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">
                      {formatDate(vacation.endDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${SCHOOL_VACATION_SOURCE_COLORS[vacation.source]}`}
                    >
                      {SCHOOL_VACATION_SOURCE_LABELS[vacation.source]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(vacation)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition"
                        title={t("tooltips.edit")}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {deleteConfirmId === vacation.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(vacation.id)}
                            className="p-2 text-white bg-red-600 rounded hover:bg-red-700 transition"
                            title={t("tooltips.confirm")}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition"
                            title={t("tooltips.cancel")}
                          >
                            <svg
                              className="w-4 h-4"
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
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(vacation.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          title={t("tooltips.delete")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Statistiques */}
      {!loading && sortedVacations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.total")}</p>
            <p className="text-2xl font-bold text-gray-900">
              {sortedVacations.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.imported")}</p>
            <p className="text-2xl font-bold text-blue-600">
              {
                sortedVacations.filter(
                  (v) => v.source === SchoolVacationSource.IMPORT,
                ).length
              }
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.manual")}</p>
            <p className="text-2xl font-bold text-gray-600">
              {
                sortedVacations.filter(
                  (v) => v.source === SchoolVacationSource.MANUAL,
                ).length
              }
            </p>
          </div>
        </div>
      )}

      {/* Modal creation/edition */}
      <SchoolVacationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVacation(null);
        }}
        onSuccess={fetchVacations}
        vacation={editingVacation}
        defaultYear={selectedYear}
      />
    </div>
  );
}
