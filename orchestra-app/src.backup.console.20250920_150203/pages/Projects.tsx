import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Avatar,
  AvatarGroup,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ProjectCreateModal } from '../components/project/ProjectCreateModal';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus, Priority, ProjectCategory } from '../types';
import { projectService } from '../services/project.service';
import ProjectImportDialog from '../components/project/ProjectImportDialog';
import { ImportResult } from '../services/import.service';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ProjectCategory | 'all'>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProjectId, setImportProjectId] = useState<string>('');
  const [importProjectName, setImportProjectName] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await projectService.getAllProjects();
      setProjects(projectsData);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = useCallback(() => {
    let filtered = [...projects];

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrage par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // Filtrage par catégorie
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(project => project.category === categoryFilter);
    }

    // Tri par date de clôture (dueDate) - les plus proches en premier
    filtered.sort((a, b) => {
      // Projets sans date de clôture à la fin
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      // Tri par date croissante (plus proche en premier)
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    setFilteredProjects(filtered);
  }, [projects, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [filterProjects]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleDeleteProject = async () => {
    if (selectedProject) {
      try {
        await projectService.deleteProject(selectedProject.id);
        setProjects(projects.filter(p => p.id !== selectedProject.id));
        setDeleteDialogOpen(false);
        handleMenuClose();
      } catch (error) {
        
      }
    }
  };

  const handleDuplicateProject = async () => {
    if (selectedProject) {
      try {
        const duplicated = await projectService.duplicateProject(
          selectedProject.id,
          `${selectedProject.name} (Copie)`
        );
        setProjects([duplicated, ...projects]);
        handleMenuClose();
      } catch (error) {
        
      }
    }
  };

  const handleArchiveProject = async () => {
    if (selectedProject) {
      try {
        await projectService.archiveProject(selectedProject.id);
        loadProjects(); // Recharger pour voir les changements
        handleMenuClose();
      } catch (error) {
        
      }
    }
  };

  const handleImportClick = (project: Project) => {
    setImportProjectId(project.id);
    setImportProjectName(project.name);
    setImportDialogOpen(true);
    handleMenuClose();
  };

  const handleImportSuccess = (result: ImportResult) => {
    console.log('Import réussi:', result);
    // Optionnellement recharger la liste des projets ou afficher une notification
    // loadProjects();
    setImportDialogOpen(false);
  };

  const getStatusColor = (status: ProjectStatus) => {
    const colors = {
      draft: 'default',
      planning: 'info',
      active: 'success',
      on_hold: 'warning',
      completed: 'primary',
      cancelled: 'error'
    };
    return colors[status] as any;
  };

  const getPriorityColor = (priority: Priority) => {
    const colors = {
      P0: 'error',
      P1: 'warning',
      P2: 'info',
      P3: 'default'
    };
    return colors[priority] as any;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  const getStatusLabel = (status: ProjectStatus) => {
    const labels = {
      draft: 'Brouillon',
      planning: 'Planification',
      active: 'En cours',
      on_hold: 'En pause',
      completed: 'Terminé',
      cancelled: 'Annulé'
    };
    return labels[status];
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Chargement des projets...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Projets</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateModalOpen(true)}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Nouveau Projet
        </Button>
      </Box>

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <Box>
              <TextField
                fullWidth
                placeholder="Rechercher un projet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={statusFilter}
                  label="Statut"
                  onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                >
                  <MenuItem value="all">Tous les statuts</MenuItem>
                  <MenuItem value="draft">Brouillon</MenuItem>
                  <MenuItem value="planning">Planification</MenuItem>
                  <MenuItem value="active">En cours</MenuItem>
                  <MenuItem value="on_hold">En pause</MenuItem>
                  <MenuItem value="completed">Terminé</MenuItem>
                  <MenuItem value="cancelled">Annulé</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Catégorie"
                  onChange={(e) => setCategoryFilter(e.target.value as ProjectCategory | 'all')}
                >
                  <MenuItem value="all">Toutes les catégories</MenuItem>
                  <MenuItem value="IT">IT</MenuItem>
                  <MenuItem value="HR">RH</MenuItem>
                  <MenuItem value="Finance">Finance</MenuItem>
                  <MenuItem value="Compliance">Conformité</MenuItem>
                  <MenuItem value="Other">Autre</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {filteredProjects.length} projet(s)
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Liste des projets */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            sx={{
              width: '100%',
              cursor: 'pointer',
              '&:hover': {
                boxShadow: (theme) => theme.shadows[8],
                transform: 'translateX(4px)',
                transition: 'all 0.3s ease-in-out'
              }
            }}
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Infos principales à gauche */}
                <Box sx={{ flex: '0 0 300px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {project.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.code}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={project.dueDate && new Date(project.dueDate) < new Date() ? 'error.main' : 'text.secondary'}
                        sx={{ fontWeight: 500, display: 'block', mt: 0.5 }}
                      >
                        Échéance: {project.dueDate ? formatDate(project.dueDate) : 'Non définie'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, project);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </Box>

                {/* Description au centre - largeur fixe */}
                <Box sx={{ flex: '0 0 350px', minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary" sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {project.description}
                  </Typography>
                </Box>

                {/* Statut et badges */}
                <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 1 }}>
                  <Chip
                    label={getStatusLabel(project.status)}
                    color={getStatusColor(project.status)}
                    size="small"
                  />
                  <Chip
                    label={project.priority}
                    color={getPriorityColor(project.priority)}
                    size="small"
                  />
                  <Chip
                    label={project.category}
                    variant="outlined"
                    size="small"
                  />
                </Box>

                {/* Progression */}
                <Box sx={{ flex: '0 0 150px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption">Progression</Typography>
                    <Typography variant="caption" fontWeight="bold">{project.progress}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={project.progress}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                {/* Équipe */}
                <Box sx={{ flex: '0 0 auto' }}>
                  <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.875rem' } }}>
                    {project.teamMembers && project.teamMembers.map((member) => (
                      <Avatar key={typeof member === 'string' ? member : member.userId}>
                        {(typeof member === 'string' ? member[0] : member.userId[0]).toUpperCase()}
                      </Avatar>
                    ))}
                  </AvatarGroup>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Message si aucun projet */}
      {filteredProjects.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Aucun projet trouvé
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateModalOpen(true)}
          >
            Créer un nouveau projet
          </Button>
        </Box>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedProject) navigate(`/projects/${selectedProject.id}`);
          handleMenuClose();
        }}>
          <ViewIcon fontSize="small" sx={{ mr: 1 }} />
          Voir détails
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedProject) navigate(`/projects/${selectedProject.id}/edit`);
          handleMenuClose();
        }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDuplicateProject}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Dupliquer
        </MenuItem>
        <MenuItem onClick={() => selectedProject && handleImportClick(selectedProject)}>
          <UploadIcon fontSize="small" sx={{ mr: 1 }} />
          Importer tâches/jalons
        </MenuItem>
        <MenuItem onClick={handleArchiveProject}>
          <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
          Archiver
        </MenuItem>
        <MenuItem 
          onClick={() => setDeleteDialogOpen(true)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer le projet "{selectedProject?.name}" ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleDeleteProject} color="error">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'import */}
      <ProjectImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        projectId={importProjectId}
        projectName={importProjectName}
        onImportSuccess={handleImportSuccess}
      />

      {/* Modal de création de projet */}
      <ProjectCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadProjects(); // Recharger la liste des projets
        }}
      />

      {/* FAB pour mobile */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' },
        }}
        onClick={() => setCreateModalOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};