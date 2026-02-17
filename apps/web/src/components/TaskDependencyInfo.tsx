"use client";

import { useEffect, useRef } from "react";
import { Task } from "@/types";
import {
  detectDateConflicts,
  getStatusColorClass,
  getStatusLabel,
} from "@/utils/dependencyValidation";
import { useTranslations } from "next-intl";

interface TaskDependencyInfoProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onEdit: () => void;
  onNavigate: (taskId: string) => void;
}

export function TaskDependencyInfo({
  task,
  allTasks,
  onClose,
  onEdit,
  onNavigate,
}: TaskDependencyInfoProps) {
  const t = useTranslations("tasks.detail");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Get dependencies (tasks this task depends on)
  const dependencies = task.dependencies || [];

  // Get dependents (tasks that depend on this task)
  const dependents = allTasks.filter((t) =>
    t.dependencies?.some((d) => d.dependsOnTaskId === task.id),
  );

  // Check for date conflicts
  const conflicts = detectDateConflicts(task, dependencies);
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25">
      <div
        ref={popoverRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-[400px] max-h-[500px] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {task.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColorClass(task.status)}`}
                >
                  {getStatusLabel(task.status)}
                </span>
                {task.startDate && task.endDate && (
                  <span className="text-xs text-gray-500">
                    {new Date(task.startDate).toLocaleDateString("fr-FR")} -{" "}
                    {new Date(task.endDate).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg
                className="w-5 h-5"
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
        </div>

        {/* Content */}
        <div className="px-4 py-3 max-h-[350px] overflow-y-auto">
          {/* Date conflict warning */}
          {hasConflicts && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>
                  {conflicts.length}{" "}
                  {t("dependencies.conflictCount", {
                    count: conflicts.length,
                  }).replace(/^\d+\s/, "")}
                </span>
              </div>
            </div>
          )}

          {/* Dependencies section */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
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
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
              {t("dependencies.dependsOn", { count: dependencies.length })}
            </h4>
            {dependencies.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                {t("sections.noDependencies")}
              </p>
            ) : (
              <div className="space-y-1">
                {dependencies.map((dep) => {
                  const depTask = dep.dependsOnTask;
                  const conflict = conflicts.find(
                    (c) => c.dependencyTaskId === depTask?.id,
                  );
                  return (
                    <div
                      key={dep.dependsOnTaskId}
                      onClick={() => depTask && onNavigate(depTask.id)}
                      className={`
                        flex items-center justify-between p-2 rounded cursor-pointer
                        ${conflict ? "bg-amber-50 hover:bg-amber-100" : "bg-gray-50 hover:bg-gray-100"}
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {conflict && (
                          <svg
                            className="w-4 h-4 text-amber-500 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        )}
                        <span className="text-sm text-gray-900 truncate">
                          {depTask?.title || t("sections.deletedTask")}
                        </span>
                      </div>
                      {depTask && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColorClass(depTask.status)}`}
                        >
                          {getStatusLabel(depTask.status)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dependents section */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
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
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
              {t("dependencies.blocks", { count: dependents.length })}
            </h4>
            {dependents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                {t("dependencies.noDependents")}
              </p>
            ) : (
              <div className="space-y-1">
                {dependents.map((depTask) => (
                  <div
                    key={depTask.id}
                    onClick={() => onNavigate(depTask.id)}
                    className="flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <span className="text-sm text-gray-900 truncate">
                      {depTask.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColorClass(depTask.status)}`}
                    >
                      {getStatusLabel(depTask.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => onNavigate(task.id)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {t("dependencies.viewDetails")}
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            {t("dependencies.modifyTitle")}
          </button>
        </div>
      </div>
    </div>
  );
}
