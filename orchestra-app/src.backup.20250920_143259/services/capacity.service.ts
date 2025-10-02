import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  User, 
  WorkContract, 
  UserCapacity, 
  DatePeriod, 
  CapacityAlert, 
  ResourceAllocation, 
  WeekDay, 
  LeaveRequest,
  HRMetrics,
  DepartmentMetrics,
  ContractMetrics
} from '../types';
import { holidayService } from './holiday.service';
import { leaveService } from './leave.service';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  differenceInDays,
  format,
  isSameDay,
  isWeekend
} from 'date-fns';
import { fr } from 'date-fns/locale';

class CapacityService {
  private readonly CAPACITY_COLLECTION = 'userCapacities';
  private readonly CONTRACTS_COLLECTION = 'workContracts';
  private readonly ALLOCATIONS_COLLECTION = 'resourceAllocations';

  // ========================================
  // CALCUL DE CAPACITÉ UTILISATEUR
  // ========================================

  /**
   * Calcule la capacité complète d'un utilisateur pour une période
   */
  async calculateUserCapacity(userId: string, period: DatePeriod): Promise<UserCapacity> {
    try {
      // Récupérer le contrat de l'utilisateur
      const contract = await this.getUserContract(userId);
      if (!contract) {
        throw new Error(`Aucun contrat trouvé pour l'utilisateur ${userId}`);
      }

      // Calculer les jours théoriques selon le contrat
      const theoreticalDays = await this.calculateTheoreticalDays(contract, period);

      // Récupérer les jours fériés de la période
      const holidays = await holidayService.getHolidaysByPeriod(period.startDate, period.endDate);
      const holidayDays = holidays.filter(h => !h.isWorkingDay).length;

      // Récupérer les congés approuvés
      const leaves = await leaveService.getUserLeaves(userId, 'APPROVED');
      const periodLeaves = leaves.filter(leave => 
        this.isDateInPeriod(leave.startDate, period) || 
        this.isDateInPeriod(leave.endDate, period)
      );
      const leaveDays = periodLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);

      // Calculer les jours disponibles
      const availableDays = theoreticalDays - holidayDays - leaveDays;

      // Récupérer les allocations actuelles
      const allocations = await this.getUserAllocations(userId, period);
      const plannedDays = allocations.reduce((sum, alloc) => sum + alloc.estimatedDays, 0);

      // Calculer les jours restants
      const remainingDays = availableDays - plannedDays;

      // Générer les alertes
      const alerts = await this.generateCapacityAlerts(userId, {
        theoreticalDays,
        availableDays,
        plannedDays,
        remainingDays,
      });

      // Calculer la répartition journalière
      const workingDaysInPeriod = await this.calculateDailyCapacityForPeriod(contract, period);

      const capacity: UserCapacity = {
        userId,
        period,
        theoreticalDays,
        availableDays,
        plannedDays,
        remainingDays,
        overallocationDays: remainingDays < 0 ? Math.abs(remainingDays) : 0,
        holidayDays,
        leaveDays,
        workingDaysInPeriod,
        alerts,
      };

      // Sauvegarder en cache
      await this.cacheUserCapacity(capacity);

      return capacity;
    } catch (error) {
      console.error('Erreur lors du calcul de la capacité:', error);
      throw error;
    }
  }

  /**
   * Calcule les jours théoriques selon le contrat
   */
  private async calculateTheoreticalDays(contract: WorkContract, period: DatePeriod): Promise<number> {
    try {
      let totalDays = 0;
      const currentDate = new Date(period.startDate);

      while (currentDate <= period.endDate) {
        const dayOfWeek = this.getDayOfWeek(currentDate);
        
        // Vérifier si c'est un jour ouvré selon le contrat
        if (contract.workingDays.includes(dayOfWeek)) {
          // Calculer la capacité selon le pourcentage de temps de travail
          const dailyCapacity = this.calculateDailyCapacity(contract, dayOfWeek);
          totalDays += dailyCapacity;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return totalDays;
    } catch (error) {
      console.error('Erreur lors du calcul des jours théoriques:', error);
      throw error;
    }
  }

  /**
   * Calcule la capacité journalière selon le contrat
   */
  private calculateDailyCapacity(contract: WorkContract, dayOfWeek: WeekDay): number {
    // Si horaires spécifiques définis
    if (contract.workingSchedule) {
      const daySchedule = contract.workingSchedule.find(s => s.day === dayOfWeek);
      if (daySchedule && daySchedule.isWorking) {
        // Calculer en fonction des heures réelles vs heures standard
        const standardHours = 7; // 7h par jour standard
        const actualHours = daySchedule.totalHours;
        return (actualHours / standardHours) * (contract.workingTimePercentage / 100);
      }
      return 0;
    }

    // Calcul simple basé sur le pourcentage de temps
    return contract.workingTimePercentage / 100;
  }

  /**
   * Calcule la capacité jour par jour pour une période
   */
  private async calculateDailyCapacityForPeriod(contract: WorkContract, period: DatePeriod): Promise<number[]> {
    const dailyCapacities: number[] = [];
    const currentDate = new Date(period.startDate);

    while (currentDate <= period.endDate) {
      const dayOfWeek = this.getDayOfWeek(currentDate);
      
      if (contract.workingDays.includes(dayOfWeek)) {
        const capacity = this.calculateDailyCapacity(contract, dayOfWeek);
        dailyCapacities.push(capacity);
      } else {
        dailyCapacities.push(0);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyCapacities;
  }

  // ========================================
  // GESTION DES CONTRATS
  // ========================================

  /**
   * Récupère le contrat d'un utilisateur
   */
  async getUserContract(userId: string): Promise<WorkContract | null> {
    try {
      // Zero queries approach - fetch all and filter client-side
      const snapshot = await getDocs(collection(db, this.CONTRACTS_COLLECTION));
      const allContracts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || doc.data().startDate,
        endDate: doc.data().endDate?.toDate() || doc.data().endDate,
        createdAt: doc.data().createdAt?.toDate() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate() || doc.data().updatedAt,
      } as WorkContract));
      
      // Filter by userId client-side
      const userContracts = allContracts.filter(contract => contract.userId === userId);
      
      if (userContracts.length === 0) {
        // Retourner un contrat par défaut virtuel (non sauvegardé)
        return this.getVirtualDefaultContract(userId);
      }

      // Sort by startDate and get the most recent contract
      const sortedContracts = userContracts
        .filter(contract => contract.startDate && contract.startDate <= new Date())
        .sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0));

      return sortedContracts[0] || this.getVirtualDefaultContract(userId);
    } catch (error) {
      console.error('Erreur lors de la récupération du contrat:', error);
      return null;
    }
  }

  /**
   * Retourne un contrat par défaut virtuel (non sauvegardé)
   */
  private getVirtualDefaultContract(userId: string): WorkContract {
    return {
      id: `virtual-${userId}`,
      userId,
      type: 'CDI',
      workingTimePercentage: 100,
      weeklyHours: 35,
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startDate: new Date(),
      paidLeaveDays: 25,
      isRemoteAllowed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Crée un contrat par défaut pour un utilisateur
   */
  async createDefaultContract(userId: string): Promise<WorkContract> {
    try {
      const defaultContract: Omit<WorkContract, 'id'> = {
        userId,
        type: 'CDI',
        workingTimePercentage: 100,
        weeklyHours: 35,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startDate: new Date(),
        paidLeaveDays: 25,
        isRemoteAllowed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, this.CONTRACTS_COLLECTION), {
        ...defaultContract,
        startDate: Timestamp.fromDate(defaultContract.startDate),
        createdAt: Timestamp.fromDate(defaultContract.createdAt),
        updatedAt: Timestamp.fromDate(defaultContract.updatedAt),
      });

      return { id: docRef.id, ...defaultContract } as WorkContract;
    } catch (error) {
      console.error('Erreur lors de la création du contrat par défaut:', error);
      throw error;
    }
  }

  /**
   * Crée un nouveau contrat de travail
   */
  async createContract(userId: string, contractData: Partial<WorkContract>): Promise<WorkContract> {
    try {
      console.log('📝 CapacityService.createContract - Début:', { userId, contractData });
      
      const newContract: Omit<WorkContract, 'id'> = {
        userId,
        type: contractData.type || 'CDI',
        workingTimePercentage: contractData.workingTimePercentage || 100,
        weeklyHours: contractData.weeklyHours || 35,
        workingDays: contractData.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startDate: contractData.startDate || new Date(),
        endDate: contractData.endDate || undefined,
        paidLeaveDays: contractData.paidLeaveDays || 25,
        rttDays: contractData.rttDays || 0,
        isRemoteAllowed: contractData.isRemoteAllowed || false,
        maxRemoteDaysPerWeek: contractData.maxRemoteDaysPerWeek || undefined,
        hourlyRate: contractData.hourlyRate || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Filtrer les valeurs undefined avant la sauvegarde
      const firestoreData: any = {
        userId: newContract.userId,
        type: newContract.type,
        workingTimePercentage: newContract.workingTimePercentage,
        weeklyHours: newContract.weeklyHours,
        workingDays: newContract.workingDays,
        startDate: Timestamp.fromDate(newContract.startDate),
        paidLeaveDays: newContract.paidLeaveDays,
        rttDays: newContract.rttDays,
        isRemoteAllowed: newContract.isRemoteAllowed,
        createdAt: Timestamp.fromDate(newContract.createdAt),
        updatedAt: Timestamp.fromDate(newContract.updatedAt),
      };

      // Ajouter les champs optionnels seulement s'ils ne sont pas undefined
      if (newContract.endDate) {
        firestoreData.dueDate = Timestamp.fromDate(newContract.endDate);
      }
      if (newContract.maxRemoteDaysPerWeek !== undefined) {
        firestoreData.maxRemoteDaysPerWeek = newContract.maxRemoteDaysPerWeek;
      }
      if (newContract.hourlyRate !== undefined) {
        firestoreData.hourlyRate = newContract.hourlyRate;
      }

      console.log('💾 Sauvegarde Firestore:', firestoreData);
      const docRef = await addDoc(collection(db, this.CONTRACTS_COLLECTION), firestoreData);
      console.log('✅ Contrat créé avec ID:', docRef.id);

      return { id: docRef.id, ...newContract } as WorkContract;
    } catch (error) {
      console.error('Erreur lors de la création du contrat:', error);
      throw error;
    }
  }

  /**
   * Met à jour un contrat de travail
   */
  async updateContract(contractId: string, updates: Partial<WorkContract>): Promise<void> {
    try {
      console.log('📝 CapacityService.updateContract - Début:', { contractId, updates });
      
      const docRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
      
      // Préparer les données à mettre à jour en excluant les valeurs undefined
      const updateData: any = {
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Ajouter les champs seulement s'ils ne sont pas undefined
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.workingTimePercentage !== undefined) updateData.workingTimePercentage = updates.workingTimePercentage;
      if (updates.weeklyHours !== undefined) updateData.weeklyHours = updates.weeklyHours;
      if (updates.workingDays !== undefined) updateData.workingDays = updates.workingDays;
      if (updates.paidLeaveDays !== undefined) updateData.paidLeaveDays = updates.paidLeaveDays;
      if (updates.rttDays !== undefined) updateData.rttDays = updates.rttDays;
      if (updates.isRemoteAllowed !== undefined) updateData.isRemoteAllowed = updates.isRemoteAllowed;
      if (updates.startDate !== undefined) updateData.startDate = Timestamp.fromDate(updates.startDate);
      if (updates.endDate !== undefined) updateData.dueDate = Timestamp.fromDate(updates.endDate);
      if (updates.maxRemoteDaysPerWeek !== undefined) updateData.maxRemoteDaysPerWeek = updates.maxRemoteDaysPerWeek;
      if (updates.hourlyRate !== undefined) updateData.hourlyRate = updates.hourlyRate;

      console.log('💾 Mise à jour Firestore:', updateData);
      await updateDoc(docRef, updateData);
      console.log('✅ Contrat mis à jour');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contrat:', error);
      throw error;
    }
  }

  // ========================================
  // GESTION DES ALLOCATIONS
  // ========================================

  /**
   * Récupère les allocations d'un utilisateur pour une période
   */
  async getUserAllocations(userId: string, period: DatePeriod): Promise<ResourceAllocation[]> {
    try {
      // Zero queries approach - fetch all and filter client-side
      const snapshot = await getDocs(collection(db, this.ALLOCATIONS_COLLECTION));
      const allAllocations = snapshot.docs.map(doc => ({
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || doc.data().startDate,
        endDate: doc.data().endDate?.toDate() || doc.data().endDate,
      })) as ResourceAllocation[];

      // Filter by userId and period client-side
      return allAllocations.filter(alloc => 
        alloc.userId === userId && (
          this.isDateInPeriod(alloc.startDate, period) || 
          this.isDateInPeriod(alloc.endDate, period) ||
          (alloc.startDate <= period.startDate && alloc.endDate >= period.endDate)
        )
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des allocations:', error);
      return [];
    }
  }

  /**
   * Crée une nouvelle allocation de ressource
   */
  async createAllocation(allocation: Omit<ResourceAllocation, 'estimatedDays'>): Promise<string> {
    try {
      // Calculer les jours estimés
      const contract = await this.getUserContract(allocation.userId);
      if (!contract) {
        throw new Error('Contrat utilisateur introuvable');
      }

      const period: DatePeriod = {
        startDate: allocation.startDate,
        endDate: allocation.endDate,
      };

      const capacity = await this.calculateUserCapacity(allocation.userId, period);
      const estimatedDays = (capacity.theoreticalDays * allocation.allocationPercentage) / 100;

      const docRef = await addDoc(collection(db, this.ALLOCATIONS_COLLECTION), {
        ...allocation,
        estimatedDays,
        startDate: Timestamp.fromDate(allocation.startDate),
        endDate: Timestamp.fromDate(allocation.endDate),
      });

      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'allocation:', error);
      throw error;
    }
  }

  // ========================================
  // ALERTES ET RECOMMANDATIONS
  // ========================================

  /**
   * Génère les alertes de capacité
   */
  private async generateCapacityAlerts(userId: string, capacityData: {
    theoreticalDays: number;
    availableDays: number;
    plannedDays: number;
    remainingDays: number;
  }): Promise<CapacityAlert[]> {
    const alerts: CapacityAlert[] = [];
    const { theoreticalDays, availableDays, plannedDays, remainingDays } = capacityData;

    // Surallocation
    if (remainingDays < 0) {
      alerts.push({
        type: 'OVERALLOCATION',
        severity: Math.abs(remainingDays) > theoreticalDays * 0.2 ? 'CRITICAL' : 'HIGH',
        message: `Surallocation de ${Math.abs(remainingDays).toFixed(1)} jours détectée`,
        suggestedActions: [
          'Réduire les allocations sur certains projets',
          'Négocier les échéances avec les clients',
          'Recruter du renfort temporaire',
        ],
      });
    }

    // Sous-utilisation
    if (remainingDays > theoreticalDays * 0.5) {
      alerts.push({
        type: 'UNDERUTILIZATION',
        severity: 'MEDIUM',
        message: `Sous-utilisation importante: ${remainingDays.toFixed(1)} jours libres`,
        suggestedActions: [
          'Allouer à de nouveaux projets',
          'Planifier de la formation',
          'Anticiper les projets futurs',
        ],
      });
    }

    return alerts;
  }

  /**
   * Détecte les conflits de congés avec les allocations
   */
  async detectLeaveConflicts(userId: string, period: DatePeriod): Promise<CapacityAlert[]> {
    try {
      const alerts: CapacityAlert[] = [];
      
      // Récupérer les congés et allocations
      const leaves = await leaveService.getUserLeaves(userId, 'APPROVED');
      const allocations = await this.getUserAllocations(userId, period);

      // Détecter les chevauchements
      leaves.forEach(leave => {
        allocations.forEach(allocation => {
          if (this.datesOverlap(
            leave.startDate, leave.endDate,
            allocation.startDate, allocation.endDate
          )) {
            alerts.push({
              type: 'LEAVE_CONFLICT',
              severity: 'HIGH',
              message: `Conflit détecté: congés du ${format(leave.startDate, 'dd/MM/yyyy')} au ${format(leave.endDate, 'dd/MM/yyyy')} avec allocation projet`,
              suggestedActions: [
                'Réajuster les dates d\'allocation',
                'Trouver un remplaçant temporaire',
                'Reporter les congés si possible',
              ],
              affectedProjects: [allocation.projectId],
            });
          }
        });
      });

      return alerts;
    } catch (error) {
      console.error('Erreur lors de la détection des conflits:', error);
      return [];
    }
  }

  // ========================================
  // MÉTRIQUES RH
  // ========================================

  /**
   * Calcule les métriques RH pour une période
   */
  async calculateHRMetrics(period: DatePeriod, departmentFilter?: string): Promise<HRMetrics> {
    try {
      // Récupérer tous les utilisateurs actifs
      // TODO: Intégrer avec le service utilisateur
      const users: User[] = []; // À remplacer par un vrai appel

      // Calculer les métriques globales
      const totalEmployees = users.length;
      const activeEmployees = users.filter(u => u.isActive).length;

      let totalCapacityDays = 0;
      let totalAllocatedDays = 0;
      let totalLeaveDays = 0;

      // Calculer pour chaque utilisateur
      for (const user of users) {
        if (departmentFilter && user.department !== departmentFilter) continue;

        const capacity = await this.calculateUserCapacity(user.id, period);
        totalCapacityDays += capacity.theoreticalDays;
        totalAllocatedDays += capacity.plannedDays;
        totalLeaveDays += capacity.leaveDays;
      }

      const averageUtilizationRate = totalCapacityDays > 0 
        ? (totalAllocatedDays / totalCapacityDays) * 100 
        : 0;

      const overallocationPercentage = totalCapacityDays > 0 
        ? Math.max(0, ((totalAllocatedDays - totalCapacityDays) / totalCapacityDays) * 100)
        : 0;

      // Métriques par département  
      const departmentSet = new Set(users.map(u => u.department).filter(Boolean));
      const departments = Array.from(departmentSet);
      const departmentBreakdown: DepartmentMetrics[] = [];

      for (const dept of departments) {
        const deptUsers = users.filter(u => u.department === dept);
        let deptCapacity = 0;
        let deptAllocated = 0;

        for (const user of deptUsers) {
          const capacity = await this.calculateUserCapacity(user.id, period);
          deptCapacity += capacity.theoreticalDays;
          deptAllocated += capacity.plannedDays;
        }

        departmentBreakdown.push({
          department: dept!,
          employeeCount: deptUsers.length,
          utilizationRate: deptCapacity > 0 ? (deptAllocated / deptCapacity) * 100 : 0,
        });
      }

      // Métriques par type de contrat
      const contractTypes = ['CDI', 'CDD', 'FREELANCE', 'INTERN', 'PART_TIME'];
      const contractTypeBreakdown: ContractMetrics[] = [];

      for (const type of contractTypes) {
        const typeUsers = users.filter(async (user) => {
          const contract = await this.getUserContract(user.id);
          return contract?.type === type;
        });

        // TODO: Calculer les métriques correctement de manière asynchrone
        contractTypeBreakdown.push({
          contractType: type as any,
          count: typeUsers.length,
          averageHours: 35, // À calculer
          utilizationRate: 0, // À calculer
        });
      }

      return {
        period,
        totalEmployees,
        activeEmployees,
        averageUtilizationRate,
        totalCapacityDays,
        totalAllocatedDays,
        totalLeaveDays,
        overallocationPercentage,
        departmentBreakdown,
        contractTypeBreakdown,
      };
    } catch (error) {
      console.error('Erreur lors du calcul des métriques RH:', error);
      throw error;
    }
  }

  // ========================================
  // CACHE ET OPTIMISATION
  // ========================================

  /**
   * Met en cache la capacité calculée
   */
  private async cacheUserCapacity(capacity: UserCapacity): Promise<void> {
    try {
      // Nettoyer les valeurs undefined pour Firestore
      const cleanCapacity = {
        ...capacity,
        overallocationDays: capacity.overallocationDays ?? 0,
        period: {
          ...capacity.period,
          startDate: Timestamp.fromDate(capacity.period.startDate),
          endDate: Timestamp.fromDate(capacity.period.endDate),
        },
        calculatedAt: Timestamp.fromDate(new Date()),
      };

      await addDoc(collection(db, this.CAPACITY_COLLECTION), cleanCapacity);
    } catch (error) {
      console.error('Erreur lors de la mise en cache:', error);
      // Ne pas faire échouer le processus principal
    }
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  private getDayOfWeek(date: Date): WeekDay {
    const days: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  private isDateInPeriod(date: Date, period: DatePeriod): boolean {
    return date >= period.startDate && date <= period.endDate;
  }

  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 <= end2 && end1 >= start2;
  }

  /**
   * Génère des périodes prédéfinies (mois, trimestre, année)
   */
  generatePeriods(type: 'month' | 'quarter' | 'year', year: number): DatePeriod[] {
    const periods: DatePeriod[] = [];

    switch (type) {
      case 'month':
        for (let month = 0; month < 12; month++) {
          const start = startOfMonth(new Date(year, month, 1));
          const end = endOfMonth(start);
          periods.push({
            startDate: start,
            endDate: end,
            label: format(start, 'MMMM yyyy', { locale: fr }),
          });
        }
        break;

      case 'quarter':
        for (let quarter = 0; quarter < 4; quarter++) {
          const startMonth = quarter * 3;
          const start = startOfMonth(new Date(year, startMonth, 1));
          const end = endOfMonth(new Date(year, startMonth + 2, 1));
          periods.push({
            startDate: start,
            endDate: end,
            label: `Q${quarter + 1} ${year}`,
          });
        }
        break;

      case 'year':
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        periods.push({
          startDate: start,
          endDate: end,
          label: `Année ${year}`,
        });
        break;
    }

    return periods;
  }
}

export const capacityService = new CapacityService();