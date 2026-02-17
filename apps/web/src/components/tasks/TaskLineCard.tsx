"use client";

import { Task, TaskStatus, Priority } from "@/types";
import { useTranslations } from "next-intl";

interface TaskLineCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onClick?: (task: Task) => void;
  showProject?: boolean;
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
  onClick,
  showProject = false,
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

  const currentIndex = statusColumns.indexOf(task.status);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < statusColumns.length - 2; // Don't move to BLOCKED

  return (
    <div
      onClick={() => onClick?.(task)}
      className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:shadow-md transition cursor-pointer"
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

        {task.progress > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 w-20">
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
      </div>

      {/* Row 2: description + milestone + project */}
      {(task.description ||
        task.milestone ||
        (showProject && (task as Task & { project?: { name: string } }).project)) && (
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          {showProject &&
            (task as Task & { project?: { name: string } }).project && (
              <span className="shrink-0">
                📁 {(task as Task & { project?: { name: string } }).project!.name}
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
