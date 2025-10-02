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
import { Task, TaskStatus, TaskType, Priority, TimeEntry, TaskCategory } from '../types';

const COLLECTION_NAME = 'tasks';
const TIME_ENTRIES_COLLECTION = 'timeEntries';

// Fonction utilitaire pour transformer les données Firestore en Task
function transformFirestoreTask(doc: any): Task {
  let data, taskId;

  // Si c'est un DocumentSnapshot Firestore
  if (typeof doc.data === 'function') {
    data = doc.data();
    taskId = doc.id;
  } else {
    // Si c'est déjà un objet de données
    data = doc.data || doc;
    taskId = doc.id || data.id || '';
  }

  // Vérification de l'ID
  if (!taskId || taskId === '') {
    console.error('⚠️ Task ID is missing in transformFirestoreTask:', doc);
  }

  // S'assurer que l'ID du document n'est jamais écrasé
  const finalTask = {
    id: taskId, // ID du document Firestore en premier
    ...data,    // Puis les données
  };

  // Forcer l'ID à être celui du document, même si data.id existe et est différent
  finalTask.id = taskId;

  return {
    ...finalTask,
    // ✅ Assurer la compatibilité avec taskCategory
    taskCategory: data.taskCategory || 'PROJECT_TASK' as TaskCategory,
    dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate ? new Date(data.dueDate) : undefined,
    startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : undefined,
    completedDate: data.completedDate?.toDate ? data.completedDate.toDate() : data.completedDate ? new Date(data.completedDate) : undefined,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt ? new Date(data.deletedAt) : undefined,
    // Créneaux horaires (pour tâches simples uniquement, mais préservés pour compatibilité)
    startTime: data.startTime || undefined,
    endTime: data.endTime || undefined,
    // Assurer la compatibilité avec les anciens champs
    assigneeId: data.assigneeId || '',
    reporterId: data.reporterId || data.createdBy || '',
    dependencies: data.dependencies || [],
    labels: data.labels || [],
    attachments: data.attachments || [],
    comments: data.comments || [],
    customFields: data.customFields || {},
    definitionOfDone: data.definitionOfDone || [],
  } as Task;
}

export class TaskService {
  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      const now = Timestamp.now();

      // ✅ Validation taskCategory et projectId
      const taskCategory = taskData.taskCategory || 'PROJECT_TASK';

      // Pour les tâches projet, projectId est requis
      if (taskCategory === 'PROJECT_TASK' && !taskData.projectId) {
        throw new Error('projectId est requis pour les tâches de projet');
      }

      // ✅ Générer un code unique pour la tâche si pas fourni
      const code = taskData.code || (taskData.projectId ?
        await this.generateTaskCode(taskData.projectId) :
        await this.generateSimpleTaskCode()
      );

      const task: any = {
        ...taskData,
        code,
        taskCategory,
        createdAt: now,
        updatedAt: now,
        // Valeurs par défaut
        status: taskData.status || 'BACKLOG' as TaskStatus,
        priority: taskData.priority || 'P2' as Priority,
        timeSpent: taskData.timeSpent || 0,
        loggedHours: taskData.loggedHours || 0,
        comments: taskData.comments || [],
        attachments: taskData.attachments || [],
        labels: taskData.labels || [],
        dependencies: taskData.dependencies || [],
        customFields: taskData.customFields || {},
        definitionOfDone: taskData.definitionOfDone || [],
        isBlocked: taskData.isBlocked || false,
        technicalDebt: taskData.technicalDebt || false,
        deletedAt: null,
      };
      
      // Nettoyer tous les champs undefined avant d'envoyer à Firestore
      Object.keys(task).forEach(key => {
        if (task[key] === undefined) {
          delete task[key];
        }
      });
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), task);

      // Créer l'objet tâche avec l'ID correct
      const createdTaskData = {
        ...task,
        id: docRef.id
      };

      // Mettre à jour le document avec son ID
      await updateDoc(docRef, { id: docRef.id });

      const createdTask = transformFirestoreTask(createdTaskData);

      // Mettre à jour les éléments liés après création de la tâche
      try {
        if (createdTask.projectId) {
          const { projectService } = await import('./project.service');
          await projectService.updateProjectProgress(createdTask.projectId);
        }
        
        // Calcul automatique des jalons supprimé (était trompeur)
      } catch (error) {
        console.error('Error updating project/milestone progress after task creation:', error);
      }

      return createdTask;
    } catch (error) {
      console.error('Erreur lors de la création de la tâche:', error);
      throw error;
    }
  }

  async getTask(id: string): Promise<Task | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return transformFirestoreTask(docSnap);
    }
    return null;
  }

  async getTasks(): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('deletedAt', '==', null)
    );
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    
    // Trier côté client par date de création décroissante
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async generateTaskCode(projectId?: string): Promise<string> {
    try {
      // Si pas de projectId ou projectId vide, générer un code générique
      if (!projectId || projectId.trim() === '') {
        return `ADMIN-${Date.now()}`;
      }

      // Récupérer le projet pour obtenir son code
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      const projectCode = projectDoc.exists() ? projectDoc.data()?.code || 'PROJ' : 'PROJ';

      // Compter les tâches existantes du projet pour générer un numéro séquentiel
      const tasksQuery = query(
        collection(db, COLLECTION_NAME),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const taskNumber = tasksSnapshot.size + 1;

      return `${projectCode}-${taskNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Erreur lors de la génération du code de tâche:', error);
      // En cas d'erreur, retourner un code par défaut
      return `TASK-${Date.now()}`;
    }
  }

  // ✅ Nouvelle méthode pour générer des codes de tâches simples
  async generateSimpleTaskCode(): Promise<string> {
    try {
      // Compter toutes les tâches simples existantes
      const simpleTasksQuery = query(
        collection(db, 'simpleTasks'),
        where('deletedAt', '==', null)
      );
      const simpleTasksSnapshot = await getDocs(simpleTasksQuery);
      const taskNumber = simpleTasksSnapshot.size + 1;

      return `SIMPLE-${taskNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Erreur lors de la génération du code de tâche simple:', error);
      return `SIMPLE-${Date.now()}`;
    }
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    console.log(`🔧 [DEBUG] updateTask called for task ${id} with updates:`, updates);
    
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    // Nettoyer tous les champs undefined avant d'envoyer à Firestore
    Object.keys(updatedData).forEach(key => {
      if (updatedData[key as keyof typeof updatedData] === undefined) {
        delete updatedData[key as keyof typeof updatedData];
      }
    });
    
    await updateDoc(docRef, updatedData);
    
    const updatedTask = await this.getTask(id);
    if (!updatedTask) {
      throw new Error('Task not found after update');
    }

    // Si le statut de la tâche a changé, mettre à jour automatiquement les éléments liés
    if (updates.status) {
      try {
        // Mettre à jour le progrès du projet si la tâche appartient à un projet
        if (updatedTask.projectId) {
          const { projectService } = await import('./project.service');
          await projectService.updateProjectProgress(updatedTask.projectId);
        }
        
        // Calcul automatique des jalons supprimé (était trompeur)
      } catch (error) {
        console.error('Error updating project/milestone progress:', error);
        // Ne pas faire échouer la mise à jour de la tâche si les mises à jour échouent
      }
    }
    
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    // Validation de l'ID
    if (!id || id.trim() === '') {
      throw new Error('ID de tâche invalide ou manquant');
    }
    
    console.log('🗑️ TaskService.deleteTask - Suppression de la tâche:', id);
    
    // Récupérer la tâche avant suppression pour connaître le projectId
    const taskToDelete = await this.getTask(id);
    
    if (!taskToDelete) {
      throw new Error(`Tâche avec l'ID ${id} introuvable`);
    }
    
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);

    // Mettre à jour les éléments liés après suppression
    if (taskToDelete) {
      try {
        if (taskToDelete.projectId) {
          const { projectService } = await import('./project.service');
          await projectService.updateProjectProgress(taskToDelete.projectId);
        }
        
        // Calcul automatique des jalons supprimé (était trompeur)
      } catch (error) {
        console.error('Error updating project/milestone progress after task deletion:', error);
      }
    }
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('projectId', '==', projectId)
    );

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));

    // Tri côté client par createdAt desc
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    // Rechercher les tâches où l'utilisateur est dans le tableau 'responsible'
    // ET aussi celles avec l'ancien champ 'assigneeId' pour la rétrocompatibilité
    const responsibleQuery = query(
      collection(db, COLLECTION_NAME),
      where('responsible', 'array-contains', assigneeId)
    );
    
    const assigneeQuery = query(
      collection(db, COLLECTION_NAME),
      where('assigneeId', '==', assigneeId)
    );
    
    // Exécuter les deux requêtes en parallèle
    const [responsibleSnapshot, assigneeSnapshot] = await Promise.all([
      getDocs(responsibleQuery),
      getDocs(assigneeQuery)
    ]);
    
    // Combiner les résultats et éliminer les doublons
    const taskMap = new Map<string, Task>();
    
    responsibleSnapshot.docs.forEach(doc => {
      const task = transformFirestoreTask(doc);
      taskMap.set(task.id, task);
    });
    
    assigneeSnapshot.docs.forEach(doc => {
      const task = transformFirestoreTask(doc);
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });
    
    const tasks = Array.from(taskMap.values());
    
    // Tri côté client par dueDate
    return tasks.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });
  }

  // Méthode optimisée pour le calendrier - récupère seulement les tâches avec dates dans la plage
  async getTasksByDateRange(startDate: Date, endDate: Date): Promise<Task[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('dueDate', '>=', Timestamp.fromDate(startDate)),
        where('dueDate', '<=', Timestamp.fromDate(endDate)),
        limit(200) // Limiter pour la performance
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    } catch (error) {
      console.error('Error getting tasks by date range:', error);
      // Fallback: récupérer toutes les tâches et filtrer côté client
      const allTasks = await this.getTasks();
      return allTasks.filter(task => 
        task.dueDate && 
        task.dueDate >= startDate && 
        task.dueDate <= endDate
      );
    }
  }

  async getTasksByStatus(status: TaskStatus, projectId?: string): Promise<Task[]> {
    const constraints: QueryConstraint[] = [
      where('status', '==', status),
      orderBy('updatedAt', 'desc')
    ];

    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId));
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => transformFirestoreTask(doc));
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    console.log(`🎯 [DEBUG] updateTaskStatus called for task ${id} with status ${status}`);
    const updates: Partial<Task> = { status };
    
    if (status === 'DONE') {
      updates.completedDate = new Date();
    } else if (status === 'IN_PROGRESS' && !updates.startDate) {
      updates.startDate = new Date();
    }

    return await this.updateTask(id, updates);
  }

  async addTimeSpent(id: string, timeInHours: number): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) {
      throw new Error('Task not found');
    }

    const newTimeSpent = (task.timeSpent || 0) + timeInHours;
    return await this.updateTask(id, { timeSpent: newTimeSpent });
  }

  async addComment(taskId: string, comment: {
    authorId: string;
    content: string;
    mentions?: string[];
  }): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...comment,
      createdAt: new Date(),
    };

    const updatedComments = [...task.comments, newComment];
    return await this.updateTask(taskId, { comments: updatedComments });
  }

  async addAttachment(taskId: string, attachment: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    uploadedBy: string;
  }): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const newAttachment = {
      id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...attachment,
      uploadedAt: new Date(),
    };

    const updatedAttachments = [...task.attachments, newAttachment];
    return await this.updateTask(taskId, { attachments: updatedAttachments });
  }

  async addDependency(taskId: string, dependency: {
    taskId: string;
    type: 'FS' | 'FF' | 'SF' | 'SS';
    lag?: number;
  }): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Vérifier que la dépendance n'existe pas déjà
    const existingDependency = task.dependencies.find(
      dep => dep.taskId === dependency.taskId
    );
    
    if (existingDependency) {
      throw new Error('Dependency already exists');
    }

    const updatedDependencies = [...task.dependencies, dependency];
    return await this.updateTask(taskId, { dependencies: updatedDependencies });
  }

  async removeDependency(taskId: string, dependentTaskId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const updatedDependencies = task.dependencies.filter(
      dep => dep.taskId !== dependentTaskId
    );
    return await this.updateTask(taskId, { dependencies: updatedDependencies });
  }

  async getSubtasks(parentId: string): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('parentTaskId', '==', parentId),
      where('deletedAt', '==', null)
      // Note: orderBy removed to avoid composite index requirement
      // Subtasks will be sorted client-side if needed
    );

    const querySnapshot = await getDocs(q);

    // Sort client-side by createdAt
    const subtasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    return subtasks.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return dateA - dateB;
    });
  }

  async searchTasks(searchTerm: string, filters?: {
    projectId?: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string;
    type?: TaskType;
  }): Promise<Task[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }
    
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }
    
    if (filters?.assigneeId) {
      constraints.push(where('assigneeId', '==', filters.assigneeId));
    }
    
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));

    // Filtrage côté client pour la recherche textuelle
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      return tasks.filter(task =>
        task.title.toLowerCase().includes(lowercaseSearch) ||
        task.description.toLowerCase().includes(lowercaseSearch) ||
        task.labels.some(label => label.toLowerCase().includes(lowercaseSearch))
      );
    }

    return tasks;
  }

  async duplicateTask(taskId: string, newTitle?: string): Promise<Task> {
    const originalTask = await this.getTask(taskId);
    if (!originalTask) {
      throw new Error('Task not found');
    }

    const duplicatedTask = {
      ...originalTask,
      title: newTitle || `${originalTask.title} (Copie)`,
      status: 'todo' as TaskStatus,
      startDate: undefined,
      completedDate: undefined,
      timeSpent: 0,
      comments: [],
      attachments: [],
    };

    // Supprimer les champs qui ne doivent pas être copiés
    delete (duplicatedTask as any).id;
    delete (duplicatedTask as any).createdAt;
    delete (duplicatedTask as any).updatedAt;

    return await this.createTask(duplicatedTask);
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      const updates: any = { status, updatedAt: new Date() };
      
      if (status === 'DONE') {
        updates.completedDate = Timestamp.now();
      }
      
      batch.update(taskRef, updates);
    });

    await batch.commit();
  }

  async getTasksForKanban(projectId: string): Promise<{ [key in TaskStatus]: Task[] }> {
    const tasks = await this.getTasksByProject(projectId);
    
    const kanbanTasks: { [key in TaskStatus]: Task[] } = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      BLOCKED: []
    };

    tasks.forEach(task => {
      if (kanbanTasks[task.status]) {
        kanbanTasks[task.status].push(task);
      }
    });

    return kanbanTasks;
  }

  // Nouvelles méthodes pour les fonctionnalités avancées

  async logTime(taskId: string, timeEntry: Omit<TimeEntry, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>): Promise<TimeEntry> {
    const now = new Date();
    const entry = {
      id: `time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      ...timeEntry,
      createdAt: now,
      updatedAt: now,
    };

    // Ajouter l'entrée de temps à la collection dédiée
    await addDoc(collection(db, TIME_ENTRIES_COLLECTION), entry);

    // Mettre à jour le temps total sur la tâche
    const task = await this.getTask(taskId);
    if (task) {
      const newLoggedHours = (task.loggedHours || 0) + timeEntry.hours;
      await this.updateTask(taskId, { 
        loggedHours: newLoggedHours,
        remainingHours: task.estimatedHours ? Math.max(0, task.estimatedHours - newLoggedHours) : undefined
      });
    }

    return entry;
  }

  async getTimeEntries(taskId: string): Promise<TimeEntry[]> {
    const q = query(
      collection(db, TIME_ENTRIES_COLLECTION),
      where('taskId', '==', taskId),
      orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
  }

  async blockTask(taskId: string, reason: string): Promise<Task> {
    return await this.updateTask(taskId, {
      isBlocked: true,
      blockedReason: reason,
      status: 'BLOCKED' as TaskStatus
    });
  }

  async unblockTask(taskId: string): Promise<Task> {
    return await this.updateTask(taskId, {
      isBlocked: false,
      blockedReason: undefined,
      status: 'TODO' as TaskStatus
    });
  }


  async setEpic(taskId: string, epicId: string): Promise<Task> {
    return await this.updateTask(taskId, { epicId });
  }

  async getEpicTasks(epicId: string): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('epicId', '==', epicId),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => transformFirestoreTask(doc));
  }

  async setMilestone(taskId: string, milestoneId: string): Promise<Task> {
    return await this.updateTask(taskId, { milestoneId });
  }

  async getMilestoneTasks(milestoneId: string): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('milestoneId', '==', milestoneId),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => transformFirestoreTask(doc));
  }

  async removeMilestone(taskId: string): Promise<Task> {
    return await this.updateTask(taskId, { milestoneId: '' });
  }

  async getTasksByAssigneeAndStatus(assigneeId: string, status: TaskStatus[]): Promise<Task[]> {
    // Rechercher les tâches où l'utilisateur est dans le tableau 'responsible'
    const responsibleQuery = query(
      collection(db, COLLECTION_NAME),
      where('responsible', 'array-contains', assigneeId),
      where('status', 'in', status),
      limit(50)
    );
    
    // Aussi rechercher avec l'ancien champ 'assigneeId' pour la rétrocompatibilité
    const assigneeQuery = query(
      collection(db, COLLECTION_NAME),
      where('assigneeId', '==', assigneeId),
      where('status', 'in', status),
      limit(50)
    );
    
    // Exécuter les deux requêtes en parallèle
    const [responsibleSnapshot, assigneeSnapshot] = await Promise.all([
      getDocs(responsibleQuery),
      getDocs(assigneeQuery)
    ]);
    
    // Combiner les résultats et éliminer les doublons
    const taskMap = new Map<string, Task>();
    
    responsibleSnapshot.docs.forEach(doc => {
      const task = transformFirestoreTask(doc);
      taskMap.set(task.id, task);
    });
    
    assigneeSnapshot.docs.forEach(doc => {
      const task = transformFirestoreTask(doc);
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });
    
    const tasks = Array.from(taskMap.values());
    
    // Tri côté client par priorité
    return tasks.sort((a, b) => {
      const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getMyResponsibleTasks(userId: string): Promise<Task[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('responsible', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    
    // Tri côté client par priorité et date d'échéance
    return tasks.sort((a, b) => {
      // Prioriser les tâches en cours
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
      
      // Puis par priorité (P0 > P1 > P2 > P3)
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Enfin par date d'échéance
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }

  async getOverdueTasks(projectId?: string): Promise<Task[]> {
    const constraints: QueryConstraint[] = [
      where('dueDate', '<', new Date()),
      where('status', '!=', 'DONE')
      // Suppression des orderBy multiples pour éviter les index composites
    ];

    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId));
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    
    // Tri côté client par status puis dueDate
    return tasks.sort((a, b) => {
      const statusOrder: Record<string, number> = { 'TODO': 0, 'IN_PROGRESS': 1, 'DONE': 2, 'BLOCKED': 3 };
      const statusA = statusOrder[a.status] || 999;
      const statusB = statusOrder[b.status] || 999;
      
      if (statusA !== statusB) return statusA - statusB;
      
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });
  }

  async getHighPriorityTasks(projectId?: string): Promise<Task[]> {
    const constraints: QueryConstraint[] = [
      where('priority', 'in', ['P0', 'P1']),
      where('status', 'in', ['TODO', 'IN_PROGRESS'])
      // Suppression des orderBy multiples pour éviter les index composites
    ];

    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId));
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => transformFirestoreTask(doc));
    
    // Tri côté client par priority puis dueDate, puis limiter à 20
    const priorityOrder: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    const sortedTasks = tasks.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 999;
      const priorityB = priorityOrder[b.priority] || 999;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });
    
    return sortedTasks.slice(0, 20); // Limiter à 20 résultats
  }

  async updateTaskEstimation(taskId: string, estimatedHours: number, storyPoints?: number): Promise<Task> {
    const updates: Partial<Task> = { estimatedHours };
    if (storyPoints !== undefined) {
      updates.storyPoints = storyPoints;
    }

    const task = await this.getTask(taskId);
    if (task && task.loggedHours) {
      updates.remainingHours = Math.max(0, estimatedHours - task.loggedHours);
    } else {
      updates.remainingHours = estimatedHours;
    }

    return await this.updateTask(taskId, updates);
  }

  // Méthodes pour les opérations en lot
  async bulkUpdatePriority(taskIds: string[], priority: Priority): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      batch.update(taskRef, { 
        priority, 
        updatedAt: Timestamp.now() 
      });
    });

    await batch.commit();
  }

  async bulkAssign(taskIds: string[], assigneeId: string): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      batch.update(taskRef, { 
        assigneeIds: [assigneeId], 
        updatedAt: Timestamp.now() 
      });
    });

    await batch.commit();
  }

  async bulkAddLabels(taskIds: string[], labels: string[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const taskId of taskIds) {
      const task = await this.getTask(taskId);
      if (task) {
        const taskRef = doc(db, COLLECTION_NAME, taskId);
        const existingLabels = task.labels || [];
        const newLabels = Array.from(new Set([...existingLabels, ...labels])); // Remove duplicates
        
        batch.update(taskRef, { 
          labels: newLabels, 
          updatedAt: Timestamp.now() 
        });
      }
    }

    await batch.commit();
  }

  async bulkSetDueDate(taskIds: string[], dueDate: Date): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      batch.update(taskRef, { 
        dueDate, 
        updatedAt: Timestamp.now() 
      });
    });

    await batch.commit();
  }

  async bulkBlock(taskIds: string[], reason: string): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      batch.update(taskRef, { 
        status: 'BLOCKED' as TaskStatus,
        blockingReason: reason,
        updatedAt: Timestamp.now() 
      });
    });

    await batch.commit();
  }

  async bulkDelete(taskIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    
    taskIds.forEach(taskId => {
      const taskRef = doc(db, COLLECTION_NAME, taskId);
      batch.delete(taskRef);
    });

    // Also delete associated time entries
    for (const taskId of taskIds) {
      const timeEntriesQuery = query(
        collection(db, TIME_ENTRIES_COLLECTION),
        where('taskId', '==', taskId)
      );
      
      const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
      timeEntriesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    await batch.commit();
  }

  // Alias pour getSubtasks - uniformité avec le hook useSubtasks
  async getTasksByParentId(parentId: string): Promise<Task[]> {
    return this.getSubtasks(parentId);
  }
}

export const taskService = new TaskService();