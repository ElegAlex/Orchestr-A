"use client";

import { useState, useRef, useCallback } from "react";
import { Gantt } from "./gantt";
import type { GanttTaskRow, GanttDependency } from "./gantt/types";
import type { Task as FullTask, TaskStatus, UserSummary } from "@/types";
import { TaskDependencyInfo } from "./TaskDependencyInfo";
import { TaskDependencyModal } from "./TaskDependencyModal";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

interface GanttTask {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  progress?: number;
  milestoneId?: string;
  dependencies?: { dependsOnTaskId: string }[];
  assignee?: UserSummary | null;
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

function tasksToGanttRows(
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  projectStartDate?: Date,
  projectEndDate?: Date,
): GanttTaskRow[] {
  const now = new Date();
  const defaultStart = projectStartDate || now;
  const milestonesById = new Map(milestones.map((m) => [m.id, m]));
  const rows: GanttTaskRow[] = [];

  for (const task of tasks) {
    const start = task.startDate ? new Date(task.startDate) : defaultStart;
    const end = task.endDate
      ? new Date(task.endDate)
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const milestone = task.milestoneId
      ? milestonesById.get(task.milestoneId)
      : undefined;

    rows.push({
      id: task.id,
      name: task.title,
      startDate: start,
      endDate: end,
      progress: task.progress || 0,
      status: (task.status || "TODO") as TaskStatus,
      milestoneId: task.milestoneId,
      milestoneName: milestone?.name,
      isMilestone: false,
      assignee: task.assignee ?? null,
    });
  }

  const defaultEnd =
    projectEndDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const milestone of milestones) {
    const dueDate = milestone.dueDate
      ? new Date(milestone.dueDate)
      : defaultEnd;
    const msStatus =
      milestone.status === "COMPLETED" ? "DONE" : milestone.status || "TODO";

    rows.push({
      id: `milestone-${milestone.id}`,
      name: milestone.name,
      startDate: dueDate,
      endDate: dueDate,
      progress: milestone.status === "COMPLETED" ? 100 : 0,
      status: msStatus as TaskStatus,
      milestoneId: milestone.id,
      milestoneName: milestone.name,
      isMilestone: true,
    });
  }

  return rows;
}

function dependenciesToGantt(tasks: GanttTask[]): GanttDependency[] {
  const deps: GanttDependency[] = [];
  for (const task of tasks) {
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        deps.push({ fromId: dep.dependsOnTaskId, toId: task.id });
      }
    }
  }
  return deps;
}

export default function GanttChart({
  tasks,
  milestones,
  projectStartDate,
  projectEndDate,
  fullTasks = [],
  onDependencyChange,
}: GanttChartProps) {
  const locale = useLocale();
  const router = useRouter();
  const [selectedTaskForInfo, setSelectedTaskForInfo] =
    useState<FullTask | null>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] =
    useState<FullTask | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const rows = tasksToGanttRows(
    tasks,
    milestones,
    projectStartDate,
    projectEndDate,
  );
  const dependencies = dependenciesToGantt(tasks);

  const findFullTask = useCallback(
    (rowId: string): FullTask | null => {
      return fullTasks.find((t) => t.id === rowId) || null;
    },
    [fullTasks],
  );

  const handleRowClick = useCallback(
    (row: GanttTaskRow) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      clickTimeoutRef.current = setTimeout(() => {
        const fullTask = findFullTask(row.id);
        if (fullTask) {
          setSelectedTaskForInfo(fullTask);
        }
      }, 250);
    },
    [findFullTask],
  );

  const handleRowDoubleClick = useCallback(
    (row: GanttTaskRow) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      const fullTask = findFullTask(row.id);
      if (fullTask) {
        setSelectedTaskForInfo(null);
        setSelectedTaskForModal(fullTask);
      }
    },
    [findFullTask],
  );

  const handleNavigate = useCallback(
    (taskId: string) => {
      setSelectedTaskForInfo(null);
      router.push(`/${locale}/tasks/${taskId}`);
    },
    [router, locale],
  );

  const handleDependencySave = useCallback(() => {
    onDependencyChange?.();
  }, [onDependencyChange]);

  return (
    <div className="bg-white rounded-lg">
      <Gantt
        scope="project"
        rows={rows}
        view="day"
        dependencies={dependencies}
        groupBy="milestone"
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
      />

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
