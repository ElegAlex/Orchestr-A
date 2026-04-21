"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { usePermissions } from "@/hooks/usePermissions";
import { ProjectIcon } from "@/components/ProjectIcon";
import type { Task } from "@/types";

import { QuickTimeEntryInput } from "./QuickTimeEntryInput";

type Mode = "upcoming" | "undeclared";

type Props = {
  task: Task;
  mode: Mode;
  /** Ouvre la modal de saisie de temps (V5 passera le handler). */
  onOpenModal?: (taskId: string, projectId: string | null) => void;
  /** Appelé après succès de QuickTimeEntryInput (optimistic update côté parent). */
  onQuickEntrySuccess?: (taskId: string, hours: number) => void;
  /** Click sur la checkbox "déjà traité sans déclaration". */
  onDismissalClick?: (taskId: string) => void;
  /**
   * Checkbox disabled state (undeclared mode) — utile si le parent gère
   * un état submitting optimiste avant que la tâche disparaisse de la liste.
   */
  dismissalDisabled?: boolean;
};

function isTaskOverdue(task: Task): boolean {
  return (
    !!task.endDate &&
    new Date(task.endDate) < new Date() &&
    task.status !== "DONE"
  );
}

function formatDate(dateString?: string): string {
  if (!dateString) {
    // TODO V5 : clé common.common.notDefined
    return "Non défini";
  }
  try {
    return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
  } catch {
    // TODO V5 : clé common.common.invalidDate
    return "Date invalide";
  }
}

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export function TaskCard({
  task,
  mode,
  onOpenModal,
  onQuickEntrySuccess,
  onDismissalClick,
  dismissalDisabled = false,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const { hasPermission } = usePermissions();

  const canLogTime = hasPermission("time_tracking:create");
  const overdue = isTaskOverdue(task);
  const totalLogged = task.totalLoggedHours ?? 0;
  const projectId = task.projectId ?? null;

  // TODO V5 : clés i18n (fallbacks FR temporaires pour cette vague)
  const labels = {
    noProject: "Sans projet",
    startDate: "Début :",
    endDate: "Fin :",
    estimated: "Estimé :",
    hours: (value: number) => `${value} h`,
    overdue: "En retard",
    openModal: "Ouvrir la saisie de temps",
    dismiss: "Marquer comme traité sans déclaration",
    loggedTooltip: "Déjà déclaré (tous contributeurs)",
  };

  const handleCardClick = () => {
    router.push(`/${locale}/tasks/${task.id}`);
  };

  const handleOpenModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenModal?.(task.id, projectId);
  };

  const handleDismissChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      onDismissalClick?.(task.id);
    }
  };

  return (
    <div
      key={task.id}
      className={`p-4 bg-[var(--muted)] rounded-lg hover:bg-[var(--accent)] transition cursor-pointer ${
        overdue ? "border border-red-300 dark:border-red-500/40" : ""
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-4">
        {mode === "undeclared" && (
          <label
            className="flex items-center pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--ring)] cursor-pointer"
              disabled={dismissalDisabled}
              onChange={handleDismissChange}
              aria-label={labels.dismiss}
            />
          </label>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-[var(--foreground)] hover:text-blue-600 transition truncate">
              {task.title}
            </h3>
            {overdue && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {labels.overdue}
              </span>
            )}
          </div>

          <div className="mt-1">
            {task.project ? (
              <Link
                href={`/${locale}/projects/${task.project.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
              >
                <ProjectIcon icon={task.project.icon} size={14} />
                {task.project.name}
              </Link>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                {labels.noProject}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {task.description.slice(0, 100)}
              {task.description.length > 100 && "..."}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)] flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarIcon />
              <span className="font-medium">{labels.startDate}</span>
              <span>{formatDate(task.startDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon />
              <span className="font-medium">{labels.endDate}</span>
              <span>{formatDate(task.endDate)}</span>
            </div>
            {task.estimatedHours != null && (
              <div className="flex items-center gap-1.5">
                <ClockIcon />
                <span className="font-medium">{labels.estimated}</span>
                <span>{labels.hours(task.estimatedHours)}</span>
              </div>
            )}
          </div>
        </div>

        {mode === "upcoming" && (
          <div
            className="ml-auto flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {canLogTime ? (
              <QuickTimeEntryInput
                taskId={task.id}
                projectId={projectId}
                initialCumul={totalLogged}
                onSuccess={(taskId, hours) => onQuickEntrySuccess?.(taskId, hours)}
              />
            ) : (
              <span
                className="text-xs text-[var(--muted-foreground)] whitespace-nowrap"
                title={labels.loggedTooltip}
                aria-label={labels.loggedTooltip}
              >
                {totalLogged.toFixed(2)} h
              </span>
            )}

            {canLogTime && (
              <button
                type="button"
                onClick={handleOpenModalClick}
                aria-label={labels.openModal}
                title={labels.openModal}
                className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
