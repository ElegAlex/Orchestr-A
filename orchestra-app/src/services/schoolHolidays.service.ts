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
import { SchoolHoliday, SchoolHolidayZone, SchoolHolidayPeriod } from '../types';

class SchoolHolidaysService {
  private readonly SCHOOL_HOLIDAYS_COLLECTION = 'schoolHolidays';

  // ========================================
  // DONNÉES OFFICIELLES CONGÉS SCOLAIRES FRANÇAIS
  // ========================================

  /**
   * Génère les congés scolaires français officiels pour une année scolaire
   * @param schoolYear Année de début (ex: 2024 pour 2024-2025)
   */
  generateFrenchSchoolHolidays(schoolYear: number): Omit<SchoolHoliday, 'id' | 'createdAt' | 'updatedAt'>[] {
    const holidays: Omit<SchoolHoliday, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Calendrier officiel 2024-2025 (source: Ministère de l'Éducation Nationale)
    if (schoolYear === 2024) {
      // Toussaint 2024 (toutes zones)
      holidays.push({
        name: 'Vacances de la Toussaint 2024',
        period: 'TOUSSAINT',
        zone: 'ALL',
        startDate: new Date(2024, 9, 19), // 19 octobre 2024
        endDate: new Date(2024, 10, 4), // 4 novembre 2024
        year: schoolYear,
      });

      // Noël 2024 (toutes zones)
      holidays.push({
        name: 'Vacances de Noël 2024',
        period: 'NOEL',
        zone: 'ALL',
        startDate: new Date(2024, 11, 21), // 21 décembre 2024
        endDate: new Date(2025, 0, 6), // 6 janvier 2025
        year: schoolYear,
      });

      // Hiver 2025 - Zone A
      holidays.push({
        name: 'Vacances d\'hiver 2025 - Zone A',
        period: 'HIVER',
        zone: 'A',
        startDate: new Date(2025, 1, 8), // 8 février 2025
        endDate: new Date(2025, 1, 24), // 24 février 2025
        year: schoolYear,
      });

      // Hiver 2025 - Zone B
      holidays.push({
        name: 'Vacances d\'hiver 2025 - Zone B',
        period: 'HIVER',
        zone: 'B',
        startDate: new Date(2025, 1, 15), // 15 février 2025
        endDate: new Date(2025, 2, 3), // 3 mars 2025
        year: schoolYear,
      });

      // Hiver 2025 - Zone C
      holidays.push({
        name: 'Vacances d\'hiver 2025 - Zone C',
        period: 'HIVER',
        zone: 'C',
        startDate: new Date(2025, 1, 22), // 22 février 2025
        endDate: new Date(2025, 2, 10), // 10 mars 2025
        year: schoolYear,
      });

      // Printemps 2025 - Zone A
      holidays.push({
        name: 'Vacances de printemps 2025 - Zone A',
        period: 'PRINTEMPS',
        zone: 'A',
        startDate: new Date(2025, 3, 5), // 5 avril 2025
        endDate: new Date(2025, 3, 22), // 22 avril 2025
        year: schoolYear,
      });

      // Printemps 2025 - Zone B
      holidays.push({
        name: 'Vacances de printemps 2025 - Zone B',
        period: 'PRINTEMPS',
        zone: 'B',
        startDate: new Date(2025, 3, 12), // 12 avril 2025
        endDate: new Date(2025, 3, 28), // 28 avril 2025
        year: schoolYear,
      });

      // Printemps 2025 - Zone C
      holidays.push({
        name: 'Vacances de printemps 2025 - Zone C',
        period: 'PRINTEMPS',
        zone: 'C',
        startDate: new Date(2025, 3, 19), // 19 avril 2025
        endDate: new Date(2025, 4, 5), // 5 mai 2025
        year: schoolYear,
      });

      // Été 2025 (toutes zones)
      holidays.push({
        name: 'Grandes vacances d\'été 2025',
        period: 'ETE',
        zone: 'ALL',
        startDate: new Date(2025, 6, 5), // 5 juillet 2025
        endDate: new Date(2025, 8, 1), // 1er septembre 2025
        year: schoolYear,
      });
    }

    // Calendrier 2025-2026
    if (schoolYear === 2025) {
      // Toussaint 2025
      holidays.push({
        name: 'Vacances de la Toussaint 2025',
        period: 'TOUSSAINT',
        zone: 'ALL',
        startDate: new Date(2025, 9, 18), // 18 octobre 2025
        endDate: new Date(2025, 10, 3), // 3 novembre 2025
        year: schoolYear,
      });

      // Noël 2025
      holidays.push({
        name: 'Vacances de Noël 2025',
        period: 'NOEL',
        zone: 'ALL',
        startDate: new Date(2025, 11, 20), // 20 décembre 2025
        endDate: new Date(2026, 0, 5), // 5 janvier 2026
        year: schoolYear,
      });

      // Hiver 2026 - Zone A
      holidays.push({
        name: 'Vacances d\'hiver 2026 - Zone A',
        period: 'HIVER',
        zone: 'A',
        startDate: new Date(2026, 1, 7), // 7 février 2026
        endDate: new Date(2026, 1, 23), // 23 février 2026
        year: schoolYear,
      });

      // Hiver 2026 - Zone B
      holidays.push({
        name: 'Vacances d\'hiver 2026 - Zone B',
        period: 'HIVER',
        zone: 'B',
        startDate: new Date(2026, 1, 21), // 21 février 2026
        endDate: new Date(2026, 2, 9), // 9 mars 2026
        year: schoolYear,
      });

      // Hiver 2026 - Zone C
      holidays.push({
        name: 'Vacances d\'hiver 2026 - Zone C',
        period: 'HIVER',
        zone: 'C',
        startDate: new Date(2026, 1, 14), // 14 février 2026
        endDate: new Date(2026, 2, 2), // 2 mars 2026
        year: schoolYear,
      });

      // Printemps 2026 - Zone A
      holidays.push({
        name: 'Vacances de printemps 2026 - Zone A',
        period: 'PRINTEMPS',
        zone: 'A',
        startDate: new Date(2026, 3, 4), // 4 avril 2026
        endDate: new Date(2026, 3, 20), // 20 avril 2026
        year: schoolYear,
      });

      // Printemps 2026 - Zone B
      holidays.push({
        name: 'Vacances de printemps 2026 - Zone B',
        period: 'PRINTEMPS',
        zone: 'B',
        startDate: new Date(2026, 3, 18), // 18 avril 2026
        endDate: new Date(2026, 4, 4), // 4 mai 2026
        year: schoolYear,
      });

      // Printemps 2026 - Zone C
      holidays.push({
        name: 'Vacances de printemps 2026 - Zone C',
        period: 'PRINTEMPS',
        zone: 'C',
        startDate: new Date(2026, 3, 11), // 11 avril 2026
        endDate: new Date(2026, 3, 27), // 27 avril 2026
        year: schoolYear,
      });

      // Été 2026
      holidays.push({
        name: 'Grandes vacances d\'été 2026',
        period: 'ETE',
        zone: 'ALL',
        startDate: new Date(2026, 6, 4), // 4 juillet 2026
        endDate: new Date(2026, 8, 1), // 1er septembre 2026
        year: schoolYear,
      });
    }

    return holidays;
  }

  // ========================================
  // CRUD OPERATIONS
  // ========================================

  /**
   * Récupère tous les congés scolaires pour une année scolaire
   * @param schoolYear Année de début (ex: 2024 pour 2024-2025)
   */
  async getSchoolHolidaysByYear(schoolYear: number): Promise<SchoolHoliday[]> {
    try {
      const q = query(
        collection(db, this.SCHOOL_HOLIDAYS_COLLECTION),
        where('year', '==', schoolYear),
        orderBy('startDate', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as SchoolHoliday[];
    } catch (error) {
      console.error('Erreur lors de la récupération des congés scolaires:', error);
      throw error;
    }
  }

  /**
   * Récupère les congés scolaires pour une période donnée
   */
  async getSchoolHolidaysByPeriod(startDate: Date, endDate: Date, zone?: SchoolHolidayZone): Promise<SchoolHoliday[]> {
    try {
      const q = query(
        collection(db, this.SCHOOL_HOLIDAYS_COLLECTION),
        where('startDate', '<=', Timestamp.fromDate(endDate)),
        where('endDate', '>=', Timestamp.fromDate(startDate)),
        orderBy('startDate', 'asc')
      );

      const snapshot = await getDocs(q);
      let holidays = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as SchoolHoliday[];

      // Filtrer par zone si spécifiée
      if (zone && zone !== 'ALL') {
        holidays = holidays.filter(h => h.zone === zone || h.zone === 'ALL');
      }

      return holidays;
    } catch (error) {
      console.error('Erreur lors de la récupération des congés scolaires:', error);
      throw error;
    }
  }

  /**
   * Ajoute une période de congés scolaires
   */
  async addSchoolHoliday(holiday: Omit<SchoolHoliday, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.SCHOOL_HOLIDAYS_COLLECTION), {
        ...holiday,
        startDate: Timestamp.fromDate(holiday.startDate),
        endDate: Timestamp.fromDate(holiday.endDate),
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de l\'ajout des congés scolaires:', error);
      throw error;
    }
  }

  /**
   * Met à jour une période de congés scolaires
   */
  async updateSchoolHoliday(holidayId: string, updates: Partial<SchoolHoliday>): Promise<void> {
    try {
      const docRef = doc(db, this.SCHOOL_HOLIDAYS_COLLECTION, holidayId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
        ...(updates.startDate && { startDate: Timestamp.fromDate(updates.startDate) }),
        ...(updates.endDate && { endDate: Timestamp.fromDate(updates.endDate) }),
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des congés scolaires:', error);
      throw error;
    }
  }

  /**
   * Supprime une période de congés scolaires
   */
  async deleteSchoolHoliday(holidayId: string): Promise<void> {
    try {
      const docRef = doc(db, this.SCHOOL_HOLIDAYS_COLLECTION, holidayId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erreur lors de la suppression des congés scolaires:', error);
      throw error;
    }
  }

  /**
   * Initialise automatiquement les congés scolaires pour une année
   */
  async initializeYearSchoolHolidays(schoolYear: number): Promise<void> {
    try {
      // Vérifier si les congés existent déjà
      const existingHolidays = await this.getSchoolHolidaysByYear(schoolYear);
      if (existingHolidays.length > 0) {
        console.log(`Les congés scolaires pour ${schoolYear}-${schoolYear + 1} existent déjà`);
        return;
      }

      // Générer et sauvegarder les congés
      const holidays = this.generateFrenchSchoolHolidays(schoolYear);

      const promises = holidays.map(holiday => this.addSchoolHoliday(holiday));
      await Promise.all(promises);

      console.log(`${holidays.length} périodes de congés scolaires initialisées pour ${schoolYear}-${schoolYear + 1}`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des congés scolaires:', error);
      throw error;
    }
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  /**
   * Vérifie si une date est dans une période de congés scolaires
   */
  async isSchoolHoliday(date: Date, zone?: SchoolHolidayZone): Promise<boolean> {
    try {
      const holidays = await this.getSchoolHolidaysByPeriod(date, date, zone);
      return holidays.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification des congés scolaires:', error);
      return false;
    }
  }

  /**
   * Récupère la période de congés scolaires pour une date donnée
   */
  async getSchoolHolidayForDate(date: Date, zone?: SchoolHolidayZone): Promise<SchoolHoliday | null> {
    try {
      const holidays = await this.getSchoolHolidaysByPeriod(date, date, zone);
      return holidays.length > 0 ? holidays[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la période:', error);
      return null;
    }
  }

  /**
   * Formate une période pour l'affichage
   */
  formatSchoolHolidayPeriod(holiday: SchoolHoliday): string {
    const start = holiday.startDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const end = holiday.endDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${start} - ${end}`;
  }

  /**
   * Récupère les statistiques des congés scolaires pour une année
   */
  async getSchoolHolidayStats(schoolYear: number): Promise<{
    total: number;
    byZone: { [zone: string]: number };
    byPeriod: { [period: string]: number };
    totalDays: number;
  }> {
    try {
      const holidays = await this.getSchoolHolidaysByYear(schoolYear);

      const stats = {
        total: holidays.length,
        byZone: {} as { [zone: string]: number },
        byPeriod: {} as { [period: string]: number },
        totalDays: 0,
      };

      holidays.forEach(holiday => {
        // Par zone
        stats.byZone[holiday.zone] = (stats.byZone[holiday.zone] || 0) + 1;

        // Par période
        stats.byPeriod[holiday.period] = (stats.byPeriod[holiday.period] || 0) + 1;

        // Total jours
        const days = Math.ceil((holiday.endDate.getTime() - holiday.startDate.getTime()) / (1000 * 60 * 60 * 24));
        stats.totalDays += days;
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  }
}

export const schoolHolidaysService = new SchoolHolidaysService();
