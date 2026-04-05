"use client";

import { useMemo } from "react";
import { Milestone, Task, MilestoneStatus, TaskStatus } from "@/types";
import { MilestoneCard } from "./MilestoneCard";
import { useTranslations } from "next-intl";

interface MilestoneRoadmapProps {
  milestones: Milestone[];
  tasks: Task[];
  onCreateMilestone?: () => void;
  onEditMilestone?: (milestone: Milestone) => void;
  onCreateTask?: () => void;
  onTaskUpdate?: () => void;
  onImportMilestones?: () => void;
  onExportCsv?: () => void;
}

export function MilestoneRoadmap({
  milestones,
  tasks,
  onCreateMilestone,
  onEditMilestone,
  onCreateTask,
  onTaskUpdate,
  onImportMilestones,
  onExportCsv,
}: MilestoneRoadmapProps) {
  const t = useTranslations("projects");

  // Trier les jalons par date de début
  const sortedMilestones = useMemo(() => {
    return [...milestones].sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });
  }, [milestones]);

  // Calculer les métriques
  const metrics = useMemo(() => {
    const totalMilestones = milestones.length;

    // Calculer le statut de chaque jalon basé sur ses tâches
    const milestonesWithStatus = milestones.map((milestone) => {
      const milestoneTasks = tasks.filter(
        (t) => t.milestoneId === milestone.id,
      );

      if (milestoneTasks.length === 0) {
        return { milestone, status: MilestoneStatus.PENDING };
      }

      const completedTasks = milestoneTasks.filter(
        (t) => t.status === TaskStatus.DONE,
      );
      const inProgressTasks = milestoneTasks.filter(
        (t) =>
          t.status === TaskStatus.IN_PROGRESS ||
          t.status === TaskStatus.IN_REVIEW,
      );

      if (completedTasks.length === milestoneTasks.length) {
        return { milestone, status: MilestoneStatus.COMPLETED };
      }
      if (inProgressTasks.length > 0 || completedTasks.length > 0) {
        return { milestone, status: MilestoneStatus.IN_PROGRESS };
      }
      return { milestone, status: MilestoneStatus.PENDING };
    });

    const completed = milestonesWithStatus.filter(
      (m) => m.status === MilestoneStatus.COMPLETED,
    ).length;
    const inProgress = milestonesWithStatus.filter(
      (m) => m.status === MilestoneStatus.IN_PROGRESS,
    ).length;

    return {
      total: totalMilestones,
      completed,
      inProgress,
      totalTasks: tasks.length,
    };
  }, [milestones, tasks]);

  // Regrouper les tâches par jalon
  const getTasksForMilestone = (milestoneId: string) => {
    return tasks.filter((t) => t.milestoneId === milestoneId);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec titre et actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <span>🗺️</span>
            <span>{t("milestoneRoadmap.title")}</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t("milestoneRoadmap.description")}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              {t("milestoneRoadmap.newTask")}
            </button>
          )}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              Export CSV
            </button>
          )}
          {onImportMilestones && (
            <button
              onClick={onImportMilestones}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              {t("milestoneRoadmap.importCSV")}
            </button>
          )}
          {onCreateMilestone && (
            <button
              onClick={onCreateMilestone}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              {t("milestoneRoadmap.newMilestone")}
            </button>
          )}
        </div>
      </div>

      {/* Métriques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("milestoneRoadmap.metrics.milestones")}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.total}
              </p>
            </div>
            <div className="text-3xl">🎯</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("milestoneRoadmap.metrics.completed")}
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {metrics.completed}
              </p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("milestoneRoadmap.metrics.inProgress")}
              </p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {metrics.inProgress}
              </p>
            </div>
            <div className="text-3xl">🔄</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t("milestoneRoadmap.metrics.tasks")}
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {metrics.totalTasks}
              </p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
        </div>
      </div>

      {/* Liste des jalons */}
      {sortedMilestones.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-16">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-gray-500 text-lg mb-4">
            {t("milestoneRoadmap.emptyState.title")}
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {t("milestoneRoadmap.emptyState.description")}
          </p>
          {onCreateMilestone && (
            <button
              onClick={onCreateMilestone}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              {t("milestoneRoadmap.emptyState.createButton")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMilestones.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              tasks={getTasksForMilestone(milestone.id)}
              onEdit={
                onEditMilestone ? () => onEditMilestone(milestone) : undefined
              }
              onTaskUpdate={onTaskUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
