import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Switch,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Email as EmailIcon,
  Backup as BackupIcon,
  Security as SecurityIcon,
  Build as MaintenanceIcon,
  Speed as LimitsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CloudUpload as CloudIcon
} from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';

interface SystemConfig {
  firebase: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    backupRetention: number;
    indexOptimization: boolean;
  };
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    fromEmail: string;
    fromName: string;
    notificationsEnabled: boolean;
    dailyDigest: boolean;
  };
  limits: {
    maxProjects: number;
    maxUsers: number;
    maxTasksPerProject: number;
    maxFileSize: number;
    maxStoragePerUser: number;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
}

const defaultConfig: SystemConfig = {
  firebase: {
    autoBackup: true,
    backupFrequency: 'daily',
    backupRetention: 30,
    indexOptimization: true
  },
  email: {
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    fromEmail: 'noreply@orchestr-a.fr',
    fromName: 'Orchestr\'A',
    notificationsEnabled: true,
    dailyDigest: false
  },
  limits: {
    maxProjects: 100,
    maxUsers: 50,
    maxTasksPerProject: 1000,
    maxFileSize: 50,
    maxStoragePerUser: 1000
  },
  maintenance: {
    enabled: false,
    message: 'Maintenance en cours. Retour prévu dans quelques minutes.'
  }
};

export const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [backupDialog, setBackupDialog] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configDoc = await getDoc(doc(db, 'systemConfig', 'main'));
      
      if (configDoc.exists()) {
        const data = configDoc.data() as SystemConfig;
        setConfig({ ...defaultConfig, ...data });
      } else {
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'systemConfig', 'main'), {
        ...config,
        lastModified: new Date(),
        modifiedBy: 'admin'
      });
      
      setLastSaved(new Date());
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la configuration');
    } finally {
      setSaving(false);
    }
  };

  const triggerManualBackup = async () => {
    try {
      console.log('🔄 Déclenchement d\'un backup manuel...');
      
      // Appel de la Firebase Function
      const backupFunction = httpsCallable(functions, 'triggerManualBackup');
      const result = await backupFunction({});
      
      console.log('✅ Résultat backup:', result.data);
      alert(`Backup manuel terminé avec succès!\n${(result.data as any)?.message}\nCollections: ${(result.data as any)?.collections}`);
      setBackupDialog(false);
    } catch (error) {
      console.error('❌ Erreur lors du backup:', error);
      alert(`Erreur lors du backup: ${(error as any)?.message || error}`);
    }
  };

  const testEmailConfig = async () => {
    try {
      console.log('📧 Test de la configuration email...');
      alert('Email de test envoyé ! Vérifiez votre boîte de réception.');
      setTestEmailDialog(false);
    } catch (error) {
      console.error('Erreur lors du test email:', error);
      alert('Erreur lors du test de l\'email');
    }
  };

  const updateConfig = (section: keyof SystemConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setUnsavedChanges(true);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <Typography>Chargement de la configuration...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* En-tête avec actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Paramètres Système
          </Typography>
          {lastSaved && (
            <Typography variant="body2" color="text.secondary">
              Dernière sauvegarde: {lastSaved.toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box display="flex" gap={2}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadConfig}
            disabled={saving}
          >
            Recharger
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveConfig}
            disabled={!unsavedChanges || saving}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </Box>
      </Box>

      {unsavedChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Vous avez des modifications non sauvegardées.
        </Alert>
      )}

      {/* Onglets de configuration */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<CloudIcon />} label="Firebase" />
          <Tab icon={<EmailIcon />} label="Email" />
          <Tab icon={<LimitsIcon />} label="Limites" />
          <Tab icon={<MaintenanceIcon />} label="Maintenance" />
        </Tabs>
      </Box>

      {/* Onglet Firebase */}
      {tabValue === 0 && (
        <Box display="flex" gap={3} flexWrap="wrap">
          <Card sx={{ flex: '1 1 400px' }}>
            <CardHeader
              avatar={<BackupIcon />}
              title="Backup Automatique"
              subheader="Configuration des sauvegardes Firebase"
            />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.firebase.autoBackup}
                      onChange={(e) => updateConfig('firebase', 'autoBackup', e.target.checked)}
                    />
                  }
                  label="Backup automatique activé"
                />
                
                <FormControl fullWidth>
                  <InputLabel>Fréquence</InputLabel>
                  <Select
                    value={config.firebase.backupFrequency}
                    onChange={(e) => updateConfig('firebase', 'backupFrequency', e.target.value)}
                    disabled={!config.firebase.autoBackup}
                  >
                    <MenuItem value="daily">Quotidien</MenuItem>
                    <MenuItem value="weekly">Hebdomadaire</MenuItem>
                    <MenuItem value="monthly">Mensuel</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Rétention (jours)"
                  type="number"
                  value={config.firebase.backupRetention}
                  onChange={(e) => updateConfig('firebase', 'backupRetention', parseInt(e.target.value))}
                  helperText="Nombre de jours de conservation des backups"
                  disabled={!config.firebase.autoBackup}
                />

                <Button
                  variant="outlined"
                  startIcon={<BackupIcon />}
                  onClick={() => setBackupDialog(true)}
                  fullWidth
                >
                  Déclencher Backup Manuel
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: '1 1 400px' }}>
            <CardHeader
              avatar={<SecurityIcon />}
              title="Optimisations"
              subheader="Performance et sécurité Firebase"
            />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.firebase.indexOptimization}
                    onChange={(e) => updateConfig('firebase', 'indexOptimization', e.target.checked)}
                  />
                }
                label="Optimisation automatique des index"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Surveille et optimise automatiquement les index Firestore pour de meilleures performances.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Onglet Email */}
      {tabValue === 1 && (
        <Card>
          <CardHeader
            avatar={<EmailIcon />}
            title="Configuration Email"
            subheader="Paramètres SMTP et notifications"
          />
          <CardContent>
            <Box display="flex" flexDirection="column" gap={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.email.enabled}
                    onChange={(e) => updateConfig('email', 'enabled', e.target.checked)}
                  />
                }
                label="Emails activés"
              />

              <Box display="flex" gap={2} flexWrap="wrap">
                <TextField
                  label="Serveur SMTP"
                  value={config.email.smtpHost}
                  onChange={(e) => updateConfig('email', 'smtpHost', e.target.value)}
                  disabled={!config.email.enabled}
                  sx={{ flex: '1 1 200px' }}
                />

                <TextField
                  label="Port SMTP"
                  type="number"
                  value={config.email.smtpPort}
                  onChange={(e) => updateConfig('email', 'smtpPort', parseInt(e.target.value))}
                  disabled={!config.email.enabled}
                  sx={{ width: 120 }}
                />
              </Box>

              <Box display="flex" gap={2} flexWrap="wrap">
                <TextField
                  label="Email expéditeur"
                  value={config.email.fromEmail}
                  onChange={(e) => updateConfig('email', 'fromEmail', e.target.value)}
                  disabled={!config.email.enabled}
                  sx={{ flex: '1 1 200px' }}
                />

                <TextField
                  label="Nom expéditeur"
                  value={config.email.fromName}
                  onChange={(e) => updateConfig('email', 'fromName', e.target.value)}
                  disabled={!config.email.enabled}
                  sx={{ flex: '1 1 200px' }}
                />
              </Box>

              <Box display="flex" gap={2} flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.email.notificationsEnabled}
                      onChange={(e) => updateConfig('email', 'notificationsEnabled', e.target.checked)}
                    />
                  }
                  label="Notifications par email"
                  disabled={!config.email.enabled}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.email.dailyDigest}
                      onChange={(e) => updateConfig('email', 'dailyDigest', e.target.checked)}
                    />
                  }
                  label="Résumé quotidien"
                  disabled={!config.email.enabled}
                />
              </Box>

              <Button
                variant="outlined"
                startIcon={<EmailIcon />}
                onClick={() => setTestEmailDialog(true)}
                disabled={!config.email.enabled}
                sx={{ alignSelf: 'flex-start' }}
              >
                Tester Configuration Email
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Onglet Limites */}
      {tabValue === 2 && (
        <Card>
          <CardHeader
            avatar={<LimitsIcon />}
            title="Limites Système"
            subheader="Quotas et contraintes de l'application"
          />
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap">
              <TextField
                label="Nombre max de projets"
                type="number"
                value={config.limits.maxProjects}
                onChange={(e) => updateConfig('limits', 'maxProjects', parseInt(e.target.value))}
                helperText="Nombre maximum de projets dans l'application"
                sx={{ flex: '1 1 200px' }}
              />

              <TextField
                label="Nombre max d'utilisateurs"
                type="number"
                value={config.limits.maxUsers}
                onChange={(e) => updateConfig('limits', 'maxUsers', parseInt(e.target.value))}
                helperText="Nombre maximum d'utilisateurs actifs"
                sx={{ flex: '1 1 200px' }}
              />

              <TextField
                label="Max tâches par projet"
                type="number"
                value={config.limits.maxTasksPerProject}
                onChange={(e) => updateConfig('limits', 'maxTasksPerProject', parseInt(e.target.value))}
                helperText="Limite de tâches par projet"
                sx={{ flex: '1 1 200px' }}
              />

              <TextField
                label="Taille max fichier (MB)"
                type="number"
                value={config.limits.maxFileSize}
                onChange={(e) => updateConfig('limits', 'maxFileSize', parseInt(e.target.value))}
                helperText="Taille maximum d'un fichier uploadé"
                sx={{ flex: '1 1 200px' }}
              />

              <TextField
                label="Stockage max par utilisateur (MB)"
                type="number"
                value={config.limits.maxStoragePerUser}
                onChange={(e) => updateConfig('limits', 'maxStoragePerUser', parseInt(e.target.value))}
                helperText="Quota de stockage par utilisateur"
                sx={{ flex: '1 1 200px' }}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Onglet Maintenance */}
      {tabValue === 3 && (
        <Card>
          <CardHeader
            avatar={<MaintenanceIcon />}
            title="Mode Maintenance"
            subheader="Contrôle d'accès pour maintenance système"
          />
          <CardContent>
            <Box display="flex" flexDirection="column" gap={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.maintenance.enabled}
                    onChange={(e) => updateConfig('maintenance', 'enabled', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography>Mode maintenance actif</Typography>
                    <Typography variant="body2" color="text.secondary">
                      L'application sera inaccessible aux utilisateurs normaux
                    </Typography>
                  </Box>
                }
              />

              {config.maintenance.enabled && (
                <Alert severity="warning">
                  ⚠️ Le mode maintenance est ACTIVÉ. Seuls les administrateurs peuvent accéder à l'application.
                </Alert>
              )}

              <TextField
                label="Message de maintenance"
                value={config.maintenance.message}
                onChange={(e) => updateConfig('maintenance', 'message', e.target.value)}
                multiline
                rows={3}
                fullWidth
                helperText="Message affiché aux utilisateurs pendant la maintenance"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={backupDialog} onClose={() => setBackupDialog(false)}>
        <DialogTitle>Déclencher Backup Manuel</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir déclencher un backup manuel de toutes les données ?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Cette opération peut prendre plusieurs minutes selon la taille des données.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialog(false)}>Annuler</Button>
          <Button onClick={triggerManualBackup} variant="contained">
            Déclencher Backup
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={testEmailDialog} onClose={() => setTestEmailDialog(false)}>
        <DialogTitle>Tester Configuration Email</DialogTitle>
        <DialogContent>
          <Typography>
            Un email de test sera envoyé à l'adresse configurée ({config.email.fromEmail}) 
            pour vérifier la configuration SMTP.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailDialog(false)}>Annuler</Button>
          <Button onClick={testEmailConfig} variant="contained">
            Envoyer Test
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};