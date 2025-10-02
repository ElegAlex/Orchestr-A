import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Stack,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  EventAvailable,
  EventBusy,
  Schedule,
  Assessment,
  Warning,
  CheckCircle,
  Info,
  Download,
  Refresh,
  DateRange,
} from '@mui/icons-material';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

import { KPICard } from '../charts/KPICard';
import { AnalyticsChart } from '../charts/AnalyticsChart';
import { 
  hrAnalyticsService, 
  HRMetrics, 
  LeavePatternAnalysis, 
  TeamCapacityForecast 
} from '../../services/hr-analytics.service';
import { DatePeriod } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface HRDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const HRDashboard: React.FC<HRDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 240000 // 4 minutes
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // États des données
  const [hrMetrics, setHrMetrics] = useState<HRMetrics | null>(null);
  const [leavePatterns, setLeavePatterns] = useState<LeavePatternAnalysis | null>(null);
  const [capacityForecast, setCapacityForecast] = useState<TeamCapacityForecast | null>(null);
  
  // Période sélectionnée
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: endOfMonth(now),
      label: format(now, 'MMMM yyyy', { locale: fr }),
    };
  });

  // Périodes prédéfinies
  const predefinedPeriods = [
    {
      label: 'Ce mois',
      period: {
        startDate: startOfMonth(new Date()),
        endDate: endOfMonth(new Date()),
        label: 'Ce mois',
      }
    },
    {
      label: 'Mois dernier',
      period: {
        startDate: startOfMonth(subMonths(new Date(), 1)),
        endDate: endOfMonth(subMonths(new Date(), 1)),
        label: 'Mois dernier',
      }
    },
    {
      label: 'Trimestre',
      period: {
        startDate: startOfMonth(subMonths(new Date(), 2)),
        endDate: endOfMonth(new Date()),
        label: 'Trimestre',
      }
    },
    {
      label: 'Année',
      period: {
        startDate: new Date(new Date().getFullYear(), 0, 1),
        endDate: new Date(new Date().getFullYear(), 11, 31),
        label: 'Année en cours',
      }
    },
  ];

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  // Auto-refresh des données
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metrics, patterns, forecast] = await Promise.all([
        hrAnalyticsService.getHRMetrics(selectedPeriod),
        hrAnalyticsService.analyzeLeavePatterns(selectedPeriod),
        hrAnalyticsService.forecastTeamCapacity({
          startDate: endOfMonth(new Date()),
          endDate: endOfMonth(subMonths(new Date(), -1)),
          label: 'Mois prochain',
        }),
      ]);

      setHrMetrics(metrics);
      setLeavePatterns(patterns);
      setCapacityForecast(forecast);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Erreur lors du chargement du dashboard RH:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getRiskColor = (level: 'LOW' | 'MEDIUM' | 'HIGH'): 'error' | 'warning' | 'success' => {
    switch (level) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'success';
    }
  };

  const formatDuration = (days: number): string => {
    if (days < 1) return `${Math.round(days * 8)}h`;
    return `${days.toFixed(1)}j`;
  };

  const exportHRReport = async () => {
    try {
      // TODO: Implémenter l'export de rapport
      console.log('Export du rapport RH...');
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={loadDashboardData} sx={{ ml: 2 }}>
          Réessayer
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* En-tête avec contrôles */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" component="h1">
              📊 Dashboard RH
            </Typography>
            
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Période</InputLabel>
                <Select
                  value={selectedPeriod.label}
                  label="Période"
                  onChange={(e) => {
                    const period = predefinedPeriods.find(p => p.label === e.target.value);
                    if (period) setSelectedPeriod(period.period);
                  }}
                >
                  {predefinedPeriods.map((period) => (
                    <MenuItem key={period.label} value={period.label}>
                      {period.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Tooltip title="Actualiser les données">
                <IconButton onClick={loadDashboardData}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={exportHRReport}
              >
                Exporter
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* KPIs principaux */}
      {hrMetrics && (
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <KPICard
              metric={{
                id: "active-employees",
                name: "Employés actifs",
                value: hrMetrics.activeEmployees,
                category: "resource",
                unit: "",
                trend: "stable",
                updatedAt: new Date()
              }}
            />
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <KPICard
              metric={{
                id: "leave-days",
                name: "Jours de congés",
                value: hrMetrics.totalLeaveDays,
                category: "resource",
                unit: "",
                trend: "down",
                trendPercentage: -12,
                updatedAt: new Date()
              }}
            />
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <KPICard
              metric={{
                id: "approval-rate",
                name: "Taux d'approbation",
                value: hrMetrics.leaveApprovalRate,
                category: "workflow",
                unit: "%",
                trend: "up",
                updatedAt: new Date()
              }}
            />
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <KPICard
              metric={{
                id: "absenteeism",
                name: "Absentéisme",
                value: hrMetrics.absenteeismRate,
                category: "quality",
                unit: "%",
                trend: "stable",
                threshold: { warning: 3, critical: 5 },
                updatedAt: new Date()
              }}
            />
          </Box>
        </Box>
      )}

      {/* Onglets principaux */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Vue d'ensemble" />
            <Tab label="Analyse des congés" />
            <Tab label="Prévisions capacité" />
            <Tab label="Performance RH" />
          </Tabs>
        </Box>

        {/* Onglet Vue d'ensemble */}
        <TabPanel value={activeTab} index={0}>
          {hrMetrics && (
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {/* Répartition par type de congés */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Répartition par type de congés
                    </Typography>
                    <AnalyticsChart
                      
                      title="Répartition par type de congés"
                      data={hrMetrics.leaveTypeBreakdown.map(item => ({
                        name: item.type.replace('_', ' '),
                        value: item.totalDays,
                        count: item.count,
                      }))}
                      height={300}
                    />
                  </CardContent>
                </Card>
              </Box>

              {/* Tendances mensuelles */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Évolution mensuelle
                    </Typography>
                    <AnalyticsChart
                      
                      title="Évolution mensuelle"
                      data={hrMetrics.monthlyTrends.map(trend => ({
                        name: trend.month,
                        approved: trend.approvedDays,
                        rejected: trend.rejectedDays,
                        total: trend.totalDays,
                      }))}
                      height={300}
                    />
                  </CardContent>
                </Card>
              </Box>

              {/* Top utilisateurs */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Employés avec le plus de congés
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Nom</TableCell>
                            <TableCell>Département</TableCell>
                            <TableCell align="center">Demandes</TableCell>
                            <TableCell align="center">Jours total</TableCell>
                            <TableCell align="center">Durée moyenne</TableCell>
                            <TableCell>Derniers congés</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {hrMetrics.topLeaveUsers.slice(0, 10).map((user) => (
                            <TableRow key={user.userId}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {user.displayName}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={user.department} 
                                  size="small" 
                                  color="default" 
                                />
                              </TableCell>
                              <TableCell align="center">
                                {user.leaveRequestsCount}
                              </TableCell>
                              <TableCell align="center">
                                <Typography fontWeight="bold">
                                  {formatDuration(user.totalLeaveDays)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {formatDuration(user.averageRequestDuration)}
                              </TableCell>
                              <TableCell>
                                {user.lastLeaveDate 
                                  ? format(user.lastLeaveDate, 'dd/MM/yyyy', { locale: fr })
                                  : 'Aucun'
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}
        </TabPanel>

        {/* Onglet Analyse des congés */}
        <TabPanel value={activeTab} index={1}>
          {leavePatterns && (
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {/* Tendances saisonnières */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Tendances saisonnières
                    </Typography>
                    <AnalyticsChart
                      
                      title="Tendances saisonnières"
                      data={leavePatterns.seasonalTrends.map((trend, index) => ({
                        name: format(new Date(2024, index, 1), 'MMM', { locale: fr }),
                        requests: trend.requestCount,
                        averageDays: trend.averageDays,
                        pattern: trend.pattern,
                      }))}
                      height={300}
                    />
                  </CardContent>
                </Card>
              </Box>

              {/* Patterns hebdomadaires */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Jours de début préférés
                    </Typography>
                    <AnalyticsChart
                      
                      title="Jours de début préférés"
                      data={leavePatterns.weeklyPatterns.map(pattern => ({
                        name: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][pattern.dayOfWeek],
                        frequency: pattern.frequency,
                      }))}
                      height={300}
                    />
                  </CardContent>
                </Card>
              </Box>

              {/* Distribution des durées */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Distribution des durées de congés
                    </Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {leavePatterns.durationDistribution.map((dist, index) => (
                        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                          <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                            <Typography variant="h4" color="primary">
                              {dist.count}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {dist.range}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dist.percentage.toFixed(1)}%
                            </Typography>
                          </Card>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}
        </TabPanel>

        {/* Onglet Prévisions capacité */}
        <TabPanel value={activeTab} index={2}>
          {capacityForecast && (
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Prévisions basées sur les congés déjà approuvés pour{' '}
                    <strong>{capacityForecast.period.label}</strong>
                  </Typography>
                </Alert>
              </Box>

              {capacityForecast.departments.map((dept, index) => (
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">{dept.name}</Typography>
                        <Chip 
                          label={dept.riskLevel}
                          color={dept.riskLevel === 'HIGH' ? 'error' : dept.riskLevel === 'MEDIUM' ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>

                      <Box mb={2}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Utilisation prévue
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(dept.utilizationRate, 100)}
                          color={getRiskColor(dept.riskLevel)}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {dept.utilizationRate.toFixed(1)}%
                        </Typography>
                      </Box>

                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Capacité totale:</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {dept.totalCapacity}j
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Absences prévues:</Typography>
                          <Typography variant="body2" color="warning.main">
                            {dept.plannedAbsence}j
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">Disponible:</Typography>
                          <Typography variant="body2" color="success.main" fontWeight="bold">
                            {dept.availableCapacity}j
                          </Typography>
                        </Box>
                      </Stack>

                      {dept.recommendations.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Recommandations:
                          </Typography>
                          <List dense>
                            {dept.recommendations.map((rec, idx) => (
                              <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                  <Info color="primary" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={rec}
                                  primaryTypographyProps={{ variant: 'caption' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          )}
        </TabPanel>

        {/* Onglet Performance RH */}
        <TabPanel value={activeTab} index={3}>
          {hrMetrics && (
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {/* Métriques de performance */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Indicateurs de performance
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2">Temps d'approbation moyen</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {hrMetrics.averageApprovalTime.toFixed(1)}h
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((hrMetrics.averageApprovalTime / 72) * 100, 100)}
                          color={hrMetrics.averageApprovalTime < 24 ? 'success' : 'warning'}
                        />
                      </Box>
                      
                      <Box>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2">Taux d'approbation</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {hrMetrics.leaveApprovalRate.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={hrMetrics.leaveApprovalRate}
                          color="success"
                        />
                      </Box>
                      
                      <Box>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2">Utilisation congés</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {hrMetrics.averageLeaveDaysPerEmployee.toFixed(1)} j/employé
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(hrMetrics.averageLeaveDaysPerEmployee / 25) * 100}
                          color="info"
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>

              {/* Statistiques par département */}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Performance par département
                    </Typography>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Département</TableCell>
                            <TableCell align="center">Employés</TableCell>
                            <TableCell align="center">Absentéisme</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {hrMetrics.departmentStats.map((dept, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {dept.department}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {dept.employeeCount}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={`${dept.absenteeismRate.toFixed(1)}%`}
                                  size="small"
                                  color={dept.absenteeismRate > 5 ? 'error' : 
                                         dept.absenteeismRate > 3 ? 'warning' : 'success'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
};