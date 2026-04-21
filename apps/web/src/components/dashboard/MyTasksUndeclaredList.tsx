"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import type { Task } from "@/types";
import { timeTrackingService } from "@/services/time-tracking.service";

import { TaskCard } from "./TaskCard";

type Props = {
  tasks: Task[];
  /**
   * Callback appelé quand l'utilisateur a confirmé via la checkbox que la
   * tâche ne nécessitait pas de déclaration. Le parent retire la ligne.
   */
  onDismissalSuccess: (taskId: string) => void;
};

/**
 * Liste des tâches DONE en attente d'une déclaration de temps (ou d'un
 * dismissal "déjà traité sans déclaration").
 *
 * Chaque carte expose une checkbox qui appelle
 * `timeTrackingService.createDismissal(taskId)`. Le parent gère l'état
 * optimiste (retrait de la liste) via `onDismissalSuccess`.
 */
export function MyTasksUndeclaredList({ tasks, onDismissalSuccess }: Props) {
  const t = useTranslations("dashboard");
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  const handleDismiss = async (taskId: string) => {
    if (submittingIds.has(taskId)) return;

    setSubmittingIds((prev) => new Set(prev).add(taskId));
    try {
      await timeTrackingService.createDismissal(taskId);
      onDismissalSuccess(taskId);
      toast.success(t("tasks.undeclaredCheckboxSuccess"));
    } catch {
      toast.error(t("tasks.undeclaredCheckboxError"));
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <p className="text-[var(--muted-foreground)] text-center py-8">
        {t("tasks.undeclaredEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          mode="undeclared"
          onDismissalClick={handleDismiss}
          dismissalDisabled={submittingIds.has(task.id)}
        />
      ))}
    </div>
  );
}

export default MyTasksUndeclaredList;
