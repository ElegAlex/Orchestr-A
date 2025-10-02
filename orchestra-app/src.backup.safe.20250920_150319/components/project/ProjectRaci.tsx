import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  Person as PersonIcon,
  AccountBox as ResponsibleIcon,
  Verified as AccountableIcon,
  Forum as ConsultedIcon,
  Notifications as InformedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Project, Task, User } from '../../types';
import { taskService } from '../../services/task.service';
import { userService } from '../../services/user.service';

interface ProjectRaciProps {
  project: Project;
  onRefresh: () => void;
}

interface RaciEntry {
  taskId: string;
  taskTitle: string;
  taskCode?: string;
  responsible: string[];
  accountable: string[];
  consulted: string[];
  informed: string[];
}

const ProjectRaci: React.FC<ProjectRaciProps> = ({ project, onRefresh }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [raciMatrix, setRaciMatrix] = useState<RaciEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadRaciData();
  }, [project.id]);

  const loadRaciData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les tâches du projet
      const projectTasks = await taskService.getTasksByProject(project.id);
      setTasks(projectTasks);

      // Charger tous les utilisateurs
      const allUsers = await userService.getAllUsers();

      // Récupérer tous les IDs d'utilisateurs qui ont un rôle RACI sur les tâches
      const raciUserIds = new Set<string>();
      projectTasks.forEach(task => {
        [...(task.responsible || []), ...(task.accountable || []), ...(task.consulted || []), ...(task.informed || [])].forEach(id => raciUserIds.add(id));
        if (task.createdBy) raciUserIds.add(task.createdBy);
      });

      // Inclure les membres de l'équipe ET tous les utilisateurs avec un rôle RACI
      const teamUserIds = project.teamMembers.map(tm => tm.userId);
      const relevantUserIds = new Set([...teamUserIds, ...Array.from(raciUserIds)]);

      setUsers(allUsers.filter(u => u.isActive && relevantUserIds.has(u.id)));

      // Construire la matrice RACI directement depuis les champs des tâches
      const matrix: RaciEntry[] = projectTasks.map(task => ({
        taskId: task.id,
        taskTitle: task.title,
        taskCode: task.code,
        responsible: task.responsible || [],
        accountable: task.accountable || [],
        consulted: task.consulted || [],
        informed: task.informed || [],
      }));

      setRaciMatrix(matrix);
    } catch (err) {
      
      setError('Erreur lors du chargement des données RACI');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskRaci = async (taskId: string, role: 'responsible' | 'accountable' | 'consulted' | 'informed', userIds: string[]) => {
    try {
      setUpdating(taskId);
      
      // Mettre à jour la tâche avec les nouveaux assignations RACI
      const updateData = { [role]: userIds };
      await taskService.updateTask(taskId, updateData);
      
      // Mettre à jour l'état local
      setRaciMatrix(prev => 
        prev.map(entry => 
          entry.taskId === taskId 
            ? { ...entry, [role]: userIds }
            : entry
        )
      );

      // Optionnel : recharger les données pour s'assurer de la cohérence
      onRefresh();
      
    } catch (err) {
      
      setError('Erreur lors de la mise à jour des assignations RACI');
    } finally {
      setUpdating(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'responsible':
        return <ResponsibleIcon fontSize="small" color="primary" />;
      case 'accountable':
        return <AccountableIcon fontSize="small" color="error" />;
      case 'consulted':
        return <ConsultedIcon fontSize="small" color="warning" />;
      case 'informed':
        return <InformedIcon fontSize="small" color="info" />;
      default:
        return <PersonIcon fontSize="small" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'responsible': return 'primary';
      case 'accountable': return 'error';
      case 'consulted': return 'warning';
      case 'informed': return 'info';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Chargement de la matrice RACI...
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

  if (tasks.length === 0) {
    return (
      <Card sx={{ m: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Aucune tâche disponible
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez des tâches dans ce projet pour voir la matrice RACI.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            🏆 Matrice RACI - {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Attribution dynamique des responsabilités par tâche
          </Typography>
        </Box>
        <Tooltip title="Actualiser les données">
          <IconButton onClick={loadRaciData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Légende RACI */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Légende RACI
        </Typography>
        <Stack direction="row" spacing={3} flexWrap="wrap">
          <Chip 
            icon={<ResponsibleIcon />}
            label="Responsable (R) - Exécute la tâche"
            color="primary"
            variant="outlined"
          />
          <Chip 
            icon={<AccountableIcon />}
            label="Autorité (A) - Décision finale"
            color="error"
            variant="outlined"
          />
          <Chip 
            icon={<ConsultedIcon />}
            label="Consulté (C) - Expertise requise"
            color="warning"
            variant="outlined"
          />
          <Chip 
            icon={<InformedIcon />}
            label="Informé (I) - Tenu au courant"
            color="info"
            variant="outlined"
          />
        </Stack>
      </Paper>

      {/* Résumé par utilisateur - KPIs */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📊 Résumé par utilisateur
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          {users.map(user => {
            const userTasks = {
              responsible: raciMatrix.filter(entry => entry.responsible.includes(user.id)).length,
              accountable: raciMatrix.filter(entry => entry.accountable.includes(user.id)).length,
              consulted: raciMatrix.filter(entry => entry.consulted.includes(user.id)).length,
              informed: raciMatrix.filter(entry => entry.informed.includes(user.id)).length,
            };
            
            const totalTasks = Object.values(userTasks).reduce((a, b) => a + b, 0);
            
            if (totalTasks === 0) return null;
            
            return (
              <Card key={user.id} variant="outlined" sx={{ minWidth: 200 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {user.displayName}
                  </Typography>
                  <Stack spacing={0.5}>
                    {userTasks.responsible > 0 && (
                      <Chip size="small" color="primary" label={`${userTasks.responsible} Responsable`} />
                    )}
                    {userTasks.accountable > 0 && (
                      <Chip size="small" color="error" label={`${userTasks.accountable} Autorité`} />
                    )}
                    {userTasks.consulted > 0 && (
                      <Chip size="small" color="warning" label={`${userTasks.consulted} Consulté`} />
                    )}
                    {userTasks.informed > 0 && (
                      <Chip size="small" color="info" label={`${userTasks.informed} Informé`} />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Paper>

      {/* Matrice RACI avec menus déroulants */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Tâche</strong></TableCell>
              <TableCell width="20%">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ResponsibleIcon color="primary" />
                  <strong>Responsable (R)</strong>
                </Stack>
              </TableCell>
              <TableCell width="20%">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AccountableIcon color="error" />
                  <strong>Autorité (A)</strong>
                </Stack>
              </TableCell>
              <TableCell width="20%">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ConsultedIcon color="warning" />
                  <strong>Consulté (C)</strong>
                </Stack>
              </TableCell>
              <TableCell width="20%">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InformedIcon color="info" />
                  <strong>Informé (I)</strong>
                </Stack>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {raciMatrix.map((entry) => (
              <TableRow key={entry.taskId}>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TaskIcon color="action" />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {entry.taskTitle}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                
                {/* Responsables */}
                <TableCell>
                  <Autocomplete
                    multiple
                    size="small"
                    options={users}
                    getOptionLabel={(option) => option.displayName}
                    value={users.filter(u => entry.responsible.includes(u.id))}
                    onChange={(_, values) => 
                      updateTaskRaci(entry.taskId, 'responsible', values.map(v => v.id))
                    }
                    disabled={updating === entry.taskId}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Sélectionner..." variant="outlined" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="filled"
                          color="primary"
                          size="small"
                          label={option.displayName}
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </TableCell>

                {/* Autorités */}
                <TableCell>
                  <Autocomplete
                    multiple
                    size="small"
                    options={users}
                    getOptionLabel={(option) => option.displayName}
                    value={users.filter(u => entry.accountable.includes(u.id))}
                    onChange={(_, values) => 
                      updateTaskRaci(entry.taskId, 'accountable', values.map(v => v.id))
                    }
                    disabled={updating === entry.taskId}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Sélectionner..." variant="outlined" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="filled"
                          color="error"
                          size="small"
                          label={option.displayName}
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </TableCell>

                {/* Consultés */}
                <TableCell>
                  <Autocomplete
                    multiple
                    size="small"
                    options={users}
                    getOptionLabel={(option) => option.displayName}
                    value={users.filter(u => entry.consulted.includes(u.id))}
                    onChange={(_, values) => 
                      updateTaskRaci(entry.taskId, 'consulted', values.map(v => v.id))
                    }
                    disabled={updating === entry.taskId}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Sélectionner..." variant="outlined" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="filled"
                          color="warning"
                          size="small"
                          label={option.displayName}
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </TableCell>

                {/* Informés */}
                <TableCell>
                  <Autocomplete
                    multiple
                    size="small"
                    options={users}
                    getOptionLabel={(option) => option.displayName}
                    value={users.filter(u => entry.informed.includes(u.id))}
                    onChange={(_, values) => 
                      updateTaskRaci(entry.taskId, 'informed', values.map(v => v.id))
                    }
                    disabled={updating === entry.taskId}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Sélectionner..." variant="outlined" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="filled"
                          color="info"
                          size="small"
                          label={option.displayName}
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

    </Box>
  );
};

export default ProjectRaci;