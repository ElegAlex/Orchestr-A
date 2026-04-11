"use client";

/**
 * TaskModal — wrapper modal pour TaskForm, utilisé depuis /projects/[id]/page.tsx.
 * Gère le shell visuel (overlay + conteneur), délègue toute la logique de
 * formulaire à TaskForm.
 */

import {
  Task,
  TaskStatus,
  Milestone,
  User,
  Project,
  Service,
} from "@/types";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskForm } from "@/components/tasks/TaskForm";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback parent : effectue l'appel API (create ou update) et retourne
   * la tâche créée (create) ou void (update). Le retour est utilisé par
   * TaskForm pour chaîner les assignations tiers en mode create.
   */
  onSave: (data: Record<string, unknown>) => Promise<Task | void>;
  task?: Task | null;
  projectId?: string | null;
  projects?: Project[];
  milestones?: Milestone[];
  users?: User[];
  services?: Service[];
  memberCounts?: Record<string, number>;
  hiddenStatuses?: TaskStatus[];
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  projectId,
  projects = [],
  milestones = [],
  users = [],
  services = [],
  memberCounts = {},
  hiddenStatuses = [],
}: TaskModalProps) {
  const t = useTranslations("tasks");
  const { hasPermission } = usePermissions();

  if (!isOpen) return null;

  const mode = task ? "edit" : "create";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {task ? t("modal.edit.title") : t("modal.create.title")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
              type="button"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <TaskForm
          mode={mode}
          initialTask={task}
          lockedProjectId={projectId ?? null}
          projects={projects}
          users={users}
          services={services}
          milestones={milestones}
          memberCounts={memberCounts}
          hiddenStatuses={hiddenStatuses}
          enableMilestone
          enableExternalIntervention={false}
          enableThirdParties={hasPermission("third_parties:assign_to_task")}
          onSubmit={async (payload) => {
            const result = await onSave(
              payload as unknown as Record<string, unknown>,
            );
            onClose();
            return result ?? undefined;
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
