import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
  Chip,
  Alert,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { Task, TaskType, TaskStatus, Priority, User, Project, RequiredSkill, Epic, Milestone } from '../../types';
import { taskService } from '../../services/task.service';
import { projectService } from '../../services/project.service';
import { userService } from '../../services/user.service';
import { epicService } from '../../services/epic.service';
import { milestoneService } from '../../services/milestone.service';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { SkillSelector } from '../skills/SkillSelector';

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  projectId?: string;
  dueDate?: Date;
  onSave: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}
export const TaskModalSimplified: React.FC<TaskModalProps> = ({
  open,
  onClose,
  task,
  projectId,
  dueDate,
  onSave,
  onDelete,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  // Form state simplifié
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'TASK' as TaskType,
    status: 'TODO' as TaskStatus,
    priority: 'P2' as Priority,
    projectId: projectId || '',
    responsible: [] as string[],
    accountable: [] as string[],
    consulted: [] as string[],
    informed: [] as string[],
    epicId: '',
    milestoneId: '',
    parentTaskId: '',
    storyPoints: 0,
    estimatedHours: 0,
    businessValue: 5,
    riskLevel: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    startDate: '',
    dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
    requiredSkills: [] as RequiredSkill[],
  });

  // Champ temps simplifié
  const [timeSpent, setTimeSpent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadProjects();
      loadUsers();
      if (formData.projectId) {
        loadEpicsAndMilestones(formData.projectId);
      }
      if (task) {
        populateForm(task);
      } else {
        resetForm();
      }
    }
  }, [open, task, projectId, dueDate]);

  useEffect(() => {
    if (formData.projectId && open) {
      loadEpicsAndMilestones(formData.projectId);
    }
  }, [formData.projectId, open]);

  const loadProjects = async () => {
    try {
      const projectsData = await projectService.getAllProjects();
      setProjects(projectsData);
    } catch (error) {
      
      setProjects([]);
    }
  };

  const loadUsers = async () => {
    try {
      const allUsers = await userService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      
      setUsers([]);
    }
  };

  const loadEpicsAndMilestones = async (projectId: string) => {
    try {
      const [epicsData, milestonesData] = await Promise.all([
        epicService.getProjectEpics(projectId),
        milestoneService.getProjectMilestones(projectId)
      ]);
      setEpics(epicsData);
      setMilestones(milestonesData);
    } catch (error) {
      
      setEpics([]);
      setMilestones([]);
    }
  };

  const populateForm = (taskData: Task) => {
    setFormData({
      title: taskData.title,
      description: taskData.description,
      type: taskData.type,
      status: taskData.status,
      priority: taskData.priority,
      projectId: taskData.projectId || '',
      responsible: taskData.responsible || [],
      accountable: taskData.accountable || [],
      consulted: taskData.consulted || [],
      informed: taskData.informed || [],
      epicId: taskData.epicId || '',
      milestoneId: taskData.milestoneId || '',
      parentTaskId: taskData.parentTaskId || '',
      storyPoints: taskData.storyPoints || 0,
      estimatedHours: taskData.estimatedHours || 0,
      businessValue: taskData.businessValue || 5,
      riskLevel: (taskData.riskLevel || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      startDate: taskData.startDate ? taskData.startDate.toISOString().split('T')[0] : '',
      dueDate: taskData.dueDate ? taskData.dueDate.toISOString().split('T')[0] : '',
      requiredSkills: taskData.requiredSkills || [],
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'TASK' as TaskType,
      status: 'TODO' as TaskStatus,
      priority: 'P2' as Priority,
      projectId: projectId || '',
      responsible: [],
      accountable: [],
      consulted: [],
      informed: [],
      epicId: '',
      milestoneId: '',
      parentTaskId: '',
      storyPoints: 0,
      estimatedHours: 0,
      businessValue: 5,
      riskLevel: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      startDate: '',
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
      requiredSkills: [],
    });
    setTimeSpent('');
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Le titre est requis';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'La description est requise';
    }
    if (!formData.projectId) {
      newErrors.projectId = 'Le projet est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const taskData: Task = {
        id: task?.id || '',
        code: task?.code || '',
        taskCategory: task?.taskCategory || 'PROJECT_TASK',
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        createdBy: task?.createdBy || user?.id || '',
        createdAt: task?.createdAt || new Date(),
        updatedAt: new Date(),
        dependencies: task?.dependencies || [],
        labels: task?.labels || [],
        attachments: task?.attachments || [],
        comments: task?.comments || [],
      };

      let savedTask: Task;
      if (task) {
        savedTask = await taskService.updateTask(task.id, taskData);
        
        // Ajouter le temps si spécifié
        if (timeSpent.trim()) {
          await taskService.addTimeSpent(savedTask.id, parseTimeSpent(timeSpent));
        }
      } else {
        savedTask = await taskService.createTask(taskData);
        
        // Ajouter le temps si spécifié
        if (timeSpent.trim()) {
          await taskService.addTimeSpent(savedTask.id, parseTimeSpent(timeSpent));
        }
      }

      onSave(savedTask);
      onClose();
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const parseTimeSpent = (timeStr: string): number => {
    // Parse format libre : "1h 30min", "45min", "2h", "1.5h", etc.
    let totalHours = 0;
    
    // Regex pour capturer heures et minutes
    const hourMatch = timeStr.match(/(\d+(?:\.\d+)?)h/i);
    const minMatch = timeStr.match(/(\d+)(?:min|m)/i);
    
    if (hourMatch) {
      totalHours += parseFloat(hourMatch[1]);
    }
    
    if (minMatch) {
      totalHours += parseFloat(minMatch[1]) / 60;
    }
    
    // Si aucun format reconnu, essayer de parser comme nombre d'heures
    if (totalHours === 0 && !isNaN(parseFloat(timeStr))) {
      totalHours = parseFloat(timeStr);
    }
    
    return Math.max(0, totalHours);
  };

  const getTypeIcon = (type: TaskType) => {
    const icons = {
      EPIC: '🎯',
      STORY: '📖',
      TASK: '✅',
      BUG: '🐛',
      SPIKE: '🔬',
    };
    return icons[type];
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {task ? `✏️ Modifier la tâche` : '➕ Nouvelle tâche'}
          </Typography>
          <Button onClick={onClose} color="inherit">
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2, height: 'calc(90vh - 200px)', overflowY: 'auto' }}>
        {/* Section Informations essentielles */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
            📝 Informations essentielles
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Titre"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              error={!!errors.title}
              helperText={errors.title}
              required
              variant="outlined"
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              error={!!errors.description}
              helperText={errors.description}
              required
              variant="outlined"
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 200, flex: 1 }}>
                <FormControl fullWidth required variant="outlined">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type}
                    label="Type"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TaskType })}
                  >
                    {(['EPIC', 'STORY', 'TASK', 'BUG', 'SPIKE'] as TaskType[]).map((type) => (
                      <MenuItem key={type} value={type}>
                        {getTypeIcon(type)} {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: 200, flex: 1 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={formData.status}
                    label="Statut"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                  >
                    {(['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as TaskStatus[]).map((status) => {
                      const statusLabels = {
                        'BACKLOG': 'Backlog',
                        'TODO': 'À faire',
                        'IN_PROGRESS': 'En cours',
                        'DONE': 'Terminé',
                        'BLOCKED': 'Bloqué'
                      };
                      return (
                        <MenuItem key={status} value={status}>
                          {statusLabels[status]}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: 200, flex: 1 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Priorité</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priorité"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                  >
                    <MenuItem value="P0">🔴 P0 - Critique</MenuItem>
                    <MenuItem value="P1">🟠 P1 - Haute</MenuItem>
                    <MenuItem value="P2">🔵 P2 - Moyenne</MenuItem>
                    <MenuItem value="P3">⚪ P3 - Basse</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 300, flex: 2 }}>
                <FormControl fullWidth required variant="outlined">
                  <InputLabel>Projet</InputLabel>
                  <Select
                    value={formData.projectId}
                    label="Projet"
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    error={!!errors.projectId}
                  >
                    {projects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: 150, flex: 1 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Story Points"
                  value={formData.storyPoints}
                  onChange={(e) => setFormData({ ...formData, storyPoints: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 21 }}
                  variant="outlined"
                />
              </Box>

              {/* Champ temps simplifié pour les tâches existantes */}
              {task && (
                <Box sx={{ minWidth: 200, flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Temps passé"
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(e.target.value)}
                    placeholder="1h 30min"
                    helperText="Format libre"
                    variant="outlined"
                    InputProps={{
                      startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Section Planning & Assignation */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
            📅 Planning & Assignation
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 200, flex: 1 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  variant="outlined"
                />
              </Box>

              <Box sx={{ minWidth: 200, flex: 1 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date d'échéance"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  variant="outlined"
                />
              </Box>

              <Box sx={{ minWidth: 200, flex: 1 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Epic (optionnel)</InputLabel>
                  <Select
                    value={formData.epicId || ''}
                    label="Epic (optionnel)"
                    onChange={(e) => setFormData({ ...formData, epicId: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Aucun Epic</em>
                    </MenuItem>
                    {epics.map((epic) => (
                      <MenuItem key={epic.id} value={epic.id}>
                        {epic.code} - {epic.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: 200, flex: 1 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Jalon (optionnel)</InputLabel>
                  <Select
                    value={formData.milestoneId || ''}
                    label="Jalon (optionnel)"
                    onChange={(e) => setFormData({ ...formData, milestoneId: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Aucun Jalon</em>
                    </MenuItem>
                    {milestones.map((milestone) => (
                      <MenuItem key={milestone.id} value={milestone.id}>
                        {milestone.code} - {milestone.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
              <Box sx={{ minWidth: 300, flex: 1 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => option.displayName}
                  value={users.filter(u => formData.responsible.includes(u.id))}
                  onChange={(_, values) => 
                    setFormData({ ...formData, responsible: values.map(v => v.id) })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="👤 Responsables (R)" placeholder="Sélectionner..." variant="outlined" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="filled"
                        color="primary"
                        label={option.displayName}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                />
              </Box>

              <Box sx={{ minWidth: 300, flex: 1 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => option.displayName}
                  value={users.filter(u => formData.accountable.includes(u.id))}
                  onChange={(_, values) => 
                    setFormData({ ...formData, accountable: values.map(v => v.id) })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="🎯 Décisionnaire (A)" placeholder="Sélectionner..." variant="outlined" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="filled"
                        color="error"
                        label={option.displayName}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 300, flex: 1 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => option.displayName}
                  value={users.filter(u => formData.consulted.includes(u.id))}
                  onChange={(_, values) => 
                    setFormData({ ...formData, consulted: values.map(v => v.id) })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="💬 Consultés (C)" placeholder="Sélectionner..." variant="outlined" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="filled"
                        color="info"
                        label={option.displayName}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                />
              </Box>

              <Box sx={{ minWidth: 300, flex: 1 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => option.displayName}
                  value={users.filter(u => formData.informed.includes(u.id))}
                  onChange={(_, values) => 
                    setFormData({ ...formData, informed: values.map(v => v.id) })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="📢 Informés (I)" placeholder="Sélectionner..." variant="outlined" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="filled"
                        color="warning"
                        label={option.displayName}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                />
              </Box>
            </Box>

            <SkillSelector
              value={formData.requiredSkills}
              onChange={(skills) => setFormData({ ...formData, requiredSkills: skills })}
              availablePeople={users.map(user => ({
                id: user.id,
                name: user.displayName,
                skills: user.skills?.map(skill => ({
                  name: typeof skill === 'string' ? skill : skill.name,
                  level: typeof skill === 'string' ? (Math.floor(Math.random() * 3) + 1 as 1 | 2 | 3) : skill.level
                })) || []
              }))}
            />
          </Box>
        </Box>

        {/* Sections Commentaires & Fichiers pour les tâches existantes */}
        {task && (
          <>
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {/* Section Commentaires */}
              <Card sx={{ flex: 1, minWidth: 400 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
                    💬 Commentaires
                  </Typography>
                  <TaskComments
                    taskId={task.id}
                    currentUserId={user?.id || ''}
                  />
                </CardContent>
              </Card>

              {/* Section Fichiers */}
              <Card sx={{ flex: 1, minWidth: 400 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
                    📎 Fichiers
                  </Typography>
                  <TaskAttachments
                    taskId={task.id}
                    currentUserId={user?.id || ''}
                  />
                </CardContent>
              </Card>
            </Box>
          </>
        )}

        {/* Message d'info */}
        {!task && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              ℹ️ Interface simplifiée - Les commentaires et fichiers seront disponibles après création de la tâche
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        {task && onDelete && (
          <Button 
            color="error" 
            onClick={() => {
              if (task.id && task.id.trim() !== '') {
                onDelete(task.id);
              } else {
                
                alert('Erreur: Cette tâche ne peut pas être supprimée (ID manquant)');
              }
            }}
            disabled={loading}
          >
            Supprimer
          </Button>
        )}
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Sauvegarde...' : (task ? 'Modifier' : 'Créer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};