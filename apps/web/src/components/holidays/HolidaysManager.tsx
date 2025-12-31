'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Holiday,
  HolidayType,
  HOLIDAY_TYPE_LABELS,
  HOLIDAY_TYPE_COLORS,
} from '@/types';
import { holidaysService } from '@/services/holidays.service';
import { HolidayModal } from './HolidayModal';
import toast from 'react-hot-toast';

export function HolidaysManager() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await holidaysService.getByYear(selectedYear);
      setHolidays(data);
    } catch {
      toast.error('Erreur lors du chargement des jours feries');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [holidays]);

  const handleCreate = () => {
    setEditingHoliday(null);
    setIsModalOpen(true);
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await holidaysService.delete(id);
      toast.success('Jour ferie supprime');
      fetchHolidays();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        error.response?.data?.message || 'Erreur lors de la suppression'
      );
    }
    setDeleteConfirmId(null);
  };

  const handleImportFrench = async () => {
    setIsImporting(true);
    try {
      const result = await holidaysService.importFrench(selectedYear);
      toast.success(
        `Import termine : ${result.created} cree(s), ${result.skipped} deja existant(s)`
      );
      fetchHolidays();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "Erreur lors de l'import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleWorkDay = async (holiday: Holiday) => {
    try {
      await holidaysService.update(holiday.id, {
        isWorkDay: !holiday.isWorkDay,
      });
      toast.success('Statut mis a jour');
      fetchHolidays();
    } catch {
      toast.error('Erreur lors de la mise a jour');
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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
            Jours feries
          </h2>

          {/* Selecteur d'annee */}
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
            <span className="font-medium w-16 text-center">{selectedYear}</span>
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
            onClick={handleImportFrench}
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
            <span>Importer feries FR {selectedYear}</span>
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
            <span>Ajouter un jour</span>
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Libelle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jour ouvre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">Chargement...</p>
                </td>
              </tr>
            ) : sortedHolidays.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  Aucun jour ferie declare pour {selectedYear}
                </td>
              </tr>
            ) : (
              sortedHolidays.map((holiday) => (
                <tr
                  key={holiday.id}
                  className={`${!holiday.isWorkDay ? 'bg-gray-50' : ''} hover:bg-gray-100 transition`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {formatDate(holiday.date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">{holiday.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${HOLIDAY_TYPE_COLORS[holiday.type]}`}
                    >
                      {HOLIDAY_TYPE_LABELS[holiday.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleToggleWorkDay(holiday)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        holiday.isWorkDay ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          holiday.isWorkDay ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-500 text-sm truncate max-w-xs block">
                      {holiday.description || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(holiday)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition"
                        title="Modifier"
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
                      {deleteConfirmId === holiday.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(holiday.id)}
                            className="p-2 text-white bg-red-600 rounded hover:bg-red-700 transition"
                            title="Confirmer"
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
                            title="Annuler"
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
                          onClick={() => setDeleteConfirmId(holiday.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          title="Supprimer"
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
      {!loading && sortedHolidays.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total jours feries</p>
            <p className="text-2xl font-bold text-gray-900">
              {sortedHolidays.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Jours chomes</p>
            <p className="text-2xl font-bold text-red-600">
              {sortedHolidays.filter((h) => !h.isWorkDay).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Jours ouvres</p>
            <p className="text-2xl font-bold text-green-600">
              {sortedHolidays.filter((h) => h.isWorkDay).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Feries legaux</p>
            <p className="text-2xl font-bold text-blue-600">
              {sortedHolidays.filter((h) => h.type === HolidayType.LEGAL).length}
            </p>
          </div>
        </div>
      )}

      {/* Modal creation/edition */}
      <HolidayModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHoliday(null);
        }}
        onSuccess={fetchHolidays}
        holiday={editingHoliday}
        defaultYear={selectedYear}
      />
    </div>
  );
}
