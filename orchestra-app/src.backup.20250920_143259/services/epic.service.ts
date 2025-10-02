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
import { Epic, EpicStatus, Priority, Risk, EpicDependency } from '../types';

class EpicService {
  private readonly COLLECTION_NAME = 'epics';

  /**
   * Créer un nouvel Epic
   */
  async createEpic(epic: Omit<Epic, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...epic,
        status: epic.status || 'upcoming',
        progress: 0,
        taskCount: 0,
        completedTaskCount: 0,
        taskIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Mettre à jour le code de l'epic avec son ID
      await updateDoc(docRef, {
        code: epic.code || `EP-${docRef.id.slice(-4).toUpperCase()}`,
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating epic:', error);
      throw error;
    }
  }

  /**
   * Obtenir tous les epics d'un projet
   */
  async getProjectEpics(projectId: string): Promise<Epic[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(q);
      const epics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        dueDate: doc.data().dueDate?.toDate(),
        completedDate: doc.data().completedDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Epic));
      
      // Tri côté client temporairement : priority asc puis createdAt desc
      return epics.sort((a, b) => {
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      console.error('Error getting project epics:', error);
      return [];
    }
  }

  /**
   * Obtenir un epic par son ID
   */
  async getEpicById(epicId: string): Promise<Epic | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, epicId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startDate: data.startDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        completedDate: data.completedDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Epic;
    } catch (error) {
      console.error('Error getting epic:', error);
      return null;
    }
  }

  /**
   * Mettre à jour un epic
   */
  async updateEpic(epicId: string, updates: Partial<Epic>): Promise<void> {
    try {
      // Nettoyer les valeurs undefined pour Firebase
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const docRef = doc(db, this.COLLECTION_NAME, epicId);
      await updateDoc(docRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating epic:', error);
      throw error;
    }
  }

  /**
   * Ajouter une tâche à un epic
   */
  async addTaskToEpic(epicId: string, taskId: string): Promise<void> {
    try {
      const epic = await this.getEpicById(epicId);
      if (!epic) throw new Error('Epic not found');
      
      const updatedTaskIds = [...(epic.taskIds || []), taskId];
      await this.updateEpic(epicId, {
        taskIds: updatedTaskIds,
        taskCount: updatedTaskIds.length,
      });
      
      // Recalculer le progress
      await this.updateEpicProgress(epicId);
    } catch (error) {
      console.error('Error adding task to epic:', error);
      throw error;
    }
  }

  /**
   * Retirer une tâche d'un epic
   */
  async removeTaskFromEpic(epicId: string, taskId: string): Promise<void> {
    try {
      const epic = await this.getEpicById(epicId);
      if (!epic) throw new Error('Epic not found');
      
      const updatedTaskIds = (epic.taskIds || []).filter(id => id !== taskId);
      await this.updateEpic(epicId, {
        taskIds: updatedTaskIds,
        taskCount: updatedTaskIds.length,
      });
      
      // Recalculer le progress
      await this.updateEpicProgress(epicId);
    } catch (error) {
      console.error('Error removing task from epic:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le progrès d'un epic basé sur ses tâches
   */
  async updateEpicProgress(epicId: string): Promise<void> {
    try {
      const epic = await this.getEpicById(epicId);
      if (!epic || !epic.taskIds || epic.taskIds.length === 0) {
        await this.updateEpic(epicId, { progress: 0, completedTaskCount: 0 });
        return;
      }
      
      // Récupérer toutes les tâches de l'epic
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('__name__', 'in', epic.taskIds)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      let completedCount = 0;
      let totalStoryPoints = 0;
      let completedStoryPoints = 0;
      
      tasksSnapshot.docs.forEach(doc => {
        const task = doc.data();
        const storyPoints = task.storyPoints || 1;
        totalStoryPoints += storyPoints;
        
        if (task.status === 'DONE') {
          completedCount++;
          completedStoryPoints += storyPoints;
        }
      });
      
      const progress = totalStoryPoints > 0 
        ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
        : 0;
      
      await this.updateEpic(epicId, {
        progress,
        completedTaskCount: completedCount,
        actualStoryPoints: completedStoryPoints,
      });
      
      // Si l'epic est complété à 100%, mettre à jour son statut
      if (progress === 100 && epic.status === 'in_progress') {
        await this.updateEpic(epicId, {
          status: 'review' as EpicStatus,
          completedDate: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating epic progress:', error);
    }
  }

  /**
   * Ajouter un risque à un epic
   */
  async addRiskToEpic(epicId: string, risk: Risk): Promise<void> {
    try {
      const epic = await this.getEpicById(epicId);
      if (!epic) throw new Error('Epic not found');
      
      const risks = epic.risks || [];
      risks.push(risk);
      
      await this.updateEpic(epicId, { risks });
    } catch (error) {
      console.error('Error adding risk to epic:', error);
      throw error;
    }
  }

  /**
   * Ajouter une dépendance entre epics
   */
  async addEpicDependency(epicId: string, dependency: EpicDependency): Promise<void> {
    try {
      const epic = await this.getEpicById(epicId);
      if (!epic) throw new Error('Epic not found');
      
      const dependencies = epic.dependencies || [];
      dependencies.push(dependency);
      
      await this.updateEpic(epicId, { dependencies });
    } catch (error) {
      console.error('Error adding epic dependency:', error);
      throw error;
    }
  }

  /**
   * Obtenir les epics par statut
   */
  async getEpicsByStatus(projectId: string, status: EpicStatus): Promise<Epic[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('projectId', '==', projectId),
        where('status', '==', status),
        orderBy('priority', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        dueDate: doc.data().dueDate?.toDate(),
        completedDate: doc.data().completedDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Epic));
    } catch (error) {
      console.error('Error getting epics by status:', error);
      return [];
    }
  }

  /**
   * Supprimer un epic
   */
  async deleteEpic(epicId: string): Promise<void> {
    try {
      // Vérifier qu'aucune tâche n'est liée à cet epic
      const epic = await this.getEpicById(epicId);
      if (epic && epic.taskIds && epic.taskIds.length > 0) {
        throw new Error('Cannot delete epic with associated tasks');
      }
      
      await deleteDoc(doc(db, this.COLLECTION_NAME, epicId));
    } catch (error) {
      console.error('Error deleting epic:', error);
      throw error;
    }
  }

  /**
   * Calculer les métriques d'un projet basées sur ses epics
   */
  async getProjectEpicMetrics(projectId: string): Promise<{
    totalEpics: number;
    completedEpics: number;
    inProgressEpics: number;
    averageProgress: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
  }> {
    try {
      const epics = await this.getProjectEpics(projectId);
      
      const metrics = {
        totalEpics: epics.length,
        completedEpics: epics.filter(e => e.status === 'completed').length,
        inProgressEpics: epics.filter(e => e.status === 'in_progress').length,
        averageProgress: 0,
        totalStoryPoints: 0,
        completedStoryPoints: 0,
      };
      
      if (epics.length > 0) {
        const totalProgress = epics.reduce((sum, e) => sum + (e.progress || 0), 0);
        metrics.averageProgress = Math.round(totalProgress / epics.length);
        
        metrics.totalStoryPoints = epics.reduce((sum, e) => sum + (e.estimatedStoryPoints || 0), 0);
        metrics.completedStoryPoints = epics.reduce((sum, e) => sum + (e.actualStoryPoints || 0), 0);
      }
      
      return metrics;
    } catch (error) {
      console.error('Error calculating epic metrics:', error);
      return {
        totalEpics: 0,
        completedEpics: 0,
        inProgressEpics: 0,
        averageProgress: 0,
        totalStoryPoints: 0,
        completedStoryPoints: 0,
      };
    }
  }
}

export const epicService = new EpicService();