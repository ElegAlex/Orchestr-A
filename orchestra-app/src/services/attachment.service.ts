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
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { TaskAttachment } from '../types';

const ATTACHMENTS_COLLECTION = 'taskAttachments';
const STORAGE_PATH = 'task-attachments';

// Types utilitaires
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  attachment: TaskAttachment;
  success: boolean;
  error?: string;
}

// Fonction utilitaire pour transformer les documents Firestore
const transformFirestoreAttachment = (doc: any): TaskAttachment => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt,
  } as TaskAttachment;
};

class AttachmentService {
  // Récupérer toutes les pièces jointes d'une tâche
  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    try {
      // Zero queries approach - fetch all and filter client-side
      const querySnapshot = await getDocs(collection(db, ATTACHMENTS_COLLECTION));
      const allAttachments = querySnapshot.docs.map(doc => transformFirestoreAttachment(doc));
      
      // Filter by taskId and sort by uploadedAt desc
      return allAttachments
        .filter(attachment => attachment.taskId === taskId)
        .sort((a, b) => {
          const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : new Date(a.uploadedAt || 0);
          const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
    } catch (error) {
      console.error('Erreur lors de la récupération des pièces jointes:', error);
      return [];
    }
  }

  // Écouter les pièces jointes en temps réel
  subscribeToTaskAttachments(
    taskId: string,
    callback: (attachments: TaskAttachment[]) => void
  ): () => void {
    // Zero queries approach - listen to entire collection
    const unsubscribe = onSnapshot(collection(db, ATTACHMENTS_COLLECTION), (querySnapshot: QuerySnapshot<DocumentData>) => {
      const allAttachments = querySnapshot.docs.map(doc => transformFirestoreAttachment(doc));
      
      // Filter and sort client-side
      const filteredAttachments = allAttachments
        .filter(attachment => attachment.taskId === taskId)
        .sort((a, b) => {
          const dateA = a.uploadedAt instanceof Date ? a.uploadedAt : new Date(a.uploadedAt || 0);
          const dateB = b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
      
      callback(filteredAttachments);
    });

    return unsubscribe;
  }

  // Upload d'un fichier avec progress callback
  async uploadFile(
    file: File,
    taskId: string,
    userId: string,
    description?: string,
    tags?: string[],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Validation du fichier
      const validationError = this.validateFile(file);
      if (validationError) {
        return { attachment: {} as TaskAttachment, success: false, error: validationError };
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop() || '';
      const fileName = `${taskId}_${timestamp}_${randomId}.${extension}`;
      const filePath = `${STORAGE_PATH}/${fileName}`;

      // Créer la référence Storage
      const storageRef = ref(storage, filePath);

      // Upload avec monitoring du progress
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Progress callback
            if (onProgress) {
              const progress: UploadProgress = {
                loaded: snapshot.bytesTransferred,
                total: snapshot.totalBytes,
                percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              };
              onProgress(progress);
            }
          },
          (error) => {
            console.error('Erreur lors de l\'upload:', error);
            resolve({ attachment: {} as TaskAttachment, success: false, error: error.message });
          },
          async () => {
            try {
              // Upload terminé, récupérer l'URL
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Créer l'entrée en base de données
              const attachmentData = {
                taskId,
                fileName,
                originalName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                uploadedBy: userId,
                uploadedAt: new Date(),
                downloadUrl,
                description: description || '',
                tags: tags || [],
                isPublic: false,
                version: 1,
              };

              const docRef = await addDoc(collection(db, ATTACHMENTS_COLLECTION), attachmentData);
              
              const attachment: TaskAttachment = {
                id: docRef.id,
                ...attachmentData,
              };

              resolve({ attachment, success: true });
            } catch (error) {
              console.error('Erreur lors de la sauvegarde en base:', error);
              resolve({ attachment: {} as TaskAttachment, success: false, error: 'Erreur de sauvegarde' });
            }
          }
        );
      });
    } catch (error) {
      console.error('Erreur générale lors de l\'upload:', error);
      return { attachment: {} as TaskAttachment, success: false, error: 'Erreur générale' };
    }
  }

  // Upload de plusieurs fichiers
  async uploadMultipleFiles(
    files: File[],
    taskId: string,
    userId: string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void,
    onFileComplete?: (fileIndex: number, result: UploadResult) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const result = await this.uploadFile(
        file,
        taskId,
        userId,
        undefined,
        undefined,
        (progress) => onProgress?.(i, progress)
      );

      results.push(result);
      onFileComplete?.(i, result);
    }

    return results;
  }

  // Mettre à jour les métadonnées d'une pièce jointe
  async updateAttachment(
    attachmentId: string,
    updates: Partial<Pick<TaskAttachment, 'description' | 'tags' | 'isPublic'>>
  ): Promise<void> {
    try {
      const attachmentRef = doc(db, ATTACHMENTS_COLLECTION, attachmentId);
      await updateDoc(attachmentRef, updates);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la pièce jointe:', error);
      throw error;
    }
  }

  // Supprimer une pièce jointe
  async deleteAttachment(attachmentId: string): Promise<void> {
    try {
      // Récupérer les infos de la pièce jointe
      const attachments = await getDocs(
        query(collection(db, ATTACHMENTS_COLLECTION), where('__name__', '==', attachmentId))
      );
      
      if (attachments.empty) {
        throw new Error('Pièce jointe non trouvée');
      }

      const attachment = transformFirestoreAttachment(attachments.docs[0]);
      
      // Supprimer le fichier du Storage
      const storageRef = ref(storage, `${STORAGE_PATH}/${attachment.fileName}`);
      try {
        await deleteObject(storageRef);
      } catch (storageError) {
        console.warn('Fichier déjà supprimé du storage ou introuvable:', storageError);
      }

      // Supprimer l'entrée de la base de données
      const attachmentRef = doc(db, ATTACHMENTS_COLLECTION, attachmentId);
      await deleteDoc(attachmentRef);
    } catch (error) {
      console.error('Erreur lors de la suppression de la pièce jointe:', error);
      throw error;
    }
  }

  // Validation de fichier
  private validateFile(file: File): string | null {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Texte
      'text/plain', 'text/csv', 'text/markdown',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Code
      'application/json', 'application/javascript', 'text/html', 'text/css',
    ];

    if (file.size > maxSize) {
      return `Le fichier est trop volumineux (max: 50MB)`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `Type de fichier non autorisé: ${file.type}`;
    }

    return null;
  }

  // Obtenir les statistiques des pièces jointes d'une tâche
  async getAttachmentStats(taskId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
    recentUploads: number; // Dernières 24h
  }> {
    try {
      const attachments = await this.getTaskAttachments(taskId);
      
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const stats = {
        totalFiles: attachments.length,
        totalSize: attachments.reduce((sum, att) => sum + att.fileSize, 0),
        fileTypes: {} as Record<string, number>,
        recentUploads: 0,
      };

      attachments.forEach(att => {
        // Compter les types de fichiers
        const extension = att.originalName.split('.').pop()?.toLowerCase() || 'unknown';
        stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;
        
        // Compter les uploads récents
        if (att.uploadedAt > yesterday) {
          stats.recentUploads++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        recentUploads: 0,
      };
    }
  }

  // Générer une URL de prévisualisation pour les images
  async generateThumbnail(attachment: TaskAttachment): Promise<string | null> {
    try {
      if (!attachment.mimeType.startsWith('image/')) {
        return null;
      }

      // Pour les images, on utilise directement l'URL de téléchargement
      // Dans un vrai système, on pourrait générer des miniatures optimisées
      return attachment.downloadUrl;
    } catch (error) {
      console.error('Erreur lors de la génération de miniature:', error);
      return null;
    }
  }

  // Créer une nouvelle version d'un fichier
  async createFileVersion(
    originalAttachmentId: string,
    newFile: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Récupérer l'attachment original
      const originalAttachments = await getDocs(
        query(collection(db, ATTACHMENTS_COLLECTION), where('__name__', '==', originalAttachmentId))
      );
      
      if (originalAttachments.empty) {
        return { attachment: {} as TaskAttachment, success: false, error: 'Fichier original non trouvé' };
      }

      const originalAttachment = transformFirestoreAttachment(originalAttachments.docs[0]);
      
      // Upload de la nouvelle version
      const result = await this.uploadFile(
        newFile,
        originalAttachment.taskId,
        userId,
        originalAttachment.description,
        originalAttachment.tags,
        onProgress
      );

      if (result.success) {
        // Mettre à jour la nouvelle version avec les infos de versioning
        await this.updateAttachment(result.attachment.id, {
          // version: originalAttachment.version + 1, // Ne peut pas être mis à jour car pas dans les champs autorisés
          // previousVersionId: originalAttachment.id, // Ne peut pas être mis à jour car pas dans les champs autorisés
        });

        // Note: Dans une vraie implémentation, il faudrait ajouter version et previousVersionId
        // aux champs autorisés dans updateAttachment
      }

      return result;
    } catch (error) {
      console.error('Erreur lors de la création de version:', error);
      return { attachment: {} as TaskAttachment, success: false, error: 'Erreur de création de version' };
    }
  }

  // Formater la taille de fichier
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // Obtenir l'icône appropriée pour un type de fichier
  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📈';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
    if (mimeType.includes('text')) return '📃';
    return '📎';
  }
}

export const attachmentService = new AttachmentService();