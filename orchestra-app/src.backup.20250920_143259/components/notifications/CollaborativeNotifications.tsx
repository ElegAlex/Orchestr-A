import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Grid,
  Paper,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  PersonAdd as PersonAddIcon,
  Assignment as AssignmentIcon,
  Comment as CommentIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  realtimeNotificationService,
  RealtimeNotification,
} from '../../services/realtime-notification.service';
import { notificationService } from '../../services/notification.service';
import { userService } from '../../services/user.service';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../NotificationProvider';

interface CollaborativeNotification extends RealtimeNotification {
  collaborationType: 'mention' | 'comment' | 'assignment' | 'approval' | 'share' | 'reaction' | 'join' | 'leave';
  author: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  target: {
    type: 'task' | 'project' | 'document' | 'comment' | 'workflow';
    id: string;
    title: string;
    url?: string;
  };
  context?: {
    projectId?: string;
    projectName?: string;
    teamId?: string;
    teamName?: string;
    parentId?: string;
  };
  content?: string;
  participants?: string[];
  reactions?: Array<{
    emoji: string;
    users: string[];
  }>;
}

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
      id={`collaborative-tabpanel-${index}`}
      aria-labelledby={`collaborative-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const CollaborativeNotifications: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [notifications, setNotifications] = useState<CollaborativeNotification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<CollaborativeNotification[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<CollaborativeNotification | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [mentionDialogOpen, setMentionDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [mentionUsers, setMentionUsers] = useState<string[]>([]);
  const [collaborativeSettings, setCollaborativeSettings] = useState({
    mentions: true,
    comments: true,
    assignments: true,
    approvals: true,
    shares: true,
    reactions: false,
    joins: false,
    leaves: false,
    emailDigest: true,
    instantNotifications: true,
    quietHours: false,
  });

  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCollaborativeNotifications();
      subscribeToCollaborativeNotifications();
      loadAvailableUsers();
    }

    return () => {
      if (subscriptionIdRef.current) {
        realtimeNotificationService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    filterNotifications();
  }, [notifications, tabValue]);

  const loadCollaborativeNotifications = async () => {
    if (!user?.id) return;

    try {
      const allNotifications = await notificationService.getUserNotifications(user.id);
      const collaborative = allNotifications.filter(n => 
        ['mention', 'comment', 'assignment', 'approval', 'share', 'reaction', 'join', 'leave']
          .includes((n as any).collaborationType)
      ) as CollaborativeNotification[];
      
      setNotifications(collaborative);
    } catch (error) {
      console.error('Error loading collaborative notifications:', error);
      setNotifications([]);
    }
  };

  const subscribeToCollaborativeNotifications = () => {
    if (!user?.id) return;

    // Simuler un abonnement temps réel
    const subscriptionId = realtimeNotificationService.subscribeToNotifications(
      user.id,
      (updatedNotifications) => {
        const collaborative = updatedNotifications.filter(n => 
          ['mention', 'comment', 'assignment', 'approval', 'share', 'reaction', 'join', 'leave']
            .includes((n as any).collaborationType)
        ) as CollaborativeNotification[];
        
        setNotifications(collaborative);
      }
    );

    subscriptionIdRef.current = subscriptionId;
  };

  const loadAvailableUsers = async () => {
    try {
      const users = await userService.getAllUsers();
      const usersList = users.map(u => ({
        id: u.id,
        name: u.displayName || `${u.firstName} ${u.lastName}`,
        role: u.role || 'Utilisateur'
      }));
      setAvailableUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      setAvailableUsers([]);
    }
  };

  const filterNotifications = () => {
    let filtered = [...notifications];

    switch (tabValue) {
      case 0: // Toutes
        break;
      case 1: // Mentions
        filtered = filtered.filter(n => n.collaborationType === 'mention');
        break;
      case 2: // Assignations
        filtered = filtered.filter(n => n.collaborationType === 'assignment');
        break;
      case 3: // Commentaires
        filtered = filtered.filter(n => n.collaborationType === 'comment');
        break;
      case 4: // Non lues
        filtered = filtered.filter(n => !n.isRead);
        break;
    }

    setFilteredNotifications(filtered);
  };

  const getCollaborationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return <PersonAddIcon color="primary" />;
      case 'assignment':
        return <AssignmentIcon color="warning" />;
      case 'comment':
        return <CommentIcon color="info" />;
      case 'approval':
        return <VisibilityIcon color="success" />;
      case 'share':
        return <ShareIcon color="secondary" />;
      case 'reaction':
        return <ThumbUpIcon color="action" />;
      case 'join':
        return <GroupIcon color="primary" />;
      case 'leave':
        return <GroupIcon color="disabled" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getCollaborationTypeLabel = (type: string) => {
    switch (type) {
      case 'mention':
        return 'Mention';
      case 'assignment':
        return 'Assignation';
      case 'comment':
        return 'Commentaire';
      case 'approval':
        return 'Approbation';
      case 'share':
        return 'Partage';
      case 'reaction':
        return 'Réaction';
      case 'join':
        return 'Arrivée';
      case 'leave':
        return 'Départ';
      default:
        return 'Collaboration';
    }
  };

  const handleReply = (notification: CollaborativeNotification) => {
    setSelectedNotification(notification);
    setReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedNotification || !replyText.trim()) return;

    try {
      // Simuler l'envoi d'une réponse
      showSuccess('Réponse envoyée avec succès');
      setReplyDialogOpen(false);
      setReplyText('');
      setSelectedNotification(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      showError('Erreur lors de l\'envoi de la réponse');
    }
  };

  const handleMention = () => {
    setMentionDialogOpen(true);
  };

  const handleSendMention = async () => {
    if (mentionUsers.length === 0) return;

    try {
      // Simuler l'envoi de mentions
      showSuccess(`${mentionUsers.length} utilisateur(s) mentionné(s)`);
      setMentionDialogOpen(false);
      setMentionUsers([]);
    } catch (error) {
      console.error('Error sending mentions:', error);
      showError('Erreur lors de l\'envoi des mentions');
    }
  };

  const handleMarkAsRead = async (notification: CollaborativeNotification) => {
    if (!notification.isRead) {
      await notificationService.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
    }
  };

  const handleViewTarget = (notification: CollaborativeNotification) => {
    if (notification.target.url) {
      window.location.href = notification.target.url;
    }
    handleMarkAsRead(notification);
  };

  const handleAddReaction = (notification: CollaborativeNotification, emoji: string) => {
    // Simuler l'ajout d'une réaction
    const updatedNotifications = notifications.map(n => {
      if (n.id === notification.id) {
        const reactions = n.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        
        if (existingReaction) {
          if (!existingReaction.users.includes(user!.id)) {
            existingReaction.users.push(user!.id);
          }
        } else {
          reactions.push({ emoji, users: [user!.id] });
        }
        
        return { ...n, reactions };
      }
      return n;
    });
    
    setNotifications(updatedNotifications);
    showSuccess('Réaction ajoutée');
  };

  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);

  const quickReactions = ['👍', '👏', '🎉', '❤️', '😊', '🚀'];

  return (
    <Box sx={{ width: '100%' }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Notifications collaboratives
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={handleMention}
            sx={{ mr: 1 }}
          >
            Mentionner
          </Button>
          <IconButton onClick={() => setSettingsDialogOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Statistiques */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {notifications.filter(n => n.collaborationType === 'mention').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Mentions
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {notifications.filter(n => n.collaborationType === 'assignment').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Assignations
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">
              {notifications.filter(n => n.collaborationType === 'comment').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Commentaires
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {notifications.filter(n => !n.isRead).length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Non lues
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Toutes" />
          <Tab label="Mentions" />
          <Tab label="Assignations" />
          <Tab label="Commentaires" />
          <Tab label="Non lues" />
        </Tabs>
      </Paper>

      {/* Liste des notifications */}
      <TabPanel value={tabValue} index={tabValue}>
        {filteredNotifications.length === 0 ? (
          <Alert severity="info">
            <AlertTitle>Aucune notification</AlertTitle>
            Aucune notification collaborative trouvée.
          </Alert>
        ) : (
          <List>
            {filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={getCollaborationIcon(notification.collaborationType)}
                    >
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {notification.author.avatar}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}
                        >
                          {notification.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={getCollaborationTypeLabel(notification.collaborationType)}
                          color="default"
                          variant="outlined"
                        />
                        {notification.priority === 'high' && (
                          <Chip size="small" label="Urgent" color="error" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          <strong>{notification.author.name}</strong> • {notification.author.role}
                        </Typography>
                        {notification.content && (
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.5,
                              fontStyle: 'italic',
                              color: 'text.secondary',
                            }}
                          >
                            "{notification.content}"
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(notification.createdAt, { 
                              addSuffix: true, 
                              locale: fr 
                            })}
                          </Typography>
                          {notification.context?.projectName && (
                            <Chip
                              size="small"
                              label={notification.context.projectName}
                              variant="outlined"
                              sx={{ height: 20 }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            → {notification.target.title}
                          </Typography>
                        </Box>
                        
                        {/* Réactions */}
                        {notification.reactions && notification.reactions.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                            {notification.reactions.map((reaction, idx) => (
                              <Chip
                                key={idx}
                                size="small"
                                label={`${reaction.emoji} ${reaction.users.length}`}
                                variant="outlined"
                                clickable
                                onClick={() => handleAddReaction(notification, reaction.emoji)}
                                sx={{ height: 24, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {/* Réactions rapides */}
                      <Menu
                        id={`reactions-menu-${notification.id}`}
                        anchorEl={null}
                        open={false}
                        MenuListProps={{
                          'aria-labelledby': `reactions-button-${notification.id}`,
                        }}
                      >
                        {quickReactions.map((emoji) => (
                          <MenuItem
                            key={emoji}
                            onClick={() => handleAddReaction(notification, emoji)}
                          >
                            {emoji}
                          </MenuItem>
                        ))}
                      </Menu>

                      <Tooltip title="Réagir">
                        <IconButton
                          size="small"
                          id={`reactions-button-${notification.id}`}
                        >
                          <EmojiIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Répondre">
                        <IconButton
                          size="small"
                          onClick={() => handleReply(notification)}
                        >
                          <ReplyIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Voir">
                        <IconButton
                          size="small"
                          onClick={() => handleViewTarget(notification)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Dialog de réponse */}
      <Dialog
        open={replyDialogOpen}
        onClose={() => setReplyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Répondre à {selectedNotification?.author.name}
        </DialogTitle>
        <DialogContent>
          {selectedNotification && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>{selectedNotification.author.name}:</strong> {selectedNotification.content}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Écrivez votre réponse..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSendReply}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={!replyText.trim()}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de mention */}
      <Dialog
        open={mentionDialogOpen}
        onClose={() => setMentionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Mentionner des utilisateurs
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={availableUsers}
            getOptionLabel={(option) => `${option.name} (${option.role})`}
            value={availableUsers.filter(u => mentionUsers.includes(u.id))}
            onChange={(e, newValue) => {
              setMentionUsers(newValue.map(u => u.id));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Sélectionner des utilisateurs"
                placeholder="Tapez pour rechercher..."
              />
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMentionDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSendMention}
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={mentionUsers.length === 0}
          >
            Mentionner ({mentionUsers.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog des paramètres */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Paramètres de notifications collaboratives
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Types de notifications
            </Typography>
            {Object.entries(collaborativeSettings).slice(0, 8).map(([key, value]) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={value}
                    onChange={(e) => {
                      setCollaborativeSettings(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }));
                    }}
                  />
                }
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                sx={{ display: 'block', mb: 1 }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            Fermer
          </Button>
          <Button variant="contained">
            Sauvegarder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CollaborativeNotifications;