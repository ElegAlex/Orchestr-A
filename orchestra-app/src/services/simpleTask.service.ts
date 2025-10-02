import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SimpleTask, CreateSimpleTaskInput } from '../types/simpleTask';

const COLLECTION = 'simpleTasks';

/**
 * Transformer Firestore → SimpleTask
 * FORMAT NOUVEAU UNIQUEMENT
 */
function fromFirestore(docSnap: any): SimpleTask {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title,
    description: data.description || '',
    date: data.date.toDate(),
    timeSlot: {
      start: data.timeSlot.start,
      end: data.timeSlot.end,
    },
    assignedTo: data.assignedTo,
    priority: data.priority,
    status: data.status,
    createdBy: data.createdBy,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  };
}

/**
 * Service Simple Tasks
 */
class SimpleTaskService {
  /**
   * Créer UNE tâche simple
   */
  async create(input: CreateSimpleTaskInput, assignedTo: string, createdBy: string): Promise<SimpleTask> {
    const now = Timestamp.now();

    const taskData = {
      title: input.title,
      description: input.description || '',
      date: Timestamp.fromDate(input.date),
      timeSlot: {
        start: input.timeSlot.start,
        end: input.timeSlot.end,
      },
      assignedTo,
      priority: input.priority,
      status: 'TODO' as const,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION), taskData);
    const docSnap = await getDoc(docRef);

    return fromFirestore(docSnap);
  }

  /**
   * Créer PLUSIEURS tâches (duplication multi-users)
   */
  async createMultiple(
    input: CreateSimpleTaskInput,
    userIds: string[],
    createdBy: string
  ): Promise<SimpleTask[]> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const createdTasks: SimpleTask[] = [];

    for (const userId of userIds) {
      const taskData = {
        title: input.title,
        description: input.description || '',
        date: Timestamp.fromDate(input.date),
        timeSlot: {
          start: input.timeSlot.start,
          end: input.timeSlot.end,
        },
        assignedTo: userId,
        priority: input.priority,
        status: 'TODO' as const,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      const newDocRef = doc(collection(db, COLLECTION));
      batch.set(newDocRef, taskData);

      createdTasks.push({
        id: newDocRef.id,
        ...taskData,
        date: input.date,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      });
    }

    await batch.commit();
    return createdTasks;
  }

  /**
   * Récupérer TOUTES les tâches (pour admin/calendar global)
   */
  async getAll(): Promise<SimpleTask[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(fromFirestore);
  }

  /**
   * Récupérer par user
   */
  async getByUser(userId: string): Promise<SimpleTask[]> {
    const q = query(
      collection(db, COLLECTION),
      where('assignedTo', '==', userId),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(fromFirestore);
  }

  /**
   * Récupérer par user et date
   */
  async getByUserAndDate(userId: string, startDate: Date, endDate: Date): Promise<SimpleTask[]> {
    const q = query(
      collection(db, COLLECTION),
      where('assignedTo', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(fromFirestore);
  }

  /**
   * Récupérer par ID
   */
  async getById(id: string): Promise<SimpleTask | null> {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return fromFirestore(docSnap);
  }

  /**
   * Mettre à jour
   */
  async update(id: string, updates: Partial<CreateSimpleTaskInput>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    if (updates.date) {
      updateData.date = Timestamp.fromDate(updates.date);
    }

    await updateDoc(doc(db, COLLECTION, id), updateData);
  }

  /**
   * Supprimer
   */
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  /**
   * Changer statut
   */
  async updateStatus(id: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE'): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      status,
      updatedAt: Timestamp.now(),
    });
  }
}

export const simpleTaskService = new SimpleTaskService();
