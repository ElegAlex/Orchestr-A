"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Task } from "@/types";
import { Event } from "@/services/events.service";
import { PredefinedTaskAssignment } from "@/services/predefined-tasks.service";
import {
  usePlanningData,
  ServiceGroup,
  DayCell,
  DisplayFilters,
} from "@/hooks/usePlanningData";
import { GroupHeader } from "./GroupHeader";
import { UserRow } from "./UserRow";
import { TaskModal } from "./TaskModal";
import { EventModal } from "./EventModal";
import { AssignmentModal } from "@/components/predefined-tasks/AssignmentModal";
import { teleworkService } from "@/services/telework.service";
import { tasksService } from "@/services/tasks.service";
import { usePlanningViewStore } from "@/stores/planningView.store";
import { format, isToday, getDay, parseISO } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import toast from "react-hot-toast";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";

type ViewFilter = "all" | "availability" | "activity";

/** Composant interne pour gérer les sections collapsibles */
interface CollapsibleServiceSectionProps {
  group: ServiceGroup;
  taskCount: number;
  displayDays: Date[];
  viewMode: "week" | "month";
  showGroupHeaders: boolean;
  gridTemplateColumns: string;
  currentUserId: string;
  canManageOthersTelework: boolean;
  canAssignPredefinedTask: boolean;
  getDayCell: (userId: string, date: Date) => DayCell;
  onTeleworkToggle: (userId: string, date: Date) => void;
  onDragStart: (task: Task, sourceUserId: string) => void;
  onDragEnd: () => void;
  onDrop: (userId: string, date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: Event) => void;
  onPredefinedTaskClick: (
    assignment: PredefinedTaskAssignment,
    date: Date,
  ) => void;
  onAddPredefinedTask: (userId: string, date: Date) => void;
}

const CollapsibleServiceSection = ({
  group,
  taskCount,
  displayDays,
  viewMode,
  showGroupHeaders,
  gridTemplateColumns,
  currentUserId,
  canManageOthersTelework,
  canAssignPredefinedTask,
  getDayCell,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
  onPredefinedTaskClick,
  onAddPredefinedTask,
}: CollapsibleServiceSectionProps) => {
  const { collapsedServices } = usePlanningViewStore();
  const isCollapsed = collapsedServices[group.id] ?? false;

  return (
    <div>
      {/* Group Header — sticky inside this section div = push-out behavior */}
      {showGroupHeaders && (
        <GroupHeader
          group={group}
          taskCount={taskCount}
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
            gridTemplateColumns={gridTemplateColumns}
            currentUserId={currentUserId}
            canManageOthersTelework={canManageOthersTelework}
            canAssignPredefinedTask={canAssignPredefinedTask}
            getDayCell={getDayCell}
            onTeleworkToggle={onTeleworkToggle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            onEventClick={onEventClick}
            onPredefinedTaskClick={onPredefinedTaskClick}
            onAddPredefinedTask={onAddPredefinedTask}
          />
        ))}
    </div>
  );
};

interface PlanningGridProps {
  currentDate: Date;
  viewMode: "week" | "month";
  filterUserId?: string; // Pour filtrer sur un utilisateur (dashboard)
  filterServiceIds?: string[]; // Pour filtrer sur un ou plusieurs services
  viewFilter?: ViewFilter; // Filtre d'affichage (default: 'all')
  displayFilters?: DisplayFilters; // Filtres granulaires
  showGroupHeaders?: boolean; // Afficher les headers de groupes (default: true)
  refreshTrigger?: number; // Incrémenter pour forcer un refresh
}

export const PlanningGrid = ({
  currentDate,
  viewMode,
  filterUserId,
  filterServiceIds,
  viewFilter = "all",
  displayFilters,
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
    isSpecialDay,
    silentRefetch,
    getGroupTaskCount,
    schoolVacations,
  } = usePlanningData({
    currentDate,
    viewMode,
    filterUserId,
    filterServiceIds,
    viewFilter,
    displayFilters,
  });

  // Shared grid template for all rows
  const gridCols = `220px repeat(${displayDays.length}, 1fr)`;

  // Compute school vacation banners overlapping displayed days
  const vacationBanners = useMemo(() => {
    if (!schoolVacations || schoolVacations.length === 0 || displayDays.length === 0) return [];

    const banners: {
      id: string;
      name: string;
      zone: string;
      startCol: number;
      endCol: number;
    }[] = [];

    for (const vacation of schoolVacations) {
      const vacStart = parseISO(vacation.startDate);
      const vacEnd = parseISO(vacation.endDate);

      // Find the first and last displayed day indices that overlap with this vacation
      let firstIdx = -1;
      let lastIdx = -1;

      for (let i = 0; i < displayDays.length; i++) {
        const day = displayDays[i];
        if (day >= vacStart && day <= vacEnd) {
          if (firstIdx === -1) firstIdx = i;
          lastIdx = i;
        }
      }

      if (firstIdx !== -1) {
        banners.push({
          id: vacation.id,
          name: vacation.name,
          zone: vacation.zone,
          // +2 because grid col 1 is the resource column, and CSS grid is 1-indexed
          startCol: firstIdx + 2,
          endCol: lastIdx + 3,
        });
      }
    }

    return banners;
  }, [schoolVacations, displayDays]);

  const currentUser = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const currentUserId = currentUser?.id || "";
  const canManageOthersTelework = hasPermission("telework:manage_any");
  const canAssignPredefinedTask = hasPermission("predefined_tasks:assign");

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragSourceUserId, setDragSourceUserId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Predefined task assignment modal state
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalDates, setAssignmentModalDates] = useState<Date[]>([]);
  const [assignmentModalUserIds, setAssignmentModalUserIds] = useState<
    string[]
  >([]);
  const [existingAssignment, setExistingAssignment] =
    useState<PredefinedTaskAssignment | null>(null);

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
          toast(t("taskMove.multiAssignDateError"), {
            icon: "\u2139\uFE0F",
            duration: 3000,
            id: `multi-assignee-${Date.now()}`,
          });
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
        toast(t("taskMove.reassignOnly"), {
          icon: "\u2139\uFE0F",
          duration: 3000,
          id: `reassign-only-${Date.now()}`,
        });
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

  const handlePredefinedTaskClick = (
    assignment: PredefinedTaskAssignment,
    date: Date,
  ) => {
    setExistingAssignment(assignment);
    setAssignmentModalDates([date]);
    setAssignmentModalUserIds([assignment.userId]);
    setShowAssignmentModal(true);
  };

  const handleAddPredefinedTask = (userId: string, date: Date) => {
    setExistingAssignment(null);
    setAssignmentModalDates([date]);
    setAssignmentModalUserIds([userId]);
    setShowAssignmentModal(true);
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
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="w-full" style={{ minWidth: `${220 + displayDays.length * (viewMode === "month" ? 35 : 100)}px` }}>
            {/* Days header — sticky at top */}
            <div
              className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30"
              style={{ display: "grid", gridTemplateColumns: gridCols }}
            >
              <div className="sticky left-0 bg-gray-50 z-40 px-3 py-3 text-left text-xs font-semibold text-gray-900">
                {t("table.resource")}
              </div>
              {displayDays.map((day, index) => {
                const isMonday = getDay(day) === 1;
                const isFirstDay = index === 0;
                const showWeekSeparator =
                  viewMode === "month" && isMonday && !isFirstDay;
                const holiday = getHolidayForDate(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`text-center font-semibold ${
                      viewMode === "month"
                        ? "px-1 py-1"
                        : "px-2 py-3"
                    } ${holiday ? "bg-red-50 text-red-900" : isToday(day) ? "bg-blue-50 text-blue-900" : isSpecialDay(day) ? "bg-gray-100 text-gray-900" : "text-gray-900"} ${
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
                      <div className="text-[10px] text-red-600 font-normal truncate">
                        {holiday.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* School vacation banners */}
            {vacationBanners.length > 0 && (
              <div
                style={{ display: "grid", gridTemplateColumns: gridCols }}
              >
                {/* Empty resource column */}
                <div />
                {/* Vacation bars positioned via grid columns */}
                {vacationBanners.map((banner) => {
                  const shortName = banner.name
                    .replace(/^Vacances\s+d[eu']/i, "")
                    .replace(/^Vacances\s+/i, "")
                    .trim();
                  return (
                    <div
                      key={banner.id}
                      className={`flex items-center justify-center border-b-2 border-blue-500 text-blue-800 font-medium truncate ${
                        viewMode === "month"
                          ? "text-[9px] py-0.5"
                          : "text-xs py-1"
                      }`}
                      style={{
                        gridColumn: `${banner.startCol} / ${banner.endCol}`,
                        background: "linear-gradient(to right, #dbeafe, #bfdbfe)",
                      }}
                      title={`${banner.name} — Zone ${banner.zone}`}
                    >
                      {viewMode === "month"
                        ? `\uD83C\uDFD6\uFE0F ${shortName}`
                        : `\uD83C\uDFD6\uFE0F ${banner.name} — Zone ${banner.zone}`}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Service sections */}
            {filteredGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                {t("noResources")}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const taskCount = getGroupTaskCount(group.users);

                return (
                  <CollapsibleServiceSection
                    key={group.id}
                    group={group}
                    taskCount={taskCount}
                    displayDays={displayDays}
                    viewMode={viewMode}
                    showGroupHeaders={showGroupHeaders}
                    gridTemplateColumns={gridCols}
                    currentUserId={currentUserId}
                    canManageOthersTelework={canManageOthersTelework}
                    canAssignPredefinedTask={canAssignPredefinedTask}
                    getDayCell={getDayCell}
                    onTeleworkToggle={handleTeleworkToggle}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    onTaskClick={handleTaskClick}
                    onEventClick={handleEventClick}
                    onPredefinedTaskClick={handlePredefinedTaskClick}
                    onAddPredefinedTask={handleAddPredefinedTask}
                  />
                );
              })
            )}
          </div>
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

      {/* Predefined Task Assignment Modal */}
      {showAssignmentModal && (
        <AssignmentModal
          dates={assignmentModalDates}
          userIds={assignmentModalUserIds}
          existingAssignment={existingAssignment}
          onClose={() => {
            setShowAssignmentModal(false);
            setExistingAssignment(null);
          }}
          onSuccess={() => {
            silentRefetch();
          }}
        />
      )}
    </>
  );
};
