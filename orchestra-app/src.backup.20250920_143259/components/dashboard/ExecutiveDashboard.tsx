import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Assignment as TaskIcon,
  Business as ProjectIcon,
  AccountTree as WorkflowIcon,
  Assessment as ReportIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { analyticsService, KPIMetric, ExecutiveReport } from '../../services/analytics.service';
import { dashboardService, DashboardAlert } from '../../services/dashboard.service';
import KPICard from '../charts/KPICard';
import AnalyticsChart from '../charts/AnalyticsChart';
// import ReportExport from '../reports/ReportExport';
import { useAppSelector } from '../../hooks/redux';

// =======================================================================================
// TYPES & INTERFACES
// =======================================================================================

interface ExecutiveDashboardProps {
  period?: 'week' | 'month' | 'quarter' | 'year';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// =======================================================================================
// COMPOSANT PRINCIPAL
// =======================================================================================

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  period = 'month',
  autoRefresh = true,
  refreshInterval = 300000 // 5 minutes
}) => {
  const { user } = useAppSelector(state => state.auth);
  
  // État
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [chartData, setChartData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // =======================================================================================
  // CHARGEMENT DES DONNÉES
  // =======================================================================================

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      if (!user?.id) return;

      // Charger les KPIs
      const kpiData = await analyticsService.calculateGlobalKPIs();
      setKpis(kpiData);

      // Charger les alertes
      const alertsData = await dashboardService.getActiveAlerts(10);
      setAlerts(alertsData);

      // Générer le rapport exécutif
      const reportData = await analyticsService.generateExecutiveReport(selectedPeriod, user.id);
      setReport(reportData);

      // Charger les données de graphiques
      const chartPromises = [
        dashboardService.getChartWidgetData({ 
          dataSource: 'project_progress', 
          chartType: 'pie' 
        }),
        dashboardService.getChartWidgetData({ 
          dataSource: 'task_completion', 
          chartType: 'line',
          dateRange: selectedPeriod
        }),
        dashboardService.getChartWidgetData({ 
          dataSource: 'resource_utilization', 
          chartType: 'bar',
          dateRange: selectedPeriod
        }),
        dashboardService.getChartWidgetData({ 
          dataSource: 'workflow_status', 
          chartType: 'pie'
        })
      ];

      const [projectProgress, taskCompletion, resourceUtilization, workflowStatus] = await Promise.all(chartPromises);

      setChartData({
        projectProgress,
        taskCompletion,
        resourceUtilization,
        workflowStatus
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial et auto-refresh
  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod, user?.id]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // =======================================================================================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // =======================================================================================

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod as any);
    handleMenuClose();
  };

  // =======================================================================================
  // COMPOSANTS DE RENDU
  // =======================================================================================

  /**
   * Rendu de l'en-tête du dashboard
   */
  const renderHeader = () => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Tableau de Bord Exécutif
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vue d'ensemble des performances et KPIs business
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Dernière mise à jour: {format(lastUpdated, 'dd/MM/yyyy à HH:mm', { locale: fr })}
        </Typography>
      </Box>
      
      <Box display="flex" gap={1}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Période</InputLabel>
          <Select
            value={selectedPeriod}
            label="Période"
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
          >
            <MenuItem value="week">Semaine</MenuItem>
            <MenuItem value="month">Mois</MenuItem>
            <MenuItem value="quarter">Trimestre</MenuItem>
            <MenuItem value="year">Année</MenuItem>
          </Select>
        </FormControl>
        
        <Tooltip title="Exporter le rapport">
          <IconButton onClick={() => setExportDialogOpen(true)} disabled={loading}>
            <ExportIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Actualiser">
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Options">
          <IconButton onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  /**
   * Rendu des alertes critiques
   */
  const renderAlerts = () => {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const highAlerts = alerts.filter(alert => alert.severity === 'high');
    
    if (criticalAlerts.length === 0 && highAlerts.length === 0) {
      return null;
    }

    return (
      <Box mb={3}>
        {criticalAlerts.map((alert) => (
          <Alert 
            key={alert.id} 
            severity="error" 
            icon={<WarningIcon />}
            sx={{ mb: 1 }}
          >
            <strong>{alert.title}</strong>: {alert.message}
          </Alert>
        ))}
        {highAlerts.map((alert) => (
          <Alert 
            key={alert.id} 
            severity="warning" 
            icon={<WarningIcon />}
            sx={{ mb: 1 }}
          >
            <strong>{alert.title}</strong>: {alert.message}
          </Alert>
        ))}
      </Box>
    );
  };

  /**
   * Rendu des KPIs principaux
   */
  const renderKPIs = () => (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
      {kpis.map((kpi) => (
        <Box sx={{ flexGrow: 1, minWidth: 200 }} key={kpi.id}>
          <KPICard 
            metric={kpi}
            size="medium"
            showTrend={true}
            showProgress={true}
          />
        </Box>
      ))}
    </Box>
  );

  /**
   * Rendu du résumé du rapport
   */
  const renderReportSummary = () => {
    if (!report) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Résumé Exécutif"
          subheader={`Période: ${format(report.startDate, 'dd/MM/yyyy')} - ${format(report.endDate, 'dd/MM/yyyy')}`}
          action={
            <Tooltip title="Générer rapport complet">
              <IconButton>
                <ReportIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ flexGrow: 1, minWidth: 200, textAlign: "center" }}>
              <ProjectIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4">{report.globalKPIs.projectsCompleted}</Typography>
              <Typography variant="body2" color="text.secondary">Projets Terminés</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200, textAlign: "center" }}>
              <TaskIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4">{report.globalKPIs.tasksCompleted}</Typography>
              <Typography variant="body2" color="text.secondary">Tâches Complétées</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200, textAlign: "center" }}>
              <PeopleIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4">{report.globalKPIs.teamProductivity.toFixed(1)}/10</Typography>
              <Typography variant="body2" color="text.secondary">Productivité Équipe</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200, textAlign: "center" }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4">{report.globalKPIs.clientSatisfaction.toFixed(1)}/10</Typography>
              <Typography variant="body2" color="text.secondary">Satisfaction Client</Typography>
            </Box>
          </Box>

          {/* Tendances */}
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Tendances</Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Chip
                icon={report.trends.projectDelivery === 'improving' ? <TrendUpIcon /> : <ScheduleIcon />}
                label={`Livraison Projets: ${report.trends.projectDelivery === 'improving' ? 'En amélioration' : 
                        report.trends.projectDelivery === 'stable' ? 'Stable' : 'En déclin'}`}
                color={report.trends.projectDelivery === 'improving' ? 'success' : 
                       report.trends.projectDelivery === 'stable' ? 'default' : 'error'}
                variant="outlined"
              />
              <Chip
                icon={report.trends.teamPerformance === 'improving' ? <TrendUpIcon /> : <ScheduleIcon />}
                label={`Performance Équipe: ${report.trends.teamPerformance === 'improving' ? 'En amélioration' : 
                        report.trends.teamPerformance === 'stable' ? 'Stable' : 'En déclin'}`}
                color={report.trends.teamPerformance === 'improving' ? 'success' : 
                       report.trends.teamPerformance === 'stable' ? 'default' : 'error'}
                variant="outlined"
              />
              <Chip
                icon={report.trends.budgetControl === 'improving' ? <TrendUpIcon /> : <ScheduleIcon />}
                label={`Contrôle Budget: ${report.trends.budgetControl === 'improving' ? 'En amélioration' : 
                        report.trends.budgetControl === 'stable' ? 'Stable' : 'En déclin'}`}
                color={report.trends.budgetControl === 'improving' ? 'success' : 
                       report.trends.budgetControl === 'stable' ? 'default' : 'error'}
                variant="outlined"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  /**
   * Rendu des graphiques analytiques
   */
  const renderCharts = () => (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {/* Progression des projets */}
      <Box sx={{ flexGrow: 1, minWidth: 400 }}>
        <AnalyticsChart
          data={chartData.projectProgress || []}
          title="Répartition des Projets"
          height={300}
        />
      </Box>

      {/* Évolution des tâches */}
      <Box sx={{ flexGrow: 1, minWidth: 400 }}>
        <AnalyticsChart
          data={chartData.taskCompletion || []}
          title="Évolution des Tâches"
          height={300}
        />
      </Box>

      {/* Utilisation des ressources */}
      <Box sx={{ flexGrow: 1, minWidth: 400 }}>
        <AnalyticsChart
          data={chartData.resourceUtilization || []}
          title="Utilisation des Ressources"
          height={300}
        />
      </Box>

      {/* Statut des workflows */}
      <Box sx={{ flexGrow: 1, minWidth: 400 }}>
        <AnalyticsChart
          data={chartData.workflowStatus || []}
          title="Statut des Workflows"
          height={300}
        />
      </Box>
    </Box>
  );

  // =======================================================================================
  // RENDU PRINCIPAL
  // =======================================================================================

  if (loading && kpis.length === 0) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="h6" align="center" sx={{ mt: 2 }}>
          Chargement du tableau de bord...
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {renderHeader()}
      {renderAlerts()}
      {renderKPIs()}
      {renderReportSummary()}
      {renderCharts()}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handlePeriodChange('week')}>Semaine</MenuItem>
        <MenuItem onClick={() => handlePeriodChange('month')}>Mois</MenuItem>
        <MenuItem onClick={() => handlePeriodChange('quarter')}>Trimestre</MenuItem>
        <MenuItem onClick={() => handlePeriodChange('year')}>Année</MenuItem>
      </Menu>

      {/* Dialog d'export */}
      {/* <ReportExport
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        defaultFilters={{
          startDate: report?.startDate,
          endDate: report?.dueDate
        }}
      /> */}
    </Box>
  );
};

export default ExecutiveDashboard;