import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../config/firebase';
import axios from 'axios';
import crypto from 'crypto';

export interface Webhook {
  id: string;
  name: string;
  description?: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  isActive: boolean;
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number; // en secondes
    backoffMultiplier: number;
  };
  createdBy: string;
  createdAt: Date;
  lastModifiedAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
  failureCount: number;
}

export type WebhookEvent = 
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.completed'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.assigned'
  | 'task.completed'
  | 'task.status_changed'
  | 'comment.created'
  | 'document.uploaded'
  | 'document.deleted'
  | 'user.created'
  | 'user.updated'
  | 'team.member_added'
  | 'team.member_removed'
  | 'leave.requested'
  | 'leave.approved'
  | 'leave.rejected';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  metadata?: {
    projectId?: string;
    taskId?: string;
    userId?: string;
    documentId?: string;
    [key: string]: any;
  };
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  webhookName: string;
  event: WebhookEvent;
  url: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  statusCode?: number;
  response?: any;
  error?: string;
  retryCount: number;
  createdAt: Date;
  executedAt?: Date;
  nextRetryAt?: Date;
}

class WebhookService {
  private readonly WEBHOOKS_COLLECTION = 'webhooks';
  private readonly WEBHOOK_LOGS_COLLECTION = 'webhook_logs';
  private readonly functions = getFunctions();

  /**
   * Créer un nouveau webhook
   */
  async createWebhook(webhookData: Omit<Webhook, 'id' | 'createdAt' | 'lastModifiedAt' | 'triggerCount' | 'failureCount'>): Promise<Webhook> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utilisateur non authentifié');

      // Générer un secret si non fourni
      const secret = webhookData.secret || this.generateSecret();

      const webhook = {
        ...webhookData,
        secret,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastModifiedAt: serverTimestamp(),
        triggerCount: 0,
        failureCount: 0,
        retryConfig: webhookData.retryConfig || {
          maxRetries: 3,
          retryDelay: 60,
          backoffMultiplier: 2
        }
      };

      const docRef = await addDoc(collection(db, this.WEBHOOKS_COLLECTION), webhook);

      return {
        id: docRef.id,
        ...webhook,
        createdAt: new Date(),
        lastModifiedAt: new Date()
      } as Webhook;
    } catch (error) {
      console.error('Erreur lors de la création du webhook:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les webhooks
   */
  async getWebhooks(activeOnly: boolean = false): Promise<Webhook[]> {
    try {
      let q = query(
        collection(db, this.WEBHOOKS_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      if (activeOnly) {
        q = query(q, where('isActive', '==', true));
      }

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastModifiedAt: doc.data().lastModifiedAt?.toDate() || new Date(),
        lastTriggeredAt: doc.data().lastTriggeredAt?.toDate()
      } as Webhook));
    } catch (error) {
      console.error('Erreur lors de la récupération des webhooks:', error);
      return [];
    }
  }

  /**
   * Récupérer un webhook par ID
   */
  async getWebhook(webhookId: string): Promise<Webhook | null> {
    try {
      const docRef = doc(db, this.WEBHOOKS_COLLECTION, webhookId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastModifiedAt: data.lastModifiedAt?.toDate() || new Date(),
        lastTriggeredAt: data.lastTriggeredAt?.toDate()
      } as Webhook;
    } catch (error) {
      console.error('Erreur lors de la récupération du webhook:', error);
      return null;
    }
  }

  /**
   * Mettre à jour un webhook
   */
  async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<void> {
    try {
      const docRef = doc(db, this.WEBHOOKS_COLLECTION, webhookId);
      
      await updateDoc(docRef, {
        ...updates,
        lastModifiedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du webhook:', error);
      throw error;
    }
  }

  /**
   * Supprimer un webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.WEBHOOKS_COLLECTION, webhookId));
    } catch (error) {
      console.error('Erreur lors de la suppression du webhook:', error);
      throw error;
    }
  }

  /**
   * Déclencher un événement webhook
   */
  async triggerEvent(event: WebhookEvent, data: any, metadata?: Record<string, any>): Promise<void> {
    try {
      // Récupérer tous les webhooks actifs qui écoutent cet événement
      const webhooks = await this.getWebhooksForEvent(event);
      
      if (webhooks.length === 0) {
        console.log(`Aucun webhook actif pour l'événement ${event}`);
        return;
      }

      // Créer le payload
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
        metadata
      };

      // Déclencher chaque webhook
      const promises = webhooks.map(webhook => this.executeWebhook(webhook, payload));
      await Promise.allSettled(promises);

    } catch (error) {
      console.error(`Erreur lors du déclenchement de l'événement ${event}:`, error);
    }
  }

  /**
   * Exécuter un webhook
   */
  private async executeWebhook(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    const logId = await this.createWebhookLog(webhook, payload);

    try {
      // Préparer les headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        ...webhook.headers
      };

      // Ajouter la signature si un secret est défini
      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Faire l'appel HTTP
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000, // 30 secondes
        validateStatus: () => true // Ne pas rejeter sur les codes d'erreur HTTP
      });

      // Mettre à jour le webhook
      await this.updateWebhook(webhook.id, {
        lastTriggeredAt: new Date(),
        triggerCount: webhook.triggerCount + 1,
        failureCount: response.status >= 400 ? webhook.failureCount + 1 : webhook.failureCount
      });

      // Mettre à jour le log
      await this.updateWebhookLog(logId, {
        status: response.status < 400 ? 'success' : 'failed',
        statusCode: response.status,
        response: response.data,
        executedAt: new Date()
      });

      // Si échec, planifier une nouvelle tentative
      if (response.status >= 400 && webhook.retryConfig && webhook.retryConfig.maxRetries > 0) {
        await this.scheduleRetry(webhook, payload, logId, 1);
      }

    } catch (error: any) {
      console.error(`Erreur lors de l'exécution du webhook ${webhook.name}:`, error);

      // Mettre à jour le webhook
      await this.updateWebhook(webhook.id, {
        lastTriggeredAt: new Date(),
        triggerCount: webhook.triggerCount + 1,
        failureCount: webhook.failureCount + 1
      });

      // Mettre à jour le log
      await this.updateWebhookLog(logId, {
        status: 'failed',
        error: error.message,
        executedAt: new Date()
      });

      // Planifier une nouvelle tentative si configuré
      if (webhook.retryConfig && webhook.retryConfig.maxRetries > 0) {
        await this.scheduleRetry(webhook, payload, logId, 1);
      }
    }
  }

  /**
   * Planifier une nouvelle tentative
   */
  private async scheduleRetry(
    webhook: Webhook,
    payload: WebhookPayload,
    logId: string,
    retryCount: number
  ): Promise<void> {
    if (!webhook.retryConfig || retryCount > webhook.retryConfig.maxRetries) {
      return;
    }

    const delay = webhook.retryConfig.retryDelay * Math.pow(webhook.retryConfig.backoffMultiplier, retryCount - 1);
    const nextRetryAt = new Date(Date.now() + delay * 1000);

    // Mettre à jour le log
    await this.updateWebhookLog(logId, {
      status: 'retrying',
      retryCount,
      nextRetryAt
    });

    // Planifier la nouvelle tentative (utiliser Cloud Functions ou setTimeout)
    setTimeout(async () => {
      await this.retryWebhook(webhook, payload, logId, retryCount);
    }, delay * 1000);
  }

  /**
   * Réessayer un webhook
   */
  private async retryWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    logId: string,
    retryCount: number
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Retry': retryCount.toString(),
        ...webhook.headers
      };

      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000,
        validateStatus: () => true
      });

      // Mettre à jour le log
      await this.updateWebhookLog(logId, {
        status: response.status < 400 ? 'success' : 'failed',
        statusCode: response.status,
        response: response.data,
        executedAt: new Date(),
        retryCount
      });

      // Si encore en échec et des tentatives restantes
      if (response.status >= 400 && webhook.retryConfig && retryCount < webhook.retryConfig.maxRetries) {
        await this.scheduleRetry(webhook, payload, logId, retryCount + 1);
      }

    } catch (error: any) {
      // Mettre à jour le log
      await this.updateWebhookLog(logId, {
        status: 'failed',
        error: error.message,
        executedAt: new Date(),
        retryCount
      });

      // Planifier une nouvelle tentative si possible
      if (webhook.retryConfig && retryCount < webhook.retryConfig.maxRetries) {
        await this.scheduleRetry(webhook, payload, logId, retryCount + 1);
      }
    }
  }

  /**
   * Tester un webhook
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    response?: any;
    error?: string;
  }> {
    try {
      const webhook = await this.getWebhook(webhookId);
      if (!webhook) {
        throw new Error('Webhook non trouvé');
      }

      const testPayload: WebhookPayload = {
        event: 'project.created',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: 'Ceci est un test de webhook',
          webhookName: webhook.name
        },
        metadata: {
          isTest: true
        }
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test',
        'X-Webhook-Test': 'true',
        ...webhook.headers
      };

      if (webhook.secret) {
        const signature = this.generateSignature(testPayload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await axios.post(webhook.url, testPayload, {
        headers,
        timeout: 10000,
        validateStatus: () => true
      });

      return {
        success: response.status < 400,
        statusCode: response.status,
        response: response.data
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Récupérer les logs d'un webhook
   */
  async getWebhookLogs(webhookId: string, limitCount: number = 50): Promise<WebhookLog[]> {
    try {
      const q = query(
        collection(db, this.WEBHOOK_LOGS_COLLECTION),
        where('webhookId', '==', webhookId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        executedAt: doc.data().executedAt?.toDate(),
        nextRetryAt: doc.data().nextRetryAt?.toDate()
      } as WebhookLog));
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les statistiques des webhooks
   */
  async getWebhookStats(): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    totalTriggers: number;
    totalFailures: number;
    successRate: number;
    recentActivity: WebhookLog[];
  }> {
    try {
      const webhooks = await this.getWebhooks();
      const activeWebhooks = webhooks.filter(w => w.isActive).length;
      const totalTriggers = webhooks.reduce((sum, w) => sum + w.triggerCount, 0);
      const totalFailures = webhooks.reduce((sum, w) => sum + w.failureCount, 0);
      const successRate = totalTriggers > 0 ? ((totalTriggers - totalFailures) / totalTriggers) * 100 : 0;

      // Récupérer l'activité récente
      const q = query(
        collection(db, this.WEBHOOK_LOGS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const logsSnapshot = await getDocs(q);
      const recentActivity = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        executedAt: doc.data().executedAt?.toDate(),
        nextRetryAt: doc.data().nextRetryAt?.toDate()
      } as WebhookLog));

      return {
        totalWebhooks: webhooks.length,
        activeWebhooks,
        totalTriggers,
        totalFailures,
        successRate,
        recentActivity
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return {
        totalWebhooks: 0,
        activeWebhooks: 0,
        totalTriggers: 0,
        totalFailures: 0,
        successRate: 0,
        recentActivity: []
      };
    }
  }

  /**
   * Valider une URL de webhook
   */
  validateWebhookUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Vérifier que c'est HTTPS (sauf en développement)
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        return false;
      }
      // Vérifier que ce n'est pas localhost en production
      if (process.env.NODE_ENV === 'production' && 
          (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // === Méthodes privées ===

  /**
   * Récupérer les webhooks pour un événement
   */
  private async getWebhooksForEvent(event: WebhookEvent): Promise<Webhook[]> {
    try {
      const q = query(
        collection(db, this.WEBHOOKS_COLLECTION),
        where('isActive', '==', true),
        where('events', 'array-contains', event)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastModifiedAt: doc.data().lastModifiedAt?.toDate() || new Date(),
        lastTriggeredAt: doc.data().lastTriggeredAt?.toDate()
      } as Webhook));
    } catch (error) {
      console.error(`Erreur lors de la récupération des webhooks pour l'événement ${event}:`, error);
      return [];
    }
  }

  /**
   * Créer un log de webhook
   */
  private async createWebhookLog(webhook: Webhook, payload: WebhookPayload): Promise<string> {
    try {
      const log = {
        webhookId: webhook.id,
        webhookName: webhook.name,
        event: payload.event,
        url: webhook.url,
        payload,
        status: 'pending',
        retryCount: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.WEBHOOK_LOGS_COLLECTION), log);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du log:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un log de webhook
   */
  private async updateWebhookLog(logId: string, updates: Partial<WebhookLog>): Promise<void> {
    try {
      await updateDoc(doc(db, this.WEBHOOK_LOGS_COLLECTION, logId), updates);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du log:', error);
    }
  }

  /**
   * Générer une signature HMAC
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Générer un secret aléatoire
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Nettoyer les anciens logs
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const q = query(
        collection(db, this.WEBHOOK_LOGS_COLLECTION),
        where('createdAt', '<', Timestamp.fromDate(cutoffDate))
      );

      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`${querySnapshot.size} anciens logs de webhook supprimés`);
    } catch (error) {
      console.error('Erreur lors du nettoyage des logs:', error);
    }
  }
}

export const webhookService = new WebhookService();