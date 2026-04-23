import { Task, TaskStatus } from "@/types";
import { Event } from "@/services/events.service";
import { PredefinedTaskAssignment } from "@/services/predefined-tasks.service";
import { DayCell as DayCellData } from "@/hooks/usePlanningData";
import {
  getPriorityColor,
  getStatusIcon,
  getStatusDotColor,
} from "@/lib/planning-utils";
import { usePlanningViewStore } from "@/stores/planningView.store";
import { isToday, getDay } from "date-fns";
import { useTranslations } from "next-intl";

const STATUS_FILTER_KEY: Record<
  TaskStatus,
  "todo" | "inProgress" | "inReview" | "done" | "blocked"
> = {
  [TaskStatus.TODO]: "todo",
  [TaskStatus.IN_PROGRESS]: "inProgress",
  [TaskStatus.IN_REVIEW]: "inReview",
  [TaskStatus.DONE]: "done",
  [TaskStatus.BLOCKED]: "blocked",
};

interface DayCellProps {
  cell: DayCellData;
  userId: string;
  viewMode: "week" | "month";
  dayIndex: number;
  canToggleTelework: boolean;
  canAssignPredefinedTask: boolean;
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

export const DayCell = ({
  cell,
  userId,
  viewMode,
  dayIndex,
  canToggleTelework,
  canAssignPredefinedTask,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
  onPredefinedTaskClick,
  onAddPredefinedTask,
}: DayCellProps) => {
  const t = useTranslations("planning");
  const tCommon = useTranslations("common");

  // Selectors granulaires : un par filtre lu, pour éviter les re-renders globaux au toggle.
  const showTodo = usePlanningViewStore((s) => s.legendFilters.todo);
  const showInProgress = usePlanningViewStore(
    (s) => s.legendFilters.inProgress,
  );
  const showInReview = usePlanningViewStore((s) => s.legendFilters.inReview);
  const showDone = usePlanningViewStore((s) => s.legendFilters.done);
  const showBlocked = usePlanningViewStore((s) => s.legendFilters.blocked);
  const showProjectTask = usePlanningViewStore(
    (s) => s.legendFilters.projectTask,
  );
  const showOrphanTask = usePlanningViewStore(
    (s) => s.legendFilters.orphanTask,
  );
  const showTelework = usePlanningViewStore((s) => s.legendFilters.telework);
  const showOffice = usePlanningViewStore((s) => s.legendFilters.office);
  const showLeavePending = usePlanningViewStore(
    (s) => s.legendFilters.leavePending,
  );
  const leaveTypeFilters = usePlanningViewStore((s) => s.leaveTypeFilters);
  const showEvent = usePlanningViewStore((s) => s.legendFilters.event);
  const showExternalIntervention = usePlanningViewStore(
    (s) => s.legendFilters.externalIntervention,
  );

  const statusFilterMap = {
    todo: showTodo,
    inProgress: showInProgress,
    inReview: showInReview,
    done: showDone,
    blocked: showBlocked,
  } as const;

  const isTaskVisible = (task: Task): boolean => {
    if (!statusFilterMap[STATUS_FILTER_KEY[task.status]]) return false;
    if (task.isExternalIntervention) {
      if (!showExternalIntervention) return false;
    } else if (task.projectId) {
      if (!showProjectTask) return false;
    } else {
      if (!showOrphanTask) return false;
    }
    return true;
  };

  const hasLeave = cell.leaves.length > 0;
  // Un event all-day filtré ne doit plus masquer les tâches sous-jacentes
  // (cohérence avec l'Option A : masquer l'overlay, pas la donnée en dessous).
  const hasAllDayEvent = cell.events.some(
    (e) =>
      e.isAllDay &&
      (e.isExternalIntervention ? showExternalIntervention : showEvent),
  );
  const isMonday = getDay(cell.date) === 1;
  const isFirstDay = dayIndex === 0;
  const showWeekSeparator = viewMode === "month" && isMonday && !isFirstDay;

  // Prendre le premier congé (le plus pertinent)
  const leave = cell.leaves[0];
  const isPending = leave?.status === "PENDING";
  // Filtre type : visible par défaut si la clé n'est pas (encore) dans le store.
  // Fallback `leave.type` si le leave n'a pas de LeaveTypeConfig rattaché (legacy).
  const leaveTypeCode = leave?.leaveType?.code ?? leave?.type ?? null;
  const leaveTypeVisible =
    leaveTypeCode === null ? true : (leaveTypeFilters[leaveTypeCode] ?? true);
  const leaveVisible =
    hasLeave && leaveTypeVisible && (isPending ? showLeavePending : true);

  // Résoudre l'icône et la couleur depuis le leaveType config (custom ou défaut)
  const leaveIcon = leave?.leaveType?.icon ?? "🌴";
  const leaveColor = leave?.leaveType?.color ?? "#10B981";
  const leaveName =
    leave?.leaveType?.name ?? t(`leaveTypes.${leave?.type ?? "OTHER"}`);

  // Déterminer le background (priorité : holiday > today > specialDay > default)
  let bgClass = "";
  if (cell.isHoliday) {
    bgClass = "bg-red-50";
  } else if (isToday(cell.date)) {
    bgClass = "bg-blue-50";
  } else if (cell.isSpecialDay) {
    bgClass = "bg-gray-50";
  }

  return (
    <div
      className={`relative overflow-hidden ${viewMode === "month" ? "px-0.5 py-1" : "px-1 py-2"} ${bgClass} ${showWeekSeparator ? "border-l-2 border-l-indigo-400" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(userId, cell.date)}
      title={cell.isHoliday ? cell.holidayName : undefined}
    >
      {/* Holiday Overlay - couvre toute la cellule */}
      {cell.isHoliday && !leaveVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-red-100/80 border-2 border-red-300"
          title={cell.holidayName}
        >
          <span className={`${viewMode === "month" ? "text-lg" : "text-2xl"}`}>
            🎉
          </span>
          {viewMode === "week" && cell.holidayName && (
            <span className="font-medium text-red-800 text-xs text-center px-1 truncate max-w-full">
              {cell.holidayName}
            </span>
          )}
        </div>
      )}

      {/* Leave Overlay - couvre toute la cellule */}
      {leaveVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 border-2"
          style={{
            backgroundColor: isPending ? `${leaveColor}26` : `${leaveColor}4D`,
            borderColor: leaveColor,
            borderStyle: isPending ? "dashed" : "solid",
          }}
          title={`${leaveName}${isPending ? ` (${t("dayCell.pendingValidation")})` : ` (${t("dayCell.validated")})`}`}
        >
          <span className={`${viewMode === "month" ? "text-lg" : "text-2xl"}`}>
            {leaveIcon}
          </span>
          {viewMode === "week" && (
            <>
              <span
                className="font-medium text-xs"
                style={{ color: leaveColor }}
              >
                {leaveName}
              </span>
              {isPending && (
                <span
                  className="text-[10px] italic"
                  style={{ color: leaveColor }}
                >
                  {t("dayCell.pending")}
                </span>
              )}
            </>
          )}
          {viewMode === "month" && isPending && (
            <span className="text-[8px]" style={{ color: leaveColor }}>
              ?
            </span>
          )}
        </div>
      )}

      {/* External Intervention Background Overlay */}
      {cell.isExternalIntervention &&
        showExternalIntervention &&
        !leaveVisible &&
        !cell.isHoliday && (
          <div
            className="absolute inset-0 z-0 bg-red-100/40 border-2 border-red-400 rounded-sm pointer-events-none"
            aria-hidden="true"
          />
        )}

      {/* Telework Background Overlay - en arrière-plan pour que les tâches restent visibles.
          Masqué si le bg Intervention extérieure occupe déjà la cellule, pour préserver l'exclusivité visuelle actuelle. */}
      {cell.isTelework &&
        showTelework &&
        !leaveVisible &&
        !cell.isHoliday &&
        !(cell.isExternalIntervention && showExternalIntervention) && (
          <div
            className="absolute inset-0 z-0 bg-orange-100/40 border-2 border-orange-300 rounded-sm pointer-events-none"
            aria-hidden="true"
          />
        )}

      <div
        className={`relative z-10 space-y-1 ${viewMode === "month" ? "min-h-[40px]" : "min-h-[60px]"}`}
      >
        {/* Telework toggle - visible uniquement si pas de congé, jour férié, ni événement toute la journée.
            Le glyphe 🏠 (TT) est gouverné par showTelework, le glyphe 🏢 (bureau) par showOffice. */}
        {!leaveVisible &&
          !cell.isHoliday &&
          !hasAllDayEvent &&
          canToggleTelework &&
          (cell.isTelework ? showTelework : showOffice) && (
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={() => onTeleworkToggle(userId, cell.date)}
                className={`${viewMode === "month" ? "text-[10px]" : "text-lg"} transition ${
                  cell.isTelework
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
                title={
                  cell.isTelework ? t("telework.label") : t("telework.office")
                }
              >
                {cell.isTelework ? "🏠" : "🏢"}
              </button>
              {cell.isTelework && viewMode === "week" && (
                <span className="text-[9px] text-gray-500 leading-tight">
                  {t("telework.label")}
                </span>
              )}
            </div>
          )}
        {/* Telework indicator (read-only) for users without toggle permission */}
        {!leaveVisible &&
          !cell.isHoliday &&
          !hasAllDayEvent &&
          !canToggleTelework &&
          cell.isTelework &&
          showTelework && (
            <div className="flex flex-col items-center justify-center">
              <span
                className={`${viewMode === "month" ? "text-[10px]" : "text-lg"}`}
                title={t("telework.label")}
              >
                🏠
              </span>
              {viewMode === "week" && (
                <span className="text-[9px] text-gray-500 leading-tight">
                  {t("telework.label")}
                </span>
              )}
            </div>
          )}

        {/* Tasks - masquées si congé, jour férié, ou événement toute la journée.
            Chaque tâche est filtrée par son statut, son type (projet/orphan) et son caractère externe. */}
        {!leaveVisible &&
          !cell.isHoliday &&
          !hasAllDayEvent &&
          cell.tasks.filter(isTaskVisible).map((task) => {
            // Style spécial pour intervention extérieure
            const isExternal = task.isExternalIntervention;
            // Distinction visuelle : tâche avec projet vs tâche orpheline
            const isOrphan = !task.projectId;
            const baseClass = isExternal
              ? "bg-red-100 text-red-900 border-red-400 border-2"
              : isOrphan
                ? "bg-slate-100 text-slate-800 border-slate-400"
                : getPriorityColor(task.priority);

            return (
              <div
                key={task.id}
                draggable
                onDragStart={() => onDragStart(task, userId)}
                onDragEnd={onDragEnd}
                onClick={() => onTaskClick(task)}
                className={`rounded border cursor-move hover:shadow-md transition ${baseClass} ${viewMode === "month" ? "text-[7px] p-0.5" : "text-xs p-2"}`}
              >
                {viewMode === "month" ? (
                  <div className="text-center" title={task.title}>
                    <span>{getStatusIcon(task.status)}</span>
                    {isExternal && (
                      <div className="text-[6px] font-bold">
                        {t("dayCell.externalShort")}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-start space-x-1">
                      <span className="text-xs">
                        {getStatusIcon(task.status)}
                      </span>
                      <span className="flex-1 font-medium line-clamp-2">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {!isOrphan && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-500">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${getStatusDotColor(task.status)}`}
                          />
                          {tCommon(`taskStatus.${task.status}`)}
                        </span>
                      )}
                      {task.project && (
                        <span className="text-[9px] text-gray-400 truncate">
                          — {task.project.name}
                        </span>
                      )}
                    </div>
                    {isExternal && (
                      <div className="text-[10px] font-bold text-red-800 mt-1">
                        🔴 {t("dayCell.externalIntervention")}
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-[10px] text-gray-600 mt-1">
                      {(task.startTime || task.endTime) && (
                        <span>
                          🕐 {task.startTime || "--:--"} -{" "}
                          {task.endTime || "--:--"}
                        </span>
                      )}
                      {task.estimatedHours && (
                        <span>⏱️ {task.estimatedHours}h</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

        {/* Predefined Task Assignments - masquées si congé, jour férié, ou événement toute la journée.
            Les assignations externes sont filtrées par showExternalIntervention. */}
        {!leaveVisible &&
          !cell.isHoliday &&
          !hasAllDayEvent &&
          cell.predefinedTaskAssignments
            .filter((assignment) => {
              const pt = assignment.predefinedTask;
              if (!pt) return false;
              if (pt.isExternalIntervention && !showExternalIntervention)
                return false;
              return true;
            })
            .map((assignment) => {
              const pt = assignment.predefinedTask;
              if (!pt) return null;
              const isExternal = pt.isExternalIntervention;
              return (
                <div
                  key={assignment.id}
                  onClick={() => onPredefinedTaskClick(assignment, cell.date)}
                  className={`rounded border-2 cursor-pointer hover:shadow-md transition ${viewMode === "month" ? "text-[7px] p-0.5" : "text-xs p-2"}`}
                  style={
                    isExternal
                      ? {
                          borderColor: "#f87171",
                          backgroundColor: "#fee2e2",
                          color: "#7f1d1d",
                        }
                      : {
                          borderColor: pt.color,
                          backgroundColor: `${pt.color}20`,
                          color: pt.color,
                        }
                  }
                >
                  {viewMode === "month" ? (
                    <div className="text-center" title={pt.name}>
                      <span>{isExternal ? "🔴" : pt.icon}</span>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-1">
                      <span className="text-sm flex-shrink-0">
                        {isExternal ? "🔴" : pt.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-1">{pt.name}</p>
                        <p className="text-[10px] opacity-80">
                          {pt.defaultDuration === "TIME_SLOT" &&
                          pt.startTime &&
                          pt.endTime
                            ? `${pt.startTime} - ${pt.endTime}`
                            : assignment.period === "FULL_DAY"
                              ? "Journée"
                              : "Demi-journée"}
                        </p>
                        {isExternal && (
                          <p className="text-[10px] font-bold text-red-800 mt-0.5">
                            🔴 {t("dayCell.externalIntervention")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

        {/* Bouton ajout tâche prédéfinie */}
        {!leaveVisible && !cell.isHoliday && canAssignPredefinedTask && (
          <div className="flex items-center justify-center">
            <button
              onClick={() => onAddPredefinedTask(userId, cell.date)}
              className={`${viewMode === "month" ? "text-[8px] w-4 h-4" : "text-xs px-1.5 py-0.5"} text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition border border-transparent hover:border-blue-300`}
              title="Assigner une tâche prédéfinie"
            >
              {viewMode === "month" ? "+" : "+ Tâche"}
            </button>
          </div>
        )}

        {/* Events - visible uniquement si pas de congé ni jour férié.
            Filtrés : événements standards par showEvent, interventions externes par showExternalIntervention. */}
        {!leaveVisible &&
          !cell.isHoliday &&
          cell.events
            .filter((event) =>
              event.isExternalIntervention
                ? showExternalIntervention
                : showEvent,
            )
            .map((event) => {
              const isExtEvent = event.isExternalIntervention;
              const eventBorderClass = isExtEvent
                ? "border-red-400 bg-red-100 text-red-900"
                : "border-purple-400 bg-purple-100 text-purple-900";
              const eventTimeClass = isExtEvent
                ? "text-red-700"
                : "text-purple-700";

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`rounded border-2 cursor-pointer hover:shadow-md transition ${eventBorderClass} ${viewMode === "month" ? "text-[7px] p-0.5" : "text-xs p-2"}`}
                >
                  {viewMode === "month" ? (
                    <div className="text-center" title={event.title}>
                      <span>{isExtEvent ? "🔴" : "📅"}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start space-x-1">
                        <span className="text-xs">
                          {isExtEvent ? "🔴" : "📅"}
                        </span>
                        <span className="flex-1 font-medium line-clamp-2">
                          {event.title}
                        </span>
                      </div>
                      {isExtEvent && (
                        <div className="text-[10px] font-bold text-red-800 mt-1">
                          {t("dayCell.externalIntervention")}
                        </div>
                      )}
                      <div
                        className={`flex items-center space-x-2 text-[10px] ${eventTimeClass} mt-1`}
                      >
                        {(event.startTime || event.endTime) && (
                          <span>
                            🕐 {event.startTime || "--:--"} -{" "}
                            {event.endTime || "--:--"}
                          </span>
                        )}
                        {event.isAllDay && (
                          <span>📆 {t("dayCell.allDay")}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
};
