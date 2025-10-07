import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  PhotoCamera as PhotoIcon,
  Stars as SkillsIcon,
  WorkOutline as PortfolioIcon,
  BeachAccess as LeavesIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { PersonalInfoTab } from '../components/profile/PersonalInfoTab';
import { SecurityTab } from '../components/profile/SecurityTab';
import { SkillsTab } from '../components/profile/SkillsTab';
import { PortfolioTab } from '../components/profile/PortfolioTab';
import { profileService } from '../services/profile.service';
import { MyLeaves } from './MyLeaves';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`,
  };
}

const Profile: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      loadProfileStats();
    }
  }, [user?.id]);

  const loadProfileStats = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const stats = await profileService.getProfileStats(user.id);
      setProfileStats(stats);
    } catch (error) {
      console.error('Error loading profile stats:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getRoleDisplayLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      admin: 'Administrateur',
      responsable: 'Responsable',
      manager: 'Manager',
      teamLead: 'Chef d\'équipe',
      contributor: 'Contributeur',
      viewer: 'Observateur'
    };
    return roleLabels[role] || role;
  };

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert severity="error">
          Utilisateur non connecté
        </Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* En-tête du profil */}
      <Box sx={{ mb: 4 }}>
        <Card sx={{ p: 3, mb: 3, position: 'relative', overflow: 'visible' }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {/* Avatar principal */}
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={user.avatarUrl}
                  sx={{
                    width: 120,
                    height: 120,
                    border: 4,
                    borderColor: 'background.paper',
                    boxShadow: 3,
                    fontSize: 48,
                    fontWeight: 'bold'
                  }}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </Avatar>
              </Box>

              {/* Informations utilisateur */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                  {user.email}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={getRoleDisplayLabel(user.role)}
                    color="primary"
                    variant="filled"
                  />
                  {user.department && (
                    <Chip
                      label={user.department}
                      variant="outlined"
                    />
                  )}
                  {user.isActive ? (
                    <Chip
                      label="Actif"
                      color="success"
                      size="small"
                    />
                  ) : (
                    <Chip
                      label="Inactif"
                      color="error"
                      size="small"
                    />
                  )}
                </Box>

                {/* Stats rapides */}
                {profileStats && (
                  <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        {profileStats.activeProjects || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Projets actifs
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        {profileStats.completedTasks || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tâches terminées
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        {user.skills?.length || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Compétences
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="large" />
          Mon Profil
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Gérez vos informations personnelles, sécurité et préférences
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Onglets */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="Profile tabs" variant="scrollable" scrollButtons="auto">
            <Tab
              icon={<PersonIcon />}
              label="Informations Personnelles"
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              icon={<SecurityIcon />}
              label="Sécurité"
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              icon={<SkillsIcon />}
              label="Compétences"
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              icon={<PortfolioIcon />}
              label="Portfolio"
              iconPosition="start"
              {...a11yProps(3)}
            />
            <Tab
              icon={<LeavesIcon />}
              label="Mes Congés"
              iconPosition="start"
              {...a11yProps(4)}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <PersonalInfoTab user={user} onUpdate={loadProfileStats} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <SecurityTab user={user} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <SkillsTab user={user} onUpdate={loadProfileStats} />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <PortfolioTab user={user} />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <MyLeaves />
        </TabPanel>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
};

export default Profile;