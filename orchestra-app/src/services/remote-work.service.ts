import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface RemoteWorkSchedule {
  userId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface RemoteWorkDay {
  userId: string;
  date: Date;
  isRemote: boolean;
  note?: string;
  createdAt: Timestamp;
  createdBy: string;
}

class RemoteWorkService {
  private readonly COLLECTION_NAME = 'remoteWorkSchedules';
  private readonly DAYS_COLLECTION = 'remoteWorkDays';

  /**
   * Récupère le planning de télétravail hebdomadaire d'un utilisateur
   */
  async getUserRemoteSchedule(userId: string): Promise<RemoteWorkSchedule | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          userId,
          ...docSnap.data()
        } as RemoteWorkSchedule;
      }

      // Retourner un planning par défaut (tout en présentiel)
      return {
        userId,
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
        updatedAt: Timestamp.now(),
        updatedBy: userId
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du planning télétravail:', error);
      return null;
    }
  }

  /**
   * Met à jour le planning de télétravail hebdomadaire
   */
  async updateUserRemoteSchedule(
    userId: string,
    schedule: Partial<RemoteWorkSchedule>,
    updatedBy: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, userId);

      const data = {
        ...schedule,
        userId,
        updatedAt: Timestamp.now(),
        updatedBy
      };

      await setDoc(docRef, data, { merge: true });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du planning télétravail:', error);
      throw error;
    }
  }

  /**
   * Bascule l'état de télétravail pour un jour spécifique
   */
  async toggleDayRemoteStatus(
    userId: string,
    dayOfWeek: keyof Omit<RemoteWorkSchedule, 'userId' | 'updatedAt' | 'updatedBy'>,
    updatedBy: string
  ): Promise<boolean> {
    try {
      // Récupérer l'état actuel
      const currentSchedule = await this.getUserRemoteSchedule(userId);
      if (!currentSchedule) {
        throw new Error('Impossible de récupérer le planning actuel');
      }

      // Basculer l'état
      const newStatus = !currentSchedule[dayOfWeek];

      // Mettre à jour
      await this.updateUserRemoteSchedule(
        userId,
        { [dayOfWeek]: newStatus },
        updatedBy
      );

      return newStatus;
    } catch (error) {
      console.error('Erreur lors du basculement du statut télétravail:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur est en télétravail pour une date donnée
   */
  async isUserRemoteOnDate(userId: string, date: Date): Promise<boolean> {
    try {
      // Récupérer le planning hebdomadaire
      const schedule = await this.getUserRemoteSchedule(userId);
      if (!schedule) return false;

      // Mapper le jour de la semaine
      const dayOfWeek = date.getDay();
      const dayMapping: Record<number, keyof RemoteWorkSchedule> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
      };

      const dayKey = dayMapping[dayOfWeek];
      return schedule[dayKey] as boolean || false;
    } catch (error) {
      console.error('Erreur lors de la vérification du télétravail:', error);
      return false;
    }
  }

  /**
   * Enregistre une journée spécifique de télétravail (override)
   */
  async setSpecificRemoteDay(
    userId: string,
    date: Date,
    isRemote: boolean,
    note: string = '',
    createdBy: string
  ): Promise<void> {
    try {
      // Créer un ID unique basé sur userId et date (format local pour éviter les problèmes de timezone)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const docId = `${userId}_${dateStr}`;

      const docRef = doc(db, this.DAYS_COLLECTION, docId);

      const data: RemoteWorkDay = {
        userId,
        date,
        isRemote,
        note,
        createdAt: Timestamp.now(),
        createdBy
      };

      console.log('🔥 FIREBASE CREATE - Tentative de création:', {
        collection: this.DAYS_COLLECTION,
        docId,
        data: { ...data, date: dateStr }
      });

      await setDoc(docRef, data);
      console.log('✅ Document créé avec succès:', docId);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du jour de télétravail:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques de télétravail pour une période
   */
  async getRemoteWorkStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDays: number;
    remoteDays: number;
    officeDays: number;
    remotePercentage: number;
  }> {
    try {
      let remoteDays = 0;
      let officeDays = 0;
      let totalDays = 0;

      const schedule = await this.getUserRemoteSchedule(userId);
      if (!schedule) {
        return {
          totalDays: 0,
          remoteDays: 0,
          officeDays: 0,
          remotePercentage: 0
        };
      }

      // Parcourir chaque jour de la période
      const current = new Date(startDate);
      while (current <= endDate) {
        // Exclure les weekends
        if (current.getDay() !== 0 && current.getDay() !== 6) {
          totalDays++;

          const isRemote = await this.isUserRemoteOnDate(userId, current);
          if (isRemote) {
            remoteDays++;
          } else {
            officeDays++;
          }
        }

        current.setDate(current.getDate() + 1);
      }

      const remotePercentage = totalDays > 0 ? (remoteDays / totalDays) * 100 : 0;

      return {
        totalDays,
        remoteDays,
        officeDays,
        remotePercentage: Math.round(remotePercentage)
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques télétravail:', error);
      return {
        totalDays: 0,
        remoteDays: 0,
        officeDays: 0,
        remotePercentage: 0
      };
    }
  }

  /**
   * Écoute les changements du planning télétravail en temps réel
   */
  subscribeToRemoteSchedule(
    userId: string,
    callback: (schedule: RemoteWorkSchedule | null) => void
  ): () => void {
    const docRef = doc(db, this.COLLECTION_NAME, userId);

    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({
          userId,
          ...doc.data()
        } as RemoteWorkSchedule);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Erreur lors de l\'écoute du planning télétravail:', error);
      callback(null);
    });

    return unsubscribe;
  }

  /**
   * Récupère un jour spécifique de télétravail pour un utilisateur
   */
  async getSpecificRemoteDay(userId: string, date: Date): Promise<RemoteWorkDay | null> {
    try {
      // Format local pour éviter les problèmes de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const docId = `${userId}_${dateStr}`;
      const docRef = doc(db, this.DAYS_COLLECTION, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          userId,
          ...docSnap.data()
        } as RemoteWorkDay;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du jour de télétravail:', error);
      return null;
    }
  }

  /**
   * Supprime une journée spécifique de télétravail (exception ponctuelle)
   */
  async deleteSpecificRemoteDay(userId: string, date: Date): Promise<void> {
    try {
      // Format local pour éviter les problèmes de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const docId = `${userId}_${dateStr}`;

      console.log('🔥 FIREBASE DELETE - Tentative de suppression:', {
        collection: this.DAYS_COLLECTION,
        docId,
        userId,
        date: dateStr
      });

      const docRef = doc(db, this.DAYS_COLLECTION, docId);

      // Vérifier si le document existe avant suppression
      const docSnap = await getDoc(docRef);
      console.log('🔍 Document existe avant suppression:', docSnap.exists());

      await deleteDoc(docRef);

      // Vérifier si le document a été supprimé
      const docSnapAfter = await getDoc(docRef);
      console.log('✅ Document supprimé avec succès:', !docSnapAfter.exists());

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du jour de télétravail:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les utilisateurs en télétravail pour une date donnée
   */
  async getRemoteUsersForDate(date: Date): Promise<string[]> {
    try {
      // Cette méthode nécessiterait une query Firestore plus complexe
      // Pour l'instant, on retourne un tableau vide
      // À implémenter selon les besoins
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs en télétravail:', error);
      return [];
    }
  }
}

export const remoteWorkService = new RemoteWorkService();