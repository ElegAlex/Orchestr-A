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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PersonalTodo, CreatePersonalTodoInput } from '../types/personalTodo';

const COLLECTION = 'personalTodos';

/**
 * Transformer Firestore → PersonalTodo
 */
function fromFirestore(docSnap: any): PersonalTodo {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    text: data.text,
    completed: data.completed,
    priority: data.priority,
    createdAt: data.createdAt.toDate(),
    completedAt: data.completedAt ? data.completedAt.toDate() : undefined,
  };
}

/**
 * Service Personal Todos
 */
class PersonalTodoService {
  /**
   * Créer une to-do personnelle
   */
  async create(userId: string, input: CreatePersonalTodoInput): Promise<PersonalTodo> {
    const now = Timestamp.now();

    const todoData: any = {
      userId,
      text: input.text,
      completed: false,
      createdAt: now,
    };

    // N'ajouter priority que si elle est définie
    if (input.priority) {
      todoData.priority = input.priority;
    }

    const docRef = await addDoc(collection(db, COLLECTION), todoData);
    const docSnap = await getDoc(docRef);

    return fromFirestore(docSnap);
  }

  /**
   * Récupérer toutes les to-dos d'un user
   */
  async getUserTodos(userId: string): Promise<PersonalTodo[]> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('completed', 'asc'), // Non complétées en premier
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(fromFirestore);
  }

  /**
   * Toggle completed
   */
  async toggleCompleted(id: string, completed: boolean): Promise<void> {
    const updateData: any = {
      completed,
      completedAt: completed ? Timestamp.now() : null,
    };

    await updateDoc(doc(db, COLLECTION, id), updateData);
  }

  /**
   * Mettre à jour le texte
   */
  async updateText(id: string, text: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { text });
  }

  /**
   * Mettre à jour la priorité
   */
  async updatePriority(id: string, priority: 'low' | 'medium' | 'high' | undefined): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { priority });
  }

  /**
   * Supprimer une to-do
   */
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  /**
   * Auto-cleanup : supprimer les to-dos complétées > 7 jours
   */
  async cleanupOldCompleted(userId: string): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('completed', '==', true),
      where('completedAt', '<', Timestamp.fromDate(sevenDaysAgo))
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }
}

export const personalTodoService = new PersonalTodoService();
