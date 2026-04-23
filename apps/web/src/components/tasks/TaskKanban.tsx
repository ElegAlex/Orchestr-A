"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { tasksService } from "@/services/tasks.service";
import { getTaskProgress } from "@/lib/task-progress";
import type { Task, TaskStatus } from "@/types";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TaskKanbanProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAfterStatusChange?: () => void | Promise<void>;
  hiddenStatuses?: TaskStatus[];
  showProjectBadge?: boolean;
  showOverdueBadge?: boolean;
  showStatusArrows?: boolean;
}

// ─── Helpers (local — copied/adapted from tasks/page.tsx l.273-292) ──────────

function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "NORMAL":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "LOW":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getPriorityLabel(
  priority: string,
  t: (key: string) => string,
): string {
  return t(`priority.${priority}`);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_COLUMNS: Array<{ status: TaskStatus; color: string }> = [
  { status: "TODO" as TaskStatus, color: "bg-gray-100" },
  { status: "IN_PROGRESS" as TaskStatus, color: "bg-blue-100" },
  { status: "IN_REVIEW" as TaskStatus, color: "bg-yellow-100" },
  { status: "DONE" as TaskStatus, color: "bg-green-100" },
  { status: "BLOCKED" as TaskStatus, color: "bg-red-100" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function TaskKanban({
  tasks,
  onTaskClick,
  onAfterStatusChange,
  hiddenStatuses,
  showProjectBadge = false,
  showOverdueBadge = false,
  showStatusArrows = false,
}: TaskKanbanProps) {
  const t = useTranslations("tasks");
  const locale = useLocale();

  // DnD state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Filtered + titled columns
  const columns = useMemo(
    () =>
      ALL_COLUMNS.filter((c) => !(hiddenStatuses ?? []).includes(c.status)).map(
        (c) => ({
          ...c,
          title: t(`kanban.columns.${c.status}`),
        }),
      ),
    [hiddenStatuses, t],
  );

  // Sorted tasks
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) =>
        a.title.localeCompare(b.title, locale, { sensitivity: "base" }),
      ),
    [tasks, locale],
  );

  const getTasksByStatus = (status: TaskStatus) =>
    sortedTasks.filter((task) => task.status === status);

  // ─── DnD Handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent<HTMLElement>, task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
    setIsDragging(false);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    status: TaskStatus,
  ) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    newStatus: TaskStatus,
  ) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedTask && draggedTask.status !== newStatus) {
      try {
        await tasksService.update(draggedTask.id, { status: newStatus });
        toast.success(t("kanban.messages.statusUpdateSuccess"));
        await onAfterStatusChange?.();
      } catch {
        toast.error(t("kanban.messages.statusUpdateError"));
      }
    }
    setDraggedTask(null);
    setIsDragging(false);
  };

  // ─── Arrow navigation ──────────────────────────────────────────────────────

  const handleArrowStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      await tasksService.update(task.id, { status: newStatus });
      toast.success(t("kanban.messages.statusUpdateSuccess"));
      await onAfterStatusChange?.();
    } catch {
      toast.error(t("kanban.messages.statusUpdateError"));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-5 gap-4">
      {columns.map((column) => {
        const isDropTarget = dragOverColumn === column.status;
        const columnTasks = getTasksByStatus(column.status);
        const colIdx = columns.findIndex((c) => c.status === column.status);

        return (
          <div
            key={column.status}
            data-testid={`kanban-column-${column.status}`}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
            className={[
              "min-w-0 rounded-lg shadow-sm border transition-colors",
              isDropTarget
                ? "bg-blue-50 border-2 border-dashed border-blue-400"
                : "bg-white border-gray-200",
            ].join(" ")}
          >
            {/* Column header */}
            <div
              className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-gray-700">
                  {column.title}
                </h2>
                <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  {t("kanban.noTasks")}
                </p>
              ) : (
                columnTasks.map((task) => {
                  const progress = getTaskProgress(task.status);
                  const isOverdue =
                    showOverdueBadge &&
                    !!task.endDate &&
                    new Date(task.endDate) < new Date() &&
                    task.status !== "DONE";

                  return (
                    <article
                      key={task.id}
                      data-testid={`kanban-card-${task.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (!isDragging) onTaskClick(task);
                      }}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-move active:cursor-grabbing select-none"
                    >
                      {/* Title + priority badge */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm flex-1">
                          {task.title}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityBadgeColor(task.priority)}`}
                        >
                          {getPriorityLabel(task.priority, t)}
                        </span>
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Project badge */}
                      {showProjectBadge && (
                        <div className="text-xs text-gray-500 mb-2">
                          {task.projectId
                            ? (task.project?.name ?? "")
                            : t("kanban.orphanTask")}
                        </div>
                      )}

                      {/* Overdue badge */}
                      {isOverdue && (
                        <div className="flex items-center space-x-1 text-xs text-red-600 font-medium mb-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>{t("kanban.overdue")}</span>
                        </div>
                      )}

                      {/* Assignees meta */}
                      <div className="text-xs text-gray-500 mb-1">
                        {t("kanban.assignees", {
                          count: task.assignees?.length ?? 0,
                        })}
                      </div>

                      {/* Estimated hours */}
                      {task.estimatedHours && task.estimatedHours > 0 && (
                        <div className="text-xs text-gray-500">
                          {t("kanban.estimatedHours", {
                            hours: task.estimatedHours,
                          })}
                        </div>
                      )}

                      {/* Progress bar */}
                      {progress > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{t("kanban.progress")}</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status arrows */}
                      {showStatusArrows && (
                        <div className="mt-3 flex space-x-1">
                          {colIdx > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const prevCol = columns[colIdx - 1];
                                if (prevCol) {
                                  handleArrowStatus(task, prevCol.status);
                                }
                              }}
                              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition"
                            >
                              ←
                            </button>
                          )}
                          {colIdx < columns.length - 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextCol = columns[colIdx + 1];
                                if (nextCol) {
                                  handleArrowStatus(task, nextCol.status);
                                }
                              }}
                              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition"
                            >
                              →
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
