"use client";

import { useState } from "react";
import { Task, TaskStatus } from "@/types";
import { TaskLineCard } from "./TaskLineCard";
import { useTranslations } from "next-intl";

interface TaskListViewProps {
  tasks: Task[];
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
  showProject?: boolean;
}

const statusConfig: {
  status: TaskStatus;
  colorDot: string;
  colorBg: string;
}[] = [
  {
    status: TaskStatus.TODO,
    colorDot: "bg-gray-400",
    colorBg: "bg-gray-50",
  },
  {
    status: TaskStatus.IN_PROGRESS,
    colorDot: "bg-blue-500",
    colorBg: "bg-blue-50",
  },
  {
    status: TaskStatus.IN_REVIEW,
    colorDot: "bg-yellow-500",
    colorBg: "bg-yellow-50",
  },
  {
    status: TaskStatus.DONE,
    colorDot: "bg-green-500",
    colorBg: "bg-green-50",
  },
  {
    status: TaskStatus.BLOCKED,
    colorDot: "bg-red-500",
    colorBg: "bg-red-50",
  },
];

export function TaskListView({
  tasks,
  onStatusChange,
  onTaskClick,
  showProject = false,
}: TaskListViewProps) {
  const t = useTranslations("tasks");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (status: string) => {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  return (
    <div className="space-y-3">
      {statusConfig.map(({ status, colorDot, colorBg }) => {
        const sectionTasks = tasks.filter((task) => task.status === status);
        const isCollapsed = collapsed[status] || false;

        return (
          <div
            key={status}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Section header */}
            <button
              onClick={() => toggleSection(status)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 ${colorBg} hover:opacity-80 transition`}
            >
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <div className={`w-2.5 h-2.5 rounded-full ${colorDot}`} />
              <span className="font-medium text-sm text-gray-900">
                {t(`status.${status}`, { defaultValue: status })}
              </span>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                {sectionTasks.length}
              </span>
            </button>

            {/* Section content */}
            {!isCollapsed && sectionTasks.length > 0 && (
              <div className="p-2 space-y-1.5">
                {sectionTasks.map((task) => (
                  <TaskLineCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onClick={onTaskClick}
                    showProject={showProject}
                  />
                ))}
              </div>
            )}

            {!isCollapsed && sectionTasks.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">
                {t("noTasks", { defaultValue: "Aucune tâche" })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
