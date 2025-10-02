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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Milestone, MilestoneStatus, MilestoneType, Deliverable, MilestoneDependency } from '../types';

class MilestoneService {
  private readonly COLLECTION_NAME = 'milestones';

  /**
   * Créer un nouveau Milestone
   */
  async createMilestone(milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...milestone,
        completionRate: 0,
        status: 'upcoming' as MilestoneStatus,
        deliverables: milestone.deliverables || [],
        successCriteria: milestone.successCriteria || [],
        dependsOn: milestone.dependsOn || [],
        epicIds: milestone.epicIds || [],
        taskIds: milestone.taskIds || [],
        reviewers: milestone.reviewers || [],
        affectedTeams: milestone.affectedTeams || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Mettre à jour le code du milestone avec son ID
      await updateDoc(docRef, {
        code: milestone.code || `M${docRef.id.slice(-2).toUpperCase()}`,
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }

  /**
   * Obtenir tous les milestones d'un projet
   */
  async getProjectMilestones(projectId: string): Promise<Milestone[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(q);
      const milestones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate(),
        startDate: doc.data().startDate?.toDate(),
        validatedAt: doc.data().validatedAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Milestone));
      
      // Tri côté client temporairement
      return milestones.sort((a, b) => {
        const dateA = new Date(a.dueDate || a.startDate || new Date());
        const dateB = new Date(b.dueDate || b.startDate || new Date());
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      console.error('Error getting project milestones:', error);
      return [];
    }
  }

  /**
   * Obtenir un milestone par son ID
   */
  async getMilestoneById(milestoneId: string): Promise<Milestone | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, milestoneId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        dueDate: data.dueDate?.toDate(),
        startDate: data.startDate?.toDate(),
        validatedAt: data.validatedAt?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Milestone;
    } catch (error) {
      console.error('Error getting milestone:', error);
      return null;
    }
  }

  /**
   * Mettre à jour un milestone
   */
  async updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<void> {
    try {
      // Nettoyer les valeurs undefined pour Firebase
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const docRef = doc(db, this.COLLECTION_NAME, milestoneId);
      await updateDoc(docRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating milestone:', error);
      throw error;
    }
  }

  /**
   * Ajouter un livrable à un milestone
   */
  async addDeliverable(milestoneId: string, deliverable: Deliverable): Promise<void> {
    try {
      const milestone = await this.getMilestoneById(milestoneId);
      if (!milestone) throw new Error('Milestone not found');
      
      const deliverables = [...(milestone.deliverables || []), deliverable];
      await this.updateMilestone(milestoneId, { deliverables });
    } catch (error) {
      console.error('Error adding deliverable:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un livrable
   */
  async updateDeliverable(milestoneId: string, deliverableId: string, updates: Partial<Deliverable>): Promise<void> {
    try {
      const milestone = await this.getMilestoneById(milestoneId);
      if (!milestone) throw new Error('Milestone not found');
      
      const deliverables = (milestone.deliverables || []).map(d => 
        d.id === deliverableId ? { ...d, ...updates } : d
      );
      
      await this.updateMilestone(milestoneId, { deliverables });
    } catch (error) {
      console.error('Error updating deliverable:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le taux de completion d'un milestone - SUPPRIMÉ
   * Le calcul automatique a été désactivé car il était trompeur
   */
  async updateMilestoneCompletion(milestoneId: string): Promise<void> {
    // Méthode désactivée - le calcul automatique était trompeur
    console.log(`⚠️ Milestone completion calculation disabled for ${milestoneId}`);
  }

  /**
   * Valider un milestone
   */
  async validateMilestone(milestoneId: string, validatorId: string, notes?: string): Promise<void> {
    try {
      await this.updateMilestone(milestoneId, {
        validatedBy: validatorId,
        validatedAt: new Date(),
        validationNotes: notes,
        status: 'completed' as MilestoneStatus,
        completionRate: 100,
      });
    } catch (error) {
      console.error('Error validating milestone:', error);
      throw error;
    }
  }

  /**
   * Récupérer les milestones d'un projet
   */
  async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('projectId', '==', projectId),
      orderBy('date', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate(),
      startDate: doc.data().startDate?.toDate(),
      validatedAt: doc.data().validatedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as Milestone));
  }

  /**
   * Obtenir les milestones par statut
   */
  async getMilestonesByStatus(projectId: string, status: MilestoneStatus): Promise<Milestone[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('projectId', '==', projectId),
        where('status', '==', status),
        orderBy('date', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate(),
        startDate: doc.data().startDate?.toDate(),
        validatedAt: doc.data().validatedAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Milestone));
    } catch (error) {
      console.error('Error getting milestones by status:', error);
      return [];
    }
  }

  /**
   * Obtenir les milestones à risque (date dépassée)
   */
  async getAtRiskMilestones(projectId: string): Promise<Milestone[]> {
    try {
      const milestones = await this.getMilestonesByProject(projectId);
      const now = new Date();
      
      return milestones.filter(m => 
        m.dueDate && m.dueDate < now && 
        m.status !== 'completed' && 
        m.completionRate < 100
      );
    } catch (error) {
      console.error('Error getting at-risk milestones:', error);
      return [];
    }
  }

  /**
   * Obtenir les prochains milestones (dans les 30 jours)
   */
  async getUpcomingMilestones(projectId: string, days: number = 30): Promise<Milestone[]> {
    try {
      const milestones = await this.getMilestonesByProject(projectId);
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);
      
      return milestones.filter(m => 
        m.dueDate && m.dueDate >= now && 
        m.dueDate <= futureDate &&
        m.status !== 'completed'
      );
    } catch (error) {
      console.error('Error getting upcoming milestones:', error);
      return [];
    }
  }

  /**
   * Ajouter une dépendance à un milestone
   */
  async addMilestoneDependency(milestoneId: string, dependency: MilestoneDependency): Promise<void> {
    try {
      const milestone = await this.getMilestoneById(milestoneId);
      if (!milestone) throw new Error('Milestone not found');
      
      const dependencies = [...(milestone.dependsOn || []), dependency];
      await this.updateMilestone(milestoneId, { dependsOn: dependencies });
    } catch (error) {
      console.error('Error adding milestone dependency:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un milestone peut être démarré (dépendances satisfaites)
   */
  async canMilestoneStart(milestoneId: string): Promise<{ canStart: boolean; blockedBy: string[] }> {
    try {
      const milestone = await this.getMilestoneById(milestoneId);
      if (!milestone) return { canStart: false, blockedBy: ['Milestone not found'] };
      
      const blockedBy: string[] = [];
      
      // Vérifier les dépendances
      for (const dep of milestone.dependsOn || []) {
        if (dep.type === 'milestone') {
          const depMilestone = await this.getMilestoneById(dep.id);
          if (!depMilestone || depMilestone.status !== 'completed') {
            blockedBy.push(`Milestone: ${dep.name}`);
          }
        } else if (dep.type === 'epic') {
          // Vérifier que l'epic est terminé
          const epicDoc = await getDoc(doc(db, 'epics', dep.id));
          if (!epicDoc.exists() || epicDoc.data()?.status !== 'completed') {
            blockedBy.push(`Epic: ${dep.name}`);
          }
        }
      }
      
      return {
        canStart: blockedBy.length === 0,
        blockedBy,
      };
    } catch (error) {
      console.error('Error checking milestone dependencies:', error);
      return { canStart: false, blockedBy: ['Error checking dependencies'] };
    }
  }

  /**
   * Supprimer un milestone
   */
  async deleteMilestone(milestoneId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, milestoneId));
    } catch (error) {
      console.error('Error deleting milestone:', error);
      throw error;
    }
  }

  /**
   * Calculer les métriques des milestones d'un projet
   */
  async getProjectMilestoneMetrics(projectId: string): Promise<{
    totalMilestones: number;
    completedMilestones: number;
    atRiskMilestones: number;
    upcomingMilestones: number;
    averageCompletion: number;
    keyDatesCount: number;
  }> {
    try {
      const milestones = await this.getMilestonesByProject(projectId);
      const atRisk = await this.getAtRiskMilestones(projectId);
      const upcoming = await this.getUpcomingMilestones(projectId);
      
      const metrics = {
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter(m => m.status === 'completed').length,
        atRiskMilestones: atRisk.length,
        upcomingMilestones: upcoming.length,
        averageCompletion: 0,
        keyDatesCount: milestones.filter(m => m.isKeyDate).length,
      };
      
      if (milestones.length > 0) {
        const totalCompletion = milestones.reduce((sum, m) => sum + (m.completionRate || 0), 0);
        metrics.averageCompletion = Math.round(totalCompletion / milestones.length);
      }
      
      return metrics;
    } catch (error) {
      console.error('Error calculating milestone metrics:', error);
      return {
        totalMilestones: 0,
        completedMilestones: 0,
        atRiskMilestones: 0,
        upcomingMilestones: 0,
        averageCompletion: 0,
        keyDatesCount: 0,
      };
    }
  }

  /**
   * Force le recalcul de tous les jalons d'un projet
   * Utile pour la maintenance ou la correction des données
   */
  async recalculateProjectMilestonesCompletion(projectId: string): Promise<void> {
    try {
      const milestones = await this.getProjectMilestones(projectId);
      console.log(`Recalculating completion for ${milestones.length} milestones in project ${projectId}...`);
      
      for (const milestone of milestones) {
        try {
          await this.updateMilestoneCompletion(milestone.id);
        } catch (error) {
          console.error(`Error updating completion for milestone ${milestone.id} (${milestone.name}):`, error);
        }
      }
      
      console.log('Milestone completion recalculation completed');
    } catch (error) {
      console.error('Error during bulk milestone completion recalculation:', error);
      throw error;
    }
  }
}

export const milestoneService = new MilestoneService();

// Fonction de test globale pour debug
(window as any).testMilestoneCompletion = async (milestoneId: string) => {
  console.log(`🧪 [TEST] Testing milestone completion for: ${milestoneId}`);
  await milestoneService.updateMilestoneCompletion(milestoneId);
};