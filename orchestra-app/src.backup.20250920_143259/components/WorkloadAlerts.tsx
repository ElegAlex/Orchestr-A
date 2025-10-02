import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  Stack,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Badge,
  Tooltip,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  NotificationImportant as NotificationImportantIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  removeAlert,
  resolveAlert,
  calculateUserWorkload,
  fetchUsers,
  getWorkloadOptimizations,
  analyzeTeamWorkload
} from '../store/slices/resourceSlice';
import { WorkloadAlert, User } from '../types';

interface WorkloadAlertsProps {
  userId?: string;
  showAllUsers?: boolean;
  maxItems?: number;
  compact?: boolean;
}

const WorkloadAlerts: React.FC<WorkloadAlertsProps> = ({ 
  userId, 
  showAllUsers = true, 
  maxItems,
  compact = false 
}) => {
  const dispatch = useAppDispatch();
  const { 
    alerts, 
    users, 
    workloads, 
    optimizations, 
    optimizationsLoading,
    teamAnalysis,
    teamAnalysisLoading 
  } = useAppSelector((state: any) => state.resources);

  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<WorkloadAlert | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (users.length === 0) {
      dispatch(fetchUsers());
    }
  }, [dispatch, users.length]);

  const getSeverityIcon = (severity: WorkloadAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
        return <WarningIcon color="warning" />;
      case 'medium':
        return <InfoIcon color="info" />;
      case 'low':
        return <CheckCircleIcon color="success" />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: WorkloadAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'primary';
    }
  };

  const getAlertSeverityColor = (severity: WorkloadAlert['severity']): 'error' | 'warning' | 'info' | 'success' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'info';
    }
  };

  const getAlertTypeLabel = (type: WorkloadAlert['type']) => {
    switch (type) {
      case 'overload':
        return 'Surcharge';
      case 'underload':
        return 'Sous-charge';
      case 'skill_gap':
        return 'Écart de compétences';
      case 'deadline_risk':
        return 'Risque d\'échéance';
      default:
        return type;
    }
  };

  const getAlertTypeIcon = (type: WorkloadAlert['type']) => {
    switch (type) {
      case 'overload':
        return <TrendingUpIcon />;
      case 'underload':
        return <ScheduleIcon />;
      case 'skill_gap':
        return <AssignmentIcon />;
      case 'deadline_risk':
        return <NotificationImportantIcon />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u: User) => u.id === userId);
    return user ? user.displayName : 'Utilisateur inconnu';
  };

  const handleToggleExpand = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const handleResolveAlert = async () => {
    if (selectedAlert) {
      await dispatch(resolveAlert(selectedAlert.id));
      setOpenDialog(false);
      setSelectedAlert(null);
      setResolution('');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette alerte ?')) {
      await dispatch(removeAlert(alertId));
    }
  };

  const handleRecalculateWorkload = async (userId: string) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    
    await dispatch(calculateUserWorkload({ userId, startDate, endDate }));
  };

  const handleGetOptimizations = async (userId: string) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    
    await dispatch(getWorkloadOptimizations({ userId, startDate, endDate }));
  };

  const handleAnalyzeTeam = async () => {
    const userIds = users.map((user: User) => user.id);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    
    await dispatch(analyzeTeamWorkload({ userIds, startDate, endDate }));
  };

  // Filtrer les alertes
  const filteredAlerts = alerts.filter((alert: WorkloadAlert) => {
    if (alert.resolvedAt) return false; // Exclure les alertes résolues
    if (userId) return alert.userId === userId;
    if (!showAllUsers) return false;
    return true;
  });

  // Trier par sévérité et date
  const sortedAlerts = [...filteredAlerts].sort((a: any, b: any) => {
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Limiter le nombre d'alertes si spécifié
  const displayedAlerts = maxItems ? sortedAlerts.slice(0, maxItems) : sortedAlerts;

  const alertCounts = sortedAlerts.reduce((acc: Record<string, number>, alert: any) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (displayedAlerts.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CheckCircleIcon color="success" />
            <Typography variant="body1">
              Aucune alerte active. Tout semble en ordre !
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {!compact && (
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2">
            Alertes de charge
          </Typography>
          <Stack direction="row" spacing={1}>
            {showAllUsers && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleAnalyzeTeam}
                disabled={teamAnalysisLoading}
                startIcon={teamAnalysisLoading ? <CircularProgress size={16} /> : <AssessmentIcon />}
              >
                Analyser l'équipe
              </Button>
            )}
            {Object.entries(alertCounts).map(([severity, count]) => (
              <Chip
                key={severity}
                label={`${severity}: ${count}`}
                color={getSeverityColor(severity as WorkloadAlert['severity'])}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Affichage de l'analyse d'équipe */}
      {teamAnalysis.teamMetrics && showAllUsers && !compact && (
        <Card sx={{ mb: 2, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              📊 Analyse d'équipe
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Chip
                label={`Utilisation moyenne: ${Math.round(teamAnalysis.teamMetrics.averageUtilization * 100)}%`}
                size="small"
                sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              />
              <Chip
                label={`Efficacité: ${Math.round(teamAnalysis.teamMetrics.teamEfficiency * 100)}%`}
                size="small"
                sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              />
              {teamAnalysis.teamOptimizations.length > 0 && (
                <Chip
                  label={`${teamAnalysis.teamOptimizations.length} optimisations disponibles`}
                  size="small"
                  color="warning"
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Stack spacing={2}>
        {displayedAlerts.map((alert) => {
          const isExpanded = expandedAlerts.has(alert.id);
          const user = users.find((u: User) => u.id === alert.userId);
          const userWorkload = workloads[alert.userId];

          return (
            <Card 
              key={alert.id}
              sx={{ 
                border: alert.severity === 'critical' ? 2 : 1,
                borderColor: alert.severity === 'critical' ? 'error.main' : 'divider'
              }}
            >
              <CardContent sx={{ pb: compact ? 2 : 1 }}>
                <Box display="flex" alignItems="start" gap={2}>
                  {getSeverityIcon(alert.severity)}
                  <Box flexGrow={1}>
                    <Box display="flex" alignItems="center" justifyContent="between" mb={1}>
                      <Box>
                        <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 600 }}>
                          {alert.message}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                          <Chip
                            label={getAlertTypeLabel(alert.type)}
                            size="small"
                            icon={getAlertTypeIcon(alert.type)}
                            color={getSeverityColor(alert.severity)}
                            variant="outlined"
                          />
                          {showAllUsers && (
                            <Chip
                              label={getUserName(alert.userId)}
                              size="small"
                              icon={<PersonIcon />}
                              variant="outlined"
                            />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {new Date(alert.createdAt).toLocaleDateString('fr-FR')} - 
                            {new Date(alert.createdAt).toLocaleTimeString('fr-FR')}
                          </Typography>
                        </Box>
                      </Box>

                      <Stack direction="row" spacing={1}>
                        {alert.threshold && alert.currentValue && (
                          <Tooltip title={`Seuil: ${alert.threshold}, Valeur: ${alert.currentValue}`}>
                            <Box sx={{ minWidth: 80 }}>
                              <Typography variant="caption" color="text.secondary">
                                {Math.round((alert.currentValue / alert.threshold) * 100)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min((alert.currentValue / alert.threshold) * 100, 100)}
                                color={getSeverityColor(alert.severity)}
                                sx={{ height: 4, borderRadius: 2 }}
                              />
                            </Box>
                          </Tooltip>
                        )}

                        {!compact && (
                          <>
                            <Tooltip title="Voir détails">
                              <IconButton 
                                size="small"
                                onClick={() => handleToggleExpand(alert.id)}
                              >
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Marquer comme résolu">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => {
                                  setSelectedAlert(alert);
                                  setOpenDialog(true);
                                }}
                              >
                                <CheckCircleIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteAlert(alert.id)}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </Box>

                    <Collapse in={isExpanded}>
                      <Box mt={2} pt={2} sx={{ borderTop: 1, borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          <strong>Détails de l'alerte:</strong>
                        </Typography>
                        
                        {alert.threshold && alert.currentValue && (
                          <Typography variant="body2" paragraph>
                            • Seuil d'alerte: <strong>{alert.threshold}</strong><br />
                            • Valeur actuelle: <strong>{alert.currentValue}</strong><br />
                            • Écart: <strong>
                              {Math.round(((alert.currentValue - alert.threshold) / alert.threshold) * 100)}%
                            </strong>
                          </Typography>
                        )}

                        {userWorkload && (
                          <Typography variant="body2" paragraph>
                            • Capacité théorique: <strong>{userWorkload.availability.capacity.theoretical}h</strong><br />
                            • Capacité nette: <strong>{userWorkload.availability.capacity.net}h</strong><br />
                            • Charge allouée: <strong>{userWorkload.availability.allocated.total}h</strong><br />
                            • Risque de surcharge: <strong>{userWorkload.availability.overloadRisk}</strong>
                          </Typography>
                        )}

                        <Box display="flex" gap={1} mt={2}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleRecalculateWorkload(alert.userId)}
                            startIcon={<TrendingUpIcon />}
                          >
                            Recalculer la charge
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleGetOptimizations(alert.userId)}
                            startIcon={<AssignmentIcon />}
                            disabled={optimizationsLoading}
                          >
                            Voir les optimisations
                          </Button>
                          {user && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                            >
                              Voir le profil
                            </Button>
                          )}
                        </Box>
                        
                        {/* Affichage des optimisations pour cet utilisateur */}
                        {optimizations['latest'] && (
                          <Box mt={2} p={2} sx={{ backgroundColor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Suggestions d'optimisation:
                            </Typography>
                            {optimizations['latest'].slice(0, 3).map((opt: any, index: number) => (
                              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                                • {opt.description || opt.message || 'Optimisation disponible'}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {maxItems && sortedAlerts.length > maxItems && (
        <Box textAlign="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            {sortedAlerts.length - maxItems} alerte(s) supplémentaire(s)
          </Typography>
        </Box>
      )}

      {/* Dialog de résolution */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Résoudre l'alerte
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Alert severity={getAlertSeverityColor(selectedAlert.severity)} sx={{ mb: 2 }}>
                <AlertTitle>{getAlertTypeLabel(selectedAlert.type)}</AlertTitle>
                {selectedAlert.message}
              </Alert>
              
              <TextField
                fullWidth
                label="Commentaire de résolution (optionnel)"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                multiline
                rows={3}
                placeholder="Décrivez les actions prises pour résoudre cette alerte..."
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleResolveAlert}
            variant="contained"
            color="success"
          >
            Marquer comme résolu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkloadAlerts;