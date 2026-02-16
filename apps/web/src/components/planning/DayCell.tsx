import { Task } from "@/types";
import { Event } from "@/services/events.service";
import { DayCell as DayCellData } from "@/hooks/usePlanningData";
import {
  getPriorityColor,
  getStatusIcon,
} from "@/lib/planning-utils";
import { isToday, getDay } from "date-fns";
import { useTranslations } from "next-intl";

interface DayCellProps {
  cell: DayCellData;
  userId: string;
  viewMode: "week" | "month";
  dayIndex: number;
  onTeleworkToggle: (userId: string, date: Date) => void;
  onDragStart: (task: Task, sourceUserId: string) => void;
  onDragEnd: () => void;
  onDrop: (userId: string, date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: Event) => void;
}

export const DayCell = ({
  cell,
  userId,
  viewMode,
  dayIndex,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
}: DayCellProps) => {
  const t = useTranslations("planning");
  const hasLeave = cell.leaves.length > 0;
  const isMonday = getDay(cell.date) === 1;
  const isFirstDay = dayIndex === 0;
  const showWeekSeparator = viewMode === "month" && isMonday && !isFirstDay;

  // Prendre le premier congé (le plus pertinent)
  const leave = cell.leaves[0];
  const isPending = leave?.status === "PENDING";

  // Déterminer le background
  let bgClass = "";
  if (cell.isHoliday) {
    bgClass = "bg-red-50";
  } else if (isToday(cell.date)) {
    bgClass = "bg-blue-50";
  }

  return (
    <td
      key={cell.date.toISOString()}
      className={`align-top relative ${viewMode === "month" ? "px-0.5 py-1" : "px-2 py-2"} ${bgClass} ${showWeekSeparator ? "border-l-2 border-l-indigo-400" : ""}`}
      style={{ verticalAlign: "top" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(userId, cell.date)}
      title={cell.isHoliday ? cell.holidayName : undefined}
    >
      {/* Holiday Overlay - couvre toute la cellule */}
      {cell.isHoliday && !hasLeave && (
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
      {hasLeave && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${
            isPending
              ? "bg-green-100/70 border-2 border-dashed border-green-300"
              : "bg-green-200/90 border-2 border-green-400"
          }`}
          title={`${t(`leaveTypes.${leave.type}`)}${isPending ? ` (${t("dayCell.pendingValidation")})` : ` (${t("dayCell.validated")})`}`}
        >
          <span className={`${viewMode === "month" ? "text-lg" : "text-2xl"}`}>
            🌴
          </span>
          {viewMode === "week" && (
            <>
              <span className="font-medium text-green-800 text-xs">
                {t(`leaveTypes.${leave.type}`)}
              </span>
              {isPending && (
                <span className="text-[10px] text-green-600 italic">
                  {t("dayCell.pending")}
                </span>
              )}
            </>
          )}
          {viewMode === "month" && isPending && (
            <span className="text-[8px] text-green-600">?</span>
          )}
        </div>
      )}

      {/* External Intervention Background Overlay */}
      {cell.isExternalIntervention && !hasLeave && !cell.isHoliday && (
        <div
          className="absolute inset-0 z-0 bg-red-100/40 border-2 border-red-400 rounded-sm pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Telework Background Overlay - en arrière-plan pour que les tâches restent visibles */}
      {cell.isTelework && !hasLeave && !cell.isHoliday && !cell.isExternalIntervention && (
        <div
          className="absolute inset-0 z-0 bg-orange-100/40 border-2 border-orange-300 rounded-sm pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div
        className={`relative z-10 space-y-1 ${viewMode === "month" ? "min-h-[40px]" : "min-h-[60px]"}`}
      >
        {/* Telework toggle - visible uniquement si pas de congé */}
        {!hasLeave && (
          <div className="flex items-center justify-center">
            <button
              onClick={() => onTeleworkToggle(userId, cell.date)}
              className={`${viewMode === "month" ? "text-[10px]" : "text-lg"} transition ${
                cell.isTelework ? "opacity-100" : "opacity-30 hover:opacity-60"
              }`}
              title={cell.isTelework ? t("telework.label") : t("telework.office")}
            >
              {cell.isTelework ? "🏠" : "🏢"}
            </button>
          </div>
        )}

        {/* Tasks - visible uniquement si pas de congé */}
        {!hasLeave &&
          cell.tasks.map((task) => {
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
                      <div className="text-[6px] font-bold">{t("dayCell.externalShort")}</div>
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

        {/* Events - visible uniquement si pas de congé */}
        {!hasLeave &&
          cell.events.map((event) => {
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
                      <span className="text-xs">{isExtEvent ? "🔴" : "📅"}</span>
                      <span className="flex-1 font-medium line-clamp-2">
                        {event.title}
                      </span>
                    </div>
                    {isExtEvent && (
                      <div className="text-[10px] font-bold text-red-800 mt-1">
                        {t("dayCell.externalIntervention")}
                      </div>
                    )}
                    <div className={`flex items-center space-x-2 text-[10px] ${eventTimeClass} mt-1`}>
                      {(event.startTime || event.endTime) && (
                        <span>
                          🕐 {event.startTime || "--:--"} -{" "}
                          {event.endTime || "--:--"}
                        </span>
                      )}
                      {event.isAllDay && <span>📆 {t("dayCell.allDay")}</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </td>
  );
};
