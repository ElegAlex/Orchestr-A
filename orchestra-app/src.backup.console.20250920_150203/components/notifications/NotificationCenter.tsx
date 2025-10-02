import React, { useState, useEffect, useRef } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Box,
  Chip,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Avatar,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Fade,
  Grow,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  MarkAsUnread as MarkAsUnreadIcon,
  DoneAll as DoneAllIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  LooksOne as Priority1Icon,
  LooksTwo as Priority2Icon,
  Looks3 as Priority3Icon,
  PriorityHigh as PriorityHighIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { realtimeNotificationService, RealtimeNotification } from '../../services/realtime-notification.service';
import { notificationService } from '../../services/notification.service';
import { useAuth } from '../../hooks/useAuth';

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
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 0 }}>{children}</Box>}
    </div>
  );
}

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    unreadOnly: false,
    priority: 'all',
    type: 'all',
    category: 'all'
  });
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      subscribeToRealtime();
    }

    return () => {
      if (subscriptionIdRef.current) {
        realtimeNotificationService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [allNotifications, count] = await Promise.all([
        notificationService.getUserNotifications(user.id, false, 100),
        notificationService.getUnreadCount(user.id)
      ]);
      
      setNotifications(allNotifications);
      setUnreadCount(count);
    } catch (error) {
      
    }
    setLoading(false);
  };

  const subscribeToRealtime = () => {
    if (!user?.id) return;

    const subscriptionId = realtimeNotificationService.subscribeToNotifications(
      user.id,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
        const unread = updatedNotifications.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      }
    );

    subscriptionIdRef.current = subscriptionId;
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm('');
  };

  const handleMarkAsRead = async (notificationId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await notificationService.markAsRead(notificationId);
    } catch (error) {
      
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await notificationService.markAllAsRead(user.id);
    } catch (error) {
      
    }
  };

  const handleDeleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      
    }
  };

  const handleNotificationClick = async (notification: RealtimeNotification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    
    handleClose();
  };

  const getNotificationIcon = (notification: RealtimeNotification) => {
    const iconProps = { 
      fontSize: 'small' as const,
      color: (notification.isRead ? 'disabled' : 'primary') as 'disabled' | 'primary'
    };

    switch (notification.type) {
      case 'workflow_approval':
        return <BusinessIcon {...iconProps} />;
      case 'workflow_complete':
        return <CheckCircleIcon {...iconProps} />;
      case 'workflow_notification':
        return <ScheduleIcon {...iconProps} />;
      case 'reminder':
        return <ScheduleIcon {...iconProps} />;
      case 'system':
        return <InfoIcon {...iconProps} />;
      default:
        return <CircleIcon {...iconProps} />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <PriorityHighIcon color="error" fontSize="small" />;
      case 'high':
        return <Priority1Icon color="warning" fontSize="small" />;
      case 'medium':
        return <Priority2Icon color="info" fontSize="small" />;
      case 'low':
        return <Priority3Icon color="disabled" fontSize="small" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filters.unreadOnly && notification.isRead) return false;
    
    if (searchTerm && !notification.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !notification.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    if (filters.priority !== 'all' && notification.priority !== filters.priority) return false;
    if (filters.type !== 'all' && notification.type !== filters.type) return false;
    if (filters.category !== 'all' && notification.category !== filters.category) return false;

    switch (tabValue) {
      case 0: // Toutes
        return true;
      case 1: // Non lues
        return !notification.isRead;
      case 2: // Importantes
        return notification.priority === 'high' || notification.priority === 'critical';
      case 3: // Système
        return notification.type === 'system';
      default:
        return true;
    }
  });

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleClick}
          sx={{ 
            color: 'inherit',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }
          }}
        >
          <Badge 
            badgeContent={unreadCount} 
            color="error"
            max={99}
            invisible={unreadCount === 0}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 420,
            maxHeight: 600,
            borderRadius: 2,
            boxShadow: theme => theme.shadows[8],
          }
        }}
      >
        <Paper sx={{ width: '100%', height: '100%' }}>
          {/* En-tête */}
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h6" component="div">
              Notifications
              {unreadCount > 0 && (
                <Chip 
                  label={unreadCount} 
                  size="small" 
                  color="error" 
                  sx={{ ml: 1 }} 
                />
              )}
            </Typography>
            <Box>
              <Tooltip title="Filtres">
                <IconButton 
                  size="small"
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              {unreadCount > 0 && (
                <Tooltip title="Tout marquer comme lu">
                  <IconButton 
                    size="small"
                    onClick={handleMarkAllAsRead}
                  >
                    <DoneAllIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Barre de recherche */}
          <Box sx={{ p: 2, pb: 0 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher dans les notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="disabled" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>

          {/* Onglets */}
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Toutes" />
            <Tab label={`Non lues (${notifications.filter(n => !n.isRead).length})`} />
            <Tab label="Importantes" />
            <Tab label="Système" />
          </Tabs>

          {/* Contenu */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredNotifications.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <NotificationsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body2">
                  {searchTerm ? 'Aucune notification trouvée' : 'Aucune notification'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {filteredNotifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <Grow in timeout={(index + 1) * 100}>
                      <ListItem
                        sx={{
                          px: 0,
                          backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                          borderLeft: notification.isRead ? 'none' : '4px solid',
                          borderColor: `${getPriorityColor(notification.priority || 'medium')}.main`,
                        }}
                      >
                        <ListItemButton
                          onClick={() => handleNotificationClick(notification)}
                          sx={{ px: 2 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {getNotificationIcon(notification)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: notification.isRead ? 'normal' : 'bold',
                                    flex: 1
                                  }}
                                >
                                  {notification.title}
                                </Typography>
                                {getPriorityIcon(notification.priority || 'medium')}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {notification.message}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDistanceToNow(notification.createdAt, { 
                                    addSuffix: true,
                                    locale: fr 
                                  })}
                                </Typography>
                                {notification.category && (
                                  <Chip
                                    label={notification.category}
                                    size="small"
                                    variant="outlined"
                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            }
                          />
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {!notification.isRead && (
                              <Tooltip title="Marquer comme lu">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMarkAsRead(notification.id, e)}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Supprimer">
                              <IconButton
                                size="small"
                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    </Grow>
                    {index < filteredNotifications.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {/* Menu des filtres */}
          <Menu
            anchorEl={filterMenuAnchor}
            open={Boolean(filterMenuAnchor)}
            onClose={() => setFilterMenuAnchor(null)}
          >
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.unreadOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, unreadOnly: e.target.checked }))}
                  />
                }
                label="Non lues uniquement"
              />
            </MenuItem>
          </Menu>
        </Paper>
      </Popover>
    </>
  );
};

export default NotificationCenter;