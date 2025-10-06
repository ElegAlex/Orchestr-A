import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Stack,
  Grid,
  Chip,
  Avatar,
  Alert,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
} from '@mui/material';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Bolt as BoltIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, Project, User } from '../types';
import { Service } from '../types/service';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { userService } from '../services/user.service';
import { simpleTaskService } from '../services/simpleTask.service';
import { ServiceService } from '../services/service.service';
import { leaveService } from '../services/leave.service';
import { SimpleTaskModal } from '../components/calendar/SimpleTaskModal';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
// Lazy loading du composant PlanningCalendar pour réduire la taille du bundle initial
const PlanningCalendar = lazy(() => import('../components/calendar/PlanningCalendar'));

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'project' | 'simple_task' | 'leave';
  status?: string;
  priority?: string;
  assignee?: User; // Premier responsable pour rétrocompatibilité
  allAssignees?: User[]; // Tous les responsables
  project?: Project;
  description?: string;
  // Multi-jours
  originalTaskId?: string;
  isSpanning?: boolean;
  spanDay?: number;
  totalSpanDays?: number;
  // Créneaux horaires
  startTime?: string;
  endTime?: string;
  // Congés
  leaveType?: string;
  halfDayType?: 'morning' | 'afternoon' | 'full';
  isFirstDay?: boolean;
  isLastDay?: boolean;
}

type CalendarView = 'month' | 'week' | 'day';
const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // ✅ Filtres pour le calendrier général (sans filtre par responsable)
  const [filters, setFilters] = useState({
    eventType: 'all', // 'all', 'task', 'simple_task', 'project'
    project: 'all',
    taskCategory: 'all', // 'all', 'PROJECT_TASK', 'SIMPLE_TASK'
  });
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // États pour le mode Planning
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicesInitialized, setServicesInitialized] = useState(false);

  // ✅ États pour les tâches simples
  const [simpleTaskModalOpen, setSimpleTaskModalOpen] = useState(false);
  const [selectedDateForSimpleTask, setSelectedDateForSimpleTask] = useState<Date | null>(null);

  // ✅ Récupérer l'utilisateur connecté
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // ✅ Initialiser les filtres services avec les services de l'utilisateur au chargement
  useEffect(() => {
    if (currentUser && !servicesInitialized && services.length > 0) {
      const userServiceIds = currentUser.serviceIds || (currentUser.serviceId ? [currentUser.serviceId] : []);

      if (userServiceIds.length > 0) {
        setSelectedServices(userServiceIds);
      }

      setServicesInitialized(true);
    }
  }, [currentUser, services, servicesInitialized]);

  // ✅ Mémoisation des événements filtrés avec support tâches simples
  const filteredEventsOptimized = useMemo(() => {
    let filtered = [...events];

    // Filtre par type d'événement
    if (filters.eventType !== 'all') {
      filtered = filtered.filter(event => event.type === filters.eventType);
    }

    // Filtre par projet (ne s'applique qu'aux tâches de projet)
    if (filters.project !== 'all') {
      filtered = filtered.filter(event =>
        event.project?.id === filters.project || event.type === 'simple_task' || event.type === 'leave'
      );
    }

    // ✅ Nouveau filtre par catégorie de tâche
    if (filters.taskCategory !== 'all') {
      if (filters.taskCategory === 'PROJECT_TASK') {
        filtered = filtered.filter(event => event.type === 'task' || event.type === 'project');
      } else if (filters.taskCategory === 'SIMPLE_TASK') {
        filtered = filtered.filter(event => event.type === 'simple_task');
      }
      // Les congés passent toujours (ne sont pas filtrés par catégorie de tâche)
      const leaves = events.filter(event => event.type === 'leave');
      filtered = [...filtered, ...leaves];
    }

    return filtered;
  }, [events, filters]);

  useEffect(() => {
    setFilteredEvents(filteredEventsOptimized);
  }, [filteredEventsOptimized]);

  // Cache pour éviter les rechargements inutiles
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Limiter les données à 3 mois pour le calendrier
      const now = new Date();
      const threeMonthsAgo = subMonths(now, 1);
      const threeMonthsAhead = addMonths(now, 2);
      
      // ✅ Calendar général : récupérer TOUTES les tâches (projet + simples) + congés
      const serviceService = new ServiceService();
      const [projectTasks, simpleTasks, projectsData, servicesData, leaves] = await Promise.all([
        taskService.getTasks(), // Tâches de projet
        simpleTaskService.getAll(), // Toutes les tâches simples
        projectService.getActiveProjects(),
        serviceService.getAllServices(), // Services
        currentUser?.id ? leaveService.getUserLeaves(currentUser.id) : Promise.resolve([]), // Congés
      ]);

      setProjects(projectsData);
      setServices(servicesData);

      // Convertir SimpleTasks en format Task pour compatibilité
      const simpleTasksAsTaskFormat: Task[] = simpleTasks.map(st => ({
        id: st.id,
        title: st.title,
        description: st.description,
        projectId: '', // Pas de projet
        taskCategory: 'SIMPLE_TASK' as any,
        priority: st.priority,
        status: st.status,
        type: 'TASK' as any,
        dueDate: st.date,
        startDate: st.date,
        startTime: st.timeSlot.start,
        endTime: st.timeSlot.end,
        responsible: [st.assignedTo],
        createdBy: st.createdBy,
        createdAt: st.createdAt,
        updatedAt: st.updatedAt,
        dependencies: [],
        labels: [],
        attachments: [],
        comments: [],
      } as any));

      // Fusionner
      const tasks = [...projectTasks, ...simpleTasksAsTaskFormat];

      // ✅ Convertir les tâches en événements avec filtrage par responsable et affichage multi-jours
      const taskEvents: CalendarEvent[] = [];

      tasks
        .filter(task => task.dueDate) // Doit avoir une date d'échéance
        .filter(task => {
          // ✅ FILTRAGE PAR RESPONSABLE
          if (!currentUser?.id) return false;

          // Inclure si user est responsable OU accountable
          return (
            task.responsible?.includes(currentUser.id) ||
            task.accountable?.includes(currentUser.id)
          );
        })
        .forEach(task => {
          // ✅ AFFICHAGE MULTI-JOURS
          const startDate = task.startDate || task.createdAt;
          const endDate = task.dueDate!;

          // Générer tous les jours entre start et end
          const daysInRange = eachDayOfInterval({
            start: new Date(startDate),
            end: new Date(endDate)
          });

          // Créer un événement pour chaque jour
          daysInRange.forEach((day, dayIndex) => {
            const eventType: 'task' | 'simple_task' = task.taskCategory === 'SIMPLE_TASK' ? 'simple_task' : 'task';

            const newEvent = {
              id: `task-${task.id}-day-${dayIndex}`,
              title: task.title,
              date: day,
              type: eventType,
              status: task.status,
              priority: task.priority,
              assignee: undefined,
              allAssignees: [],
              project: projectsData.find(p => p.id === task.projectId),
              description: task.description,
              // Multi-jours
              originalTaskId: task.id,
              isSpanning: daysInRange.length > 1,
              spanDay: dayIndex + 1,
              totalSpanDays: daysInRange.length,
              // Créneaux horaires
              startTime: task.startTime,
              endTime: task.endTime,
            };

            taskEvents.push(newEvent);
          });
        });

      // Ajouter les échéances de projets
      const projectEvents: CalendarEvent[] = projectsData
        .filter(project => project.dueDate)
        .map(project => ({
          id: `project-${project.id}`,
          title: `Fin: ${project.name}`,
          date: new Date(project.dueDate!),
          type: 'project' as const,
          status: project.status,
          project,
          description: project.description,
        }));

      // ✅ Convertir les congés en événements calendrier
      const leaveEvents: CalendarEvent[] = [];

      leaves.forEach(leave => {
        // Générer tous les jours du congé
        const daysInRange = eachDayOfInterval({
          start: new Date(leave.startDate),
          end: new Date(leave.endDate)
        });

        daysInRange.forEach((day, dayIndex) => {
          const leaveTypeLabels: { [key: string]: string } = {
            PAID_LEAVE: '🏖️ Congé payé',
            RTT: '🎯 RTT',
            SICK_LEAVE: '🏥 Congé maladie',
            MATERNITY_LEAVE: '👶 Congé maternité',
            PATERNITY_LEAVE: '👶 Congé paternité',
            EXCEPTIONAL_LEAVE: '⭐ Congé exceptionnel',
            CONVENTIONAL_LEAVE: '📋 Congé conventionnel',
            UNPAID_LEAVE: '💼 Congé sans solde',
            TRAINING: '📚 Formation',
          };

          // Déterminer si c'est le premier/dernier jour
          const isFirstDay = dayIndex === 0;
          const isLastDay = dayIndex === daysInRange.length - 1;

          // Déterminer le type de demi-journée
          let halfDayType: 'morning' | 'afternoon' | 'full' = 'full';

          if (isFirstDay && isLastDay) {
            // Journée isolée
            if (leave.halfDayStart) {
              halfDayType = 'afternoon'; // Commence l'après-midi
            } else if (leave.halfDayEnd) {
              halfDayType = 'morning'; // Se termine le matin
            }
          } else if (isFirstDay && leave.halfDayStart) {
            // Premier jour d'une période, commence l'après-midi
            halfDayType = 'afternoon';
          } else if (isLastDay && leave.halfDayEnd) {
            // Dernier jour d'une période, se termine le matin
            halfDayType = 'morning';
          }


          const newEvent: CalendarEvent = {
            id: `leave-${leave.id}-day-${dayIndex}`,
            title: leaveTypeLabels[leave.type] || leave.type,
            date: day,
            type: 'leave',
            status: leave.status,
            description: leave.reason || '',
            leaveType: leave.type,
            // Multi-jours
            originalTaskId: leave.id,
            isSpanning: daysInRange.length > 1,
            spanDay: dayIndex + 1,
            totalSpanDays: daysInRange.length,
            // Demi-journées
            halfDayType,
            isFirstDay,
            isLastDay,
          };

          leaveEvents.push(newEvent);
        });
      });

      // Fusionner tous les événements
      const allEvents = [...taskEvents, ...projectEvents, ...leaveEvents];
      setEvents(allEvents);
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Charger les données au montage et quand l'utilisateur change
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  // Mémoisation des fonctions pour éviter les re-renders
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    if (view === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
    }
  }, [view, currentDate]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Mémoisation du calcul des événements par date
  const getEventsForDate = useCallback((date: Date) => {
    const eventsOnDate = filteredEvents.filter(event => isSameDay(event.date, date));

    // ✅ TRI CHRONOLOGIQUE par heure de début
    return eventsOnDate.sort((a, b) => {
      // Si les deux événements ont des heures de début, les comparer
      if (a.startTime && b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      // Événements avec heure de début en premier
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      // Sinon, garder l'ordre par défaut
      return 0;
    });
  }, [filteredEvents]);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'task': return '#2196f3';
      case 'project': return '#ff9800';
      case 'simple_task': return '#9c27b0';
      case 'leave': return '#4caf50'; // Vert pour les congés
      default: return '#666';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      case 'P3': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'DONE': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'BLOCKED': return 'error';
      default: return 'default';
    }
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: fr });
    const endDate = endOfWeek(monthEnd, { locale: fr });

    const days = [];
    let date = startDate;

    while (date <= endDate) {
      days.push(new Date(date));
      date = addDays(date, 1);
    }

    return (
      <Box sx={{ display: "flex", gap: 0, flexWrap: "wrap", border: '1px solid', borderColor: 'divider' }}>
        {/* En-têtes des jours */}
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
          <Box sx={{ flexGrow: 1, minWidth: 200 }} key={day}>
            <Box
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: 'grey.100',
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontWeight: 'bold',
              }}
            >
              {day}
            </Box>
          </Box>
        ))}

        {/* Grille du calendrier */}
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);


          return (
            <Box sx={{ flexGrow: 1, minWidth: 200 }} key={index}>
              <Box
                sx={{
                  minHeight: 120,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: !isCurrentMonth ? 'grey.50' : 'white',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => {
                  setSelectedDate(day);
                  setEventDialogOpen(true);
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isTodayDate ? 'bold' : 'normal',
                      color: isTodayDate ? 'white' : !isCurrentMonth ? 'text.disabled' : 'text.primary',
                      bgcolor: isTodayDate ? 'primary.main' : 'transparent',
                      borderRadius: isTodayDate ? '50%' : 0,
                      width: isTodayDate ? 24 : 'auto',
                      height: isTodayDate ? 24 : 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {format(day, 'd')}
                  </Typography>
                  {dayEvents.length > 0 && (
                    <Badge badgeContent={dayEvents.length} color="primary" />
                  )}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {dayEvents.slice(0, 3).map((event) => {
                    // Calcul de la largeur et de l'icône pour les congés avec demi-journée
                    const isLeave = event.type === 'leave';
                    const isHalfDay = isLeave && event.halfDayType && event.halfDayType !== 'full';
                    const widthPercent = isHalfDay ? '48%' : '100%';
                    const alignSelf = isLeave && event.halfDayType === 'afternoon' ? 'flex-end' :
                                      isLeave && event.halfDayType === 'morning' ? 'flex-start' :
                                      'stretch';


                    // Icône selon type de demi-journée
                    const getLeaveIcon = () => {
                      if (!isLeave) return '';
                      if (event.halfDayType === 'morning') return '🌅 ';
                      if (event.halfDayType === 'afternoon') return '🌆 ';
                      return '🌞 ';
                    };

                    // Gradient pour les congés demi-journée
                    const getBgColor = () => {
                      if (!isLeave) return `${getEventTypeColor(event.type)}20`;
                      if (event.halfDayType === 'morning') {
                        return 'linear-gradient(90deg, rgba(76,175,80,0.2) 0%, rgba(129,199,132,0.2) 100%)';
                      } else if (event.halfDayType === 'afternoon') {
                        return 'linear-gradient(90deg, rgba(129,199,132,0.2) 0%, rgba(76,175,80,0.2) 100%)';
                      }
                      return `${getEventTypeColor(event.type)}20`;
                    };

                    return (
                      <Box
                        key={event.id}
                        sx={{
                          p: 0.5,
                          width: widthPercent,
                          alignSelf: alignSelf,
                          background: getBgColor(),
                          borderLeft: `3px solid ${getEventTypeColor(event.type)}`,
                          borderRadius: 0.5,
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setEventDialogOpen(true);
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                          }}
                        >
                          {getLeaveIcon()}{event.title}
                          {event.isSpanning && event.spanDay && event.totalSpanDays && (
                            <Chip
                              size="small"
                              label={`J${event.spanDay}/${event.totalSpanDays}`}
                              sx={{
                                ml: 0.5,
                                height: 14,
                                fontSize: '0.55rem',
                                bgcolor: 'rgba(0,0,0,0.15)',
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                        </Typography>
                        {(() => {
                          if (event.startTime && event.endTime) {
                              return (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  fontSize: '0.65rem',
                                  color: '#667eea',
                                  fontWeight: 'bold',
                                }}
                              >
                                🕐 {event.startTime} - {event.endTime}
                              </Typography>
                            );
                          }
                          return null;
                        })()}
                      </Box>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      +{dayEvents.length - 3} autres
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderWeekView = () => {
    console.log('[WEEK VIEW RENDER] Version 2025-01-06-15h45');
    const weekStart = startOfWeek(currentDate, { locale: fr });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {days.map((day) => {
          const dayEvents = getEventsForDate(day);
          console.log(`[WEEK VIEW DAY] ${format(day, 'yyyy-MM-dd')}: ${dayEvents.length} events`);
          const isTodayDate = isToday(day);

          return (
            <Box sx={{ flexGrow: 1, minWidth: 200 }} key={day.toString()}>
              <Card sx={{ minHeight: 400 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      p: 1,
                      bgcolor: isTodayDate ? 'primary.main' : 'grey.100',
                      color: isTodayDate ? 'white' : 'text.primary',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="h6">
                      {format(day, 'EEE d', { locale: fr })}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dayEvents.map((event) => {
                      // Icône pour les congés avec demi-journée
                      const isLeave = event.type === 'leave';
                      const isHalfDay = isLeave && event.halfDayType && event.halfDayType !== 'full';
                      const widthPercent = isHalfDay ? '48%' : '100%';
                      const alignSelf = isLeave && event.halfDayType === 'afternoon' ? 'flex-end' :
                                        isLeave && event.halfDayType === 'morning' ? 'flex-start' :
                                        'stretch';

                      if (isLeave) {
                        console.log('[WEEK VIEW] Leave event:', {
                          title: event.title,
                          halfDayType: event.halfDayType,
                          isHalfDay,
                          widthPercent,
                          alignSelf
                        });
                      }

                      const getLeaveIcon = () => {
                        if (!isLeave) return null;
                        if (event.halfDayType === 'morning') return '🌅';
                        if (event.halfDayType === 'afternoon') return '🌆';
                        return '🌞';
                      };

                      const getBgGradient = () => {
                        if (!isLeave) return {};
                        if (event.halfDayType === 'morning') {
                          return { background: 'linear-gradient(90deg, rgba(76,175,80,0.1) 0%, rgba(129,199,132,0.1) 100%)' };
                        } else if (event.halfDayType === 'afternoon') {
                          return { background: 'linear-gradient(90deg, rgba(129,199,132,0.1) 0%, rgba(76,175,80,0.1) 100%)' };
                        }
                        return {};
                      };

                      return (
                        <Card
                          key={event.id}
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            width: widthPercent,
                            alignSelf: alignSelf,
                            ...getBgGradient(),
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => {
                            setSelectedEvent(event);
                            setEventDialogOpen(true);
                          }}
                        >
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              {isLeave ? (
                                <span style={{ fontSize: '1rem' }}>{getLeaveIcon()}</span>
                              ) : (
                                <AssignmentIcon fontSize="small" />
                              )}
                              <Typography variant="body2" fontWeight="bold" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {event.title}
                              </Typography>
                            {event.isSpanning && event.spanDay && event.totalSpanDays && (
                              <Chip
                                size="small"
                                label={`J${event.spanDay}/${event.totalSpanDays}`}
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: 'info.light',
                                  color: 'info.dark',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </Box>
                          {(() => {
                            if (event.startTime && event.endTime) {
                                return (
                                <Typography variant="caption" sx={{ display: 'block', color: '#667eea', fontWeight: 'bold', fontSize: '0.7rem' }}>
                                  🕐 {event.startTime} - {event.endTime}
                                </Typography>
                              );
                            }
                            return null;
                          })()}
                          <Stack direction="row" spacing={0.5}>
                            {event.priority && (
                              <Chip
                                label={event.priority}
                                size="small"
                                color={getPriorityColor(event.priority)}
                              />
                            )}
                            {event.status && (
                              <Chip
                                label={event.status}
                                size="small"
                                color={getStatusColor(event.status)}
                              />
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const isTodayDate = isToday(currentDate);

    return (
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              p: 2,
              bgcolor: isTodayDate ? 'primary.main' : 'grey.100',
              color: isTodayDate ? 'white' : 'text.primary',
              borderRadius: 1,
            }}
          >
            <Typography variant="h4">
              {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </Typography>
          </Box>

          <Stack spacing={2}>
            {dayEvents.length === 0 ? (
              <Alert severity="info">
                Aucun événement prévu pour cette journée.
              </Alert>
            ) : (
              dayEvents.map((event) => (
                <Card
                  key={event.id}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => {
                    setSelectedEvent(event);
                    setEventDialogOpen(true);
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <AssignmentIcon />
                      <Box flexGrow={1}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="h6">
                            {event.title}
                          </Typography>
                          {event.isSpanning && event.spanDay && event.totalSpanDays && (
                            <Chip
                              label={`Jour ${event.spanDay} sur ${event.totalSpanDays}`}
                              size="small"
                              color="info"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                        {event.startTime && event.endTime && (
                          <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 'bold', mt: 0.5 }}>
                            🕐 {event.startTime} - {event.endTime}
                          </Typography>
                        )}
                        {event.description && (
                          <Typography variant="body2" color="text.secondary">
                            {event.description}
                          </Typography>
                        )}
                      </Box>
                      {/* Affichage de tous les responsables */}
                      {event.allAssignees && event.allAssignees.length > 0 ? (
                        <Stack direction="row" spacing={-1}>
                          {event.allAssignees.slice(0, 3).map((assignee, index) => (
                            <Avatar
                              key={assignee?.id || index}
                              src={assignee?.avatarUrl}
                              sx={{
                                width: 32,
                                height: 32,
                                border: 2,
                                borderColor: 'background.paper'
                              }}
                            >
                              {assignee?.firstName?.[0]}{assignee?.lastName?.[0]}
                            </Avatar>
                          ))}
                          {event.allAssignees.length > 3 && (
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.400' }}>
                              +{event.allAssignees.length - 3}
                            </Avatar>
                          )}
                        </Stack>
                      ) : event.assignee ? (
                        // Fallback pour rétrocompatibilité
                        <Avatar src={event.assignee.avatarUrl}>
                          {event.assignee.firstName?.[0]}{event.assignee.lastName?.[0]}
                        </Avatar>
                      ) : null}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {event.priority && (
                        <Chip
                          label={event.priority}
                          size="small"
                          color={getPriorityColor(event.priority)}
                        />
                      )}
                      {event.status && (
                        <Chip
                          label={event.status}
                          size="small"
                          color={getStatusColor(event.status)}
                        />
                      )}
                      {event.project && (
                        <Chip
                          label={event.project.name}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const getViewTitle = () => {
    switch (view) {
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: fr });
      case 'week':
        return `Semaine du ${format(startOfWeek(currentDate, { locale: fr }), 'd MMM', { locale: fr })}`;
      case 'day':
        return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
      default:
        return '';
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await taskService.updateTask(taskId, updates);
      loadData(); // Recharger les données
    } catch (error) {
      // Erreur silencieuse
    }
  };

  if (loading) {
    return <LoadingSpinner message="Chargement du calendrier..." />;
  }

  return (
    <Box>
        {/* ✅ Header compact unifié */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ p: 2 }}>
            {/* Barre principale avec titre et action */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="h5" component="h1">
                📅 Calendrier & Planning
              </Typography>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setSelectedDateForSimpleTask(new Date());
                  setSimpleTaskModalOpen(true);
                }}
                color="primary"
                size="small"
              >
                Nouvelle Tâche
              </Button>
            </Stack>

            {/* ✅ Filtres compacts */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
              {/* Filtre projets */}
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Projets</InputLabel>
                <Select
                  multiple
                  value={selectedProjects}
                  onChange={(e) => setSelectedProjects(e.target.value as string[])}
                  label="Projets"
                  renderValue={(selected) =>
                    selected.length === 0 ? 'Tous' : `${selected.length} projet(s)`
                  }
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      <Checkbox checked={selectedProjects.includes(project.id)} />
                      <ListItemText primary={project.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Filtre services */}
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Services</InputLabel>
                <Select
                  multiple
                  value={selectedServices}
                  onChange={(e) => setSelectedServices(e.target.value as string[])}
                  label="Services"
                  renderValue={(selected) =>
                    selected.length === 0 ? 'Tous' : `${selected.length} service(s)`
                  }
                >
                  <MenuItem key="encadrement" value="encadrement">
                    <Checkbox checked={selectedServices.includes('encadrement')} />
                    <ListItemText primary="Encadrement" primaryTypographyProps={{ fontWeight: 600 }} />
                  </MenuItem>
                  {services.map((service) => (
                    <MenuItem key={service.id} value={service.id}>
                      <Checkbox checked={selectedServices.includes(service.id)} />
                      <ListItemText primary={service.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Bouton réinitialiser */}
              {(selectedProjects.length > 0 || selectedServices.length > 0) && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setSelectedProjects([]);
                    setSelectedServices([]);
                  }}
                >
                  Réinitialiser
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Composant PlanningCalendar avec lazy loading */}
        <Suspense fallback={
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <Typography>Chargement du planning...</Typography>
              </Box>
            </CardContent>
          </Card>
        }>
          <PlanningCalendar
            selectedProjects={selectedProjects}
            selectedUsers={[]} // ✅ Calendar général : pas de filtre utilisateur
            selectedServices={selectedServices}
            onTaskUpdate={handleTaskUpdate}
          />
        </Suspense>

        {/* ✅ Modal création tâche simple */}
        <SimpleTaskModal
          open={simpleTaskModalOpen}
          onClose={() => {
            setSimpleTaskModalOpen(false);
            setSelectedDateForSimpleTask(null);
          }}
          onCreate={async (taskInput, userIds) => {
            if (userIds.length === 1) {
              await simpleTaskService.create(taskInput, userIds[0], currentUser?.id || '');
            } else {
              await simpleTaskService.createMultiple(taskInput, userIds, currentUser?.id || '');
            }
            loadData(); // Recharger
          }}
          currentUserId={currentUser?.id || ''}
        />

      </Box>
    );
  };

export { Calendar };
export default Calendar;
