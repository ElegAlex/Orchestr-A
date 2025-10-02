import { User } from '../types';
import { doc, getDoc, getDocs, query, collection, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

interface SimulationContext {
  isActive: boolean;
  simulatedUser: User | null;
  originalUserId: string;
  startedAt: Date;
}

class UserSimulationService {
  private simulationContext: SimulationContext = {
    isActive: false,
    simulatedUser: null,
    originalUserId: '',
    startedAt: new Date()
  };

  private listeners: Array<(context: SimulationContext) => void> = [];

  /**
   * Démarre la simulation d'un utilisateur
   */
  async startSimulation(adminUserId: string, targetUserId: string): Promise<User | null> {
    try {
      // Vérifier que l'utilisateur admin a bien les droits
      const adminDoc = await getDoc(doc(db, 'users', adminUserId));
      if (!adminDoc.exists()) {
        throw new Error('Utilisateur admin introuvable');
      }

      const adminUser = { id: adminDoc.id, ...adminDoc.data() } as User;
      if (adminUser.role !== 'admin') {
        throw new Error('Seuls les administrateurs peuvent simuler des utilisateurs');
      }

      // Récupérer l'utilisateur cible
      const targetDoc = await getDoc(doc(db, 'users', targetUserId));
      if (!targetDoc.exists()) {
        throw new Error('Utilisateur cible introuvable');
      }

      const targetUser = { id: targetDoc.id, ...targetDoc.data() } as User;

      // Activer la simulation
      this.simulationContext = {
        isActive: true,
        simulatedUser: targetUser,
        originalUserId: adminUserId,
        startedAt: new Date()
      };

      // Notifier les listeners
      this.notifyListeners();

      console.log('🎭 Simulation démarrée:', {
        admin: adminUser.displayName || adminUser.email,
        target: targetUser.displayName || targetUser.email
      });

      return targetUser;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Arrête la simulation
   */
  stopSimulation(): void {
    console.log('🎭 Simulation arrêtée après',
      Math.round((new Date().getTime() - this.simulationContext.startedAt.getTime()) / 1000), 's'
    );

    this.simulationContext = {
      isActive: false,
      simulatedUser: null,
      originalUserId: '',
      startedAt: new Date()
    };

    this.notifyListeners();
  }

  /**
   * Obtient le contexte de simulation actuel
   */
  getSimulationContext(): SimulationContext {
    return { ...this.simulationContext };
  }

  /**
   * Obtient l'utilisateur effectif (simulé ou réel)
   */
  getEffectiveUser(currentUser: User | null): User | null {
    if (this.simulationContext.isActive && this.simulationContext.simulatedUser) {
      return this.simulationContext.simulatedUser;
    }
    return currentUser;
  }

  /**
   * Vérifie si on est en mode simulation
   */
  isSimulating(): boolean {
    return this.simulationContext.isActive;
  }

  /**
   * Obtient l'utilisateur simulé
   */
  getSimulatedUser(): User | null {
    return this.simulationContext.simulatedUser;
  }

  /**
   * Obtient l'ID de l'admin qui effectue la simulation
   */
  getOriginalUserId(): string {
    return this.simulationContext.originalUserId;
  }

  /**
   * Récupère la liste des utilisateurs pouvant être simulés
   */
  async getSimulatableUsers(adminUserId: string): Promise<User[]> {
    try {
      const usersQuery = query(collection(db, 'users'), limit(100));
      const usersSnapshot = await getDocs(usersQuery);

      return usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as User))
        .filter(user => user.id !== adminUserId) // Exclure l'admin lui-même
        .sort((a, b) => {
          const nameA = a.displayName || `${a.firstName} ${a.lastName}` || a.email;
          const nameB = b.displayName || `${b.firstName} ${b.lastName}` || b.email;
          return nameA.localeCompare(nameB);
        });
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Abonne un listener aux changements de simulation
   */
  subscribe(listener: (context: SimulationContext) => void): () => void {
    this.listeners.push(listener);

    // Retourne une fonction de désabonnement
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notifie tous les listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.simulationContext);
      } catch (error) {
        
      }
    });
  }

  /**
   * Obtient l'ID effectif de l'utilisateur (simulé ou réel)
   */
  getEffectiveUserId(currentUserId: string | undefined): string | undefined {
    if (this.simulationContext.isActive && this.simulationContext.simulatedUser) {
      return this.simulationContext.simulatedUser.id;
    }
    return currentUserId;
  }

  /**
   * Crée un log d'audit pour la simulation
   */
  private async logSimulationAudit(action: 'START' | 'STOP', adminUserId: string, targetUserId?: string): Promise<void> {
    try {
      const auditData = {
        type: 'USER_SIMULATION',
        action,
        adminUserId,
        targetUserId: targetUserId || this.simulationContext.simulatedUser?.id,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ip: 'client-side' // En production, obtenir l'IP côté serveur
      };

      // Dans une vraie implémentation, sauvegarder dans Firestore
    } catch (error) {
      
    }
  }
}

export const userSimulationService = new UserSimulationService();