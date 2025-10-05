import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { projectService } from '../../services/project.service';

const RecalculateAllProjects: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      console.log('🔄 Début du recalcul de tous les projets...');

      await projectService.recalculateAllProjectsProgress();

      setResult('✅ Tous les projets ont été recalculés avec succès !');
      console.log('✅ Recalcul terminé');

    } catch (err) {
      console.error('❌ Erreur:', err);
      setError('Erreur lors du recalcul des projets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        🔧 Recalculer la progression de tous les projets
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Cette action va recalculer la progression de tous les projets en excluant les sous-tâches.
        Les progress seront basés uniquement sur les tâches maîtres.
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <strong>Ce que fait cette action :</strong>
      </Typography>
      <List dense>
        <ListItem>
          <ListItemText
            primary="1. Récupère tous les projets"
            secondary="Charge la liste complète des projets depuis Firestore"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="2. Pour chaque projet, récupère ses tâches"
            secondary="Filtre uniquement les tâches maîtres (sans parentTaskId)"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="3. Calcule le nouveau progress"
            secondary="Basé sur les story points ou le nombre de tâches maîtres"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="4. Met à jour Firestore"
            secondary="Enregistre le nouveau progress dans la base de données"
          />
        </ListItem>
      </List>

      <Box sx={{ mt: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
          onClick={handleRecalculate}
          disabled={loading}
          size="large"
        >
          {loading ? 'Recalcul en cours...' : 'Lancer le recalcul'}
        </Button>
      </Box>

      {result && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {result}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      <Alert severity="warning" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Note :</strong> Ouvrez la console du navigateur (F12) pour voir les logs détaillés du recalcul.
          Vous verrez chaque tâche comptée et chaque sous-tâche ignorée.
        </Typography>
      </Alert>
    </Paper>
  );
};

export default RecalculateAllProjects;
