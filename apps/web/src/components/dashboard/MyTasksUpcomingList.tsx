"use client";

import { useTranslations } from "next-intl";

import type { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";

type Props = {
  tasks: Task[];
  onOpenModal: (taskId: string, projectId: string | null) => void;
  onQuickEntrySuccess: (taskId: string, hours: number) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
};

/**
 * Liste des tâches à venir (status !== 'DONE').
 *
 * Note : le slice éventuel (top 5) est effectué en amont par la page parente,
 * pour préserver le comportement existant du dashboard. Ce composant se
 * contente d'itérer sur ce qu'on lui donne.
 */
export function MyTasksUpcomingList({
  tasks,
  onOpenModal,
  onQuickEntrySuccess,
  onStatusChange,
}: Props) {
  const t = useTranslations("dashboard");

  if (tasks.length === 0) {
    return (
      <p className="text-[var(--muted-foreground)] text-center py-8">
        {t("tasks.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          mode="upcoming"
          onOpenModal={onOpenModal}
          onQuickEntrySuccess={onQuickEntrySuccess}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

export default MyTasksUpcomingList;
