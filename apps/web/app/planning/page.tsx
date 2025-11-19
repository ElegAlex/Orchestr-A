'use client';

import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { tasksService } from '@/services/tasks.service';
import { usersService } from '@/services/users.service';
import { leavesService } from '@/services/leaves.service';
import { teleworkService } from '@/services/telework.service';
import { servicesService } from '@/services/services.service';
import { Task, User, Leave, TeleworkSchedule, TaskStatus, Priority, Role, Service } from '@/types';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday, startOfDay, endOfDay, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DayCell {
  date: Date;
  tasks: Task[];
  leaves: Leave[];
  isTelework: boolean;
  teleworkSchedule: TeleworkSchedule | null;
}

interface ServiceGroup {
  id: string;
  name: string;
  icon: string;
  isManagement: boolean;
  users: User[];
  color: string; // Couleur du groupe
}

export default function PlanningPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [teleworkSchedules, setTeleworkSchedules] = useState<TeleworkSchedule[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const displayDays = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { locale: fr, weekStartsOn: 1 });
      return Array.from({ length: 5 }, (_, i) => addDays(start, i));
    } else {
      const start = startOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), { locale: fr, weekStartsOn: 1 });
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const totalDays = Math.ceil((daysInMonth + start.getDay()) / 7) * 7;
      return Array.from({ length: totalDays }, (_, i) => addDays(start, i))
        .filter(d => d.getMonth() === currentDate.getMonth() && d.getDay() !== 0 && d.getDay() !== 6);
    }
  }, [currentDate, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const startDate = startOfDay(displayDays[0]);
      const endDate = endOfDay(displayDays[displayDays.length - 1]);

      // Format YYYY-MM-DD pour telework (évite les problèmes de timezone)
      const teleworkStartDate = format(startDate, 'yyyy-MM-dd');
      const teleworkEndDate = format(endDate, 'yyyy-MM-dd');

      const [usersData, tasksData, leavesData, teleworkData, servicesData] = await Promise.all([
        usersService.getAll(),
        tasksService.getByDateRange(startDate.toISOString(), endDate.toISOString()),
        leavesService.getByDateRange(startDate.toISOString(), endDate.toISOString()),
        teleworkService.getByDateRange(teleworkStartDate, teleworkEndDate),
        servicesService.getAll(),
      ]);

      const usersList = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.data) ? usersData.data : []);
      setUsers(Array.isArray(usersList) ? usersList.filter((u) => u.isActive) : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setLeaves(Array.isArray(leavesData) ? leavesData : []);
      setTeleworkSchedules(Array.isArray(teleworkData) ? teleworkData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (error: any) {
      setUsers([]);
      setTasks([]);
      setLeaves([]);
      setTeleworkSchedules([]);
      setServices([]);
      toast.error('Erreur lors du chargement des données');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (displayDays.length > 0) {
      fetchData();
    }
  }, [currentDate, viewMode]);

  // Fonction pour obtenir la couleur d'un service
  const getServiceStyle = (serviceName: string): { icon: string; color: string } => {
    const name = serviceName.toLowerCase();
    if (name.includes('développement') || name.includes('dev') || name.includes('informatique') || name.includes('technique'))
      return { icon: '', color: 'blue' };
    if (name.includes('admin') || name.includes('gestion') || name.includes('finance'))
      return { icon: '', color: 'emerald' };
    if (name.includes('communication') || name.includes('marketing'))
      return { icon: '', color: 'purple' };
    if (name.includes('rh') || name.includes('ressources humaines'))
      return { icon: '', color: 'pink' };
    if (name.includes('juridique') || name.includes('legal'))
      return { icon: '', color: 'slate' };
    if (name.includes('support') || name.includes('assistance'))
      return { icon: '', color: 'cyan' };
    if (name.includes('projet') || name.includes('pmo'))
      return { icon: '', color: 'indigo' };
    return { icon: '', color: 'gray' };
  };

  // Couleurs par groupe
  const getGroupColors = (color: string, isManagement: boolean) => {
    if (isManagement) {
      return {
        header: 'bg-gradient-to-r from-amber-100 to-amber-50 border-l-4 border-amber-500',
        text: 'text-amber-900',
        badge: 'bg-amber-500',
        border: 'border-l-4 border-amber-300',
        avatar: 'bg-amber-600'
      };
    }

    const colorMap: Record<string, any> = {
      blue: {
        header: 'bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-500',
        text: 'text-blue-900',
        badge: 'bg-blue-500',
        border: 'border-l-4 border-blue-300',
        avatar: 'bg-blue-600'
      },
      emerald: {
        header: 'bg-gradient-to-r from-emerald-100 to-emerald-50 border-l-4 border-emerald-500',
        text: 'text-emerald-900',
        badge: 'bg-emerald-500',
        border: 'border-l-4 border-emerald-300',
        avatar: 'bg-emerald-600'
      },
      purple: {
        header: 'bg-gradient-to-r from-purple-100 to-purple-50 border-l-4 border-purple-500',
        text: 'text-purple-900',
        badge: 'bg-purple-500',
        border: 'border-l-4 border-purple-300',
        avatar: 'bg-purple-600'
      },
      pink: {
        header: 'bg-gradient-to-r from-pink-100 to-pink-50 border-l-4 border-pink-500',
        text: 'text-pink-900',
        badge: 'bg-pink-500',
        border: 'border-l-4 border-pink-300',
        avatar: 'bg-pink-600'
      },
      slate: {
        header: 'bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-slate-500',
        text: 'text-slate-900',
        badge: 'bg-slate-500',
        border: 'border-l-4 border-slate-300',
        avatar: 'bg-slate-600'
      },
      cyan: {
        header: 'bg-gradient-to-r from-cyan-100 to-cyan-50 border-l-4 border-cyan-500',
        text: 'text-cyan-900',
        badge: 'bg-cyan-500',
        border: 'border-l-4 border-cyan-300',
        avatar: 'bg-cyan-600'
      },
      indigo: {
        header: 'bg-gradient-to-r from-indigo-100 to-indigo-50 border-l-4 border-indigo-500',
        text: 'text-indigo-900',
        badge: 'bg-indigo-500',
        border: 'border-l-4 border-indigo-300',
        avatar: 'bg-indigo-600'
      },
      gray: {
        header: 'bg-gradient-to-r from-gray-100 to-gray-50 border-l-4 border-gray-500',
        text: 'text-gray-900',
        badge: 'bg-gray-500',
        border: 'border-l-4 border-gray-300',
        avatar: 'bg-gray-600'
      }
    };

    return colorMap[color] || colorMap.gray;
  };

  // Compter les tâches par groupe
  const getGroupTaskCount = (groupUsers: User[]): number => {
    return tasks.filter(t => groupUsers.some(u => u.id === t.assigneeId)).length;
  };

  // Regrouper les utilisateurs par service avec section Encadrement
  const groupedUsers = useMemo((): ServiceGroup[] => {
    if (users.length === 0) return [];

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

    const managementUsers = users.filter(isManager);
    const nonManagers = users.filter(u => !isManager(u));

    const groups: ServiceGroup[] = [];

    // 1. Section Encadrement en premier (si des managers existent)
    if (managementUsers.length > 0) {
      groups.push({
        id: 'management',
        name: 'Encadrement',
        icon: '',
        isManagement: true,
        users: managementUsers.sort((a, b) => a.lastName.localeCompare(b.lastName)),
        color: 'amber'
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
      .filter(s => serviceMap.has(s.id))
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
          users: serviceUsers.sort((a, b) => a.lastName.localeCompare(b.lastName)),
          color: style.color
        });
      }
    }

    // 3. Section "Sans service" pour les orphelins
    if (usersWithoutService.length > 0) {
      groups.push({
        id: 'unassigned',
        name: 'Sans service',
        icon: '',
        isManagement: false,
        users: usersWithoutService.sort((a, b) => a.lastName.localeCompare(b.lastName)),
        color: 'gray'
      });
    }

    return groups;
  }, [users, services]);

  // Filtrer les groupes si un utilisateur spécifique est sélectionné
  const filteredGroups = useMemo(() => {
    if (selectedUser === 'ALL') return groupedUsers;

    return groupedUsers
      .map(group => ({
        ...group,
        users: group.users.filter(u => u.id === selectedUser)
      }))
      .filter(group => group.users.length > 0);
  }, [groupedUsers, selectedUser]);

  const getDayCell = (userId: string, date: Date): DayCell => {
    const dayTasks = tasks.filter((t) => t.assigneeId === userId && t.endDate && isSameDay(new Date(t.endDate), date));
    const dayLeaves = leaves.filter((l) => l.userId === userId && isSameDay(new Date(l.startDate), date) && l.status !== 'REJECTED');
    const teleworkSchedule = teleworkSchedules.find((ts) => ts.userId === userId && isSameDay(new Date(ts.date), date));

    return {
      date,
      tasks: dayTasks,
      leaves: dayLeaves,
      isTelework: teleworkSchedule?.isTelework || false,
      teleworkSchedule: teleworkSchedule || null,
    };
  };

  const handleTeleworkToggle = async (userId: string, date: Date) => {
    try {
      const existing = teleworkSchedules.find((ts) => ts.userId === userId && isSameDay(new Date(ts.date), date));
      // Formater la date en YYYY-MM-DD pour éviter les problèmes de timezone
      const dateStr = format(date, 'yyyy-MM-dd');
      if (existing) {
        await teleworkService.update(existing.id, { isTelework: !existing.isTelework });
      } else {
        await teleworkService.create({ date: dateStr, isTelework: true, isException: false, userId });
      }
      toast.success('Télétravail mis à jour');
      fetchData();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du télétravail');
    }
  };

  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragEnd = () => setDraggedTask(null);

  const handleDrop = async (userId: string, date: Date) => {
    if (!draggedTask) return;
    try {
      await tasksService.update(draggedTask.id, { assigneeId: userId, endDate: date.toISOString() });
      toast.success('Tâche déplacée');
      fetchData();
    } catch (error: any) {
      toast.error('Erreur lors du déplacement de la tâche');
    }
    setDraggedTask(null);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL: return 'bg-red-100 text-red-800 border-red-300';
      case Priority.HIGH: return 'bg-orange-100 text-orange-800 border-orange-300';
      case Priority.NORMAL: return 'bg-blue-100 text-blue-800 border-blue-300';
      case Priority.LOW: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO: return '○';
      case TaskStatus.IN_PROGRESS: return '◐';
      case TaskStatus.IN_REVIEW: return '◕';
      case TaskStatus.DONE: return '●';
      case TaskStatus.BLOCKED: return '⊗';
    }
  };

  const getRoleLabel = (role: Role): string => {
    switch (role) {
      case Role.ADMIN: return 'Admin';
      case Role.RESPONSABLE: return 'Responsable';
      case Role.MANAGER: return 'Manager';
      case Role.REFERENT_TECHNIQUE: return 'Réf. Tech.';
      case Role.CONTRIBUTEUR: return 'Contributeur';
      case Role.OBSERVATEUR: return 'Observateur';
      default: return role;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement du planning...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning des Ressources</h1>
            <p className="text-gray-600 mt-1">
              {viewMode === 'week'
                ? `Semaine du ${format(displayDays[0], 'dd MMM', { locale: fr })} au ${format(displayDays[displayDays.length - 1], 'dd MMM yyyy', { locale: fr })}`
                : format(currentDate, 'MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded text-sm transition ${viewMode === 'week' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
              >
                Semaine
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded text-sm transition ${viewMode === 'month' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
              >
                Mois
              </button>
            </div>
            <button
              onClick={() => viewMode === 'week' ? setCurrentDate(subWeeks(currentDate, 1)) : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">←</span>
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
              Aujourd'hui
            </button>
            <button
              onClick={() => viewMode === 'week' ? setCurrentDate(addWeeks(currentDate, 1)) : setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-xl">→</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Ressource :</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="ALL">Toutes les ressources</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
            <div className="flex items-center space-x-3 ml-auto">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded mr-1"></span>Tâche</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded mr-1"></span>Congé</span>
                <span className="flex items-center"><span>🏠</span>Télétravail</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <th className="sticky left-0 bg-gray-50 z-40 px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px]">Ressource</th>
                  {displayDays.map((day, index) => {
                    const isMonday = getDay(day) === 1;
                    const isFirstDay = index === 0;
                    const showWeekSeparator = viewMode === 'month' && isMonday && !isFirstDay;

                    return (
                      <th key={day.toISOString()} className={`text-center font-semibold ${viewMode === 'month' ? 'px-1 py-1 min-w-[40px] max-w-[50px]' : 'px-4 py-3 min-w-[180px]'} ${isToday(day) ? 'bg-blue-50 text-blue-900' : 'text-gray-900'} ${showWeekSeparator ? 'border-l-2 border-l-indigo-400' : ''}`}>
                        <div className={viewMode === 'month' ? 'text-[9px] leading-tight' : 'text-sm'}>{format(day, viewMode === 'month' ? 'EEEEE' : 'EEEE', { locale: fr })}</div>
                        <div className={viewMode === 'month' ? 'text-xs font-bold' : 'text-lg font-bold'}>{format(day, 'dd')}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGroups.length === 0 ? (
                  <tr><td colSpan={displayDays.length + 1} className="px-4 py-8 text-center text-gray-500">Aucune ressource à afficher</td></tr>
                ) : (
                  filteredGroups.map((group) => {
                    const colors = getGroupColors(group.color, group.isManagement);
                    const taskCount = getGroupTaskCount(group.users);

                    return (
                    <>
                      {/* En-tête de section (sticky) - Plus grand et coloré */}
                      <tr key={`header-${group.id}`} className="sticky top-[48px] z-20">
                        <td
                          colSpan={displayDays.length + 1}
                          className={`px-4 py-3 font-semibold ${colors.header}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {group.icon && <span className="text-2xl mr-3">{group.icon}</span>}
                              <div>
                                <span className={`text-base font-bold ${colors.text}`}>{group.name}</span>
                                <span className={`ml-3 text-xs font-normal ${colors.text} opacity-75`}>
                                  {group.users.length} {group.users.length > 1 ? 'personnes' : 'personne'}
                                </span>
                              </div>
                            </div>
                            {taskCount > 0 && (
                              <div className={`${colors.badge} text-white text-xs font-bold px-2 py-1 rounded-full`}>
                                {taskCount} tâche{taskCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Utilisateurs du groupe - Indentation et bordure colorée */}
                      {group.users.map((userRow) => (
                        <tr key={userRow.id} className={`hover:bg-gray-50 ${colors.border}`}>
                          <td className="sticky left-0 bg-white z-10 px-4 py-4 border-r border-gray-200">
                            <div className="flex items-center space-x-3 pl-2">
                              <div className="relative">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${colors.avatar} text-white`}>
                                  {userRow.firstName[0]}{userRow.lastName[0]}
                                </div>
                                {group.isManagement && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                                    <span className="text-[8px]">⭐</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{userRow.firstName} {userRow.lastName}</div>
                                <div className="text-xs text-gray-500">{getRoleLabel(userRow.role)}</div>
                              </div>
                            </div>
                          </td>
                          {displayDays.map((day, dayIndex) => {
                            const cell = getDayCell(userRow.id, day);
                            const hasLeave = cell.leaves.length > 0;
                            const isMonday = getDay(day) === 1;
                            const isFirstDay = dayIndex === 0;
                            const showWeekSeparator = viewMode === 'month' && isMonday && !isFirstDay;

                            return (
                              <td key={day.toISOString()} className={`align-top relative ${viewMode === 'month' ? 'px-0.5 py-1' : 'px-2 py-2'} ${isToday(day) ? 'bg-blue-50' : ''} ${showWeekSeparator ? 'border-l-2 border-l-indigo-400' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(userRow.id, day)}>
                                <div className={`space-y-0.5 ${viewMode === 'month' ? 'min-h-[40px]' : 'min-h-[100px]'}`}>
                                  <div className="flex items-center justify-center">
                                    <button onClick={() => handleTeleworkToggle(userRow.id, day)} className={`${viewMode === 'month' ? 'text-[10px]' : 'text-lg'} transition ${cell.isTelework ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`} title={cell.isTelework ? 'Télétravail' : 'Bureau'}>
                                      {cell.isTelework ? '🏠' : '🏢'}
                                    </button>
                                  </div>
                                  {hasLeave && (
                                    <div>
                                      {cell.leaves.map((leave) => (
                                        <div key={leave.id} className={`bg-green-100 text-green-800 rounded border border-green-300 text-center ${viewMode === 'month' ? 'text-[8px] px-0.5 py-0' : 'text-xs px-2 py-1'}`}>
                                          {viewMode === 'month' ? '🌴' : `🌴 ${leave.type}`}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {cell.tasks.map((task) => (
                                    <div key={task.id} draggable onDragStart={() => handleDragStart(task)} onDragEnd={handleDragEnd} onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} className={`rounded border cursor-move hover:shadow-md transition ${getPriorityColor(task.priority)} ${viewMode === 'month' ? 'text-[7px] p-0.5' : 'text-xs p-2'}`}>
                                      {viewMode === 'month' ? (
                                        <div className="text-center" title={task.title}>
                                          <span>{getStatusIcon(task.status)}</span>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex items-start space-x-1">
                                            <span className="text-xs">{getStatusIcon(task.status)}</span>
                                            <span className="flex-1 font-medium line-clamp-2">{task.title}</span>
                                          </div>
                                          {task.estimatedHours && (<div className="text-[10px] text-gray-600 mt-1">⏱️ {task.estimatedHours}h</div>)}
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Légende</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center space-x-2"><span>○</span><span>À faire</span></div>
            <div className="flex items-center space-x-2"><span>◐</span><span>En cours</span></div>
            <div className="flex items-center space-x-2"><span>◕</span><span>En revue</span></div>
            <div className="flex items-center space-x-2"><span>●</span><span>Terminé</span></div>
            <div className="flex items-center space-x-2"><span>⊗</span><span>Bloqué</span></div>
            <div className="flex items-center space-x-2"><span>🏠</span><span>Télétravail</span></div>
            <div className="flex items-center space-x-2"><span>🏢</span><span>Bureau</span></div>
            <div className="flex items-center space-x-2"><span>🌴</span><span>Congé</span></div>
          </div>
        </div>
      </div>

      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
              <button onClick={() => { setShowTaskModal(false); setSelectedTask(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              {selectedTask.description && (
                <div><h3 className="font-semibold text-gray-900 mb-2">Description</h3><p className="text-gray-700">{selectedTask.description}</p></div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><h3 className="font-semibold text-gray-900 mb-2">Statut</h3><span className={`inline-block px-3 py-1 rounded text-sm ${selectedTask.status === TaskStatus.DONE ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{selectedTask.status}</span></div>
                <div><h3 className="font-semibold text-gray-900 mb-2">Priorité</h3><span className={`inline-block px-3 py-1 rounded text-sm ${getPriorityColor(selectedTask.priority)}`}>{selectedTask.priority}</span></div>
                {selectedTask.estimatedHours && (<div><h3 className="font-semibold text-gray-900 mb-2">Estimation</h3><p className="text-gray-700">{selectedTask.estimatedHours}h</p></div>)}
                {selectedTask.progress !== undefined && (
                  <div><h3 className="font-semibold text-gray-900 mb-2">Progression</h3><div className="flex items-center space-x-2"><div className="flex-1 bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${selectedTask.progress}%` }}></div></div><span className="text-sm text-gray-600">{selectedTask.progress}%</span></div></div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => { setShowTaskModal(false); setSelectedTask(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
