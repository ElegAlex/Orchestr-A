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
  QueryConstraint,
  onSnapshot,
  Timestamp,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  User,
  UserSkill,
  Leave,
  ResourceAllocation,
  WorkloadSnapshot,
  WorkloadCalculation,
  AllocationSuggestion,
  WorkloadAlert,
  WorkingHours,
  ProductivityProfile,
  UserPreferences
} from '../types';
import { workloadCalculatorService } from './workload-calculator.service';

const USERS_COLLECTION = 'users';
const LEAVES_COLLECTION = 'leaves';
const ALLOCATIONS_COLLECTION = 'allocations';
const WORKLOADS_COLLECTION = 'workloads';

export class ResourceService {
  private workloadCalculator = workloadCalculatorService;
  
  // =============================================================================
  // GESTION DES UTILISATEURS ÉTENDUS
  // =============================================================================
  
  async updateUserWorkingProfile(
    userId: string, 
    profile: {
      workingHours?: WorkingHours;
      productivity?: ProductivityProfile;
      preferences?: UserPreferences;
    }
  ): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...profile,
      updatedAt: new Date()
    });
  }

  async getUserWithProfile(userId: string): Promise<User | null> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    return {
      id: userSnap.id,
      ...userSnap.data()
    } as User;
  }

  async getAllUsersWithProfiles(): Promise<User[]> {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy('displayName')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User))
      .filter(user => user.isActive !== false); // Filtrer côté client
  }

  // =============================================================================
  // GESTION DES COMPÉTENCES
  // =============================================================================
  
  async addUserSkill(userId: string, skill: Omit<UserSkill, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserSkill> {
    const now = new Date();
    const skillData = {
      ...skill,
      createdAt: now,
      updatedAt: now
    };
    
    const skillRef = await addDoc(
      collection(db, USERS_COLLECTION, userId, 'skills'), 
      skillData
    );
    
    return { id: skillRef.id, ...skillData };
  }

  async updateUserSkill(userId: string, skillId: string, updates: Partial<UserSkill>): Promise<void> {
    const skillRef = doc(db, USERS_COLLECTION, userId, 'skills', skillId);
    await updateDoc(skillRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async deleteUserSkill(userId: string, skillId: string): Promise<void> {
    const skillRef = doc(db, USERS_COLLECTION, userId, 'skills', skillId);
    await deleteDoc(skillRef);
  }

  async updateUserSkills(userId: string, skills: UserSkill[]): Promise<void> {
    console.log('updateUserSkills called with userId:', userId, 'skills count:', skills.length);
    const batch = writeBatch(db);

    // Supprimer toutes les compétences existantes
    const existingSkillsQuery = query(collection(db, USERS_COLLECTION, userId, 'skills'));
    const existingSkillsSnap = await getDocs(existingSkillsQuery);
    console.log('Found existing skills:', existingSkillsSnap.docs.length);

    existingSkillsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Ajouter les nouvelles compétences
    skills.forEach(skill => {
      const skillRef = doc(collection(db, USERS_COLLECTION, userId, 'skills'));
      const { id, ...skillData } = skill; // Retirer l'ID existant
      console.log('Adding skill:', skill.name, 'to ref:', skillRef.path);
      batch.set(skillRef, {
        ...skillData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    console.log('Committing batch...');
    await batch.commit();
    console.log('Batch committed successfully');
  }

  async getUserSkills(userId: string): Promise<UserSkill[]> {
    // getUserSkills called for userId
    try {
      // Temporairement sans orderBy car l'index Firestore manque pour les sous-collections
      const q = query(collection(db, USERS_COLLECTION, userId, 'skills'));
      const querySnapshot = await getDocs(q);

      const skills = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserSkill));

      // Trier côté client en attendant l'index Firestore
      skills.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });

      // getUserSkills returning skills
      return skills;
    } catch (error) {
      console.error('ERROR in getUserSkills:', error);
      throw error;
    }
  }

  async findUsersBySkill(skillName: string, minLevel: string = 'beginner'): Promise<User[]> {
    // Recherche complexe nécessitant une approche par lots
    const users = await this.getAllUsersWithProfiles();
    const usersWithSkill: User[] = [];
    
    for (const user of users) {
      const skills = await this.getUserSkills(user.id);
      const hasSkill = skills.some(skill => 
        skill.name.toLowerCase().includes(skillName.toLowerCase()) &&
        this.compareSkillLevels(skill.level, minLevel)
      );
      
      if (hasSkill) {
        usersWithSkill.push(user);
      }
    }
    
    return usersWithSkill;
  }

  private compareSkillLevels(userLevel: string, requiredLevel: string): boolean {
    const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
    const userIndex = levelOrder.indexOf(userLevel);
    const requiredIndex = levelOrder.indexOf(requiredLevel);
    return userIndex >= requiredIndex;
  }

  // =============================================================================
  // GESTION DES CONGÉS
  // =============================================================================
  
  async createLeave(leave: Omit<Leave, 'id' | 'createdAt' | 'updatedAt'>): Promise<Leave> {
    const now = new Date();
    const workingDaysCount = this.calculateWorkingDays(leave.startDate, leave.endDate);
    
    const leaveData = {
      ...leave,
      workingDaysCount,
      // Tous les congés sont automatiquement approuvés
      status: 'approved' as const,
      approvedBy: leave.userId, // Auto-approuvé par l'utilisateur lui-même
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    };
    
    const leaveRef = await addDoc(collection(db, LEAVES_COLLECTION), leaveData);
    return { id: leaveRef.id, ...leaveData };
  }

  async updateLeave(leaveId: string, updates: Partial<Leave>): Promise<void> {
    const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
    
    if (updates.startDate || updates.endDate) {
      const currentLeave = await getDoc(leaveRef);
      if (currentLeave.exists()) {
        const data = currentLeave.data() as Leave;
        const startDate = updates.startDate || data.startDate;
        const endDate = updates.endDate || data.endDate;
        updates.workingDaysCount = this.calculateWorkingDays(startDate, endDate);
      }
    }
    
    await updateDoc(leaveRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async approveLeave(leaveId: string, approvedBy: string): Promise<void> {
    const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
    await updateDoc(leaveRef, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getUserLeaves(userId: string, status?: Leave['status']): Promise<Leave[]> {
    let q = query(
      collection(db, LEAVES_COLLECTION),
      where('userId', '==', userId),
      orderBy('startDate', 'desc')
    );
    
    if (status) {
      q = query(
        collection(db, LEAVES_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', status),
        orderBy('startDate', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Leave));
  }

  async getLeavesByPeriod(startDate: Date, endDate: Date): Promise<Leave[]> {
    const q = query(
      collection(db, LEAVES_COLLECTION),
      where('status', '==', 'approved'),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      where('endDate', '>=', Timestamp.fromDate(startDate))
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Leave));
  }

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Pas dimanche (0) ni samedi (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  // =============================================================================
  // CALCUL DE CHARGE ET DISPONIBILITÉ
  // =============================================================================
  
  async calculateUserWorkload(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<WorkloadCalculation> {
    // Utiliser le service avancé de calcul de charge
    // Détermine le timeframe basé sur la durée
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let timeframe: 'week' | 'month' | 'quarter' = 'month';
    if (diffDays <= 14) timeframe = 'week';
    else if (diffDays > 90) timeframe = 'quarter';
    
    const advancedWorkload = await this.workloadCalculator.calculateUserWorkload(userId, timeframe);
    
    // Convertir en format attendu par l'interface
    return {
      userId,
      period: { start: startDate, end: endDate },
      availability: this.getEmptyWorkload(userId, startDate),
      suggestions: [],
      alerts: advancedWorkload.alerts || []
    };
  }

  private async calculateWeeklyWorkload(
    user: User,
    allocations: ResourceAllocation[],
    leaves: Leave[],
    weekStart: Date,
    weekEnd: Date
  ): Promise<WorkloadSnapshot> {
    // Capacité théorique
    const workingHours = user.workingHours || { weeklyHours: 35, dailyHours: 7, workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] };
    const theoreticalCapacity = workingHours.weeklyHours;
    
    // Déductions
    const leaveHours = this.calculateLeaveHours(leaves, weekStart, weekEnd, workingHours);
    const meetingHours = 4; // Estimation réunions récurrentes
    const otherHours = 1; // Temps divers
    
    const totalDeductions = leaveHours + meetingHours + otherHours;
    
    // Facteur productivité
    const productivityRate = user.productivity?.rate || 0.8;
    const netCapacity = (theoreticalCapacity - totalDeductions) * productivityRate;
    
    // Charge affectée
    const weekAllocations = allocations.filter(alloc => 
      alloc.startDate <= weekEnd && alloc.endDate >= weekStart
    );
    
    const confirmedHours = weekAllocations
      .filter(alloc => alloc.status === 'confirmed')
      .reduce((sum, alloc) => sum + (alloc.estimatedHours * alloc.allocationPercentage), 0);
      
    const tentativeHours = weekAllocations
      .filter(alloc => alloc.status === 'tentative')
      .reduce((sum, alloc) => sum + (alloc.estimatedHours * alloc.allocationPercentage), 0);
    
    const totalAllocated = confirmedHours + tentativeHours;
    const availableCapacity = Math.max(0, netCapacity - totalAllocated);
    
    // Évaluation du risque
    const occupationRate = totalAllocated / netCapacity;
    let overloadRisk: WorkloadSnapshot['overloadRisk'] = 'none';
    
    if (occupationRate > 1.1) overloadRisk = 'critical';
    else if (occupationRate > 1.0) overloadRisk = 'high';
    else if (occupationRate > 0.9) overloadRisk = 'medium';
    else if (occupationRate > 0.8) overloadRisk = 'low';

    return {
      userId: user.id,
      weekStart,
      weekEnd,
      capacity: {
        theoretical: theoreticalCapacity,
        net: netCapacity,
        available: availableCapacity
      },
      allocated: {
        confirmed: confirmedHours,
        tentative: tentativeHours,
        total: totalAllocated
      },
      deductions: {
        leaves: leaveHours,
        training: 0,
        meetings: meetingHours,
        other: otherHours
      },
      overloadRisk,
      calculatedAt: new Date(),
      validUntil: new Date(Date.now() + 60 * 60 * 1000) // 1h de cache
    };
  }

  private calculateLeaveHours(
    leaves: Leave[], 
    weekStart: Date, 
    weekEnd: Date,
    workingHours: WorkingHours
  ): number {
    return leaves
      .filter(leave => leave.startDate <= weekEnd && leave.endDate >= weekStart)
      .reduce((total, leave) => {
        const overlapStart = new Date(Math.max(leave.startDate.getTime(), weekStart.getTime()));
        const overlapEnd = new Date(Math.min(leave.endDate.getTime(), weekEnd.getTime()));
        const overlapDays = this.calculateWorkingDays(overlapStart, overlapEnd);
        return total + (overlapDays * workingHours.dailyHours);
      }, 0);
  }

  private generateAllocationSuggestions(
    user: User, 
    snapshots: WorkloadSnapshot[]
  ): AllocationSuggestion[] {
    const suggestions: AllocationSuggestion[] = [];
    
    snapshots.forEach(snapshot => {
      if (snapshot.overloadRisk === 'high' || snapshot.overloadRisk === 'critical') {
        suggestions.push({
          type: 'reallocation',
          severity: snapshot.overloadRisk === 'critical' ? 'critical' : 'warning',
          message: `Surcharge détectée semaine du ${snapshot.weekStart.toLocaleDateString()}`,
          actions: [
            'Réaffecter certaines tâches',
            'Étaler la charge sur plusieurs semaines',
            'Augmenter l\'équipe projet'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private generateWorkloadAlerts(
    user: User, 
    snapshots: WorkloadSnapshot[]
  ): WorkloadAlert[] {
    const alerts: WorkloadAlert[] = [];
    
    snapshots.forEach(snapshot => {
      if (snapshot.overloadRisk === 'critical') {
        alerts.push({
          id: `alert_${user.id}_${snapshot.weekStart.getTime()}`,
          userId: user.id,
          type: 'overload',
          severity: 'critical',
          message: `Surcharge critique: ${Math.round(snapshot.allocated.total)}h affectées pour ${Math.round(snapshot.capacity.net)}h disponibles`,
          threshold: snapshot.capacity.net,
          currentValue: snapshot.allocated.total,
          createdAt: new Date()
        });
      }
    });
    
    return alerts;
  }

  // =============================================================================
  // AFFECTATIONS DES RESSOURCES
  // =============================================================================
  
  async createAllocation(allocation: Omit<ResourceAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResourceAllocation> {
    const now = new Date();
    const allocationData = {
      ...allocation,
      status: 'tentative' as const,
      createdAt: now,
      updatedAt: now
    };
    
    const allocationRef = await addDoc(collection(db, ALLOCATIONS_COLLECTION), allocationData);
    return { id: allocationRef.id, ...allocationData };
  }

  async updateAllocation(allocationId: string, updates: Partial<ResourceAllocation>): Promise<void> {
    const allocationRef = doc(db, ALLOCATIONS_COLLECTION, allocationId);
    await updateDoc(allocationRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async confirmAllocation(allocationId: string): Promise<void> {
    await this.updateAllocation(allocationId, { status: 'confirmed' });
  }

  async getUserAllocations(userId: string, startDate?: Date, endDate?: Date): Promise<ResourceAllocation[]> {
    let q = query(
      collection(db, ALLOCATIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('startDate')
    );
    
    if (startDate) {
      q = query(
        collection(db, ALLOCATIONS_COLLECTION),
        where('userId', '==', userId),
        where('endDate', '>=', Timestamp.fromDate(startDate)),
        orderBy('endDate')
      );
    }
    
    const querySnapshot = await getDocs(q);
    let allocations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ResourceAllocation));
    
    // Filtrage côté client si endDate spécifiée
    if (endDate) {
      allocations = allocations.filter(alloc => alloc.startDate <= endDate);
    }
    
    return allocations;
  }

  async getProjectAllocations(projectId: string): Promise<ResourceAllocation[]> {
    const q = query(
      collection(db, ALLOCATIONS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('startDate')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ResourceAllocation));
  }

  // =============================================================================
  // OPTIMISATION ET SUGGESTIONS
  // =============================================================================
  
  async suggestResourceAllocation(
    taskRequirements: {
      requiredSkills: string[];
      estimatedHours: number;
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{ user: User; matchScore: number; availability: WorkloadSnapshot }[]> {
    // Pour l'instant, utiliser la logique existante
    const users = await this.getAllUsersWithProfiles();
    const suggestions: { user: User; matchScore: number; availability: WorkloadSnapshot }[] = [];
    
    for (const user of users) {
      // Calculer le score de correspondance des compétences
      const userSkills = await this.getUserSkills(user.id);
      const matchScore = this.calculateSkillMatchScore(userSkills, taskRequirements.requiredSkills);
      
      if (matchScore > 0) {
        // Vérifier la disponibilité
        const workload = await this.calculateUserWorkload(user.id, taskRequirements.startDate, taskRequirements.endDate);
        
        suggestions.push({
          user,
          matchScore,
          availability: workload.availability
        });
      }
    }
    
    // Trier par score de correspondance et disponibilité
    return suggestions.sort((a, b) => {
      const scoreComparison = b.matchScore - a.matchScore;
      if (scoreComparison !== 0) return scoreComparison;
      
      return b.availability.capacity.available - a.availability.capacity.available;
    });
  }

  async analyzeTeamWorkload(
    userIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<{
    teamMetrics: any;
    individualAnalyses: any[];
    teamOptimizations: any[];
  }> {
    // Utiliser calculateTeamWorkload du workload calculator
    const teamAnalysisObj = await this.workloadCalculator.calculateTeamWorkload(userIds);
    const teamAnalysisArray = Object.values(teamAnalysisObj);
    
    return {
      teamMetrics: {
        averageUtilization: teamAnalysisArray.reduce((sum: number, calc: any) => sum + (calc.utilizationRate || 0), 0) / teamAnalysisArray.length / 100,
        teamEfficiency: teamAnalysisArray.reduce((sum: number, calc: any) => sum + (calc.efficiencyScore || 0), 0) / teamAnalysisArray.length / 100,
      },
      individualAnalyses: teamAnalysisArray,
      teamOptimizations: []
    };
  }

  async getWorkloadOptimizations(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Utiliser suggestReallocation pour obtenir des suggestions
    try {
      // Calculer avec le workload calculator avancé
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let timeframe: 'week' | 'month' | 'quarter' = 'month';
      if (diffDays <= 14) timeframe = 'week';
      else if (diffDays > 90) timeframe = 'quarter';
      
      const workload: any = await this.workloadCalculator.calculateUserWorkload(userId, timeframe);
      
      if (workload.utilizationRate && workload.utilizationRate > 80) {
        const overloadHours = Math.max(0, workload.overloadHours || 0);
        const reallocationSuggestion = await this.workloadCalculator.suggestReallocation(userId, overloadHours);
        return [
          {
            type: 'reallocation',
            description: `Réaffecter ${overloadHours}h vers d'autres ressources`,
            candidates: reallocationSuggestion.candidates,
            recommendations: reallocationSuggestion.recommendations
          }
        ];
      }
      return workload.optimizationSuggestions || [];
    } catch (error) {
      console.error('Error getting workload optimizations:', error);
      return [];
    }
  }

  private calculateSkillMatchScore(userSkills: UserSkill[], requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1;
    
    let matchCount = 0;
    let totalWeight = 0;
    
    requiredSkills.forEach(requiredSkill => {
      const userSkill = userSkills.find(skill => 
        skill.name.toLowerCase() === requiredSkill.toLowerCase()
      );
      
      if (userSkill) {
        const levelWeight = this.getSkillLevelWeight(userSkill.level);
        matchCount += levelWeight;
      }
      totalWeight += 1;
    });
    
    return totalWeight > 0 ? matchCount / totalWeight : 0;
  }

  private getSkillLevelWeight(level: string): number {
    const weights = { beginner: 0.25, intermediate: 0.5, advanced: 0.75, expert: 1.0 };
    return weights[level as keyof typeof weights] || 0;
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================
  
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lundi
    return new Date(d.setDate(diff));
  }

  private getWeekEnd(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  private getEmptyWorkload(userId: string, date: Date): WorkloadSnapshot {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(weekStart);
    
    return {
      userId,
      weekStart,
      weekEnd,
      capacity: { theoretical: 0, net: 0, available: 0 },
      allocated: { confirmed: 0, tentative: 0, total: 0 },
      deductions: { leaves: 0, training: 0, meetings: 0, other: 0 },
      overloadRisk: 'none',
      calculatedAt: new Date(),
      validUntil: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  // =============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================================================
  
  subscribeToUserWorkload(
    userId: string,
    callback: (workload: WorkloadSnapshot[]) => void
  ): () => void {
    // S'abonner aux changements des allocations de l'utilisateur
    const q = query(
      collection(db, ALLOCATIONS_COLLECTION),
      where('userId', '==', userId)
    );
    
    return onSnapshot(q, async (snapshot) => {
      // Recalculer la charge quand les allocations changent
      const now = new Date();
      const futureDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()); // 3 mois
      
      try {
        const workload = await this.calculateUserWorkload(userId, now, futureDate);
        callback([workload.availability]);
      } catch (error) {
        console.error('Error calculating workload:', error);
      }
    });
  }

  subscribeToTeamWorkload(
    userIds: string[],
    callback: (workloads: { userId: string; workload: WorkloadSnapshot }[]) => void
  ): () => void {
    // Pour simplifier, on s'abonne aux changements d'allocations globaux
    const q = query(collection(db, ALLOCATIONS_COLLECTION), limit(100));
    
    return onSnapshot(q, async (snapshot) => {
      const workloads: { userId: string; workload: WorkloadSnapshot }[] = [];
      const now = new Date();
      const futureDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()); // 1 mois
      
      for (const userId of userIds) {
        try {
          const calculation = await this.calculateUserWorkload(userId, now, futureDate);
          workloads.push({
            userId,
            workload: calculation.availability
          });
        } catch (error) {
          console.error(`Error calculating workload for user ${userId}:`, error);
        }
      }
      
      callback(workloads);
    });
  }
}

export const resourceService = new ResourceService();