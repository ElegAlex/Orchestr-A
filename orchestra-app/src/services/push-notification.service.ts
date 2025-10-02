import { 
  getMessaging, 
  getToken, 
  onMessage, 
  MessagePayload,
  NotificationPayload 
} from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { RealtimeNotification } from './realtime-notification.service';

export interface PushSubscription {
  token: string;
  deviceType: 'web' | 'mobile';
  userAgent: string;
  createdAt: Date;
  lastUsed: Date;
}

export interface EmailNotificationTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EmailNotificationRequest {
  to: string;
  template: EmailNotificationTemplate;
  data?: Record<string, any>;
  scheduledFor?: Date;
}

class PushNotificationService {
  private messaging: any;
  private vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';
  private emailServiceUrl = process.env.REACT_APP_EMAIL_SERVICE_URL || '';
  private emailServiceKey = process.env.REACT_APP_EMAIL_SERVICE_KEY || '';

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      this.initializeMessaging();
    }
  }

  private async initializeMessaging() {
    try {
      this.messaging = getMessaging();
      this.setupForegroundHandler();
    } catch (error) {
      console.error('Error initializing messaging:', error);
    }
  }

  /**
   * Demander la permission pour les notifications push
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Obtenir le token FCM
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      if (!this.messaging) {
        await this.initializeMessaging();
      }

      const token = await getToken(this.messaging, {
        vapidKey: this.vapidKey
      });

      return token;
    } catch (error) {
      console.error('Error getting device token:', error);
      return null;
    }
  }

  /**
   * Enregistrer le token push pour un utilisateur
   */
  async registerPushToken(userId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return false;
      }

      const token = await this.getDeviceToken();
      if (!token) {
        return false;
      }

      const subscription: PushSubscription = {
        token,
        deviceType: 'web',
        userAgent: navigator.userAgent,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      // Sauvegarder dans Firestore
      await updateDoc(doc(db, 'users', userId), {
        pushTokens: arrayUnion(subscription)
      });

      console.log('Push token registered successfully');
      return true;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  /**
   * Désinscrire un token push
   */
  async unregisterPushToken(userId: string, token: string): Promise<void> {
    try {
      // Récupérer l'utilisateur et supprimer le token
      const userSubscriptions = await this.getUserPushTokens(userId);
      const subscriptionToRemove = userSubscriptions.find(sub => sub.token === token);

      if (subscriptionToRemove) {
        await updateDoc(doc(db, 'users', userId), {
          pushTokens: arrayRemove(subscriptionToRemove)
        });
      }
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  }

  /**
   * Obtenir les tokens push d'un utilisateur
   */
  async getUserPushTokens(userId: string): Promise<PushSubscription[]> {
    try {
      // Cette méthode devrait récupérer les tokens depuis Firestore
      // Pour l'exemple, on retourne un tableau vide
      return [];
    } catch (error) {
      console.error('Error getting user push tokens:', error);
      return [];
    }
  }

  /**
   * Envoyer une notification push à un utilisateur
   */
  async sendPushNotification(
    userId: string, 
    notification: RealtimeNotification
  ): Promise<boolean> {
    try {
      const tokens = await this.getUserPushTokens(userId);
      if (tokens.length === 0) {
        console.log('No push tokens found for user', userId);
        return false;
      }

      const payload = this.createPushPayload(notification);
      
      // Envoyer via l'API Firebase Cloud Functions ou un service backend
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          tokens: tokens.map(t => t.token),
          payload,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Push notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Créer le payload pour la notification push
   */
  private createPushPayload(notification: RealtimeNotification) {
    const payload = {
      notification: {
        title: notification.title,
        body: notification.message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'critical',
        silent: notification.silent || false,
        timestamp: notification.createdAt.getTime(),
      },
      data: {
        notificationId: notification.id,
        type: notification.type,
        priority: notification.priority || 'medium',
        actionUrl: notification.actionUrl || '',
        userId: notification.userId,
        ...notification.data,
      },
    };

    // Actions personnalisées
    if (notification.actions && notification.actions.length > 0) {
      (payload as any).actions = notification.actions.slice(0, 2).map(action => ({
        action: action.action,
        title: action.title,
        icon: action.icon || '/icons/action-icon.png',
      }));
    }

    return payload;
  }

  /**
   * Configurer le gestionnaire pour les notifications en premier plan
   */
  private setupForegroundHandler(): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload: MessagePayload) => {
      console.log('Foreground message received:', payload);

      // Afficher une notification native si l'utilisateur est sur un autre onglet
      if (document.hidden && payload.notification) {
        this.showNativeNotification(payload.notification);
      }
    });
  }

  /**
   * Afficher une notification native
   */
  private showNativeNotification(notification: NotificationPayload): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(notification.title || 'Nouvelle notification', {
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'orchestra-notification',
        requireInteraction: false,
        silent: false,
      });
    });
  }

  /**
   * Envoyer une notification email
   */
  async sendEmailNotification(request: EmailNotificationRequest): Promise<boolean> {
    try {
      if (!this.emailServiceUrl) {
        console.warn('Email service URL not configured');
        return false;
      }

      const response = await fetch(`${this.emailServiceUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.emailServiceKey}`,
        },
        body: JSON.stringify({
          to: request.to,
          subject: request.template.subject,
          html: this.processTemplate(request.template.htmlBody, request.data),
          text: this.processTemplate(request.template.textBody, request.data),
          priority: request.template.priority,
          scheduledFor: request.scheduledFor?.toISOString(),
          tags: ['orchestra', 'notification'],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Email notification sent successfully to', request.to);
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Créer un template email à partir d'une notification
   */
  createEmailTemplate(notification: RealtimeNotification): EmailNotificationTemplate {
    const priority = notification.priority || 'medium';
    const priorityText = {
      low: 'Faible',
      medium: 'Moyenne',
      high: 'Haute',
      critical: 'CRITIQUE'
    }[priority];

    const subject = `[Orchestra] ${notification.title}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .priority { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .priority-low { background: #e8f5e8; color: #2e7d2e; }
          .priority-medium { background: #e3f2fd; color: #1565c0; }
          .priority-high { background: #fff3e0; color: #ef6c00; }
          .priority-critical { background: #ffebee; color: #c62828; }
          .action-button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 10px 0; 
          }
          .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Orchestra - Notification</h1>
        </div>
        <div class="content">
          <h2>{{title}}</h2>
          <span class="priority priority-{{priority}}">Priorité: ${priorityText}</span>
          <p>{{message}}</p>
          {{#actionUrl}}
          <a href="{{actionUrl}}" class="action-button">Voir les détails</a>
          {{/actionUrl}}
          <p><small>Reçu le {{createdAt}}</small></p>
        </div>
        <div class="footer">
          <p>Cette notification a été générée automatiquement par Orchestra.</p>
          <p>Pour modifier vos préférences de notification, connectez-vous à votre compte.</p>
        </div>
      </body>
      </html>
    `;

    const textBody = `
Orchestra - Notification

${notification.title}
Priorité: ${priorityText}

${notification.message}

${notification.actionUrl ? `Lien: ${notification.actionUrl}` : ''}

Reçu le {{createdAt}}

---
Cette notification a été générée automatiquement par Orchestra.
Pour modifier vos préférences de notification, connectez-vous à votre compte.
    `;

    return {
      subject,
      htmlBody,
      textBody,
      priority,
    };
  }

  /**
   * Traiter un template avec des données
   */
  private processTemplate(template: string, data: Record<string, any> = {}): string {
    let processed = template;
    
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    });

    // Gérer les conditions simples {{#key}}...{{/key}}
    processed = processed.replace(/{{#(\w+)}}(.*?){{\/\1}}/gs, (match, key, content) => {
      return data[key] ? content : '';
    });

    return processed;
  }

  /**
   * Obtenir le token d'authentification
   */
  private getAuthToken(): string {
    // Récupérer le token d'auth de l'utilisateur connecté
    // Cette méthode devrait être adaptée selon votre système d'auth
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Envoyer une notification complète (push + email selon les préférences)
   */
  async sendCompleteNotification(
    userId: string,
    userEmail: string,
    notification: RealtimeNotification,
    preferences: any
  ): Promise<void> {
    const promises: Promise<boolean>[] = [];

    // Notifications push
    if (preferences?.channels?.push?.enabled) {
      const priorityLevels = { low: 1, medium: 2, high: 3, critical: 4, all: 0 };
      const notificationPriority = priorityLevels[notification.priority || 'medium'];
      const channelMinPriority = priorityLevels['all'];
      
      if (channelMinPriority === 0 || notificationPriority >= channelMinPriority) {
        promises.push(this.sendPushNotification(userId, notification));
      }
    }

    // Notifications email
    if (preferences?.channels?.email?.enabled && userEmail) {
      const priorityLevels = { low: 1, medium: 2, high: 3, critical: 4, all: 0 };
      const notificationPriority = priorityLevels[notification.priority || 'medium'];
      const channelMinPriority = priorityLevels['all'];
      
      if (channelMinPriority === 0 || notificationPriority >= channelMinPriority) {
        const template = this.createEmailTemplate(notification);
        const emailRequest: EmailNotificationRequest = {
          to: userEmail,
          template,
          data: {
            title: notification.title,
            message: notification.message,
            priority: notification.priority || 'medium',
            actionUrl: notification.actionUrl,
            createdAt: notification.createdAt.toLocaleString('fr-FR'),
          },
        };
        promises.push(this.sendEmailNotification(emailRequest));
      }
    }

    // Attendre toutes les notifications
    try {
      const results = await Promise.allSettled(promises);
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      if (failedCount > 0) {
        console.warn(`${failedCount} notification(s) failed to send`);
      }
    } catch (error) {
      console.error('Error sending complete notification:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();