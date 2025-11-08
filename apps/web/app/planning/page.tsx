'use client';

import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { tasksService } from '@/services/tasks.service';
import { usersService } from '@/services/users.service';
import { leavesService } from '@/services/leaves.service';
import { teleworkService } from '@/services/telework.service';
import { Task, User, Leave, TeleworkSchedule, TaskStatus, Priority, Role } from '@/types';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday, startOfDay, endOfDay, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DayCell {
  date: Date;
  tasks: Task[];
  leaves: Leave[];
  isTelework: boolean;
  teleworkSchedule: TeleworkSchedule | null;
}

export default function PlanningPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
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
      // Mode mois: afficher tous les jours ouvrés du mois
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

      const [usersData, tasksData, leavesData, teleworkData] = await Promise.all([
        usersService.getAll(),
        tasksService.getByDateRange(startDate.toISOString(), endDate.toISOString()),
        leavesService.getByDateRange(startDate.toISOString(), endDate.toISOString()),
        teleworkService.getByDateRange(startDate.toISOString(), endDate.toISOString()),
      ]);

      const usersList = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.data) ? usersData.data : []);
      setUsers(Array.isArray(usersList) ? usersList.filter((u) => u.isActive) : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setLeaves(Array.isArray(leavesData) ? leavesData : []);
      setTeleworkSchedules(Array.isArray(teleworkData) ? teleworkData : []);
    } catch (error: any) {
      setUsers([]);
      setTasks([]);
      setLeaves([]);
      setTeleworkSchedules([]);
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

  const filteredUsers = useMemo(() => {
    if (selectedUser === 'ALL') return users;
    return users.filter((u) => u.id === selectedUser);
  }, [users, selectedUser]);

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
      if (existing) {
        await teleworkService.update(existing.id, { isTelework: !existing.isTelework });
      } else {
        await teleworkService.create({ date: date.toISOString(), isTelework: true, isException: false });
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
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px]">Ressource</th>
                  {displayDays.map((day) => (
                    <th key={day.toISOString()} className={`px-4 py-3 text-center text-sm font-semibold ${viewMode === 'month' ? 'min-w-[120px]' : 'min-w-[180px]'} ${isToday(day) ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`}>
                      <div className={viewMode === 'month' ? 'text-xs' : ''}>{format(day, viewMode === 'month' ? 'EEE' : 'EEEE', { locale: fr })}</div>
                      <div className="text-lg font-bold">{format(day, 'dd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={displayDays.length + 1} className="px-4 py-8 text-center text-gray-500">Aucune ressource à afficher</td></tr>
                ) : (
                  filteredUsers.map((userRow) => (
                    <tr key={userRow.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 bg-white z-10 px-4 py-4 border-r border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                            {userRow.firstName[0]}{userRow.lastName[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{userRow.firstName} {userRow.lastName}</div>
                            <div className="text-xs text-gray-500">{userRow.role}</div>
                          </div>
                        </div>
                      </td>
                      {displayDays.map((day) => {
                        const cell = getDayCell(userRow.id, day);
                        const hasLeave = cell.leaves.length > 0;
                        return (
                          <td key={day.toISOString()} className={`px-2 py-2 align-top relative ${isToday(day) ? 'bg-blue-50' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(userRow.id, day)}>
                            <div className={`space-y-1 ${viewMode === 'month' ? 'min-h-[60px]' : 'min-h-[100px]'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <button onClick={() => handleTeleworkToggle(userRow.id, day)} className={`${viewMode === 'month' ? 'text-sm' : 'text-lg'} transition ${cell.isTelework ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`} title={cell.isTelework ? 'Télétravail' : 'Bureau'}>
                                  {cell.isTelework ? '🏠' : '🏢'}
                                </button>
                              </div>
                              {hasLeave && (
                                <div className="mb-2">
                                  {cell.leaves.map((leave) => (
                                    <div key={leave.id} className={`bg-green-100 text-green-800 px-2 py-1 rounded border border-green-300 ${viewMode === 'month' ? 'text-[10px]' : 'text-xs'}`}>
                                      🌴 {viewMode === 'month' ? leave.type.substring(0, 3) : leave.type}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {cell.tasks.map((task) => (
                                <div key={task.id} draggable onDragStart={() => handleDragStart(task)} onDragEnd={handleDragEnd} onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} className={`p-2 rounded border cursor-move hover:shadow-md transition ${getPriorityColor(task.priority)} ${viewMode === 'month' ? 'text-[10px] p-1' : 'text-xs'}`}>
                                  <div className="flex items-start space-x-1">
                                    <span className="text-xs">{getStatusIcon(task.status)}</span>
                                    <span className="flex-1 font-medium line-clamp-2">{task.title}</span>
                                  </div>
                                  {task.estimatedHours && viewMode === 'week' && (<div className="text-[10px] text-gray-600 mt-1">⏱️ {task.estimatedHours}h</div>)}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
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
