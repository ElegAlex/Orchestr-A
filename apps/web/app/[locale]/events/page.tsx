"use client";

import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import {
  eventsService,
  Event,
  CreateEventDto,
  UpdateEventDto,
} from "@/services/events.service";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { Project, Role, User, Service } from "@/types";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ServiceMultiSelect } from "@/components/ServiceMultiSelect";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export default function EventsPage() {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

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
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch projects
      let projectsData: Project[] = [];
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE) {
        const response = await projectsService.getAll();
        projectsData = Array.isArray(response.data) ? response.data : [];
      } else if (user?.id) {
        try {
          projectsData = await projectsService.getByUser(user.id);
          projectsData = Array.isArray(projectsData) ? projectsData : [];
        } catch (err) {
          projectsData = [];
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching projects:", err);
        }
      }
      setProjects(projectsData);

      // Fetch events
      let eventsData: Event[] = [];
      try {
        eventsData = await eventsService.getAll();
        eventsData = Array.isArray(eventsData) ? eventsData : [];
      } catch (err) {
        eventsData = [];
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status !== 404)
          console.error("Error fetching events:", err);
      }
      setEvents(eventsData);

      // Fetch users for assignment
      if (
        user?.role === Role.ADMIN ||
        user?.role === Role.RESPONSABLE ||
        user?.role === Role.MANAGER
      ) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (err) {
          setUsers([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching users:", err);
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
      toast.error(t("errors.loadData"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
      };
      await eventsService.create(eventData);
      toast.success(t("create.success"));
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t("create.error"));
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      date:
        typeof event.date === "string"
          ? event.date.split("T")[0]
          : new Date(event.date).toISOString().split("T")[0],
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      isAllDay: event.isAllDay,
      isExternalIntervention: event.isExternalIntervention || false,
      projectId: event.projectId || "",
      participantIds: event.participants?.map((p) => p.userId) || [],
      serviceIds: [],
    });
    setShowCreateModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    try {
      const eventData: UpdateEventDto = {
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
      };
      await eventsService.update(editingEvent.id, eventData);
      toast.success(t("edit.success"));
      setShowCreateModal(false);
      setEditingEvent(null);
      resetForm();
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t("edit.error"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete.confirm"))) return;

    try {
      await eventsService.delete(id);
      toast.success(t("delete.success"));
      fetchData();
    } catch {
      toast.error(t("delete.error"));
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
    });
  };

  const getFilteredEvents = () => {
    let filtered = events;

    if (selectedProject !== "ALL") {
      filtered = events.filter((e) => e.projectId === selectedProject);
    }

    return filtered.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  };

  const canCreateEvent = () => {
    return (
      user?.role === Role.ADMIN ||
      user?.role === Role.RESPONSABLE ||
      user?.role === Role.MANAGER ||
      user?.role === Role.CHEF_DE_PROJET ||
      user?.role === Role.REFERENT_TECHNIQUE ||
      user?.role === Role.CONTRIBUTEUR
    );
  };

  const canDeleteEvent = () => {
    return (
      user?.role === Role.ADMIN ||
      user?.role === Role.RESPONSABLE ||
      user?.role === Role.MANAGER ||
      user?.role === Role.CHEF_DE_PROJET ||
      user?.role === Role.REFERENT_TECHNIQUE
    );
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time?: string) => {
    if (!time) return "";
    return time;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{tCommon("actions.loading")}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">
              {getFilteredEvents().length === 1
                ? t("count", { count: getFilteredEvents().length })
                : t("countPlural", { count: getFilteredEvents().length })}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex bg-white rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t("view.list")}
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === "calendar"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t("view.calendar")}
              </button>
            </div>
            {canCreateEvent() && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
              >
                <span>+</span>
                <span>{t("createEvent")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.project")}
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">{t("filters.allProjects")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {getFilteredEvents().length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t("noEvents")}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {getFilteredEvents().map((event) => (
                  <div
                    key={event.id}
                    className="px-4 py-3 hover:bg-gray-50 transition"
                  >
                    {/* Row 1 */}
                    <div className="flex items-center gap-3">
                      {/* Left: Title + badge */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {event.title}
                        </h3>
                        {event.isExternalIntervention && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 shrink-0">
                            {t("details.externalIntervention")}
                          </span>
                        )}
                      </div>

                      {/* Center: Date + times */}
                      <div className="text-sm text-gray-600 shrink-0">
                        {formatDate(event.date)}
                        {!event.isAllDay && event.startTime && (
                          <span className="ml-2">
                            {formatTime(event.startTime)}
                            {event.endTime && ` - ${formatTime(event.endTime)}`}
                          </span>
                        )}
                      </div>

                      {/* Right: Participants + avatars */}
                      {event.participants && event.participants.length > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-500">
                            {event.participants.length === 1
                              ? t("details.participants", {
                                  count: event.participants.length,
                                })
                              : t("details.participantsPlural", {
                                  count: event.participants.length,
                                })}
                          </span>
                          <div className="flex -space-x-1">
                            {event.participants.slice(0, 5).map((p) => (
                              <div
                                key={p.userId}
                                className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs border border-white"
                                title={`${p.user.firstName} ${p.user.lastName}`}
                              >
                                {p.user.firstName[0]}
                                {p.user.lastName[0]}
                              </div>
                            ))}
                            {event.participants.length > 5 && (
                              <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs border border-white">
                                +{event.participants.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canCreateEvent() && (
                          <button
                            onClick={() => handleEdit(event)}
                            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                            title={tCommon("actions.edit")}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        )}
                        {canDeleteEvent() && (
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                            title={tCommon("actions.delete")}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className="flex items-center gap-4 mt-1">
                      {event.project && (
                        <span className="text-xs text-gray-500 shrink-0">
                          📁 {event.project.name}
                        </span>
                      )}
                      {event.description && (
                        <p className="text-xs text-gray-500 truncate min-w-0">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center text-gray-500 py-12">
              <span className="text-4xl mb-4 block">📅</span>
              <p>{t("view.calendarSimplified")}</p>
              <p className="text-sm mt-2">{t("view.calendarDescription")}</p>
              <div className="mt-6 space-y-4">
                {getFilteredEvents().map((event) => (
                  <div
                    key={event.id}
                    className="text-left border border-gray-200 rounded-lg p-4 max-w-md mx-auto"
                  >
                    <div className="font-semibold text-gray-900">
                      {event.title}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {formatDate(event.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingEvent ? t("edit.title") : t("create.title")}
            </h2>
            <form
              onSubmit={editingEvent ? handleUpdate : handleCreate}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("create.titleField")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("create.titlePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("create.description")}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("create.descriptionPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("create.date")}
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
                    id="isAllDay"
                    checked={formData.isAllDay}
                    onChange={(e) =>
                      setFormData({ ...formData, isAllDay: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isAllDay" className="text-sm text-gray-700">
                    {t("create.allDay")}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isExternalIntervention"
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
                    htmlFor="isExternalIntervention"
                    className="text-sm text-gray-700"
                  >
                    {t("create.externalIntervention")}
                  </label>
                </div>
              </div>

              {!formData.isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("create.startTime")}
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
                      {t("create.endTime")}
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
                  {t("create.project")}
                </label>
                <select
                  value={formData.projectId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, projectId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("create.noProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <UserMultiSelect
                label={t("create.participants")}
                users={users}
                selectedIds={formData.participantIds}
                onChange={(ids) =>
                  setFormData({ ...formData, participantIds: ids })
                }
                placeholder={t("create.participantsPlaceholder")}
              />

              {services.length > 0 && (
                <ServiceMultiSelect
                  label={t("create.services") || "Services"}
                  services={services}
                  selectedIds={formData.serviceIds}
                  onChange={(ids) =>
                    setFormData({ ...formData, serviceIds: ids })
                  }
                  placeholder={t("create.servicesPlaceholder") || "Inviter des services entiers"}
                  memberCounts={memberCounts}
                />
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("actions.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingEvent
                    ? t("edit.saveButton")
                    : t("create.createButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
