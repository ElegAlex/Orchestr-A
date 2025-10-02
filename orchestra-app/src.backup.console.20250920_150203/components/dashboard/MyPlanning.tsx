import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  LinearProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  Event as EventIcon,
  Home as HomeIcon,
  Business as BusinessIcon,
  Bolt as BoltIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  differenceInHours,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, User, WorkContract, WeekDay } from '../../types';
import { taskService } from '../../services/task.service';
import { simpleTaskService } from '../../services/simple-task.service';
import { projectService } from '../../services/project.service';
import { capacityService } from '../../services/capacity.service';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface CalendarItem {
  id: string;
  title: string;
  type: 'task' | 'simple_task' | 'meeting' | 'admin' | 'training' | 'leave' | 'remote';
  startTime: Date;
  endTime: Date;
  projectId?: string;
  projectName?: string;
  priority: string;
  status: string;
  color: string;
  isRemote: boolean;
  taskCategory?: 'PROJECT_TASK' | 'SIMPLE_TASK';
}

interface DayColumn {
  date: Date;
  items: CalendarItem[];
  isToday: boolean;
  isRemoteWork: boolean;
  isWorkingDay?: boolean;
}

const MyPlanning: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<DayColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userContract, setUserContract] = useState<WorkContract | null>(null);

  // Utilitaires pour les jours de travail
  const isWorkingDay = (date: Date, contract: WorkContract | null): boolean => {
    if (!contract?.workingDays) return true;
    const dayName = format(date, 'EEEE', { locale: fr }).toLowerCase();
    const dayMap: { [key: string]: WeekDay } = {
      'lundi': 'monday',
      'mardi': 'tuesday', 
      'mercredi': 'wednesday',
      'jeudi': 'thursday',
      'vendredi': 'friday',
      'samedi': 'saturday',
      'dimanche': 'sunday'
    };
    const weekDay = dayMap[dayName];
    return weekDay ? contract.workingDays.includes(weekDay) : true;
  };

  const filterWorkingDays = (days: Date[], contract: WorkContract | null): Date[] => {
    return days.filter(day => isWorkingDay(day, contract));
  };

  // Calcul des jours de la semaine
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: fr });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Chargement des données utilisateur uniquement
  useEffect(() => {
    const loadMyPlanningData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // ✅ Charger le contrat de travail et les données (inclus tâches simples)
        const [userTasks, simpleTasks, projects, contract] = await Promise.all([
          taskService.getTasksByAssignee(user.id),
          simpleTaskService.getSimpleTasksByUser(user.id),
          projectService.getAllProjects(),
          capacityService.getUserContract(user.id)
        ]);

        setUserContract(contract);

        // ✅ Filtrer les tâches de la semaine courante (projet + simples)
        const weekStart = startOfWeek(currentDate, { locale: fr });
        const weekEnd = endOfWeek(currentDate, { locale: fr });

        const weekProjectTasks = userTasks.filter(task => {
          if (!task.startDate && !task.dueDate) return false;

          const taskStart = task.startDate ? new Date(task.startDate as any) : new Date(task.dueDate as any);
          const taskEnd = task.dueDate ? new Date(task.dueDate as any) : new Date(task.startDate as any);

          return taskStart <= weekEnd && taskEnd >= weekStart;
        });

        const weekSimpleTasks = simpleTasks.filter(task => {
          if (!task.dueDate) return false;

          const taskDate = new Date(task.dueDate as any);
          return taskDate >= weekStart && taskDate <= weekEnd;
        });

        // ✅ Combiner les tâches pour le calcul des stats
        const allWeekTasks = [...weekProjectTasks, ...weekSimpleTasks];
        setTasks(allWeekTasks);

        // ✅ Créer les items de calendrier avec spanning multi-jours
        const allCalendarItems: CalendarItem[] = [];

        // Traiter les tâches de projet
        weekProjectTasks.forEach(task => {
          const project = projects.find(p => p.id === task.projectId);
          const taskStart = task.startDate ? new Date(task.startDate as any) : new Date(task.dueDate as any);
          const taskEnd = task.dueDate ? new Date(task.dueDate as any) : taskStart;

          // Si la tâche s'étend sur plusieurs jours, créer un item pour chaque jour
          if (taskStart && taskEnd && taskStart.getTime() !== taskEnd.getTime()) {
            const taskDays = eachDayOfInterval({ start: taskStart, end: taskEnd });
            taskDays.forEach(day => {
              // Vérifier si le jour est dans la semaine courante et est un jour de travail
              if (day >= weekStart && day <= weekEnd && isWorkingDay(day, contract)) {
                allCalendarItems.push({
                  id: `${task.id}-${day.getTime()}`,
                  title: project?.name || task.title,
                  type: task.projectId ? 'task' : 'admin',
                  startTime: day,
                  endTime: day,
                  projectId: task.projectId,
                  projectName: project?.name,
                  priority: task.priority,
                  status: task.status,
                  color: task.priority === 'P0' ? '#f44336' :
                         task.priority === 'P1' ? '#ff9800' :
                         task.priority === 'P2' ? '#2196f3' : '#9e9e9e',
                  isRemote: false,
                  taskCategory: (task as any).taskCategory || 'PROJECT_TASK',
                });
              }
            });
          } else {
            // Tâche d'un jour
            const taskDay = taskStart;
            if (taskDay >= weekStart && taskDay <= weekEnd && isWorkingDay(taskDay, contract)) {
              allCalendarItems.push({
                id: task.id,
                title: project?.name || task.title,
                type: task.projectId ? 'task' : 'admin',
                startTime: taskDay,
                endTime: taskDay,
                projectId: task.projectId,
                projectName: project?.name,
                priority: task.priority,
                status: task.status,
                color: task.priority === 'P0' ? '#f44336' :
                       task.priority === 'P1' ? '#ff9800' :
                       task.priority === 'P2' ? '#2196f3' : '#9e9e9e',
                isRemote: false,
                taskCategory: (task as any).taskCategory || 'PROJECT_TASK',
              });
            }
          }
        });

        // ✅ Traiter les tâches simples
        weekSimpleTasks.forEach(simpleTask => {
          const taskDate = new Date(simpleTask.dueDate as any);
          if (taskDate >= weekStart && taskDate <= weekEnd && isWorkingDay(taskDate, contract)) {
            allCalendarItems.push({
              id: simpleTask.id,
              title: simpleTask.title,
              type: 'simple_task',
              startTime: taskDate,
              endTime: taskDate,
              projectId: undefined,
              projectName: undefined,
              priority: simpleTask.priority,
              status: simpleTask.status,
              color: simpleTask.priority === 'P0' ? '#e91e63' :   // Rose pour différencier
                     simpleTask.priority === 'P1' ? '#ff5722' :   // Orange-rouge
                     simpleTask.priority === 'P2' ? '#673ab7' :   // Violet
                     '#795548',                                   // Marron
              isRemote: false,
              taskCategory: 'SIMPLE_TASK',
            });
          }
        });

        // Grouper les tâches par projet et par jour
        const itemsByDayAndProject = new Map<string, Map<string, CalendarItem[]>>();

        allCalendarItems.forEach(item => {
          const dayKey = format(item.startTime, 'yyyy-MM-dd');
          const projectKey = item.projectId || 'no-project';

          if (!itemsByDayAndProject.has(dayKey)) {
            itemsByDayAndProject.set(dayKey, new Map());
          }
          
          const dayMap = itemsByDayAndProject.get(dayKey)!;
          if (!dayMap.has(projectKey)) {
            dayMap.set(projectKey, []);
          }
          
          dayMap.get(projectKey)!.push(item);
        });

        // Créer les items groupés finaux
        const groupedItems: CalendarItem[] = [];
        itemsByDayAndProject.forEach((dayMap, dayKey) => {
          dayMap.forEach((projectItems, projectKey) => {
            if (projectItems.length > 0) {
              const firstItem = projectItems[0];
              groupedItems.push({
                ...firstItem,
                id: `${dayKey}-${projectKey}`,
                title: firstItem.projectName || firstItem.title,
              });
            }
          });
        });

        // Construire les données de la semaine avec tous les jours mais marquer les non-travaillés
        const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

        const weekColumns: DayColumn[] = allWeekDays.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const isWorking = isWorkingDay(day, contract);
          
          const dayItems = isWorking ? groupedItems.filter(item => 
            format(item.startTime, 'yyyy-MM-dd') === dayKey
          ) : [];

          // Vérifier si c'est un jour de télétravail (basé sur les préférences utilisateur)
          const dayName = format(day, 'EEEE', { locale: fr }).toLowerCase();
          const isRemote = user.preferences?.remoteWorkDays?.includes(dayName) || false;

          return {
            date: day,
            items: dayItems,
            isToday: isToday(day),
            isRemoteWork: isRemote,
            isWorkingDay: isWorking,
          };
        });

        setWeekData(weekColumns);
      } catch (err) {
        
        setError('Erreur lors du chargement de votre planning');
      } finally {
        setLoading(false);
      }
    };

    loadMyPlanningData();
  }, [currentDate, user]);

  // Navigation
  const handlePrevious = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calcul de la charge de travail
  const weeklyWorkload = useMemo(() => {
    const totalHours = weekData.reduce((sum, day) => {
      return sum + day.items.reduce((daySum, item) => {
        return daySum + differenceInHours(item.endTime, item.startTime);
      }, 0);
    }, 0);

    const workDays = weekData.filter(d => {
      const dayOfWeek = d.date.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclure weekend
    }).length;

    const capacity = workDays * 7; // 7h par jour ouvré
    const utilizationRate = capacity > 0 ? (totalHours / capacity) * 100 : 0;

    return {
      totalHours,
      capacity,
      utilizationRate,
      totalTasks: tasks.length,
    };
  }, [weekData, tasks]);

  const getUtilizationColor = (rate: number) => {
    if (rate <= 60) return 'success';
    if (rate <= 85) return 'warning';
    if (rate <= 100) return 'info';
    return 'error';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DONE': return '✅';
      case 'IN_PROGRESS': return '🔄';
      case 'BLOCKED': return '🚫';
      default: return '📋';
    }
  };

  // ✅ Nouvelle fonction pour les icônes de type de tâche
  const getTaskTypeIcon = (taskCategory?: 'PROJECT_TASK' | 'SIMPLE_TASK', type?: string) => {
    if (taskCategory === 'SIMPLE_TASK') {
      return <BoltIcon sx={{ fontSize: 12, color: 'secondary.main' }} />;
    }

    if (type === 'task') {
      return <ProjectIcon sx={{ fontSize: 12, color: 'primary.main' }} />;
    }

    return <AssignmentIcon sx={{ fontSize: 12, color: 'text.secondary' }} />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header avec navigation */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">📅 Mon planning</Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" onClick={handlePrevious}>
              <ChevronLeftIcon />
            </IconButton>
            
            <Button 
              size="small" 
              variant="outlined" 
              startIcon={<TodayIcon />} 
              onClick={handleToday}
            >
              Aujourd'hui
            </Button>
            
            <IconButton size="small" onClick={handleNext}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Semaine affichée */}
        <Typography variant="body2" color="text.secondary" mb={2}>
          {weekDays.length > 0 && (
            <>Semaine du {format(weekDays[0], 'd MMM', { locale: fr })} au {format(weekDays[weekDays.length - 1], 'd MMM yyyy', { locale: fr })}</>
          )}
        </Typography>

        {/* Planning de la semaine */}
        <Box sx={{ overflowX: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ minWidth: 600 }}>
            {weekData.map((day) => (
              <Box
                key={day.date.toISOString()}
                sx={{
                  flex: 1,
                  minWidth: 120,
                  border: '1px solid',
                  borderColor: day.isToday ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: day.isToday ? 'primary.light' : 'background.paper',
                  p: 1,
                }}
              >
                {/* En-tête du jour */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography
                    variant="caption"
                    fontWeight={day.isToday ? 'bold' : 'normal'}
                    color={day.isToday ? 'primary.main' : 'text.primary'}
                  >
                    {format(day.date, 'EEE d', { locale: fr })}
                  </Typography>
                  
                  {day.isRemoteWork && (
                    <HomeIcon sx={{ fontSize: 14, color: 'purple' }} />
                  )}
                </Stack>

                {/* Tâches du jour */}
                <Stack spacing={0.5}>
                  {day.isWorkingDay === false ? (
                    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      Non travaillé
                    </Typography>
                  ) : day.items.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      Aucune tâche
                    </Typography>
                  ) : (
                    day.items.slice(0, 3).map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 0.5,
                          bgcolor: `${item.color}20`,
                          borderLeft: `3px solid ${item.color}`,
                          borderRadius: 0.5,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: `${item.color}30`,
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          {/* ✅ Icône de type de tâche + statut */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            {getTaskTypeIcon(item.taskCategory, item.type)}
                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                              {getStatusIcon(item.status)}
                            </Typography>
                          </Box>

                          <Box flexGrow={1} sx={{ minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: '0.7rem',
                                  fontWeight: 'medium',
                                  flex: 1,
                                }}
                              >
                                {item.title}
                              </Typography>

                              {/* Badge catégorie */}
                              {item.taskCategory === 'SIMPLE_TASK' && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.6rem',
                                    px: 0.5,
                                    py: 0.1,
                                    bgcolor: 'secondary.light',
                                    color: 'secondary.main',
                                    borderRadius: 0.5,
                                    fontWeight: 'bold',
                                  }}
                                >
                                  Simple
                                </Typography>
                              )}
                            </Stack>

                            {item.projectName && (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  fontSize: '0.65rem',
                                  color: 'text.secondary',
                                }}
                              >
                                📂 {item.projectName}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                        
                        {/* Heure si définie */}
                        {item.startTime && (
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                            {format(item.startTime, 'HH:mm')}
                          </Typography>
                        )}
                      </Box>
                    ))
                  )}
                  
                  {day.items.length > 3 && (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      +{day.items.length - 3} autres
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Lien vers la vue complète */}
        <Box textAlign="center" mt={2}>
          <Button size="small" href="/calendar">
            Voir le calendrier complet
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MyPlanning;