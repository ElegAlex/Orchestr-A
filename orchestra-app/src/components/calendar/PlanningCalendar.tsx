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
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
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
  CalendarMonth as CalendarMonthIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Home as HomeIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
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
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isToday,
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
import { simpleTaskService } from '../../services/simpleTask.service';
import { userService } from '../../services/user.service';
import { projectService } from '../../services/project.service';
import { departmentService } from '../../services/department.service';
import { ServiceService } from '../../services/service.service';
import { capacityService } from '../../services/capacity.service';
import { workloadCalculatorService } from '../../services/workload-calculator.service';
import { leaveService } from '../../services/leave.service';
import { useTeleworkV2 } from '../../hooks/useTeleworkV2';
import { TeleworkDayCell } from './TeleworkDayCell';
import { TeleworkProfileModal } from './TeleworkProfileModal';
import { TeleworkBulkDeclarationModal } from './TeleworkBulkDeclarationModal';
import { TaskModalSimplified as TaskModal } from '../tasks/TaskModalSimplified';
import { SimpleTaskModal } from './SimpleTaskModal';
import { AdminLeaveDeclarationModal } from './AdminLeaveDeclarationModal';
import { MonthView } from './MonthView';
import { auth } from '../../config/firebase';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { permissionsService } from '../../services/permissions.service';

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
  // Nouveaux champs pour les tâches multi-jours
  originalTaskId?: string; // ID de la tâche originale
  isSpanning?: boolean; // Indique si la tâche s'étend sur plusieurs jours
  spanDay?: number; // Jour actuel dans la séquence (1, 2, 3...)
  totalSpanDays?: number; // Nombre total de jours de la tâche
  taskCount?: number; // Nombre de tâches regroupées dans cette card projet
  // Nouveaux champs pour l'affichage enrichi
  progress?: number; // Progression 0-100%
  estimatedHours?: number; // Heures estimées
  daysRemaining?: number; // Jours restants avant deadline
  // Congés - demi-journées
  halfDayType?: 'morning' | 'afternoon' | 'full';
  description?: string;
  // Créneaux horaires en string (pour tâches simples)
  startTimeString?: string; // Format "HH:mm"
  endTimeString?: string; // Format "HH:mm"
}

interface UserWorkloadDay {
  userId: string;
  user: User;
  date: Date;
  capacity: number; // En heures (ex: 7)
  allocated: number; // En heures déjà allouées
  items: CalendarItem[];
  isRemoteWork: boolean;
  utilizationRate: number; // 0-100%
  contract: WorkContract | null;
}


type ViewMode = 'week' | 'month';
type ViewFilter = 'all' | 'availability' | 'activity';

// ========================================
// FILTRAGE PAR VUE
// ========================================

/**
 * Filtre les items du calendrier selon le filtre de vue sélectionné
 * @param items - Liste des items du calendrier
 * @param filter - Type de filtre à appliquer
 * @returns Liste filtrée des items
 */
const filterItemsByViewFilter = (items: CalendarItem[], filter: ViewFilter): CalendarItem[] => {
  if (filter === 'all') {
    // Mode "Tout" : afficher tous les items
    return items;
  }

  if (filter === 'availability') {
    // Mode "Disponibilités" : afficher uniquement les congés, télétravail, jours fériés
    return items.filter(item =>
      item.type === 'leave' ||
      item.type === 'remote' ||
      item.isRemote === true
    );
  }

  if (filter === 'activity') {
    // Mode "Activités" : afficher uniquement les tâches (projet + simples)
    return items.filter(item =>
      item.type === 'task' ||
      item.type === 'simple_task'
    );
  }

  return items;
};

// ========================================
// ENHANCED TASK CARD COMPONENT
// ========================================

// Fonction pour générer une carte de tâche enrichie
const renderEnhancedTaskCard = (item: CalendarItem, onClick: (item: CalendarItem) => void, compact = false) => {
  const isSimpleTask = item.type === 'simple_task';
  const isPriorityCritical = item.priority === 'P0';
  const isOverdue = (item.daysRemaining || 0) < 0;
  const isUrgent = (item.daysRemaining || 0) <= 1 && !isOverdue;

  // Icone selon le type
  const getTaskIcon = () => {
    if (isSimpleTask) return '⚡'; // Éclair pour tâches simples
    if (item.project) return '📁'; // Dossier pour projets
    return '📋'; // Presse-papier par défaut
  };

  // Couleur de priorité
  const getPriorityColor = () => {
    switch (item.priority) {
      case 'P0': return '#f44336'; // Rouge
      case 'P1': return '#ff9800'; // Orange
      case 'P2': return '#2196f3'; // Bleu
      case 'P3': return '#9e9e9e'; // Gris
      default: return item.color;
    }
  };

  return (
    <Box
      sx={{
        bgcolor: item.color,
        color: 'white',
        borderRadius: 1,
        p: compact ? 0.5 : 1,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        minHeight: compact ? 32 : 56,
        border: isPriorityCritical ? '2px solid #f44336' : 'none',
        boxShadow: compact ? 1 : 2,
        '&:hover': {
          opacity: 0.9,
          transform: 'translateY(-1px)',
          boxShadow: 3
        },
        transition: 'all 0.2s ease'
      }}
      onClick={() => onClick(item)}
    >
      {/* Badge priorité critique */}
      {isPriorityCritical && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bgcolor: '#f44336',
            color: 'white',
            fontSize: '0.6rem',
            px: 0.5,
            borderBottomLeftRadius: 4
          }}
        >
          URGENT
        </Box>
      )}

      {/* Header avec icône et projet */}
      <Stack direction="row" alignItems="center" spacing={0.5} mb={compact ? 0 : 0.5}>
        <Typography sx={{ fontSize: '0.8rem' }}>{getTaskIcon()}</Typography>
        {item.project && !compact && (
          <Chip
            label={item.project.name}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '0.6rem',
              height: 16
            }}
          />
        )}
        <Box flexGrow={1} />
        {item.estimatedHours && (
          <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
            {item.estimatedHours}h
          </Typography>
        )}
      </Stack>

      {/* Titre de la tâche */}
      <Typography
        variant={compact ? "caption" : "body2"}
        fontWeight="medium"
        sx={{
          fontSize: compact ? '0.65rem' : '0.8rem',
          lineHeight: 1.2,
          mb: compact ? 0 : 0.5,
          display: '-webkit-box',
          WebkitLineClamp: compact ? 1 : 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
        title={item.title}
      >
        {item.title}
      </Typography>

      {/* Affichage des horaires pour les tâches simples */}
      {(() => {
        const shouldDisplay = item.type === 'simple_task' && item.startTimeString && item.endTimeString;
        return shouldDisplay ? (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 'bold',
              display: 'block',
              mb: 0.5
            }}
          >
            {`🕐 ${item.startTimeString} - ${item.endTimeString}`}
          </Typography>
        ) : null;
      })()}

      {/* Barre de progression et infos (mode non compact) */}
      {!compact && (
        <>
          {typeof item.progress === 'number' && (
            <Box sx={{ mb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Box flexGrow={1}>
                  <LinearProgress
                    variant="determinate"
                    value={item.progress}
                    sx={{
                      height: 3,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: 'rgba(255,255,255,0.8)'
                      }
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                  {item.progress}%
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Footer avec statut et deadline */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Chip
              label={item.status}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'white',
                fontSize: '0.5rem',
                height: 14
              }}
            />
            {typeof item.daysRemaining === 'number' && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6rem',
                  color: isOverdue ? '#ffcdd2' : isUrgent ? '#ffe0b2' : 'rgba(255,255,255,0.8)'
                }}
              >
                {isOverdue ? `Retard ${Math.abs(item.daysRemaining)}j` :
                 item.daysRemaining === 0 ? 'Aujourd\'hui' :
                 `J-${item.daysRemaining}`}
              </Typography>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
};

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
    if (item.isRemote) return '#9c27b0'; // Violet télétravail
    return item.color || '#2196f3';
  };

  const duration = differenceInHours(item.endTime, item.startTime);

  return (
    <Box
      ref={drag as any}
      onClick={() => onClick(item)}
      sx={{
        width: '100%', // Forcer la largeur complète
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
        border: 'none',
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
        {item.type === 'simple_task' && item.startTimeString && item.endTimeString && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.9, fontSize: '0.65rem', fontWeight: 'bold' }}>
            🕐 {item.startTimeString} - {item.endTimeString}
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
  taskZone?: 'project' | 'simple'; // Nouvelle prop pour identifier la zone
  onDrop: (item: CalendarItem, userId: string, date: Date, slotIndex: number) => void;
  onCreateTask: (userId: string, date: Date, taskZone?: 'project' | 'simple') => void;
  onItemClick: (item: CalendarItem) => void;
}

const TaskSlot: React.FC<TaskSlotProps> = ({
  userId,
  date,
  slotIndex,
  item,
  isEmpty,
  taskZone,
  onDrop,
  onCreateTask,
  onItemClick
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'calendar-item',
    canDrop: (draggedItem: CalendarItem) => {
      // Validation : accepter seulement si le type correspond à la zone
      if (taskZone === 'project') {
        return draggedItem.type === 'task';
      } else if (taskZone === 'simple') {
        return draggedItem.type === 'simple_task';
      }
      return true;
    },
    drop: (draggedItem: CalendarItem) => {
      onDrop(draggedItem, userId, date, slotIndex);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [taskZone, userId, date, slotIndex]);

  const handleSlotClick = () => {
    if (isEmpty && !item) {
      onCreateTask(userId, date, taskZone);
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
        height: 38, // Réduit de 5% (40 * 0.95 = 38)
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : isEmpty ? 'transparent' : 'transparent',
        bgcolor: isOver && canDrop ? 'primary.light' : 'transparent',
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
      ) : null}
    </Box>
  );
};


// ========================================
// USER ROW COMPONENT
// ========================================

interface UserRowProps {
  workloadDay: UserWorkloadDay;
  viewMode: ViewMode;
  viewFilter: ViewFilter;
  weekDays: Date[];
  departments: Department[];
  userContracts: Map<string, WorkContract | null>;
  currentUserId: string;
  teleworkSystem: any; // Type du hook v2
  onItemMove: (itemId: string, newStartTime: Date, newEndTime: Date, newUserId?: string) => void;
  onItemClick: (item: CalendarItem) => void;
  onItemDrop: (item: CalendarItem, userId: string, date: Date, slotIndex: number) => void;
  onCreateTask: (userId: string, date: Date, taskZone?: 'project' | 'simple') => void;
  onTeleworkModeChange: (userId: string, date: Date, mode: 'office' | 'remote') => Promise<void>;
  onTeleworkProfileConfig: (userId: string) => void;
  onTeleworkDetails: (userId: string, date: Date) => void;
  onBulkTeleworkDeclaration: (userId: string, userDisplayName: string) => void;
}

const UserRow: React.FC<UserRowProps> = ({
  workloadDay,
  viewMode,
  viewFilter,
  weekDays,
  departments,
  userContracts,
  currentUserId,
  teleworkSystem,
  onItemMove,
  onItemClick,
  onItemDrop,
  onCreateTask,
  onTeleworkModeChange,
  onTeleworkProfileConfig,
  onTeleworkDetails,
  onBulkTeleworkDeclaration,
}) => {
  const getUtilizationColor = (rate: number) => {
    if (rate <= 60) return 'success';
    if (rate <= 85) return 'warning';
    if (rate <= 100) return 'info';
    return 'error';
  };

  // Calculer le nombre max de tâches projet sur toute la semaine pour cet utilisateur
  const maxProjectTasksCount = weekDays.reduce((max, date) => {
    const dayItems = workloadDay.items.filter(item => isSameDay(item.startTime, date));
    const projectTasks = dayItems.filter(item => item.type === 'task');
    return Math.max(max, projectTasks.length);
  }, 0);

  // Hauteur de la zone projet : basée sur le max de tâches
  // Chaque tâche = 38px (height, réduit de 5%) + 4px (spacing) = 42px
  // En mode "Disponibilités", réduire la hauteur à 60px pour focus sur congés/télétravail
  const projectZoneHeight = viewFilter === 'availability'
    ? 60
    : Math.max(42, maxProjectTasksCount * 42);

  const renderDayColumn = (date: Date) => {
    const dayItems = workloadDay.items.filter(item =>
      isSameDay(item.startTime, date)
    );

    // Séparer les tâches projet, tâches simples et congés
    const projectTasks = dayItems.filter(item => item.type === 'task');
    const simpleTasks = dayItems.filter(item => item.type === 'simple_task');
    const leaves = dayItems.filter(item => item.type === 'leave');

    // Vérifier si l'utilisateur est en télétravail ce jour avec le nouveau système unifié
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const teleworkDayKey = `${workloadDay.userId}_${dateStr}`;
    const teleworkResolution = teleworkSystem.getResolutionForDay(workloadDay.userId, date);
    const isRemoteDay = teleworkResolution?.resolvedMode === 'remote' || false;

    // Slots de drop supprimés - plus besoin avec le bouton "Nouvelle Tâche"

    return (
      <Box key={date.toISOString()} sx={{
        flex: 1,
        minWidth: 160,
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isRemoteDay ? 'rgba(255, 152, 0, 0.25)' : 'transparent',
        borderRadius: 1,
        position: 'relative',
      }}>
        {/* BANDEAU CONGÉ - En haut de la colonne, priorité visuelle absolue */}
        {leaves.length > 0 && leaves.map((leave, idx) => {
          const isHalfDay = leave.halfDayType && leave.halfDayType !== 'full';
          const widthPercent = isHalfDay ? '48%' : '100%';
          const alignSelf = leave.halfDayType === 'afternoon' ? 'flex-end' :
                            leave.halfDayType === 'morning' ? 'flex-start' :
                            'stretch';

          const getLeaveIcon = () => {
            if (leave.halfDayType === 'morning') return '🌅 ';
            if (leave.halfDayType === 'afternoon') return '🌆 ';
            return '🌞 ';
          };

          const getBgGradient = () => {
            if (leave.halfDayType === 'morning') {
              return 'linear-gradient(90deg, #4caf50 0%, #81c784 100%)';
            } else if (leave.halfDayType === 'afternoon') {
              return 'linear-gradient(90deg, #81c784 0%, #4caf50 100%)';
            }
            return '#4caf50';
          };

          return (
            <Box
              key={idx}
              sx={{
                mb: 0.5,
                width: widthPercent,
                alignSelf: alignSelf,
                background: getBgGradient(),
                color: 'white',
                p: 0.5,
                borderRadius: 1,
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '0.65rem',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                zIndex: 10,
                position: 'relative'
              }}
            >
              <Box>
                {getLeaveIcon()}{leave.title}
              </Box>
            </Box>
          );
        })}

        {/* Indicateur télétravail */}
        {isRemoteDay && !leaves.length && (
          <Box
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              bgcolor: teleworkResolution?.source === 'override' ? 'warning.main' : 'secondary.main',
              color: 'white',
              borderRadius: 0.5,
              px: 0.5,
              py: 0.1,
              fontSize: '0.6rem',
              fontWeight: 'bold',
              zIndex: 1,
              border: teleworkResolution?.source === 'override' ? '2px solid' : 'none',
              borderColor: teleworkResolution?.source === 'override' ? 'warning.dark' : 'transparent'
            }}
            title={teleworkResolution?.source === 'override' ? 'Télétravail ponctuel' : 'Télétravail'}
          >
            {teleworkResolution?.source === 'override' ? '🏠!' : 'TT'}
          </Box>
        )}

        {/* ZONE PROJETS - Hauteur fixe homogène sur toute la semaine */}
        <Box sx={{
          height: projectZoneHeight,
          minHeight: projectZoneHeight,
          bgcolor: 'rgba(33, 150, 243, 0.04)', // Bleu très léger
          borderRadius: 1,
          p: 0.5,
          mb: 0.5,
          position: 'relative'
        }}>
          {/* OVERLAY VERT pour masquer les tâches en cas de congé */}
          {leaves.length > 0 && leaves.map((leave, idx) => {
            const isHalfDay = leave.halfDayType && leave.halfDayType !== 'full';
            const widthPercent = isHalfDay ? '48%' : '100%';
            const leftPosition = leave.halfDayType === 'afternoon' ? '52%' : '0';

            return (
              <Box
                key={`overlay-project-${idx}`}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: leftPosition,
                  width: widthPercent,
                  bottom: 0,
                  bgcolor: 'rgba(76, 175, 80, 0.7)', // Vert semi-transparent 70%
                  borderRadius: 1,
                  zIndex: 5,
                  pointerEvents: 'none', // Permet de cliquer à travers
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem', opacity: 0.8 }}>
                  Absent
                </Typography>
              </Box>
            );
          })}
          {/* Tâches projet */}
          <Stack spacing={0.5}>
            {projectTasks.map((item, index) => (
              <TaskSlot
                key={`${date.toISOString()}-project-${index}`}
                userId={workloadDay.userId}
                date={date}
                slotIndex={index}
                item={item}
                isEmpty={false}
                taskZone="project"
                onDrop={onItemDrop}
                onCreateTask={onCreateTask}
                onItemClick={onItemClick}
              />
            ))}
          </Stack>
        </Box>

        {/* SÉPARATEUR entre tâches projets et tâches simples */}
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            opacity: 0.5,
            my: 0.5
          }}
        />

        {/* ZONE TÂCHES SIMPLES - Hauteur dynamique */}
        <Box sx={{
          p: 0.5,
          position: 'relative'
        }}>
          {/* OVERLAY VERT pour masquer les tâches simples en cas de congé */}
          {leaves.length > 0 && leaves.map((leave, idx) => {
            const isHalfDay = leave.halfDayType && leave.halfDayType !== 'full';
            const widthPercent = isHalfDay ? '48%' : '100%';
            const leftPosition = leave.halfDayType === 'afternoon' ? '52%' : '0';

            return (
              <Box
                key={`overlay-simple-${idx}`}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: leftPosition,
                  width: widthPercent,
                  bottom: 0,
                  bgcolor: 'rgba(76, 175, 80, 0.7)', // Vert semi-transparent 70%
                  borderRadius: 1,
                  zIndex: 5,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem', opacity: 0.8 }}>
                  Absent
                </Typography>
              </Box>
            );
          })}
          {/* Tâches simples */}
          <Stack spacing={0.5}>
            {simpleTasks.map((item, index) => (
              <TaskSlot
                key={`${date.toISOString()}-simple-${index}`}
                userId={workloadDay.userId}
                date={date}
                slotIndex={index}
                item={item}
                isEmpty={false}
                taskZone="simple"
                onDrop={onItemDrop}
                onCreateTask={onCreateTask}
                onItemClick={onItemClick}
              />
            ))}
          </Stack>
        </Box>

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
              </Box>
            </Stack>

            {/* Boutons télétravail avec le nouveau système */}
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
              {weekDays.map((day) => {
                const resolution = teleworkSystem.getResolutionForDay(workloadDay.userId, day);

                return (
                  <TeleworkDayCell
                    key={`${workloadDay.userId}_${day.toISOString()}`}
                    resolution={resolution || {
                      date: day,
                      userId: workloadDay.userId,
                      resolvedMode: 'office',
                      source: 'default',
                      confidence: 70,
                      appliedRules: {},
                      conflicts: [],
                      warnings: []
                    }}
                    isEditable={currentUserId === workloadDay.userId || true} // TODO: Check permissions
                    size="small"
                    showDetails={false}
                    onModeChange={async (mode) => {
                      await onTeleworkModeChange(workloadDay.userId, day, mode);
                    }}
                    onRequestOverride={async (mode, reason) => {
                      await teleworkSystem.requestOverride(workloadDay.userId, day, mode, reason);
                    }}
                    onConfigureProfile={() => onTeleworkProfileConfig(workloadDay.userId)}
                    onViewDetails={() => onTeleworkDetails(workloadDay.userId, day)}
                  />
                );
              })}

              {/* Bouton déclaration bulk */}
              <IconButton
                size="small"
                onClick={() => onBulkTeleworkDeclaration(
                  workloadDay.userId,
                  getUserDisplayName(workloadDay.user)
                )}
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                  ml: 0.5,
                }}
                title="Planifier plusieurs jours"
              >
                <CalendarMonthIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {/* Zone des jours - s'adapte au reste */}
          <Box sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'auto'
          }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {weekDays.map((day) => {
                  // Récupérer le contrat de cet utilisateur spécifique
                  const userContract = userContracts.get(workloadDay.userId) || null;

                  // Si l'utilisateur ne travaille pas ce jour, ne pas afficher la colonne
                  if (!isWorkingDay(day, userContract)) {
                    return (
                      <Box
                        key={day.toISOString()}
                        sx={{
                          flex: 1,
                          minWidth: 160,
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
                })}
            </Box>
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
  selectedServices?: string[];
  services?: Service[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onServicesChange?: (services: string[]) => void;
  onNewTask?: () => void;
  hideServicesFilter?: boolean; // Pour masquer le filtre services (Dashboard Hub)
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
  selectedServices = [],
  services: servicesFromProps,
  onTaskUpdate,
  onServicesChange,
  onNewTask,
  hideServicesFilter = false,
}) => {
  // Utilisateur connecté
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Déterminer les services expanded par défaut selon le rôle
  const getInitialExpandedServices = (): Set<string> => {
    const isLimitedRole = currentUser?.role === 'contributor' || currentUser?.role === 'teamLead';
    // Si contributor ou teamLead, ne pas ouvrir encadrement par défaut
    return isLimitedRole ? new Set() : new Set(['encadrement']);
  };

  // États principaux
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Données
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rawWorkloadDays, setRawWorkloadDays] = useState<UserWorkloadDay[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(getInitialExpandedServices());
  const [userContracts, setUserContracts] = useState<Map<string, WorkContract | null>>(new Map());

  // Calcul des dates du calendrier pour le hook télétravail
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: fr });
    const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    // Filtrer selon les jours ouvrables des utilisateurs
    return filterWorkingDays(allWeekDays, userContracts);
  }, [currentDate, userContracts]);

  // Calculer les jours du mois pour la vue mensuelle
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days: Date[] = [];
    let date = monthStart;
    while (date <= monthEnd) {
      days.push(new Date(date));
      date = addDays(date, 1);
    }
    return days;
  }, [currentDate]);

  // Calculer la plage étendue pour le calendrier télétravail (période visible + marge)
  const teleworkDateRange = useMemo(() => {
    if (viewMode === 'month') {
      // Vue mois : charger tout le mois + marge
      const start = new Date(monthDays[0] || currentDate);
      start.setDate(start.getDate() - 15); // 15 jours avant
      const end = new Date(monthDays[monthDays.length - 1] || currentDate);
      end.setDate(end.getDate() + 15); // 15 jours après
      return { start, end };
    } else {
      // Vue semaine : charger la semaine + marge
      const start = new Date(weekDays[0] || currentDate);
      start.setDate(start.getDate() - 15); // 15 jours avant
      const end = new Date(weekDays[weekDays.length - 1] || currentDate);
      end.setDate(end.getDate() + 15); // 15 jours après
      return { start, end };
    }
  }, [viewMode, weekDays, monthDays, currentDate]);

  // UserIds stable pour éviter les re-renders infinis
  const userIds = useMemo(() => users.map(u => u.id), [users]);

  // Hook pour la gestion du télétravail avec le nouveau système v2
  const teleworkSystem = useTeleworkV2({
    userIds,
    dateRange: teleworkDateRange,
    autoRefresh: true
  });

  // Appliquer les données télétravail aux workloadDays
  const workloadDays = useMemo(() => {
    return rawWorkloadDays.map(workloadDay => {
      const teleworkResolution = teleworkSystem.getResolutionForDay(workloadDay.userId, workloadDay.date);
      const isRemoteWork = teleworkResolution?.resolvedMode === 'remote';
      return { ...workloadDay, isRemoteWork };
    });
  }, [rawWorkloadDays, teleworkSystem.weekResolutions.size, teleworkSystem]);

  // UI États
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<CalendarItem | null>(null);
  
  // États TaskModal (tâches projet)
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalData, setTaskModalData] = useState<{
    userId?: string;
    date?: Date;
    projectId?: string;
    task?: Task | null;
  }>({});

  // États SimpleTaskModal (tâches simples)
  const [simpleTaskModalOpen, setSimpleTaskModalOpen] = useState(false);
  const [simpleTaskModalData, setSimpleTaskModalData] = useState<{
    userId?: string;
    date?: Date;
  }>({});

  // États TeleworkBulkDeclarationModal
  const [bulkTeleworkModalOpen, setBulkTeleworkModalOpen] = useState(false);
  const [bulkTeleworkModalData, setBulkTeleworkModalData] = useState<{
    userId?: string;
    userDisplayName?: string;
  }>({});

  // États AdminLeaveDeclarationModal
  const [adminLeaveModalOpen, setAdminLeaveModalOpen] = useState(false);

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
      // Exclure les viewers (observateurs)
      if (workloadDay.user.role === 'viewer') {
        return;
      }

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
    return {
      start: startOfWeek(currentDate, { locale: fr }),
      end: endOfWeek(currentDate, { locale: fr }),
    };
  }, [currentDate]);


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
      let filteredUsers = selectedUsers.length > 0
        ? allUsers.filter(u => selectedUsers.includes(u.id) && u.role !== 'admin')
        : allUsers.filter(u => u.isActive && u.role !== 'admin');

      // Filtrage par services
      if (selectedServices.length > 0) {
        filteredUsers = filteredUsers.filter(user => {
          // Si "Encadrement" est sélectionné et l'utilisateur est manager/responsable
          if (selectedServices.includes('encadrement') &&
              (user.role === 'manager' || user.role === 'responsable')) {
            return true;
          }

          // Support du nouveau champ serviceIds (array)
          if (user.serviceIds && user.serviceIds.length > 0) {
            const hasMatchingService = user.serviceIds.some(sId => selectedServices.includes(sId));
            if (hasMatchingService) {
              return true;
            }
          }

          // Fallback sur l'ancien champ serviceId (déprécié)
          if (user.serviceId && selectedServices.includes(user.serviceId)) {
            return true;
          }

          return false;
        });
      }

      // Debug info cleaned up

      const filteredProjects = selectedProjects.length > 0
        ? allProjects.filter(p => selectedProjects.includes(p.id))
        : allProjects;

      setUsers(filteredUsers);
      setProjects(filteredProjects);
      setDepartments(allDepartments);
      setServices(allServices);

      // Charger les contrats de travail des utilisateurs filtrés
      const contractsMap = new Map<string, WorkContract | null>();

      await Promise.all(
        filteredUsers.map(async (user) => {
          try {
            // Charger le contrat
            const contract = await capacityService.getUserContract(user.id);
            contractsMap.set(user.id, contract);
          } catch (error) {
            // Erreur silencieuse lors du chargement du contrat
            contractsMap.set(user.id, null);
          }
        })
      );
      setUserContracts(contractsMap);

      // Ouvrir les services par défaut selon le rôle de l'utilisateur connecté
      const isLimitedRole = currentUser?.role === 'contributor' || currentUser?.role === 'teamLead';
      const services = new Set(filteredUsers.map(user => {
        if (user.role === 'manager' || user.role === 'responsable') {
          return 'encadrement';
        }
        return user.serviceIds?.[0] || user.serviceId || 'no-service';
      }));

      // Si contributor ou teamLead, retirer 'encadrement' des services expanded
      if (isLimitedRole) {
        services.delete('encadrement');
      }

      setExpandedServices(services);

      // Calculer la charge de travail pour chaque utilisateur et chaque jour
      const workloadPromises = [];

      // Pour chaque utilisateur
      for (const user of filteredUsers) {
        // En vue semaine et mois : 1 seul WorkloadDay par user
        const date = viewMode === 'week' ? weekDays[0] : monthDays[0];
          workloadPromises.push(async () => {
            try {
              // ✅ Récupérer TOUTES les tâches et appliquer le filtre RACI comme Dashboard-Hub
              const [allTasks, allSimpleTasks, userLeaves] = await Promise.all([
                taskService.getTasks(), // Toutes les tâches
                simpleTaskService.getAll().catch(() => []), // Toutes les tâches simples
                leaveService.getUserLeaves(user.id).catch(() => []) // Congés de l'utilisateur
              ]);

              // Filtrer les tâches simples pour cet utilisateur
              const userSimpleTasks = allSimpleTasks.filter(task =>
                task.assignedTo === user.id
              );

              // Convertir SimpleTasks en format Task
              const simpleTasksAsTaskFormat: Task[] = userSimpleTasks.map(st => ({
                id: st.id,
                title: st.title,
                description: st.description,
                projectId: '',
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

              // Filtrer uniquement les tâches où l'utilisateur est RESPONSABLE
              const userTasks = allTasks.filter(task => {
                // Vérifier si l'user est responsable de la tâche UNIQUEMENT
                return Array.isArray(task.responsible) && task.responsible.includes(user.id);
              });

              // Combiner toutes les tâches
              const allUserTasks = [...userTasks, ...simpleTasksAsTaskFormat];

              // ✅ Calendar général : AUCUN filtrage par période, afficher toutes les tâches
              const periodTasks = allUserTasks.filter(task => {
                // Une tâche doit avoir au moins dueDate ou startDate
                if (!task.startDate && !task.dueDate) {
                  return false;
                }
                return true; // Toutes les tâches avec dates sont incluses
              });

          // ✅ NOUVELLE LOGIQUE : 1 carte = 1 tâche (pas de regroupement par projet)
          const calendarItems: CalendarItem[] = [];

          // ✅ Ajouter les congés en CalendarItems
          userLeaves.forEach(leave => {
            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);
            const leaveDays = eachDayOfInterval({ start: leaveStart, end: leaveEnd });
            const periodStart = viewMode === 'week' ? currentPeriod.start : monthDays[0];
            const periodEnd = viewMode === 'week' ? currentPeriod.end : monthDays[monthDays.length - 1];

            const leaveTypeLabels: { [key: string]: string } = {
              PAID_LEAVE: '🏖️ Congé payé',
              RTT: '🎯 RTT',
              SICK_LEAVE: '🏥 Maladie',
              MATERNITY_LEAVE: '👶 Maternité',
              PATERNITY_LEAVE: '👶 Paternité',
              EXCEPTIONAL_LEAVE: '⭐ Exceptionnel',
              CONVENTIONAL_LEAVE: '📋 Conventionnel',
              UNPAID_LEAVE: '💼 Sans solde',
              TRAINING: '📚 Formation',
            };

            leaveDays.forEach((day, index) => {
              // Vérifier si ce jour est dans la période affichée
              const isInPeriod = day >= periodStart && day <= periodEnd;
              if (isInPeriod) {
                // Déterminer si c'est le premier/dernier jour
                const isFirstDay = index === 0;
                const isLastDay = index === leaveDays.length - 1;

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

                calendarItems.push({
                  id: `leave-${leave.id}-${format(day, 'yyyy-MM-dd')}`,
                  originalTaskId: leave.id,
                  title: leaveTypeLabels[leave.type] || leave.type,
                  type: 'leave' as any,
                  startTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0),
                  endTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59),
                  userId: user.id,
                  projectId: undefined,
                  project: undefined,
                  priority: 'P3' as 'P0' | 'P1' | 'P2' | 'P3',
                  status: leave.status as any,
                  assignee: user,
                  color: '#4caf50', // Vert pour les congés
                  isRemote: false,
                  canMove: false,
                  canResize: false,
                  isSpanning: leaveDays.length > 1,
                  spanDay: index + 1,
                  totalSpanDays: leaveDays.length,
                  // Demi-journées
                  halfDayType,
                  description: leave.reason,
                });
              }
            });
          });

          // ✅ Pour chaque tâche individuelle, créer un CalendarItem
          periodTasks.forEach(task => {
            const isSimpleTask = (task as any).taskCategory === 'SIMPLE_TASK';
            const projectId = task.projectId;
            const project = projectId ? filteredProjects.find(p => p.id === projectId) : undefined;
            const isUnassigned = !projectId && !isSimpleTask;

            // Calculer les dates de la tâche individuelle
            const taskStart = task.startDate ? new Date(task.startDate as any) :
                             task.dueDate ? new Date(task.dueDate as any) : null;
            const taskEnd = task.dueDate ? new Date(task.dueDate as any) :
                           task.startDate ? new Date(task.startDate as any) : null;

            if (!taskStart || !taskEnd) return; // Skip si aucune date

            const totalDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
            const isMultiDay = totalDays > 1;

            // Calculer la progression de la tâche
            const progress = task.estimatedHours && task.loggedHours ?
              Math.min(100, Math.round((task.loggedHours / task.estimatedHours) * 100)) : 0;

            // Déterminer la couleur selon le type et le projet
            const getTaskColor = () => {
              if (isSimpleTask) return '#9c27b0'; // Violet pour tâches simples
              if (isUnassigned) return '#757575'; // Gris pour non assignées
              if (project) {
                // Couleur selon priorité/urgence du projet
                if (project.tags?.includes('urgent')) return '#f44336';
                if (project.priority === 'P0') return '#f44336'; // Rouge critique
                if (project.priority === 'P1') return '#ff9800'; // Orange important
                return '#2196f3'; // Bleu par défaut
              }
              return '#2196f3';
            };

            // Créer une CalendarItem par jour de la tâche
            if (isMultiDay) {
              const taskDays = eachDayOfInterval({ start: taskStart, end: taskEnd });
              const periodStart = viewMode === 'week' ? currentPeriod.start : monthDays[0];
              const periodEnd = viewMode === 'week' ? currentPeriod.end : monthDays[monthDays.length - 1];

              taskDays.forEach((day, index) => {
                // Vérifier si ce jour est dans la période affichée
                if (day >= periodStart && day <= periodEnd) {
                    // Extraire les heures de task.startTime et task.endTime si présents
                    const startHour = task.startTime ? parseInt(task.startTime.split(':')[0]) : 9;
                    const startMinute = task.startTime ? parseInt(task.startTime.split(':')[1]) : 0;
                    const endHour = task.endTime ? parseInt(task.endTime.split(':')[0]) : 17;
                    const endMinute = task.endTime ? parseInt(task.endTime.split(':')[1]) : 0;

                    calendarItems.push({
                      id: `${task.id}-${format(day, 'yyyy-MM-dd')}`,
                      originalTaskId: task.id,
                      title: task.title, // Titre de la TÂCHE, pas du projet!
                      type: isSimpleTask ? 'simple_task' : 'task',
                      startTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute),
                      endTime: new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute),
                      userId: user.id,
                      projectId: projectId,
                      project,
                      priority: task.priority as 'P0' | 'P1' | 'P2' | 'P3',
                      status: task.status as any,
                      assignee: user,
                      color: getTaskColor(),
                      isRemote: false,
                      canMove: true,
                      canResize: false,
                      isSpanning: true,
                      spanDay: index + 1,
                      totalSpanDays: totalDays,
                      // Nouvelles propriétés pour l'affichage enrichi
                      progress,
                      estimatedHours: task.estimatedHours,
                      daysRemaining: differenceInDays(taskEnd, new Date()),
                    });
                }
              });
            } else {
              // Tâche d'un seul jour
              const periodStart = viewMode === 'week' ? currentPeriod.start : monthDays[0];
              const periodEnd = viewMode === 'week' ? currentPeriod.end : monthDays[monthDays.length - 1];

              if (taskStart >= periodStart && taskStart <= periodEnd) {
                  // Extraire les heures de task.startTime et task.endTime si présents
                  const startHour = task.startTime ? parseInt(task.startTime.split(':')[0]) : 9;
                  const startMinute = task.startTime ? parseInt(task.startTime.split(':')[1]) : 0;
                  const endHour = task.endTime ? parseInt(task.endTime.split(':')[0]) : 17;
                  const endMinute = task.endTime ? parseInt(task.endTime.split(':')[1]) : 0;

                  calendarItems.push({
                    id: task.id,
                    originalTaskId: task.id,
                    title: task.title, // Titre de la TÂCHE
                    type: isSimpleTask ? 'simple_task' : 'task',
                    startTime: new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate(), startHour, startMinute),
                    endTime: new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate(), endHour, endMinute),
                    startTimeString: task.startTime, // String originale "09:00"
                    endTimeString: task.endTime, // String originale "17:00"
                    userId: user.id,
                    projectId: projectId,
                    project,
                    priority: task.priority as 'P0' | 'P1' | 'P2' | 'P3',
                    status: task.status as any,
                    assignee: user,
                    color: getTaskColor(),
                    isRemote: false,
                    canMove: true,
                    canResize: true,
                    isSpanning: false,
                    progress,
                    estimatedHours: task.estimatedHours,
                    daysRemaining: differenceInDays(taskEnd, new Date()),
                  });
                }
              }
          });

              // Calculer la capacité utilisateur
              const capacity = await capacityService.calculateUserCapacity(user.id, {
                startDate: viewMode === 'week' ? currentPeriod.start : date,
                endDate: viewMode === 'week' ? currentPeriod.end : date,
              });

              // isRemoteWork sera calculé par le useMemo
              const isRemoteWork = false; // Valeur temporaire

              // Calculer utilisation pour ce jour
              const totalAllocated = calendarItems.reduce((sum, item) => {
                return sum + differenceInHours(item.endTime, item.startTime);
              }, 0);

              // Calcul de charge supprimé
              const utilizationRate = 0;

              // ✅ Tri chronologique des tâches par heure de début
              calendarItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

              // ✅ Appliquer le filtre de vue (Tout/Disponibilités/Activités)
              const filteredItems = filterItemsByViewFilter(calendarItems, viewFilter);

              return {
                userId: user.id,
                user,
                date,
                capacity: 0,
                allocated: totalAllocated,
                items: filteredItems,
                isRemoteWork,
                utilizationRate,
                contract: await capacityService.getUserContract(user.id),
              } as UserWorkloadDay;

            } catch (error) {
              console.error(`Erreur pour utilisateur ${user.id} le ${format(date, 'dd/MM/yyyy')}:`, error);
              // isRemoteWork sera calculé par le useMemo même en cas d'erreur
              const isRemoteWork = false; // Valeur temporaire

              return {
                userId: user.id,
                user,
                date,
                capacity: viewMode === 'week' ? 35 : 8,
                allocated: 0,
                items: [],
                isRemoteWork,
                utilizationRate: 0,
                contract: null,
              } as UserWorkloadDay;
            }
          });
      }

      const workloadData = await Promise.all(workloadPromises.map(fn => fn()));

      // Détecter les conflits
      setRawWorkloadDays(workloadData);

    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Erreur lors du chargement des données du calendrier');
    } finally {
      setLoading(false);
    }
  }, [currentDate, currentPeriod, selectedProjects, selectedUsers, selectedServices, viewMode, viewFilter]);



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
        console.error('Item non trouvé:', itemId);
        return;
      }

      // Mise à jour optimiste de l'UI
      setRawWorkloadDays(prev => {
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
        console.error('Erreur lors de la sauvegarde:', error);
        // Rollback en cas d'erreur
        setRawWorkloadDays(previousState);
        // Optionnel: afficher une notification d'erreur
        alert('Erreur lors du déplacement de la tâche. Les modifications ont été annulées.');
      }
      
      // PAS de rechargement complet ! Les conflits seront recalculés au prochain chargement
    } catch (error) {
      console.error('Erreur lors du déplacement:', error);
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

  const handleCreateTask = useCallback((userId: string, date: Date, taskZone?: 'project' | 'simple') => {
    if (taskZone === 'simple') {
      // Ouvrir la modal de tâche simple
      setSimpleTaskModalData({
        userId,
        date,
      });
      setSimpleTaskModalOpen(true);
    } else {
      // Ouvrir la modal de tâche projet
      const defaultProject = selectedProjects.length > 0
        ? projects.find(p => selectedProjects.includes(p.id))
        : null;

      setTaskModalData({
        userId,
        date,
        projectId: defaultProject?.id || '',
        task: null,
      });
      setTaskModalOpen(true);
    }
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
      console.error('Erreur lors de la sauvegarde de la tâche:', error);
    }
  }, [taskModalData, loadCalendarData]);

  // ========================================
  // TELEWORK HANDLERS V2
  // ========================================

  const handleTeleworkModeChange = useCallback(async (userId: string, date: Date, mode: 'office' | 'remote') => {
    try {
      await teleworkSystem.requestOverride(userId, date, mode, 'Demande depuis planning');
      // Force refresh
      await teleworkSystem.refreshData();
    } catch (error) {
      console.error('❌ Erreur changement mode télétravail:', error);
      alert('Erreur lors de la déclaration de télétravail: ' + (error as Error).message);
    }
  }, [teleworkSystem]);

  const handleTeleworkProfileConfig = useCallback((userId: string) => {
    teleworkSystem.openProfileModal(userId);
  }, [teleworkSystem]);

  const handleTeleworkDetails = useCallback((userId: string, date: Date) => {
    teleworkSystem.openStatsModal(userId);
  }, [teleworkSystem]);

  const handleBulkTeleworkDeclaration = useCallback((userId: string, userDisplayName: string) => {
    setBulkTeleworkModalData({ userId, userDisplayName });
    setBulkTeleworkModalOpen(true);
  }, []);

  const handleBulkTeleworkSave = useCallback(async () => {
    // Rafraîchir les données télétravail
    await teleworkSystem.refreshData();
    setBulkTeleworkModalOpen(false);
  }, [teleworkSystem]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    const taskToDelete = selectedItem || workloadDays.flatMap(w => w.items).find(item => item.id === taskId);

    if (!taskToDelete) {
      console.error('Tâche à supprimer introuvable:', taskId);
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
        await simpleTaskService.delete(originalTaskId);
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
      console.error('Erreur lors de la suppression de la tâche:', error);
      alert('Erreur lors de la suppression de la tâche');
    }
  }, [loadCalendarData, selectedItem, workloadDays]);

  const handleEditTask = useCallback(async (calendarItem: CalendarItem) => {
    // Déterminer l'ID de la tâche originale (pour les tâches multi-jours)
    const taskId = calendarItem.originalTaskId || calendarItem.id;
    const isSimpleTask = calendarItem.type === 'simple_task';

    // Fermer la modal générique
    setSelectedItem(null);

    try {
      let task = null;

      if (isSimpleTask) {
        // Pour les tâches simples, utiliser simpleTaskService
        task = await simpleTaskService.getById(taskId);
      } else {
        // Pour les tâches de projet, utiliser taskService
        task = await taskService.getTask(taskId);
      }

      if (task) {

        // Convertir SimpleTask en Task si nécessaire
        let taskForModal = task;
        if (isSimpleTask && task) {
          const st = task as any;
          taskForModal = {
            id: st.id,
            title: st.title,
            description: st.description,
            projectId: '',
            taskCategory: 'SIMPLE_TASK',
            priority: st.priority,
            status: st.status,
            type: 'TASK',
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
          } as any;
        }

        setTaskModalData({
          userId: calendarItem.userId,
          date: calendarItem.startTime,
          projectId: calendarItem.projectId,
          task: taskForModal as any,
        });
        setTaskModalOpen(true);
      } else {
        console.error('Tâche non trouvée:', taskId);
        alert('Tâche non trouvée');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la tâche:', error);
      alert('Erreur lors du chargement de la tâche');
    }
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
          <Typography>Chargement du planning...</Typography>
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
        {/* ✅ Header compact unifié - UNE SEULE LIGNE COMPLETE */}
        <Card sx={{ mb: 1 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap">
              {/* Groupe gauche : Filtre services + Nouvelle Tâche + Réinitialiser */}
              {(onNewTask || !hideServicesFilter) && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  {!hideServicesFilter && (
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Services</InputLabel>
                      <Select
                        multiple
                        value={selectedServices}
                        onChange={(e) => onServicesChange?.(e.target.value as string[])}
                        label="Services"
                        renderValue={(selected) =>
                          selected.length === 0 ? 'Tous' : `${selected.length} service(s)`
                        }
                      >
                        <MenuItem key="encadrement" value="encadrement">
                          <Checkbox checked={selectedServices.includes('encadrement')} />
                          <ListItemText primary="Encadrement" primaryTypographyProps={{ fontWeight: 600 }} />
                        </MenuItem>
                        {(servicesFromProps || services).map((service) => (
                          <MenuItem key={service.id} value={service.id}>
                            <Checkbox checked={selectedServices.includes(service.id)} />
                            <ListItemText primary={service.name} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {onNewTask && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={onNewTask}
                      color="primary"
                      size="small"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Nouvelle Tâche
                    </Button>
                  )}

                  {!hideServicesFilter && selectedServices.length > 0 && onServicesChange && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => onServicesChange([])}
                    >
                      Réinitialiser
                    </Button>
                  )}
                </Stack>
              )}

              {/* Groupe centre : Navigation */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton size="small" onClick={handlePrevious}>
                  <ChevronLeftIcon />
                </IconButton>
                <Button variant="outlined" size="small" startIcon={<TodayIcon />} onClick={handleToday}>
                  Aujourd'hui
                </Button>
                <IconButton size="small" onClick={handleNext}>
                  <ChevronRightIcon />
                </IconButton>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ ml: 1, textTransform: 'capitalize' }}>
                  {getViewTitle()}
                </Typography>
              </Stack>

              {/* Groupe droite : Tous les autres contrôles */}
              <Stack direction="row" alignItems="center" spacing={1}>
                {/* Filtre affichage */}
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Affichage</InputLabel>
                  <Select
                    value={viewFilter}
                    onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
                    label="Affichage"
                  >
                    <MenuItem value="all">Tout</MenuItem>
                    <MenuItem value="availability">Disponibilités</MenuItem>
                    <MenuItem value="activity">Activités</MenuItem>
                  </Select>
                </FormControl>

                {/* Bouton déclaration congés */}
                {currentUser && permissionsService.canApproveLeaves(currentUser) && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="secondary"
                    onClick={() => setAdminLeaveModalOpen(true)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Déclarer congé
                  </Button>
                )}

                {/* Bouton télétravail */}
                {currentUser && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<HomeIcon />}
                    onClick={() => {
                      setBulkTeleworkModalData({
                        userId: currentUser.id,
                        userDisplayName: `${currentUser.firstName} ${currentUser.lastName}`
                      });
                      setBulkTeleworkModalOpen(true);
                    }}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Télétravail
                  </Button>
                )}

                {/* Sélecteur de vue */}
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  >
                    <MenuItem value="week">Semaine</MenuItem>
                    <MenuItem value="month">Mois</MenuItem>
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
            <CardContent sx={{ p: 0.5, py: 0.2 }}>
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
                  pb: 0
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {weekDays.map((day) => (
                      <Box
                        key={day.toISOString()}
                        sx={{
                          flex: 1,
                          minWidth: 160,
                          textAlign: 'center',
                          py: 0.2,
                          px: 0.5,
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
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Rendu conditionnel selon la vue */}
        {viewMode === 'week' ? (
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
                              viewFilter={viewFilter}
                              weekDays={weekDays}
                              departments={departments}
                              userContracts={userContracts}
                              currentUserId={auth.currentUser?.uid || ''}
                              teleworkSystem={teleworkSystem}
                              onItemMove={handleItemMove}
                              onItemClick={setSelectedItem}
                              onItemDrop={handleItemDrop}
                              onCreateTask={handleCreateTask}
                              onTeleworkModeChange={handleTeleworkModeChange}
                              onTeleworkProfileConfig={handleTeleworkProfileConfig}
                              onTeleworkDetails={handleTeleworkDetails}
                              onBulkTeleworkDeclaration={handleBulkTeleworkDeclaration}
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
                            viewFilter={viewFilter}
                            weekDays={weekDays}
                            departments={departments}
                            userContracts={userContracts}
                            currentUserId={auth.currentUser?.uid || ''}
                            teleworkSystem={teleworkSystem}
                            onItemMove={handleItemMove}
                            onItemClick={setSelectedItem}
                            onItemDrop={handleItemDrop}
                            onCreateTask={handleCreateTask}
                            onTeleworkModeChange={handleTeleworkModeChange}
                            onTeleworkProfileConfig={handleTeleworkProfileConfig}
                            onTeleworkDetails={handleTeleworkDetails}
                            onBulkTeleworkDeclaration={handleBulkTeleworkDeclaration}
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
          <MonthView
            monthDays={monthDays}
            workloadDaysByService={workloadDaysByService}
            departments={departments}
            services={services}
            expandedServices={expandedServices}
            onToggleService={toggleService}
            onItemClick={setSelectedItem}
            getUserDisplayName={getUserDisplayName}
            teleworkSystem={teleworkSystem}
            viewFilter={viewFilter}
          />
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

        {/* TaskModal pour créer/éditer des tâches projet */}
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

        {/* SimpleTaskModal pour créer des tâches simples */}
        <SimpleTaskModal
          open={simpleTaskModalOpen}
          onClose={() => {
            setSimpleTaskModalOpen(false);
            setSimpleTaskModalData({});
          }}
          onCreate={async (taskInput, userIds) => {
            // Créer la tâche simple pour le/les utilisateur(s)
            if (userIds.length === 1) {
              await simpleTaskService.create(taskInput, userIds[0], auth.currentUser?.uid || '');
            } else {
              await simpleTaskService.createMultiple(taskInput, userIds, auth.currentUser?.uid || '');
            }
            // Fermer la modal et recharger via une mise à jour de la clé
            setSimpleTaskModalOpen(false);
            setSimpleTaskModalData({});
            // Force re-render pour recharger les données
            window.location.reload();
          }}
          currentUserId={simpleTaskModalData.userId || auth.currentUser?.uid || ''}
        />

        {/* Modal de configuration profil télétravail */}
        <TeleworkProfileModal
          isOpen={teleworkSystem.modalState.isOpen && teleworkSystem.modalState.mode === 'profile'}
          userId={teleworkSystem.modalState.targetUserId || ''}
          currentProfile={teleworkSystem.modalState.data}
          onClose={teleworkSystem.closeModal}
          onSave={(profile) => {
            if (teleworkSystem.modalState.targetUserId) {
              teleworkSystem.updateProfile(teleworkSystem.modalState.targetUserId, profile);
            }
            teleworkSystem.closeModal();
          }}
        />

        {/* Modal de déclaration bulk télétravail */}
        <TeleworkBulkDeclarationModal
          open={bulkTeleworkModalOpen}
          userId={bulkTeleworkModalData.userId || ''}
          userDisplayName={bulkTeleworkModalData.userDisplayName || ''}
          currentUserProfile={null}
          onClose={() => setBulkTeleworkModalOpen(false)}
          onSave={handleBulkTeleworkSave}
        />

        {/* Modal de déclaration de congés admin */}
        {currentUser && (
          <AdminLeaveDeclarationModal
            open={adminLeaveModalOpen}
            currentUser={currentUser}
            onClose={() => setAdminLeaveModalOpen(false)}
            onSave={async () => {
              await loadCalendarData();
              setAdminLeaveModalOpen(false);
            }}
          />
        )}
      </Box>
    </DndProvider>
  );
};

export default PlanningCalendar;