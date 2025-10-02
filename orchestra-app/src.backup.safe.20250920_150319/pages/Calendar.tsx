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
} from '@mui/material';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Assignment as AssignmentIcon,
  Event as EventIcon,
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
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, Project, User } from '../types';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { userService } from '../services/user.service';
import { SimpleTaskModal } from '../components/calendar/SimpleTaskModal';
import { CreateObjectiveModal } from '../components/calendar/CreateObjectiveModal';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
// Lazy loading du composant PlanningCalendar pour réduire la taille du bundle initial
const PlanningCalendar = lazy(() => import('../components/calendar/PlanningCalendar'));

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'project' | 'meeting' | 'simple_task';
  status?: string;
  priority?: string;
  assignee?: User; // Premier responsable pour rétrocompatibilité
  allAssignees?: User[]; // Tous les responsables
  project?: Project;
  description?: string;
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
  const [createObjectiveOpen, setCreateObjectiveOpen] = useState(false);
  
  // ✅ Filtres pour le calendrier général (sans filtre par responsable)
  const [filters, setFilters] = useState({
    eventType: 'all', // 'all', 'task', 'simple_task', 'project', 'meeting'
    project: 'all',
    taskCategory: 'all', // 'all', 'PROJECT_TASK', 'SIMPLE_TASK'
  });
  
  const [projects, setProjects] = useState<Project[]>([]);
  
  // États pour le mode Planning
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // ✅ États pour les tâches simples
  const [simpleTaskModalOpen, setSimpleTaskModalOpen] = useState(false);
  const [selectedDateForSimpleTask, setSelectedDateForSimpleTask] = useState<Date | null>(null);

  useEffect(() => {
    loadData();

    // Vérifier si on doit ouvrir la modal de création d'objectif
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'create-objective') {
      setCreateObjectiveOpen(true);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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
        event.project?.id === filters.project || event.type === 'simple_task'
      );
    }

    // ✅ Nouveau filtre par catégorie de tâche
    if (filters.taskCategory !== 'all') {
      if (filters.taskCategory === 'PROJECT_TASK') {
        filtered = filtered.filter(event => event.type === 'task' || event.type === 'project');
      } else if (filters.taskCategory === 'SIMPLE_TASK') {
        filtered = filtered.filter(event => event.type === 'simple_task');
      }
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
      
      // ✅ Calendar général : récupérer TOUTES les tâches comme Dashboard-Hub
      const [allTasks, projectsData] = await Promise.all([
        taskService.getTasks(), // Toutes les tâches sans filtre de date
        projectService.getActiveProjects(), // Seulement projets actifs
      ]);

      // ✅ Toutes les tâches sont incluses
      const tasks = allTasks;

      setProjects(projectsData);

      // Convertir les tâches en événements
      const taskEvents: CalendarEvent[] = tasks
        .filter(task => task.dueDate)
        .map(task => ({
          id: `task-${task.id}`,
          title: task.title,
          date: new Date(task.dueDate!),
          type: 'task' as const,
          status: task.status,
          priority: task.priority,
          assignee: undefined, // Pas de responsable principal pour le calendrier général
          // Tous les responsables de la tâche (récupérés séparément si nécessaire)
          allAssignees: [], // Pas d'affichage des responsables dans le calendrier général
          project: projectsData.find(p => p.id === task.projectId),
          description: task.description,
        }));

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

      setEvents([...taskEvents, ...projectEvents]);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  }, []);

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
    return filteredEvents.filter(event => isSameDay(event.date, date));
  }, [filteredEvents]);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'task': return '#2196f3';
      case 'project': return '#ff9800';
      case 'meeting': return '#4caf50';
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

                <Stack spacing={0.5}>
                  {dayEvents.slice(0, 3).map((event) => (
                    <Box
                      key={event.id}
                      sx={{
                        p: 0.5,
                        bgcolor: `${getEventTypeColor(event.type)  }20`,
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
                        }}
                      >
                        {event.title}
                      </Typography>
                    </Box>
                  ))}
                  {dayEvents.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      +{dayEvents.length - 3} autres
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { locale: fr });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {days.map((day) => {
          const dayEvents = getEventsForDate(day);
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

                  <Stack spacing={1}>
                    {dayEvents.map((event) => (
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
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            {event.type === 'task' ? <AssignmentIcon fontSize="small" /> : <EventIcon fontSize="small" />}
                            <Typography variant="body2" fontWeight="bold">
                              {event.title}
                            </Typography>
                          </Box>
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
                    ))}
                  </Stack>
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
                      {event.type === 'task' ? <AssignmentIcon /> : <EventIcon />}
                      <Box flexGrow={1}>
                        <Typography variant="h6">{event.title}</Typography>
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
      
    }
  };

  if (loading) {
    return <LoadingSpinner message="Chargement du calendrier..." />;
  }

  return (
    <Box>
        {/* En-tête avec actions rapides */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* ✅ Barre d'actions principale */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" component="h1">
                📅 Calendrier & Planning
              </Typography>

              {/* ✅ Boutons d'action */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<BoltIcon />}
                  onClick={() => setCreateObjectiveOpen(true)}
                  color="primary"
                  sx={{ fontWeight: 'bold' }}
                >
                  🎯 Nouvel Objectif
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<AssignmentIcon />}
                  onClick={() => {
                    setSelectedDateForSimpleTask(new Date());
                    setSimpleTaskModalOpen(true);
                  }}
                >
                  Tâche Simple
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    // TODO: Ouvrir modal création événement/réunion
                    console.log('Créer événement');
                  }}
                >
                  Événement
                </Button>
              </Stack>
            </Stack>

            {/* ✅ Filtres étendus */}
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 2 }}>
              {/* Filtre par catégorie de tâche */}
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Type de tâche</InputLabel>
                <Select
                  value={filters.taskCategory}
                  onChange={(e) => setFilters({ ...filters, taskCategory: e.target.value })}
                  label="Type de tâche"
                >
                  <MenuItem value="all">Toutes les tâches</MenuItem>
                  <MenuItem value="PROJECT_TASK">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ProjectIcon fontSize="small" />
                      <Typography>Tâches projet</Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="SIMPLE_TASK">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <BoltIcon fontSize="small" />
                      <Typography>Tâches simples</Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Filtre par type d'événement */}
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Type d'événement</InputLabel>
                <Select
                  value={filters.eventType}
                  onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  label="Type d'événement"
                >
                  <MenuItem value="all">Tous les événements</MenuItem>
                  <MenuItem value="task">Tâches projet</MenuItem>
                  <MenuItem value="simple_task">Tâches simples</MenuItem>
                  <MenuItem value="project">Échéances projet</MenuItem>
                  <MenuItem value="meeting">Réunions</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Projets sélectionnés</InputLabel>
                <Select
                  multiple
                  value={selectedProjects}
                  onChange={(e) => setSelectedProjects(e.target.value as string[])}
                  label="Projets sélectionnés"
                  renderValue={(selected) =>
                    selected.length === 0 ? 'Tous les projets' : `${selected.length} projet(s)`
                  }
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      <Chip
                        size="small"
                        label={project.name}
                        sx={{ maxWidth: 150 }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSelectedProjects([]);
                  setFilters({
                    eventType: 'all',
                    project: 'all',
                    taskCategory: 'all',
                  });
                }}
              >
                Réinitialiser filtres
              </Button>
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
          onTaskCreated={(createdTasks) => {
            console.log('Tâche(s) simple(s) créée(s):', createdTasks);
            if (Array.isArray(createdTasks)) {
              console.log('Nombre de tâches créées:', createdTasks.length);
              createdTasks.forEach((task, index) => {
                console.log(`Tâche ${index + 1}:`, {
                  id: task.id,
                  title: task.title,
                  responsible: task.responsible,
                  dueDate: task.dueDate,
                  createdAt: task.createdAt
                });
              });
            }
            loadData(); // Recharger les données du calendrier
          }}
          initialDate={selectedDateForSimpleTask || undefined}
        />

        {/* 🎯 Modal création objectif */}
        <CreateObjectiveModal
          open={createObjectiveOpen}
          onClose={() => setCreateObjectiveOpen(false)}
          onCreated={(objectiveId) => {
            console.log('Objectif créé:', objectiveId);
            // Recharger les données pour voir le nouvel objectif
            loadData();
            setCreateObjectiveOpen(false);
          }}
        />
      </Box>
    );
  };

export { Calendar };
export default Calendar;
