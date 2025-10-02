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
  writeBatch,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Task, TaskStatus, TaskType, Priority, TaskCategory } from '../types';

const COLLECTION_NAME = 'simpleTasks';

// Interface pour la création de tâches simples
export interface SimpleTaskData {
  title: string;
  description?: string;
  dueDate?: Date;
  priority: Priority;
  responsible?: string[]; // IDs des utilisateurs assignés
  labels?: string[];
  estimatedHours?: number;
}

// Interface pour la duplication multi-ressources
export interface TaskDuplicationData {
  sourceTaskId: string;
  targetUserIds: string[];
  modifications?: Partial<SimpleTaskData>;
}

// Fonction utilitaire pour transformer les données Firestore en Task
function transformFirestoreSimpleTask(doc: any): Task {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    ...data,
    taskCategory: 'SIMPLE_TASK' as TaskCategory,
    projectId: undefined, // Toujours undefined pour tâches simples
    dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate ? new Date(data.dueDate) : undefined,
    startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : undefined,
    completedDate: data.completedDate?.toDate ? data.completedDate.toDate() : data.completedDate ? new Date(data.completedDate) : undefined,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt ? new Date(data.deletedAt) : undefined,
    // Valeurs par défaut pour tâches simples
    dependencies: data.dependencies || [],
    labels: data.labels || [],
    attachments: data.attachments || [],
    comments: data.comments || [],
    customFields: data.customFields || {},
    definitionOfDone: data.definitionOfDone || [],
    type: data.type || 'TASK',
    status: data.status || 'TODO',
  } as any as Task;
}

export class SimpleTaskService {
  /**
   * Crée une nouvelle tâche simple
   */
  async createSimpleTask(taskData: SimpleTaskData, createdBy: string): Promise<Task> {
    try {
      const now = Timestamp.now();

      const simpleTaskDoc = {
        title: taskData.title,
        description: taskData.description || '',
        priority: taskData.priority,
        status: 'TODO' as TaskStatus,
        type: 'TASK' as TaskType,
        taskCategory: 'SIMPLE_TASK' as TaskCategory,

        // Dates
        dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : Timestamp.fromDate(new Date()),
        startDate: null,
        completedDate: null,

        // Assignation
        responsible: taskData.responsible || [],
        accountable: [createdBy],
        consulted: [],
        informed: [],

        // Estimation
        estimatedHours: taskData.estimatedHours || 0,
        remainingHours: taskData.estimatedHours || 0,
        loggedHours: 0,
        timeSpent: 0,

        // Metadata
        labels: taskData.labels || [],
        attachments: [],
        comments: [],
        dependencies: [],
        customFields: {},
        definitionOfDone: [],

        // État
        isBlocked: false,
        blockedReason: null,
        riskLevel: 'low',
        businessValue: 1,
        technicalDebt: false,

        // Audit
        createdAt: now,
        updatedAt: now,
        createdBy: createdBy,
        deletedAt: null,
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), simpleTaskDoc);
      const newDoc = await getDoc(docRef);

      return transformFirestoreSimpleTask(newDoc);
    } catch (error) {
      console.error('Erreur lors de la création de la tâche simple:', error);
      throw new Error('Impossible de créer la tâche simple');
    }
  }

  /**
   * Crée plusieurs tâches simples pour différents utilisateurs
   */
  async createMultipleSimpleTasks(taskData: SimpleTaskData, userIds: string[], createdBy: string): Promise<Task[]> {
    try {
      const batch = writeBatch(db);
      const createdTasks: Task[] = [];

      for (const userId of userIds) {
        const now = Timestamp.now();

        const simpleTaskDoc = {
          title: taskData.title,
          description: taskData.description || '',
          priority: taskData.priority,
          status: 'TODO' as TaskStatus,
          type: 'TASK' as TaskType,
          taskCategory: 'SIMPLE_TASK' as TaskCategory,

          // Dates
          dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : Timestamp.fromDate(new Date()),
          startDate: null,
          completedDate: null,

          // Assignation - un utilisateur par tâche
          responsible: [userId],
          accountable: [createdBy],
          consulted: [],
          informed: [],

          // Estimation
          estimatedHours: taskData.estimatedHours || 0,
          remainingHours: taskData.estimatedHours || 0,
          loggedHours: 0,
          timeSpent: 0,

          // Metadata
          labels: taskData.labels || [],
          attachments: [],
          comments: [],
          dependencies: [],
          customFields: {},
          definitionOfDone: [],

          // État
          isBlocked: false,
          blockedReason: null,
          riskLevel: 'low',
          businessValue: 1,
          technicalDebt: false,

          // Audit
          createdAt: now,
          updatedAt: now,
          createdBy: createdBy,
          deletedAt: null,
        };

        const newDocRef = doc(collection(db, COLLECTION_NAME));
        batch.set(newDocRef, simpleTaskDoc);

        // Préparer l'objet Task pour le retour
        createdTasks.push({
          id: newDocRef.id,
          ...simpleTaskDoc,
          taskCategory: 'SIMPLE_TASK',
          projectId: undefined, // Toujours undefined pour tâches simples
          dueDate: simpleTaskDoc.dueDate?.toDate(),
          startDate: null,
          completedDate: null,
          createdAt: simpleTaskDoc.createdAt.toDate(),
          updatedAt: simpleTaskDoc.updatedAt.toDate(),
          deletedAt: null,
          // Valeurs par défaut pour tâches simples
          dependencies: simpleTaskDoc.dependencies || [],
          labels: simpleTaskDoc.labels || [],
          attachments: simpleTaskDoc.attachments || [],
          comments: simpleTaskDoc.comments || [],
          customFields: simpleTaskDoc.customFields || {},
          definitionOfDone: simpleTaskDoc.definitionOfDone || [],
          type: simpleTaskDoc.type || 'TASK',
          status: simpleTaskDoc.status || 'TODO',
        } as any as Task);
      }

      await batch.commit();
      return createdTasks;

    } catch (error) {
      console.error('Erreur lors de la création multiple:', error);
      throw new Error('Impossible de créer les tâches multiples');
    }
  }

  /**
   * Duplique une tâche simple à plusieurs utilisateurs
   */
  async duplicateToUsers(duplicationData: TaskDuplicationData, createdBy: string): Promise<Task[]> {
    try {
      const { sourceTaskId, targetUserIds, modifications } = duplicationData;

      // Récupérer la tâche source
      const sourceTask = await this.getSimpleTaskById(sourceTaskId);
      if (!sourceTask) {
        throw new Error('Tâche source introuvable');
      }

      const batch = writeBatch(db);
      const duplicatedTasks: Task[] = [];

      for (const userId of targetUserIds) {
        const now = Timestamp.now();

        const duplicatedTaskData = {
          title: modifications?.title || sourceTask.title,
          description: modifications?.description || sourceTask.description,
          priority: modifications?.priority || sourceTask.priority,
          status: 'TODO' as TaskStatus,
          type: sourceTask.type,
          taskCategory: 'SIMPLE_TASK' as TaskCategory,

          // Dates - possibilité de modifier
          dueDate: modifications?.dueDate ? Timestamp.fromDate(modifications.dueDate) :
                   sourceTask.dueDate ? Timestamp.fromDate(sourceTask.dueDate) : null,
          startDate: null,
          completedDate: null,

          // Assignation - utilisateur cible
          responsible: [userId],
          accountable: [createdBy],
          consulted: [],
          informed: [],

          // Estimation
          estimatedHours: modifications?.estimatedHours || sourceTask.estimatedHours || 0,
          remainingHours: modifications?.estimatedHours || sourceTask.estimatedHours || 0,
          loggedHours: 0,
          timeSpent: 0,

          // Metadata
          labels: modifications?.labels || sourceTask.labels || [],
          attachments: [], // Pas de duplication des pièces jointes
          comments: [], // Nouveau historique de commentaires
          dependencies: [],
          customFields: sourceTask.customFields || {},
          definitionOfDone: sourceTask.definitionOfDone || [],

          // État
          isBlocked: false,
          blockedReason: null,
          riskLevel: sourceTask.riskLevel || 'low',
          businessValue: sourceTask.businessValue || 1,
          technicalDebt: sourceTask.technicalDebt || false,

          // Audit
          createdAt: now,
          updatedAt: now,
          createdBy: createdBy,
          deletedAt: null,

          // Référence à la tâche source
          sourceTaskId: sourceTaskId,
        };

        const newDocRef = doc(collection(db, COLLECTION_NAME));
        batch.set(newDocRef, duplicatedTaskData);

        // Préparer l'objet Task pour le retour
        duplicatedTasks.push({
          id: newDocRef.id,
          ...duplicatedTaskData,
          taskCategory: 'SIMPLE_TASK',
          dueDate: duplicatedTaskData.dueDate?.toDate(),
          createdAt: duplicatedTaskData.createdAt.toDate(),
          updatedAt: duplicatedTaskData.updatedAt.toDate(),
        } as any as Task);
      }

      await batch.commit();
      return duplicatedTasks;

    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      throw new Error('Impossible de dupliquer la tâche');
    }
  }

  /**
   * Récupère une tâche simple par ID
   */
  async getSimpleTaskById(taskId: string): Promise<Task | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, taskId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return transformFirestoreSimpleTask(docSnap);
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la tâche:', error);
      return null;
    }
  }

  /**
   * Récupère toutes les tâches simples d'un utilisateur
   */
  async getSimpleTasksByUser(userId: string): Promise<Task[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('responsible', 'array-contains', userId),
        where('deletedAt', '==', null),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => transformFirestoreSimpleTask(doc));
    } catch (error) {
      console.error('Erreur lors de la récupération des tâches utilisateur:', error);
      return [];
    }
  }

  /**
   * Récupère les tâches simples par plage de dates
   */
  async getSimpleTasksByDateRange(startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('deletedAt', '==', null),
        where('dueDate', '>=', Timestamp.fromDate(startDate)),
        where('dueDate', '<=', Timestamp.fromDate(endDate)),
      ];

      if (userId) {
        constraints.push(where('responsible', 'array-contains', userId));
      }

      constraints.push(orderBy('dueDate', 'asc'));

      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => transformFirestoreSimpleTask(doc));
    } catch (error) {
      console.error('Erreur lors de la récupération des tâches par date:', error);
      return [];
    }
  }

  /**
   * Met à jour une tâche simple
   */
  async updateSimpleTask(taskId: string, updates: Partial<SimpleTaskData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, taskId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      // Convertir les dates en Timestamp
      if (updates.dueDate) {
        updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      throw new Error('Impossible de mettre à jour la tâche');
    }
  }

  /**
   * Supprime une tâche simple (soft delete)
   */
  async deleteSimpleTask(taskId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, taskId);
      await updateDoc(docRef, {
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la tâche:', error);
      throw new Error('Impossible de supprimer la tâche');
    }
  }

  /**
   * Marque une tâche comme terminée
   */
  async completeSimpleTask(taskId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, taskId);
      await updateDoc(docRef, {
        status: 'DONE',
        completedDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur lors de la completion de la tâche:', error);
      throw new Error('Impossible de marquer la tâche comme terminée');
    }
  }

  /**
   * Récupère les statistiques des tâches simples d'un utilisateur
   */
  async getUserSimpleTasksStats(userId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
  }> {
    try {
      const tasks = await this.getSimpleTasksByUser(userId);
      const now = new Date();

      const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'DONE').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        todo: tasks.filter(t => t.status === 'TODO').length,
        overdue: tasks.filter(t =>
          t.dueDate &&
          t.dueDate < now &&
          t.status !== 'DONE'
        ).length,
      };

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        overdue: 0,
      };
    }
  }
}

// Instance singleton
export const simpleTaskService = new SimpleTaskService();