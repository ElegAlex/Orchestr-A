"use client";

import { useState, useEffect } from "react";
import { Project, Role, User } from "@/types";
import {
  eventsService,
  CreateEventDto,
} from "@/services/events.service";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EventCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
}: EventCreateModalProps) => {
  const t = useTranslations("events.create");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<
    CreateEventDto & { participantIds: string[] }
  >({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    isAllDay: true,
    isExternalIntervention: false,
    projectId: "",
    participantIds: [],
  });

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      let projectsData: Project[] = [];
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE) {
        const response = await projectsService.getAll();
        projectsData = Array.isArray(response.data) ? response.data : [];
      } else if (user?.id) {
        try {
          projectsData = await projectsService.getByUser(user.id);
          projectsData = Array.isArray(projectsData) ? projectsData : [];
        } catch {
          projectsData = [];
        }
      }
      setProjects(projectsData);

      if (
        user?.role === Role.ADMIN ||
        user?.role === Role.RESPONSABLE ||
        user?.role === Role.MANAGER
      ) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch {
          setUsers([]);
        }
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const eventData: CreateEventDto = {
        title: formData.title,
        description: formData.description || undefined,
        date: formData.date,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        isAllDay: formData.isAllDay,
        isExternalIntervention: formData.isExternalIntervention,
        projectId: formData.projectId || undefined,
        participantIds:
          formData.participantIds.length > 0
            ? formData.participantIds
            : undefined,
      };
      await eventsService.create(eventData);
      toast.success(t("success"));
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("error"),
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      isExternalIntervention: false,
      projectId: "",
      participantIds: [],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t("title")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("titleField")}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("titlePlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("date")}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="eventIsAllDay"
                checked={formData.isAllDay}
                onChange={(e) =>
                  setFormData({ ...formData, isAllDay: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="eventIsAllDay" className="text-sm text-gray-700">
                {t("allDay")}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="eventIsExternalIntervention"
                checked={formData.isExternalIntervention}
                onChange={(e) =>
                  setFormData({ ...formData, isExternalIntervention: e.target.checked })
                }
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="eventIsExternalIntervention" className="text-sm text-gray-700">
                {t("externalIntervention")}
              </label>
            </div>
          </div>

          {!formData.isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("startTime")}
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("endTime")}
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("project")}
            </label>
            <select
              value={formData.projectId || ""}
              onChange={(e) =>
                setFormData({ ...formData, projectId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("noProject")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <UserMultiSelect
            label={t("participants")}
            users={users}
            selectedIds={formData.participantIds}
            onChange={(ids) =>
              setFormData({ ...formData, participantIds: ids })
            }
            placeholder={t("participantsPlaceholder")}
          />

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {tCommon("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? t("creating") : t("createButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
