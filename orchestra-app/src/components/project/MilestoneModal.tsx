import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Stack,
  IconButton,
  Alert,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Flag as MilestoneIcon,
} from '@mui/icons-material';
import { Milestone, MilestoneStatus, MilestoneType, User, Deliverable } from '../../types';
import { milestoneService } from '../../services/milestone.service';
import { userService } from '../../services/user.service';

interface MilestoneModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (milestone: Milestone) => void;
  projectId: string;
  milestone?: Milestone | null; // null pour création, Milestone pour édition
}

const MilestoneModal: React.FC<MilestoneModalProps> = ({
  open,
  onClose,
  onSave,
  projectId,
  milestone,
}) => {
  const [formData, setFormData] = useState<Partial<Milestone>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  
  // État pour les critères de succès
  const [newCriteria, setNewCriteria] = useState('');
  
  // État pour les livrables
  const [newDeliverable, setNewDeliverable] = useState('');

  // Chargement des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await userService.getAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    if (open) {
      loadUsers();
    }
  }, [open]);

  // Fonction utilitaire pour convertir les dates Firebase
  const convertFirebaseDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate(); // Timestamp Firebase
    if (typeof date === 'string') return new Date(date);
    return undefined;
  };

  // Réinitialisation du formulaire
  useEffect(() => {
    if (milestone) {
      setFormData({
        ...milestone,
        startDate: convertFirebaseDate(milestone.startDate),
        dueDate: convertFirebaseDate(milestone.dueDate),
      });
    } else {
      setFormData({
        projectId,
        code: '',
        name: '',
        description: '',
        type: 'delivery' as MilestoneType,
        status: 'upcoming' as MilestoneStatus, // Valeur par défaut pour la BDD, mais sera ignoré à l'affichage
        isKeyDate: false,
        deliverables: [],
        successCriteria: [],
        completionRate: 0,
        impact: 'medium',
      });
    }
    setErrors({});
  }, [milestone, projectId, open]);

  const handleChange = (field: keyof Milestone, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur si elle existe
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addSuccessCriteria = () => {
    if (newCriteria.trim()) {
      setFormData(prev => ({
        ...prev,
        successCriteria: [...(prev.successCriteria || []), newCriteria.trim()]
      }));
      setNewCriteria('');
    }
  };

  const removeSuccessCriteria = (index: number) => {
    setFormData(prev => ({
      ...prev,
      successCriteria: (prev.successCriteria || []).filter((_, i) => i !== index)
    }));
  };

  const addDeliverable = () => {
    if (newDeliverable.trim()) {
      const deliverable: Deliverable = {
        id: Date.now().toString(),
        name: newDeliverable.trim(),
        description: '',
        type: 'document',
        isRequired: true,
        status: 'pending',
        attachmentIds: [],
      };
      
      setFormData(prev => ({
        ...prev,
        deliverables: [...(prev.deliverables || []), deliverable]
      }));
      setNewDeliverable('');
    }
  };

  const removeDeliverable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      deliverables: (prev.deliverables || []).filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code?.trim()) {
      newErrors.code = 'Le code est obligatoire';
    }

    if (!formData.name?.trim()) {
      newErrors.name = 'Le nom est obligatoire';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'La description est obligatoire';
    }

    if (!formData.ownerId) {
      newErrors.ownerId = 'Le responsable est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      if (milestone) {
        // Mise à jour
        console.log('🏷️ MilestoneModal: Mise à jour du jalon', milestone.id, 'avec', formData);
        await milestoneService.updateMilestone(milestone.id, formData);
        const updatedMilestone = { ...milestone, ...formData } as Milestone;
        console.log('🏷️ MilestoneModal: Appel de onSave avec:', updatedMilestone);
        onSave(updatedMilestone);
      } else {
        // Création
        console.log('🏷️ MilestoneModal: Création du jalon avec', formData);
        const milestoneId = await milestoneService.createMilestone({
          ...formData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Milestone);

        const newMilestone = {
          ...formData,
          id: milestoneId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Milestone;
        console.log('🏷️ MilestoneModal: Appel de onSave avec:', newMilestone);
        onSave(newMilestone);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving milestone:', error);
      setErrors({ submit: 'Erreur lors de la sauvegarde' });
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: MilestoneType) => {
    const labels: Record<MilestoneType, string> = {
      delivery: 'Livraison',
      review: 'Revue de projet',
      decision: 'Point de décision',
      release: 'Release/Production',
      demo: 'Démonstration',
      checkpoint: 'Point de contrôle',
      deadline: 'Échéance contractuelle',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MilestoneIcon color="primary" />
            <Typography variant="h6">
              {milestone ? 'Modifier le jalon' : 'Nouveau jalon'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Informations de base */}
          <Box>
            <Typography variant="h6" gutterBottom>
              📝 Informations générales
            </Typography>
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Code du jalon *"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  error={!!errors.code}
                  helperText={errors.code || 'Ex: M1, M2, MILESTONE-001'}
                  placeholder="M1"
                />
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Nom du jalon *"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  placeholder="Livraison de la version 1.0"
                />
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Description *"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              error={!!errors.description}
              helperText={errors.description}
              multiline
              rows={3}
              sx={{ mt: 2 }}
              placeholder="Description détaillée du jalon et de ses objectifs"
            />
          </Box>

          <Divider />

          {/* Type et statut */}
          <Box>
            <Typography variant="h6" gutterBottom>
              🏷️ Classification
            </Typography>
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Type de jalon</InputLabel>
                  <Select
                    value={formData.type || 'delivery'}
                    onChange={(e) => handleChange('type', e.target.value)}
                    label="Type de jalon"
                  >
                    <MenuItem value="delivery">📦 {getTypeLabel('delivery')}</MenuItem>
                    <MenuItem value="review">🔍 {getTypeLabel('review')}</MenuItem>
                    <MenuItem value="decision">⚖️ {getTypeLabel('decision')}</MenuItem>
                    <MenuItem value="release">🚀 {getTypeLabel('release')}</MenuItem>
                    <MenuItem value="demo">🎯 {getTypeLabel('demo')}</MenuItem>
                    <MenuItem value="checkpoint">✅ {getTypeLabel('checkpoint')}</MenuItem>
                    <MenuItem value="deadline">⏰ {getTypeLabel('deadline')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>

            </Box>

            {/* Note informative sur le statut calculé automatiquement */}
            <Alert severity="info" sx={{ mb: 2 }}>
              ℹ️ Le statut du jalon est calculé automatiquement selon l'avancement des tâches liées :
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li><strong>À venir</strong> : Aucune tâche démarrée</li>
                <li><strong>En cours</strong> : Au moins une tâche en cours ou terminée</li>
                <li><strong>Terminé</strong> : Toutes les tâches terminées</li>
              </ul>
            </Alert>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isKeyDate || false}
                  onChange={(e) => handleChange('isKeyDate', e.target.checked)}
                />
              }
              label="🔒 Date clé (ne peut pas être déplacée)"
              sx={{ mt: 2 }}
            />
          </Box>

          <Divider />

          {/* Dates */}
          <Box>
            <Typography variant="h6" gutterBottom>
              📅 Planning
            </Typography>
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Date de début"
                  type="date"
                  value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Date d'échéance"
                  type="date"
                  value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleChange('dueDate', e.target.value ? new Date(e.target.value) : null)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Responsabilités */}
          <Box>
            <Typography variant="h6" gutterBottom>
              👥 Responsabilités
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Responsable du jalon *</InputLabel>
              <Select
                value={formData.ownerId || ''}
                onChange={(e) => handleChange('ownerId', e.target.value)}
                label="Responsable du jalon *"
                error={!!errors.ownerId}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.displayName} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {errors.ownerId && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                {errors.ownerId}
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Critères de succès */}
          <Box>
            <Typography variant="h6" gutterBottom>
              ✅ Critères de succès
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Nouveau critère"
                value={newCriteria}
                onChange={(e) => setNewCriteria(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSuccessCriteria()}
                placeholder="Ex: Toutes les fonctionnalités testées et validées"
              />
              <Button
                variant="outlined"
                onClick={addSuccessCriteria}
                disabled={!newCriteria.trim()}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                <AddIcon />
              </Button>
            </Box>

            <Stack spacing={1}>
              {(formData.successCriteria || []).map((criteria, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2">
                    ✓ {criteria}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => removeSuccessCriteria(index)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Livrables */}
          <Box>
            <Typography variant="h6" gutterBottom>
              📋 Livrables
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Nouveau livrable"
                value={newDeliverable}
                onChange={(e) => setNewDeliverable(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDeliverable()}
                placeholder="Ex: Documentation utilisateur"
              />
              <Button
                variant="outlined"
                onClick={addDeliverable}
                disabled={!newDeliverable.trim()}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                <AddIcon />
              </Button>
            </Box>

            <Stack spacing={1}>
              {(formData.deliverables || []).map((deliverable, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      📄 {deliverable.name}
                    </Typography>
                    <Chip
                      label={deliverable.status}
                      size="small"
                      color={deliverable.status === 'approved' ? 'success' : 'default'}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => removeDeliverable(index)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? undefined : <MilestoneIcon />}
        >
          {loading ? 'Enregistrement...' : (milestone ? 'Modifier' : 'Créer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MilestoneModal;