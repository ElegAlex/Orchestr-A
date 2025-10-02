import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { User } from '../types';

interface Session {
  id: string;
  userId: string;
  userAgent: string;
  ipAddress?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
}

class SessionService {
  private readonly COLLECTION = 'sessions';
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 heures
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private sessionCheckInterval: NodeJS.Timer | null = null;
  private currentSessionId: string | null = null;

  /**
   * Créer une nouvelle session lors de la connexion
   */
  async createSession(user: User): Promise<Session> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);

    const session: Session = {
      id: sessionId,
      userId: user.id,
      userAgent: navigator.userAgent,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
      isActive: true,
      deviceInfo: this.getDeviceInfo()
    };

    // Sauvegarder la session dans Firestore
    await setDoc(doc(db, this.COLLECTION, sessionId), {
      ...session,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt)
    });

    // Sauvegarder l'ID de session localement
    this.currentSessionId = sessionId;
    localStorage.setItem('sessionId', sessionId);

    // Démarrer le monitoring de la session
    this.startSessionMonitoring();

    // Mettre à jour le lastLoginAt de l'utilisateur
    await updateDoc(doc(db, 'users', user.id), {
      lastLoginAt: serverTimestamp(),
      currentSessionId: sessionId
    });

    return session;
  }

  /**
   * Récupérer la session actuelle
   */
  async getCurrentSession(): Promise<Session | null> {
    const sessionId = this.currentSessionId || localStorage.getItem('sessionId');
    if (!sessionId) return null;

    try {
      const sessionDoc = await getDoc(doc(db, this.COLLECTION, sessionId));
      if (!sessionDoc.exists()) {
        this.clearLocalSession();
        return null;
      }

      const sessionData = sessionDoc.data();
      const session: Session = {
        id: sessionDoc.id,
        userId: sessionData.userId,
        userAgent: sessionData.userAgent,
        ipAddress: sessionData.ipAddress,
        createdAt: sessionData.createdAt?.toDate() || new Date(),
        lastActivityAt: sessionData.lastActivityAt?.toDate() || new Date(),
        expiresAt: sessionData.expiresAt?.toDate() || new Date(),
        isActive: sessionData.isActive,
        deviceInfo: sessionData.deviceInfo
      };

      // Vérifier si la session est expirée
      if (this.isSessionExpired(session)) {
        await this.endSession(sessionId);
        return null;
      }

      // Vérifier si la session est inactive
      if (this.isSessionIdle(session)) {
        await this.endSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Mettre à jour l'activité de la session
   */
  async updateSessionActivity(): Promise<void> {
    const sessionId = this.currentSessionId || localStorage.getItem('sessionId');
    if (!sessionId) return;

    try {
      await updateDoc(doc(db, this.COLLECTION, sessionId), {
        lastActivityAt: serverTimestamp()
      });
    } catch (error) {
      
    }
  }

  /**
   * Terminer une session
   */
  async endSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.currentSessionId || localStorage.getItem('sessionId');
    if (!id) return;

    try {
      // Marquer la session comme inactive
      await updateDoc(doc(db, this.COLLECTION, id), {
        isActive: false,
        endedAt: serverTimestamp()
      });

      // Si c'est la session courante, nettoyer
      if (id === this.currentSessionId || id === localStorage.getItem('sessionId')) {
        this.clearLocalSession();
      }
    } catch (error) {
      
    }
  }

  /**
   * Terminer toutes les sessions d'un utilisateur
   */
  async endAllUserSessions(userId: string): Promise<void> {
    try {
      // Récupérer toutes les sessions actives de l'utilisateur
      const sessions = await this.getUserSessions(userId, true);
      
      // Terminer chaque session
      const promises = sessions.map(session => this.endSession(session.id));
      await Promise.all(promises);
    } catch (error) {
      
    }
  }

  /**
   * Récupérer toutes les sessions d'un utilisateur
   */
  async getUserSessions(userId: string, activeOnly: boolean = false): Promise<Session[]> {
    try {
      let q = query(collection(db, this.COLLECTION), where('userId', '==', userId));
      
      if (activeOnly) {
        q = query(collection(db, this.COLLECTION), where('userId', '==', userId), where('isActive', '==', true));
      }
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastActivityAt: data.lastActivityAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          isActive: data.isActive,
          deviceInfo: data.deviceInfo
        } as Session;
      });
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Vérifier si une session est expirée
   */
  private isSessionExpired(session: Session): boolean {
    return new Date() > new Date(session.expiresAt);
  }

  /**
   * Vérifier si une session est inactive
   */
  private isSessionIdle(session: Session): boolean {
    const idleTime = Date.now() - new Date(session.lastActivityAt).getTime();
    return idleTime > this.IDLE_TIMEOUT;
  }

  /**
   * Démarrer le monitoring de la session
   */
  private startSessionMonitoring(): void {
    // Arrêter le monitoring existant
    this.stopSessionMonitoring();

    // Mettre à jour l'activité toutes les 5 minutes
    this.sessionCheckInterval = setInterval(() => {
      this.updateSessionActivity();
    }, 5 * 60 * 1000);

    // Écouter les événements d'activité utilisateur
    this.setupActivityListeners();
  }

  /**
   * Arrêter le monitoring de la session
   */
  private stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    this.removeActivityListeners();
  }

  /**
   * Configurer les écouteurs d'activité
   */
  private setupActivityListeners(): void {
    const updateActivity = this.debounce(() => {
      this.updateSessionActivity();
    }, 60000); // Débounce de 1 minute

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
  }

  /**
   * Supprimer les écouteurs d'activité
   */
  private removeActivityListeners(): void {
    // Note: En production, il faudrait stocker les références aux listeners
    // pour pouvoir les supprimer correctement
  }

  /**
   * Nettoyer la session locale
   */
  private clearLocalSession(): void {
    this.currentSessionId = null;
    localStorage.removeItem('sessionId');
    this.stopSessionMonitoring();
  }

  /**
   * Générer un ID de session unique
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtenir les informations sur l'appareil
   */
  private getDeviceInfo(): { browser?: string; os?: string; device?: string } {
    const userAgent = navigator.userAgent;
    const info: { browser?: string; os?: string; device?: string } = {};

    // Détecter le navigateur
    if (userAgent.includes('Chrome')) info.browser = 'Chrome';
    else if (userAgent.includes('Safari')) info.browser = 'Safari';
    else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
    else if (userAgent.includes('Edge')) info.browser = 'Edge';

    // Détecter l'OS
    if (userAgent.includes('Windows')) info.os = 'Windows';
    else if (userAgent.includes('Mac')) info.os = 'macOS';
    else if (userAgent.includes('Linux')) info.os = 'Linux';
    else if (userAgent.includes('Android')) info.os = 'Android';
    else if (userAgent.includes('iOS')) info.os = 'iOS';

    // Détecter le type d'appareil
    if (userAgent.includes('Mobile')) info.device = 'Mobile';
    else if (userAgent.includes('Tablet')) info.device = 'Tablet';
    else info.device = 'Desktop';

    return info;
  }

  /**
   * Fonction de débounce
   */
  private debounce(func: Function, wait: number): () => void {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Nettoyer les sessions expirées (à appeler périodiquement)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, this.COLLECTION),
        where('expiresAt', '<', now),
        where('isActive', '==', true)
      );
      const expiredSessions = await getDocs(q);

      const batch = writeBatch(db);
      expiredSessions.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false });
      });

      await batch.commit();
      console.log(`Cleaned up ${expiredSessions.size} expired sessions`);
    } catch (error) {
      
    }
  }

  /**
   * Obtenir des statistiques sur les sessions
   */
  async getSessionStats(): Promise<{
    totalActive: number;
    totalToday: number;
    averageDuration: number;
    deviceBreakdown: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Sessions actives
      const activeQuery = query(collection(db, this.COLLECTION), where('isActive', '==', true));
      const activeSessions = await getDocs(activeQuery);

      // Sessions d'aujourd'hui
      const todayQuery = query(collection(db, this.COLLECTION), where('createdAt', '>=', Timestamp.fromDate(todayStart)));
      const todaySessions = await getDocs(todayQuery);

      // Calcul de la durée moyenne
      let totalDuration = 0;
      let sessionCount = 0;
      const deviceCounts: Record<string, number> = {};

      todaySessions.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && data.lastActivityAt) {
          const duration = data.lastActivityAt.toDate().getTime() - data.createdAt.toDate().getTime();
          totalDuration += duration;
          sessionCount++;
        }

        // Compter les appareils
        const device = data.deviceInfo?.device || 'Unknown';
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      });

      return {
        totalActive: activeSessions.size,
        totalToday: todaySessions.size,
        averageDuration: sessionCount > 0 ? totalDuration / sessionCount : 0,
        deviceBreakdown: deviceCounts
      };
    } catch (error) {
      
      return {
        totalActive: 0,
        totalToday: 0,
        averageDuration: 0,
        deviceBreakdown: {}
      };
    }
  }
}

export const sessionService = new SessionService();