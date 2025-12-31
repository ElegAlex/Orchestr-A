"use client";

import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { teleworkService } from "@/services/telework.service";
import { TeleworkSchedule } from "@/types";
import toast from "react-hot-toast";
import { format, isSameDay } from "date-fns";

export default function TeleworkPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [teleworkDays, setTeleworkDays] = useState<TeleworkSchedule[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Charger les données de télétravail
  const fetchTeleworkData = useCallback(async () => {
    try {
      setLoading(true);
      // Récupérer les 6 prochains mois de données
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

      const data = await teleworkService.getByDateRange(
        format(startDate, "yyyy-MM-dd"),
        format(endDate, "yyyy-MM-dd"),
      );
      setTeleworkDays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erreur chargement télétravail:", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchTeleworkData();
  }, [fetchTeleworkData]);

  // Générer les 3 prochains mois
  const getMonthsToDisplay = () => {
    const months = [];
    for (let i = 0; i < 3; i++) {
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

    // Ajouter les jours vides pour aligner sur le début de semaine
    const startPadding = (firstDay.getDay() + 6) % 7; // Lundi = 0
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Ajouter tous les jours du mois
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
    if (!user) return undefined;
    return teleworkDays.find(
      (d) => d.userId === user.id && isSameDay(new Date(d.date), date),
    );
  };

  const handleDayClick = (date: Date) => {
    if (isWeekend(date)) return;
    setSelectedDate(formatDate(date));
    setShowModal(true);
  };

  const handleToggleTelework = async (isTelework: boolean) => {
    if (!selectedDate || !user) return;

    try {
      const selectedDateObj = new Date(selectedDate + "T12:00:00");
      const existingDay = teleworkDays.find(
        (d) =>
          d.userId === user.id && isSameDay(new Date(d.date), selectedDateObj),
      );

      if (existingDay) {
        // Mise à jour
        await teleworkService.update(existingDay.id, { isTelework });
        toast.success(
          isTelework ? "Télétravail enregistré" : "Bureau enregistré",
        );
      } else {
        // Création
        await teleworkService.create({
          date: selectedDate,
          isTelework,
          isException: false,
          userId: user.id,
        });
        toast.success(
          isTelework
            ? "Jour de télétravail enregistré"
            : "Jour en présentiel enregistré",
        );
      }

      setShowModal(false);
      setSelectedDate(null);
      fetchTeleworkData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de l'enregistrement",
      );
    }
  };

  const handleRemoveTelework = async () => {
    if (!selectedDate || !user) return;

    try {
      const selectedDateObj = new Date(selectedDate + "T12:00:00");
      const existingDay = teleworkDays.find(
        (d) =>
          d.userId === user.id && isSameDay(new Date(d.date), selectedDateObj),
      );
      if (existingDay) {
        await teleworkService.delete(existingDay.id);
        toast.success("Jour supprimé");
      }
      setShowModal(false);
      setSelectedDate(null);
      fetchTeleworkData();
    } catch {
      toast.error("Erreur lors de la suppression");
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

    return "bg-white text-gray-900 hover:bg-gray-100 cursor-pointer border-gray-200";
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  };

  const getTeleworkStats = () => {
    if (!user) return 0;
    return teleworkDays.filter((d) => d.userId === user.id && d.isTelework)
      .length;
  };

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Mon planning télétravail
          </h1>
          <p className="text-gray-600 mt-1">
            {getTeleworkStats()} jour(s) de télétravail planifié(s)
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900">
                Comment ça marche ?
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                Cliquez sur un jour pour déclarer votre présence en télétravail
                ou au bureau. Les jours en bleu sont vos jours de télétravail.
                Vous pouvez modifier vos choix à tout moment.
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Légende</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 border border-blue-300 rounded"></div>
              <span className="text-sm text-gray-700">Télétravail</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-100 border border-gray-300 rounded"></div>
              <span className="text-sm text-gray-700">Bureau (déclaré)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
              <span className="text-sm text-gray-700">Non déclaré</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-50 border border-gray-200 rounded"></div>
              <span className="text-sm text-gray-700">Week-end</span>
            </div>
          </div>
        </div>

        {/* Calendar for 3 months */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            ← Mois précédent
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
            Mois suivant →
          </button>
        </div>
      </div>

      {/* Day Selection Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                "fr-FR",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
              )}
            </h2>

            <p className="text-gray-600 mb-6">
              Où travaillez-vous ce jour-là ?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleToggleTelework(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
              >
                <span>🏠</span>
                <span>Télétravail</span>
              </button>

              <button
                onClick={() => handleToggleTelework(false)}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center space-x-2"
              >
                <span>🏢</span>
                <span>Bureau</span>
              </button>

              {getTeleworkStatus(new Date(selectedDate + "T12:00:00")) && (
                <button
                  onClick={handleRemoveTelework}
                  className="w-full px-4 py-3 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedDate(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
