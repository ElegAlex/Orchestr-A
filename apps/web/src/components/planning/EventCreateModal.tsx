"use client";

import { useState, useEffect } from "react";
import { Project, User, Service } from "@/types";
import { eventsService, CreateEventDto } from "@/services/events.service";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ServiceMultiSelect } from "@/components/ServiceMultiSelect";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
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
  const { hasPermission } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<
    CreateEventDto & { participantIds: string[]; serviceIds: string[] }
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
    serviceIds: [],
    isRecurring: false,
    recurrenceWeekInterval: 1,
    recurrenceDay: undefined,
    recurrenceEndDate: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (user?.id) {
        setFormData((prev) => ({ ...prev, participantIds: [user.id] }));
      }
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      let projectsData: Project[] = [];
      if (hasPermission("users:read")) {
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

      if (hasPermission("events:update")) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch {
          setUsers([]);
        }
      }

      // Fetch services
      try {
        const { services: servicesData, memberCounts: counts } =
          await servicesService.getAllWithMemberCounts();
        setServices(servicesData);
        setMemberCounts(counts);
      } catch {
        setServices([]);
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
        serviceIds:
          formData.serviceIds.length > 0 ? formData.serviceIds : undefined,
        isRecurring: formData.isRecurring || undefined,
        recurrenceWeekInterval: formData.isRecurring
          ? formData.recurrenceWeekInterval
          : undefined,
        recurrenceDay:
          formData.isRecurring && formData.recurrenceDay !== undefined
            ? formData.recurrenceDay
            : undefined,
        recurrenceEndDate:
          formData.isRecurring && formData.recurrenceEndDate
            ? formData.recurrenceEndDate
            : undefined,
      };
      await eventsService.create(eventData);
      toast.success(t("success"));
      if (onSuccess) await onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t("error"));
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
      serviceIds: [],
      isRecurring: false,
      recurrenceWeekInterval: 1,
      recurrenceDay: undefined,
      recurrenceEndDate: "",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t("title")}</h2>
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
                  setFormData({
                    ...formData,
                    isExternalIntervention: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label
                htmlFor="eventIsExternalIntervention"
                className="text-sm text-gray-700"
              >
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

          {services.length > 0 && (
            <ServiceMultiSelect
              label={t("services") || "Services"}
              services={services}
              selectedIds={formData.serviceIds}
              onChange={(ids) => setFormData({ ...formData, serviceIds: ids })}
              placeholder={
                t("servicesPlaceholder") || "Inviter des services entiers"
              }
              memberCounts={memberCounts}
            />
          )}

          <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                id="eventIsRecurring"
                checked={formData.isRecurring || false}
                onChange={(e) =>
                  setFormData({ ...formData, isRecurring: e.target.checked })
                }
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="eventIsRecurring"
                className="text-sm font-medium text-purple-900"
              >
                {t("recurring")}
              </label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("recurrenceInterval")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={formData.recurrenceWeekInterval ?? 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurrenceWeekInterval: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("recurrenceDay")}
                    </label>
                    <select
                      value={formData.recurrenceDay ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurrenceDay:
                            e.target.value !== ""
                              ? parseInt(e.target.value)
                              : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">{t("recurrenceDayAuto")}</option>
                      <option value="0">{t("days.mon")}</option>
                      <option value="1">{t("days.tue")}</option>
                      <option value="2">{t("days.wed")}</option>
                      <option value="3">{t("days.thu")}</option>
                      <option value="4">{t("days.fri")}</option>
                      <option value="5">{t("days.sat")}</option>
                      <option value="6">{t("days.sun")}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("recurrenceEndDate")}
                  </label>
                  <input
                    type="date"
                    value={formData.recurrenceEndDate || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recurrenceEndDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

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
