import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  Stack,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon,
  Today as TodayIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
} from '@mui/icons-material';
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, addMonths, subMonths, startOfDay, endOfDay, addHours, differenceInHours, getISOWeek, startOfYear, addWeeks, differenceInWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Project, Milestone, ProjectStatus } from '../../types';

interface PortfolioGanttProps {
  projects: Project[];
  milestones: Milestone[];
}

type TimeScale = 'day' | 'week' | 'month';

const PortfolioGantt: React.FC<PortfolioGanttProps> = ({ projects, milestones }) => {
  const [timeScale, setTimeScale] = useState<TimeScale>('month');
  const [visibleProjects, setVisibleProjects] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Initialiser avec tous les projets visibles
  useEffect(() => {
    setVisibleProjects(projects.map(p => p.id));
  }, [projects]);

  // Filtrer les projets actifs et à venir
  const filteredProjects = useMemo(() => {
    return projects.filter(p =>
      ['active', 'planning', 'draft'].includes(p.status) &&
      visibleProjects.includes(p.id)
    ).sort((a, b) => {
      // Trier par date de début
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    });
  }, [projects, visibleProjects]);

  // Calculer la période visible selon l'échelle
  const getVisibleRange = () => {
    switch (timeScale) {
      case 'day':
        // Vue jour : 30 jours (15 avant + 15 après)
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15)
        };
      case 'week':
        // Vue semaine : 30 semaines (15 avant + 15 après)
        return {
          start: startOfWeek(addWeeks(currentDate, -15), { locale: fr }),
          end: endOfWeek(addWeeks(currentDate, 15), { locale: fr })
        };
      case 'month':
        // Vue mois : 12 mois (6 avant + 6 après)
        return {
          start: startOfMonth(addMonths(currentDate, -6)),
          end: endOfMonth(addMonths(currentDate, 5))
        };
      default:
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15)
        };
    }
  };

  const visibleRange = getVisibleRange();

  // Calculer le nombre d'unités et les colonnes selon l'échelle
  const getTimeData = (): { totalUnits: number; columns: any[]; unitType: string } => {
    switch (timeScale) {
      case 'day': {
        // Vue JOUR = affichage par JOURS
        const totalDays = differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentDay = visibleRange.start;

        while (currentDay <= visibleRange.end) {
          columns.push({
            date: currentDay,
            label: format(currentDay, 'd', { locale: fr }),
            sublabel: format(currentDay, 'EEE', { locale: fr }),
            width: 100 / totalDays
          });
          currentDay = addDays(currentDay, 1);
        }
        return { totalUnits: totalDays, columns, unitType: 'day' };
      }

      case 'week': {
        // Vue SEMAINE = affichage par SEMAINES
        const totalWeeks = differenceInWeeks(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentWeek = visibleRange.start;

        while (currentWeek <= visibleRange.end) {
          const weekEnd = endOfWeek(currentWeek, { locale: fr });
          const adjustedEnd = weekEnd > visibleRange.end ? visibleRange.end : weekEnd;
          const weekDays = differenceInDays(adjustedEnd, currentWeek) + 1;

          columns.push({
            date: currentWeek,
            label: `S${getISOWeek(currentWeek)}`,
            sublabel: '',
            width: (weekDays * 100) / (differenceInDays(visibleRange.end, visibleRange.start) + 1)
          });
          currentWeek = addWeeks(currentWeek, 1);
        }
        return { totalUnits: differenceInDays(visibleRange.end, visibleRange.start) + 1, columns, unitType: 'week' };
      }

      case 'month': {
        // Vue MOIS = affichage par MOIS
        const totalDays = differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentMonth = visibleRange.start;

        while (currentMonth <= visibleRange.end) {
          const monthEnd = endOfMonth(currentMonth);
          const adjustedEnd = monthEnd > visibleRange.end ? visibleRange.end : monthEnd;
          const monthDays = differenceInDays(adjustedEnd, currentMonth) + 1;

          columns.push({
            date: currentMonth,
            label: format(currentMonth, 'MMM', { locale: fr }),
            sublabel: format(currentMonth, 'yyyy'),
            width: (monthDays * 100) / totalDays
          });
          currentMonth = addMonths(currentMonth, 1);
        }
        return { totalUnits: totalDays, columns, unitType: 'month' };
      }
      default:
        const totalDays = differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentDay = visibleRange.start;

        while (currentDay <= visibleRange.end) {
          columns.push({
            date: currentDay,
            label: format(currentDay, 'EEE d', { locale: fr }),
            sublabel: format(currentDay, 'MMM', { locale: fr }),
            width: 100 / totalDays
          });
          currentDay = addDays(currentDay, 1);
        }
        return { totalUnits: totalDays, columns, unitType: 'day' };
    }
  };

  const timeData = getTimeData();
  const timeColumns = timeData.columns;

  // Calculer la position et largeur d'un élément sur le Gantt
  const getBarPosition = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Si l'élément est en dehors de la période visible
    if (end < visibleRange.start || start > visibleRange.end) {
      return null;
    }

    // Ajuster les dates aux limites visibles
    const adjustedStart = start < visibleRange.start ? visibleRange.start : start;
    const adjustedEnd = end > visibleRange.end ? visibleRange.end : end;

    // Calculer selon l'échelle de temps
    const startOffset = differenceInDays(adjustedStart, visibleRange.start);
    const duration = differenceInDays(adjustedEnd, adjustedStart) + 1;
    const totalUnits = differenceInDays(visibleRange.end, visibleRange.start) + 1;

    return {
      left: (startOffset / totalUnits) * 100,
      width: (duration / totalUnits) * 100
    };
  };

  // Couleurs par statut de projet
  const getProjectColor = (status: ProjectStatus) => {
    const colors = {
      active: '#4caf50',
      planning: '#2196f3',
      draft: '#9e9e9e',
      on_hold: '#ff9800',
      completed: '#667eea',
      cancelled: '#f44336'
    };
    return colors[status] || '#9e9e9e';
  };

  // Couleur pour les jalons
  const getMilestoneColor = (status: string, dueDate: Date) => {
    if (status === 'completed') return '#4caf50';
    if (new Date(dueDate) < new Date()) return '#f44336';
    return '#ff9800';
  };

  // Navigation temporelle
  const navigateTime = (direction: 'prev' | 'next') => {
    let amount = 1;
    switch (timeScale) {
      case 'day':
        amount = 30; // 30 jours
        break;
      case 'week':
        amount = 30 * 7 / 30; // ~7 mois pour 30 semaines
        amount = 7;
        break;
      case 'month':
        amount = 12; // 12 mois
        break;
    }

    if (timeScale === 'day') {
      setCurrentDate(direction === 'next'
        ? addDays(currentDate, amount)
        : addDays(currentDate, -amount)
      );
    } else if (timeScale === 'week') {
      setCurrentDate(direction === 'next'
        ? addWeeks(currentDate, amount)
        : addWeeks(currentDate, -amount)
      );
    } else {
      setCurrentDate(direction === 'next'
        ? addMonths(currentDate, amount)
        : addMonths(currentDate, -amount)
      );
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Zoom
  const handleZoom = (direction: 'in' | 'out') => {
    const scales: TimeScale[] = ['day', 'week', 'month'];
    const currentIndex = scales.indexOf(timeScale);

    if (direction === 'in' && currentIndex > 0) {
      setTimeScale(scales[currentIndex - 1]);
    } else if (direction === 'out' && currentIndex < scales.length - 1) {
      setTimeScale(scales[currentIndex + 1]);
    }
  };

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête avec contrôles */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Gantt Portfolio - Vue d'ensemble des Projets
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          {/* Sélecteur d'échelle */}
          <FormControl size="small">
            <Select
              value={timeScale}
              onChange={(e: SelectChangeEvent) => setTimeScale(e.target.value as TimeScale)}
            >
              <MenuItem value="day">Jour</MenuItem>
              <MenuItem value="week">Semaine</MenuItem>
              <MenuItem value="month">Mois</MenuItem>
            </Select>
          </FormControl>

          {/* Navigation temporelle */}
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => navigateTime('prev')}>
              <ArrowLeftIcon />
            </IconButton>
            <IconButton size="small" onClick={() => navigateTime('next')}>
              <ArrowRightIcon />
            </IconButton>
          </Stack>

          {/* Zoom */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="Zoom avant">
              <IconButton size="small" onClick={() => handleZoom('in')}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom arrière">
              <IconButton size="small" onClick={() => handleZoom('out')}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Corps du Gantt */}
      <Box sx={{ flexGrow: 1, overflowX: 'auto', overflowY: 'auto', border: '1px solid', borderColor: 'divider' }}>
        {/* En-tête de l'échelle de temps */}
        <Box sx={{ display: 'flex', borderBottom: '2px solid', borderColor: 'divider', bgcolor: 'grey.50', minWidth: '100%' }}>
          <Box sx={{ width: 250, p: 1, borderRight: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight="bold">
              Projets
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {timeColumns.map((col, index) => (
              <Box
                key={index}
                sx={{
                  width: `${col.width}%`,
                  p: 0.5,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'center',
                  minWidth: timeScale === 'day' ? 60 : 30
                }}
              >
                <Typography variant="caption" display="block" fontWeight="bold">
                  {col.label}
                </Typography>
                {col.sublabel && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {col.sublabel}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Lignes des projets */}
        {filteredProjects.map(project => {
          const projectMilestones = milestones.filter(m => m.projectId === project.id);
          const projectBar = getBarPosition(project.startDate, project.dueDate || new Date());

          console.log(`Project ${project.name} (${project.id}) has ${projectMilestones.length} milestones`);
          if (projectMilestones.length > 0) {
            console.log('Milestones for project:', projectMilestones);
          }

          return (
            <Box key={project.id}>
              {/* Ligne du projet (comme jalon global) */}
              <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', minHeight: 50 }}>
                <Box
                  sx={{
                    width: 250,
                    p: 1,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {project.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={project.status.replace('_', ' ')}
                      sx={{
                        bgcolor: getProjectColor(project.status),
                        color: 'white',
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {project.progress}%
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: hoveredItem === project.id ? 'action.hover' : 'transparent' }}>
                  {projectBar && (
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="caption" display="block">
                            {project.name}
                          </Typography>
                          <Typography variant="caption" display="block">
                            {format(new Date(project.startDate), 'dd/MM/yyyy')} - {project.dueDate ? format(new Date(project.dueDate), 'dd/MM/yyyy') : 'En cours'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Progression: {project.progress}%
                          </Typography>
                        </Box>
                      }
                    >
                      <Box
                        onMouseEnter={() => setHoveredItem(project.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          left: `${projectBar.left}%`,
                          width: `${projectBar.width}%`,
                          height: 30,
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: 1,
                          border: '2px solid',
                          borderColor: getProjectColor(project.status),
                          cursor: 'pointer',
                          overflow: 'hidden',
                          boxShadow: `0 4px 8px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)`,
                          '&:hover': {
                            boxShadow: `0 6px 12px rgba(0,0,0,0.2), 0 3px 6px rgba(0,0,0,0.15)`,
                            transform: 'translateY(-52%)'
                          }
                        }}
                      >
                        {/* Barre de progression */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${project.progress}%`,
                            bgcolor: getProjectColor(project.status),
                            borderRadius: 1,
                            transition: 'width 0.3s ease'
                          }}
                        />
                        {/* Contenu texte */}
                        <Box
                          sx={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 1,
                            height: '100%'
                          }}
                        >
                          <Typography variant="caption" color="white" noWrap sx={{ fontWeight: 600 }}>
                            {project.name}
                          </Typography>
                          <Typography variant="caption" color="white" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                            {project.progress}%
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Lignes des jalons (comme tâches du projet) */}
              {projectMilestones.map(milestone => {
                const milestoneStartDate = milestone.startDate || milestone.dueDate || new Date();
                const milestoneEndDate = milestone.dueDate || milestone.startDate || new Date();
                const milestoneBar = getBarPosition(
                  milestoneStartDate,
                  milestoneEndDate
                );

                return (
                  <Box
                    key={milestone.id}
                    sx={{
                      display: 'flex',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      minHeight: 28,
                      bgcolor: 'grey.50'
                    }}
                  >
                    <Box
                      sx={{
                        width: 250,
                        py: 0.5,
                        px: 1,
                        pl: 3,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'grey.50',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                        ◆ {milestone.name}
                      </Typography>
                    </Box>

                    <Box sx={{ flexGrow: 1, position: 'relative' }}>
                      {milestoneBar && (
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" display="block">
                                {milestone.name}
                              </Typography>
                              <Typography variant="caption" display="block">
                                {format(milestoneStartDate, 'dd/MM/yyyy')} - {format(milestoneEndDate, 'dd/MM/yyyy')}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Statut: {milestone.status === 'completed' ? 'Atteint' : 'En attente'}
                              </Typography>
                            </Box>
                          }
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              left: `${milestoneBar.left}%`,
                              width: `${milestoneBar.width}%`,
                              height: 16,
                              bgcolor: getMilestoneColor(milestone.status, milestoneEndDate),
                              borderRadius: 2,
                              border: '2px solid',
                              borderColor: getMilestoneColor(milestone.status, milestoneEndDate),
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              px: 0.5,
                              opacity: 0.9,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              background: `linear-gradient(45deg, ${getMilestoneColor(milestone.status, milestoneEndDate)} 0%, ${getMilestoneColor(milestone.status, milestoneEndDate)}aa 100%)`,
                              '&:hover': {
                                opacity: 1,
                                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                                transform: 'translateY(-50%) scale(1.05)'
                              }
                            }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                bgcolor: 'white',
                                borderRadius: '50%',
                                mr: 0.5,
                                flexShrink: 0
                              }}
                            />
                            <Typography variant="caption" color="white" fontSize="10px" noWrap sx={{ fontWeight: 600 }}>
                              {milestone.name}
                            </Typography>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })}

      </Box>

      {/* Légende */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 30, height: 12, bgcolor: '#4caf50', borderRadius: 0.5 }} />
          <Typography variant="caption">Actif</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 30, height: 12, bgcolor: '#2196f3', borderRadius: 0.5 }} />
          <Typography variant="caption">Planification</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#4caf50', borderRadius: '50%' }} />
          <Typography variant="caption">Jalon atteint</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#ff9800', borderRadius: '50%' }} />
          <Typography variant="caption">Jalon à venir</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#f44336', borderRadius: '50%' }} />
          <Typography variant="caption">Jalon en retard</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default PortfolioGantt;