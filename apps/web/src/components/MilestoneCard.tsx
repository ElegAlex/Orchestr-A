"use client";

import { useState } from "react";
import { Milestone, Task, MilestoneStatus, TaskStatus } from "@/types";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { tasksService } from "@/services/tasks.service";
import toast from "react-hot-toast";

interface MilestoneCardProps {
  milestone: Milestone;
  tasks: Task[];
  onEdit?: () => void;
  onTaskUpdate?: () => void;
}

export function MilestoneCard({
  milestone,
  tasks,
  onEdit,
  onTaskUpdate,
}: MilestoneCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('projects.detail.milestones');
  const tTask = useTranslations('tasks.status');
  const tProjects = useTranslations('projects.messages');
  const tProjectTasks = useTranslations('projects.detail.tasks');

  // Handler pour changer le statut d'une tâche
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(taskId);
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t('taskStatusUpdated'));
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        error.response?.data?.message || tProjects('statusUpdateError'),
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Helper pour obtenir le style et label du statut
  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return {
          label: tTask('DONE'),
          bgClass: "bg-green-100",
          textClass: "text-green-800",
        };
      case TaskStatus.IN_PROGRESS:
        return {
          label: tTask('IN_PROGRESS'),
          bgClass: "bg-blue-100",
          textClass: "text-blue-800",
        };
      case TaskStatus.IN_REVIEW:
        return {
          label: tTask('IN_REVIEW'),
          bgClass: "bg-yellow-100",
          textClass: "text-yellow-800",
        };
      case TaskStatus.BLOCKED:
        return {
          label: tTask('BLOCKED'),
          bgClass: "bg-red-100",
          textClass: "text-red-800",
        };
      default:
        return {
          label: tTask('TODO'),
          bgClass: "bg-gray-100",
          textClass: "text-gray-800",
        };
    }
  };

  // Calculer le statut automatiquement depuis les tâches
  const getAutoStatus = (): {
    status: MilestoneStatus;
    label: string;
    color: string;
  } => {
    if (tasks.length === 0) {
      return {
        status: MilestoneStatus.PENDING,
        label: t('status.pending'),
        color: "#9e9e9e",
      };
    }

    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE);
    const inProgressTasks = tasks.filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.IN_REVIEW,
    );

    if (completedTasks.length === tasks.length) {
      return {
        status: MilestoneStatus.COMPLETED,
        label: t('status.completed'),
        color: "#4caf50",
      };
    }
    if (inProgressTasks.length > 0 || completedTasks.length > 0) {
      return {
        status: MilestoneStatus.IN_PROGRESS,
        label: t('status.inProgress'),
        color: "#ff9800",
      };
    }
    return {
      status: MilestoneStatus.PENDING,
      label: t('status.pending'),
      color: "#9e9e9e",
    };
  };

  const statusConfig = getAutoStatus();
  const progressPercent =
    tasks.length > 0
      ? Math.round(
          (tasks.filter((t) => t.status === TaskStatus.DONE).length /
            tasks.length) *
            100,
        )
      : 0;

  // Obtenir les contributeurs uniques
  const contributors = Array.from(
    new Set(tasks.map((t) => t.assignee).filter(Boolean)),
  ).slice(0, 3);

  return (
    <div
      className="bg-white rounded-lg shadow-sm border-l-8 border border-gray-200 hover:shadow-md transition-all"
      style={{ borderLeftColor: statusConfig.color }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1">
            <span className="text-2xl">🚩</span>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-lg">
                {milestone.name}
              </h3>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title={t('editMilestone')}
              >
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {milestone.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {milestone.description}
          </p>
        )}

        {/* Dates */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <span>📅</span>
            <span>
              {milestone.dueDate
                ? new Date(milestone.dueDate).toLocaleDateString(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : t('noDate')}
            </span>
          </div>
        </div>

        {/* Tâches et contributeurs */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            {t('taskCount', { count: tasks.length })}
          </div>
          {contributors.length > 0 && (
            <div className="flex -space-x-2">
              {contributors.map((contributor, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold border-2 border-white"
                  title={`${contributor?.firstName} ${contributor?.lastName}`}
                >
                  {contributor?.firstName?.[0]}
                  {contributor?.lastName?.[0]}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barre de progression */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{t('progress')}</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: statusConfig.color,
              }}
            ></div>
          </div>
        </div>

        {/* Bouton expansion */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center space-x-2 text-sm text-gray-600 hover:text-gray-900 py-2 hover:bg-gray-50 rounded-lg transition"
        >
          <span>
            {isExpanded ? "▲" : "▼"} {isExpanded ? t('hide') : t('show')}{" "}
            {t('taskCount', { count: tasks.length })}
          </span>
        </button>

        {/* Tâches (collapsible) */}
        {isExpanded && (
          <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {t('noTasks')}
              </p>
            ) : (
              tasks.map((task) => {
                const statusConfig = getStatusConfig(task.status);
                return (
                  <div
                    key={task.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs">
                          {task.status === TaskStatus.DONE ? "✅" : "☐"}
                        </span>
                        <span
                          className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => router.push(`/${locale}/tasks/${task.id}`)}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.estimatedHours && (
                        <div className="text-xs text-gray-500 ml-5 mt-1">
                          {tProjectTasks('estimatedHours', { hours: task.estimatedHours })}
                        </div>
                      )}
                    </div>
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(
                          task.id,
                          e.target.value as TaskStatus,
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      disabled={updatingTaskId === task.id}
                      className={`px-3 py-1.5 rounded text-xs font-medium border-0 cursor-pointer transition focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${statusConfig.bgClass} ${statusConfig.textClass}`}
                    >
                      <option
                        value={TaskStatus.TODO}
                        className="bg-white text-gray-800"
                      >
                        {tTask('TODO')}
                      </option>
                      <option
                        value={TaskStatus.IN_PROGRESS}
                        className="bg-white text-gray-800"
                      >
                        {tTask('IN_PROGRESS')}
                      </option>
                      <option
                        value={TaskStatus.IN_REVIEW}
                        className="bg-white text-gray-800"
                      >
                        {tTask('IN_REVIEW')}
                      </option>
                      <option
                        value={TaskStatus.BLOCKED}
                        className="bg-white text-gray-800"
                      >
                        {tTask('BLOCKED')}
                      </option>
                      <option
                        value={TaskStatus.DONE}
                        className="bg-white text-gray-800"
                      >
                        {tTask('DONE')}
                      </option>
                    </select>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
