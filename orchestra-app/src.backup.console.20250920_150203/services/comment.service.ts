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
  limit,
  Timestamp,
  writeBatch,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TaskComment, CommentReaction, User } from '../types';

const COMMENTS_COLLECTION = 'taskComments';
const USERS_COLLECTION = 'users';

// Fonction utilitaire pour transformer les documents Firestore
const transformFirestoreComment = (doc: any): TaskComment => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as TaskComment;
};

class CommentService {
  // Récupérer tous les commentaires d'une tâche
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    try {
      // Zero queries approach - fetch all and filter client-side
      const querySnapshot = await getDocs(collection(db, COMMENTS_COLLECTION));
      const allComments = querySnapshot.docs.map(doc => transformFirestoreComment(doc));
      
      // Filter by taskId and sort by createdAt asc
      return allComments
        .filter(comment => comment.taskId === taskId)
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
          return dateA.getTime() - dateB.getTime();
        });
    } catch (error) {
      
      return [];
    }
  }

  // Écouter les commentaires en temps réel
  subscribeToTaskComments(
    taskId: string,
    callback: (comments: TaskComment[]) => void
  ): () => void {
    // Zero queries approach - listen to entire collection
    const unsubscribe = onSnapshot(collection(db, COMMENTS_COLLECTION), (querySnapshot: QuerySnapshot<DocumentData>) => {
      const allComments = querySnapshot.docs.map(doc => transformFirestoreComment(doc));
      
      // Filter and sort client-side
      const filteredComments = allComments
        .filter(comment => comment.taskId === taskId)
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
          return dateA.getTime() - dateB.getTime();
        });
      
      callback(filteredComments);
    });

    return unsubscribe;
  }

  // Ajouter un commentaire
  async addComment(comment: Omit<TaskComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskComment> {
    try {
      const now = new Date();
      const commentData = {
        ...comment,
        createdAt: now,
        updatedAt: now,
        type: comment.type || 'comment',
        reactions: [],
      };

      const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), commentData);
      
      return {
        id: docRef.id,
        ...commentData,
      } as TaskComment;
    } catch (error) {
      
      throw error;
    }
  }

  // Mettre à jour un commentaire
  async updateComment(commentId: string, updates: Partial<TaskComment>): Promise<void> {
    try {
      const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };
      
      await updateDoc(commentRef, updateData);
    } catch (error) {
      
      throw error;
    }
  }

  // Supprimer un commentaire
  async deleteComment(commentId: string): Promise<void> {
    try {
      const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
      await deleteDoc(commentRef);
    } catch (error) {
      
      throw error;
    }
  }

  // Ajouter une réaction à un commentaire
  async addReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    try {
      const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
      
      // Récupérer le commentaire actuel
      const comments = await this.getTaskComments(''); // On va le faire différemment
      const comment = comments.find(c => c.id === commentId);
      
      if (!comment) {
        throw new Error('Commentaire non trouvé');
      }

      const existingReactions = comment.reactions || [];
      
      // Vérifier si l'utilisateur a déjà réagi avec ce même emoji
      const existingReactionIndex = existingReactions.findIndex(
        r => r.userId === userId && r.emoji === emoji
      );

      let newReactions;
      if (existingReactionIndex >= 0) {
        // Supprimer la réaction existante (toggle)
        newReactions = existingReactions.filter((_, index) => index !== existingReactionIndex);
      } else {
        // Ajouter la nouvelle réaction
        newReactions = [
          ...existingReactions,
          {
            userId,
            emoji,
            createdAt: new Date(),
          } as CommentReaction
        ];
      }

      await updateDoc(commentRef, {
        reactions: newReactions,
        updatedAt: new Date(),
      });
    } catch (error) {
      
      throw error;
    }
  }

  // Ajouter un commentaire automatique lors de changements de tâche
  async logTaskChange(
    taskId: string,
    userId: string,
    fieldChanged: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    try {
      let content = '';
      let type: TaskComment['type'] = 'comment';

      switch (fieldChanged) {
        case 'status':
          content = `Statut changé de "${oldValue}" vers "${newValue}"`;
          type = 'status_change';
          break;
        case 'assigneeIds':
          content = `Assignation changée`;
          type = 'assignment_change';
          break;
        case 'dueDate':
          const oldDateStr = oldValue ? new Date(oldValue).toLocaleDateString('fr-FR') : 'aucune';
          const newDateStr = newValue ? new Date(newValue).toLocaleDateString('fr-FR') : 'aucune';
          content = `Date d'échéance changée de ${oldDateStr} vers ${newDateStr}`;
          type = 'due_date_change';
          break;
        default:
          content = `${fieldChanged} modifié`;
      }

      await this.addComment({
        taskId,
        authorId: userId,
        content,
        type,
        metadata: {
          fieldChanged,
          oldValue,
          newValue,
        },
      });
    } catch (error) {
      
    }
  }

  // Rechercher des utilisateurs pour les mentions
  async searchUsers(searchQuery: string, searchLimit: number = 10): Promise<User[]> {
    try {
      if (searchQuery.length < 2) return [];

      // Cette requête pourrait être optimisée avec des index full-text search
      // Pour l'instant, on fait une requête simple
      const q = query(
        collection(db, USERS_COLLECTION),
        limit(searchLimit)
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        lastLoginAt: doc.data().lastLoginAt?.toDate?.() || doc.data().lastLoginAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      })) as User[];

      // Filtrer côté client (pas optimal pour la production)
      const lowerSearchQuery = searchQuery.toLowerCase();
      return users.filter(user => 
        user.displayName.toLowerCase().includes(lowerSearchQuery) ||
        user.email.toLowerCase().includes(lowerSearchQuery) ||
        user.firstName.toLowerCase().includes(lowerSearchQuery) ||
        user.lastName.toLowerCase().includes(lowerSearchQuery)
      );
    } catch (error) {
      
      return [];
    }
  }

  // Extraire les mentions d'un texte (@username)
  extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return Array.from(new Set(mentions)); // Remove duplicates
  }

  // Notifier les utilisateurs mentionnés
  async notifyMentionedUsers(mentions: string[], commentId: string, taskId: string): Promise<void> {
    try {
      // TODO: Implémenter le système de notifications
      // Pour l'instant, on log juste les mentions
      console.log('Utilisateurs mentionnés:', mentions, 'dans le commentaire', commentId, 'de la tâche', taskId);
      
      // Dans une vraie implémentation, on pourrait :
      // - Envoyer des emails
      // - Créer des notifications in-app
      // - Envoyer des notifications push
    } catch (error) {
      
    }
  }

  // Obtenir les statistiques des commentaires d'une tâche
  async getCommentStats(taskId: string): Promise<{
    totalComments: number;
    totalParticipants: number;
    lastActivity: Date | null;
  }> {
    try {
      const comments = await this.getTaskComments(taskId);
      
      const uniqueAuthors = new Set(comments.map(c => c.authorId));
      const lastComment = comments[comments.length - 1];
      
      return {
        totalComments: comments.length,
        totalParticipants: uniqueAuthors.size,
        lastActivity: lastComment ? lastComment.createdAt : null,
      };
    } catch (error) {
      
      return {
        totalComments: 0,
        totalParticipants: 0,
        lastActivity: null,
      };
    }
  }
}

export const commentService = new CommentService();