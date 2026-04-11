"use client";

/**
 * TaskCreateModal — wrapper modal pour TaskForm côté planning.
 * Fetch les données de référence au mount, pré-remplit l'assigné sur
 * l'utilisateur courant, délègue tout à TaskForm.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Project, Service, User } from "@/types";
import { tasksService } from "@/services/tasks.service";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskForm } from "@/components/tasks/TaskForm";

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TaskCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
}: TaskCreateModalProps) => {
  const t = useTranslations("planning.taskCreate");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;

    (async () => {
      // Projects (gated by projects:read + tasks:readAll)
      let projectsData: Project[] = [];
      if (hasPermission("projects:read")) {
        try {
          if (hasPermission("tasks:readAll")) {
            const response = await projectsService.getAll();
            projectsData = Array.isArray(response.data) ? response.data : [];
          } else if (user?.id) {
            projectsData = await projectsService.getByUser(user.id);
            projectsData = Array.isArray(projectsData) ? projectsData : [];
          }
        } catch {
          projectsData = [];
        }
      }
      setProjects(projectsData);

      // Users (gated by tasks:update + users:read)
      if (hasPermission("tasks:update") && hasPermission("users:read")) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch {
          setUsers([]);
        }
      }

      // Services
      try {
        const { services: servicesData, memberCounts: counts } =
          await servicesService.getAllWithMemberCounts();
        setServices(servicesData);
        setMemberCounts(counts);
      } catch {
        setServices([]);
      }
    })();
  }, [isOpen, user?.id, hasPermission]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{t("title")}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
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
          mode="create"
          initialValues={user?.id ? { assigneeIds: [user.id] } : undefined}
          projects={projects}
          users={users}
          services={services}
          memberCounts={memberCounts}
          enableExternalIntervention
          enableThirdParties={hasPermission("third_parties:assign_to_task")}
          filterAssigneesByProjectMembers
          onSubmit={async (payload) => {
            try {
              const created = await tasksService.create(
                payload as Parameters<typeof tasksService.create>[0],
              );
              toast.success(t("success"));
              if (onSuccess) await onSuccess();
              onClose();
              return created;
            } catch (err) {
              const axiosError = err as {
                response?: { data?: { message?: string } };
              };
              toast.error(axiosError.response?.data?.message || t("error"));
              throw err;
            }
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
