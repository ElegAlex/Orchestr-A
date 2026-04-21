"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import { timeTrackingService } from "@/services/time-tracking.service";
import { projectsService } from "@/services/projects.service";
import { TimeEntry, ActivityType, Project } from "@/types";
import { ProjectIcon } from "@/components/ProjectIcon";
import { TimeEntryModal } from "@/components/time-tracking/TimeEntryModal";
import toast from "react-hot-toast";

export default function TimeTrackingPage() {
  const t = useTranslations("hr.timeTracking");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch time entries
      const entriesData = await timeTrackingService.getMyEntries();
      setEntries(entriesData);

      // Fetch projects (requires projects:read)
      if (hasPermission("projects:read") && user?.id) {
        try {
          const projectsData = await projectsService.getByUser(user.id);
          setProjects(Array.isArray(projectsData) ? projectsData : []);
        } catch (err) {
          setProjects([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching projects:", err);
        }
      }
    } catch (err) {
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        toast.error(t("messages.loadError"));
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette entrée ?")) return;

    try {
      await timeTrackingService.delete(id);
      toast.success(t("messages.deleted"));
      fetchData();
    } catch {
      toast.error(t("messages.deleteError"));
    }
  };

  const getFilteredEntries = () => {
    let filtered = entries;

    if (selectedProject !== "ALL") {
      filtered = filtered.filter((e) => e.projectId === selectedProject);
    }

    if (startDate) {
      filtered = filtered.filter((e) => {
        const entryDate = e.date.split("T")[0];
        return entryDate >= startDate;
      });
    }

    if (endDate) {
      filtered = filtered.filter((e) => {
        const entryDate = e.date.split("T")[0];
        return entryDate <= endDate;
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case ActivityType.DEVELOPMENT:
        return "Développement";
      case ActivityType.MEETING:
        return "Réunion";
      case ActivityType.SUPPORT:
        return "Support";
      case ActivityType.TRAINING:
        return "Formation";
      case ActivityType.OTHER:
        return "Autre";
      default:
        return type;
    }
  };

  const getActivityTypeBadgeColor = (type: ActivityType) => {
    switch (type) {
      case ActivityType.DEVELOPMENT:
        return "bg-blue-100 text-blue-800";
      case ActivityType.MEETING:
        return "bg-purple-100 text-purple-800";
      case ActivityType.SUPPORT:
        return "bg-orange-100 text-orange-800";
      case ActivityType.TRAINING:
        return "bg-green-100 text-green-800";
      case ActivityType.OTHER:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTotalHours = () => {
    return getFilteredEntries().reduce((sum, entry) => sum + entry.hours, 0);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Temps passé</h1>
            <p className="text-gray-600 mt-1">
              {getFilteredEntries().length} entrée(s) - {getTotalHours()}h au
              total
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Saisir du temps</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filtres</h3>
            {(selectedProject !== "ALL" || startDate || endDate) && (
              <button
                onClick={() => {
                  setSelectedProject("ALL");
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-blue-600 hover:text-blue-800 transition"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projet
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Tous les projets</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Toutes les dates"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Toutes les dates"
              />
            </div>
          </div>
        </div>

        {/* Entries List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {getFilteredEntries().length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏱️</div>
              <p className="text-gray-500">{t("noEntries")}</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Saisir votre première entrée
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {getFilteredEntries().map((entry) => (
                <div
                  key={entry.id}
                  className={`p-6 hover:bg-gray-50 transition ${
                    entry.thirdPartyId ? "bg-amber-50/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          {entry.hours}h
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getActivityTypeBadgeColor(
                            entry.activityType,
                          )}`}
                        >
                          {getActivityTypeLabel(entry.activityType)}
                        </span>
                        {entry.thirdPartyId && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            🤝 Tiers
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(entry.date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {entry.thirdParty && (
                        <div className="flex items-center space-x-2 text-sm text-gray-700 mb-1">
                          <span>🤝</span>
                          <span className="font-medium">
                            {entry.thirdParty.organizationName}
                          </span>
                        </div>
                      )}

                      {entry.project && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <ProjectIcon icon={entry.project.icon} size={16} />
                          <span>{entry.project.name}</span>
                        </div>
                      )}

                      {entry.task && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <span>✓</span>
                          <span>{entry.task.title}</span>
                        </div>
                      )}

                      {entry.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {entry.description}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Créé le{" "}
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      {t("actions.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal (composant partagé — cf. V5 / D3) */}
      <TimeEntryModal
        open={showCreateModal}
        mode="create"
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchData();
        }}
      />
    </MainLayout>
  );
}
