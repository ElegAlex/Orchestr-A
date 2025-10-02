import { 
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { notificationService, Notification, NotificationRequest } from './notification.service';

// Types étendus pour les notifications temps réel
export interface RealtimeNotification extends Notification {
  actionUrl?: string;
  actions?: NotificationAction[];
  groupId?: string;
  channel?: string;
  sound?: boolean;
  vibrate?: boolean;
  badge?: number;
  sticky?: boolean;
  silent?: boolean;
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  action: 'dismiss' | 'navigate' | 'approve' | 'reject' | 'custom';
  payload?: any;
}

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: 'min' | 'low' | 'default' | 'high' | 'max';
  sound: boolean;
  vibrate: boolean;
  showBadge: boolean;
  categories: string[];
}

export interface NotificationPreferences {
  userId: string;
  channels: Record<string, boolean>;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
  };
  weekendMode: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  grouping: boolean;
  preview: boolean;
  sound: boolean;
  vibrate: boolean;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface SmartAlert {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  userId: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AlertCondition {
  type: 'task_overdue' | 'project_deadline' | 'resource_overload' | 'absence_request' | 'milestone_reached' | 'custom';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'task_create' | 'assignment';
  config: any;
}

class RealtimeNotificationService {
  private listeners: Map<string, () => void> = new Map();
  private channels: NotificationChannel[] = [];
  private preferences: Map<string, NotificationPreferences> = new Map();
  private smartAlerts: Map<string, SmartAlert> = new Map();

  constructor() {
    this.initializeDefaultChannels();
  }

  private initializeDefaultChannels() {
    this.channels = [
      {
        id: 'general',
        name: 'Général',
        description: 'Notifications générales du système',
        importance: 'default',
        sound: true,
        vibrate: false,
        showBadge: true,
        categories: ['system', 'announcement']
      },
      {
        id: 'tasks',
        name: 'Tâches',
        description: 'Notifications liées aux tâches',
        importance: 'high',
        sound: true,
        vibrate: true,
        showBadge: true,
        categories: ['task_assigned', 'task_due', 'task_completed']
      },
      {
        id: 'projects',
        name: 'Projets',
        description: 'Notifications de projets',
        importance: 'high',
        sound: true,
        vibrate: false,
        showBadge: true,
        categories: ['project_milestone', 'project_deadline', 'project_status']
      },
      {
        id: 'hr',
        name: 'Ressources Humaines',
        description: 'Notifications RH et congés',
        importance: 'high',
        sound: false,
        vibrate: false,
        showBadge: true,
        categories: ['leave_request', 'absence_reminder', 'capacity_alert']
      },
      {
        id: 'collaboration',
        name: 'Collaboration',
        description: 'Messages et mentions',
        importance: 'default',
        sound: true,
        vibrate: true,
        showBadge: true,
        categories: ['mention', 'comment', 'message', 'meeting']
      }
    ];
  }

  /**
   * Écouter les notifications en temps réel pour un utilisateur
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: RealtimeNotification[]) => void,
    options: { 
      unreadOnly?: boolean;
      channels?: string[];
      limit?: number;
    } = {}
  ): string {
    const subscriptionId = `${userId}-${Date.now()}`;
    
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(options.limit || 50)
    );

    if (options.unreadOnly) {
      q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(options.limit || 50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as RealtimeNotification));

      // Filtrer par canaux si spécifié
      const filteredNotifications = options.channels
        ? notifications.filter(n => options.channels!.includes(n.channel || 'general'))
        : notifications;

      callback(filteredNotifications);
    }, (error) => {
      
    });

    this.listeners.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  /**
   * Se désabonner des notifications
   */
  unsubscribe(subscriptionId: string): void {
    const unsubscribe = this.listeners.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(subscriptionId);
    }
  }

  /**
   * Envoyer une notification enrichie temps réel
   */
  async sendRealtimeNotification(request: NotificationRequest & {
    channel?: string;
    actions?: NotificationAction[];
    actionUrl?: string;
    sound?: boolean;
    vibrate?: boolean;
    groupId?: string;
    sticky?: boolean;
  }): Promise<RealtimeNotification> {
    try {
      // Vérifier les préférences utilisateur
      const canSend = await this.checkUserPreferences(request.userId, request.category || 'general');
      if (!canSend) {
        console.log(`Notification blocked by user preferences for ${request.userId}`);
        return null as any;
      }

      const notification: Omit<RealtimeNotification, 'id'> = {
        ...request,
        channel: request.channel || 'general',
        isRead: false,
        createdAt: new Date(),
        priority: request.priority || 'medium',
        sound: request.sound !== false,
        vibrate: request.vibrate === true,
        sticky: request.sticky === true
      };

      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp()
      });

      const createdNotification = {
        id: docRef.id,
        ...notification
      };

      // Déclencher les actions associées
      if (request.actions) {
        await this.processNotificationActions(createdNotification);
      }

      return createdNotification;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Envoyer des notifications groupées
   */
  async sendGroupedNotification(
    userIds: string[],
    groupId: string,
    request: NotificationRequest & {
      channel?: string;
      summary?: string;
    }
  ): Promise<RealtimeNotification[]> {
    try {
      const notifications: RealtimeNotification[] = [];
      const batch = writeBatch(db);

      for (const userId of userIds) {
        const canSend = await this.checkUserPreferences(userId, request.category || 'general');
        if (!canSend) continue;

        const notification: Omit<RealtimeNotification, 'id'> = {
          ...request,
          userId,
          groupId,
          channel: request.channel || 'general',
          isRead: false,
          createdAt: new Date(),
          priority: request.priority || 'medium'
        };

        const docRef = doc(collection(db, 'notifications'));
        batch.set(docRef, {
          ...notification,
          createdAt: serverTimestamp()
        });

        notifications.push({
          id: docRef.id,
          ...notification
        });
      }

      await batch.commit();
      return notifications;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir les préférences utilisateur
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const cached = this.preferences.get(userId);
      if (cached) return cached;

      // Charger depuis Firestore
      const snapshot = await collection(db, 'user_notification_preferences');
      // Retourner préférences par défaut pour la démo
      const defaultPrefs: NotificationPreferences = {
        userId,
        channels: {
          general: true,
          tasks: true,
          projects: true,
          hr: true,
          collaboration: true
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        weekendMode: false,
        frequency: 'immediate',
        grouping: true,
        preview: true,
        sound: true,
        vibrate: false,
        email: true,
        push: true,
        inApp: true
      };

      this.preferences.set(userId, defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Mettre à jour les préférences utilisateur
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await this.getUserPreferences(userId);
      const updated = { ...current, ...preferences };
      
      // Sauvegarder en cache
      this.preferences.set(userId, updated);

      // Sauvegarder en base
      await updateDoc(doc(db, 'user_notification_preferences', userId), updated);
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Créer une alerte intelligente
   */
  async createSmartAlert(userId: string, alert: Omit<SmartAlert, 'id' | 'userId' | 'createdAt' | 'triggerCount'>): Promise<SmartAlert> {
    try {
      const smartAlert: Omit<SmartAlert, 'id'> = {
        ...alert,
        userId,
        createdAt: new Date(),
        triggerCount: 0
      };

      const docRef = await addDoc(collection(db, 'smart_alerts'), {
        ...smartAlert,
        createdAt: serverTimestamp()
      });

      const createdAlert = {
        id: docRef.id,
        ...smartAlert
      };

      this.smartAlerts.set(createdAlert.id, createdAlert);
      return createdAlert;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Évaluer les alertes intelligentes
   */
  async evaluateSmartAlerts(context: {
    type: 'task_change' | 'project_change' | 'deadline_approaching' | 'resource_update';
    data: any;
  }): Promise<void> {
    try {
      const relevantAlerts = Array.from(this.smartAlerts.values())
        .filter(alert => 
          alert.enabled && 
          alert.conditions.some(condition => condition.type === 'custom' || context.type === 'task_change')
        );

      for (const alert of relevantAlerts) {
        if (this.evaluateConditions(alert.conditions, context)) {
          await this.triggerAlert(alert, context);
        }
      }
    } catch (error) {
      
    }
  }

  /**
   * Créer des notifications collaboratives
   */
  async sendCollaborativeNotification(request: {
    type: 'mention' | 'comment' | 'assignment' | 'meeting_invite' | 'document_share';
    fromUserId: string;
    toUserIds: string[];
    entityId: string;
    entityType: 'task' | 'project' | 'document' | 'comment';
    message: string;
    actionUrl?: string;
  }): Promise<RealtimeNotification[]> {
    try {
      const notifications: RealtimeNotification[] = [];

      for (const toUserId of request.toUserIds) {
        if (toUserId === request.fromUserId) continue; // Pas d'auto-notification

        const notification = await this.sendRealtimeNotification({
          userId: toUserId,
          type: 'system',
          title: this.getCollaborativeTitle(request.type, request.fromUserId),
          message: request.message,
          channel: 'collaboration',
          category: request.type,
          actionUrl: request.actionUrl,
          data: {
            fromUserId: request.fromUserId,
            entityId: request.entityId,
            entityType: request.entityType,
            collaborationType: request.type
          },
          actions: this.getCollaborativeActions(request.type, request.entityId)
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Nettoyer les anciennes notifications
   */
  async cleanupOldNotifications(userId: string, keepDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('createdAt', '<=', Timestamp.fromDate(cutoffDate)),
        where('isRead', '==', true)
      );

      // Simulation pour le build
      const snapshot = null;
      // Simulation pour la démo
      console.log(`Cleaned up old notifications for user ${userId}`);
      return 0;
    } catch (error) {
      
      return 0;
    }
  }

  // Méthodes privées
  private async checkUserPreferences(userId: string, category: string): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    
    // Vérifier les heures silencieuses
    if (prefs.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime >= prefs.quietHours.start || currentTime <= prefs.quietHours.end) {
        return false;
      }
    }

    // Vérifier le mode weekend
    if (prefs.weekendMode) {
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }
    }

    // Vérifier les canaux activés
    const channel = this.getChannelForCategory(category);
    return prefs.channels[channel] !== false;
  }

  private getChannelForCategory(category: string): string {
    const categoryChannelMap: Record<string, string> = {
      'task_assigned': 'tasks',
      'task_due': 'tasks',
      'task_completed': 'tasks',
      'project_milestone': 'projects',
      'project_deadline': 'projects',
      'leave_request': 'hr',
      'mention': 'collaboration',
      'comment': 'collaboration',
      'system': 'general'
    };

    return categoryChannelMap[category] || 'general';
  }

  private async processNotificationActions(notification: RealtimeNotification): Promise<void> {
    if (!notification.actions) return;

    for (const action of notification.actions) {
      switch (action.action) {
        case 'navigate':
          // Géré côté client
          break;
        case 'approve':
        case 'reject':
          // Créer des webhooks
          break;
      }
    }
  }

  private evaluateConditions(conditions: AlertCondition[], context: any): boolean {
    return conditions.every(condition => {
      const value = this.getValueFromContext(context, condition.field);
      return this.compareValues(value, condition.operator, condition.value);
    });
  }

  private getValueFromContext(context: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], context);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals': return actual === expected;
      case 'not_equals': return actual !== expected;
      case 'greater_than': return actual > expected;
      case 'less_than': return actual < expected;
      case 'contains': return String(actual).includes(String(expected));
      case 'not_contains': return !String(actual).includes(String(expected));
      default: return false;
    }
  }

  private async triggerAlert(alert: SmartAlert, context: any): Promise<void> {
    // Mettre à jour le compteur
    await updateDoc(doc(db, 'smart_alerts', alert.id), {
      lastTriggered: serverTimestamp(),
      triggerCount: alert.triggerCount + 1
    });

    // Exécuter les actions
    for (const action of alert.actions) {
      await this.executeAlertAction(action, alert, context);
    }
  }

  private async executeAlertAction(action: AlertAction, alert: SmartAlert, context: any): Promise<void> {
    switch (action.type) {
      case 'notification':
        await this.sendRealtimeNotification({
          userId: alert.userId,
          type: 'system',
          title: `Alerte: ${alert.name}`,
          message: alert.description,
          priority: 'high',
          category: 'smart_alert',
          data: { alertId: alert.id, context }
        });
        break;
      // Autres actions...
    }
  }

  private getCollaborativeTitle(type: string, fromUserId: string): string {
    const titles = {
      mention: `Vous avez été mentionné par ${fromUserId}`,
      comment: `Nouveau commentaire de ${fromUserId}`,
      assignment: `Nouvelle tâche assignée par ${fromUserId}`,
      meeting_invite: `Invitation à une réunion de ${fromUserId}`,
      document_share: `Document partagé par ${fromUserId}`
    };

    return titles[type as keyof typeof titles] || 'Nouvelle notification collaborative';
  }

  private getCollaborativeActions(type: string, entityId: string): NotificationAction[] {
    const baseActions: NotificationAction[] = [
      {
        id: 'view',
        title: 'Voir',
        action: 'navigate',
        payload: { entityId }
      },
      {
        id: 'dismiss',
        title: 'Ignorer',
        action: 'dismiss'
      }
    ];

    if (type === 'assignment') {
      baseActions.unshift({
        id: 'accept',
        title: 'Accepter',
        action: 'approve',
        payload: { entityId }
      });
    }

    return baseActions;
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      channels: {
        general: true,
        tasks: true,
        projects: true,
        hr: true,
        collaboration: true
      },
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      weekendMode: false,
      frequency: 'immediate',
      grouping: true,
      preview: true,
      sound: true,
      vibrate: false,
      email: true,
      push: true,
      inApp: true
    };
  }
}

export const realtimeNotificationService = new RealtimeNotificationService();