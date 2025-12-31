import { Task, TaskDependency, TaskStatus } from "@/types";

export interface DateConflict {
  dependencyTaskId: string;
  dependencyTaskTitle: string;
  dependencyEndDate: string;
  currentTaskStartDate: string;
  gapDays: number; // Negative means overlap
}

/**
 * Detect date conflicts between a task and its dependencies.
 * A conflict occurs when the current task starts before or on the same day
 * as one of its dependencies ends.
 */
export function detectDateConflicts(
  currentTask: { startDate?: string },
  dependencies: TaskDependency[],
): DateConflict[] {
  const conflicts: DateConflict[] = [];

  if (!currentTask.startDate) {
    return conflicts; // No start date, no conflict possible
  }

  const currentStart = new Date(currentTask.startDate);
  currentStart.setHours(0, 0, 0, 0);

  for (const dep of dependencies) {
    const depTask = dep.dependsOnTask;
    if (!depTask?.endDate) continue;

    const depEnd = new Date(depTask.endDate);
    depEnd.setHours(0, 0, 0, 0);

    // Conflict: current task starts before or on the same day as dependency ends
    if (currentStart <= depEnd) {
      const gapMs = currentStart.getTime() - depEnd.getTime();
      const gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));

      conflicts.push({
        dependencyTaskId: depTask.id,
        dependencyTaskTitle: depTask.title,
        dependencyEndDate: depTask.endDate,
        currentTaskStartDate: currentTask.startDate,
        gapDays: gapDays,
      });
    }
  }

  return conflicts;
}

/**
 * Format a date conflict into a human-readable message
 */
export function formatConflictMessage(conflict: DateConflict): string {
  const depEndFormatted = new Date(
    conflict.dependencyEndDate,
  ).toLocaleDateString("fr-FR");
  const currentStartFormatted = new Date(
    conflict.currentTaskStartDate,
  ).toLocaleDateString("fr-FR");

  if (conflict.gapDays < 0) {
    return `"${conflict.dependencyTaskTitle}" se termine le ${depEndFormatted}, mais cette tache commence le ${currentStartFormatted} (${Math.abs(conflict.gapDays)} jour(s) de chevauchement)`;
  } else if (conflict.gapDays === 0) {
    return `"${conflict.dependencyTaskTitle}" se termine le meme jour que cette tache commence (${depEndFormatted})`;
  }

  return "";
}

/**
 * Check if adding a dependency would create a date conflict
 */
export function wouldCreateDateConflict(
  currentTaskStartDate: string | undefined,
  dependencyTask: Task,
): boolean {
  if (!currentTaskStartDate || !dependencyTask.endDate) {
    return false;
  }

  const currentStart = new Date(currentTaskStartDate);
  currentStart.setHours(0, 0, 0, 0);

  const depEnd = new Date(dependencyTask.endDate);
  depEnd.setHours(0, 0, 0, 0);

  return currentStart <= depEnd;
}

/**
 * Get status color class for a task status
 */
export function getStatusColorClass(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.DONE:
      return "bg-green-100 text-green-800";
    case TaskStatus.IN_PROGRESS:
      return "bg-blue-100 text-blue-800";
    case TaskStatus.IN_REVIEW:
      return "bg-yellow-100 text-yellow-800";
    case TaskStatus.BLOCKED:
      return "bg-red-100 text-red-800";
    case TaskStatus.TODO:
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get status label in French
 */
export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.TODO:
      return "A faire";
    case TaskStatus.IN_PROGRESS:
      return "En cours";
    case TaskStatus.IN_REVIEW:
      return "En revue";
    case TaskStatus.DONE:
      return "Termine";
    case TaskStatus.BLOCKED:
      return "Bloque";
    default:
      return status;
  }
}
