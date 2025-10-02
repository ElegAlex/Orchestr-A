import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * NOUVEAU MODÈLE UNIFIÉ - Une entrée par jour
 */
export interface TeleworkDay {
  id: string;                    // userId_YYYY-MM-DD
  userId: string;
  date: Timestamp | Date;        // Support both for flexibility
  isRemote: boolean;
  source: 'weekly_pattern' | 'user_override' | 'admin_set';
  note?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Pattern pour création en masse
 */
export interface WeeklyPattern {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

class TeleworkCalendarService {
  private readonly COLLECTION_NAME = 'teleworkDays';

  /**
   * Obtenir l'ID unique pour un jour donné
   */
  private getDayId(userId: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${userId}_${year}-${month}-${day}`;
  }

  /**
   * Basculer l'état télétravail pour un jour donné
   */
  async toggleDay(userId: string, date: Date, currentUserId: string): Promise<boolean> {
    try {
      const dayId = this.getDayId(userId, date);
      const docRef = doc(db, this.COLLECTION_NAME, dayId);
      const docSnap = await getDoc(docRef);

      let newIsRemote: boolean;

      if (docSnap.exists()) {
        // Le jour existe déjà, basculer l'état
        const currentDay = docSnap.data() as TeleworkDay;
        newIsRemote = !currentDay.isRemote;

        await setDoc(docRef, {
          ...currentDay,
          isRemote: newIsRemote,
          source: 'user_override',
          updatedAt: Timestamp.now(),
          updatedBy: currentUserId
        });
      } else {
        // Nouveau jour, créer en télétravail
        newIsRemote = true;

        const newDay: TeleworkDay = {
          id: dayId,
          userId,
          date: Timestamp.fromDate(date),
          isRemote: newIsRemote,
          source: 'user_override',
          createdAt: Timestamp.now(),
          createdBy: currentUserId
        };

        await setDoc(docRef, newDay);
      }

      return newIsRemote;

    } catch (error) {
      console.error('❌ Erreur lors du basculement télétravail:', error);
      throw error;
    }
  }

  /**
   * Supprimer complètement un jour (retour à l'état par défaut)
   */
  async removeDay(userId: string, date: Date): Promise<void> {
    try {
      const dayId = this.getDayId(userId, date);
      const docRef = doc(db, this.COLLECTION_NAME, dayId);

      await deleteDoc(docRef);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'état télétravail pour un jour donné
   */
  async getDay(userId: string, date: Date): Promise<TeleworkDay | null> {
    try {
      const dayId = this.getDayId(userId, date);
      const docRef = doc(db, this.COLLECTION_NAME, dayId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: dayId,
          ...docSnap.data()
        } as TeleworkDay;
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération:', error);
      return null;
    }
  }

  /**
   * Obtenir tous les jours télétravail pour un utilisateur sur une période
   */
  async getUserDays(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, TeleworkDay>> {
    try {
      // Firestore ne peut pas faire 2 range queries, donc on filtre côté client
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('date')
      );

      const querySnapshot = await getDocs(q);
      const daysMap = new Map<string, TeleworkDay>();
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      querySnapshot.forEach((doc) => {
        const dayData = doc.data() as TeleworkDay;
        const dayTimestamp = dayData.date as Timestamp;

        // Filtrer par période côté client
        if (dayTimestamp.seconds >= startTimestamp.seconds &&
            dayTimestamp.seconds <= endTimestamp.seconds) {
          const dayDate = dayTimestamp.toDate();
          const dateKey = this.getDayId(userId, dayDate);
          daysMap.set(dateKey, {
            ...dayData,
            id: doc.id,
            date: dayDate
          });
        }
      });

      return daysMap;

    } catch (error) {
      console.error('❌ Erreur lors du chargement des jours:', error);
      return new Map();
    }
  }

  /**
   * Créer un pattern hebdomadaire sur une période
   */
  async createWeeklyPattern(
    userId: string,
    pattern: WeeklyPattern,
    startDate: Date,
    endDate: Date,
    currentUserId: string
  ): Promise<number> {
    try {
      const batch = writeBatch(db);
      let createdCount = 0;

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = dimanche, 1 = lundi, etc.

        // Mapper jour de la semaine avec pattern
        const dayMapping: Record<number, keyof WeeklyPattern> = {
          0: 'sunday',
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday'
        };

        const dayKey = dayMapping[dayOfWeek];
        const shouldBeRemote = pattern[dayKey];

        if (shouldBeRemote) {
          const dayId = this.getDayId(userId, new Date(currentDate));
          const docRef = doc(db, this.COLLECTION_NAME, dayId);

          const teleworkDay: TeleworkDay = {
            id: dayId,
            userId,
            date: Timestamp.fromDate(new Date(currentDate)),
            isRemote: true,
            source: 'weekly_pattern',
            note: 'Généré par pattern hebdomadaire',
            createdAt: Timestamp.now(),
            createdBy: currentUserId
          };

          batch.set(docRef, teleworkDay);
          createdCount++;
        }

        // Jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await batch.commit();
      return createdCount;

    } catch (error) {
      console.error('❌ Erreur lors de la création du pattern:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques télétravail pour une période
   */
  async getStats(userId: string, startDate: Date, endDate: Date): Promise<{
    totalDays: number;
    remoteDays: number;
    officeDays: number;
    remotePercentage: number;
  }> {
    try {
      const daysMap = await this.getUserDays(userId, startDate, endDate);

      let totalWorkDays = 0;
      let remoteDays = 0;

      // Compter tous les jours ouvrables de la période
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();

        // Exclure weekends (samedi=6, dimanche=0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          totalWorkDays++;

          const dayKey = this.getDayId(userId, currentDate);
          if (daysMap.has(dayKey) && daysMap.get(dayKey)!.isRemote) {
            remoteDays++;
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const officeDays = totalWorkDays - remoteDays;
      const remotePercentage = totalWorkDays > 0 ? Math.round((remoteDays / totalWorkDays) * 100) : 0;

      return {
        totalDays: totalWorkDays,
        remoteDays,
        officeDays,
        remotePercentage
      };

    } catch (error) {
      console.error('❌ Erreur lors du calcul des stats:', error);
      return {
        totalDays: 0,
        remoteDays: 0,
        officeDays: 0,
        remotePercentage: 0
      };
    }
  }
}

export const teleworkCalendarService = new TeleworkCalendarService();