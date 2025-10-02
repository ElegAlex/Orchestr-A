import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Holiday, HolidayType } from '../types';

class HolidayService {
  private readonly HOLIDAYS_COLLECTION = 'holidays';

  // ========================================
  // CALCUL AUTOMATIQUE DES JOURS FÉRIÉS FRANÇAIS
  // ========================================

  /**
   * Calcule tous les jours fériés français pour une année donnée
   */
  generateFrenchHolidays(year: number): Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>[] {
    const holidays: Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Jours fériés fixes
    const fixedHolidays = [
      { name: 'Jour de l\'An', month: 0, day: 1 },
      { name: 'Fête du Travail', month: 4, day: 1 },
      { name: 'Fête de la Victoire', month: 4, day: 8 },
      { name: 'Fête Nationale', month: 6, day: 14 },
      { name: 'Assomption', month: 7, day: 15 },
      { name: 'Toussaint', month: 10, day: 1 },
      { name: 'Armistice', month: 10, day: 11 },
      { name: 'Noël', month: 11, day: 25 },
    ];

    fixedHolidays.forEach(holiday => {
      holidays.push({
        name: holiday.name,
        date: new Date(year, holiday.month, holiday.day),
        type: 'FIXED',
        isNational: true,
      });
    });

    // Calcul de Pâques (algorithme de Gauss)
    const easter = this.calculateEaster(year);
    
    // Jours fériés basés sur Pâques
    const easterBasedHolidays = [
      { name: 'Lundi de Pâques', offset: 1 },
      { name: 'Ascension', offset: 39 },
      { name: 'Lundi de Pentecôte', offset: 50 },
    ];

    easterBasedHolidays.forEach(holiday => {
      const date = new Date(easter);
      date.setDate(date.getDate() + holiday.offset);
      
      holidays.push({
        name: holiday.name,
        date: date,
        type: 'CALCULATED',
        isNational: true,
      });
    });

    // Jours fériés spécifiques à l'Alsace-Moselle
    const alsaceMoselleHolidays = [
      { name: 'Vendredi Saint', offset: -2, baseDate: easter },
      { name: 'Saint-Étienne', month: 11, day: 26 },
    ];

    // Vendredi Saint (2 jours avant Pâques)
    const goodFriday = new Date(easter);
    goodFriday.setDate(goodFriday.getDate() - 2);
    
    holidays.push({
      name: 'Vendredi Saint',
      date: goodFriday,
      type: 'CALCULATED',
      isNational: false,
      regions: ['Alsace', 'Moselle'],
    });

    // Saint-Étienne (26 décembre)
    holidays.push({
      name: 'Saint-Étienne',
      date: new Date(year, 11, 26),
      type: 'FIXED',
      isNational: false,
      regions: ['Alsace', 'Moselle'],
    });

    return holidays;
  }

  /**
   * Calcule la date de Pâques pour une année donnée (algorithme de Gauss)
   */
  private calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = Math.floor((h + l - 7 * m + 114) / 31);
    const p = (h + l - 7 * m + 114) % 31;

    return new Date(year, n - 1, p + 1);
  }

  // ========================================
  // CRUD OPERATIONS
  // ========================================

  /**
   * Récupère tous les jours fériés pour une année
   */
  async getHolidaysByYear(year: number): Promise<Holiday[]> {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      const q = query(
        collection(db, this.HOLIDAYS_COLLECTION),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Holiday[];
    } catch (error) {
      console.error('Erreur lors de la récupération des jours fériés:', error);
      throw error;
    }
  }

  /**
   * Récupère les jours fériés pour une période donnée
   */
  async getHolidaysByPeriod(startDate: Date, endDate: Date): Promise<Holiday[]> {
    try {
      const q = query(
        collection(db, this.HOLIDAYS_COLLECTION),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Holiday[];
    } catch (error) {
      console.error('Erreur lors de la récupération des jours fériés:', error);
      throw error;
    }
  }

  /**
   * Ajoute un jour férié personnalisé
   */
  async addHoliday(holiday: Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.HOLIDAYS_COLLECTION), {
        ...holiday,
        date: Timestamp.fromDate(holiday.date),
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du jour férié:', error);
      throw error;
    }
  }

  /**
   * Met à jour un jour férié (notamment pour override en jour ouvré)
   */
  async updateHoliday(holidayId: string, updates: Partial<Holiday>): Promise<void> {
    try {
      const docRef = doc(db, this.HOLIDAYS_COLLECTION, holidayId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
        ...(updates.date && { date: Timestamp.fromDate(updates.date) }),
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du jour férié:', error);
      throw error;
    }
  }

  /**
   * Supprime un jour férié
   */
  async deleteHoliday(holidayId: string): Promise<void> {
    try {
      const docRef = doc(db, this.HOLIDAYS_COLLECTION, holidayId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erreur lors de la suppression du jour férié:', error);
      throw error;
    }
  }

  /**
   * Initialise automatiquement les jours fériés pour une année
   */
  async initializeYearHolidays(year: number): Promise<void> {
    try {
      // Vérifier si les jours fériés existent déjà
      const existingHolidays = await this.getHolidaysByYear(year);
      if (existingHolidays.length > 0) {
        console.log(`Les jours fériés pour ${year} existent déjà`);
        return;
      }

      // Générer et sauvegarder les jours fériés
      const holidays = this.generateFrenchHolidays(year);
      
      const promises = holidays.map(holiday => this.addHoliday(holiday));
      await Promise.all(promises);

      console.log(`${holidays.length} jours fériés initialisés pour ${year}`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des jours fériés:', error);
      throw error;
    }
  }

  /**
   * Override un jour férié en jour ouvré
   */
  async overrideAsWorkingDay(holidayId: string, isWorkingDay: boolean): Promise<void> {
    try {
      await this.updateHoliday(holidayId, { isWorkingDay });
    } catch (error) {
      console.error('Erreur lors de l\'override du jour férié:', error);
      throw error;
    }
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * Vérifie si une date est un jour férié
   */
  async isHoliday(date: Date, region?: string): Promise<boolean> {
    try {
      const holidays = await this.getHolidaysByPeriod(date, date);
      
      return holidays.some(holiday => {
        // Si c'est un jour férié override en jour ouvré, ce n'est plus férié
        if (holiday.isWorkingDay) return false;

        // Vérifier la région si spécifiée
        if (region && !holiday.isNational && holiday.regions && !holiday.regions.includes(region)) {
          return false;
        }

        return this.isSameDay(holiday.date, date);
      });
    } catch (error) {
      console.error('Erreur lors de la vérification du jour férié:', error);
      return false;
    }
  }

  /**
   * Compte le nombre de jours ouvrés entre deux dates
   */
  async getWorkingDaysBetween(startDate: Date, endDate: Date, region?: string): Promise<number> {
    try {
      const holidays = await this.getHolidaysByPeriod(startDate, endDate);
      let workingDays = 0;
      
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        // Ignorer les weekends (samedi = 6, dimanche = 0)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Vérifier si c'est un jour férié
          const isHolidayDay = holidays.some(holiday => {
            // Si override en jour ouvré, ce n'est plus férié
            if (holiday.isWorkingDay) return false;

            // Vérifier la région
            if (region && !holiday.isNational && holiday.regions && !holiday.regions.includes(region)) {
              return false;
            }

            return this.isSameDay(holiday.date, currentDate);
          });

          if (!isHolidayDay) {
            workingDays++;
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return workingDays;
    } catch (error) {
      console.error('Erreur lors du calcul des jours ouvrés:', error);
      throw error;
    }
  }

  /**
   * Récupère les prochains jours fériés
   */
  async getUpcomingHolidays(limit: number = 5): Promise<Holiday[]> {
    try {
      const today = new Date();
      const nextYear = new Date(today.getFullYear() + 1, 11, 31);

      const q = query(
        collection(db, this.HOLIDAYS_COLLECTION),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<=', Timestamp.fromDate(nextYear)),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      const holidays = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Holiday[];

      return holidays.slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération des prochains jours fériés:', error);
      throw error;
    }
  }

  /**
   * Utilitaire pour comparer deux dates (même jour)
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Formate une date pour l'affichage
   */
  formatHolidayDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Récupère les statistiques des jours fériés pour une année
   */
  async getHolidayStats(year: number): Promise<{
    total: number;
    national: number;
    regional: number;
    workingDayOverrides: number;
    byMonth: { [month: string]: number };
  }> {
    try {
      const holidays = await this.getHolidaysByYear(year);
      
      const stats = {
        total: holidays.length,
        national: holidays.filter(h => h.isNational).length,
        regional: holidays.filter(h => !h.isNational).length,
        workingDayOverrides: holidays.filter(h => h.isWorkingDay).length,
        byMonth: {} as { [month: string]: number },
      };

      // Répartition par mois
      holidays.forEach(holiday => {
        const month = holiday.date.toLocaleDateString('fr-FR', { month: 'long' });
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  }
}

export const holidayService = new HolidayService();