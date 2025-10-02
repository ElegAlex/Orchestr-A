import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  getMetadata,
  updateMetadata,
  listAll
} from 'firebase/storage';
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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { storage, db, auth } from '../config/firebase';
import { userService } from './user.service';

export interface Document {
  id: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
  url: string;
  storagePath: string;
  projectId?: string;
  taskId?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: Date;
  lastModifiedAt: Date;
  version: number;
  tags?: string[];
  description?: string;
  isPublic: boolean;
  permissions?: {
    canView: string[];
    canEdit: string[];
    canDelete: string[];
  };
  metadata?: {
    contentType?: string;
    customMetadata?: Record<string, string>;
  };
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
}

class DocumentService {
  private readonly COLLECTION = 'documents';
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    'application/zip',
    'application/x-rar-compressed',
  ];

  /**
   * Upload d'un document avec suivi de progression
   */
  async uploadDocument(
    file: File,
    options: {
      projectId?: string;
      taskId?: string;
      description?: string;
      tags?: string[];
      isPublic?: boolean;
      onProgress?: (progress: UploadProgress) => void;
    } = {}
  ): Promise<Document> {
    try {
      // Validation du fichier
      this.validateFile(file);

      const user = auth.currentUser;
      if (!user) throw new Error('Utilisateur non authentifié');

      // Génération du chemin de stockage
      const timestamp = Date.now();
      const sanitizedFileName = this.sanitizeFileName(file.name);
      const storagePath = this.generateStoragePath({
        projectId: options.projectId,
        taskId: options.taskId,
        fileName: `${timestamp}_${sanitizedFileName}`
      });

      // Référence Storage
      const storageRef = ref(storage, storagePath);

      // Upload avec suivi de progression
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadedBy: user.uid,
          uploadedAt: new Date().toISOString(),
          projectId: options.projectId || '',
          taskId: options.taskId || '',
          originalName: file.name
        }
      });

      // Gestion de la progression
      if (options.onProgress) {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress: UploadProgress = {
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              state: snapshot.state as any
            };
            options.onProgress!(progress);
          },
          (error) => {
            
            throw error;
          }
        );
      }

      // Attendre la fin de l'upload
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Créer l'entrée dans Firestore
      const documentData = {
        name: sanitizedFileName,
        originalName: file.name,
        type: file.type,
        size: file.size,
        url: downloadURL,
        storagePath,
        projectId: options.projectId || null,
        taskId: options.taskId || null,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || user.email || 'Unknown',
        uploadedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastModifiedAt: serverTimestamp(),
        version: 1,
        tags: options.tags || [],
        description: options.description || '',
        isPublic: options.isPublic || false,
        permissions: {
          canView: [user.uid],
          canEdit: [user.uid],
          canDelete: [user.uid]
        },
        metadata: {
          contentType: file.type,
          customMetadata: {
            originalSize: file.size.toString(),
            lastModified: file.lastModified.toString()
          }
        }
      };

      const docRef = await addDoc(collection(db, this.COLLECTION), documentData);

      // Retourner le document créé
      return {
        id: docRef.id,
        ...documentData,
        uploadedAt: new Date(),
        lastModifiedAt: new Date()
      } as Document;

    } catch (error) {
      
      
      
      
      throw error;
    }
  }

  /**
   * Upload multiple de documents
   */
  async uploadMultipleDocuments(
    files: FileList | File[],
    options: {
      projectId?: string;
      taskId?: string;
      onProgress?: (file: string, progress: UploadProgress) => void;
      onFileComplete?: (file: string, document: Document) => void;
    } = {}
  ): Promise<Document[]> {
    const documents: Document[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        const document = await this.uploadDocument(file, {
          ...options,
          onProgress: options.onProgress ? 
            (progress) => options.onProgress!(file.name, progress) : 
            undefined
        });

        documents.push(document);
        
        if (options.onFileComplete) {
          options.onFileComplete(file.name, document);
        }
      } catch (error) {
        
        // Continuer avec les autres fichiers
      }
    }

    return documents;
  }

  /**
   * Supprimer un document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Récupérer les informations du document
      const docRef = doc(db, this.COLLECTION, documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Document non trouvé');
      }

      const documentData = docSnap.data() as Document;

      // Vérifier les permissions
      const user = auth.currentUser;
      if (!user) throw new Error('Utilisateur non authentifié');

      if (!(await this.canDelete(documentData, user.uid))) {
        throw new Error('Permission refusée');
      }

      // Supprimer le fichier de Storage
      if (documentData.storagePath) {
        try {
          const storageRef = ref(storage, documentData.storagePath);
          await deleteObject(storageRef);
        } catch (storageError) {
          
          // Continuer même si la suppression Storage échoue
        }
      }

      // Supprimer l'entrée Firestore
      await deleteDoc(docRef);

    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Supprimer plusieurs documents
   */
  async deleteMultipleDocuments(documentIds: string[]): Promise<{
    succeeded: string[];
    failed: string[];
  }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId);
        succeeded.push(documentId);
      } catch (error) {
        
        failed.push(documentId);
      }
    }

    return { succeeded, failed };
  }

  /**
   * Récupérer un document par ID
   */
  async getDocument(documentId: string): Promise<Document | null> {
    try {
      const docRef = doc(db, this.COLLECTION, documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate() || new Date(),
        lastModifiedAt: data.lastModifiedAt?.toDate() || new Date()
      } as Document;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Récupérer les documents d'un projet
   */
  async getProjectDocuments(projectId: string): Promise<Document[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data as any,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date()
        } as Document;
      });
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Récupérer les documents d'une tâche
   */
  async getTaskDocuments(taskId: string): Promise<Document[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('taskId', '==', taskId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data as any,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date()
        } as Document;
      });
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Mettre à jour les métadonnées d'un document
   */
  async updateDocumentMetadata(
    documentId: string,
    updates: Partial<{
      name: string;
      description: string;
      tags: string[];
      isPublic: boolean;
    }>
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, documentId);
      
      await updateDoc(docRef, {
        ...updates,
        lastModifiedAt: serverTimestamp()
      });
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Créer une nouvelle version d'un document
   */
  async createNewVersion(documentId: string, newFile: File): Promise<Document> {
    try {
      // Récupérer le document original
      const originalDoc = await this.getDocument(documentId);
      if (!originalDoc) {
        throw new Error('Document original non trouvé');
      }

      // Upload de la nouvelle version
      const newDocument = await this.uploadDocument(newFile, {
        projectId: originalDoc.projectId,
        taskId: originalDoc.taskId,
        description: originalDoc.description,
        tags: originalDoc.tags,
        isPublic: originalDoc.isPublic
      });

      // Mettre à jour la version
      await updateDoc(doc(db, this.COLLECTION, newDocument.id), {
        version: originalDoc.version + 1,
        previousVersionId: documentId
      });

      return newDocument;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Télécharger un document
   */
  async downloadDocument(documentId: string): Promise<void> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document non trouvé');
      }

      // Créer un lien de téléchargement
      const link = window.document.createElement('a');
      link.href = document.url;
      link.download = document.originalName || document.name;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Rechercher des documents
   */
  async searchDocuments(searchQuery: string, filters?: {
    projectId?: string;
    taskId?: string;
    uploadedBy?: string;
    tags?: string[];
    startDate?: Date;
    endDate?: Date;
  }): Promise<Document[]> {
    try {
      let q = query(collection(db, this.COLLECTION));

      // Appliquer les filtres
      if (filters?.projectId) {
        q = query(q, where('projectId', '==', filters.projectId));
      }
      if (filters?.taskId) {
        q = query(q, where('taskId', '==', filters.taskId));
      }
      if (filters?.uploadedBy) {
        q = query(q, where('uploadedBy', '==', filters.uploadedBy));
      }
      if (filters?.tags && filters.tags.length > 0) {
        q = query(q, where('tags', 'array-contains-any', filters.tags));
      }
      if (filters?.startDate) {
        q = query(q, where('uploadedAt', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters?.endDate) {
        q = query(q, where('uploadedAt', '<=', Timestamp.fromDate(filters.endDate)));
      }

      const querySnapshot = await getDocs(q);
      let documents = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data as any,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date()
        } as Document;
      });

      // Filtrer par recherche de texte (côté client)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        documents = documents.filter(doc => 
          doc.name.toLowerCase().includes(searchLower) ||
          doc.originalName.toLowerCase().includes(searchLower) ||
          (doc.description && doc.description.toLowerCase().includes(searchLower)) ||
          (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
      }

      return documents;
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Obtenir les statistiques des documents
   */
  async getDocumentStats(projectId?: string): Promise<{
    totalCount: number;
    totalSize: number;
    byType: Record<string, number>;
    recentUploads: Document[];
  }> {
    try {
      let q = query(collection(db, this.COLLECTION));
      if (projectId) {
        q = query(q, where('projectId', '==', projectId));
      }

      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data as any,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          lastModifiedAt: data.lastModifiedAt?.toDate() || new Date()
        } as Document;
      });

      const byType: Record<string, number> = {};
      let totalSize = 0;

      documents.forEach(doc => {
        totalSize += doc.size;
        const type = this.getFileCategory(doc.type);
        byType[type] = (byType[type] || 0) + 1;
      });

      const recentUploads = documents
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .slice(0, 10);

      return {
        totalCount: documents.length,
        totalSize,
        byType,
        recentUploads
      };
    } catch (error) {
      
      return {
        totalCount: 0,
        totalSize: 0,
        byType: {},
        recentUploads: []
      };
    }
  }

  // === Méthodes utilitaires privées ===

  private validateFile(file: File): void {
    // Vérifier la taille
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`Le fichier est trop volumineux. Taille max: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Vérifier le type - si le type est vide, on l'accepte (problème de détection)
    if (file.type && !this.ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Type de fichier non autorisé: ${file.type}`);
    }

    // Vérifier l'extension si le type MIME n'est pas détecté
    if (!file.type || file.type === '') {
      const nameParts = file.name.split('.');
      const extension = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() : null;
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'xml', 'zip', 'rar'];

      // Si pas d'extension, on accepte le fichier (pourrait être un fichier texte)
      if (extension && !allowedExtensions.includes(extension)) {
        throw new Error(`Extension de fichier non autorisée: ${extension}`);
      }
    }
  }

  private sanitizeFileName(fileName: string): string {
    // Supprimer les caractères spéciaux
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  private generateStoragePath(options: {
    projectId?: string;
    taskId?: string;
    fileName: string;
  }): string {
    const parts = [];
    
    if (options.projectId) {
      parts.push('projects', options.projectId);
    } else if (options.taskId) {
      parts.push('tasks', options.taskId);
    } else {
      parts.push('general');
    }
    
    parts.push('documents', options.fileName);
    
    return parts.join('/');
  }

  private getFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Documents';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Tableurs';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Présentations';
    if (mimeType.startsWith('text/')) return 'Texte';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archives';
    return 'Autres';
  }

  private async canDelete(document: Document, userId: string): Promise<boolean> {
    // Vérifier le rôle admin via le service utilisateur
    try {
      const user = await userService.getUser(userId);
      if (user?.role === 'admin') return true;
    } catch (error) {
      
    }
    
    // Vérifier si l'utilisateur est le propriétaire
    if (document.uploadedBy === userId) return true;
    
    // Vérifier les permissions explicites
    if (document.permissions?.canDelete?.includes(userId)) return true;
    
    return false;
  }
}

export const documentService = new DocumentService();