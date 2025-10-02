import React, { useState } from 'react';
import {
  Button,
  Alert,
  Box,
  Typography,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import BuildIcon from '@mui/icons-material/Build';

const FixTaskIds: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fixEmptyTaskIds = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Récupérer toutes les tâches
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));

      const tasksToFix: any[] = [];
      const duplicateCodes = new Map<string, string[]>();

      // Identifier les tâches problématiques
      tasksSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;

        // Vérifier les tâches avec des problèmes
        if (!data.id || data.id === '' || data.id !== docId) {
          tasksToFix.push({
            docId,
            data,
            problem: !data.id ? 'no_id' : (data.id === '' ? 'empty_id' : 'mismatch_id')
          });
        }

        // Tracker les codes dupliqués
        if (data.code) {
          if (!duplicateCodes.has(data.code)) {
            duplicateCodes.set(data.code, []);
          }
          const existing = duplicateCodes.get(data.code) || [];
          duplicateCodes.set(data.code, [...existing, docId]);
        }
      });

      // Corriger les tâches si nécessaire
      if (tasksToFix.length > 0) {
        const batch = writeBatch(db);

        for (const task of tasksToFix) {
          const taskRef = doc(db, 'tasks', task.docId);
          batch.update(taskRef, {
            id: task.docId,
            updatedAt: new Date()
          });
        }

        await batch.commit();
      }

      // Préparer le résultat
      const duplicates = Array.from(duplicateCodes.entries()).filter(([code, ids]) => ids.length > 1);

      setResult({
        totalTasks: tasksSnapshot.size,
        fixedTasks: tasksToFix,
        duplicateCodes: duplicates
      });

    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BuildIcon color="warning" />
        Réparation des IDs de tâches
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        Cet outil corrige les tâches qui ont été créées sans ID ou avec un ID incorrect.
      </Typography>

      {!result && (
        <Button
          variant="contained"
          color="warning"
          onClick={fixEmptyTaskIds}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <BuildIcon />}
        >
          {loading ? 'Correction en cours...' : 'Lancer la correction'}
        </Button>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity={result.fixedTasks.length > 0 ? "success" : "info"}
            sx={{ mb: 2 }}
          >
            {result.fixedTasks.length > 0
              ? `✅ ${result.fixedTasks.length} tâches corrigées avec succès!`
              : '✅ Toutes les tâches ont des IDs corrects!'
            }
          </Alert>

          {result.fixedTasks.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Tâches corrigées:
              </Typography>
              <List dense>
                {result.fixedTasks.map((task: any) => (
                  <ListItem key={task.docId}>
                    <ListItemText
                      primary={task.data.title || task.data.code || 'Sans titre'}
                      secondary={`Problème: ${task.problem} | ID corrigé: ${task.docId}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {result.duplicateCodes.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              ⚠️ Codes de tâches dupliqués détectés:
              <List dense>
                {result.duplicateCodes.map(([code, ids]: [string, string[]]) => (
                  <ListItem key={code}>
                    <ListItemText
                      primary={`Code "${code}"`}
                      secondary={`Utilisé ${ids.length} fois`}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          <Button
            variant="outlined"
            onClick={() => {
              setResult(null);
              window.location.reload();
            }}
            sx={{ mt: 2 }}
          >
            Rafraîchir la page
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default FixTaskIds;