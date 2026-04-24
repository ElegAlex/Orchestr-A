import { useState, useEffect, useMemo, useCallback } from "react";
import {
  startOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { planningService } from "@/services/planning.service";
import { Event } from "@/services/events.service";
import { PredefinedTaskAssignment } from "@/services/predefined-tasks.service";
import {
  Task,
  User,
  Leave,
  TeleworkSchedule,
  Service,
  Holiday,
  SchoolVacation,
} from "@/types";
import { getServiceStyle } from "@/lib/planning-utils";
import { useSettingsStore } from "@/stores/settings.store";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";

const DEFAULT_VISIBLE_DAYS: number[] = [1, 2, 3, 4, 5];
const EMPTY_SPECIAL_DAYS: number[] = [];

export type ViewFilter = "all" | "availability" | "activity";

export interface DisplayFilters {
  availability: boolean;
  projectTasks: boolean;
  orphanTasks: boolean;
  events: boolean;
}

export interface DayCell {
  date: Date;
  tasks: Task[];
  leaves: Leave[];
  events: Event[];
  predefinedTaskAssignments: PredefinedTaskAssignment[];
  isTelework: boolean;
  isExternalIntervention: boolean;
  teleworkSchedule: TeleworkSchedule | null;
  isHoliday: boolean;
  holidayName?: string;
  isSpecialDay: boolean;
}

export interface ServiceGroup {
  id: string;
  name: string;
  icon: string;
  isManagement: boolean;
  users: User[];
  color: string;
  hexColor?: string | null;
}

interface UsePlanningDataOptions {
  currentDate: Date;
  viewMode: "week" | "month";
  filterUserId?: string; // Filtrer pour un seul utilisateur
  filterServiceIds?: string[]; // Filtrer pour un ou plusieurs services
  viewFilter?: ViewFilter; // Filtre d'affichage (default: 'all')
  displayFilters?: DisplayFilters; // Filtres granulaires d'affichage
}

interface UsePlanningDataReturn {
  loading: boolean;
  displayDays: Date[];
  users: User[];
  services: Service[];
  tasks: Task[];
  leaves: Leave[];
  events: Event[];
  teleworkSchedules: TeleworkSchedule[];
  holidays: Holiday[];
  schoolVacations: SchoolVacation[];
  groupedUsers: ServiceGroup[];
  filteredGroups: ServiceGroup[];
  getDayCell: (userId: string, date: Date) => DayCell;
  getHolidayForDate: (date: Date) => Holiday | undefined;
  isSpecialDay: (date: Date) => boolean;
  refetch: () => Promise<void>;
  lateThresholdDays: number;
  silentRefetch: () => Promise<void>;
  getGroupTaskCount: (groupUsers: User[]) => number;
  predefinedAssignments: PredefinedTaskAssignment[];
}

export const usePlanningData = ({
  currentDate,
  viewMode,
  filterUserId,
  filterServiceIds,
  viewFilter = "all",
  displayFilters,
}: UsePlanningDataOptions): UsePlanningDataReturn => {
  const { permissionsLoaded } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [teleworkSchedules, setTeleworkSchedules] = useState<
    TeleworkSchedule[]
  >([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [schoolVacations, setSchoolVacations] = useState<SchoolVacation[]>([]);
  const [predefinedAssignments, setPredefinedAssignments] = useState<
    PredefinedTaskAssignment[]
  >([]);
  const [lateThresholdDays, setLateThresholdDays] = useState<number>(1);

  // Lire les jours visibles depuis les paramètres (ISO: 1=Lun, 7=Dim)
  const visibleDays = useSettingsStore(
    (state) =>
      (state.settings["planning.visibleDays"] as number[] | undefined) ??
      DEFAULT_VISIBLE_DAYS,
  );

  // Lire les jours spéciaux depuis les paramètres (ISO: 1=Lun, 7=Dim)
  const specialDays = useSettingsStore(
    (state) =>
      (state.settings["planning.specialDays"] as number[] | undefined) ??
      EMPTY_SPECIAL_DAYS,
  );

  // Calculer les jours à afficher et la plage de requête complète
  const { displayDays, queryStartDate, queryEndDate } = useMemo(() => {
    // Convertir ISO (1=Lun..7=Dim) en JS getDay() (0=Dim..6=Sam)
    const jsVisibleDays = visibleDays.map((d) => (d === 7 ? 0 : d));

    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { locale: fr, weekStartsOn: 1 });
      const allDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const filtered = allDays.filter((d) =>
        jsVisibleDays.includes(d.getDay()),
      );
      return {
        displayDays: filtered,
        queryStartDate: startOfDay(allDays[0]),
        queryEndDate: endOfDay(allDays[allDays.length - 1]),
      };
    } else {
      const start = startOfWeek(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        { locale: fr, weekStartsOn: 1 },
      );
      const daysInMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ).getDate();
      const totalDays = Math.ceil((daysInMonth + start.getDay()) / 7) * 7;
      const allGridDays = Array.from({ length: totalDays }, (_, i) =>
        addDays(start, i),
      );
      const filtered = allGridDays.filter(
        (d) =>
          d.getMonth() === currentDate.getMonth() &&
          jsVisibleDays.includes(d.getDay()),
      );
      return {
        displayDays: filtered,
        // Query covers the full calendar grid (Mon of first week → Sun of last week)
        // so cross-boundary leaves (e.g. Dec 29 – Jan 2) are not missed
        queryStartDate: startOfDay(allGridDays[0]),
        queryEndDate: endOfDay(allGridDays[allGridDays.length - 1]),
      };
    }
  }, [currentDate, viewMode, visibleDays]);

  // Fetch data
  const fetchData = useCallback(
    async (silent = false) => {
      if (displayDays.length === 0) return;
      // Attendre que les permissions soient chargées avant de fetch
      if (!permissionsLoaded) return;
      try {
        if (!silent) setLoading(true);

        // Un seul appel agrégé remplace les 9 requêtes parallèles historiques.
        // Évacue toute pression sur le rate limit nginx et garantit la
        // cohérence transactionnelle entre datasets (même snapshot DB).
        const overview = await planningService.getOverview(
          queryStartDate.toISOString(),
          queryEndDate.toISOString(),
        );

        setUsers(
          overview.users.filter(
            (u) => u.isActive && u.userServices && u.userServices.length > 0,
          ),
        );
        setTasks(overview.tasks);
        setLeaves(overview.leaves);
        setEvents(overview.events);
        setTeleworkSchedules(overview.telework);
        setServices(overview.services);
        setHolidays(overview.holidays);
        setSchoolVacations(overview.schoolVacations);
        setPredefinedAssignments(overview.predefinedAssignments);
        setLateThresholdDays(overview.settings?.lateThresholdDays ?? 1);
      } catch (err) {
        if (!silent) {
          setUsers([]);
          setTasks([]);
          setLeaves([]);
          setEvents([]);
          setTeleworkSchedules([]);
          setServices([]);
          setHolidays([]);
          setSchoolVacations([]);
          setPredefinedAssignments([]);
          toast.error("Erreur lors du chargement des données");
        }
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [displayDays, queryStartDate, queryEndDate, permissionsLoaded],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Identifier les managers (encadrement) — par structure organisationnelle
  const isManager = (u: User): boolean => {
    // Est manager d'au moins un service
    if (u.managedServices && u.managedServices.length > 0) return true;
    // Est manager du département
    if (u.department?.managerId === u.id) return true;
    return false;
  };

  // Regrouper les utilisateurs par service avec section Encadrement
  const groupedUsers = useMemo((): ServiceGroup[] => {
    if (users.length === 0) return [];

    const managementUsers = users.filter(isManager);
    const nonManagers = users.filter((u) => !isManager(u));

    const groups: ServiceGroup[] = [];

    // 1. Section Encadrement en premier (si des managers existent)
    if (managementUsers.length > 0) {
      groups.push({
        id: "management",
        name: "Encadrement",
        icon: "",
        isManagement: true,
        users: managementUsers.sort((a, b) =>
          a.lastName.localeCompare(b.lastName),
        ),
        color: "amber",
      });
    }

    // 2. Regrouper les non-managers par service
    const serviceMap = new Map<string, User[]>();
    const usersWithoutService: User[] = [];

    for (const u of nonManagers) {
      if (u.userServices && u.userServices.length > 0) {
        // Prendre le premier service de l'utilisateur
        const firstService = u.userServices[0].service;
        if (!serviceMap.has(firstService.id)) {
          serviceMap.set(firstService.id, []);
        }
        serviceMap.get(firstService.id)!.push(u);
      } else {
        usersWithoutService.push(u);
      }
    }

    // Trier les services par nom et créer les groupes
    const sortedServices = services
      .filter((s) => serviceMap.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const service of sortedServices) {
      const serviceUsers = serviceMap.get(service.id) || [];
      if (serviceUsers.length > 0) {
        const style = getServiceStyle(service.name);
        groups.push({
          id: service.id,
          name: service.name,
          icon: style.icon,
          isManagement: false,
          users: serviceUsers.sort((a, b) =>
            a.lastName.localeCompare(b.lastName),
          ),
          color: style.color,
          hexColor: service.color || null,
        });
      }
    }

    // 3. Section "Sans service" pour les orphelins
    if (usersWithoutService.length > 0) {
      groups.push({
        id: "unassigned",
        name: "Sans service",
        icon: "",
        isManagement: false,
        users: usersWithoutService.sort((a, b) =>
          a.lastName.localeCompare(b.lastName),
        ),
        color: "gray",
      });
    }

    return groups;
  }, [users, services]);

  // Filtrer les groupes selon filterUserId et/ou filterServiceIds
  const filteredGroups = useMemo(() => {
    let result = groupedUsers;

    // Filtrer par services si spécifié (tableau de IDs)
    if (filterServiceIds && filterServiceIds.length > 0) {
      result = result.filter((group) => filterServiceIds.includes(group.id));
    }

    // Filtrer par utilisateur si spécifié
    if (filterUserId) {
      result = result
        .map((group) => ({
          ...group,
          users: group.users.filter((u) => u.id === filterUserId),
        }))
        .filter((group) => group.users.length > 0);
    }

    return result;
  }, [groupedUsers, filterUserId, filterServiceIds]);

  // Vérifier si un jour est marqué comme "spécial" (fond distinctif)
  const isSpecialDay = useCallback(
    (date: Date): boolean => {
      // Convertir JS getDay() (0=Dim..6=Sam) en ISO (1=Lun..7=Dim)
      const jsDay = date.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;
      return specialDays.includes(isoDay);
    },
    [specialDays],
  );

  // Obtenir les données d'une cellule (avec filtrage selon viewFilter)
  const getDayCell = useCallback(
    (userId: string, date: Date): DayCell => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayPredefinedAssignments = predefinedAssignments.filter(
        (a) => a.userId === userId && a.date.slice(0, 10) === dateStr,
      );
      const dayTasks = tasks.filter((t) => {
        // Le filtrage des tâches DONE est délégué au filtre légende côté DayCell
        // (filtre "Terminé" du popover — décoché par défaut pour préserver
        // le comportement historique). Cf. planningView.store.ts.
        // Vérifier si la date est dans la plage de la tâche (startDate <= date <= endDate)
        // Si pas de startDate, on utilise endDate comme seul jour
        // Si pas de endDate, la tâche n'apparaît pas dans le planning
        if (!t.endDate) return false;

        const taskEnd = startOfDay(new Date(t.endDate));
        const taskStart = t.startDate
          ? startOfDay(new Date(t.startDate))
          : taskEnd;
        const checkDate = startOfDay(date);

        // Vérifier que la date est dans l'intervalle [startDate, endDate]
        if (!isWithinInterval(checkDate, { start: taskStart, end: taskEnd }))
          return false;

        // Vérifier si l'utilisateur est assigné (assigneeId principal ou dans assignees)
        if (t.assigneeId === userId) return true;
        if (
          t.assignees &&
          t.assignees.some((a) => a.userId === userId || a.user?.id === userId)
        )
          return true;
        return false;
      });
      // Filtrer les événements pour cet utilisateur et cette date
      const dayEvents = events.filter((e) => {
        const eventDate = startOfDay(new Date(e.date));
        const checkDate = startOfDay(date);
        if (!isSameDay(eventDate, checkDate)) return false;
        // Vérifier si l'utilisateur est participant
        if (e.participants && e.participants.length > 0) {
          return e.participants.some((p) => p.userId === userId);
        }
        return false;
      });
      // Vérifier si la date est dans la plage du congé (startDate <= date <= endDate)
      // Inclure tous les congés sauf les rejetés (PENDING et APPROVED)
      const dayLeaves = leaves.filter((l) => {
        if (l.userId !== userId || l.status === "REJECTED") return false;
        const leaveStart = startOfDay(parseISO(l.startDate));
        const leaveEnd = startOfDay(parseISO(l.endDate));
        const checkDate = startOfDay(date);
        return isWithinInterval(checkDate, {
          start: leaveStart,
          end: leaveEnd,
        });
      });
      const teleworkSchedule = teleworkSchedules.find(
        (ts) => ts.userId === userId && isSameDay(new Date(ts.date), date),
      );

      // Vérifier si c'est un jour férié
      const holiday = holidays.find((h) => {
        const holidayDateStr =
          typeof h.date === "string"
            ? h.date.slice(0, 10)
            : format(new Date(h.date), "yyyy-MM-dd");
        return holidayDateStr === dateStr;
      });

      // Vérifier si c'est une intervention extérieure (via tâche, événement ou tâche prédéfinie)
      const hasExternalIntervention =
        dayTasks.some((t) => t.isExternalIntervention) ||
        dayEvents.some((e) => e.isExternalIntervention) ||
        dayPredefinedAssignments.some(
          (a) => a.predefinedTask?.isExternalIntervention,
        );

      // Appliquer le filtre d'affichage
      let filteredTasks = dayTasks;
      let filteredEvents = dayEvents;
      let filteredLeaves = dayLeaves;
      let filteredIsTelework = teleworkSchedule?.isTelework || false;
      let filteredIsExternalIntervention = hasExternalIntervention;

      if (displayFilters) {
        // Mode granulaire : filtrer par catégorie
        if (!displayFilters.availability) {
          filteredLeaves = [];
          filteredIsTelework = false;
          filteredIsExternalIntervention = false;
        }
        if (!displayFilters.projectTasks && !displayFilters.orphanTasks) {
          filteredTasks = [];
        } else if (!displayFilters.projectTasks) {
          filteredTasks = filteredTasks.filter((t) => !t.projectId);
        } else if (!displayFilters.orphanTasks) {
          filteredTasks = filteredTasks.filter((t) => !!t.projectId);
        }
        if (!displayFilters.events) {
          filteredEvents = [];
        }
      } else if (viewFilter === "availability") {
        // Mode legacy "Disponibilités"
        filteredTasks = [];
        filteredEvents = [];
      } else if (viewFilter === "activity") {
        // Mode legacy "Activités"
        filteredLeaves = [];
        filteredIsTelework = false;
        filteredIsExternalIntervention = false;
      }

      // Tri chronologique par heure de début
      filteredTasks.sort((a, b) =>
        (a.startTime || "00:00").localeCompare(b.startTime || "00:00"),
      );
      filteredEvents.sort((a, b) =>
        (a.startTime || "00:00").localeCompare(b.startTime || "00:00"),
      );

      return {
        date,
        tasks: filteredTasks,
        events: filteredEvents,
        leaves: filteredLeaves,
        predefinedTaskAssignments:
          (displayFilters &&
            !displayFilters.orphanTasks &&
            !displayFilters.projectTasks) ||
          viewFilter === "availability"
            ? []
            : dayPredefinedAssignments,
        isTelework: filteredIsTelework,
        isExternalIntervention: filteredIsExternalIntervention,
        teleworkSchedule: teleworkSchedule || null,
        isHoliday: !!holiday,
        holidayName: holiday?.name,
        isSpecialDay: isSpecialDay(date),
      };
    },
    [
      tasks,
      events,
      leaves,
      teleworkSchedules,
      holidays,
      predefinedAssignments,
      viewFilter,
      displayFilters,
      isSpecialDay,
    ],
  );

  // Compter les tâches par groupe
  const getGroupTaskCount = (groupUsers: User[]): number => {
    return tasks.filter((t) => {
      // Vérifier assigneeId principal
      if (groupUsers.some((u) => u.id === t.assigneeId)) return true;
      // Vérifier dans assignees multiples
      if (
        t.assignees &&
        t.assignees.some((a) =>
          groupUsers.some((u) => u.id === a.userId || u.id === a.user?.id),
        )
      )
        return true;
      return false;
    }).length;
  };

  // Obtenir le jour férié pour une date donnée
  const getHolidayForDate = useCallback(
    (date: Date): Holiday | undefined => {
      const dateStr = format(date, "yyyy-MM-dd");
      return holidays.find((h) => {
        const holidayDateStr =
          typeof h.date === "string"
            ? h.date.slice(0, 10)
            : format(new Date(h.date), "yyyy-MM-dd");
        return holidayDateStr === dateStr;
      });
    },
    [holidays],
  );

  return {
    loading,
    displayDays,
    users,
    services,
    tasks,
    leaves,
    events,
    teleworkSchedules,
    holidays,
    schoolVacations,
    groupedUsers,
    filteredGroups,
    getDayCell,
    getHolidayForDate,
    isSpecialDay,
    refetch: fetchData,
    silentRefetch: () => fetchData(true),
    getGroupTaskCount,
    lateThresholdDays,
    predefinedAssignments,
  };
};
