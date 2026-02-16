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
import { tasksService } from "@/services/tasks.service";
import { usersService } from "@/services/users.service";
import { leavesService } from "@/services/leaves.service";
import { teleworkService } from "@/services/telework.service";
import { servicesService } from "@/services/services.service";
import { holidaysService } from "@/services/holidays.service";
import { eventsService, Event } from "@/services/events.service";
import {
  Task,
  User,
  Leave,
  TeleworkSchedule,
  Service,
  Role,
  Holiday,
} from "@/types";
import { getServiceStyle } from "@/lib/planning-utils";
import toast from "react-hot-toast";

export type ViewFilter = "all" | "availability" | "activity";

export interface DayCell {
  date: Date;
  tasks: Task[];
  leaves: Leave[];
  events: Event[];
  isTelework: boolean;
  isExternalIntervention: boolean;
  teleworkSchedule: TeleworkSchedule | null;
  isHoliday: boolean;
  holidayName?: string;
}

export interface ServiceGroup {
  id: string;
  name: string;
  icon: string;
  isManagement: boolean;
  users: User[];
  color: string;
}

interface UsePlanningDataOptions {
  currentDate: Date;
  viewMode: "week" | "month";
  filterUserId?: string; // Filtrer pour un seul utilisateur
  filterServiceIds?: string[]; // Filtrer pour un ou plusieurs services
  viewFilter?: ViewFilter; // Filtre d'affichage (default: 'all')
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
  groupedUsers: ServiceGroup[];
  filteredGroups: ServiceGroup[];
  getDayCell: (userId: string, date: Date) => DayCell;
  getHolidayForDate: (date: Date) => Holiday | undefined;
  refetch: () => Promise<void>;
  silentRefetch: () => Promise<void>;
  getGroupTaskCount: (groupUsers: User[]) => number;
}

export const usePlanningData = ({
  currentDate,
  viewMode,
  filterUserId,
  filterServiceIds,
  viewFilter = "all",
}: UsePlanningDataOptions): UsePlanningDataReturn => {
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

  // Calculer les jours à afficher
  const displayDays = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { locale: fr, weekStartsOn: 1 });
      return Array.from({ length: 5 }, (_, i) => addDays(start, i));
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
      return Array.from({ length: totalDays }, (_, i) =>
        addDays(start, i),
      ).filter(
        (d) =>
          d.getMonth() === currentDate.getMonth() &&
          d.getDay() !== 0 &&
          d.getDay() !== 6,
      );
    }
  }, [currentDate, viewMode]);

  // Fetch data
  const fetchData = useCallback(
    async (silent = false) => {
      if (displayDays.length === 0) return;
      try {
        if (!silent) setLoading(true);
        const startDate = startOfDay(displayDays[0]);
        const endDate = endOfDay(displayDays[displayDays.length - 1]);

        // Format YYYY-MM-DD pour telework (évite les problèmes de timezone)
        const teleworkStartDate = format(startDate, "yyyy-MM-dd");
        const teleworkEndDate = format(endDate, "yyyy-MM-dd");

        const [
          usersData,
          tasksData,
          leavesData,
          eventsData,
          teleworkData,
          servicesData,
          holidaysData,
        ] = await Promise.all([
          usersService.getAll(),
          tasksService.getByDateRange(
            startDate.toISOString(),
            endDate.toISOString(),
          ),
          leavesService.getByDateRange(
            startDate.toISOString(),
            endDate.toISOString(),
          ),
          eventsService.getByRange(teleworkStartDate, teleworkEndDate),
          teleworkService.getByDateRange(teleworkStartDate, teleworkEndDate),
          servicesService.getAll(),
          holidaysService.getByRange(teleworkStartDate, teleworkEndDate),
        ]);

        const usersList = Array.isArray(usersData)
          ? usersData
          : Array.isArray(usersData?.data)
            ? usersData.data
            : [];

        setUsers(
          Array.isArray(usersList) ? usersList.filter((u) => u.isActive) : [],
        );
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setLeaves(Array.isArray(leavesData) ? leavesData : []);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setTeleworkSchedules(Array.isArray(teleworkData) ? teleworkData : []);
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
      } catch (err) {
        if (!silent) {
          setUsers([]);
          setTasks([]);
          setLeaves([]);
          setEvents([]);
          setTeleworkSchedules([]);
          setServices([]);
          setHolidays([]);
          toast.error("Erreur lors du chargement des données");
        }
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [displayDays],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Identifier les managers (encadrement)
  const isManager = (u: User): boolean => {
    // Par rôle
    if (u.role === Role.MANAGER || u.role === Role.RESPONSABLE) return true;
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

  // Obtenir les données d'une cellule (avec filtrage selon viewFilter)
  const getDayCell = useCallback(
    (userId: string, date: Date): DayCell => {
      const dayTasks = tasks.filter((t) => {
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
      const dateStr = format(date, "yyyy-MM-dd");
      const holiday = holidays.find((h) => {
        const holidayDateStr =
          typeof h.date === "string"
            ? h.date.slice(0, 10)
            : format(new Date(h.date), "yyyy-MM-dd");
        return holidayDateStr === dateStr;
      });

      // Vérifier si c'est une intervention extérieure (via événement)
      const hasExternalIntervention = dayEvents.some(
        (e) => e.isExternalIntervention,
      );

      // Appliquer le filtre d'affichage
      let filteredTasks = dayTasks;
      let filteredEvents = dayEvents;
      let filteredLeaves = dayLeaves;
      let filteredIsTelework = teleworkSchedule?.isTelework || false;
      let filteredIsExternalIntervention = hasExternalIntervention;

      if (viewFilter === "availability") {
        // Mode "Disponibilités" : afficher uniquement les congés, télétravail et interventions ext.
        filteredTasks = []; // Masquer toutes les tâches
        filteredEvents = []; // Masquer les événements
      } else if (viewFilter === "activity") {
        // Mode "Activités" : afficher uniquement les tâches et événements
        filteredLeaves = []; // Masquer les congés
        filteredIsTelework = false; // Masquer le télétravail
        filteredIsExternalIntervention = false; // Masquer les interventions ext.
      }

      // Tri chronologique par heure de début
      filteredTasks.sort((a, b) =>
        (a.startTime || "00:00").localeCompare(b.startTime || "00:00")
      );
      filteredEvents.sort((a, b) =>
        (a.startTime || "00:00").localeCompare(b.startTime || "00:00")
      );

      return {
        date,
        tasks: filteredTasks,
        events: filteredEvents,
        leaves: filteredLeaves,
        isTelework: filteredIsTelework,
        isExternalIntervention: filteredIsExternalIntervention,
        teleworkSchedule: teleworkSchedule || null,
        isHoliday: !!holiday,
        holidayName: holiday?.name,
      };
    },
    [tasks, events, leaves, teleworkSchedules, holidays, viewFilter],
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
    groupedUsers,
    filteredGroups,
    getDayCell,
    getHolidayForDate,
    refetch: fetchData,
    silentRefetch: () => fetchData(true),
    getGroupTaskCount,
  };
};
