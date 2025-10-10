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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LeaveRequest, LeaveType, LeaveStatus, User, WorkContract, DatePeriod } from '../types';
import { holidayService } from './holiday.service';

class LeaveService {
  private readonly LEAVES_COLLECTION = 'leaveRequests';
  private readonly LEAVE_BALANCES_COLLECTION = 'leaveBalances';

  // ========================================
  // GESTION DES DEMANDES DE CONGÉS
  // ========================================

  /**
   * Crée une nouvelle demande de congés (DÉCLARATIF - pas de validation)
   */
  async createLeaveRequest(leaveData: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'totalDays'>): Promise<string> {
    try {
      // Calculer le nombre de jours
      const totalDays = await this.calculateLeaveDays(
        leaveData.startDate,
        leaveData.endDate,
        leaveData.halfDayStart,
        leaveData.halfDayEnd
      );

      // Vérifier la disponibilité des congés
      const canTakeLeave = await this.canUserTakeLeave(leaveData.userId, leaveData.type, totalDays);
      if (!canTakeLeave.allowed) {
        throw new Error(canTakeLeave.reason);
      }

      const now = new Date();
      const docRef = await addDoc(collection(db, this.LEAVES_COLLECTION), {
        ...leaveData,
        totalDays,
        status: 'APPROVED', // Directement approuvé (déclaratif)
        startDate: Timestamp.fromDate(leaveData.startDate),
        endDate: Timestamp.fromDate(leaveData.endDate),
        createdAt: Timestamp.fromDate(now),
        approvedAt: Timestamp.fromDate(now), // Auto-approuvé immédiatement
        approvedBy: 'system-declarative', // Système déclaratif
      });

      // Déduire immédiatement du solde
      await this.deductLeaveBalance(leaveData.userId, leaveData.type, totalDays);

      return docRef.id;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Modifie une demande de congés (DÉCLARATIF - pas de validation)
   * Utilisé uniquement pour mettre à jour une déclaration existante
   */
  async updateLeaveRequest(
    leaveId: string,
    leaveData: Partial<LeaveRequest>
  ): Promise<void> {
    try {
      const leaveRef = doc(db, this.LEAVES_COLLECTION, leaveId);

      // Récupérer la demande actuelle
      const leaveDoc = await getDoc(leaveRef);
      if (!leaveDoc.exists()) {
        throw new Error('Demande de congés introuvable');
      }

      const currentLeave = { id: leaveDoc.id, ...leaveDoc.data() } as LeaveRequest;

      // Rembourser l'ancien solde
      await this.refundLeaveBalance(currentLeave.userId, currentLeave.type, currentLeave.totalDays);

      // Recalculer les jours si dates modifiées
      let totalDays = currentLeave.totalDays;
      if (leaveData.startDate || leaveData.endDate) {
        totalDays = await this.calculateLeaveDays(
          leaveData.startDate || currentLeave.startDate,
          leaveData.endDate || currentLeave.endDate,
          leaveData.halfDayStart ?? currentLeave.halfDayStart,
          leaveData.halfDayEnd ?? currentLeave.halfDayEnd
        );
      }

      // Mettre à jour
      await updateDoc(leaveRef, {
        ...leaveData,
        totalDays,
        updatedAt: Timestamp.fromDate(new Date()),
        ...(leaveData.startDate && { startDate: Timestamp.fromDate(leaveData.startDate) }),
        ...(leaveData.endDate && { endDate: Timestamp.fromDate(leaveData.endDate) }),
      });

      // Déduire le nouveau solde
      await this.deductLeaveBalance(
        currentLeave.userId,
        leaveData.type || currentLeave.type,
        totalDays
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Supprime définitivement une demande de congés (DÉCLARATIF)
   */
  async cancelLeaveRequest(leaveId: string, userId: string): Promise<void> {
    try {
      const leaveRef = doc(db, this.LEAVES_COLLECTION, leaveId);
      const leaveDoc = await getDoc(leaveRef);

      if (!leaveDoc.exists()) {
        throw new Error('Demande de congés introuvable');
      }

      const leaveData = { id: leaveDoc.id, ...leaveDoc.data() } as LeaveRequest;

      // Vérifier que l'utilisateur peut supprimer (propriétaire ou admin)
      if (leaveData.userId !== userId) {
        throw new Error('Non autorisé à supprimer cette demande');
      }

      // Rembourser les congés
      await this.refundLeaveBalance(userId, leaveData.type, leaveData.totalDays);

      // Supprimer définitivement au lieu de marquer comme annulé
      await deleteDoc(leaveRef);
    } catch (error) {
      throw error;
    }
  }

  // ========================================
  // CALCULS DE CONGÉS
  // ========================================

  /**
   * Calcule le nombre de jours de congés entre deux dates
   */
  async calculateLeaveDays(
    startDate: Date, 
    endDate: Date, 
    halfDayStart?: boolean, 
    halfDayEnd?: boolean
  ): Promise<number> {
    try {
      // Calculer les jours ouvrés (excluant weekends et jours fériés)
      const workingDays = await holidayService.getWorkingDaysBetween(startDate, endDate);
      
      let totalDays = workingDays;

      // Ajustements pour les demi-journées
      if (halfDayStart) totalDays -= 0.5;
      if (halfDayEnd) totalDays -= 0.5;

      return Math.max(0, totalDays);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur peut prendre des congés
   */
  async canUserTakeLeave(userId: string, leaveType: LeaveType, days: number): Promise<{
    allowed: boolean;
    reason?: string;
    remainingBalance?: number;
  }> {
    try {
      // Récupérer le solde actuel
      const balance = await this.getLeaveBalance(userId);
      
      let availableDays = 0;
      switch (leaveType) {
        case 'PAID_LEAVE':
          availableDays = balance.paidLeave;
          break;
        case 'RTT':
          availableDays = balance.rtt || 0;
          break;
        case 'SICK_LEAVE':
          // Pas de limite pour les congés maladie
          return { allowed: true };
        case 'EXCEPTIONAL_LEAVE':
          availableDays = balance.exceptional || 0;
          break;
        case 'CONVENTIONAL_LEAVE':
          // Pas de limite pour les congés conventionnels (selon convention collective)
          return { allowed: true };
        default:
          return { allowed: true };
      }

      if (days > availableDays) {
        return {
          allowed: false,
          reason: `Solde insuffisant. Disponible: ${availableDays} jours, Demandé: ${days} jours`,
          remainingBalance: availableDays,
        };
      }

      // Vérifier les conflits avec d'autres congés approuvés
      const conflicts = await this.checkLeaveConflicts(userId, new Date(), new Date());
      if (conflicts.length > 0) {
        return {
          allowed: false,
          reason: 'Conflit avec des congés déjà approuvés',
        };
      }

      return { allowed: true, remainingBalance: availableDays };
    } catch (error) {
      return { allowed: false, reason: 'Erreur de vérification' };
    }
  }

  /**
   * Vérifie les conflits de congés pour un utilisateur
   */
  async checkLeaveConflicts(userId: string, startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    try {
      const q = query(
        collection(db, this.LEAVES_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'APPROVED')
      );

      const snapshot = await getDocs(q);
      const approvedLeaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate.toDate(),
      })) as LeaveRequest[];

      // Vérifier les chevauchements
      return approvedLeaves.filter(leave => {
        return (
          (startDate >= leave.startDate && startDate <= leave.endDate) ||
          (endDate >= leave.startDate && endDate <= leave.endDate) ||
          (startDate <= leave.startDate && endDate >= leave.endDate)
        );
      });
    } catch (error) {
      return [];
    }
  }

  // ========================================
  // GESTION DES SOLDES
  // ========================================

  /**
   * Récupère le solde de congés d'un utilisateur
   */
  async getLeaveBalance(userId: string, forceRefresh: boolean = false): Promise<{
    userId: string;
    year: number;
    paidLeave: number;
    rtt: number;
    exceptional: number;
    used: {
      paidLeave: number;
      rtt: number;
      exceptional: number;
    };
  }> {
    try {
      const currentYear = new Date().getFullYear();
      const q = query(
        collection(db, this.LEAVE_BALANCES_COLLECTION),
        where('userId', '==', userId),
        where('year', '==', currentYear)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Aucun solde existant, en créer un nouveau
        return await this.initializeLeaveBalance(userId, currentYear);
      }

      if (forceRefresh && !snapshot.empty) {
        // Si forceRefresh, recalculer le solde basé sur le contrat et mettre à jour
        // Récupérer le contrat utilisateur
        let contract = null;
        try {
          const { capacityService } = await import('./capacity.service');
          contract = await capacityService.getUserContract(userId);
        } catch (error) {
          // Ignorer l'erreur silencieusement
        }

        // Utiliser les RTT directement saisis ou calculer selon les heures
        let rttDays = 0;
        if (contract?.rttDays !== undefined && contract.rttDays !== null) {
          rttDays = contract.rttDays;
        } else if (contract?.weeklyHours && contract.weeklyHours > 35) {
          rttDays = Math.round((contract.weeklyHours - 35) * 52 / 7);
        }

        const balanceData = snapshot.docs[0].data();
        const refreshedBalance = {
          userId,
          year: currentYear,
          paidLeave: contract?.paidLeaveDays || 25,
          rtt: rttDays,
          exceptional: 5,
          used: balanceData.used || { paidLeave: 0, rtt: 0, exceptional: 0 },
        };

        // Mettre à jour le solde existant plutôt que de le supprimer
        await updateDoc(snapshot.docs[0].ref, {
          paidLeave: refreshedBalance.paidLeave,
          rtt: refreshedBalance.rtt,
          exceptional: refreshedBalance.exceptional,
          updatedAt: Timestamp.fromDate(new Date()),
        });

        return refreshedBalance;
      }

      const balanceData = snapshot.docs[0].data();
      return {
        userId,
        year: currentYear,
        paidLeave: balanceData.paidLeave || 0,
        rtt: balanceData.rtt || 0,
        exceptional: balanceData.exceptional || 0,
        used: balanceData.used || { paidLeave: 0, rtt: 0, exceptional: 0 },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initialise le solde de congés basé sur le contrat
   */
  async initializeLeaveBalance(userId: string, year: number): Promise<any> {
    try {
      // Récupérer le contrat utilisateur depuis le service capacity
      let contract = null;
      try {
        const { capacityService } = await import('./capacity.service');
        contract = await capacityService.getUserContract(userId);
      } catch (error) {
        // Ignorer l'erreur silencieusement
      }

      // Utiliser les RTT directement saisis dans l'admin RH, sinon calculer selon les heures
      let rttDays = 0;
      if (contract?.rttDays !== undefined && contract.rttDays !== null) {
        // Priorité à la valeur saisie directement dans l'admin RH
        rttDays = contract.rttDays;
      } else if (contract?.weeklyHours && contract.weeklyHours > 35) {
        // Sinon, formule RTT: (heures_hebdo - 35) * 52 / 7
        rttDays = Math.round((contract.weeklyHours - 35) * 52 / 7);
      }

      const defaultBalance = {
        userId,
        year,
        paidLeave: contract?.paidLeaveDays || 25, // Utiliser les données du contrat ou défaut
        rtt: rttDays, // RTT calculés selon le contrat
        exceptional: 5, // 5 jours exceptionnels par défaut
        used: { paidLeave: 0, rtt: 0, exceptional: 0 },
      };

      await addDoc(collection(db, this.LEAVE_BALANCES_COLLECTION), {
        ...defaultBalance,
        createdAt: Timestamp.fromDate(new Date()),
      });

      return defaultBalance;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Déduit des jours du solde de congés
   */
  async deductLeaveBalance(userId: string, leaveType: LeaveType, days: number): Promise<void> {
    try {
      const balance = await this.getLeaveBalance(userId);
      
      const updates: any = {};
      
      switch (leaveType) {
        case 'PAID_LEAVE':
          updates['used.paidLeave'] = balance.used.paidLeave + days;
          break;
        case 'RTT':
          updates['used.rtt'] = balance.used.rtt + days;
          break;
        case 'EXCEPTIONAL_LEAVE':
          updates['used.exceptional'] = balance.used.exceptional + days;
          break;
      }

      if (Object.keys(updates).length > 0) {
        const q = query(
          collection(db, this.LEAVE_BALANCES_COLLECTION),
          where('userId', '==', userId),
          where('year', '==', new Date().getFullYear())
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Rembourse des jours au solde (en cas d'annulation)
   */
  async refundLeaveBalance(userId: string, leaveType: LeaveType, days: number): Promise<void> {
    try {
      const balance = await this.getLeaveBalance(userId);
      
      const updates: any = {};
      
      switch (leaveType) {
        case 'PAID_LEAVE':
          updates['used.paidLeave'] = Math.max(0, balance.used.paidLeave - days);
          break;
        case 'RTT':
          updates['used.rtt'] = Math.max(0, balance.used.rtt - days);
          break;
        case 'EXCEPTIONAL_LEAVE':
          updates['used.exceptional'] = Math.max(0, balance.used.exceptional - days);
          break;
      }

      if (Object.keys(updates).length > 0) {
        const q = query(
          collection(db, this.LEAVE_BALANCES_COLLECTION),
          where('userId', '==', userId),
          where('year', '==', new Date().getFullYear())
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      }
    } catch (error) {
      throw error;
    }
  }

  // ========================================
  // CONSULTATION
  // ========================================

  /**
   * Récupère les demandes de congés d'un utilisateur
   */
  async getUserLeaves(userId: string, status?: LeaveStatus): Promise<LeaveRequest[]> {
    try {
      // Requête simple sans orderBy pour éviter l'index composite
      const q = query(
        collection(db, this.LEAVES_COLLECTION),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      let leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
      })) as LeaveRequest[];

      // Toujours filtrer les congés annulés (ne pas les afficher)
      leaves = leaves.filter(leave => leave.status !== 'CANCELLED');

      // Filtrer par statut côté client si nécessaire
      if (status) {
        leaves = leaves.filter(leave => leave.status === status);
      }

      // Trier côté client par date de création décroissante
      return leaves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Récupère les demandes en attente pour les managers
   */
  async getPendingLeaves(): Promise<LeaveRequest[]> {
    try {
      const q = query(
        collection(db, this.LEAVES_COLLECTION),
        where('status', '==', 'PENDING')
      );

      const snapshot = await getDocs(q);
      const leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as LeaveRequest[];
      
      // Trier côté client par date de création croissante
      return leaves.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Récupère les congés pour une équipe/département
   */
  async getTeamLeaves(userIds: string[], period?: DatePeriod): Promise<LeaveRequest[]> {
    try {
      // Si aucun utilisateur, retourner un tableau vide
      if (userIds.length === 0) {
        return [];
      }

      // Requête simple sans orderBy pour éviter l'index composite
      const q = query(
        collection(db, this.LEAVES_COLLECTION),
        where('userId', 'in', userIds)
      );

      const snapshot = await getDocs(q);
      let leaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as LeaveRequest[];

      // Filtrer par statut approuvé côté client
      leaves = leaves.filter(leave => leave.status === 'APPROVED');

      // Filtrer par période si spécifiée
      if (period) {
        leaves = leaves.filter(leave => 
          leave.startDate >= period.startDate && leave.endDate <= period.endDate
        );
      }

      // Trier côté client par date de début croissante
      return leaves.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    } catch (error) {
      throw error;
    }
  }

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Obtient le libellé d'un type de congé
   */
  private getLeaveTypeLabel(type: LeaveType): string {
    const labels = {
      PAID_LEAVE: 'congés payés',
      RTT: 'RTT',
      SICK_LEAVE: 'congé maladie',
      MATERNITY_LEAVE: 'congé maternité',
      PATERNITY_LEAVE: 'congé paternité',
      EXCEPTIONAL_LEAVE: 'congé exceptionnel',
      CONVENTIONAL_LEAVE: 'congé conventionnel',
      UNPAID_LEAVE: 'congé sans solde',
      TRAINING: 'formation',
    };
    return labels[type] || type;
  }

  // ========================================
  // STATISTIQUES
  // ========================================

  /**
   * Calcule les statistiques de congés pour une équipe
   */
  async getLeaveStats(userIds: string[], year: number): Promise<{
    totalDaysRequested: number;
    totalDaysApproved: number;
    totalDaysRejected: number;
    averageDaysPerUser: number;
    mostPopularMonth: string;
    leaveTypeBreakdown: { [type: string]: number };
  }> {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      // Si aucun utilisateur, retourner des statistiques vides
      if (userIds.length === 0) {
        return {
          totalDaysRequested: 0,
          totalDaysApproved: 0,
          totalDaysRejected: 0,
          averageDaysPerUser: 0,
          mostPopularMonth: 'N/A',
          leaveTypeBreakdown: {}
        };
      }

      const q = query(
        collection(db, this.LEAVES_COLLECTION),
        where('userId', 'in', userIds)
      );

      const snapshot = await getDocs(q);
      const leaves = snapshot.docs.map(doc => ({
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
      })) as LeaveRequest[];

      // Filtrer par année
      const yearLeaves = leaves.filter(leave => 
        leave.startDate.getFullYear() === year
      );

      const stats = {
        totalDaysRequested: yearLeaves.reduce((sum, leave) => sum + leave.totalDays, 0),
        totalDaysApproved: yearLeaves
          .filter(leave => leave.status === 'APPROVED')
          .reduce((sum, leave) => sum + leave.totalDays, 0),
        totalDaysRejected: yearLeaves
          .filter(leave => leave.status === 'REJECTED')
          .reduce((sum, leave) => sum + leave.totalDays, 0),
        averageDaysPerUser: 0,
        mostPopularMonth: '',
        leaveTypeBreakdown: {} as { [type: string]: number },
      };

      stats.averageDaysPerUser = userIds.length > 0 ? stats.totalDaysApproved / userIds.length : 0;

      // Calcul du mois le plus populaire
      const monthCounts: { [month: string]: number } = {};
      yearLeaves.forEach(leave => {
        const month = leave.startDate.toLocaleDateString('fr-FR', { month: 'long' });
        monthCounts[month] = (monthCounts[month] || 0) + leave.totalDays;
      });

      stats.mostPopularMonth = Object.keys(monthCounts).reduce((a, b) => 
        monthCounts[a] > monthCounts[b] ? a : b, ''
      );

      // Répartition par type
      yearLeaves.forEach(leave => {
        stats.leaveTypeBreakdown[leave.type] = 
          (stats.leaveTypeBreakdown[leave.type] || 0) + leave.totalDays;
      });

      return stats;
    } catch (error) {
      throw error;
    }
  }
}

export const leaveService = new LeaveService();