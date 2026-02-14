"use client";

import { useState, useRef, useEffect } from "react";
import { Task } from "@/types";
import {
  wouldCreateDateConflict,
  getStatusColorClass,
  getStatusLabel,
} from "@/utils/dependencyValidation";
import { useTranslations } from "next-intl";

interface TaskDependencySelectorProps {
  currentTaskId: string;
  currentTaskStartDate?: string;
  selectedDependencyIds: string[];
  availableTasks: Task[];
  onChange: (dependencyIds: string[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

export function TaskDependencySelector({
  currentTaskId,
  currentTaskStartDate,
  selectedDependencyIds,
  availableTasks,
  onChange,
  disabled = false,
  label,
  placeholder,
}: TaskDependencySelectorProps) {
  const t = useTranslations("tasks.detail.dependencies");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultLabel = label || t("label");
  const defaultPlaceholder = placeholder || t("selectPlaceholder");

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter tasks by search query and exclude current task
  const filteredTasks = availableTasks.filter((task) => {
    if (task.id === currentTaskId) return false;
    const title = task.title.toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query);
  });

  // Get selected tasks
  const selectedTasks = availableTasks.filter((t) =>
    selectedDependencyIds.includes(t.id),
  );

  const toggleTask = (taskId: string) => {
    if (selectedDependencyIds.includes(taskId)) {
      onChange(selectedDependencyIds.filter((id) => id !== taskId));
    } else {
      onChange([...selectedDependencyIds, taskId]);
    }
  };

  const removeTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedDependencyIds.filter((id) => id !== taskId));
  };

  return (
    <div className="relative" ref={containerRef}>
      {defaultLabel && (
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {defaultLabel}
        </label>
      )}

      {/* Selection field with tags */}
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={`
          min-h-[42px] w-full px-3 py-2 border rounded-lg
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-text"}
          ${isOpen ? "ring-2 ring-blue-500 border-transparent" : "border-gray-300"}
          flex flex-wrap items-center gap-1
        `}
      >
        {/* Selected task tags */}
        {selectedTasks.map((task) => {
          const hasConflict = wouldCreateDateConflict(
            currentTaskStartDate,
            task,
          );
          return (
            <span
              key={task.id}
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm
                ${hasConflict ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}
              `}
            >
              {hasConflict && (
                <svg
                  className="w-3 h-3 text-amber-600"
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
              <span className="max-w-[150px] truncate">{task.title}</span>
              {!disabled && (
                <button
                  onClick={(e) => removeTask(task.id, e)}
                  className={`ml-1 ${hasConflict ? "text-amber-600 hover:text-amber-800" : "text-blue-600 hover:text-blue-800"}`}
                >
                  <svg
                    className="w-3 h-3"
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
              )}
            </span>
          );
        })}

        {/* Search input */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={
              selectedTasks.length === 0 ? defaultPlaceholder : ""
            }
            className="flex-1 min-w-[150px] outline-none bg-transparent text-gray-900 placeholder-gray-500"
          />
        )}

        {selectedTasks.length === 0 && disabled && (
          <span className="text-gray-500 text-sm">
            {t("../../sections.noDependencies")}
          </span>
        )}
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {searchQuery ? t("noTaskFound") : t("noTaskAvailable")}
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = selectedDependencyIds.includes(task.id);
              const hasConflict = wouldCreateDateConflict(
                currentTaskStartDate,
                task,
              );

              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2 cursor-pointer
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                  `}
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"}
                    `}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </span>
                      {hasConflict && (
                        <span title={t("dateConflict")}>
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
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColorClass(task.status)}`}
                      >
                        {getStatusLabel(task.status)}
                      </span>
                      {task.endDate && (
                        <span className="text-xs text-gray-500">
                          {t("endLabel")}{" "}
                          {new Date(task.endDate).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Helper text */}
      <p className="mt-1 text-xs text-gray-500">{t("helperText")}</p>
    </div>
  );
}
