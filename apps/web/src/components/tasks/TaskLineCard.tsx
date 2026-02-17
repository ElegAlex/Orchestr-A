"use client";

import { Task, TaskStatus, Priority } from "@/types";
import { useTranslations } from "next-intl";

interface TaskLineCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onDelete?: (taskId: string) => void;
  onDateChange?: (
    taskId: string,
    field: "startDate" | "endDate",
    value: string,
  ) => void;
  onClick?: (task: Task) => void;
  showProject?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const statusColumns: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
  TaskStatus.BLOCKED,
];

export function TaskLineCard({
  task,
  onStatusChange,
  onDelete,
  onDateChange,
  onClick,
  showProject = false,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TaskLineCardProps) {
  const t = useTranslations("tasks");

  const getPriorityBadgeColor = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return "bg-red-100 text-red-800";
      case Priority.HIGH:
        return "bg-orange-100 text-orange-800";
      case Priority.NORMAL:
        return "bg-blue-100 text-blue-800";
      case Priority.LOW:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const toDateInput = (iso?: string) => {
    if (!iso) return "";
    return iso.slice(0, 10);
  };

  const currentIndex = statusColumns.indexOf(task.status);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < statusColumns.length - 2; // Don't move to BLOCKED

  return (
    <div
      onClick={() => onClick?.(task)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:shadow-md transition cursor-pointer ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Row 1 */}
      <div className="flex items-center gap-3">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getPriorityBadgeColor(task.priority)}`}
        >
          {t(`priority.${task.priority}`, { defaultValue: task.priority })}
        </span>
        <h4 className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">
          {task.title}
        </h4>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-1 shrink-0">
            {task.assignees.slice(0, 3).map((a, idx) => (
              <div
                key={a.userId || idx}
                className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] border border-white"
                title={`${a.user?.firstName || ""} ${a.user?.lastName || ""}`}
              >
                {a.user?.firstName?.[0] || "?"}
                {a.user?.lastName?.[0] || ""}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] border border-white">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}

        {task.estimatedHours && (
          <span className="text-xs text-gray-500 shrink-0">
            ⏱️ {task.estimatedHours}h
          </span>
        )}

        {/* Inline dates */}
        <div className="flex items-center gap-1 shrink-0 hidden sm:flex">
          <input
            type="date"
            value={toDateInput(task.startDate)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (onDateChange && e.target.value) {
                onDateChange(task.id, "startDate", e.target.value);
              }
            }}
            className="text-xs text-gray-500 border border-gray-200 rounded px-1 py-0.5 w-[110px] hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            title="Date de début"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={toDateInput(task.endDate)}
            min={toDateInput(task.startDate)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (onDateChange && e.target.value) {
                onDateChange(task.id, "endDate", e.target.value);
              }
            }}
            className="text-xs text-gray-500 border border-gray-200 rounded px-1 py-0.5 w-[110px] hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            title="Date de fin"
          />
        </div>

        {task.progress > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 w-20 hidden md:flex">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{task.progress}%</span>
          </div>
        )}

        {/* Status change buttons */}
        {onStatusChange && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canMoveLeft && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, statusColumns[currentIndex - 1]);
                }}
                className="text-xs px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 rounded transition"
              >
                ←
              </button>
            )}
            {canMoveRight && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, statusColumns[currentIndex + 1]);
                }}
                className="text-xs px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 rounded transition"
              >
                →
              </button>
            )}
          </div>
        )}

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Supprimer cette tâche ?")) {
                onDelete(task.id);
              }
            }}
            className="shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
            title="Supprimer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: description + milestone + project */}
      {(task.description ||
        task.milestone ||
        (showProject &&
          (task as Task & { project?: { name: string } }).project)) && (
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          {showProject &&
            (task as Task & { project?: { name: string } }).project && (
              <span className="shrink-0">
                📁{" "}
                {(task as Task & { project?: { name: string } }).project!.name}
              </span>
            )}
          {task.milestone && (
            <span className="shrink-0">🏁 {task.milestone.name}</span>
          )}
          {task.description && (
            <span className="truncate min-w-0">{task.description}</span>
          )}
        </div>
      )}
    </div>
  );
}
