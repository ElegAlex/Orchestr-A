"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task } from "@/types";
import { Event } from "@/services/events.service";
import {
  usePlanningData,
  ServiceGroup,
  DayCell,
} from "@/hooks/usePlanningData";
import { GroupHeader } from "./GroupHeader";
import { UserRow } from "./UserRow";
import { TaskModal } from "./TaskModal";
import { EventModal } from "./EventModal";
import { teleworkService } from "@/services/telework.service";
import { tasksService } from "@/services/tasks.service";
import { usePlanningViewStore } from "@/stores/planningView.store";
import { format, isToday, getDay } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import toast from "react-hot-toast";
import { useTranslations, useLocale } from "next-intl";

type ViewFilter = "all" | "availability" | "activity";

/** Composant interne pour gérer les sections collapsibles */
interface CollapsibleServiceSectionProps {
  group: ServiceGroup;
  taskCount: number;
  displayDays: Date[];
  viewMode: "week" | "month";
  showGroupHeaders: boolean;
  getDayCell: (userId: string, date: Date) => DayCell;
  onTeleworkToggle: (userId: string, date: Date) => void;
  onDragStart: (task: Task, sourceUserId: string) => void;
  onDragEnd: () => void;
  onDrop: (userId: string, date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: Event) => void;
}

const CollapsibleServiceSection = ({
  group,
  taskCount,
  displayDays,
  viewMode,
  showGroupHeaders,
  getDayCell,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
}: CollapsibleServiceSectionProps) => {
  const { collapsedServices } = usePlanningViewStore();
  const isCollapsed = collapsedServices[group.id] ?? false;

  return (
    <React.Fragment>
      {/* Group Header */}
      {showGroupHeaders && (
        <GroupHeader
          group={group}
          taskCount={taskCount}
          colSpan={displayDays.length + 1}
        />
      )}
      {/* User Rows - masquées si le groupe est replié */}
      {!isCollapsed &&
        group.users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            group={group}
            displayDays={displayDays}
            viewMode={viewMode}
            getDayCell={getDayCell}
            onTeleworkToggle={onTeleworkToggle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            onEventClick={onEventClick}
          />
        ))}
    </React.Fragment>
  );
};

interface PlanningGridProps {
  currentDate: Date;
  viewMode: "week" | "month";
  filterUserId?: string; // Pour filtrer sur un utilisateur (dashboard)
  filterServiceIds?: string[]; // Pour filtrer sur un ou plusieurs services
  viewFilter?: ViewFilter; // Filtre d'affichage (default: 'all')
  showGroupHeaders?: boolean; // Afficher les headers de groupes (default: true)
  refreshTrigger?: number; // Incrémenter pour forcer un refresh
}

export const PlanningGrid = ({
  currentDate,
  viewMode,
  filterUserId,
  filterServiceIds,
  viewFilter = "all",
  showGroupHeaders = true,
  refreshTrigger = 0,
}: PlanningGridProps) => {
  const t = useTranslations("planning");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : fr;
  const {
    loading,
    displayDays,
    filteredGroups,
    getDayCell,
    getHolidayForDate,
    silentRefetch,
    getGroupTaskCount,
  } = usePlanningData({
    currentDate,
    viewMode,
    filterUserId,
    filterServiceIds,
    viewFilter,
  });

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragSourceUserId, setDragSourceUserId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Refetch quand refreshTrigger change (skip le montage initial)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    silentRefetch();
  }, [refreshTrigger]);

  const handleTeleworkToggle = async (userId: string, date: Date) => {
    try {
      const cell = getDayCell(userId, date);
      const existing = cell.teleworkSchedule;
      const dateStr = format(date, "yyyy-MM-dd");

      if (existing) {
        await teleworkService.update(existing.id, {
          isTelework: !existing.isTelework,
        });
      } else {
        await teleworkService.create({
          date: dateStr,
          isTelework: true,
          isException: false,
          userId,
        });
      }
      silentRefetch();
    } catch {
      toast.error(t("telework.updateError"));
    }
  };

  const handleDragStart = (task: Task, sourceUserId: string) => {
    setDraggedTask(task);
    setDragSourceUserId(sourceUserId);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragSourceUserId(null);
  };

  const handleDrop = async (targetUserId: string, date: Date) => {
    if (!draggedTask || !dragSourceUserId) return;

    const currentAssigneeIds =
      draggedTask.assignees?.map((a) => a.userId) || [];
    const isSameUser = dragSourceUserId === targetUserId;
    const targetAlreadyAssigned = currentAssigneeIds.includes(targetUserId);
    const isSingleAssignee = currentAssigneeIds.length <= 1;

    // Reset immédiatement pour UX fluide
    setDraggedTask(null);
    setDragSourceUserId(null);

    try {
      if (isSingleAssignee) {
        // Tâche mono-assigné: on peut changer date ET assigné
        const updateData: {
          startDate: string;
          endDate: string;
          assigneeIds?: string[];
        } = {
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        };
        if (!isSameUser) {
          updateData.assigneeIds = [targetUserId];
        }
        await tasksService.update(draggedTask.id, updateData);
      } else {
        // Tâche multi-assignés: on change seulement l'assignation (pas les dates)
        if (isSameUser) {
          toast(
            t("taskMove.multiAssignDateError"),
            {
              icon: "\u2139\uFE0F",
              duration: 3000,
              id: `multi-assignee-${Date.now()}`,
            },
          );
          return;
        }
        if (targetAlreadyAssigned) {
          toast(t("taskMove.alreadyAssigned"), {
            icon: "\u2139\uFE0F",
            duration: 2000,
            id: `already-assigned-${Date.now()}`,
          });
          return;
        }
        // Remplacer source par cible
        const newAssigneeIds = currentAssigneeIds.map((id) =>
          id === dragSourceUserId ? targetUserId : id,
        );
        await tasksService.update(draggedTask.id, {
          assigneeIds: newAssigneeIds,
        });

        // Informer que seul l'assigné a changé (pas la date)
        toast(
          t("taskMove.reassignOnly"),
          {
            icon: "\u2139\uFE0F",
            duration: 3000,
            id: `reassign-only-${Date.now()}`,
          },
        );
      }

      silentRefetch();
    } catch {
      toast.error(t("taskMove.moveError"));
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 bg-gray-50 z-40 px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px]">
                  {t("table.resource")}
                </th>
                {displayDays.map((day, index) => {
                  const isMonday = getDay(day) === 1;
                  const isFirstDay = index === 0;
                  const showWeekSeparator =
                    viewMode === "month" && isMonday && !isFirstDay;
                  const holiday = getHolidayForDate(day);

                  return (
                    <th
                      key={day.toISOString()}
                      className={`text-center font-semibold ${
                        viewMode === "month"
                          ? "px-1 py-1 min-w-[40px] max-w-[50px]"
                          : "px-4 py-3 min-w-[180px]"
                      } ${holiday ? "bg-red-50 text-red-900" : isToday(day) ? "bg-blue-50 text-blue-900" : "text-gray-900"} ${
                        showWeekSeparator
                          ? "border-l-2 border-l-indigo-400"
                          : ""
                      }`}
                      title={holiday ? holiday.name : undefined}
                    >
                      <div
                        className={
                          viewMode === "month"
                            ? "text-[9px] leading-tight"
                            : "text-sm"
                        }
                      >
                        {format(day, viewMode === "month" ? "EEEEE" : "EEEE", {
                          locale: dateLocale,
                        })}
                      </div>
                      <div
                        className={
                          viewMode === "month"
                            ? "text-xs font-bold"
                            : "text-lg font-bold"
                        }
                      >
                        {format(day, "dd")}
                      </div>
                      {holiday && viewMode === "week" && (
                        <div className="text-[10px] text-red-600 font-normal truncate max-w-[150px]">
                          {holiday.name}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayDays.length + 1}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {t("noResources")}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredGroups.map((group) => {
                    const taskCount = getGroupTaskCount(group.users);

                    return (
                      <CollapsibleServiceSection
                        key={group.id}
                        group={group}
                        taskCount={taskCount}
                        displayDays={displayDays}
                        viewMode={viewMode}
                        showGroupHeaders={showGroupHeaders}
                        getDayCell={getDayCell}
                        onTeleworkToggle={handleTeleworkToggle}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        onTaskClick={handleTaskClick}
                        onEventClick={handleEventClick}
                      />
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={handleCloseTaskModal}
        onRefresh={silentRefetch}
      />

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={showEventModal}
        onClose={handleCloseEventModal}
        onRefresh={silentRefetch}
      />
    </>
  );
};
