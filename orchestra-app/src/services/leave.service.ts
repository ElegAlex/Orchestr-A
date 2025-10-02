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
   * Crée une nouvelle demande de congés
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

      const docRef = await addDoc(collection(db, this.LEAVES_COLLECTION), {
        ...leaveData,
        totalDays,
        status: 'PENDING',
        startDate: Timestamp.fromDate(leaveData.startDate),
        endDate: Timestamp.fromDate(leaveData.endDate),
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Créer le workflow de validation
      await this.createApprovalWorkflow(docRef.id, leaveData.userId, { ...leaveData, totalDays });

      // Notifier les managers
      await this.notifyManagers(leaveData.userId, docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la demande de congés:', error);
      throw error;
    }
  }

  /**
   * Approuve ou rejette une demande de congés
   */
  async processLeaveRequest(
    leaveId: string, 
    status: 'APPROVED' | 'REJECTED', 
    approvedBy: string, 
    rejectionReason?: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const leaveRef = doc(db, this.LEAVES_COLLECTION, leaveId);

      // Récupérer la demande
      const leaveDoc = await getDoc(leaveRef);
      if (!leaveDoc.exists()) {
        throw new Error('Demande de congés introuvable');
      }

      const leaveData = { id: leaveDoc.id, ...leaveDoc.data() } as LeaveRequest;

      // Mettre à jour le statut
      batch.update(leaveRef, {
        status,
        approvedBy,
        approvedAt: Timestamp.fromDate(new Date()),
        rejectionReason: rejectionReason || null,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Si approuvé, déduire du solde de congés
      if (status === 'APPROVED') {
        await this.deductLeaveBalance(leaveData.userId, leaveData.type, leaveData.totalDays);
      }

      await batch.commit();

      // Notifier l'utilisateur
      await this.notifyUser(leaveData.userId, leaveId, status);
    } catch (error) {
      console.error('Erreur lors du traitement de la demande:', error);
      throw error;
    }
  }

  /**
   * Annule une demande de congés
   */
  async cancelLeaveRequest(leaveId: string, userId: string): Promise<void> {
    try {
      const leaveRef = doc(db, this.LEAVES_COLLECTION, leaveId);
      const leaveDoc = await getDoc(leaveRef);

      if (!leaveDoc.exists()) {
        throw new Error('Demande de congés introuvable');
      }

      const leaveData = { id: leaveDoc.id, ...leaveDoc.data() } as LeaveRequest;

      // Vérifier que l'utilisateur peut annuler (propriétaire ou admin)
      if (leaveData.userId !== userId) {
        throw new Error('Non autorisé à annuler cette demande');
      }

      // Si la demande était approuvée, rembourser les congés
      if (leaveData.status === 'APPROVED') {
        await this.refundLeaveBalance(userId, leaveData.type, leaveData.totalDays);
      }

      await updateDoc(leaveRef, {
        status: 'CANCELLED',
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
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
      console.error('Erreur lors du calcul des jours de congés:', error);
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
      console.error('Erreur lors de la vérification des congés:', error);
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
        endDate: doc.data().dueDate.toDate(),
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
      console.error('Erreur lors de la vérification des conflits:', error);
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
      
      if (snapshot.empty || forceRefresh) {
        // Si forceRefresh, supprimer l'ancien solde d'abord
        if (forceRefresh && !snapshot.empty) {
          console.log('🔄 Suppression de l\'ancien solde pour réinitialisation');
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        
        // Créer un solde initial basé sur le contrat
        return await this.initializeLeaveBalance(userId, currentYear);
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
      console.error('Erreur lors de la récupération du solde:', error);
      throw error;
    }
  }

  /**
   * Initialise le solde de congés basé sur le contrat
   */
  async initializeLeaveBalance(userId: string, year: number): Promise<any> {
    try {
      console.log(`🔧 Initialisation du solde de congés pour l'utilisateur ${userId}, année ${year}`);
      
      // Récupérer le contrat utilisateur depuis le service capacity
      let contract = null;
      try {
        const { capacityService } = await import('./capacity.service');
        contract = await capacityService.getUserContract(userId);
        console.log('📋 Contrat récupéré:', contract);
      } catch (error) {
        console.error('Erreur lors de la récupération du contrat:', error);
      }

      // Utiliser les RTT directement saisis dans l'admin RH, sinon calculer selon les heures
      let rttDays = 0;
      if (contract?.rttDays !== undefined && contract.rttDays !== null) {
        // Priorité à la valeur saisie directement dans l'admin RH
        rttDays = contract.rttDays;
        console.log('🎯 RTT depuis admin RH:', rttDays);
      } else if (contract?.weeklyHours && contract.weeklyHours > 35) {
        // Sinon, formule RTT: (heures_hebdo - 35) * 52 / 7
        rttDays = Math.round((contract.weeklyHours - 35) * 52 / 7);
        console.log('🧮 RTT calculés depuis heures hebdo:', rttDays);
      }

      const defaultBalance = {
        userId,
        year,
        paidLeave: contract?.paidLeaveDays || 25, // Utiliser les données du contrat ou défaut
        rtt: rttDays, // RTT calculés selon le contrat
        exceptional: 5, // 5 jours exceptionnels par défaut
        used: { paidLeave: 0, rtt: 0, exceptional: 0 },
      };

      console.log('💰 Solde initialisé:', defaultBalance);

      await addDoc(collection(db, this.LEAVE_BALANCES_COLLECTION), {
        ...defaultBalance,
        createdAt: Timestamp.fromDate(new Date()),
      });

      return defaultBalance;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du solde:', error);
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
      console.error('Erreur lors de la déduction du solde:', error);
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
      console.error('Erreur lors du remboursement:', error);
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
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().dueDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
      })) as LeaveRequest[];

      // Filtrer par statut côté client si nécessaire
      if (status) {
        leaves = leaves.filter(leave => leave.status === status);
      }

      // Trier côté client par date de création décroissante
      return leaves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Erreur lors de la récupération des congés:', error);
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
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().dueDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
      })) as LeaveRequest[];
      
      // Trier côté client par date de création croissante
      return leaves.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      console.error('Erreur lors de la récupération des demandes en attente:', error);
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
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().dueDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
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
      console.error('Erreur lors de la récupération des congés d\'équipe:', error);
      throw error;
    }
  }

  // ========================================
  // WORKFLOW DE VALIDATION HIÉRARCHIQUE
  // ========================================

  /**
   * Obtient la chaîne de validation pour un utilisateur
   */
  async getApprovalChain(userId: string): Promise<{ managerId: string; level: number; required: boolean }[]> {
    try {
      // TODO: Intégrer avec le service organisationnel
      // Pour l'instant, simuler une chaîne simple
      return [
        { managerId: 'manager-1', level: 1, required: true }, // Manager direct
        { managerId: 'hr-admin', level: 2, required: false }, // RH si > 10 jours
      ];
    } catch (error) {
      console.error('Erreur lors de la récupération de la chaîne de validation:', error);
      return [];
    }
  }

  /**
   * Détermine si une validation supplémentaire est requise
   */
  async requiresAdditionalApproval(leaveData: Partial<LeaveRequest>): Promise<boolean> {
    // Règles métier pour validation supplémentaire
    if (leaveData.totalDays && leaveData.totalDays > 10) return true; // Plus de 10 jours
    if (leaveData.type === 'EXCEPTIONAL_LEAVE') return true; // Congés exceptionnels
    if (leaveData.type === 'UNPAID_LEAVE') return true; // Congés sans solde
    
    // Vérifier les périodes sensibles (été, fin d'année)
    if (leaveData.startDate) {
      const month = leaveData.startDate.getMonth();
      if (month >= 6 && month <= 8) return true; // Été
      if (month === 11) return true; // Décembre
    }
    
    return false;
  }

  /**
   * Crée les étapes de validation pour une demande
   */
  async createApprovalWorkflow(leaveId: string, userId: string, leaveData: Partial<LeaveRequest>): Promise<void> {
    try {
      const chain = await this.getApprovalChain(userId);
      const requiresExtra = await this.requiresAdditionalApproval(leaveData);
      
      const workflowSteps = chain.map((step, index) => ({
        leaveId,
        approverId: step.managerId,
        level: step.level,
        status: 'PENDING',
        required: step.required || (requiresExtra && step.level === 2),
        createdAt: Timestamp.fromDate(new Date()),
      }));

      // Sauvegarder les étapes de validation
      const batch = writeBatch(db);
      workflowSteps.forEach(step => {
        const stepRef = doc(collection(db, 'approvalSteps'));
        batch.set(stepRef, step);
      });
      await batch.commit();

      console.log(`Workflow créé pour la demande ${leaveId}: ${workflowSteps.length} étapes`);
    } catch (error) {
      console.error('Erreur lors de la création du workflow:', error);
    }
  }

  // ========================================
  // NOTIFICATIONS AUTOMATIQUES
  // ========================================

  private async notifyManagers(userId: string, leaveId: string): Promise<void> {
    try {
      const chain = await this.getApprovalChain(userId);
      const leaveDoc = await getDoc(doc(db, this.LEAVES_COLLECTION, leaveId));
      
      if (!leaveDoc.exists()) return;
      
      const leaveData = { id: leaveDoc.id, ...leaveDoc.data() } as LeaveRequest;
      const user = await this.getUserInfo(userId);

      // Notification au manager direct
      if (chain.length > 0) {
        await this.sendNotification({
          recipientId: chain[0].managerId,
          type: 'LEAVE_REQUEST_PENDING',
          title: 'Nouvelle demande de congés',
          message: `${user.displayName} a demandé ${leaveData.totalDays} jour(s) de ${this.getLeaveTypeLabel(leaveData.type)}`,
          data: {
            leaveId,
            userId,
            startDate: leaveData.startDate.toISOString(),
            endDate: leaveData.endDate.toISOString(),
          },
          priority: 'NORMAL',
        });
      }

      // Auto-approbation pour certains types
      if (this.canAutoApprove(leaveData)) {
        await this.processLeaveRequest(leaveId, 'APPROVED', 'system-auto-approval');
      }
    } catch (error) {
      console.error('Erreur lors de la notification des managers:', error);
    }
  }

  private async notifyUser(userId: string, leaveId: string, status: string, reason?: string): Promise<void> {
    try {
      const statusLabels: { [key: string]: string } = {
        APPROVED: 'approuvée',
        REJECTED: 'refusée',
        CANCELLED: 'annulée',
      };

      await this.sendNotification({
        recipientId: userId,
        type: `LEAVE_REQUEST_${status}`,
        title: `Demande de congés ${statusLabels[status] || status.toLowerCase()}`,
        message: reason || `Votre demande de congés a été ${statusLabels[status] || status.toLowerCase()}`,
        data: { leaveId },
        priority: status === 'REJECTED' ? 'HIGH' : 'NORMAL',
      });
    } catch (error) {
      console.error('Erreur lors de la notification utilisateur:', error);
    }
  }

  /**
   * Envoi une notification générique
   */
  private async sendNotification(notification: {
    recipientId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  }): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        priority: notification.priority || 'NORMAL',
        read: false,
        createdAt: Timestamp.fromDate(new Date()),
      });
      
      console.log(`Notification envoyée à ${notification.recipientId}: ${notification.title}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de notification:', error);
    }
  }

  /**
   * Détermine si une demande peut être auto-approuvée
   */
  private canAutoApprove(leaveData: LeaveRequest): boolean {
    // Auto-approbation pour RTT < 2 jours
    if (leaveData.type === 'RTT' && leaveData.totalDays <= 2) return true;
    
    // Auto-approbation pour congés maladie < 3 jours
    if (leaveData.type === 'SICK_LEAVE' && leaveData.totalDays <= 3) return true;
    
    return false;
  }

  /**
   * Récupère les informations utilisateur
   */
  private async getUserInfo(userId: string): Promise<{ displayName: string; email: string }> {
    // TODO: Intégrer avec le service utilisateur réel
    return {
      displayName: `Utilisateur ${userId}`,
      email: `user${userId}@company.com`,
    };
  }

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
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().dueDate.toDate(),
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
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  }
}

export const leaveService = new LeaveService();