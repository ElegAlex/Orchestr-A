import React, { useEffect, useState, useRef } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  Avatar,
  Typography,
  IconButton,
  Slide,
  Grow,
  Fade,
  Paper,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { realtimeNotificationService, RealtimeNotification } from '../../services/realtime-notification.service';
import { notificationService } from '../../services/notification.service';
import { useAuth } from '../../hooks/useAuth';

interface ToastNotification extends RealtimeNotification {
  toastId: string;
  showTime: Date;
}

const RealtimeNotificationToast: React.FC = () => {
  const { user } = useAuth();
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const lastNotificationCountRef = useRef<number>(0);

  useEffect(() => {
    if (user?.id) {
      subscribeToNotifications();
    }

    return () => {
      if (subscriptionIdRef.current) {
        realtimeNotificationService.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    // Initialiser le contexte audio pour les sons
    const initAudio = async () => {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(context);
      } catch (error) {
        console.warn('Audio context not available:', error);
      }
    };

    initAudio();
  }, []);

  const subscribeToNotifications = () => {
    if (!user?.id) return;

    const subscriptionId = realtimeNotificationService.subscribeToNotifications(
      user.id,
      (notifications) => {
        const currentCount = notifications.filter(n => !n.isRead).length;
        
        // Détecter les nouvelles notifications
        if (currentCount > lastNotificationCountRef.current) {
          const newNotifications = notifications
            .filter(n => !n.isRead)
            .slice(0, currentCount - lastNotificationCountRef.current)
            .map(notification => ({
              ...notification,
              toastId: `toast-${notification.id}-${Date.now()}`,
              showTime: new Date(),
            }));

          // Ajouter les nouvelles notifications au toast
          newNotifications.forEach(notification => {
            showToastNotification(notification);
          });
        }

        lastNotificationCountRef.current = currentCount;
      }
    );

    subscriptionIdRef.current = subscriptionId;
  };

  const showToastNotification = async (notification: ToastNotification) => {

    // Jouer un son si configuré
    if (notification.sound !== false) {
      playNotificationSound(notification.priority || 'medium');
    }

    // Ajouter la notification au state pour l'affichage
    setToastNotifications(prev => [...prev, notification]);

    // Auto-remove après la durée appropriée
    const duration = getNotificationDuration(notification.priority || 'medium');
    setTimeout(() => {
      removeToastNotification(notification.toastId);
    }, duration);
  };

  const playNotificationSound = (priority: string) => {
    if (!audioContext) return;

    try {
      // Créer un son différent selon la priorité
      const frequency = priority === 'critical' ? 800 : priority === 'high' ? 600 : 400;
      const duration = priority === 'critical' ? 0.3 : 0.15;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  };

  const getNotificationDuration = (priority: string): number => {
    switch (priority) {
      case 'critical':
        return 10000; // 10 secondes
      case 'high':
        return 8000;  // 8 secondes
      case 'medium':
        return 6000;  // 6 secondes
      case 'low':
        return 4000;  // 4 secondes
      default:
        return 6000;
    }
  };

  const removeToastNotification = (toastId: string) => {
    setToastNotifications(prev => prev.filter(n => n.toastId !== toastId));
  };

  const handleToastClick = async (notification: ToastNotification) => {
    // Marquer comme lu
    if (!notification.isRead) {
      await notificationService.markAsRead(notification.id);
    }

    // Ouvrir l'action si disponible
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }

    // Fermer le toast
    removeToastNotification(notification.toastId);
  };

  const getNotificationIcon = (notification: RealtimeNotification) => {
    const iconProps = { fontSize: 'small' as const };

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
        return <NotificationsIcon {...iconProps} />;
    }
  };

  const getSeverity = (priority: string) => {
    switch (priority) {
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

  return (
    <>
      {toastNotifications.map((notification, index) => (
        <Snackbar
          key={notification.toastId}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={Slide}
          TransitionProps={{}}
          sx={{
            top: `${80 + (index * 80)}px !important`,
            zIndex: theme => theme.zIndex.snackbar + index,
          }}
        >
          <Alert
            severity={getSeverity(notification.priority || 'medium') as any}
            variant="filled"
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {notification.actionUrl && (
                  <IconButton
                    size="small"
                    color="inherit"
                    onClick={() => handleToastClick(notification)}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => removeToastNotification(notification.toastId)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            }
            icon={getNotificationIcon(notification)}
            sx={{
              width: '100%',
              maxWidth: 400,
              cursor: notification.actionUrl ? 'pointer' : 'default',
              '&:hover': {
                backgroundColor: notification.actionUrl ? 'rgba(0,0,0,0.1)' : 'inherit',
              },
            }}
            onClick={notification.actionUrl ? () => handleToastClick(notification) : undefined}
          >
            <AlertTitle sx={{ fontSize: '0.875rem', mb: 0.5 }}>
              {notification.title}
              {notification.category && (
                <Chip
                  label={notification.category}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem', color: 'inherit', borderColor: 'currentColor' }}
                />
              )}
            </AlertTitle>
            
            <Typography 
              variant="body2" 
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                mb: 0.5,
              }}
            >
              {notification.message}
            </Typography>
            
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {format(notification.showTime, 'HH:mm', { locale: fr })}
            </Typography>

            {/* Actions personnalisées */}
            {notification.actions && notification.actions.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                {notification.actions.slice(0, 2).map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (action.action === 'navigate' && action.payload?.url) {
                        window.location.href = action.payload.url;
                      }
                      removeToastNotification(notification.toastId);
                    }}
                    sx={{ 
                      color: 'inherit', 
                      borderColor: 'currentColor',
                      '&:hover': {
                        borderColor: 'currentColor',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }
                    }}
                  >
                    {action.title}
                  </Button>
                ))}
              </Box>
            )}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default RealtimeNotificationToast;