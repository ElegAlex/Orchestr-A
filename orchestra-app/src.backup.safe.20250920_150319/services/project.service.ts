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
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Project, ProjectStatus, Priority, ProjectCategory } from '../types';

const COLLECTION_NAME = 'projects';

// Fonction utilitaire pour transformer les données Firestore en Project
function transformFirestoreProject(doc: any): Project {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    ...data,
    startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : new Date()),
    deadline: data.deadline?.toDate ? data.deadline.toDate() : (data.deadline ? new Date(data.deadline) : new Date()),
    dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate || data.deadline ? new Date(data.dueDate || data.deadline) : new Date())),
    endDate: data.dueDate?.toDate ? data.dueDate.toDate() : undefined, // DEPRECATED fallback
    actualDueDate: data.actualDueDate?.toDate ? data.actualDueDate.toDate() : (data.actualEndDate?.toDate ? data.actualEndDate.toDate() : undefined),
    actualEndDate: data.actualEndDate?.toDate ? data.actualEndDate.toDate() : undefined, // DEPRECATED fallback
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    teamMembers: data.teamMembers || [],
    tags: data.tags || [],
  } as Project;
}

export class ProjectService {
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Timestamp.now();
    const project = {
      ...projectData,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), project);
    return { 
      id: docRef.id, 
      ...projectData,
      createdAt: project.createdAt.toDate(),
      updatedAt: project.updatedAt.toDate()
    };
  }

  async getProject(id: string): Promise<Project | null> {
    console.log('ProjectService.getProject: Début pour ID:', id);
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      console.log('ProjectService.getProject: DocRef créé, récupération...');
      const docSnap = await getDoc(docRef);
      console.log('ProjectService.getProject: DocSnap reçu, exists:', docSnap.exists());
      
      if (docSnap.exists()) {
        const project = transformFirestoreProject(docSnap);
        console.log('ProjectService.getProject: Projet transformé:', project);
        return project;
      }
      console.log('ProjectService.getProject: Document nexiste pas');
      return null;
    } catch (error) {
      
      throw error;
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(docRef, updatedData);
    
    // Récupérer le projet mis à jour
    const updatedProject = await this.getProject(id);
    if (!updatedProject) {
      throw new Error('Project not found after update');
    }
    
    return updatedProject;
  }

  async deleteProject(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  async getAllProjects(): Promise<Project[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => transformFirestoreProject(doc));
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('projectManager', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Tri côté client temporairement
    const projects = querySnapshot.docs.map(doc => transformFirestoreProject(doc));
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', status),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => transformFirestoreProject(doc));
  }

  // Méthode optimisée pour le calendrier - seulement projets actifs
  async getActiveProjects(): Promise<Project[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', 'in', ['active', 'planning']),
        limit(50) // Limiter pour la performance
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => transformFirestoreProject(doc));
    } catch (error) {
      
      // Fallback: récupérer tous les projets et filtrer
      const allProjects = await this.getAllProjects();
      return allProjects.filter(p => p.status === 'active' || p.status === 'planning');
    }
  }

  async getProjectsByCategory(category: ProjectCategory): Promise<Project[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('category', '==', category),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => transformFirestoreProject(doc));
  }

  async searchProjects(searchTerm: string, filters?: {
    status?: ProjectStatus;
    priority?: Priority;
    category?: ProjectCategory;
    manager?: string;
  }): Promise<Project[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }
    
    if (filters?.category) {
      constraints.push(where('category', '==', filters.category));
    }
    
    if (filters?.manager) {
      constraints.push(where('projectManager', '==', filters.manager));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    
    const projects = querySnapshot.docs.map(doc => transformFirestoreProject(doc));

    // Filtrage côté client pour la recherche textuelle
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      return projects.filter(project =>
        project.name.toLowerCase().includes(lowercaseSearch) ||
        project.description.toLowerCase().includes(lowercaseSearch) ||
        project.code.toLowerCase().includes(lowercaseSearch) ||
        project.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch))
      );
    }

    return projects;
  }

  async addTeamMember(projectId: string, member: {
    userId: string;
    role: string;
    allocationPercentage: number;
    startDate: Date;
    endDate?: Date;
  }): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updatedTeamMembers = [...project.teamMembers, member];
    await this.updateProject(projectId, { teamMembers: updatedTeamMembers });
  }

  async removeTeamMember(projectId: string, userId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updatedTeamMembers = project.teamMembers.filter(
      member => member.userId !== userId
    );
    await this.updateProject(projectId, { teamMembers: updatedTeamMembers });
  }

  async updateProjectProgress(projectId: string): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Récupérer toutes les tâches du projet
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      if (tasksSnapshot.empty) {
        // Aucune tâche = 0% de progression
        await this.updateProject(projectId, { progress: 0 });
        return;
      }

      let totalStoryPoints = 0;
      let completedStoryPoints = 0;
      let totalTasks = 0;
      let completedTasks = 0;

      tasksSnapshot.docs.forEach(doc => {
        const task = doc.data();
        totalTasks++;
        
        const storyPoints = task.storyPoints || 1;
        totalStoryPoints += storyPoints;
        
        if (task.status === 'DONE') {
          completedTasks++;
          completedStoryPoints += storyPoints;
        }
      });

      // Calculer le progrès basé sur les story points si disponibles, sinon sur le nombre de tâches
      let progress: number;
      if (totalStoryPoints > 0) {
        progress = Math.round((completedStoryPoints / totalStoryPoints) * 100);
      } else {
        progress = Math.round((completedTasks / totalTasks) * 100);
      }

      // Mettre à jour le progrès du projet
      await this.updateProject(projectId, { progress });
      
      console.log(`Project ${projectId} progress updated to ${progress}% (${completedTasks}/${totalTasks} tasks, ${completedStoryPoints}/${totalStoryPoints} story points)`);
      
    } catch (error) {
      
      throw error;
    }
  }

  async duplicateProject(projectId: string, newName: string): Promise<Project> {
    const originalProject = await this.getProject(projectId);
    if (!originalProject) {
      throw new Error('Project not found');
    }

    const duplicatedProject = {
      ...originalProject,
      name: newName,
      code: `${originalProject.code}-COPY`,
      status: 'draft' as ProjectStatus,
      progress: 0,
      actualDueDate: undefined,
      actualEndDate: undefined, // DEPRECATED fallback
      spentBudget: 0,
    };

    // Supprimer les champs qui ne doivent pas être copiés
    delete (duplicatedProject as any).id;
    delete (duplicatedProject as any).createdAt;
    delete (duplicatedProject as any).updatedAt;

    return await this.createProject(duplicatedProject);
  }

  async archiveProject(projectId: string): Promise<void> {
    await this.updateProject(projectId, {
      status: 'completed',
      actualDueDate: new Date()
    });
  }

  /**
   * Force le recalcul du progrès de tous les projets
   * Utile pour la maintenance ou la correction des données
   */
  async recalculateAllProjectsProgress(): Promise<void> {
    try {
      const projects = await this.getAllProjects();
      console.log(`Recalculating progress for ${projects.length} projects...`);
      
      for (const project of projects) {
        try {
          await this.updateProjectProgress(project.id);
        } catch (error) {
          
        }
      }
      
      console.log('Project progress recalculation completed');
    } catch (error) {
      
      throw error;
    }
  }
}

export const projectService = new ProjectService();