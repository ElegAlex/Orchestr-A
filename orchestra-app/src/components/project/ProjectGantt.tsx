import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { Gantt, Task as GanttTask, ViewMode } from '@rsagiev/gantt-task-react-19';
import '@rsagiev/gantt-task-react-19/dist/index.css';
import './ProjectGantt.css';
import { Project, Task, Epic, Milestone, User } from '../../types';
import { taskService } from '../../services/task.service';
import { epicService } from '../../services/epic.service';
import { milestoneService } from '../../services/milestone.service';
import { userService } from '../../services/user.service';

interface ProjectGanttProps {
  project: Project;
  onRefresh: () => void;
}

interface GanttData {
  tasks: Task[];
  epics: Epic[];
  milestones: Milestone[];
  users: User[];
}

// ViewMode est maintenant importé de la librairie

const ProjectGantt: React.FC<ProjectGanttProps> = ({ project, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ganttData, setGanttData] = useState<GanttData>({
    tasks: [],
    epics: [],
    milestones: [],
    users: [],
  });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);

  useEffect(() => {
    loadGanttData();
  }, [project.id]);

  const loadGanttData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger toutes les données en parallèle
      const [tasks, epics, milestones, users] = await Promise.all([
        taskService.getTasksByProject(project.id),
        epicService.getProjectEpics(project.id),
        milestoneService.getProjectMilestones(project.id),
        userService.getAllUsers(),
      ]);

      setGanttData({
        tasks: tasks || [],
        epics: epics || [],
        milestones: milestones || [],
        users: users.filter(u => u.isActive),
      });
    } catch (err) {
      console.error('Erreur lors du chargement des données Gantt:', err);
      setError('Erreur lors du chargement des données du diagramme de Gantt');
    } finally {
      setLoading(false);
    }
  };

  // Génération de couleurs pour les responsables
  const getResponsibleColor = (responsibleId: string): string => {
    const colors = [
      '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336',
      '#00BCD4', '#8BC34A', '#FFC107', '#E91E63', '#607D8B',
      '#3F51B5', '#009688', '#CDDC39', '#FF5722', '#795548'
    ];
    
    // Générer un index basé sur l'ID pour avoir toujours la même couleur
    let hash = 0;
    for (let i = 0; i < responsibleId.length; i++) {
      hash = responsibleId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Couleurs basées sur les statuts pour les épics et jalons
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'upcoming': return '#2196F3';     // Bleu - À venir
      case 'in_progress': return '#FF9800';  // Orange - En cours
      case 'completed': return '#4CAF50';    // Vert - Terminé
      default: return '#9E9E9E';             // Gris - Non défini
    }
  };

  // Couleurs de fond plus claires pour les statuts avec meilleur contraste
  const getStatusBackgroundColor = (status: string): string => {
    switch (status) {
      case 'upcoming': return '#BBDEFB';     // Bleu plus foncé pour meilleur contraste
      case 'in_progress': return '#FFCC80';  // Orange plus foncé pour meilleur contraste  
      case 'completed': return '#C8E6C9';    // Vert plus foncé pour meilleur contraste
      default: return '#E0E0E0';             // Gris plus foncé
    }
  };

  // Couleurs de texte pour assurer la lisibilité
  const getStatusTextColor = (status: string): string => {
    switch (status) {
      case 'upcoming': return '#0D47A1';     // Bleu foncé sur fond bleu clair
      case 'in_progress': return '#E65100';  // Orange foncé sur fond orange clair
      case 'completed': return '#1B5E20';    // Vert foncé sur fond vert clair
      default: return '#424242';             // Gris foncé
    }
  };

  // Conversion des données Orchestra vers le format Gantt
  const ganttTasks = useMemo(() => {
    const tasks: GanttTask[] = [];
    

    // Ajouter les jalons en tant que tâches principales (du plus ancien au plus récent)
    ganttData.milestones
      .sort((a, b) => {
        const hasDateA = !!(a.startDate || a.dueDate);
        const hasDateB = !!(b.startDate || b.dueDate);
        
        // Si un a une date et l'autre non, celui avec date va en premier
        if (hasDateA && !hasDateB) return -1;
        if (!hasDateA && hasDateB) return 1;
        
        // Si les deux ont des dates, tri chronologique par startDate (ou dueDate si pas de startDate)
        if (hasDateA && hasDateB) {
          const dateA = new Date(a.startDate || a.dueDate!).getTime();
          const dateB = new Date(b.startDate || b.dueDate!).getTime();
          return dateA - dateB; // Plus anciens en premier
        }
        
        // Si aucun n'a de date, tri alphabétique
        return a.name.localeCompare(b.name);
      })
      .forEach((milestone) => {
        // Pour les jalons, utiliser startDate si disponible, sinon calculer depuis la date de création
        const startDate = milestone.startDate ? new Date(milestone.startDate) : 
                         milestone.createdAt ? new Date(milestone.createdAt) :
                         new Date();
        // La date de fin est la dueDate si disponible, sinon startDate + 30 jours
        let endDate = milestone.dueDate ? new Date(milestone.dueDate) : 
                       new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // Validation: s'assurer que la date de fin est postérieure à la date de début
        if (endDate <= startDate) {
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // +1 jour minimum
        }

        const milestoneStatusColor = getStatusColor(milestone.status);
        const milestoneBackgroundColor = getStatusBackgroundColor(milestone.status);
        const milestoneProgress = milestone.status === 'completed' ? 100 : 
                                 milestone.status === 'in_progress' ? 50 : 0;

        tasks.push({
          start: startDate,
          end: endDate,
          name: `🎯 ${milestone.name} (État: ${milestone.status === 'upcoming' ? 'À venir' : milestone.status === 'in_progress' ? 'En cours' : 'Terminé'})`,
          id: `milestone-${milestone.id}`,
          type: 'project',  // Utiliser 'project' au lieu de 'milestone' pour avoir une barre
          progress: milestoneProgress,
          isDisabled: false,
          styles: {
            progressColor: milestoneStatusColor,
            progressSelectedColor: milestoneStatusColor,
            backgroundColor: milestoneBackgroundColor,
            backgroundSelectedColor: `${milestoneStatusColor  }40` // Couleur avec transparence
          }
        });

        // Ajouter les épics liés au projet
        ganttData.epics
          .filter(epic => epic.projectId === project.id)
          .forEach((epic) => {
            const epicStart = epic.startDate ? new Date(epic.startDate) : new Date();
            let epicEnd = epic.dueDate ? new Date(epic.dueDate) : new Date(epicStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            // Validation: s'assurer que la date de fin est postérieure à la date de début
            if (epicEnd <= epicStart) {
              epicEnd = new Date(epicStart.getTime() + 24 * 60 * 60 * 1000); // +1 jour minimum
            }

            const epicStatusColor = getStatusColor(epic.status);
            const epicBackgroundColor = getStatusBackgroundColor(epic.status);
            const epicProgress = epic.status === 'completed' ? 100 : 
                               epic.status === 'in_progress' ? (epic.progress || 50) : 0;

            tasks.push({
              start: epicStart,
              end: epicEnd,
              name: `📝 ${epic.title} (État: ${epic.status === 'upcoming' ? 'À venir' : epic.status === 'in_progress' ? 'En cours' : 'Terminé'})`,
              id: `epic-${epic.id}`,
              type: 'task',
              progress: epicProgress,
              dependencies: [`milestone-${milestone.id}`],
              isDisabled: false,
              styles: {
                progressColor: epicStatusColor,
                progressSelectedColor: epicStatusColor,
                backgroundColor: epicBackgroundColor,
                backgroundSelectedColor: `${epicStatusColor  }40`
              }
            });

            // Ajouter les tâches de l'epic (triées par date)
            ganttData.tasks
              .filter(task => task.epicId === epic.id)
              .sort((a, b) => {
                const hasDateA = !!(a.startDate || a.dueDate || a.createdAt);
                const hasDateB = !!(b.startDate || b.dueDate || b.createdAt);
                
                // Si un a une date et l'autre non, celui avec date va en premier
                if (hasDateA && !hasDateB) return -1;
                if (!hasDateA && hasDateB) return 1;
                
                // Si les deux ont des dates, tri chronologique
                if (hasDateA && hasDateB) {
                  const dateA = (a.startDate ? new Date(a.startDate) : 
                               a.dueDate ? new Date(a.dueDate) : 
                               new Date(a.createdAt!)).getTime();
                  const dateB = (b.startDate ? new Date(b.startDate) : 
                               b.dueDate ? new Date(b.dueDate) : 
                               new Date(b.createdAt!)).getTime();
                  return dateA - dateB; // Plus anciens en premier
                }
                
                // Si aucun n'a de date, tri alphabétique
                return a.title.localeCompare(b.title);
              })
              .forEach((task) => {
                // Utiliser startDate pour le début, ou créatedAt, ou une date par défaut
                const taskStart = task.startDate ? new Date(task.startDate) : 
                                 task.createdAt ? new Date(task.createdAt) : 
                                 epicStart;
                // Utiliser dueDate pour la fin, ou startDate + durée estimée (en heures converties en jours), ou + 7 jours par défaut
                let taskEnd = task.dueDate ? new Date(task.dueDate) : 
                             new Date(taskStart.getTime() + ((task.estimatedHours ? task.estimatedHours / 8 : 7) * 24 * 60 * 60 * 1000));
                
                // Validation: s'assurer que la date de fin est postérieure à la date de début
                if (taskEnd <= taskStart) {
                  taskEnd = new Date(taskStart.getTime() + 24 * 60 * 60 * 1000); // +1 jour minimum
                }
                
                const responsible = task.responsible && task.responsible.length > 0
                  ? ganttData.users.find(u => u.id === task.responsible![0])
                  : null;
                
                console.log(`🔍 Task: ${task.title}`, {
                  responsible: responsible?.displayName || 'Aucun',
                  responsibleId: responsible?.id,
                  taskResponsible: task.responsible
                });
                
                const responsibleColor = responsible ? getResponsibleColor(responsible.id) : '#9e9e9e';
                const statusColor = task.status === 'DONE' ? '#4caf50' : 
                                  task.status === 'IN_PROGRESS' ? '#ff9800' : 
                                  task.status === 'BLOCKED' ? '#f44336' : responsibleColor;

                console.log(`🎨 Colors for ${task.title}:`, {
                  responsibleColor,
                  statusColor,
                  backgroundColor: `${responsibleColor}20`
                });

                tasks.push({
                  start: taskStart,
                  end: taskEnd,
                  name: `✅ ${task.title}${responsible ? ` • ${responsible.displayName}` : ' • Pas de responsable'}`,
                  id: `task-${task.id}`,
                  type: 'task',
                  progress: task.status === 'DONE' ? 100 : (task.status === 'IN_PROGRESS' ? 50 : 0),
                  dependencies: [`epic-${epic.id}`],
                  isDisabled: false,
                  styles: {
                    progressColor: statusColor,
                    progressSelectedColor: statusColor,
                    backgroundColor: responsibleColor, // Couleur de fond plus visible pour debug
                    backgroundSelectedColor: responsibleColor,
                  }
                });
              });
          });

        // Tâches directement liées au jalon (triées par date)
        ganttData.tasks
          .filter(task => task.milestoneId === milestone.id && !task.epicId)
          .sort((a, b) => {
            const hasDateA = !!(a.startDate || a.dueDate || a.createdAt);
            const hasDateB = !!(b.startDate || b.dueDate || b.createdAt);
            
            // Si un a une date et l'autre non, celui avec date va en premier
            if (hasDateA && !hasDateB) return -1;
            if (!hasDateA && hasDateB) return 1;
            
            // Si les deux ont des dates, tri chronologique
            if (hasDateA && hasDateB) {
              const dateA = (a.startDate ? new Date(a.startDate) : 
                           a.dueDate ? new Date(a.dueDate) : 
                           new Date(a.createdAt!)).getTime();
              const dateB = (b.startDate ? new Date(b.startDate) : 
                           b.dueDate ? new Date(b.dueDate) : 
                           new Date(b.createdAt!)).getTime();
              return dateA - dateB; // Plus anciens en premier
            }
            
            // Si aucun n'a de date, tri alphabétique
            return a.title.localeCompare(b.title);
          })
          .forEach((task) => {
            // Utiliser startDate pour le début, ou créatedAt, ou une date par défaut
            const taskStart = task.startDate ? new Date(task.startDate) : 
                             task.createdAt ? new Date(task.createdAt) : 
                             new Date();
            // Utiliser dueDate pour la fin, ou startDate + durée estimée (en heures converties en jours), ou + 7 jours par défaut
            let taskEnd = task.dueDate ? new Date(task.dueDate) : 
                           new Date(taskStart.getTime() + ((task.estimatedHours ? task.estimatedHours / 8 : 7) * 24 * 60 * 60 * 1000));
            
            // Validation: s'assurer que la date de fin est postérieure à la date de début
            if (taskEnd <= taskStart) {
              taskEnd = new Date(taskStart.getTime() + 24 * 60 * 60 * 1000); // +1 jour minimum
            }
            
            const responsible = task.responsible && task.responsible.length > 0
              ? ganttData.users.find(u => u.id === task.responsible![0])
              : null;
            
            const responsibleColor = responsible ? getResponsibleColor(responsible.id) : '#9e9e9e';
            const statusColor = task.status === 'DONE' ? '#4caf50' : 
                              task.status === 'IN_PROGRESS' ? '#ff9800' : 
                              task.status === 'BLOCKED' ? '#f44336' : responsibleColor;

            tasks.push({
              start: taskStart,
              end: taskEnd,
              name: `✅ ${task.title}${responsible ? ` • ${responsible.displayName}` : ''}`,
              id: `task-${task.id}`,
              type: 'task',
              progress: task.status === 'DONE' ? 100 : (task.status === 'IN_PROGRESS' ? 50 : 0),
              dependencies: [`milestone-${milestone.id}`],
              isDisabled: false,
              styles: {
                progressColor: statusColor,
                progressSelectedColor: statusColor,
                backgroundColor: `${responsibleColor}20`,
                backgroundSelectedColor: `${responsibleColor}40`,
              }
            });
          });
      });

    // Tâches orphelines (triées par date)
    ganttData.tasks
      .filter(task => !task.milestoneId && !task.epicId)
      .sort((a, b) => {
        const hasDateA = !!(a.startDate || a.dueDate || a.createdAt);
        const hasDateB = !!(b.startDate || b.dueDate || b.createdAt);
        
        // Si un a une date et l'autre non, celui avec date va en premier
        if (hasDateA && !hasDateB) return -1;
        if (!hasDateA && hasDateB) return 1;
        
        // Si les deux ont des dates, tri chronologique
        if (hasDateA && hasDateB) {
          const dateA = (a.startDate ? new Date(a.startDate) : 
                       a.dueDate ? new Date(a.dueDate) : 
                       new Date(a.createdAt!)).getTime();
          const dateB = (b.startDate ? new Date(b.startDate) : 
                       b.dueDate ? new Date(b.dueDate) : 
                       new Date(b.createdAt!)).getTime();
          return dateA - dateB; // Plus anciens en premier
        }
        
        // Si aucun n'a de date, tri alphabétique
        return a.title.localeCompare(b.title);
      })
      .forEach((task) => {
        // Utiliser startDate pour le début, ou créatedAt, ou une date par défaut
        const taskStart = task.startDate ? new Date(task.startDate) : 
                         task.createdAt ? new Date(task.createdAt) : 
                         new Date();
        // Utiliser dueDate pour la fin, ou startDate + durée estimée (en heures converties en jours), ou + 7 jours par défaut
        let taskEnd = task.dueDate ? new Date(task.dueDate) : 
                       new Date(taskStart.getTime() + ((task.estimatedHours ? task.estimatedHours / 8 : 7) * 24 * 60 * 60 * 1000));
        
        // Validation: s'assurer que la date de fin est postérieure à la date de début
        if (taskEnd <= taskStart) {
          taskEnd = new Date(taskStart.getTime() + 24 * 60 * 60 * 1000); // +1 jour minimum
        }
        
        const responsible = task.responsible && task.responsible.length > 0
          ? ganttData.users.find(u => u.id === task.responsible![0])
          : null;
        
        const responsibleColor = responsible ? getResponsibleColor(responsible.id) : '#9e9e9e';
        const statusColor = task.status === 'DONE' ? '#4caf50' : 
                          task.status === 'IN_PROGRESS' ? '#ff9800' : 
                          task.status === 'BLOCKED' ? '#f44336' : responsibleColor;

        tasks.push({
          start: taskStart,
          end: taskEnd,
          name: `📋 ${task.title}${responsible ? ` • ${responsible.displayName}` : ''}`,
          id: `orphan-task-${task.id}`,
          type: 'task',
          progress: task.status === 'DONE' ? 100 : (task.status === 'IN_PROGRESS' ? 50 : 0),
          isDisabled: false,
          styles: {
            progressColor: statusColor,
            progressSelectedColor: statusColor,
            backgroundColor: `${responsibleColor}20`,
            backgroundSelectedColor: `${responsibleColor}40`,
          }
        });
      });

    return tasks;
  }, [ganttData, project.id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Chargement du diagramme de Gantt...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  // Trier les jalons par date de départ (startDate)
  const sortedMilestones = [...ganttData.milestones].sort(
    (a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.dueDate ? new Date(a.dueDate).getTime() : 0);
      const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.dueDate ? new Date(b.dueDate).getTime() : 0);
      return dateA - dateB;
    }
  );

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Diagramme de Gantt - {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Planification et suivi temporel du projet (Version de démonstration)
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Vue</InputLabel>
            <Select
              value={viewMode}
              label="Vue"
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <MenuItem value={ViewMode.Day}>Jour</MenuItem>
              <MenuItem value={ViewMode.Week}>Semaine</MenuItem>
              <MenuItem value={ViewMode.Month}>Mois</MenuItem>
              <MenuItem value={ViewMode.Year}>Année</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="Actualiser les données">
            <IconButton onClick={loadGanttData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Diagramme de Gantt interactif */}
      <Paper 
        elevation={1} 
        sx={{ 
          p: 0,
          width: '100%',
          height: 'calc(100vh - 200px)', // Hauteur dynamique adaptative
          overflowX: 'auto',
          overflowY: 'hidden',
          minHeight: '500px', // Hauteur minimale
        }}
      >
        {ganttTasks.length > 0 ? (
          <Box 
            sx={{ 
              height: '100%', // Prend toute la hauteur du Paper
              minWidth: '1500px', // Force une largeur minimale importante
              width: 'max-content', // S'adapte au contenu
              overflowY: 'auto',
              overflowX: 'visible'
            }}
          >
            <Gantt 
              tasks={ganttTasks} 
              viewMode={viewMode}
              locale="fr-FR"
              columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 150 : 100}
              listCellWidth="250px"
              rowHeight={50}
              ganttHeight={0} // 0 = hauteur automatique
              barCornerRadius={3}
              handleWidth={8}
              fontFamily="Roboto, Arial, sans-serif"
              fontSize="14px"
              arrowColor="#999"
              arrowIndent={20}
              todayColor="rgba(252, 248, 227, 0.5)"
              TooltipContent={({ task, fontSize, fontFamily }) => {
                // Trouver les données de la tâche originale pour plus d'infos
                const taskId = task.id.replace(/^(milestone|epic|task|orphan-task)-/, '');
                const originalTask = ganttData.tasks.find(t => t.id === taskId);
                const responsible = originalTask?.responsible?.[0] 
                  ? ganttData.users.find(u => u.id === originalTask.responsible![0])
                  : null;
                
                return (
                  <div style={{ 
                    background: '#333', 
                    color: '#fff', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontSize, 
                    fontFamily,
                    maxWidth: '320px',
                    lineHeight: '1.4'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      {task.name.split(' • ')[0]} {/* Titre sans le responsable */}
                    </div>
                    
                    <div style={{ marginBottom: '6px' }}>
                      📅 <strong>Période:</strong> {task.start.toLocaleDateString('fr-FR')} → {task.end.toLocaleDateString('fr-FR')}
                    </div>
                    
                    <div style={{ marginBottom: '6px' }}>
                      ⏳ <strong>Progression:</strong> {task.progress}%
                    </div>
                    
                    {responsible && (
                      <div style={{ marginBottom: '6px' }}>
                        👤 <strong>Responsable:</strong> {responsible.displayName}
                      </div>
                    )}
                    
                    {originalTask?.status && (
                      <div style={{ 
                        marginTop: '8px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: originalTask.status === 'DONE' ? '#4caf50' :
                                   originalTask.status === 'IN_PROGRESS' ? '#ff9800' :
                                   originalTask.status === 'BLOCKED' ? '#f44336' : '#2196f3',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>
                        {originalTask.status === 'DONE' ? '✅ Terminé' :
                         originalTask.status === 'IN_PROGRESS' ? '🔄 En cours' :
                         originalTask.status === 'BLOCKED' ? '⛔ Bloqué' : '📋 À faire'}
                      </div>
                    )}
                  </div>
                );
              }}
              onDateChange={(task, children) => {
                console.log('Task date changed:', task, children);
              }}
              onProgressChange={(task, children) => {
                console.log('Task progress changed:', task, children);
              }}
              onDoubleClick={(task) => {
                console.log('Task double clicked:', task);
              }}
            />
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <TimelineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucune donnée à afficher
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Créez des jalons, épics et tâches pour voir le diagramme de Gantt.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectGantt;