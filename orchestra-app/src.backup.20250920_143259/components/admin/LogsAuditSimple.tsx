import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import {
  Assessment as LogsIcon,
  Security as SecurityIcon,
  Error as ErrorIcon,
  Person as UserIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface SystemLog {
  id: string;
  type: string;
  trigger?: string;
  timestamp: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
  error?: string;
  collections?: any[];
  status?: string;
  path?: string;
}

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  success: boolean;
  duration?: number;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export const LogsAudit: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dateFilter, setDateFilter] = useState('7days');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [detailsDialog, setDetailsDialog] = useState<any>(null);

  // Charger SEULEMENT les vrais logs système - AUCUN LOG FICTIF !
  const loadSystemLogs = async () => {
    setLoading(true);
    
    // FORCER l'effacement des logs fictifs
    setAuditLogs([]);
    setSystemLogs([]);
    
    try {
      console.log('📊 Chargement EXCLUSIF des logs système RÉELS...');
      
      const logsQuery = query(
        collection(db, 'systemLogs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(logsQuery);
      console.log(`🔍 Documents trouvés: ${snapshot.docs.length}`);
      
      if (snapshot.docs.length === 0) {
        console.log('⚠️ AUCUN LOG SYSTÈME - Collection vide');
        setAuditLogs([]);
        setSystemLogs([]);
        return;
      }

      const realLogs: SystemLog[] = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SystemLog))
        // FILTRER UNIQUEMENT LES LOGS SYSTÈME RÉELS
        .filter(log => 
          log.type && 
          (log.type === 'backup' || 
           log.type === 'backup_error' || 
           log.type === 'restore' || 
           log.type === 'user_creation')
        );

      console.log(`✅ Logs système réels trouvés: ${realLogs.length}`);

      setSystemLogs(realLogs);

      if (realLogs.length === 0) {
        setAuditLogs([]);
        return;
      }

      // Conversion SEULEMENT si on a des logs réels
      const convertedLogs: AuditLog[] = realLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp),
        userId: log.userId || 'system',
        userName: log.userName || 'Système',
        userEmail: log.userEmail || 'system@orchestr-a.fr',
        action: log.type,
        resource: getResourceFromLogType(log.type),
        resourceId: log.path || log.id,
        success: log.status === 'success' || log.status === 'partial',
        duration: undefined,
        severity: getLogSeverity(log)
      }));

      setAuditLogs(convertedLogs);

    } catch (error) {
      console.error('❌ Erreur chargement logs système:', error);
      setAuditLogs([]);
      setSystemLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Utilitaires pour conversion des logs
  const getResourceFromLogType = (type: string): string => {
    switch (type) {
      case 'backup':
      case 'backup_error':
        return 'backup';
      case 'restore':
        return 'restore';
      case 'user_creation':
        return 'users';
      default:
        return 'system';
    }
  };

  const getLogSeverity = (log: SystemLog): 'info' | 'warning' | 'error' | 'success' => {
    if (log.error || log.type.includes('error')) return 'error';
    if (log.status === 'success') return 'success';
    if (log.status === 'partial') return 'warning';
    return 'info';
  };

  // Filtrer les logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
    if (userFilter && !log.userName.toLowerCase().includes(userFilter.toLowerCase())) return false;
    if (searchFilter && !log.action.toLowerCase().includes(searchFilter.toLowerCase()) && 
        !log.resource.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Obtenir l'icône pour une action
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LoginIcon />;
      case 'logout': return <LogoutIcon />;
      case 'create_project': case 'create_task': return <AddIcon />;
      case 'update_task': case 'update_project': return <EditIcon />;
      case 'delete_user': case 'delete_task': return <DeleteIcon />;
      case 'failed_login': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  // Obtenir la couleur pour une sévérité
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'info': default: return 'info';
    }
  };

  useEffect(() => {
    loadSystemLogs();
  }, [dateFilter, severityFilter]);

  return (
    <Box>
      {/* En-tête */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Logs & Audit
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadSystemLogs}
          disabled={loading}
        >
          Actualiser
        </Button>
      </Box>

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Période</InputLabel>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                label="Période"
              >
                <MenuItem value="1day">Dernières 24h</MenuItem>
                <MenuItem value="7days">7 derniers jours</MenuItem>
                <MenuItem value="30days">30 derniers jours</MenuItem>
                <MenuItem value="90days">90 derniers jours</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sévérité</InputLabel>
              <Select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                label="Sévérité"
              >
                <MenuItem value="all">Toutes</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="error">Erreur</MenuItem>
                <MenuItem value="success">Succès</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Utilisateur"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Nom d'utilisateur..."
              sx={{ minWidth: 180 }}
            />

            <TextField
              size="small"
              label="Recherche"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Action, ressource..."
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            <Button
              startIcon={<DownloadIcon />}
              onClick={() => {
                const csvData = filteredAuditLogs.map(log => 
                  `${log.timestamp.toISOString()},${log.userName},${log.action},${log.resource},${log.success ? 'Succès' : 'Échec'},${log.severity}`
                ).join('\n');
                const blob = new Blob([`Date,Utilisateur,Action,Ressource,Statut,Sévérité\n${csvData}`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `logs-audit-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
              Export
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Onglets */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab 
            icon={<Badge badgeContent={auditLogs.length} color="primary"><LogsIcon /></Badge>} 
            label="Logs Système" 
          />
          <Tab 
            icon={<SecurityIcon />} 
            label="Actions Utilisateur" 
          />
          <Tab 
            icon={<SecurityIcon />} 
            label="Backups" 
          />
        </Tabs>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Contenu principal */}
      {tabValue === 0 && (
        <Card>
          <CardHeader 
            title="Logs Système" 
            subheader={`${filteredAuditLogs.length} entrées - Logs réels depuis Firestore`}
          />
          <CardContent>
            {filteredAuditLogs.length === 0 && !loading ? (
              <Alert severity="warning">
                <strong>AUCUN LOG SYSTÈME TROUVÉ</strong><br/>
                Les logs RÉELS apparaîtront ici après les premières actions système :<br/>
                • Backup manuel/automatique<br/>
                • Création d'utilisateurs<br/>
                • Erreurs système<br/>
                <br/>
                <em>Plus aucun log fictif ne sera affiché !</em>
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date/Heure</TableCell>
                      <TableCell>Utilisateur</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Ressource</TableCell>
                      <TableCell>Statut</TableCell>
                      <TableCell>Durée</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAuditLogs
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                              <UserIcon fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="body2">{log.userName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {log.userEmail}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {getActionIcon(log.action)}
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {log.action}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{log.resource}</Typography>
                          {log.resourceId && (
                            <Typography variant="caption" color="text.secondary">
                              ID: {log.resourceId}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={log.success ? 'Succès' : 'Échec'}
                            color={log.success ? 'success' : 'error'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.duration ? `${log.duration}ms` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setDetailsDialog(log)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
            {filteredAuditLogs.length > 0 && (
              <TablePagination
                component="div"
                count={filteredAuditLogs.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Alert severity="info">
              Module Actions Utilisateur - À implémenter avec un système d'audit plus complet (authentification, CRUD, etc.)
            </Alert>
          </CardContent>
        </Card>
      )}

      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Historique des Backups</Typography>
            {systemLogs.filter(log => log.type === 'backup' || log.type === 'backup_error').length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Collections</TableCell>
                    <TableCell>Chemin</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemLogs
                    .filter(log => log.type === 'backup' || log.type === 'backup_error')
                    .slice(0, 20)
                    .map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.timestamp?.toDate ? 
                          log.timestamp.toDate().toLocaleString('fr-FR') : 
                          new Date(log.timestamp).toLocaleString('fr-FR')
                        }
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={log.trigger === 'manual' ? 'Manuel' : 'Automatique'}
                          color={log.trigger === 'manual' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={log.status === 'success' ? 'Succès' : log.status === 'partial' ? 'Partiel' : 'Erreur'}
                          color={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        {log.collections ? log.collections.length : 0} collections
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {log.path || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert severity="info">
                Aucun backup n'a encore été effectué. Utilisez l'onglet "Paramètres Système" pour en déclencher un.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog des détails */}
      <Dialog 
        open={!!detailsDialog} 
        onClose={() => setDetailsDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails de l'événement</DialogTitle>
        <DialogContent>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(detailsDialog, null, 2)}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};