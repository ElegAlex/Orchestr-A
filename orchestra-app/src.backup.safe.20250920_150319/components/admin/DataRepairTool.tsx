import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Build as RepairIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface CorruptedTask {
  docId: string;
  data: any;
  issue: string;
  canRepair: boolean;
}

interface DiagnosticResults {
  validTasks: number;
  corruptedTasks: CorruptedTask[];
  totalTasks: number;
}

export const DataRepairTool: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResults | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [repairInProgress, setRepairInProgress] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState<string | null>(null);

  // Diagnostiquer les tâches corrompues
  const runDiagnostic = async () => {
    setLoading(true);
    try {
      
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const corruptedTasks: CorruptedTask[] = [];
      let validTasks = 0;

      tasksSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        
        const issues: string[] = [];
        let canRepair = true;

        // Vérifications
        if (!id || id.trim() === '' || id === 'undefined' || id === 'null') {
          issues.push('ID de document invalide');
        }
        
        if (!data.title || data.title.trim() === '') {
          issues.push('Titre manquant');
          canRepair = false; // Tâche irrécupérable
        }
        
        if (!data.projectId || data.projectId.trim() === '') {
          issues.push('Project ID manquant');
          canRepair = false; // Tâche irrécupérable
        }
        
        if (data.createdAt && !data.createdAt.toDate) {
          issues.push('Format de date incorrect');
        }
        
        if (!data.id || data.id !== id) {
          issues.push('ID interne incohérent');
        }

        if (issues.length > 0) {
          corruptedTasks.push({
            docId: id,
            data,
            issue: issues.join(', '),
            canRepair
          });
        } else {
          validTasks++;
        }
      });

      const results: DiagnosticResults = {
        validTasks,
        corruptedTasks,
        totalTasks: tasksSnapshot.docs.length
      };

      setDiagnostic(results);
      
    } catch (error) {
      
      alert('Erreur lors du diagnostic des données');
    } finally {
      setLoading(false);
    }
  };

  // Réparer les tâches corrompues
  const repairCorruptedTasks = async () => {
    if (!diagnostic || diagnostic.corruptedTasks.length === 0) return;

    setRepairInProgress(true);
    setShowConfirmDialog(false);
    
    try {
      
      const batch = writeBatch(db);
      let repaired = 0;
      let deleted = 0;

      for (const task of diagnostic.corruptedTasks) {
        if (!task.canRepair) {
          // Supprimer les tâches irrécupérables
          await deleteDoc(doc(db, 'tasks', task.docId));
          deleted++;
        } else {
          // Réparer la tâche
          const repairedData = {
            ...task.data,
            id: task.docId,
            updatedAt: new Date(),
            repairedAt: new Date(),
            originalIssue: task.issue
          };

          // Réparer les dates si nécessaire
          if (task.data.createdAt && !task.data.createdAt.toDate) {
            repairedData.createdAt = new Date(task.data.createdAt);
          }

          await setDoc(doc(db, 'tasks', task.docId), repairedData, { merge: true });
          repaired++;
        }
      }

      setLastRepairResult(`✅ Réparation terminée: ${repaired} tâches réparées, ${deleted} tâches supprimées`);
      
      // Relancer le diagnostic pour voir le résultat
      setTimeout(() => {
        runDiagnostic();
      }, 1000);
      
    } catch (error) {
      
      setLastRepairResult(`❌ Erreur lors de la réparation: ${error}`);
    } finally {
      setRepairInProgress(false);
    }
  };

  useEffect(() => {
    // Lancer un diagnostic automatique au montage
    runDiagnostic();
  }, []);

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <RepairIcon sx={{ mr: 1, color: 'warning.main' }} />
          <Typography variant="h6">
            Outil de Réparation des Données
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          Cet outil détecte et répare automatiquement les tâches corrompues dans la base de données.
        </Typography>

        {/* Boutons d'action */}
        <Box mb={3}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={runDiagnostic}
            disabled={loading || repairInProgress}
            sx={{ mr: 2 }}
          >
            Lancer Diagnostic
          </Button>
          
          {diagnostic && diagnostic.corruptedTasks.length > 0 && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<RepairIcon />}
              onClick={() => setShowConfirmDialog(true)}
              disabled={loading || repairInProgress}
            >
              Réparer Toutes ({diagnostic.corruptedTasks.length})
            </Button>
          )}
        </Box>

        {/* Barre de progression */}
        {(loading || repairInProgress) && (
          <Box mb={2}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {loading ? 'Diagnostic en cours...' : 'Réparation en cours...'}
            </Typography>
          </Box>
        )}

        {/* Résultats du diagnostic */}
        {diagnostic && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Résultats du Diagnostic
            </Typography>
            
            <Box display="flex" gap={2} mb={2}>
              <Chip 
                icon={<CheckIcon />} 
                label={`${diagnostic.validTasks} tâches valides`}
                color="success"
                variant="outlined"
              />
              <Chip 
                icon={<WarningIcon />} 
                label={`${diagnostic.corruptedTasks.length} tâches corrompues`}
                color={diagnostic.corruptedTasks.length > 0 ? 'warning' : 'success'}
                variant="outlined"
              />
              <Chip 
                label={`${diagnostic.totalTasks} total`}
                variant="outlined"
              />
            </Box>

            {diagnostic.corruptedTasks.length > 0 && (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {diagnostic.corruptedTasks.length} tâches corrompues détectées. 
                  Utilisez l'outil de réparation pour les corriger.
                </Alert>

                <Typography variant="subtitle1" gutterBottom>
                  Détail des Tâches Corrompues:
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID Document</TableCell>
                        <TableCell>Titre</TableCell>
                        <TableCell>Projet</TableCell>
                        <TableCell>Problème</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {diagnostic.corruptedTasks.map((task, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {task.docId || 'MANQUANT'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {task.data.title || <em>Titre manquant</em>}
                          </TableCell>
                          <TableCell>
                            {task.data.projectId || <em>Projet manquant</em>}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="warning.main">
                              {task.issue}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {task.canRepair ? (
                              <Chip icon={<RepairIcon />} label="Réparable" color="warning" size="small" />
                            ) : (
                              <Chip icon={<DeleteIcon />} label="À supprimer" color="error" size="small" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {diagnostic.corruptedTasks.length === 0 && (
              <Alert severity="success">
                🎉 Aucune tâche corrompue détectée ! Toutes les données sont valides.
              </Alert>
            )}
          </Box>
        )}

        {/* Résultat de la dernière réparation */}
        {lastRepairResult && (
          <Alert 
            severity={lastRepairResult.includes('✅') ? 'success' : 'error'} 
            sx={{ mt: 2 }}
            onClose={() => setLastRepairResult(null)}
          >
            {lastRepairResult}
          </Alert>
        )}

        {/* Dialog de confirmation */}
        <Dialog
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          maxWidth="md"
        >
          <DialogTitle>
            <Box display="flex" alignItems="center">
              <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
              Confirmer la Réparation
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography paragraph>
              Cette opération va :
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><RepairIcon color="warning" /></ListItemIcon>
                <ListItemText 
                  primary={`Réparer ${diagnostic?.corruptedTasks.filter(t => t.canRepair).length || 0} tâches récupérables`}
                  secondary="Correction des IDs manquants, dates invalides, etc."
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
                <ListItemText 
                  primary={`Supprimer ${diagnostic?.corruptedTasks.filter(t => !t.canRepair).length || 0} tâches irrécupérables`}
                  secondary="Tâches sans titre ou projet (données essentielles manquantes)"
                />
              </ListItem>
            </List>
            <Alert severity="warning" sx={{ mt: 2 }}>
              Cette action est irréversible. Assurez-vous d'avoir une sauvegarde récente.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={repairCorruptedTasks}
              variant="contained"
              color="warning"
              startIcon={<RepairIcon />}
            >
              Confirmer la Réparation
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};