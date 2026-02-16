"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { addWeeks, subWeeks, format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { PlanningGrid } from "./PlanningGrid";
import { TaskCreateModal } from "./TaskCreateModal";
import { EventCreateModal } from "./EventCreateModal";
import { usePlanningData } from "@/hooks/usePlanningData";
import { useAuthStore } from "@/stores/auth.store";
import { usePlanningViewStore } from "@/stores/planningView.store";
import { useTranslations, useLocale } from "next-intl";

type ViewFilter = "all" | "availability" | "activity";

interface PlanningViewProps {
  filterUserId?: string; // Filtrer pour un utilisateur spécifique (pour dashboard)
  title?: string; // Titre personnalisé
  showFilters?: boolean; // Afficher les filtres (default: true)
  showControls?: boolean; // Afficher les contrôles (semaine/mois, navigation) (default: true)
  showGroupHeaders?: boolean; // Afficher les headers de groupes (default: true)
  showLegend?: boolean; // Afficher la légende (default: true)
  initialViewMode?: "week" | "month"; // Mode initial (default: 'week')
}

export const PlanningView = ({
  filterUserId,
  title,
  showFilters = true,
  showControls = true,
  showGroupHeaders = true,
  showLegend = true,
  initialViewMode = "week",
}: PlanningViewProps) => {
  const t = useTranslations("planning");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : fr;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">(initialViewMode);
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [hasInitializedServices, setHasInitializedServices] = useState(false);
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const [showEventCreateModal, setShowEventCreateModal] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user: currentUser } = useAuthStore();

  // Utiliser filterUserId si fourni, sinon utiliser le filtre de l'interface
  const effectiveFilterUserId =
    filterUserId || (selectedUser !== "ALL" ? selectedUser : undefined);
  // Si aucun service n'est sélectionné, ne pas filtrer (afficher tous)
  const effectiveFilterServiceIds =
    selectedServices.length > 0 ? selectedServices : undefined;

  const { displayDays, users, groupedUsers, refetch } = usePlanningData({
    currentDate,
    viewMode,
    filterUserId: effectiveFilterUserId,
    filterServiceIds: effectiveFilterServiceIds,
    viewFilter,
  });

  // Store pour les services collapsibles
  const { collapsedServices, collapseAll, expandAll } = usePlanningViewStore();

  // Calculer les IDs des services visibles
  const serviceIds = useMemo(
    () => groupedUsers.map((g) => g.id),
    [groupedUsers],
  );

  // Vérifier si tous les services sont repliés ou dépliés
  const allCollapsed = useMemo(
    () =>
      serviceIds.length > 0 && serviceIds.every((id) => collapsedServices[id]),
    [serviceIds, collapsedServices],
  );
  const allExpanded = useMemo(
    () => serviceIds.every((id) => !collapsedServices[id]),
    [serviceIds, collapsedServices],
  );

  const handleCollapseAll = () => collapseAll(serviceIds);
  const handleExpandAll = () => expandAll();

  // Initialiser la sélection de services avec les services de l'utilisateur connecté par défaut
  useEffect(() => {
    if (groupedUsers.length > 0 && !hasInitializedServices) {
      // Récupérer les IDs des services de l'utilisateur connecté
      const userServiceIds =
        currentUser?.userServices?.map((us) => us.service.id) || [];

      // Si l'utilisateur est manager, inclure aussi le groupe "management"
      const isManager =
        currentUser?.role === "MANAGER" ||
        currentUser?.role === "RESPONSABLE" ||
        (currentUser?.managedServices &&
          currentUser.managedServices.length > 0);

      if (userServiceIds.length > 0 || isManager) {
        // Filtrer pour ne garder que les services qui existent dans groupedUsers
        const validServiceIds = userServiceIds.filter((id) =>
          groupedUsers.some((g) => g.id === id),
        );

        // Ajouter "management" si l'utilisateur est manager
        if (isManager && groupedUsers.some((g) => g.id === "management")) {
          validServiceIds.push("management");
        }

        // Si des services valides ont été trouvés, les utiliser
        if (validServiceIds.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedServices(validServiceIds);
        } else {
          // Sinon, sélectionner tous les services

          setSelectedServices(groupedUsers.map((g) => g.id));
        }
      } else {
        // Utilisateur sans service assigné : afficher tous les services

        setSelectedServices(groupedUsers.map((g) => g.id));
      }

      setHasInitializedServices(true);
    }
  }, [groupedUsers, currentUser, hasInitializedServices]);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fermer le menu créer quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        createMenuRef.current &&
        !createMenuRef.current.contains(event.target as Node)
      ) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    );
  };

  const selectAllServices = () => {
    setSelectedServices(groupedUsers.map((g) => g.id));
  };

  const deselectAllServices = () => {
    setSelectedServices([]);
  };

  const allServicesSelected =
    groupedUsers.length > 0 && selectedServices.length === groupedUsers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title || t("title")}</h1>
          <p className="text-gray-600 mt-1">
            {viewMode === "week"
              ? t("weekOf", {
                  start: format(displayDays[0] || new Date(), "dd MMM", {
                    locale: dateLocale,
                  }),
                  end: format(
                    displayDays[displayDays.length - 1] || new Date(),
                    "dd MMM yyyy",
                    {
                      locale: dateLocale,
                    },
                  ),
                })
              : format(currentDate, "MMMM yyyy", { locale: dateLocale })}
          </p>
        </div>
        {showControls && (
          <div className="flex items-center space-x-4">
            {/* Bouton Créer avec dropdown */}
            <div className="relative" ref={createMenuRef}>
              <button
                onClick={() => setShowCreateMenu(!showCreateMenu)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
              >
                <span>+</span>
                <span>{t("create")}</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={() => {
                      setShowTaskCreateModal(true);
                      setShowCreateMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition flex items-center space-x-2"
                  >
                    <span>📋</span>
                    <span>{t("createMenu.task")}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowEventCreateModal(true);
                      setShowCreateMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition flex items-center space-x-2"
                  >
                    <span>📅</span>
                    <span>{t("createMenu.event")}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === "week"
                    ? "bg-white shadow-sm font-medium"
                    : "text-gray-600"
                }`}
              >
                {t("week")}
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1 rounded text-sm transition ${
                  viewMode === "month"
                    ? "bg-white shadow-sm font-medium"
                    : "text-gray-600"
                }`}
              >
                {t("month")}
              </button>
            </div>
            <button
              onClick={() =>
                viewMode === "week"
                  ? setCurrentDate(subWeeks(currentDate, 1))
                  : setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                        1,
                      ),
                    )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">←</span>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              {t("today")}
            </button>
            <button
              onClick={() =>
                viewMode === "week"
                  ? setCurrentDate(addWeeks(currentDate, 1))
                  : setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                        1,
                      ),
                    )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">→</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && !filterUserId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <div
              className="flex items-center space-x-2 relative"
              ref={dropdownRef}
            >
              <label className="text-sm font-medium text-gray-700">
                {t("filters.services")}
              </label>
              <button
                onClick={() => setShowServiceDropdown(!showServiceDropdown)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[200px] text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedServices.length === 0
                    ? t("filters.noService")
                    : selectedServices.length === groupedUsers.length
                      ? t("filters.allServices")
                      : selectedServices.length === 1
                        ? t("filters.servicesCount", { count: selectedServices.length })
                        : t("filters.servicesCountPlural", { count: selectedServices.length })}
                </span>
                <span className="ml-2">
                  {showServiceDropdown ? "\u25B2" : "\u25BC"}
                </span>
              </button>
              {showServiceDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[250px]">
                  <div className="p-2 border-b border-gray-200 flex gap-2">
                    <button
                      onClick={selectAllServices}
                      className={`px-3 py-1 text-xs rounded ${
                        allServicesSelected
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t("filters.all")}
                    </button>
                    <button
                      onClick={deselectAllServices}
                      className={`px-3 py-1 text-xs rounded ${
                        selectedServices.length === 0
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t("filters.none")}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {groupedUsers.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(group.id)}
                          onChange={() => toggleService(group.id)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="mr-2">{group.icon}</span>
                        <span className="flex-1">{group.name}</span>
                        <span className="text-gray-500 text-sm">
                          ({group.users.length})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                {t("filters.resource")}
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">{t("filters.allResources")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                {t("filters.display")}
              </label>
              <select
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t("filters.displayAll")}</option>
                <option value="availability">{t("filters.displayAvailability")}</option>
                <option value="activity">{t("filters.displayActivity")}</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 ml-auto">
              {/* Boutons Replier/Déplier tous les services */}
              <div className="flex items-center space-x-2 border-r border-gray-300 pr-3">
                <button
                  onClick={handleCollapseAll}
                  disabled={allCollapsed}
                  className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                  title={t("actions.collapseAll")}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  {t("actions.collapse")}
                </button>
                <button
                  onClick={handleExpandAll}
                  disabled={allExpanded}
                  className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                  title={t("actions.expandAll")}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  {t("actions.expand")}
                </button>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded mr-1"></span>
                  {t("legend.task")}
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded mr-1"></span>
                  {t("legend.leave")}
                </span>
                <span className="flex items-center">
                  <span>🏠</span>{t("legend.telework")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planning Grid */}
      <PlanningGrid
        currentDate={currentDate}
        viewMode={viewMode}
        filterUserId={effectiveFilterUserId}
        filterServiceIds={effectiveFilterServiceIds}
        viewFilter={viewFilter}
        showGroupHeaders={showGroupHeaders}
        refreshTrigger={refreshTrigger}
      />

      {/* Legend */}
      {showLegend && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("legend.title")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <span>○</span>
              <span>{tCommon("taskStatus.TODO")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>◐</span>
              <span>{tCommon("taskStatus.IN_PROGRESS")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>◕</span>
              <span>{tCommon("taskStatus.IN_REVIEW")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>●</span>
              <span>{tCommon("taskStatus.DONE")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>⊗</span>
              <span>{tCommon("taskStatus.BLOCKED")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏠</span>
              <span>{t("legend.telework")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏢</span>
              <span>{t("legend.office")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🌴</span>
              <span>{t("legend.leaveValidated")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="opacity-60">🌴?</span>
              <span>{t("legend.leavePending")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>📅</span>
              <span>{t("legend.event")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded"></span>
              <span>{t("legend.externalIntervention")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        isOpen={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => { refetch(); setRefreshTrigger((prev) => prev + 1); }}
      />
      <EventCreateModal
        isOpen={showEventCreateModal}
        onClose={() => setShowEventCreateModal(false)}
        onSuccess={() => { refetch(); setRefreshTrigger((prev) => prev + 1); }}
      />
    </div>
  );
};
