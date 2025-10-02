import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  LinearProgress,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  RestartAlt as RollbackIcon
} from '@mui/icons-material';
import { teleworkMigrationService } from '../../services/telework-migration.service';

interface MigrationStatus {
  isComplete: boolean;
  oldDataCount: {
    days: number;
    patterns: number;
    exceptions: number;
  };
  newDataCount: {
    profiles: number;
    overrides: number;
    teamRules: number;
  };
}

export const TeleworkMigrationTool: React.FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [results, setResults] = useState<{
    success: boolean;
    migratedProfiles: number;
    migratedOverrides: number;
    errors: string[];
  } | null>(null);
  const [options, setOptions] = useState({
    dryRun: true,
    deleteOldData: false
  });
  const [confirmDialog, setConfirmDialog] = useState<'run' | 'rollback' | null>(null);

  // Charger le statut initial
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const migrationStatus = await teleworkMigrationService.checkMigrationStatus();
      setStatus(migrationStatus);
    } catch (error) {
      console.error('Erreur lors du chargement du statut:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunMigration = async () => {
    setConfirmDialog(null);
    setRunning(true);
    setProgress([]);
    setResults(null);

    try {
      const migrationResults = await teleworkMigrationService.runFullMigration({
        dryRun: options.dryRun,
        deleteOldData: options.deleteOldData,
        onProgress: (message) => {
          setProgress(prev => [...prev, message]);
        }
      });

      setResults(migrationResults);
      
      // Recharger le statut après migration
      if (!options.dryRun) {
        await loadStatus();
      }
    } catch (error) {
      console.error('Erreur lors de la migration:', error);
      setResults({
        success: false,
        migratedProfiles: 0,
        migratedOverrides: 0,
        errors: [`Erreur critique: ${error}`]
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRollback = async () => {
    setConfirmDialog(null);
    setRunning(true);
    setProgress(['Rollback en cours...']);

    try {
      await teleworkMigrationService.rollbackMigration();
      setProgress(prev => [...prev, 'Rollback terminé avec succès']);
      await loadStatus();
      setResults(null);
    } catch (error) {
      console.error('Erreur lors du rollback:', error);
      setProgress(prev => [...prev, `Erreur: ${error}`]);
    } finally {
      setRunning(false);
    }
  };

  const getTotalOldData = () => {
    if (!status) return 0;
    return status.oldDataCount.days + status.oldDataCount.patterns + status.oldDataCount.exceptions;
  };

  const getTotalNewData = () => {
    if (!status) return 0;
    return status.newDataCount.profiles + status.newDataCount.overrides + status.newDataCount.teamRules;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🔄 Migration Télétravail v1 → v2
        </Typography>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Statut actuel */}
        {status && (
          <Box sx={{ mb: 3 }}>
            <Alert 
              severity={status.isComplete ? 'success' : 'info'}
              icon={status.isComplete ? <CheckIcon /> : <InfoIcon />}
              sx={{ mb: 2 }}
            >
              {status.isComplete 
                ? 'Migration déjà effectuée' 
                : 'Migration non effectuée'}
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={2}><strong>Ancien système (v1)</strong></TableCell>
                    <TableCell colSpan={2}><strong>Nouveau système (v2)</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Jours télétravail</TableCell>
                    <TableCell align="right">
                      <Chip label={status.oldDataCount.days} size="small" />
                    </TableCell>
                    <TableCell>Profils utilisateur</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={status.newDataCount.profiles} 
                        size="small"
                        color={status.newDataCount.profiles > 0 ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Patterns récurrents</TableCell>
                    <TableCell align="right">
                      <Chip label={status.oldDataCount.patterns} size="small" />
                    </TableCell>
                    <TableCell>Overrides</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={status.newDataCount.overrides} 
                        size="small"
                        color={status.newDataCount.overrides > 0 ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Exceptions</TableCell>
                    <TableCell align="right">
                      <Chip label={status.oldDataCount.exceptions} size="small" />
                    </TableCell>
                    <TableCell>Règles équipe</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={status.newDataCount.teamRules} 
                        size="small"
                        color={status.newDataCount.teamRules > 0 ? 'info' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><strong>Total</strong></TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={getTotalOldData()} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell><strong>Total</strong></TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={getTotalNewData()} 
                        size="small" 
                        color="primary"
                        variant={getTotalNewData() > 0 ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Options de migration */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Options de migration
          </Typography>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.dryRun}
                  onChange={(e) => setOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
                  disabled={running}
                />
              }
              label="Mode test (dry run) - Simule sans modifier les données"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.deleteOldData}
                  onChange={(e) => setOptions(prev => ({ ...prev, deleteOldData: e.target.checked }))}
                  disabled={running || options.dryRun}
                />
              }
              label="Marquer les anciennes données comme migrées après succès"
            />
          </Stack>
        </Box>

        {/* Progress */}
        {progress.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Progression
            </Typography>
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
              <List dense>
                {progress.map((message, index) => (
                  <ListItem key={index}>
                    <ListItemText 
                      primary={message}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}

        {/* Résultats */}
        {results && (
          <Box sx={{ mb: 3 }}>
            <Alert 
              severity={results.success ? 'success' : 'error'}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                {results.success 
                  ? `Migration ${options.dryRun ? 'simulée' : 'réussie'}`
                  : 'Migration échouée'}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Chip 
                  label={`${results.migratedProfiles} profils`} 
                  size="small" 
                  color="success"
                />
                <Chip 
                  label={`${results.migratedOverrides} overrides`} 
                  size="small" 
                  color="success"
                />
              </Stack>
            </Alert>

            {results.errors.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  Erreurs rencontrées:
                </Typography>
                <List dense>
                  {results.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
          </Box>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<RunIcon />}
            onClick={() => setConfirmDialog('run')}
            disabled={running || loading}
            color={options.dryRun ? 'info' : 'primary'}
          >
            {options.dryRun ? 'Tester la migration' : 'Exécuter la migration'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadStatus}
            disabled={running || loading}
          >
            Actualiser
          </Button>

          {status?.isComplete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<RollbackIcon />}
              onClick={() => setConfirmDialog('rollback')}
              disabled={running || loading}
            >
              Rollback
            </Button>
          )}
        </Stack>

        {/* Dialog de confirmation */}
        <Dialog open={confirmDialog === 'run'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>
            Confirmer la migration
          </DialogTitle>
          <DialogContent>
            <Typography>
              Voulez-vous vraiment exécuter la migration ?
            </Typography>
            {!options.dryRun && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Cette opération va modifier les données de production.
                Assurez-vous d'avoir une sauvegarde récente.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)}>Annuler</Button>
            <Button onClick={handleRunMigration} variant="contained" color="primary">
              {options.dryRun ? 'Tester' : 'Migrer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog de rollback */}
        <Dialog open={confirmDialog === 'rollback'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>
            Confirmer le rollback
          </DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              Cette action va supprimer toutes les données migrées du nouveau système !
            </Alert>
            <Typography>
              Êtes-vous sûr de vouloir annuler la migration et revenir à l'ancien système ?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)}>Annuler</Button>
            <Button onClick={handleRollback} variant="contained" color="error">
              Rollback
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TeleworkMigrationTool;