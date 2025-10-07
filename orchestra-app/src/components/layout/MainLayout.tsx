import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Button,
  Stack,
  Tooltip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SupervisedUserCircleIcon from '@mui/icons-material/SupervisedUserCircle';
import { RootState, AppDispatch } from '../../store';
import { signOut } from '../../store/slices/authSlice';
import { usePermissions } from '../../hooks/usePermissions';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const { hasPermission, hasAdminAccess } = usePermissions();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Effet pour gérer le rechargement forcé après navigation depuis tasks
  useEffect(() => {
    // Si on était sur l'onglet tasks et qu'on navigue vers une autre page
    if (sessionStorage.getItem('on-tasks-tab') === 'true' &&
        !location.pathname.includes('/projects/')) {
      sessionStorage.removeItem('on-tasks-tab');
      // Forcer un rechargement complet pour nettoyer l'état React
      window.location.reload();
    }
  }, [location.pathname]);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await dispatch(signOut());
    navigate('/login');
  };

  // Menu items avec permissions
  const allMenuItems = [
    { text: 'Mon Espace', icon: <TrendingUpIcon />, path: '/dashboard-hub', permission: null },
    { text: 'Projets', icon: <FolderIcon />, path: '/projects', permission: 'project.view' },
    // { text: 'Tâches', icon: <AssignmentIcon />, path: '/tasks', permission: 'task.view' }, // Masqué
    { text: 'Calendrier', icon: <CalendarMonthIcon />, path: '/calendar', permission: 'project.view' },
    { text: 'Supervision', icon: <SupervisedUserCircleIcon />, path: '/team-supervision', permission: 'team.supervise' },
    { text: 'Rapports', icon: <BarChartIcon />, path: '/reports', permission: 'report.view' },
    { text: 'Administration RH', icon: <AdminPanelSettingsIcon />, path: '/hr-admin', permission: 'hr.manage_employees' },
    { text: 'Paramètres', icon: <SettingsIcon />, path: '/settings', permission: null },
  ];

  // Filtrage spécial pour les contributeurs et teamLead : accès limité à Mon Espace et Calendrier uniquement
  const isLimitedRole = user?.role === 'contributor' || user?.role === 'teamLead';
  const limitedRoleAllowedPaths = ['/dashboard-hub', '/calendar'];

  // Filtrer les items selon les permissions utilisateur
  const menuItems = allMenuItems.filter(item => {
    // Si contributeur ou teamLead, ne garder que Mon Espace et Calendrier
    if (isLimitedRole) {
      return limitedRoleAllowedPaths.includes(item.path);
    }

    // Sinon, filtrage normal par permissions
    if (!item.permission) return true; // Items sans permission requis
    const hasAccess = hasPermission(item.permission as any);
    return hasAccess;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header avec navigation horizontale */}
      <AppBar
        position="fixed"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, gap: 2 }}>
          {/* Logo/Titre */}
          <Typography
            variant="h6"
            noWrap
            component="div"
            fontWeight="bold"
            sx={{
              mr: 3,
              cursor: 'pointer',
              display: { xs: 'none', sm: 'block' }
            }}
            onClick={() => navigate('/dashboard-hub')}
          >
            Orchestr'A
          </Typography>

          {/* Navigation horizontale avec icônes */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              flexGrow: 1,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: 2
              }
            }}
          >
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Tooltip key={item.text} title={item.text} arrow>
                  <Button
                    onClick={() => navigate(item.path)}
                    sx={{
                      color: 'white',
                      flexDirection: 'column',
                      minWidth: { xs: 60, sm: 70 },
                      px: { xs: 1, sm: 1.5 },
                      py: 0.75,
                      textTransform: 'none',
                      borderRadius: 2,
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ fontSize: { xs: 20, sm: 24 }, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.icon}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                        fontWeight: isActive ? 'bold' : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                      }}
                    >
                      {item.text}
                    </Typography>
                  </Button>
                </Tooltip>
              );
            })}
          </Stack>

          {/* Menu utilisateur */}
          <IconButton
            onClick={handleProfileMenuOpen}
            color="inherit"
            sx={{ ml: 'auto' }}
          >
            {user?.avatarUrl ? (
              <Avatar src={user.avatarUrl} sx={{ width: 32, height: 32 }} />
            ) : (
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                {user?.displayName?.[0] || <AccountCircleIcon />}
              </Avatar>
            )}
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
              <AccountCircleIcon fontSize="small" sx={{ mr: 1 }} />
              Mon profil
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Déconnexion
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: { xs: 8, sm: 9 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};