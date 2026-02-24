"use client";

import { useState } from "react";
import { Event, eventsService } from "@/services/events.service";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";

interface EventModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const EventModal = ({
  event,
  isOpen,
  onClose,
  onRefresh,
}: EventModalProps) => {
  const t = useTranslations("planning.eventModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const [deleting, setDeleting] = useState(false);
  const [stoppingRecurrence, setStoppingRecurrence] = useState(false);

  if (!isOpen || !event) return null;

  const handleEdit = () => {
    onClose();
    router.push(`/${locale}/events`);
  };

  const handleStopRecurrence = async () => {
    if (!confirm(t("confirmStopRecurrence"))) return;
    try {
      setStoppingRecurrence(true);
      await eventsService.deleteRecurrence(event!.id);
      toast.success(t("stopRecurrenceSuccess"));
      onClose();
      if (onRefresh) onRefresh();
    } catch {
      toast.error(t("stopRecurrenceError"));
    } finally {
      setStoppingRecurrence(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      setDeleting(true);
      await eventsService.delete(event.id);
      toast.success(t("deleteSuccess"));
      onClose();
      if (onRefresh) onRefresh();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(
      locale === "en" ? "en-US" : "fr-FR",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">
              {event.isExternalIntervention ? "🔴" : "📅"}
            </span>
            <h2 className="text-xl font-bold text-gray-900">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {event.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t("description")}
              </h3>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("date")}</h3>
              <p className="text-gray-700">{formatDate(event.date)}</p>
            </div>
            {event.isAllDay ? (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("schedule")}
                </h3>
                <span className="inline-block px-3 py-1 rounded text-sm bg-gray-100 text-gray-800">
                  {t("allDay")}
                </span>
              </div>
            ) : event.startTime || event.endTime ? (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("schedule")}
                </h3>
                <p className="text-gray-700">
                  {event.startTime || "--:--"} - {event.endTime || "--:--"}
                </p>
              </div>
            ) : null}
            {event.isExternalIntervention && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("type")}
                </h3>
                <span className="inline-block px-3 py-1 rounded text-sm bg-orange-100 text-orange-800">
                  {t("externalIntervention")}
                </span>
              </div>
            )}
            {event.project && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("project")}
                </h3>
                <p className="text-gray-700">{event.project.name}</p>
              </div>
            )}
          </div>
          {event.participants && event.participants.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t("participants")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {event.participants.map((p) => (
                  <span
                    key={p.userId}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {p.user.firstName} {p.user.lastName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.parentEventId && (
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                🔁 {t("partOfSeries")}
              </span>
            </div>
          )}

          {event.isRecurring && !event.parentEventId && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-2">
                🔁 {t("recurrence")}
              </h3>
              <div className="text-sm text-purple-800 space-y-1">
                {event.recurrenceWeekInterval && (
                  <p>
                    {t("everyXWeeks", {
                      count: event.recurrenceWeekInterval,
                    })}
                  </p>
                )}
                {event.recurrenceDay !== null &&
                  event.recurrenceDay !== undefined && (
                    <p>
                      {t("onDay", {
                        day: [
                          t("days.mon"),
                          t("days.tue"),
                          t("days.wed"),
                          t("days.thu"),
                          t("days.fri"),
                          t("days.sat"),
                          t("days.sun"),
                        ][event.recurrenceDay],
                      })}
                    </p>
                  )}
                {event.recurrenceEndDate && (
                  <p>
                    {t("until", { date: formatDate(event.recurrenceEndDate) })}
                  </p>
                )}
              </div>
              <button
                onClick={handleStopRecurrence}
                disabled={stoppingRecurrence}
                className="mt-2 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50"
              >
                {stoppingRecurrence
                  ? t("stoppingRecurrence")
                  : t("stopRecurrence")}
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            {tCommon("actions.delete")}
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              {tCommon("actions.close")}
            </button>
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {tCommon("actions.edit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
