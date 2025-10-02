import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Sprint } from '../types';

export interface Objective extends Omit<Sprint, 'id' | 'startDate' | 'endDate'> {
  id: string;
  name: string;
  goal: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'active' | 'completed';
  taskIds: string[];
  plannedCapacity: number;
  actualCapacity?: number;
  createdAt: Date;
  completedAt?: Date;
}

class ObjectiveService {
  private collectionName = 'objectives';

  // Créer un nouvel objectif (avec des valeurs par défaut intelligentes)
  async createObjective(data: {
    name: string;
    projectId: string;
    goal?: string;
    endDate?: Date;
    taskIds?: string[];
  }): Promise<string> {
    const now = new Date();
    const defaultEndDate = new Date(now);
    defaultEndDate.setDate(now.getDate() + 14); // 2 semaines par défaut

    const objective: Omit<Objective, 'id'> = {
      name: data.name,
      goal: data.goal || `Livrer "${data.name}" dans les temps`,
      projectId: data.projectId,
      startDate: now,
      endDate: data.endDate || defaultEndDate,
      status: 'planning',
      taskIds: data.taskIds || [],
      plannedCapacity: data.taskIds?.length || 0,
      actualCapacity: 0,
      createdAt: now
    };

    const docRef = await addDoc(collection(db, this.collectionName), {
      ...objective,
      startDate: Timestamp.fromDate(objective.startDate),
      endDate: Timestamp.fromDate(objective.endDate),
      createdAt: Timestamp.fromDate(objective.createdAt)
    });

    return docRef.id;
  }

  // Récupérer tous les objectifs d'un projet
  async getObjectivesByProject(projectId: string): Promise<Objective[]> {
    const q = query(
      collection(db, this.collectionName),
      where('projectId', '==', projectId),
      orderBy('startDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt ? data.completedAt.toDate() : undefined
      } as Objective;
    });
  }

  // Récupérer l'objectif actuel (en cours)
  async getCurrentObjective(projectId: string): Promise<Objective | null> {
    const q = query(
      collection(db, this.collectionName),
      where('projectId', '==', projectId),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startDate: data.startDate.toDate(),
      endDate: data.endDate.toDate(),
      createdAt: data.createdAt.toDate(),
      completedAt: data.completedAt ? data.completedAt.toDate() : undefined
    } as Objective;
  }

  // Démarrer un objectif (passer de 'planning' à 'active')
  async startObjective(objectiveId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);
    await updateDoc(docRef, {
      status: 'active',
      startDate: Timestamp.fromDate(new Date())
    });
  }

  // Terminer un objectif
  async completeObjective(objectiveId: string, actualCapacity: number): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);
    await updateDoc(docRef, {
      status: 'completed',
      actualCapacity,
      completedAt: Timestamp.fromDate(new Date())
    });
  }

  // Ajouter des tâches à un objectif
  async addTasksToObjective(objectiveId: string, taskIds: string[]): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);

    // Récupérer l'objectif actuel pour merger les taskIds
    const snapshot = await getDocs(query(collection(db, this.collectionName), where('__name__', '==', objectiveId)));
    if (!snapshot.empty) {
      const currentData = snapshot.docs[0].data();
      const existingTaskIds = currentData.taskIds || [];
      const combinedIds = [...existingTaskIds, ...taskIds];
      const newTaskIds = combinedIds.filter((id, index) => combinedIds.indexOf(id) === index); // Éviter les doublons

      await updateDoc(docRef, {
        taskIds: newTaskIds,
        plannedCapacity: newTaskIds.length
      });
    }
  }

  // Retirer des tâches d'un objectif
  async removeTasksFromObjective(objectiveId: string, taskIds: string[]): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);

    const snapshot = await getDocs(query(collection(db, this.collectionName), where('__name__', '==', objectiveId)));
    if (!snapshot.empty) {
      const currentData = snapshot.docs[0].data();
      const existingTaskIds = currentData.taskIds || [];
      const newTaskIds = existingTaskIds.filter((id: string) => !taskIds.includes(id));

      await updateDoc(docRef, {
        taskIds: newTaskIds,
        plannedCapacity: newTaskIds.length
      });
    }
  }

  // Mettre à jour un objectif
  async updateObjective(objectiveId: string, updates: Partial<Objective>): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);
    const updateData: any = { ...updates };

    // Convertir les dates en Timestamp si nécessaire
    if (updateData.startDate) {
      updateData.startDate = Timestamp.fromDate(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = Timestamp.fromDate(updateData.endDate);
    }
    if (updateData.completedAt) {
      updateData.completedAt = Timestamp.fromDate(updateData.completedAt);
    }

    await updateDoc(docRef, updateData);
  }

  // Supprimer un objectif
  async deleteObjective(objectiveId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, objectiveId);
    await deleteDoc(docRef);
  }

  // Calculer les statistiques d'un objectif
  calculateObjectiveStats(objective: Objective, tasks: any[]): {
    progress: number;
    completedTasks: number;
    totalTasks: number;
    daysRemaining: number;
    isOnTrack: boolean;
    status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  } {
    const objectiveTasks = tasks.filter(task => objective.taskIds.includes(task.id));
    const completedTasks = objectiveTasks.filter(task => task.status === 'DONE').length;
    const totalTasks = objectiveTasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((objective.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.ceil((objective.endDate.getTime() - objective.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = totalDays > 0 ? ((totalDays - daysRemaining) / totalDays) * 100 : 0;

    const isOnTrack = progress >= expectedProgress * 0.8; // 80% de la progression attendue

    let status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
    if (objective.status === 'completed') {
      status = 'completed';
    } else if (daysRemaining === 0 && progress < 100) {
      status = 'delayed';
    } else if (progress < expectedProgress * 0.6) {
      status = 'at-risk';
    } else {
      status = 'on-track';
    }

    return {
      progress: Math.round(progress),
      completedTasks,
      totalTasks,
      daysRemaining,
      isOnTrack,
      status
    };
  }

  // Auto-suggestion pour créer un objectif à partir des tâches prioritaires
  async suggestObjectiveFromBacklog(projectId: string, taskCount: number = 10): Promise<{
    suggestedName: string;
    suggestedGoal: string;
    taskIds: string[];
  }> {
    // Cette méthode sera appelée avec les tâches filtrées côté composant
    // pour éviter de dupliquer la logique de récupération des tâches
    return {
      suggestedName: `Objectif Sprint ${new Date().getMonth() + 1}/${new Date().getDate()}`,
      suggestedGoal: `Livrer les ${taskCount} tâches prioritaires du projet`,
      taskIds: []
    };
  }
}

export const objectiveService = new ObjectiveService();