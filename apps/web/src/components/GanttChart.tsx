'use client';

import { useEffect, useState } from 'react';
import { Gantt, Task, ViewMode } from '@rsagiev/gantt-task-react-19';
import '@rsagiev/gantt-task-react-19/dist/index.css';
import '../gantt-custom.css';

interface GanttTask {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  progress?: number;
  milestoneId?: string;
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
}

export default function GanttChart({
  tasks,
  milestones,
  projectStartDate,
  projectEndDate,
}: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [ganttTasks, setGanttTasks] = useState<Task[]>([]);

  useEffect(() => {
    const convertedTasks: Task[] = [];
    const now = new Date();
    const defaultStart = projectStartDate || now;
    const defaultEnd = projectEndDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
      const end = task.endDate ? new Date(task.endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      let backgroundColor = '#3b82f6';
      if (task.status === 'DONE') backgroundColor = '#10b981';
      else if (task.status === 'IN_PROGRESS') backgroundColor = '#f59e0b';
      else if (task.status === 'BLOCKED') backgroundColor = '#ef4444';

      return {
        id: `task-${task.id}`,
        name: `  ${task.title}`,
        start,
        end,
        type: 'task' as const,
        progress: task.progress || 0,
        styles: {
          backgroundColor,
          backgroundSelectedColor: backgroundColor,
        },
      } as Task;
    };

    // Ajouter milestones avec leurs tâches
    milestones.forEach((milestone) => {
      const dueDate = milestone.dueDate ? new Date(milestone.dueDate) : defaultEnd;

      // Ajouter le milestone
      convertedTasks.push({
        id: `milestone-${milestone.id}`,
        name: `📍 ${milestone.name}`,
        start: dueDate,
        end: dueDate,
        type: 'milestone' as const,
        progress: milestone.status === 'COMPLETED' ? 100 : 0,
        styles: {
          backgroundColor: '#10b981',
          backgroundSelectedColor: '#059669',
        },
      } as Task);

      // Ajouter les tâches liées à ce milestone
      const milestoneTasks = tasksByMilestone.get(milestone.id) || [];
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
        <p className="text-gray-500">Aucune donnée pour le diagramme de Gantt</p>
        <p className="text-sm text-gray-400 mt-2">
          Ajoutez des tâches et jalons avec des dates pour visualiser le planning
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg gantt-chart">
      {/* View Mode Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm font-medium text-gray-900">Vue:</span>
        <button
          onClick={() => setViewMode(ViewMode.Day)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Day
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
          }`}
        >
          Jour
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Week)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Week
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
          }`}
        >
          Semaine
        </button>
        <button
          onClick={() => setViewMode(ViewMode.Month)}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === ViewMode.Month
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
          }`}
        >
          Mois
        </button>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          locale="fr"
          listCellWidth="250px"
          columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
        />
      </div>
    </div>
  );
}
