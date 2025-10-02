import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

// =======================================================================================
// TYPES & INTERFACES
// =======================================================================================

export interface Notification {
  id: string;
  userId: string;
  type: 'workflow_approval' | 'workflow_complete' | 'workflow_notification' | 'system' | 'reminder';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  data?: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  expiresAt?: Date;
}

export interface NotificationRequest {
  userId: string;
  type: Notification['type'];
  title: string;
  message: string;
  data?: any;
  priority?: Notification['priority'];
  category?: string;
  expiresAt?: Date;
}

// =======================================================================================
// SERVICE PRINCIPAL
// =======================================================================================

class NotificationService {
  private readonly NOTIFICATIONS_COLLECTION = 'notifications';
  private readonly NOTIFICATION_SETTINGS_COLLECTION = 'notification_settings';

  /**
   * Envoyer une notification
   */
  async sendNotification(request: NotificationRequest): Promise<Notification> {
    try {
      const notification: Omit<Notification, 'id'> = {
        ...request,
        isRead: false,
        createdAt: new Date(),
        priority: request.priority || 'medium'
      };

      const docRef = await addDoc(collection(db, this.NOTIFICATIONS_COLLECTION), {
        ...notification,
        createdAt: serverTimestamp()
      });

      const createdNotification = {
        id: docRef.id,
        ...notification
      };

      // Envoyer notification push si configuré
      await this.sendPushNotification(createdNotification);

      return createdNotification;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Récupérer les notifications d'un utilisateur
   */
  async getUserNotifications(
    userId: string,
    unreadOnly: boolean = false,
    maxCount: number = 50
  ): Promise<Notification[]> {
    try {
      let q = query(
        collection(db, this.NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );

      if (unreadOnly) {
        q = query(
          collection(db, this.NOTIFICATIONS_COLLECTION),
          where('userId', '==', userId),
          where('isRead', '==', false),
          orderBy('createdAt', 'desc'),
          limit(maxCount)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      } as Notification));
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.NOTIFICATIONS_COLLECTION, notificationId), {
        isRead: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Marquer toutes les notifications d'un utilisateur comme lues
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, this.NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, {
          isRead: true,
          readAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Obtenir le nombre de notifications non lues
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      
      return 0;
    }
  }

  /**
   * Envoyer une notification push (placeholder)
   */
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      // TODO: Implémenter l'envoi de notifications push
      // avec Firebase Cloud Messaging ou autre service
      console.log(`Push notification sent to ${notification.userId}: ${notification.title}`);
    } catch (error) {
      
    }
  }

  /**
   * Nettoyer les anciennes notifications expirées
   */
  async cleanupExpiredNotifications(): Promise<void> {
    try {
      const now = new Date();
      const q = query(
        collection(db, this.NOTIFICATIONS_COLLECTION),
        where('expiresAt', '<=', Timestamp.fromDate(now))
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      console.log(`Cleaned up ${snapshot.size} expired notifications`);
    } catch (error) {
      
    }
  }

  /**
   * Envoyer des notifications groupées (bulk)
   */
  async sendBulkNotifications(requests: NotificationRequest[]): Promise<Notification[]> {
    try {
      const notifications: Notification[] = [];
      const batch = writeBatch(db);
      // Utilisation des batches pour de meilleures performances
      for (const request of requests) {
        const notification: Omit<Notification, 'id'> = {
          ...request,
          isRead: false,
          createdAt: new Date(),
          priority: request.priority || 'medium'
        };

        const docRef = doc(collection(db, this.NOTIFICATIONS_COLLECTION));
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

      // Envoyer les notifications push
      for (const notification of notifications) {
        await this.sendPushNotification(notification);
      }

      return notifications;
    } catch (error) {
      
      throw error;
    }
  }
}

export const notificationService = new NotificationService();