"use client";

import type { Task } from "@/types";
import { TaskCard } from "./TaskCard";

type Props = {
  tasks: Task[];
  onOpenModal: (taskId: string, projectId: string | null) => void;
  onQuickEntrySuccess: (taskId: string, hours: number) => void;
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
}: Props) {
  if (tasks.length === 0) {
    // TODO V5 : clé dashboard.tasks.empty
    return (
      <p className="text-[var(--muted-foreground)] text-center py-8">
        Aucune tâche à venir
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
        />
      ))}
    </div>
  );
}

export default MyTasksUpcomingList;
