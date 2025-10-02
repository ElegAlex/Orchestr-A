import { 
  collection, 
  doc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from '../types';
import { Service } from '../types/service';

export class UserServiceAssignmentService {
  private usersCollection = collection(db, 'users');
  private servicesCollection = collection(db, 'services');

  /**
   * Assigne un utilisateur à un service - NOUVELLE LOGIQUE MULTI-SERVICES
   */
  async assignUserToService(userId: string, serviceId: string | null): Promise<void> {
    try {
      const userRef = doc(this.usersCollection, userId);
      if (serviceId) {
        await updateDoc(userRef, {
          serviceIds: [serviceId],
          serviceId: null,
          updatedAt: new Date()
        });
      } else {
        await updateDoc(userRef, {
          serviceIds: [],
          serviceId: null,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error assigning user to service:', error);
      throw error;
    }
  }

  /**
   * Ajoute un service à un utilisateur
   */
  async addServiceToUser(userId: string, serviceId: string): Promise<void> {
    try {
      const userRef = doc(this.usersCollection, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('Utilisateur introuvable');
      }

      const userData = userDoc.data();
      const currentServiceIds = userData.serviceIds || [];
      
      if (!currentServiceIds.includes(serviceId)) {
        currentServiceIds.push(serviceId);
      }

      await updateDoc(userRef, {
        serviceIds: currentServiceIds,
        serviceId: null,
        updatedAt: new Date()
      });
      
    } catch (error) {
      console.error('Error adding service to user:', error);
      throw error;
    }
  }

  /**
   * Retire un service d'un utilisateur
   */
  async removeServiceFromUser(userId: string, serviceId: string): Promise<void> {
    try {
      const userRef = doc(this.usersCollection, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('Utilisateur introuvable');
      }

      const userData = userDoc.data();
      const currentServiceIds = userData.serviceIds || [];
      const updatedServiceIds = currentServiceIds.filter((id: string) => id !== serviceId);
      
      await updateDoc(userRef, {
        serviceIds: updatedServiceIds,
        serviceId: null,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error removing service from user:', error);
      throw error;
    }
  }

  /**
   * Définit tous les services d'un utilisateur (remplace la liste existante)
   */
  async setUserServices(userId: string, serviceIds: string[]): Promise<void> {
    try {
      const userRef = doc(this.usersCollection, userId);
      await updateDoc(userRef, {
        serviceIds: serviceIds,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error setting user services:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les utilisateurs d'un service (compatibilité ancienne + nouvelle logique)
   */
  async getUsersByService(serviceId: string): Promise<User[]> {
    try {
      // Récupérer tous les utilisateurs actifs
      const q = query(
        this.usersCollection,
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as User[];

      // Filtrer les utilisateurs qui ont ce service (ancienne et nouvelle logique)
      return allUsers.filter(user => 
        user.serviceId === serviceId || // Ancienne logique
        (user.serviceIds && user.serviceIds.includes(serviceId)) // Nouvelle logique
      );
    } catch (error) {
      console.error('Error fetching users by service:', error);
      throw error;
    }
  }

  /**
   * Récupère les utilisateurs non assignés à aucun service
   */
  async getUnassignedUsers(): Promise<User[]> {
    try {
      const q = query(
        this.usersCollection,
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as User[];

      // Filtrer ceux qui n'ont pas de service (ancienne et nouvelle logique)
      return allUsers.filter(user => 
        !user.serviceId && // Ancienne logique
        (!user.serviceIds || user.serviceIds.length === 0) // Nouvelle logique
      );
    } catch (error) {
      console.error('Error fetching unassigned users:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques d'affectation des services
   */
  async getServiceAssignmentStats(): Promise<{
    totalUsers: number;
    assignedUsers: number;
    unassignedUsers: number;
    serviceBreakdown: Array<{
      serviceId: string;
      serviceName: string;
      userCount: number;
      users: User[];
    }>;
  }> {
    try {
      const q = query(
        this.usersCollection,
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as User[];

      // Calculer les utilisateurs assignés (nouvelle et ancienne logique)
      const assignedUsers = allUsers.filter(user => 
        user.serviceId || (user.serviceIds && user.serviceIds.length > 0)
      );
      const unassignedUsers = allUsers.filter(user => 
        !user.serviceId && (!user.serviceIds || user.serviceIds.length === 0)
      );

      // Grouper par service (supporter les deux logiques)
      const serviceGroups = new Map<string, User[]>();
      
      allUsers.forEach(user => {
        // Ancienne logique - serviceId unique
        if (user.serviceId) {
          if (!serviceGroups.has(user.serviceId)) {
            serviceGroups.set(user.serviceId, []);
          }
          serviceGroups.get(user.serviceId)!.push(user);
        }
        
        // Nouvelle logique - serviceIds multiples
        if (user.serviceIds && user.serviceIds.length > 0) {
          user.serviceIds.forEach(serviceId => {
            if (!serviceGroups.has(serviceId)) {
              serviceGroups.set(serviceId, []);
            }
            // Éviter les doublons si l'utilisateur est déjà dans le groupe via serviceId
            if (!serviceGroups.get(serviceId)!.find(u => u.id === user.id)) {
              serviceGroups.get(serviceId)!.push(user);
            }
          });
        }
      });

      // Récupérer les noms des services
      const serviceBreakdown = [];
      const serviceIds = Array.from(serviceGroups.keys());
      
      for (const serviceId of serviceIds) {
        const users = serviceGroups.get(serviceId)!;
        try {
          const serviceDoc = await getDoc(doc(this.servicesCollection, serviceId));
          const serviceName = serviceDoc.exists() ? serviceDoc.data().name : 'Service inconnu';
          
          serviceBreakdown.push({
            serviceId,
            serviceName,
            userCount: users.length,
            users
          });
        } catch (error) {
          console.error(`Error fetching service ${serviceId}:`, error);
          serviceBreakdown.push({
            serviceId,
            serviceName: 'Service inconnu',
            userCount: users.length,
            users
          });
        }
      }

      return {
        totalUsers: allUsers.length,
        assignedUsers: assignedUsers.length,
        unassignedUsers: unassignedUsers.length,
        serviceBreakdown: serviceBreakdown.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
      };
    } catch (error) {
      console.error('Error fetching service assignment stats:', error);
      throw error;
    }
  }

  /**
   * Transfère tous les utilisateurs d'un service vers un autre
   */
  async transferUsersToService(fromServiceId: string, toServiceId: string | null): Promise<void> {
    try {
      const users = await this.getUsersByService(fromServiceId);
      
      const updatePromises = users.map(user => 
        this.assignUserToService(user.id, toServiceId)
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error transferring users between services:', error);
      throw error;
    }
  }
}

export const userServiceAssignmentService = new UserServiceAssignmentService();