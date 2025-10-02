import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Avatar,
  Chip,
  IconButton,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  ViewWeek as ViewWeekIcon,
  CalendarMonth as CalendarMonthIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getHours,
  setHours,
  differenceInHours,
  differenceInDays,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, User, Project, UserCapacity, ResourceAllocation, WorkContract, Department, WeekDay } from '../../types';
import { Service } from '../../types/service';
import { taskService } from '../../services/task.service';
import { dashboardHubService } from '../../services/dashboard-hub.service';
import { simpleTaskService } from '../../services/simple-task.service';
import { userService } from '../../services/user.service';
import { projectService } from '../../services/project.service';
import { departmentService } from '../../services/department.service';
import { ServiceService } from '../../services/service.service';
import { capacityService } from '../../services/capacity.service';
import { workloadCalculatorService } from '../../services/workload-calculator.service';
import { remoteWorkService, RemoteWorkSchedule } from '../../services/remote-work.service';
import { TaskModalSimplified as TaskModal } from '../tasks/TaskModalSimplified';
import { auth } from '../../config/firebase';

const serviceService = new ServiceService();

// ========================================
// UTILITAIRES JOURS OUVRABLES
// ========================================

// Mapping des jours de la semaine
const WEEKDAY_MAPPING: Record<number, WeekDay> = {
  1: 'monday',
  2: 'tuesday', 
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  0: 'sunday', // Dimanche = 0 dans getDay()
};

// Vérifier si un jour est ouvrable pour un utilisateur
const isWorkingDay = (date: Date, contract: WorkContract | null): boolean => {
  if (!contract || !contract.workingDays) {
    // Par défaut: lundi à vendredi
    return date.getDay() >= 1 && date.getDay() <= 5;
  }
  
  const dayOfWeek = WEEKDAY_MAPPING[date.getDay()];
  return contract.workingDays.includes(dayOfWeek);
};

// Filtrer une liste de jours selon les jours ouvrables
const filterWorkingDays = (days: Date[], contracts: Map<string, WorkContract | null>): Date[] => {
  // Si aucun contrat spécifique, garder tous les jours ouvrables standards (lundi-vendredi)
  if (contracts.size === 0) {
    return days.filter(day => day.getDay() >= 1 && day.getDay() <= 5);
  }
  
  // Retourner les jours qui sont ouvrables pour au moins un utilisateur
  return days.filter(day => {
    return Array.from(contracts.values()).some(contract => isWorkingDay(day, contract));
  });
};

// ========================================
// TYPES SPECIFIQUES PLANNING CALENDAR
// ========================================

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
  conflictsWith?: string[];
  // Nouveaux champs pour les tâches multi-jours
  originalTaskId?: string; // ID de la tâche originale
  isSpanning?: boolean; // Indique si la tâche s'étend sur plusieurs jours
  spanDay?: number; // Jour actuel dans la séquence (1, 2, 3...)
  totalSpanDays?: number; // Nombre total de jours de la tâche
  taskCount?: number; // Nombre de tâches regroupées dans cette card projet
}

interface UserWorkloadDay {
  userId: string;
  user: User;
  date: Date;
  capacity: number; // En heures (ex: 7)
  allocated: number; // En heures déjà allouées
  items: CalendarItem[];
  isRemoteWork: boolean;
  hasConflicts: boolean;
  utilizationRate: number; // 0-100%
  contract: WorkContract | null;
}

interface ConflictDetection {
  itemId: string;
  conflictType: 'overlap' | 'overallocation' | 'unavailable';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestedAction: string;
}

type ViewMode = 'week' | 'month';

// ========================================
// DRAG & DROP ITEM COMPONENT
// ========================================

interface DraggableItemProps {
  item: CalendarItem;
  onMove: (itemId: string, newStartTime: Date, newEndTime: Date, newUserId?: string) => void;
  onResize: (itemId: string, newStartTime: Date, newEndTime: Date) => void;
  onClick: (item: CalendarItem) => void;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, onMove, onResize, onClick }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'calendar-item',
    item: { ...item },
    canDrag: item.canMove,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getItemIcon = () => {
    switch (item.type) {
      case 'task': return <WorkIcon fontSize="small" />;
      case 'meeting': return <PersonIcon fontSize="small" />;
      case 'admin': return <BusinessIcon fontSize="small" />;
      case 'training': return <ScheduleIcon fontSize="small" />;
      case 'remote': return <HomeIcon fontSize="small" />;
      default: return <WorkIcon fontSize="small" />;
    }
  };

  const getItemColor = () => {
    if (item.conflictsWith && item.conflictsWith.length > 0) return '#f44336'; // Rouge conflit
    if (item.isRemote) return '#9c27b0'; // Violet télétravail
    return item.color || '#2196f3';
  };

  const duration = differenceInHours(item.endTime, item.startTime);

  return (
    <Box
      ref={drag as any}
      onClick={() => onClick(item)}
      sx={{
        bgcolor: getItemColor(),
        color: 'white',
        borderRadius: 1,
        p: 0.5,
        mb: 0.5,
        cursor: item.canMove ? 'move' : 'default',
        opacity: isDragging ? 0.5 : 1,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        gap: 0.5,
        border: item.conflictsWith?.length ? '2px solid #ff1744' : 'none',
        '&:hover': {
          opacity: 0.8,
          boxShadow: 2,
        },
      }}
    >
      {getItemIcon()}
      <Box flexGrow={1} sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap fontWeight="bold" sx={{ fontSize: '0.75rem' }}>
          📋 {item.title}
          {item.taskCount && item.taskCount > 1 && (
            <Chip 
              label={item.taskCount} 
              size="small" 
              color="primary" 
              sx={{ 
                height: 16, 
                fontSize: '0.6rem',
                ml: 0.5,
                minWidth: 20
              }} 
            />
          )}
        </Typography>
        {item.isSpanning && item.spanDay && item.totalSpanDays && item.totalSpanDays > 1 && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.7, fontSize: '0.65rem' }}>
            Jour {item.spanDay}/{item.totalSpanDays}
          </Typography>
        )}
      </Box>
      {item.isRemote && (
        <Chip 
          size="small" 
          label="TT" 
          sx={{ 
            height: 16, 
            bgcolor: 'rgba(255,255,255,0.2)', 
            color: 'white',
            fontSize: '0.6rem'
          }} 
        />
      )}
    </Box>
  );
};

// ========================================
// DYNAMIC TASK SLOT COMPONENT
// ========================================

interface TaskSlotProps {
  userId: string;
  date: Date;
  slotIndex: number;
  item?: CalendarItem;
  isEmpty: boolean;
  onDrop: (item: CalendarItem, userId: string, date: Date, slotIndex: number) => void;
  onCreateTask: (userId: string, date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
}

const TaskSlot: React.FC<TaskSlotProps> = ({ 
  userId, 
  date, 
  slotIndex, 
  item, 
  isEmpty, 
  onDrop, 
  onCreateTask,
  onItemClick 
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'calendar-item',
    canDrop: (item: CalendarItem) => {
      return true; // Validation plus tard
    },
    drop: (draggedItem: CalendarItem) => {
      onDrop(draggedItem, userId, date, slotIndex);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const handleSlotClick = () => {
    if (isEmpty && !item) {
      onCreateTask(userId, date);
    } else if (item) {
      onItemClick(item);
    }
  };

  return (
    <Box
      ref={drop as any}
      onClick={handleSlotClick}
      sx={{
        width: '100%', // Prendre toute la largeur disponible
        height: 40,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : isEmpty ? 'grey.300' : 'transparent',
        bgcolor: isOver && canDrop ? 'primary.light' : 
                isEmpty ? 'grey.50' : 'transparent',
        borderRadius: 1,
        p: 0.5,
        mb: 0.5,
        cursor: isEmpty || item ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isEmpty && !item ? 'center' : 'flex-start',
        overflow: 'hidden', // Empêche le débordement
        '&:hover': isEmpty || item ? {
          bgcolor: 'grey.100',
          borderColor: 'primary.main',
        } : {},
      }}
    >
      {item ? (
        <DraggableItem
          item={item}
          onMove={() => {}}
          onResize={() => {}}
          onClick={onItemClick}
        />
      ) : isEmpty ? (
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ 
            fontSize: '0.7rem',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          + Ajouter tâche
        </Typography>
      ) : null}
    </Box>
  );
};

// ========================================
// WEEK DAY SELECTOR COMPONENT
// ========================================

interface WeekDaySelectorProps {
  userId: string;
  weekDays: Date[];
  remoteSchedule: RemoteWorkSchedule | null;
  remoteWorkDays: Map<string, boolean>;
  onToggleWeeklyDay: (day: keyof Omit<RemoteWorkSchedule, 'userId' | 'updatedAt' | 'updatedBy'>) => void;
  onToggleSpecificDay: (date: Date) => void;
  onDeleteSpecificDay: (date: Date) => void;
  compact?: boolean;
}

const WeekDaySelector: React.FC<WeekDaySelectorProps> = ({
  userId,
  weekDays,
  remoteSchedule,
  remoteWorkDays,
  onToggleWeeklyDay,
  onToggleSpecificDay,
  onDeleteSpecificDay,
  compact = true
}) => {
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const days = [
    { key: 'monday' as const, label: 'Lundi', shortLabel: 'L' },
    { key: 'tuesday' as const, label: 'Mardi', shortLabel: 'M' },
    { key: 'wednesday' as const, label: 'Mercredi', shortLabel: 'M' },
    { key: 'thursday' as const, label: 'Jeudi', shortLabel: 'J' },
    { key: 'friday' as const, label: 'Vendredi', shortLabel: 'V' }
  ];

  // Fonction pour déterminer si un jour est en télétravail (UNIQUEMENT planning récurrent pour les icônes)
  const isRemoteForDay = (dayKey: keyof RemoteWorkSchedule, date: Date): { isRemote: boolean; isOverride: boolean } => {
    // Les icônes L,M,M,J,V montrent UNIQUEMENT le planning récurrent
    // Les exceptions s'affichent maintenant directement sur les cellules du calendrier
    return {
      isRemote: remoteSchedule?.[dayKey] as boolean || false,
      isOverride: false // Toujours false car les exceptions ne s'affichent plus sur les icônes
    };
  };

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        mt: 0.5,
        pl: 4.5, // Aligner avec le nom (après l'avatar)
        alignItems: 'center',
        position: 'relative', // Pour le popup
      }}
    >
      {/* Boutons des jours de la semaine */}
      {days.map((day, index) => {
        const currentWeekDate = weekDays[index + 1]; // +1 car weekDays commence par dimanche
        const { isRemote, isOverride } = currentWeekDate ?
          isRemoteForDay(day.key, currentWeekDate) :
          { isRemote: remoteSchedule?.[day.key] as boolean || false, isOverride: false };

        return (
          <IconButton
            key={day.key}
            size="small"
            onClick={() => {
              // Clic normal : planning récurrent seulement
              onToggleWeeklyDay(day.key);
            }}
            sx={{
              width: 24,
              height: 24,
              p: 0,
              bgcolor: isRemote ? 'secondary.light' : 'grey.100',
              color: isRemote ? 'secondary.main' : 'text.secondary',
              border: '2px solid',
              borderColor: isOverride ? 'warning.main' : (isRemote ? 'secondary.main' : 'grey.300'),
              boxShadow: isOverride ? '0 0 4px rgba(255,152,0,0.5)' : 'none',
              '&:hover': {
                bgcolor: isRemote ? 'secondary.main' : 'grey.300',
                color: isRemote ? 'white' : 'text.primary',
                transform: 'scale(1.05)',
              },
              fontSize: '0.65rem',
              fontWeight: isRemote ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
            }}
            title={`${day.label} - ${isRemote ? 'Télétravail' : 'Bureau'}${isOverride ? ' (Exception ponctuelle)' : ' (Planning récurrent)'}`}
          >
            {isRemote ? (
              <HomeIcon sx={{ fontSize: 14 }} />
            ) : (
              <Typography sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                {day.shortLabel}
              </Typography>
            )}
            {/* Indicateur visuel pour les exceptions */}
            {isOverride && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'warning.main',
                  border: '1px solid white',
                }}
              />
            )}
          </IconButton>
        );
      })}

      {/* Bouton Calendrier pour exceptions ponctuelles */}
      <IconButton
        size="small"
        onClick={() => setShowDatePicker(!showDatePicker)}
        sx={{
          width: 24,
          height: 24,
          p: 0,
          ml: 1,
          bgcolor: showDatePicker ? 'info.light' : 'grey.100',
          color: showDatePicker ? 'info.main' : 'text.secondary',
          border: '1px solid',
          borderColor: showDatePicker ? 'info.main' : 'grey.300',
          '&:hover': {
            bgcolor: showDatePicker ? 'info.main' : 'grey.300',
            color: showDatePicker ? 'white' : 'text.primary',
            transform: 'scale(1.05)',
          },
          fontSize: '0.7rem',
          transition: 'all 0.2s ease',
        }}
        title="Exception ponctuelle - Cliquez pour choisir une date"
      >
        📅
      </IconButton>

      {/* Mini calendrier popup via Portal */}
      {showDatePicker && createPortal(
        <Box
          sx={{
            position: 'fixed',
            top: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999, // Z-index encore plus élevé
            bgcolor: 'background.paper',
            border: '3px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            boxShadow: '0 16px 64px rgba(0,0,0,0.5)', // Ombre très marquée
            p: 2,
            width: 250,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              📅 Choisir une date pour exception
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowDatePicker(false)}
              sx={{ width: 24, height: 24, p: 0, color: 'error.main' }}
            >
              ✕
            </IconButton>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
            {(() => {
              const dates = [];
              const today = new Date();
              today.setHours(12, 0, 0, 0); // Midi pour éviter les problèmes de timezone
              const startDate = new Date(today);
              startDate.setDate(today.getDate() - 10); // 10 jours avant

              for (let i = 0; i < 21; i++) { // 3 semaines
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                date.setHours(12, 0, 0, 0); // Midi pour éviter les problèmes de timezone

                const isToday = date.toDateString() === today.toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                // Utiliser format YYYY-MM-DD local au lieu de ISO
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                const dayKey = `${userId}_${dateStr}`;
                const hasException = remoteWorkDays.has(dayKey);

                dates.push(
                  <Box
                    key={dateStr}
                    onClick={() => {
                      if (hasException) {
                        // Si c'est une exception existante, la supprimer
                        onDeleteSpecificDay(date);
                      } else {
                        // Sinon, créer une nouvelle exception
                        onToggleSpecificDay(date);
                      }
                      setShowDatePicker(false);
                    }}
                    sx={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      borderRadius: 1,
                      bgcolor: hasException ? 'warning.light' : isToday ? 'primary.light' : 'transparent',
                      color: hasException ? 'warning.main' : isToday ? 'primary.main' : isWeekend ? 'text.disabled' : 'text.primary',
                      border: hasException ? '2px solid' : isToday ? '2px solid' : '1px solid transparent',
                      borderColor: hasException ? 'warning.main' : isToday ? 'primary.main' : 'transparent',
                      fontWeight: hasException || isToday ? 'bold' : 'normal',
                      '&:hover': {
                        bgcolor: hasException ? 'warning.main' : isToday ? 'primary.main' : 'grey.300',
                        color: hasException || isToday ? 'white' : 'text.primary',
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                    title={`${date.getDate()}/${date.getMonth() + 1} - ${hasException ? 'Cliquez pour supprimer cette exception' : 'Cliquez pour créer une exception'}`}
                  >
                    {date.getDate()}
                  </Box>
                );
              }
              return dates;
            })()}
          </Box>
          <Box sx={{ textAlign: 'center', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              🟠 Exceptions existantes • 📍 Aujourd'hui
            </Typography>
          </Box>
        </Box>,
        document.body
      )}
    </Stack>
  );
};

// ========================================
// USER ROW COMPONENT
// ========================================

interface UserRowProps {
  workloadDay: UserWorkloadDay;
  viewMode: ViewMode;
  weekDays: Date[];
  departments: Department[];
  userContracts: Map<string, WorkContract | null>;
  remoteSchedules: Map<string, RemoteWorkSchedule>;
  remoteWorkDays: Map<string, boolean>;
  currentUserId: string;
  onItemMove: (itemId: string, newStartTime: Date, newEndTime: Date, newUserId?: string) => void;
  onItemClick: (item: CalendarItem) => void;
  onItemDrop: (item: CalendarItem, userId: string, date: Date, slotIndex: number) => void;
  onCreateTask: (userId: string, date: Date) => void;
  onToggleWeeklyRemoteDay: (userId: string, day: keyof Omit<RemoteWorkSchedule, 'userId' | 'updatedAt' | 'updatedBy'>) => void;
  onToggleSpecificRemoteDay: (userId: string, date: Date) => void;
  onDeleteSpecificRemoteDay: (userId: string, date: Date) => void;
}

const UserRow: React.FC<UserRowProps> = ({
  workloadDay,
  viewMode,
  weekDays,
  departments,
  userContracts,
  remoteSchedules,
  remoteWorkDays,
  currentUserId,
  onItemMove,
  onItemClick,
  onItemDrop,
  onCreateTask,
  onToggleWeeklyRemoteDay,
  onToggleSpecificRemoteDay,
  onDeleteSpecificRemoteDay,
}) => {
  const getUtilizationColor = (rate: number) => {
    if (rate <= 60) return 'success';
    if (rate <= 85) return 'warning';
    if (rate <= 100) return 'info';
    return 'error';
  };

  const renderDayColumn = (date: Date) => {
    const dayItems = workloadDay.items.filter(item =>
      isSameDay(item.startTime, date)
    );

    // Vérifier si l'utilisateur est en télétravail ce jour (logique hybride)
    // Utiliser format YYYY-MM-DD local au lieu de ISO pour éviter les problèmes de timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const specificDayKey = `${workloadDay.userId}_${dateStr}`;
    let isRemoteDay = false;
    let isException = false; // Nouveau: indique si c'est une exception ponctuelle

    // 1. Priorité aux surcharges spécifiques (exceptions ponctuelles)
    if (remoteWorkDays.has(specificDayKey)) {
      isRemoteDay = remoteWorkDays.get(specificDayKey) || false;
      isException = true; // C'est une exception ponctuelle
    } else {
      // 2. Sinon, utiliser le planning hebdomadaire récurrent
      const remoteSchedule = remoteSchedules.get(workloadDay.userId);
      if (remoteSchedule) {
        const dayOfWeek = date.getDay();
        const dayMapping: Record<number, keyof RemoteWorkSchedule> = {
          0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
          4: 'thursday', 5: 'friday', 6: 'saturday'
        };
        const dayKey = dayMapping[dayOfWeek];
        isRemoteDay = remoteSchedule[dayKey] as boolean || false;
        isException = false; // C'est le planning récurrent
      }
    }

    // Logique dynamique: 1 slot minimum + 1 slot par tâche existante
    const minSlots = 1;
    const totalSlots = Math.max(minSlots, dayItems.length + 1);

    const taskSlots = Array.from({ length: totalSlots }, (_, slotIndex) => {
      const item = dayItems[slotIndex] || undefined;
      const isEmpty = !item && slotIndex >= dayItems.length;

      return (
        <TaskSlot
          key={`${date.toISOString()}-slot-${slotIndex}`}
          userId={workloadDay.userId}
          date={date}
          slotIndex={slotIndex}
          item={item}
          isEmpty={isEmpty}
          onDrop={onItemDrop}
          onCreateTask={onCreateTask}
          onItemClick={onItemClick}
        />
      );
    });

    return (
      <Box key={date.toISOString()} sx={{
        width: 160, // Largeur fixe pour homogénéité
        minWidth: 160,
        maxWidth: 160,
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isRemoteDay ? (isException ? 'rgba(255, 152, 0, 0.1)' : 'rgba(156, 39, 176, 0.05)') : 'transparent', // Orange pour exception, violet pour récurrent
        borderRadius: 1,
        position: 'relative'
      }}>
        {/* Indicateur télétravail en haut de la colonne */}
        {isRemoteDay && (
          <Box
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              bgcolor: isException ? 'warning.main' : 'secondary.main',
              color: 'white',
              borderRadius: 0.5,
              px: 0.5,
              py: 0.1,
              fontSize: '0.6rem',
              fontWeight: 'bold',
              zIndex: 1,
              border: isException ? '2px solid' : 'none',
              borderColor: isException ? 'warning.dark' : 'transparent'
            }}
            title={isException ? 'Exception ponctuelle (utiliser 📅 pour supprimer)' : 'Télétravail selon planning récurrent'}
          >
            {isException ? '🏠!' : 'TT'}
          </Box>
        )}

        {/* Slots dynamiques de tâches */}
        <Stack spacing={0.5}>
          {taskSlots}
        </Stack>
      </Box>
    );
  };

  return (
    <Card sx={{ mb: 1 }}>
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ display: "flex", alignItems: "stretch", gap: 1 }}>
          {/* Zone utilisateur SANCTUARISÉE - largeur fixe */}
          <Box sx={{ 
            width: 240, 
            minWidth: 240,
            maxWidth: 240,
            flexShrink: 0, // Empêche la compression
            borderRight: '1px solid',
            borderColor: 'divider',
            pr: 1
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar 
                src={workloadDay.user.avatarUrl} 
                sx={{ width: 32, height: 32 }}
              >
                {workloadDay.user.firstName?.[0]}{workloadDay.user.lastName?.[0]}
              </Avatar>
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  noWrap
                  sx={{ fontSize: '0.85rem' }}
                >
                  {getUserDisplayName(workloadDay.user)}
                </Typography>

                {/* Indicateurs conflits */}
                {workloadDay.hasConflicts && (
                  <Chip
                    size="small"
                    icon={<WarningIcon />}
                    label="Conflits"
                    color="error"
                    sx={{ mt: 0.5, height: 18, fontSize: '0.6rem' }}
                  />
                )}
              </Box>
            </Stack>

            {/* WeekDaySelector pour le télétravail */}
            <WeekDaySelector
              userId={workloadDay.userId}
              weekDays={weekDays}
              remoteSchedule={remoteSchedules.get(workloadDay.userId) || null}
              remoteWorkDays={remoteWorkDays}
              onToggleWeeklyDay={(day) => onToggleWeeklyRemoteDay(workloadDay.userId, day)}
              onToggleSpecificDay={(date) => onToggleSpecificRemoteDay(workloadDay.userId, date)}
              onDeleteSpecificDay={(date) => onDeleteSpecificRemoteDay(workloadDay.userId, date)}
            />
          </Box>

          {/* Zone des jours - s'adapte au reste */}
          <Box sx={{ 
            flex: 1,
            minWidth: 0,
            overflowX: 'auto'
          }}>
            <Stack direction="row" spacing={0.5}>
              {viewMode === 'week' ? (
                weekDays.map((day) => {
                  // Récupérer le contrat de cet utilisateur spécifique
                  const userContract = userContracts.get(workloadDay.userId) || null;
                  
                  // Si l'utilisateur ne travaille pas ce jour, ne pas afficher la colonne
                  if (!isWorkingDay(day, userContract)) {
                    return (
                      <Box 
                        key={day.toISOString()}
                        sx={{ 
                          width: 160, 
                          minWidth: 160, 
                          maxWidth: 160,
                          p: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                          color: 'text.disabled',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          Non travaillé
                        </Typography>
                      </Box>
                    );
                  }
                  
                  return renderDayColumn(day);
                })
              ) : (
                // Vue mensuelle simplifiée
                <Box>Vue mensuelle à implémenter</Box>
              )}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
// ========================================
// MAIN PLANNING CALENDAR COMPONENT
// ========================================

interface PlanningCalendarProps {
  selectedProjects?: string[];
  selectedUsers?: string[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

// Helper pour obtenir le nom d'affichage correct d'un utilisateur
const getUserDisplayName = (user: User): string => {
  if (user.displayName && user.displayName !== user.id) {
    return user.displayName;
  }
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || 'Utilisateur inconnu';
};
const PlanningCalendar: React.FC<PlanningCalendarProps> = ({
  selectedProjects = [],
  selectedUsers = [],
  onTaskUpdate,
}) => {
  // États principaux
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Données
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workloadDays, setWorkloadDays] = useState<UserWorkloadDay[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<ConflictDetection[]>([]);
  const [userContracts, setUserContracts] = useState<Map<string, WorkContract | null>>(new Map());
  const [remoteSchedules, setRemoteSchedules] = useState<Map<string, RemoteWorkSchedule>>(new Map());
  const [remoteWorkDays, setRemoteWorkDays] = useState<Map<string, boolean>>(new Map());
  
  // UI États
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<CalendarItem | null>(null);
  
  // États TaskModal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalData, setTaskModalData] = useState<{
    userId?: string;
    date?: Date;
    projectId?: string;
    task?: Task | null;
  }>({});

  // Helper pour obtenir le nom du département par son ID
  const getDepartmentName = (departmentId: string | undefined): string => {
    if (!departmentId) return '-';
    const department = departments.find(dept => dept.id === departmentId);
    return department?.name || '-';
  };

  // Fonction pour basculer l'état d'un service
  const toggleService = (serviceId: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedServices(newExpanded);
  };

  // Grouper les workloadDays par service avec gestion spéciale de l'encadrement
  const workloadDaysByService = useMemo(() => {
    const grouped = new Map<string, UserWorkloadDay[]>();
    
    workloadDays.forEach(workloadDay => {
      // Les managers et responsables vont dans "Encadrement"
      if (workloadDay.user.role === 'manager' || workloadDay.user.role === 'responsable') {
        const encadrementKey = 'encadrement';
        if (!grouped.has(encadrementKey)) {
          grouped.set(encadrementKey, []);
        }
        grouped.get(encadrementKey)!.push(workloadDay);
      } else {
        // Autres utilisateurs vont dans leur service
        const service = workloadDay.user.serviceIds?.[0] || workloadDay.user.serviceId || 'no-service';
        if (!grouped.has(service)) {
          grouped.set(service, []);
        }
        grouped.get(service)!.push(workloadDay);
      }
    });

    // Trier par nom de service avec "Encadrement" en premier
    const sortedEntries = Array.from(grouped.entries()).sort(([serviceA], [serviceB]) => {
      if (serviceA === 'encadrement') return -1;
      if (serviceB === 'encadrement') return 1;
      
      const nameA = serviceA === 'no-service' ? 'Sans service' : serviceA;
      const nameB = serviceB === 'no-service' ? 'Sans service' : serviceB;
      return nameA.localeCompare(nameB);
    });

    return new Map(sortedEntries);
  }, [workloadDays]);

  // Période actuelle calculée
  const currentPeriod = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { locale: fr }),
        end: endOfWeek(currentDate, { locale: fr }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  }, [currentDate, viewMode]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: fr });
    const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    
    // Filtrer selon les jours ouvrables des utilisateurs
    return filterWorkingDays(allWeekDays, userContracts);
  }, [currentDate, userContracts]);

  // ========================================
  // DATA LOADING
  // ========================================

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les données de base
      const [allUsers, allProjects, allDepartments, allServices] = await Promise.all([
        userService.getAllUsers(),
        projectService.getAllProjects(),
        departmentService.getAllDepartments(),
        serviceService.getAllServices(),
      ]);

      // Filtrer selon les sélections et exclure les admins
      const filteredUsers = selectedUsers.length > 0
        ? allUsers.filter(u => selectedUsers.includes(u.id) && u.role !== 'admin')
        : allUsers.filter(u => u.isActive && u.role !== 'admin');

      // Debug: Vérifier si Lahbib est dans la liste des utilisateurs

      const lahbibInAll = allUsers.find(u => u.displayName?.includes('Lahbib') || u.email?.includes('lahbib'));
      const lahbibInFiltered = filteredUsers.find(u => u.displayName?.includes('Lahbib') || u.email?.includes('lahbib'));

      // Debug info cleaned up

      const filteredProjects = selectedProjects.length > 0
        ? allProjects.filter(p => selectedProjects.includes(p.id))
        : allProjects;

      setUsers(filteredUsers);
      setProjects(filteredProjects);
      setDepartments(allDepartments);
      setServices(allServices);

      // Charger les contrats de travail et les plannings de télétravail des utilisateurs filtrés
      const contractsMap = new Map<string, WorkContract | null>();
      const remoteSchedulesMap = new Map<string, RemoteWorkSchedule>();
      const remoteWorkDaysMap = new Map<string, boolean>();

      await Promise.all(
        filteredUsers.map(async (user) => {
          try {
            // Charger le contrat
            const contract = await capacityService.getUserContract(user.id);
            contractsMap.set(user.id, contract);

            // Charger le planning de télétravail hebdomadaire
            const remoteSchedule = await remoteWorkService.getUserRemoteSchedule(user.id);
            if (remoteSchedule) {
              remoteSchedulesMap.set(user.id, remoteSchedule);
            }

            // Charger les jours de télétravail spécifiques pour la semaine courante
            for (const day of weekDays) {
              const dateStr = day.toISOString().split('T')[0];
              const dayKey = `${user.id}_${dateStr}`;

              try {
                // Vérifier s'il y a une surcharge spécifique pour ce jour
                const specificRemoteDay = await remoteWorkService.getSpecificRemoteDay(user.id, day);
                if (specificRemoteDay !== null) {
                  remoteWorkDaysMap.set(dayKey, specificRemoteDay.isRemote);
                }
              } catch (error) {
                
              }
            }
          } catch (error) {
            console.warn(`Impossible de charger les données pour ${user.displayName}:`, error);
            contractsMap.set(user.id, null);
          }
        })
      );
      setUserContracts(contractsMap);
      setRemoteSchedules(remoteSchedulesMap);
      setRemoteWorkDays(remoteWorkDaysMap);

      // Ouvrir tous les services par défaut + encadrement
      const services = new Set(filteredUsers.map(user => {
        if (user.role === 'manager' || user.role === 'responsable') {
          return 'encadrement';
        }
        return user.serviceIds?.[0] || user.serviceId || 'no-service';
      }));
      setExpandedServices(services);

      // Calculer la charge de travail pour chaque utilisateur et chaque jour
      const workloadPromises = [];
      
      // Générer les dates selon la vue
      const dates = viewMode === 'week' 
        ? [currentDate] // Une seule entrée pour la vue semaine
        : (() => {
            // Générer toutes les dates du mois pour la vue mensuelle
            const monthDates = [];
            let date = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            while (date <= monthEnd) {
              monthDates.push(new Date(date));
              date = addDays(date, 1);
            }
            return monthDates;
          })();

      // Pour chaque utilisateur et chaque date
      for (const user of filteredUsers) {
        for (const date of dates) {
          workloadPromises.push(async () => {
            try {
              // ✅ Récupérer TOUTES les tâches et appliquer le filtre RACI comme Dashboard-Hub
              const [allTasks, simpleTasks] = await Promise.all([
                taskService.getTasks(), // Toutes les tâches
                simpleTaskService.getSimpleTasksByUser(user.id).catch(() => []) // Ignore les erreurs d'index
              ]);
              // Filtrer uniquement les tâches où l'utilisateur est RESPONSABLE
              const userTasks = allTasks.filter(task => {
                // Vérifier si l'user est responsable de la tâche UNIQUEMENT
                return Array.isArray(task.responsible) && task.responsible.includes(user.id);
              });

              // Combiner toutes les tâches
              const allUserTasks = [...userTasks, ...simpleTasks];

              // Debug: log des tâches trouvées
              if (allUserTasks.length > 0) {
                console.log(`🎯 Tâches trouvées pour ${user.displayName || user.email}:`, allUserTasks.length, allUserTasks.map(t => ({ title: t.title, startDate: t.startDate, dueDate: t.dueDate, projectId: t.projectId, category: (t as any).taskCategory || 'PROJECT_TASK' })));
              }
              
              // ✅ Calendar général : AUCUN filtrage par période, afficher toutes les tâches
              const periodTasks = allUserTasks.filter(task => {
                // Une tâche doit avoir au moins dueDate ou startDate
                if (!task.startDate && !task.dueDate) {
                  return false;
                }
                return true; // Toutes les tâches avec dates sont incluses
              });

              // Debug: log des tâches qui passent le filtre
              if (periodTasks.length > 0) {
              }

          // Convertir en CalendarItems avec support multi-jours ET regroupement par projet
          const projectTasksMap = new Map<string, Task[]>();
          
          // ✅ Grouper les tâches par projet ET gérer les tâches simples
          periodTasks.forEach(task => {
            if ((task as any).taskCategory === 'SIMPLE_TASK') {
              // Les tâches simples sont traitées individuellement
              const simpleTaskKey = `simple-${task.id}`;
              if (!projectTasksMap.has(simpleTaskKey)) {
                projectTasksMap.set(simpleTaskKey, []);
              }
              projectTasksMap.get(simpleTaskKey)!.push(task);
            } else {
              // Tâches de projet groupées par projectId
              const projectId = task.projectId || 'unassigned';
              if (!projectTasksMap.has(projectId)) {
                projectTasksMap.set(projectId, []);
              }
              projectTasksMap.get(projectId)!.push(task);
            }
          });
          
          const calendarItems: CalendarItem[] = [];
          
          // ✅ Pour chaque groupe (projet ou tâche simple), créer les CalendarItems
          projectTasksMap.forEach((tasks, groupKey) => {
            const isSimpleTask = groupKey.startsWith('simple-');
            const projectId = isSimpleTask ? undefined : groupKey;
            const project = projectId ? filteredProjects.find(p => p.id === projectId) : undefined;
            const isUnassigned = projectId === 'unassigned';
            
            // Calculer les dates globales du projet (min/max des tâches)
            const allStartDates = tasks.filter(t => t.startDate).map(t => new Date(t.startDate as any));
            const allDueDates = tasks.filter(t => t.dueDate).map(t => new Date(t.dueDate as any));
            const allDates = [...allStartDates, ...allDueDates];
            
            if (allDates.length === 0) return; // Skip si aucune date
            
            const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
            const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
            
            const totalDays = Math.max(1, differenceInDays(projectEnd, projectStart) + 1);
            const isMultiDay = totalDays > 1;
            
            if (viewMode === 'week') {
              // En vue hebdomadaire, créer une CalendarItem par jour du projet
              if (isMultiDay) {
                const projectDays = eachDayOfInterval({ start: projectStart, end: projectEnd });
                
                projectDays.forEach((day, index) => {
                  // Vérifier si ce jour est dans la période affichée ET si des tâches sont actives ce jour
                  if (day >= currentPeriod.start && day <= currentPeriod.end) {
                    const tasksForDay = tasks.filter(task => {
                      const taskStart = task.startDate ? new Date(task.startDate as any) : new Date(task.dueDate as any);
                      const taskEnd = task.dueDate ? new Date(task.dueDate as any) : new Date(task.startDate as any);
                      return day >= taskStart && day <= taskEnd;
                    });
                    
                    if (tasksForDay.length > 0) {
                      calendarItems.push({
                        id: isSimpleTask ? `simple-${tasks[0].id}-${format(day, 'yyyy-MM-dd')}` : `project-${projectId}-${format(day, 'yyyy-MM-dd')}`,
                        originalTaskId: tasks[0].id, // Utiliser la première tâche comme référence
                        title: isSimpleTask ? `⚡ ${tasks[0].title}` : (project?.name || 'Non assigné'),
                        type: isSimpleTask ? 'simple_task' : (isUnassigned ? 'admin' : 'task'),
                        startTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0),
                        endTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 0),
                        userId: user.id,
                        projectId: projectId === 'unassigned' ? undefined : projectId,
                        project,
                        priority: tasks.reduce((highest: 'P0' | 'P1' | 'P2' | 'P3', task) => {
                          const order: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
                          return (order[task.priority] || 3) < (order[highest] || 3) ? task.priority : highest;
                        }, 'P3' as 'P0' | 'P1' | 'P2' | 'P3'),
                        status: 'IN_PROGRESS' as any, // Status générique pour un projet
                        assignee: user,
                        color: isUnassigned ? '#9e9e9e' : 
                               project?.tags?.includes('urgent') ? '#f44336' : '#2196f3',
                        isRemote: false,
                        canMove: true,
                        canResize: false,
                        conflictsWith: [],
                        isSpanning: true,
                        spanDay: index + 1,
                        totalSpanDays: totalDays,
                        taskCount: tasksForDay.length, // Nouveau: nombre de tâches
                      });
                    }
                  }
                });
              } else {
                // Projet/tâche d'un seul jour
                calendarItems.push({
                  id: isSimpleTask ? `simple-${tasks[0].id}` : `project-${projectId}`,
                  originalTaskId: tasks[0].id,
                  title: isSimpleTask ? `⚡ ${tasks[0].title}` : (project?.name || 'Non assigné'),
                  type: isSimpleTask ? 'simple_task' : (isUnassigned ? 'admin' : 'task'),
                  startTime: projectStart,
                  endTime: projectEnd,
                  userId: user.id,
                  projectId: projectId === 'unassigned' ? undefined : projectId,
                  project,
                  priority: tasks.reduce((highest: 'P0' | 'P1' | 'P2' | 'P3', task) => {
                    const order: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
                    return (order[task.priority] || 3) < (order[highest] || 3) ? task.priority : highest;
                  }, 'P3' as 'P0' | 'P1' | 'P2' | 'P3'),
                  status: 'IN_PROGRESS' as any,
                  assignee: user,
                  color: isSimpleTask ? '#673ab7' : // Violet pour tâches simples
                         isUnassigned ? '#9e9e9e' :
                         project?.tags?.includes('urgent') ? '#f44336' : '#2196f3',
                  isRemote: false,
                  canMove: true,
                  canResize: true,
                  conflictsWith: [],
                  isSpanning: false,
                  taskCount: tasks.length,
                });
              }
            } else {
              // En vue mensuelle - vérifier si le projet a des tâches actives ce jour
              const tasksForDay = tasks.filter(task => {
                const taskStart = task.startDate ? new Date(task.startDate as any) : new Date(task.dueDate as any);
                const taskEnd = task.dueDate ? new Date(task.dueDate as any) : new Date(task.startDate as any);
                return isSameDay(taskStart, date) || isSameDay(taskEnd, date) || (taskStart <= date && taskEnd >= date);
              });
              
              if (tasksForDay.length > 0) {
                const dayIndex = Math.max(0, differenceInDays(date, projectStart));
                
                calendarItems.push({
                  id: `project-${projectId}-${format(date, 'yyyy-MM-dd')}`,
                  originalTaskId: tasks[0].id,
                  title: project?.name || 'Non assigné',
                  type: isUnassigned ? 'admin' : 'task',
                  startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
                  endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0),
                  userId: user.id,
                  projectId: projectId === 'unassigned' ? undefined : projectId,
                  project,
                  priority: tasksForDay.reduce((highest: 'P0' | 'P1' | 'P2' | 'P3', task) => {
                    const order: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
                    return (order[task.priority] || 3) < (order[highest] || 3) ? task.priority : highest;
                  }, 'P3' as 'P0' | 'P1' | 'P2' | 'P3'),
                  status: 'IN_PROGRESS' as any,
                  assignee: user,
                  color: isSimpleTask ? '#673ab7' : // Violet pour tâches simples
                         isUnassigned ? '#9e9e9e' :
                         project?.tags?.includes('urgent') ? '#f44336' : '#2196f3',
                  isRemote: false,
                  canMove: true,
                  canResize: !isMultiDay,
                  conflictsWith: [],
                  isSpanning: isMultiDay,
                  spanDay: isMultiDay ? dayIndex + 1 : undefined,
                  totalSpanDays: isMultiDay ? totalDays : undefined,
                  taskCount: tasksForDay.length,
                });
              }
            }
          });

              // Calculer la capacité utilisateur
              const capacity = await capacityService.calculateUserCapacity(user.id, {
                startDate: viewMode === 'week' ? currentPeriod.start : date,
                endDate: viewMode === 'week' ? currentPeriod.end : date,
              });

              // Vérifier télétravail pour ce jour
              const isRemoteWork = user.preferences?.remoteWorkDays?.includes(
                format(date, 'EEEE', { locale: fr }).toLowerCase()
              ) || false;

              // Calculer utilisation pour ce jour
              const totalAllocated = calendarItems.reduce((sum, item) => {
                if (viewMode === 'week') {
                  return sum + differenceInHours(item.endTime, item.startTime);
                } else {
                  // En vue mensuelle, calculer seulement les heures de cette date
                  const itemStart = new Date(item.startTime);
                  const itemEnd = new Date(item.endTime);
                  if (isSameDay(itemStart, date)) {
                    return sum + Math.min(8, differenceInHours(itemEnd, itemStart)); // Max 8h par jour
                  }
                  return sum;
                }
              }, 0);

              // Calcul de charge supprimé
              const utilizationRate = 0;

              return {
                userId: user.id,
                user,
                date,
                capacity: 0,
                allocated: totalAllocated,
                items: calendarItems,
                isRemoteWork,
                hasConflicts: false, // À calculer
                utilizationRate,
                contract: await capacityService.getUserContract(user.id),
              } as UserWorkloadDay;

            } catch (error) {
              
              return {
                userId: user.id,
                user,
                date,
                capacity: viewMode === 'week' ? 35 : 8,
                allocated: 0,
                items: [],
                isRemoteWork: false,
                hasConflicts: false,
                utilizationRate: 0,
                contract: null,
              } as UserWorkloadDay;
            }
          });
        }
      }

      const workloadData = await Promise.all(workloadPromises.map(fn => fn()));
      
      // Détecter les conflits
      const detectedConflicts = await detectConflicts(workloadData);
      
      setWorkloadDays(workloadData);
      setConflicts(detectedConflicts);

    } catch (err) {
      
      setError('Erreur lors du chargement des données du calendrier');
    } finally {
      setLoading(false);
    }
  }, [currentDate, currentPeriod, selectedProjects, selectedUsers, viewMode]);

  // ========================================
  // CONFLICT DETECTION
  // ========================================

  const detectConflicts = async (workloadData: UserWorkloadDay[]): Promise<ConflictDetection[]> => {
    const conflicts: ConflictDetection[] = [];

    for (const userDay of workloadData) {
      // Vérifier les chevauchements temporels
      for (let i = 0; i < userDay.items.length; i++) {
        for (let j = i + 1; j < userDay.items.length; j++) {
          const item1 = userDay.items[i];
          const item2 = userDay.items[j];

          if (timesOverlap(item1.startTime, item1.endTime, item2.startTime, item2.endTime)) {
            conflicts.push({
              itemId: item1.id,
              conflictType: 'overlap',
              severity: 'high',
              message: `Chevauchement avec "${item2.title}"`,
              suggestedAction: 'Décaler l\'une des tâches',
            });

            // Marquer les items comme ayant des conflits
            item1.conflictsWith = item1.conflictsWith || [];
            item1.conflictsWith.push(item2.id);
            item2.conflictsWith = item2.conflictsWith || [];
            item2.conflictsWith.push(item1.id);
          }
        }
      }

      // Détection de surallocation supprimée
    }

    return conflicts;
  };

  const timesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && end1 > start2;
  };

  // ========================================
  // DRAG & DROP HANDLERS
  // ========================================

  const handleItemMove = useCallback(async (
    itemId: string,
    newStartTime: Date,
    newEndTime: Date,
    newUserId?: string
  ) => {
    try {
      // Capturer l'état précédent pour un rollback éventuel
      const previousState = workloadDays;
      
      // Trouver l'item original et ses détails
      let originalItem: CalendarItem | null = null;
      let originalUserId: string | null = null;
      
      for (const userDay of workloadDays) {
        const item = userDay.items.find(i => i.id === itemId);
        if (item) {
          originalItem = item;
          originalUserId = userDay.userId;
          break;
        }
      }

      if (!originalItem || !originalUserId) {
        
        return;
      }

      // Mise à jour optimiste de l'UI
      setWorkloadDays(prev => {
        const updated = [...prev];
        
        // Si on change d'utilisateur
        if (newUserId && newUserId !== originalUserId) {
          // Retirer de l'ancien utilisateur
          const oldUserIndex = updated.findIndex(u => u.userId === originalUserId);
          if (oldUserIndex !== -1) {
            updated[oldUserIndex] = {
              ...updated[oldUserIndex],
              items: updated[oldUserIndex].items.filter(item => item.id !== itemId),
              allocated: updated[oldUserIndex].allocated - differenceInHours(originalItem!.endTime, originalItem!.startTime),
            };
            // Calcul d'utilisation supprimé
            updated[oldUserIndex].utilizationRate = 0;
          }
          
          // Ajouter au nouvel utilisateur
          const newUserIndex = updated.findIndex(u => u.userId === newUserId);
          if (newUserIndex !== -1 && originalItem) {
            const updatedItem: CalendarItem = {
              id: originalItem.id,
              title: originalItem.title,
              type: originalItem.type,
              startTime: newStartTime,
              endTime: newEndTime,
              userId: newUserId,
              projectId: originalItem.projectId,
              project: originalItem.project,
              priority: originalItem.priority,
              status: originalItem.status,
              assignee: users.find(u => u.id === newUserId),
              color: originalItem.color,
              isRemote: originalItem.isRemote,
              canMove: originalItem.canMove,
              canResize: originalItem.canResize,
              conflictsWith: originalItem.conflictsWith,
            };
            updated[newUserIndex] = {
              ...updated[newUserIndex],
              items: [...updated[newUserIndex].items, updatedItem],
              allocated: updated[newUserIndex].allocated + differenceInHours(newEndTime, newStartTime),
            };
            // Calcul d'utilisation supprimé
            updated[newUserIndex].utilizationRate = 0;
          }
        } else {
          // Même utilisateur, juste changer les dates
          const userIndex = updated.findIndex(u => u.userId === originalUserId);
          if (userIndex !== -1) {
            updated[userIndex] = {
              ...updated[userIndex],
              items: updated[userIndex].items.map(item => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    startTime: newStartTime,
                    endTime: newEndTime,
                  };
                }
                return item;
              }),
            };
            // Recalculer l'allocation si les heures ont changé
            const oldDuration = differenceInHours(originalItem!.endTime, originalItem!.startTime);
            const newDuration = differenceInHours(newEndTime, newStartTime);
            if (oldDuration !== newDuration) {
              updated[userIndex].allocated = updated[userIndex].allocated - oldDuration + newDuration;
              updated[userIndex].utilizationRate = 0;
            }
          }
        }
        
        return updated;
      });

      // Persister en arrière-plan
      try {
        // Déterminer l'ID de la tâche originale (pour les tâches multi-jours)
        const taskId = originalItem.originalTaskId || originalItem.id;
        
        if (onTaskUpdate) {
          await onTaskUpdate(taskId, {
            startDate: newStartTime as any,
            dueDate: newEndTime as any,
            responsible: newUserId ? [newUserId] : [],
          });
        } else {
          // Si pas de callback, utiliser directement le service
          await taskService.updateTask(taskId, {
            startDate: newStartTime as any,
            dueDate: newEndTime as any,
            responsible: newUserId ? [newUserId] : [],
          });
        }
      } catch (error) {
        
        // Rollback en cas d'erreur
        setWorkloadDays(previousState);
        // Optionnel: afficher une notification d'erreur
        alert('Erreur lors du déplacement de la tâche. Les modifications ont été annulées.');
      }
      
      // PAS de rechargement complet ! Les conflits seront recalculés au prochain chargement
    } catch (error) {
      
    }
  }, [workloadDays, onTaskUpdate, users]);

  const handleItemDrop = useCallback((
    item: CalendarItem,
    userId: string,
    date: Date,
    slotIndex: number
  ) => {
    // Pour le moment, on garde la même date mais on change l'assigné
    const duration = differenceInHours(item.endTime, item.startTime);
    const newStartTime = date;
    const newEndTime = new Date(date.getTime() + duration * 60 * 60 * 1000);

    handleItemMove(item.id, newStartTime, newEndTime, userId);
  }, [handleItemMove]);

  const handleCreateTask = useCallback((userId: string, date: Date) => {
    // Si des projets sont sélectionnés, prendre le premier, sinon laisser vide (non affecté)
    const defaultProject = selectedProjects.length > 0 
      ? projects.find(p => selectedProjects.includes(p.id))
      : null;
    
    setTaskModalData({
      userId,
      date,
      projectId: defaultProject?.id || '', // Vide = non affecté
      task: null,
    });
    setTaskModalOpen(true);
  }, [projects, selectedProjects]);

  const handleTaskSave = useCallback(async (task: Task) => {
    try {
      if (task.id) {
        await taskService.updateTask(task.id, task);
      } else {
        // Créer des dates avec des heures pour éviter les problèmes de filtrage si pas de dueDate définie
        let finalDueDate = task.dueDate;
        let finalStartDate = task.startDate || task.dueDate;
        
        if (!finalDueDate && taskModalData.date) {
          const taskDate = new Date(taskModalData.date);
          finalStartDate = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate(), 9, 0);
          finalDueDate = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate(), 17, 0);
        }
        
        await taskService.createTask({
          ...task,
          responsible: taskModalData.userId ? [taskModalData.userId] : [],
          startDate: finalStartDate as any,
          dueDate: finalDueDate as any,
          projectId: task.projectId || taskModalData.projectId || '',
        });
      }
      
      // Recharger les données
      await loadCalendarData();
      setTaskModalOpen(false);
      setTaskModalData({});
    } catch (error) {
      
    }
  }, [taskModalData, loadCalendarData]);

  // ========================================
  // REMOTE WORK HANDLERS
  // ========================================

  // Handler pour le planning hebdomadaire récurrent (clic normal)
  const handleToggleWeeklyRemoteDay = useCallback(async (
    userId: string,
    day: keyof Omit<RemoteWorkSchedule, 'userId' | 'updatedAt' | 'updatedBy'>
  ) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        
        return;
      }

      // Mettre à jour le planning de télétravail hebdomadaire
      const newStatus = await remoteWorkService.toggleDayRemoteStatus(
        userId,
        day,
        currentUser.uid
      );

      // Mettre à jour l'état local
      setRemoteSchedules(prev => {
        const updated = new Map(prev);
        const schedule = updated.get(userId) || {
          userId,
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
          updatedAt: new Date() as any,
          updatedBy: currentUser.uid
        };

        updated.set(userId, {
          ...schedule,
          [day]: newStatus
        });

        return updated;
      });
    } catch (error) {
      
    }
  }, []);

  // Handler pour les jours spécifiques (clic droit ou exception)
  const handleToggleSpecificRemoteDay = useCallback(async (
    userId: string,
    date: Date
  ) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        
        return;
      }

      // Utiliser format YYYY-MM-DD local au lieu de ISO pour éviter les problèmes de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayKey = `${userId}_${dateStr}`;

      // Déterminer le statut actuel (priorité aux surcharges spécifiques)
      let currentStatus = false;
      if (remoteWorkDays.has(dayKey)) {
        currentStatus = remoteWorkDays.get(dayKey) || false;
      } else {
        // Utiliser le planning hebdomadaire par défaut
        const schedule = remoteSchedules.get(userId);
        if (schedule) {
          const dayOfWeek = date.getDay();
          const dayMapping: Record<number, keyof RemoteWorkSchedule> = {
            0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
            4: 'thursday', 5: 'friday', 6: 'saturday'
          };
          const dayKey = dayMapping[dayOfWeek];
          currentStatus = schedule[dayKey] as boolean || false;
        }
      }

      const newStatus = !currentStatus;

      // Enregistrer le jour spécifique de télétravail
      await remoteWorkService.setSpecificRemoteDay(
        userId,
        date,
        newStatus,
        `Exception télétravail ${newStatus ? 'activé' : 'désactivé'} pour le ${dateStr}`,
        currentUser.uid
      );

      // Mettre à jour l'état local
      setRemoteWorkDays(prev => {
        const updated = new Map(prev);
        updated.set(dayKey, newStatus);
        return updated;
      });
    } catch (error) {
      
    }
  }, [remoteWorkDays, remoteSchedules]);

  const handleDeleteSpecificRemoteDay = useCallback(async (
    userId: string,
    date: Date
  ) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        
        return;
      }

      // Format local pour éviter les problèmes de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayKey = `${userId}_${dateStr}`;

      // Supprimer l'exception en base
      await remoteWorkService.deleteSpecificRemoteDay(userId, date);

      // Mettre à jour l'état local en supprimant la clé
      setRemoteWorkDays(prev => {
        const updated = new Map(prev);
        updated.delete(dayKey);
        return updated;
      });
    } catch (error) {
      
    }
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    const taskToDelete = selectedItem || workloadDays.flatMap(w => w.items).find(item => item.id === taskId);

    if (!taskToDelete) {
      
      return;
    }

    // Déterminer l'ID de la tâche originale (pour les tâches multi-jours)
    const originalTaskId = taskToDelete.originalTaskId || taskId;

    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement la tâche "${taskToDelete.title}" ?\n\nCette action est irréversible.`
    );

    if (!confirmDelete) return;

    try {
      // Utiliser le bon service selon le type de tâche
      if (taskToDelete.type === 'simple_task') {
        await simpleTaskService.deleteSimpleTask(originalTaskId);
      } else {
        await taskService.deleteTask(originalTaskId);
      }

      // Recharger les données
      await loadCalendarData();

      // Fermer toutes les modals
      setTaskModalOpen(false);
      setTaskModalData({});
      setSelectedItem(null);
    } catch (error) {
      
      alert('Erreur lors de la suppression de la tâche');
    }
  }, [loadCalendarData, selectedItem, workloadDays]);

  const handleEditTask = useCallback((calendarItem: CalendarItem) => {
    // Déterminer l'ID de la tâche originale (pour les tâches multi-jours)
    const taskId = calendarItem.originalTaskId || calendarItem.id;
    
    // Fermer la modal générique
    setSelectedItem(null);
    
    // On va d'abord essayer de charger la tâche depuis le service
    taskService.getTask(taskId)
      .then(task => {
        if (task) {
          setTaskModalData({
            userId: calendarItem.userId,
            date: calendarItem.startTime,
            projectId: calendarItem.projectId,
            task,
          });
          setTaskModalOpen(true);
        }
      })
      .catch(error => {
        
      });
  }, []);

  // ========================================
  // NAVIGATION
  // ========================================

  const handlePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // ========================================
  // EFFECTS
  // ========================================

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // ========================================
  // RENDER
  // ========================================

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Stack alignItems="center">
          <CircularProgress />
          <Typography>Chargement du planning intelligent...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={loadCalendarData} sx={{ ml: 2 }}>
          Réessayer
        </Button>
      </Alert>
    );
  }

  const getViewTitle = () => {
    if (viewMode === 'week') {
      const firstDay = weekDays[0];
      const lastDay = weekDays[weekDays.length - 1];
      return `Semaine du ${format(firstDay, 'd MMM', { locale: fr })} au ${format(lastDay, 'd MMM yyyy', { locale: fr })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: fr });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Box>
        {/* Header avec navigation et stats */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h4">
                📅 Planning
              </Typography>
              
              {/* Stats globales */}
              <Stack direction="row">
                <Chip
                  icon={<PersonIcon />}
                  label={`${users.length} ressources`}
                  color="primary"
                />
                <Chip
                  icon={<WarningIcon />}
                  label={`${conflicts.length} conflits`}
                  color={conflicts.length > 0 ? 'error' : 'success'}
                />
              </Stack>
            </Stack>

            {/* Navigation */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" alignItems="center">
                <IconButton onClick={handlePrevious}>
                  <ChevronLeftIcon />
                </IconButton>
                
                <Button variant="outlined" startIcon={<TodayIcon />} onClick={handleToday}>
                  Aujourd'hui
                </Button>
                
                <IconButton onClick={handleNext}>
                  <ChevronRightIcon />
                </IconButton>
                
                <Typography variant="h6" sx={{ ml: 2, textTransform: 'capitalize' }}>
                  {getViewTitle()}
                </Typography>
              </Stack>

              {/* Sélecteur de vue */}
              <Stack direction="row">
                <FormControl size="small">
                  <Select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  >
                    <MenuItem value="week">
                      <Stack direction="row" alignItems="center">
                        <ViewWeekIcon fontSize="small" />
                        <span>Semaine</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="month">
                      <Stack direction="row" alignItems="center">
                        <CalendarMonthIcon fontSize="small" />
                        <span>Mois</span>
                      </Stack>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* En-têtes des colonnes jours */}
        {viewMode === 'week' && (
          <Card sx={{ 
            mb: 1, 
            position: 'sticky', 
            top: 64, // Hauteur approximative de la navbar Material-UI
            zIndex: 1000, 
            backgroundColor: 'background.paper',
            boxShadow: 2
          }}>
            <CardContent sx={{ p: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {/* Zone utilisateur header - même largeur que les lignes */}
                <Box sx={{ 
                  width: 240, 
                  minWidth: 240,
                  maxWidth: 240,
                  flexShrink: 0,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  pr: 1
                }}>
                  <Typography variant="body2" fontWeight="bold" color="text.secondary">
                    Ressources
                  </Typography>
                </Box>
                
                {/* Zone des jours - même structure que les lignes */}
                <Box sx={{ 
                  flex: 1,
                  minWidth: 0,
                  overflowX: 'auto'
                }}>
                  <Stack direction="row" spacing={0.5}>
                    {weekDays.map((day) => (
                      <Box 
                        key={day.toISOString()} 
                        sx={{ 
                          width: 160,
                          minWidth: 160,
                          maxWidth: 160,
                          textAlign: 'center',
                          p: 0.5,
                          borderRadius: 1,
                          backgroundColor: isToday(day) ? 'primary.light' : 'transparent'
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={isToday(day) ? 'primary.main' : 'text.primary'}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          {format(day, 'EEE d MMM', { locale: fr })}
                        </Typography>
                        {isToday(day) && (
                          <Typography variant="caption" color="primary" sx={{ fontSize: '0.7rem' }}>
                            Aujourd'hui
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Rendu conditionnel selon la vue */}
        {viewMode === 'week' ? (
          /* Vue hebdomadaire - Planning détaillé groupé par service */
          <Stack>
            {Array.from(workloadDaysByService.entries()).map(([serviceId, serviceWorkloadDays]) => {
              // Gestion spéciale pour "Encadrement"
              if (serviceId === 'encadrement') {
                const serviceName = 'Encadrement';
                const serviceColor = '#ff9800'; // Orange pour l'encadrement
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
                         
                          sx={{ cursor: 'pointer' }}
                          onClick={() => toggleService(serviceId)}
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
                          <Box flexGrow={1} />
                          <IconButton size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Liste des utilisateurs de l'encadrement */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ ml: 2, mb: 1 }}>
                        <Stack spacing={0.5}>
                          {serviceWorkloadDays.map((workloadDay) => (
                            <UserRow
                              key={workloadDay.userId}
                              workloadDay={workloadDay}
                              viewMode={viewMode}
                              weekDays={weekDays}
                              departments={departments}
                              userContracts={userContracts}
                              remoteSchedules={remoteSchedules}
                              remoteWorkDays={remoteWorkDays}
                              currentUserId={auth.currentUser?.uid || ''}
                              onItemMove={handleItemMove}
                              onItemClick={setSelectedItem}
                              onItemDrop={handleItemDrop}
                              onCreateTask={handleCreateTask}
                              onToggleWeeklyRemoteDay={handleToggleWeeklyRemoteDay}
                              onToggleSpecificRemoteDay={handleToggleSpecificRemoteDay}
                              onDeleteSpecificRemoteDay={handleDeleteSpecificRemoteDay}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                );
              }

              // Gestion normale pour les autres services
              const service = services.find(s => s.id === serviceId);
              const serviceName = service?.name || (serviceId === 'no-service' ? 'Sans service' : serviceId);
              const serviceColor = service?.color || 'grey.400';
              const isExpanded = expandedServices.has(serviceId);
              const userCount = serviceWorkloadDays.length;

              return (
                <Box key={serviceId}>
                  {/* En-tête du service */}
                  <Card 
                    sx={{ 
                      mb: 0.5,
                      background: 'linear-gradient(90deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%)',
                      border: '1px solid rgba(76,175,80,0.2)'
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack 
                        direction="row" 
                        alignItems="center" 
                       
                        sx={{ cursor: 'pointer' }}
                        onClick={() => toggleService(serviceId)}
                      >
                        <Box 
                          sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: serviceColor
                          }} 
                        />
                        <WorkIcon sx={{ color: 'success.main' }} />
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                          {serviceName}
                        </Typography>
                        <Chip 
                          label={`${userCount} ressource${userCount > 1 ? 's' : ''}`}
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                        <Box flexGrow={1} />
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* Liste des utilisateurs du service */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ ml: 2, mb: 1 }}>
                      <Stack spacing={0.5}>
                        {serviceWorkloadDays.map((workloadDay) => (
                          <UserRow
                            key={workloadDay.userId}
                            workloadDay={workloadDay}
                            viewMode={viewMode}
                            weekDays={weekDays}
                            departments={departments}
                            userContracts={userContracts}
                            remoteSchedules={remoteSchedules}
                            remoteWorkDays={remoteWorkDays}
                            currentUserId={auth.currentUser?.uid || ''}
                            onItemMove={handleItemMove}
                            onItemClick={setSelectedItem}
                            onItemDrop={handleItemDrop}
                            onCreateTask={handleCreateTask}
                            onToggleWeeklyRemoteDay={handleToggleWeeklyRemoteDay}
                            onToggleSpecificRemoteDay={handleToggleSpecificRemoteDay}
                            onDeleteSpecificRemoteDay={handleDeleteSpecificRemoteDay}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        ) : (
          /* Vue mensuelle - Planning détaillé mensuel */
          <>
            {/* En-têtes des colonnes jours du mois */}
            <Card sx={{ 
              mb: 1, 
              position: 'sticky', 
              top: 64,
              zIndex: 1000, 
              backgroundColor: 'background.paper',
              boxShadow: 2
            }}>
              <CardContent sx={{ p: 1 }}>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                    <Typography variant="body2" fontWeight="bold" color="text.secondary">
                      Ressources
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                    <Box sx={{ overflowX: 'auto', pb: 1 }}>
                      <Stack direction="row" spacing={0.5}>
                        {(() => {
                          const monthStart = startOfMonth(currentDate);
                          const monthEnd = endOfMonth(currentDate);
                          const monthDays = [];
                          let date = monthStart;
                          while (date <= monthEnd) {
                            monthDays.push(new Date(date));
                            date = addDays(date, 1);
                          }
                          return monthDays.map((day) => (
                            <Box key={day.toISOString()} sx={{ minWidth: 60, textAlign: 'center' }}>
                              <Typography 
                                variant="caption" 
                                fontWeight="bold"
                                color={isToday(day) ? 'primary.main' : 'text.primary'}
                                display="block"
                              >
                                {format(day, 'EEE', { locale: fr })}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                fontWeight={isToday(day) ? 'bold' : 'normal'}
                                color={isToday(day) ? 'primary.main' : 'text.primary'}
                              >
                                {format(day, 'd')}
                              </Typography>
                            </Box>
                          ));
                        })()}
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Planning mensuel détaillé groupé par service */}
            <Stack>
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
                           
                            sx={{ cursor: 'pointer' }}
                            onClick={() => toggleService(serviceId)}
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
                            <Box flexGrow={1} />
                            <IconButton size="small">
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Liste des utilisateurs de l'encadrement - Vue mensuelle */}
                      <Collapse in={isExpanded}>
                        <Box sx={{ ml: 2, mb: 1 }}>
                          <Stack spacing={0.5}>
                            {serviceWorkloadDays.map((workloadDay) => {
                              const monthStart = startOfMonth(currentDate);
                              const monthEnd = endOfMonth(currentDate);
                              const monthDays = [];
                              let date = monthStart;
                              while (date <= monthEnd) {
                                monthDays.push(new Date(date));
                                date = addDays(date, 1);
                              }

                              return (
                                <Card key={workloadDay.userId} sx={{ mb: 1 }}>
                                  <CardContent sx={{ p: 1 }}>
                                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                      {/* Colonne utilisateur avec métriques */}
                                      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                                        <Stack direction="row" alignItems="center">
                                          <Avatar 
                                            src={workloadDay.user.avatarUrl} 
                                            sx={{ width: 28, height: 28 }}
                                          >
                                            {workloadDay.user.firstName?.[0]}{workloadDay.user.lastName?.[0]}
                                          </Avatar>
                                          
                                          <Box flexGrow={1}>
                                            <Typography variant="caption" fontWeight="bold">
                                              {getUserDisplayName(workloadDay.user)}
                                            </Typography>
                                          </Box>
                                        </Stack>
                                      </Box>

                                      {/* Colonnes des jours du mois */}
                                      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                                        <Box sx={{ overflowX: 'auto' }}>
                                          <Stack direction="row" spacing={0.5}>
                                            {monthDays.map((day) => {
                                              const dayItems = workloadDay.items.filter(item => 
                                                isSameDay(item.startTime, day)
                                              );
                                              
                                              return (
                                                <Box key={day.toISOString()} sx={{ minWidth: 60, height: 50 }}>
                                                  {dayItems.length > 0 ? (
                                                    <Stack spacing={0.2}>
                                                      {dayItems.slice(0, 2).map((item, index) => (
                                                        <Box
                                                          key={item.id}
                                                          sx={{
                                                            bgcolor: item.color || '#2196f3',
                                                            color: 'white',
                                                            borderRadius: 0.5,
                                                            p: 0.2,
                                                            fontSize: '0.6rem',
                                                            textAlign: 'center',
                                                            cursor: 'pointer',
                                                            '&:hover': { opacity: 0.8 }
                                                          }}
                                                          onClick={() => setSelectedItem(item)}
                                                        >
                                                          <Typography variant="caption" sx={{ fontSize: '0.5rem' }}>
                                                            {item.title.substring(0, 8)}...
                                                          </Typography>
                                                        </Box>
                                                      ))}
                                                      {dayItems.length > 2 && (
                                                        <Typography variant="caption" sx={{ fontSize: '0.5rem', textAlign: 'center' }}>
                                                          +{dayItems.length - 2}
                                                        </Typography>
                                                      )}
                                                    </Stack>
                                                  ) : (
                                                    <Box 
                                                      sx={{ 
                                                        height: 40, 
                                                        border: '1px dashed transparent',
                                                        borderRadius: 0.5,
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                          borderColor: 'primary.main',
                                                          bgcolor: 'grey.50'
                                                        }
                                                      }}
                                                      onClick={() => handleCreateTask(workloadDay.userId, day)}
                                                    />
                                                  )}
                                                </Box>
                                              );
                                            })}
                                          </Stack>
                                        </Box>
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

                // Gestion normale pour les autres services
                const service = services.find(s => s.id === serviceId);
                const serviceName = service?.name || (serviceId === 'no-service' ? 'Sans service' : serviceId);
                const serviceColor = service?.color || 'grey.400';
                const isExpanded = expandedServices.has(serviceId);
                const userCount = serviceWorkloadDays.length;

                return (
                  <Box key={serviceId}>
                    {/* En-tête du service */}
                    <Card 
                      sx={{ 
                        mb: 0.5,
                        background: 'linear-gradient(90deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%)',
                        border: '1px solid rgba(76,175,80,0.2)'
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack 
                          direction="row" 
                          alignItems="center" 
                         
                          sx={{ cursor: 'pointer' }}
                          onClick={() => toggleService(serviceId)}
                        >
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              bgcolor: serviceColor
                            }} 
                          />
                          <WorkIcon sx={{ color: 'success.main' }} />
                          <Typography variant="h6" fontWeight="bold" color="success.main">
                            {serviceName}
                          </Typography>
                          <Chip 
                            label={`${userCount} ressource${userCount > 1 ? 's' : ''}`}
                            size="small" 
                            color="success" 
                            variant="outlined"
                          />
                          <Box flexGrow={1} />
                          <IconButton size="small">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Liste des utilisateurs du service - Vue mensuelle */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ ml: 2, mb: 1 }}>
                        <Stack spacing={0.5}>
                          {serviceWorkloadDays.map((workloadDay) => {
                            const monthStart = startOfMonth(currentDate);
                            const monthEnd = endOfMonth(currentDate);
                            const monthDays = [];
                            let date = monthStart;
                            while (date <= monthEnd) {
                              monthDays.push(new Date(date));
                              date = addDays(date, 1);
                            }

                            return (
                              <Card key={workloadDay.userId} sx={{ mb: 1 }}>
                                <CardContent sx={{ p: 1 }}>
                                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                    {/* Colonne utilisateur avec métriques */}
                                    <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                                      <Stack direction="row" alignItems="center">
                                        <Avatar 
                                          src={workloadDay.user.avatarUrl} 
                                          sx={{ width: 28, height: 28 }}
                                        >
                                          {workloadDay.user.firstName?.[0]}{workloadDay.user.lastName?.[0]}
                                        </Avatar>
                                        
                                        <Box flexGrow={1}>
                                          <Typography variant="caption" fontWeight="bold">
                                            {getUserDisplayName(workloadDay.user)}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                    </Box>

                                    {/* Colonnes des jours du mois */}
                                    <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                                      <Box sx={{ overflowX: 'auto' }}>
                                        <Stack direction="row" spacing={0.5}>
                                          {monthDays.map((day) => {
                                            const dayItems = workloadDay.items.filter(item => 
                                              isSameDay(item.startTime, day)
                                            );
                                            
                                            return (
                                              <Box key={day.toISOString()} sx={{ minWidth: 60, minHeight: 40 }}>
                                                {dayItems.length > 0 ? (
                                                  <Stack spacing={0.2}>
                                                    {dayItems.slice(0, 2).map((item, index) => (
                                                      <Box
                                                        key={item.id}
                                                        sx={{
                                                          bgcolor: item.color || '#2196f3',
                                                          color: 'white',
                                                          borderRadius: 0.5,
                                                          p: 0.2,
                                                          fontSize: '0.6rem',
                                                          textAlign: 'center',
                                                          cursor: 'pointer',
                                                          '&:hover': { opacity: 0.8 }
                                                        }}
                                                        onClick={() => setSelectedItem(item)}
                                                      >
                                                        <Typography variant="caption" sx={{ fontSize: '0.5rem' }}>
                                                          {item.title.substring(0, 8)}...
                                                        </Typography>
                                                      </Box>
                                                    ))}
                                                    {dayItems.length > 2 && (
                                                      <Typography variant="caption" sx={{ fontSize: '0.5rem', textAlign: 'center' }}>
                                                        +{dayItems.length - 2}
                                                      </Typography>
                                                    )}
                                                  </Stack>
                                                ) : (
                                                  <Box 
                                                    sx={{ 
                                                      minHeight: 40, 
                                                      border: '1px dashed transparent',
                                                      borderRadius: 0.5,
                                                      cursor: 'pointer',
                                                      '&:hover': {
                                                        borderColor: 'primary.main',
                                                        bgcolor: 'grey.50'
                                                      }
                                                    }}
                                                    onClick={() => handleCreateTask(workloadDay.userId, day)}
                                                  />
                                                )}
                                              </Box>
                                            );
                                          })}
                                        </Stack>
                                      </Box>
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
          </>
        )}

        {/* Conflits détectés */}
        {conflicts.length > 0 && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="error">
                ⚠️ Conflits détectés ({conflicts.length})
              </Typography>
              <Stack>
                {conflicts.slice(0, 5).map((conflict, index) => (
                  <Alert key={index} severity="warning">
                    <Typography variant="body2">
                      <strong>{conflict.conflictType.toUpperCase()}</strong>: {conflict.message}
                    </Typography>
                    <Typography variant="caption" display="block">
                      💡 {conflict.suggestedAction}
                    </Typography>
                  </Alert>
                ))}
                {conflicts.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    ... et {conflicts.length - 5} autres conflits
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Dialog détail item */}
        <Dialog
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            📋 Détail de l'activité
          </DialogTitle>
          <DialogContent>
            {selectedItem && (
              <Stack>
                <Box>
                  <Typography variant="h6">{selectedItem.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedItem.project?.name || 'Non affecté (Admin/Formation)'}
                  </Typography>
                </Box>
                
                <Divider />
                
                <Stack direction="row">
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Horaires</Typography>
                    <Typography variant="body2">
                      {format(selectedItem.startTime, 'dd/MM/yyyy HH:mm', { locale: fr })}
                      {' → '}
                      {format(selectedItem.endTime, 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Durée: {differenceInHours(selectedItem.endTime, selectedItem.startTime)}h
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Assigné à</Typography>
                    <Stack direction="row" alignItems="center">
                      <Avatar 
                        src={selectedItem.assignee?.avatarUrl} 
                        sx={{ width: 24, height: 24 }}
                      >
                        {selectedItem.assignee?.firstName?.[0]}{selectedItem.assignee?.lastName?.[0]}
                      </Avatar>
                      <Typography variant="body2">
                        {selectedItem.assignee ? getUserDisplayName(selectedItem.assignee) : 'Non assigné'}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction="row">
                  <Chip
                    label={selectedItem.type.toUpperCase()}
                    size="small"
                    color="primary"
                  />
                  <Chip
                    label={selectedItem.priority}
                    size="small"
                    color={selectedItem.priority === 'P0' ? 'error' : 'default'}
                  />
                  <Chip
                    label={selectedItem.status}
                    size="small"
                    color={selectedItem.status === 'DONE' ? 'success' : 'default'}
                  />
                  {selectedItem.isRemote && (
                    <Chip
                      label="Télétravail"
                      size="small"
                      icon={<HomeIcon />}
                      color="secondary"
                    />
                  )}
                </Stack>

                {selectedItem.conflictsWith && selectedItem.conflictsWith.length > 0 && (
                  <Alert severity="error">
                    <Typography variant="body2">
                      ⚠️ Cet élément est en conflit avec {selectedItem.conflictsWith.length} autre(s) activité(s)
                    </Typography>
                  </Alert>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Button 
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => selectedItem && handleTaskDelete(selectedItem.id)}
              variant="outlined"
            >
              Supprimer
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setSelectedItem(null)}>
                Fermer
              </Button>
              <Button 
                variant="contained"
                onClick={() => selectedItem && handleEditTask(selectedItem)}
              >
                Modifier
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* TaskModal pour créer/éditer des tâches */}
        <TaskModal
          open={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setTaskModalData({});
          }}
          task={taskModalData.task}
          projectId={taskModalData.projectId}
          dueDate={taskModalData.date}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      </Box>
    </DndProvider>
  );
};

export default PlanningCalendar;