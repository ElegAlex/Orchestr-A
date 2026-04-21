"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { Task, TaskStatus } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";

import { MyTasksUpcomingList } from "./MyTasksUpcomingList";
import { MyTasksUndeclaredList } from "./MyTasksUndeclaredList";

const UNDECLARED_EXPANDED_KEY = "dashboard.undeclaredExpanded";

type Props = {
  /** Tâches non terminées, triées par endDate asc (parent gère tri/slice). */
  upcomingTasks: Task[];
  /**
   * Tâches DONE sans déclaration. Peut être vide. Le parent n'a à fournir
   * cette liste que si l'utilisateur a `time_tracking:create` ; cela dit,
   * la section complète est masquée côté composant si la permission manque
   * (défense en profondeur — cf. D8).
   */
  doneUndeclaredTasks: Task[];
  onOpenModal: (taskId: string, projectId: string | null) => void;
  onQuickEntrySuccess: (taskId: string, hours: number) => void;
  onDismissalSuccess: (taskId: string) => void;
  /** Forwarded to upcoming TaskCards to let them mutate task.status. */
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
};

/**
 * Conteneur "Mes tâches" du dashboard :
 *   - Sous-section 1 (dépliée) : tâches à venir (avec saisie inline).
 *   - Sous-section 2 (repliée par défaut) : tâches DONE sans déclaration.
 *
 * L'état d'expansion de la sous-section 2 est persisté dans localStorage
 * sous la clé `dashboard.undeclaredExpanded` (valeurs `'true'` / `'false'`).
 *
 * Gating (D8) : si l'utilisateur n'a pas `time_tracking:create`, la sous-
 * section "non déclarées" est ENTIÈREMENT masquée (wrapper compris).
 */
export function MyTasksSection({
  upcomingTasks,
  doneUndeclaredTasks,
  onOpenModal,
  onQuickEntrySuccess,
  onDismissalSuccess,
  onStatusChange,
}: Props) {
  const t = useTranslations("dashboard");
  const { hasPermission } = usePermissions();
  const canLogTime = hasPermission("time_tracking:create");

  // État du collapse — init "replié", hydratation depuis localStorage.
  // On garde l'état replié par défaut côté SSR pour éviter tout mismatch
  // d'hydratation (localStorage n'est pas dispo côté serveur).
  const [undeclaredExpanded, setUndeclaredExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(UNDECLARED_EXPANDED_KEY);
      if (stored === "true") setUndeclaredExpanded(true);
    } catch {
      // Accès localStorage refusé (mode privé, etc.) — on reste replié.
    }
  }, []);

  const toggleUndeclared = () => {
    setUndeclaredExpanded((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            UNDECLARED_EXPANDED_KEY,
            next ? "true" : "false",
          );
        }
      } catch {
        // Persistance best-effort.
      }
      return next;
    });
  };

  const undeclaredCountSuffix =
    doneUndeclaredTasks.length === 0 ? "" : ` (${doneUndeclaredTasks.length})`;

  return (
    <div className="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {t("tasks.segmentTitle")}
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Sous-section 1 : À venir (toujours dépliée) */}
        <section aria-labelledby="dashboard-upcoming-tasks">
          <h3
            id="dashboard-upcoming-tasks"
            className="text-sm font-semibold text-[var(--foreground)] mb-3"
          >
            {t("tasks.upcomingTitle")}
          </h3>
          <MyTasksUpcomingList
            tasks={upcomingTasks}
            onOpenModal={onOpenModal}
            onQuickEntrySuccess={onQuickEntrySuccess}
            onStatusChange={onStatusChange}
          />
        </section>

        {/* Sous-section 2 : Non déclarées (gatée par permission, repliable) */}
        {canLogTime && (
          <section aria-labelledby="dashboard-undeclared-tasks">
            <button
              type="button"
              onClick={toggleUndeclared}
              aria-expanded={undeclaredExpanded}
              aria-controls="dashboard-undeclared-panel"
              className="w-full flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded transition"
            >
              {undeclaredExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              <span id="dashboard-undeclared-tasks">
                {t("tasks.undeclaredTitle")}
                {undeclaredCountSuffix}
              </span>
            </button>

            {undeclaredExpanded && (
              <div id="dashboard-undeclared-panel" className="mt-3">
                <MyTasksUndeclaredList
                  tasks={doneUndeclaredTasks}
                  onDismissalSuccess={onDismissalSuccess}
                  onOpenModal={onOpenModal}
                  onQuickEntrySuccess={onQuickEntrySuccess}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default MyTasksSection;
