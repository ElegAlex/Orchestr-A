import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Avatar,
  Collapse,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { format, isSameDay } from 'date-fns';
import { User, Department, Project } from '../../types';
import { Service } from '../../types/service';

// Types pour les workload days
interface CalendarItem {
  id: string;
  title: string;
  type: 'task' | 'meeting' | 'admin' | 'training' | 'leave' | 'remote' | 'simple_task';
  startTime: Date;
  endTime: Date;
  userId: string;
  projectId?: string;
  project?: Project;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  assignee?: User;
  color: string;
  isRemote: boolean;
  canMove: boolean;
  canResize: boolean;
  originalTaskId?: string;
  isSpanning?: boolean;
  spanDay?: number;
  totalSpanDays?: number;
}

interface UserWorkloadDay {
  userId: string;
  user: User;
  date: Date;
  items: CalendarItem[];
}

interface MonthViewProps {
  monthDays: Date[];
  workloadDaysByService: Map<string, UserWorkloadDay[]>;
  departments: Department[];
  services: Service[];
  expandedServices: Set<string>;
  onToggleService: (serviceId: string) => void;
  onItemClick: (item: CalendarItem) => void;
  getUserDisplayName: (user: User) => string;
  teleworkSystem: any;
}

export const MonthView: React.FC<MonthViewProps> = ({
  monthDays,
  workloadDaysByService,
  departments,
  services,
  expandedServices,
  onToggleService,
  onItemClick,
  getUserDisplayName,
  teleworkSystem,
}) => {
  return (
    <Box sx={{ overflowX: 'auto', width: '100%' }}>
      {/* Conteneur avec largeur fixe pour le scroll horizontal */}
      <Box sx={{ minWidth: 220 + 44 * monthDays.length }}>
        {/* En-têtes des colonnes jours du mois (STICKY) */}
        <Card sx={{
          mb: 1,
          position: 'sticky',
          top: 64,
          zIndex: 1000,
          backgroundColor: 'background.paper',
          boxShadow: 2
        }}>
          <CardContent sx={{ p: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* Zone utilisateur header - même largeur que les lignes */}
              <Box sx={{
                width: 220,
                minWidth: 220,
                maxWidth: 220,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                pr: 1
              }}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary">
                  Ressources
                </Typography>
              </Box>

              {/* Zone timeline jours du mois */}
              <Box sx={{ flex: 1, minWidth: 0, pb: 1 }}>
              <Stack direction="row" spacing={0}>
                {monthDays.map((day) => {
                  const dayOfWeek = day.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        width: 44,
                        minWidth: 44,
                        maxWidth: 44,
                        textAlign: 'center',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isWeekend ? 'grey.100' : 'transparent'
                      }}
                    >
                      <Typography variant="caption" fontWeight="bold" color={isWeekend ? 'text.disabled' : 'text.primary'}>
                        {format(day, 'dd')}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {format(day, 'EEE', { locale: require('date-fns/locale/fr').fr }).substring(0, 1)}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Corps - Planning groupé par service */}
      <Stack spacing={1}>
        {Array.from(workloadDaysByService.entries()).map(([serviceId, serviceWorkloadDays]) => {
          // Gestion spéciale pour "Encadrement"
          if (serviceId === 'encadrement') {
            const serviceName = 'Encadrement';
            const serviceColor = '#ff9800';
            const isExpanded = expandedServices.has(serviceId);
            const userCount = serviceWorkloadDays.length;

            return (
              <Box key={serviceId}>
                {/* En-tête du service Encadrement */}
                <Card
                  sx={{
                    mb: 0.5,
                    background: 'linear-gradient(90deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%)',
                    border: '1px solid rgba(255,152,0,0.2)'
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onToggleService(serviceId)}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: serviceColor
                        }}
                      />
                      <BusinessIcon sx={{ color: 'warning.main' }} />
                      <Typography variant="h6" fontWeight="bold" color="warning.main">
                        {serviceName}
                      </Typography>
                      <Chip
                        label={`${userCount} ressource${userCount > 1 ? 's' : ''}`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                      <Box sx={{ flex: 1 }} />
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Lignes utilisateurs */}
                <Collapse in={isExpanded}>
                  <Box sx={{ ml: 2, mb: 1 }}>
                    <Stack spacing={0.5}>
                      {serviceWorkloadDays.map((workloadDay) => {
                        // Grouper les items par tâche multi-jours
                        const taskBars = new Map<string, CalendarItem[]>();
                        const singleDayItems = new Map<string, CalendarItem[]>();

                        workloadDay.items.forEach(item => {
                          if (item.originalTaskId && item.isSpanning) {
                            if (!taskBars.has(item.originalTaskId)) {
                              taskBars.set(item.originalTaskId, []);
                            }
                            taskBars.get(item.originalTaskId)!.push(item);
                          } else {
                            const dayKey = format(item.startTime, 'yyyy-MM-dd');
                            if (!singleDayItems.has(dayKey)) {
                              singleDayItems.set(dayKey, []);
                            }
                            singleDayItems.get(dayKey)!.push(item);
                          }
                        });

                        // Calculer le nombre max de barres empilées
                        const maxSingleDayBars = Math.max(...Array.from(singleDayItems.values()).map(items => items.length), 0);
                        const totalBars = taskBars.size + maxSingleDayBars;
                        const timelineHeight = Math.max(60, totalBars * 22 + 16);

                        return (
                          <Card key={workloadDay.userId} sx={{ mb: 1 }}>
                            <CardContent sx={{ p: 1 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {/* Colonne utilisateur (220px fixe) */}
                                <Box sx={{ width: 220, minWidth: 220, maxWidth: 220, flexShrink: 0 }}>
                                  <Stack direction="row" alignItems="center" spacing={1}>
                                    <Avatar
                                      src={workloadDay.user.avatarUrl}
                                      sx={{ width: 32, height: 32 }}
                                    >
                                      {workloadDay.user.firstName?.[0]}{workloadDay.user.lastName?.[0]}
                                    </Avatar>
                                    <Box flexGrow={1} minWidth={0}>
                                      <Typography variant="body2" fontWeight="bold" noWrap>
                                        {getUserDisplayName(workloadDay.user)}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        {workloadDay.user.role}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Box>

                                {/* Zone timeline */}
                                <Box sx={{ flex: 1, minWidth: 0, position: 'relative', height: timelineHeight }}>
                                  {/* Grille de fond avec indicateurs télétravail */}
                                  <Stack direction="row" spacing={0} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                                    {monthDays.map((day) => {
                                      const dayOfWeek = day.getDay();
                                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                      const teleworkResolution = teleworkSystem.getResolutionForDay(workloadDay.userId, day);
                                      const isRemoteDay = teleworkResolution?.resolvedMode === 'remote';

                                      return (
                                        <Box
                                          key={day.toISOString()}
                                          sx={{
                                            width: 44,
                                            minWidth: 44,
                                            maxWidth: 44,
                                            borderRight: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: isWeekend ? 'grey.50' : 'transparent',
                                            border: isRemoteDay ? '2px solid #ff9800' : undefined,
                                            borderRadius: isRemoteDay ? 1 : 0,
                                            boxSizing: 'border-box'
                                          }}
                                        />
                                      );
                                    })}
                                  </Stack>

                                  {/* Barres continues pour tâches multi-jours */}
                                  {Array.from(taskBars.entries()).map(([taskId, items], barIndex) => {
                                    const firstItem = items[0];
                                    const lastItem = items[items.length - 1];
                                    const startDayIndex = monthDays.findIndex(d =>
                                      isSameDay(d, firstItem.startTime)
                                    );
                                    const endDayIndex = monthDays.findIndex(d =>
                                      isSameDay(d, lastItem.startTime)
                                    );

                                    if (startDayIndex === -1 || endDayIndex === -1) return null;

                                    const barWidth = (endDayIndex - startDayIndex + 1) * 44 - 4;
                                    const barLeft = startDayIndex * 44 + 2;

                                    return (
                                      <Box
                                        key={taskId}
                                        sx={{
                                          position: 'absolute',
                                          left: `${barLeft}px`,
                                          top: `${barIndex * 22 + 8}px`,
                                          width: `${barWidth}px`,
                                          height: 18,
                                          bgcolor: firstItem.color,
                                          borderRadius: 1,
                                          border: '1px solid rgba(0,0,0,0.1)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          px: 0.5,
                                          fontSize: '0.7rem',
                                          color: 'white',
                                          fontWeight: 500,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          cursor: 'pointer',
                                          zIndex: 10,
                                          boxShadow: 1,
                                          '&:hover': {
                                            opacity: 0.9,
                                            zIndex: 20,
                                            boxShadow: 2
                                          }
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onItemClick(firstItem);
                                        }}
                                        title={firstItem.title}
                                      >
                                        {firstItem.title}
                                      </Box>
                                    );
                                  })}

                                  {/* Barres pour tâches 1 jour */}
                                  {Array.from(singleDayItems.entries()).map(([dayKey, items]) => {
                                    const dayIndex = monthDays.findIndex(d =>
                                      format(d, 'yyyy-MM-dd') === dayKey
                                    );

                                    if (dayIndex === -1) return null;

                                    const barOffset = taskBars.size;

                                    return items.map((item, idx) => {
                                      const barLeft = dayIndex * 44 + 2;
                                      const barWidth = 44 - 4;
                                      const barTop = (barOffset + idx) * 22 + 8;

                                      return (
                                        <Box
                                          key={item.id}
                                          sx={{
                                            position: 'absolute',
                                            left: `${barLeft}px`,
                                            top: `${barTop}px`,
                                            width: `${barWidth}px`,
                                            height: 18,
                                            bgcolor: item.color,
                                            borderRadius: 1,
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            px: 0.5,
                                            fontSize: '0.7rem',
                                            color: 'white',
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            cursor: 'pointer',
                                            zIndex: 10,
                                            boxShadow: 1,
                                            '&:hover': {
                                              opacity: 0.9,
                                              zIndex: 20,
                                              boxShadow: 2
                                            }
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onItemClick(item);
                                          }}
                                          title={item.title}
                                        >
                                          {item.title}
                                        </Box>
                                      );
                                    });
                                  })}
                                </Box>
                              </Box>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          }

          // Services normaux
          const service = services.find(s => s.id === serviceId);
          if (!service) return null;

          const isExpanded = expandedServices.has(serviceId);
          const userCount = serviceWorkloadDays.length;

          return (
            <Box key={serviceId}>
              {/* En-tête du service */}
              <Card sx={{ mb: 0.5 }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onToggleService(serviceId)}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: service.color || '#1976d2'
                      }}
                    />
                    <BusinessIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="bold">
                      {service.name}
                    </Typography>
                    <Chip
                      label={`${userCount} ressource${userCount > 1 ? 's' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Box sx={{ flex: 1 }} />
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Stack>
                </CardContent>
              </Card>

              {/* Lignes utilisateurs */}
              <Collapse in={isExpanded}>
                <Box sx={{ ml: 2, mb: 1 }}>
                  <Stack spacing={0.5}>
                    {serviceWorkloadDays.map((workloadDay) => {
                      // Grouper les items par tâche multi-jours
                      const taskBars = new Map<string, CalendarItem[]>();
                      const singleDayItems = new Map<string, CalendarItem[]>();

                      workloadDay.items.forEach(item => {
                        if (item.originalTaskId && item.isSpanning) {
                          if (!taskBars.has(item.originalTaskId)) {
                            taskBars.set(item.originalTaskId, []);
                          }
                          taskBars.get(item.originalTaskId)!.push(item);
                        } else {
                          const dayKey = format(item.startTime, 'yyyy-MM-dd');
                          if (!singleDayItems.has(dayKey)) {
                            singleDayItems.set(dayKey, []);
                          }
                          singleDayItems.get(dayKey)!.push(item);
                        }
                      });

                      // Calculer le nombre max de barres empilées
                      const maxSingleDayBars = Math.max(...Array.from(singleDayItems.values()).map(items => items.length), 0);
                      const totalBars = taskBars.size + maxSingleDayBars;
                      const timelineHeight = Math.max(60, totalBars * 22 + 16);

                      return (
                        <Card key={workloadDay.userId} sx={{ mb: 1 }}>
                          <CardContent sx={{ p: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {/* Colonne utilisateur (220px fixe) */}
                              <Box sx={{ width: 220, minWidth: 220, maxWidth: 220, flexShrink: 0 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Avatar
                                    src={workloadDay.user.avatarUrl}
                                    sx={{ width: 32, height: 32 }}
                                  >
                                    {workloadDay.user.firstName?.[0]}{workloadDay.user.lastName?.[0]}
                                  </Avatar>
                                  <Box flexGrow={1} minWidth={0}>
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                      {getUserDisplayName(workloadDay.user)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {workloadDay.user.role}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </Box>

                              {/* Zone timeline */}
                              <Box sx={{ flex: 1, minWidth: 0, position: 'relative', height: timelineHeight }}>
                                {/* Grille de fond avec indicateurs télétravail */}
                                <Stack direction="row" spacing={0} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                                  {monthDays.map((day) => {
                                    const dayOfWeek = day.getDay();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    const teleworkResolution = teleworkSystem.getResolutionForDay(workloadDay.userId, day);
                                    const isRemoteDay = teleworkResolution?.resolvedMode === 'remote';

                                    return (
                                      <Box
                                        key={day.toISOString()}
                                        sx={{
                                          width: 44,
                                          minWidth: 44,
                                          maxWidth: 44,
                                          borderRight: '1px solid',
                                          borderColor: 'divider',
                                          bgcolor: isWeekend ? 'grey.50' : 'transparent',
                                          border: isRemoteDay ? '2px solid #ff9800' : undefined,
                                          borderRadius: isRemoteDay ? 1 : 0,
                                          boxSizing: 'border-box'
                                        }}
                                      />
                                    );
                                  })}
                                </Stack>

                                {/* Barres continues pour tâches multi-jours */}
                                {Array.from(taskBars.entries()).map(([taskId, items], barIndex) => {
                                  const firstItem = items[0];
                                  const lastItem = items[items.length - 1];
                                  const startDayIndex = monthDays.findIndex(d =>
                                    isSameDay(d, firstItem.startTime)
                                  );
                                  const endDayIndex = monthDays.findIndex(d =>
                                    isSameDay(d, lastItem.startTime)
                                  );

                                  if (startDayIndex === -1 || endDayIndex === -1) return null;

                                  const barWidth = (endDayIndex - startDayIndex + 1) * 44 - 4;
                                  const barLeft = startDayIndex * 44 + 2;

                                  return (
                                    <Box
                                      key={taskId}
                                      sx={{
                                        position: 'absolute',
                                        left: `${barLeft}px`,
                                        top: `${barIndex * 22 + 8}px`,
                                        width: `${barWidth}px`,
                                        height: 18,
                                        bgcolor: firstItem.color,
                                        borderRadius: 1,
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 0.5,
                                        fontSize: '0.7rem',
                                        color: 'white',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        cursor: 'pointer',
                                        zIndex: 10,
                                        boxShadow: 1,
                                        '&:hover': {
                                          opacity: 0.9,
                                          zIndex: 20,
                                          boxShadow: 2
                                        }
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onItemClick(firstItem);
                                      }}
                                      title={firstItem.title}
                                    >
                                      {firstItem.title}
                                    </Box>
                                  );
                                })}

                                {/* Barres pour tâches 1 jour */}
                                {Array.from(singleDayItems.entries()).map(([dayKey, items]) => {
                                  const dayIndex = monthDays.findIndex(d =>
                                    format(d, 'yyyy-MM-dd') === dayKey
                                  );

                                  if (dayIndex === -1) return null;

                                  const barOffset = taskBars.size;

                                  return items.map((item, idx) => {
                                    const barLeft = dayIndex * 44 + 2;
                                    const barWidth = 44 - 4;
                                    const barTop = (barOffset + idx) * 22 + 8;

                                    return (
                                      <Box
                                        key={item.id}
                                        sx={{
                                          position: 'absolute',
                                          left: `${barLeft}px`,
                                          top: `${barTop}px`,
                                          width: `${barWidth}px`,
                                          height: 18,
                                          bgcolor: item.color,
                                          borderRadius: 1,
                                          border: '1px solid rgba(0,0,0,0.1)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          px: 0.5,
                                          fontSize: '0.7rem',
                                          color: 'white',
                                          fontWeight: 500,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          cursor: 'pointer',
                                          zIndex: 10,
                                          boxShadow: 1,
                                          '&:hover': {
                                            opacity: 0.9,
                                            zIndex: 20,
                                            boxShadow: 2
                                          }
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onItemClick(item);
                                        }}
                                        title={item.title}
                                      >
                                        {item.title}
                                      </Box>
                                    );
                                  });
                                })}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
      </Box>
    </Box>
  );
};
