import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Grid,
  LinearProgress,
  Chip,
  Avatar,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { Task } from '../../types';
import { taskService } from '../../services/task.service';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachWeekOfInterval,
  addWeeks,
  isWithinInterval,
  parseISO,
  addDays,
  differenceInDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';

interface ResourcePlanningProps {
  projectId: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  capacity: number; // heures par semaine
  avatar?: string;
  isActive: boolean;
}

interface ResourceTask extends Omit<Task, 'startDate' | 'dueDate'> {
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  actualHours?: number;
  efficiency: number; // 0-150%
}

interface WeeklyCapacity {
  week: Date;
  capacity: number;
  allocated: number;
  efficiency: number;
  tasks: ResourceTask[];
}

interface ResourceAllocation {
  memberId: string;
  memberName: string;
  role: string;
  weeklyCapacities: WeeklyCapacity[];
  totalCapacity: number;
  totalAllocated: number;
  averageEfficiency: number;
  overloadWeeks: number;
}

type ViewPeriod = '4weeks' | '8weeks' | '12weeks';

const ResourcePlanning: React.FC<ResourcePlanningProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<ResourceTask[]>([]);
  const [teamMembers] = useState<TeamMember[]>([
    {
      id: 'member-1',
      name: 'Alice Martin',
      role: 'Développeur Senior',
      skills: ['React', 'TypeScript', 'Node.js'],
      capacity: 35,
      isActive: true,
    },
    {
      id: 'member-2', 
      name: 'Bob Dupont',
      role: 'Designer UX/UI',
      skills: ['Figma', 'Adobe XD', 'Prototyping'],
      capacity: 30,
      isActive: true,
    },
    {
      id: 'member-3',
      name: 'Claire Bernard', 
      role: 'Chef de Projet',
      skills: ['Management', 'Scrum', 'Planification'],
      capacity: 40,
      isActive: true,
    },
    {
      id: 'member-4',
      name: 'David Wilson',
      role: 'Développeur Junior',
      skills: ['React', 'JavaScript', 'CSS'],
      capacity: 35,
      isActive: true,
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('8weeks');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const projectTasks = await taskService.getTasksByProject(projectId);
      
      const resourceTasks: ResourceTask[] = projectTasks.map(task => {
        const startDate = task.startDate ? parseISO(task.startDate.toString()) : new Date(task.createdAt);
        const endDate = task.dueDate ? parseISO(task.dueDate.toString()) : addDays(startDate, 7);
        const duration = differenceInDays(endDate, startDate) || 1;
        
        // Estimer les heures basé sur la priorité et la complexité
        let estimatedHours = 8; // Base
        if (task.priority === 'P0') estimatedHours = 16;
        else if (task.priority === 'P1') estimatedHours = 12;
        else if (task.priority === 'P2') estimatedHours = 8;
        else estimatedHours = 4;
        
        // Ajuster par durée
        estimatedHours = Math.max(estimatedHours, duration * 2);
        
        // Simuler l'efficacité (70-130%)
        const efficiency = 70 + Math.random() * 60;
        
        return {
          ...task,
          startDate,
          endDate,
          estimatedHours,
          actualHours: task.status === 'DONE' ? estimatedHours * (efficiency / 100) : undefined,
          efficiency,
        };
      });

      setTasks(resourceTasks);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const getWeeksPeriod = () => {
    const weeksCount = parseInt(viewPeriod.replace('weeks', ''));
    const startDate = startOfMonth(new Date());
    const endDate = addWeeks(startDate, weeksCount);
    return eachWeekOfInterval({ start: startDate, end: endDate });
  };

  const calculateResourceAllocations = (): ResourceAllocation[] => {
    const weeks = getWeeksPeriod();
    
    return teamMembers.filter(member => member.isActive).map(member => {
      const weeklyCapacities: WeeklyCapacity[] = weeks.map(week => {
        const weekEnd = addWeeks(week, 1);
        
        // Trouver les tâches assignées à ce membre pour cette semaine
        const memberTasks = tasks.filter(task => {
          // Simulation: assigner des tâches selon les compétences
          const isAssigned = assignTaskToMember(task, member);
          return isAssigned && isWithinInterval(week, { start: task.startDate, end: task.endDate });
        });
        
        const allocated = memberTasks.reduce((sum, task) => {
          const taskDuration = differenceInDays(task.endDate, task.startDate) || 1;
          const weeklyHours = task.estimatedHours / taskDuration * 7; // Répartition sur les jours
          return sum + Math.min(weeklyHours, member.capacity);
        }, 0);
        
        const efficiency = memberTasks.length > 0 
          ? memberTasks.reduce((sum, task) => sum + task.efficiency, 0) / memberTasks.length
          : 100;
        
        return {
          week,
          capacity: member.capacity,
          allocated,
          efficiency,
          tasks: memberTasks,
        };
      });
      
      const totalCapacity = weeklyCapacities.reduce((sum, wc) => sum + wc.capacity, 0);
      const totalAllocated = weeklyCapacities.reduce((sum, wc) => sum + wc.allocated, 0);
      const averageEfficiency = weeklyCapacities.length > 0
        ? weeklyCapacities.reduce((sum, wc) => sum + wc.efficiency, 0) / weeklyCapacities.length
        : 100;
      const overloadWeeks = weeklyCapacities.filter(wc => wc.allocated > wc.capacity).length;
      
      return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        weeklyCapacities,
        totalCapacity,
        totalAllocated,
        averageEfficiency,
        overloadWeeks,
      };
    });
  };

  const assignTaskToMember = (task: ResourceTask, member: TeamMember): boolean => {
    // Simulation d'assignation basée sur les compétences et la charge
    const skillMatch = member.skills.some(skill => 
      task.title.toLowerCase().includes(skill.toLowerCase()) ||
      task.description?.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Assigner selon le rôle
    if (member.role.includes('Chef') && task.priority === 'P0') return true;
    if (member.role.includes('Senior') && ['P0', 'P1'].includes(task.priority)) return true;
    if (member.role.includes('Designer') && (task.title.includes('UI') || task.title.includes('Design'))) return true;
    if (skillMatch) return true;
    
    // Assignation aléatoire pour simulation
    return Math.random() > 0.7;
  };

  const getCapacityColor = (allocated: number, capacity: number): string => {
    const ratio = allocated / capacity;
    if (ratio > 1.2) return '#f44336'; // Rouge - Surcharge critique
    if (ratio > 1.0) return '#ff9800'; // Orange - Surcharge
    if (ratio > 0.8) return '#ffc107'; // Jaune - Charge élevée
    if (ratio > 0.5) return '#4caf50'; // Vert - Charge normale
    return '#9e9e9e'; // Gris - Sous-utilisé
  };

  const getEfficiencyIcon = (efficiency: number) => {
    if (efficiency >= 100) return <TrendingUpIcon color="success" />;
    if (efficiency >= 80) return <CheckCircleIcon color="primary" />;
    return <WarningIcon color="warning" />;
  };

  const getTeamAnalytics = () => {
    const allocations = calculateResourceAllocations();
    
    const totalCapacity = allocations.reduce((sum, a) => sum + a.totalCapacity, 0);
    const totalAllocated = allocations.reduce((sum, a) => sum + a.totalAllocated, 0);
    const utilizationRate = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;
    
    const overloadedMembers = allocations.filter(a => a.overloadWeeks > 0).length;
    const underutilizedMembers = allocations.filter(a => 
      a.totalAllocated / a.totalCapacity < 0.6
    ).length;
    
    const averageEfficiency = allocations.length > 0
      ? allocations.reduce((sum, a) => sum + a.averageEfficiency, 0) / allocations.length
      : 100;
    
    return {
      totalCapacity,
      totalAllocated,
      utilizationRate,
      overloadedMembers,
      underutilizedMembers,
      averageEfficiency,
      totalMembers: allocations.length,
    };
  };

  const allocations = calculateResourceAllocations();
  const analytics = getTeamAnalytics();
  const weeks = getWeeksPeriod();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header avec contrôles */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              👥 Planification des Ressources
            </Typography>
            
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                size="small"
                startIcon={<AnalyticsIcon />}
                onClick={() => setShowAnalytics(true)}
                variant="outlined"
              >
                Analytics
              </Button>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Période</InputLabel>
                <Select
                  value={viewPeriod}
                  label="Période"
                  onChange={(e) => setViewPeriod(e.target.value as ViewPeriod)}
                >
                  <MenuItem value="4weeks">4 semaines</MenuItem>
                  <MenuItem value="8weeks">8 semaines</MenuItem>
                  <MenuItem value="12weeks">12 semaines</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>

          {/* Vue d'ensemble rapide */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {Math.round(analytics.utilizationRate)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Taux d'utilisation
                </Typography>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {analytics.totalMembers}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Membres actifs
                </Typography>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {analytics.overloadedMembers}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Membres surchargés
                </Typography>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main">
                  {Math.round(analytics.averageEfficiency)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Efficacité moyenne
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Planification par membre */}
      <Stack spacing={2}>
        {allocations.map((allocation) => (
          <Card 
            key={allocation.memberId}
            sx={{ 
              cursor: 'pointer',
              '&:hover': { boxShadow: 2 },
            }}
            onClick={() => setSelectedMember(allocation.memberId)}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{allocation.memberName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {allocation.role}
                    </Typography>
                  </Box>
                </Stack>
                
                <Stack direction="row" spacing={2} alignItems="center">
                  {getEfficiencyIcon(allocation.averageEfficiency)}
                  <Box textAlign="right">
                    <Typography variant="body2" fontWeight="bold">
                      {Math.round(allocation.totalAllocated)}h / {allocation.totalCapacity}h
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round((allocation.totalAllocated / allocation.totalCapacity) * 100)}% utilisé
                    </Typography>
                  </Box>
                  {allocation.overloadWeeks > 0 && (
                    <Chip 
                      size="small" 
                      label={`${allocation.overloadWeeks} semaines surchargées`}
                      color="error"
                    />
                  )}
                </Stack>
              </Stack>

              {/* Planification hebdomadaire */}
              <Box>
                <Typography variant="body2" gutterBottom fontWeight="bold">
                  Planification sur {weeks.length} semaines :
                </Typography>
                
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {allocation.weeklyCapacities.map((weekCapacity, index) => {
                    const utilizationRate = weekCapacity.allocated / weekCapacity.capacity;
                    const color = getCapacityColor(weekCapacity.allocated, weekCapacity.capacity);
                    
                    return (
                      <Box>
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="subtitle2">
                                Semaine du {format(weekCapacity.week, 'dd/MM', { locale: fr })}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Capacité: {weekCapacity.capacity}h
                              </Typography>
                              <Typography variant="caption" display="block">
                                Alloué: {Math.round(weekCapacity.allocated)}h
                              </Typography>
                              <Typography variant="caption" display="block">
                                Efficacité: {Math.round(weekCapacity.efficiency)}%
                              </Typography>
                              <Typography variant="caption" display="block">
                                Tâches: {weekCapacity.tasks.length}
                              </Typography>
                            </Box>
                          }
                        >
                          <Box>
                            <Typography variant="caption" display="block" textAlign="center">
                              {format(weekCapacity.week, 'dd/MM')}
                            </Typography>
                            <Box
                              sx={{
                                height: 20,
                                bgcolor: color,
                                borderRadius: 1,
                                opacity: utilizationRate > 1 ? 1 : 0.8,
                                position: 'relative',
                                border: utilizationRate > 1 ? 2 : 0,
                                borderColor: 'error.main',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  fontSize: '0.6rem',
                                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                }}
                              >
                                {Math.round(utilizationRate * 100)}%
                              </Typography>
                            </Box>
                          </Box>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Dialog Analytics */}
      <Dialog open={showAnalytics} onClose={() => setShowAnalytics(false)} maxWidth="md" fullWidth>
        <DialogTitle>📊 Analytics des Ressources</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom>Vue d'ensemble</Typography>
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Box textAlign="center" sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h4" color="primary">
                      {Math.round(analytics.totalCapacity)}h
                    </Typography>
                    <Typography variant="caption">Capacité totale</Typography>
                  </Box>
                </Box>
                <Box>
                  <Box textAlign="center" sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h4" color="success.main">
                      {Math.round(analytics.totalAllocated)}h
                    </Typography>
                    <Typography variant="caption">Heures allouées</Typography>
                  </Box>
                </Box>
                <Box>
                  <Box textAlign="center" sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h4" color="warning.main">
                      {analytics.overloadedMembers}
                    </Typography>
                    <Typography variant="caption">Membres surchargés</Typography>
                  </Box>
                </Box>
                <Box>
                  <Box textAlign="center" sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h4" color="info.main">
                      {analytics.underutilizedMembers}
                    </Typography>
                    <Typography variant="caption">Sous-utilisés</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>Recommandations</Typography>
              <Stack spacing={1}>
                {analytics.utilizationRate > 110 && (
                  <Alert severity="error">
                    🚨 Équipe surchargée à {Math.round(analytics.utilizationRate)}% - Risque de burnout
                  </Alert>
                )}
                {analytics.utilizationRate < 60 && (
                  <Alert severity="info">
                    💡 Équipe sous-utilisée à {Math.round(analytics.utilizationRate)}% - Capacité disponible
                  </Alert>
                )}
                {analytics.overloadedMembers > 0 && (
                  <Alert severity="warning">
                    ⚠️ {analytics.overloadedMembers} membre(s) en surcharge - Rééquilibrer les tâches
                  </Alert>
                )}
                {analytics.averageEfficiency < 80 && (
                  <Alert severity="warning">
                    📉 Efficacité moyenne de {Math.round(analytics.averageEfficiency)}% - Identifier les blocages
                  </Alert>
                )}
                {analytics.averageEfficiency > 110 && (
                  <Alert severity="success">
                    🎯 Excellente efficacité de {Math.round(analytics.averageEfficiency)}% - Équipe performante
                  </Alert>
                )}
              </Stack>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>Répartition des tâches</Typography>
              <Stack spacing={2}>
                {allocations.map(allocation => (
                  <Box 
                    key={allocation.memberId}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32 }}>
                        <PersonIcon />
                      </Avatar>
                      <Typography>{allocation.memberName}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min((allocation.totalAllocated / allocation.totalCapacity) * 100, 100)}
                        sx={{ width: 100, height: 8, borderRadius: 4 }}
                        color={
                          allocation.totalAllocated / allocation.totalCapacity > 1 ? 'error' :
                          allocation.totalAllocated / allocation.totalCapacity > 0.8 ? 'warning' : 'primary'
                        }
                      />
                      <Typography variant="body2" sx={{ minWidth: 60 }}>
                        {Math.round(allocation.totalAllocated)}h / {allocation.totalCapacity}h
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalytics(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog détail membre */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onClose={() => setSelectedMember(null)} maxWidth="lg" fullWidth>
          <DialogTitle>👤 Détail des ressources</DialogTitle>
          <DialogContent>
            {(() => {
              const allocation = allocations.find(a => a.memberId === selectedMember);
              const member = teamMembers.find(m => m.id === selectedMember);
              
              if (!allocation || !member) return null;
              
              return (
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" spacing={3} alignItems="center">
                      <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h5">{allocation.memberName}</Typography>
                        <Typography variant="h6" color="text.secondary">{allocation.role}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          {member.skills.map(skill => (
                            <Chip key={skill} label={skill} size="small" />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <Box>
                      <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="h4">{allocation.totalCapacity}h</Typography>
                        <Typography variant="caption">Capacité totale</Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="h4">{Math.round(allocation.totalAllocated)}h</Typography>
                        <Typography variant="caption">Heures allouées</Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="h4">{Math.round(allocation.averageEfficiency)}%</Typography>
                        <Typography variant="caption">Efficacité moyenne</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="h6" gutterBottom>Tâches assignées</Typography>
                    <Stack spacing={1}>
                      {allocation.weeklyCapacities.flatMap(wc => wc.tasks).map(task => (
                        <Box 
                          key={task.id}
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            p: 1,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        >
                          <Stack direction="row" spacing={2} alignItems="center">
                            <ScheduleIcon color="primary" />
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{task.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format(task.startDate, 'dd/MM')} - {format(task.endDate, 'dd/MM')}
                              </Typography>
                            </Box>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="small"
                              label={task.priority}
                              color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'}
                            />
                            <Typography variant="body2">{task.estimatedHours}h</Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedMember(null)}>Fermer</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Légende */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" gutterBottom fontWeight="bold">
          💡 Guide de lecture :
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: '#9e9e9e', borderRadius: '50%' }} />
              <Typography variant="caption">Sous-utilisé (&lt;50%)</Typography>
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: '#4caf50', borderRadius: '50%' }} />
              <Typography variant="caption">Optimal (50-80%)</Typography>
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: '#ffc107', borderRadius: '50%' }} />
              <Typography variant="caption">Chargé (80-100%)</Typography>
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: '#f44336', borderRadius: '50%' }} />
              <Typography variant="caption">Surchargé (&gt;100%)</Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ResourcePlanning;