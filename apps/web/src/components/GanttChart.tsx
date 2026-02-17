"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Gantt, Task, ViewMode } from "@rsagiev/gantt-task-react-19";
import "@rsagiev/gantt-task-react-19/dist/index.css";
import "../gantt-custom.css";
import { Task as FullTask } from "@/types";
import { TaskDependencyInfo } from "./TaskDependencyInfo";
import { TaskDependencyModal } from "./TaskDependencyModal";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

interface GanttTask {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  progress?: number;
  milestoneId?: string;
  dependencies?: { dependsOnTaskId: string }[];
}

interface GanttMilestone {
  id: string;
  name: string;
  dueDate?: string;
  status?: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  projectStartDate?: Date;
  projectEndDate?: Date;
  fullTasks?: FullTask[];
  onDependencyChange?: () => void;
}

export default function GanttChart({
  tasks,
  milestones,
  projectStartDate,
  projectEndDate,
  fullTasks = [],
  onDependencyChange,
}: GanttChartProps) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [ganttTasks, setGanttTasks] = useState<Task[]>([]);
  const [selectedTaskForInfo, setSelectedTaskForInfo] =
    useState<FullTask | null>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] =
    useState<FullTask | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Find full task by gantt task ID
  const findFullTask = useCallback(
    (ganttTaskId: string): FullTask | null => {
      if (!ganttTaskId.startsWith("task-")) return null;
      const realId = ganttTaskId.replace("task-", "");
      return fullTasks.find((t) => t.id === realId) || null;
    },
    [fullTasks],
  );

  // Handle single click - show info popover
  const handleTaskClick = useCallback(
    (task: Task) => {
      // Clear any pending timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }

      // Set a timeout to distinguish single click from double click
      clickTimeoutRef.current = setTimeout(() => {
        const fullTask = findFullTask(task.id);
        if (fullTask) {
          setSelectedTaskForInfo(fullTask);
        }
      }, 250);
    },
    [findFullTask],
  );

  // Handle double click - show edit modal
  const handleTaskDoubleClick = useCallback(
    (task: Task) => {
      // Clear the single click timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }

      const fullTask = findFullTask(task.id);
      if (fullTask) {
        setSelectedTaskForInfo(null); // Close info if open
        setSelectedTaskForModal(fullTask);
      }
    },
    [findFullTask],
  );

  // Navigate to task detail
  const handleNavigate = useCallback(
    (taskId: string) => {
      setSelectedTaskForInfo(null);
      router.push(`/${locale}/tasks/${taskId}`);
    },
    [router, locale],
  );

  // Handle dependency modal save
  const handleDependencySave = useCallback(() => {
    onDependencyChange?.();
  }, [onDependencyChange]);

  useEffect(() => {
    const convertedTasks: Task[] = [];
    const now = new Date();
    const defaultStart = projectStartDate || now;
    const defaultEnd =
      projectEndDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Grouper les tâches par milestone
    const tasksByMilestone = new Map<string, GanttTask[]>();
    const tasksWithoutMilestone: GanttTask[] = [];

    tasks.forEach((task) => {
      if (task.milestoneId) {
        if (!tasksByMilestone.has(task.milestoneId)) {
          tasksByMilestone.set(task.milestoneId, []);
        }
        tasksByMilestone.get(task.milestoneId)!.push(task);
      } else {
        tasksWithoutMilestone.push(task);
      }
    });

    // Fonction pour convertir une tâche
    const convertTask = (task: GanttTask) => {
      const start = task.startDate ? new Date(task.startDate) : defaultStart;
      const end = task.endDate
        ? new Date(task.endDate)
        : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      let backgroundColor = "#3b82f6";
      if (task.status === "DONE") backgroundColor = "#10b981";
      else if (task.status === "IN_PROGRESS") backgroundColor = "#f59e0b";
      else if (task.status === "BLOCKED") backgroundColor = "#ef4444";

      // Mapper les dépendances vers le format attendu par gantt-task-react
      const dependencies =
        task.dependencies?.map((dep) => `task-${dep.dependsOnTaskId}`) || [];

      return {
        id: `task-${task.id}`,
        name: `  ${task.title}`,
        start,
        end,
        type: "task" as const,
        progress: task.progress || 0,
        dependencies,
        styles: {
          backgroundColor,
          backgroundSelectedColor: backgroundColor,
        },
      } as Task;
    };

    // Ajouter milestones avec leurs tâches
    milestones.forEach((milestone) => {
      const dueDate = milestone.dueDate
        ? new Date(milestone.dueDate)
        : defaultEnd;

      // Récupérer les tâches liées à ce milestone
      const milestoneTasks = tasksByMilestone.get(milestone.id) || [];

      // Créer les dépendances du milestone (toutes les tâches qui y sont liées)
      const milestoneDependencies = milestoneTasks.map(
        (task) => `task-${task.id}`,
      );

      // Ajouter le milestone avec ses dépendances
      convertedTasks.push({
        id: `milestone-${milestone.id}`,
        name: `📍 ${milestone.name}`,
        start: dueDate,
        end: dueDate,
        type: "milestone" as const,
        progress: milestone.status === "COMPLETED" ? 100 : 0,
        dependencies: milestoneDependencies,
        styles: {
          backgroundColor: "#10b981",
          backgroundSelectedColor: "#059669",
        },
      } as Task);

      // Ajouter les tâches liées à ce milestone
      milestoneTasks.forEach((task) => {
        convertedTasks.push(convertTask(task));
      });
    });

    // Ajouter les tâches sans milestone à la fin
    tasksWithoutMilestone.forEach((task) => {
      convertedTasks.push(convertTask(task));
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGanttTasks(convertedTasks);
  }, [tasks, milestones, projectStartDate, projectEndDate]);

  if (ganttTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-500">
          {t("ganttChart.emptyState.title")}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          {t("ganttChart.emptyState.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg gantt-chart">
      {/* View Mode Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm font-medium text-gray-900">{t("ganttChart.viewLabel")}:</span>
        <button
          onClick={() => setViewMode(ViewMode.Day)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Day
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
          }`}
        >
          {t("ganttChart.viewDay")}
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Week)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Week
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
          }`}
        >
          {t("ganttChart.viewWeek")}
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Month)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Month
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
          }`}
        >
          {t("ganttChart.viewMonth")}
        </button>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          locale="fr"
          listCellWidth="250px"
          columnWidth={
            viewMode === ViewMode.Month
              ? 300
              : viewMode === ViewMode.Week
                ? 250
                : 65
          }
          arrowColor="#6b7280"
          arrowIndent={20}
          onClick={handleTaskClick}
          onDoubleClick={handleTaskDoubleClick}
        />
      </div>

      {/* Task Dependency Info Popover */}
      {selectedTaskForInfo && (
        <TaskDependencyInfo
          task={selectedTaskForInfo}
          allTasks={fullTasks}
          onClose={() => setSelectedTaskForInfo(null)}
          onEdit={() => {
            setSelectedTaskForInfo(null);
            setSelectedTaskForModal(selectedTaskForInfo);
          }}
          onNavigate={handleNavigate}
        />
      )}

      {/* Task Dependency Modal */}
      {selectedTaskForModal && (
        <TaskDependencyModal
          task={selectedTaskForModal}
          allTasks={fullTasks}
          onClose={() => setSelectedTaskForModal(null)}
          onSave={handleDependencySave}
        />
      )}
    </div>
  );
}
