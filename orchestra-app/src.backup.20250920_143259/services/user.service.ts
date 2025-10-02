import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, UserRole, Skill } from '../types';

const COLLECTION_NAME = 'users';

export class UserService {
  async createUser(user: User): Promise<User> {
    const docRef = doc(db, COLLECTION_NAME, user.id);
    const userData = {
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await setDoc(docRef, userData);
    return userData;
  }

  async deleteUser(userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, userId);
    await deleteDoc(docRef);
  }

  async softDeleteUser(userId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(docRef, {
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getUserDependencies(userId: string): Promise<{
    projects: number;
    tasks: number;
    leaves: number;
    contracts: number;
  }> {
    try {
      // Compter les projets où l'utilisateur est membre
      const projectsQuery = query(
        collection(db, 'projects'),
        where('teamMembers', 'array-contains', userId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      // Compter les tâches assignées
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assigneeId', '==', userId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      // Compter les demandes de congés
      const leavesQuery = query(
        collection(db, 'leave_requests'),
        where('userId', '==', userId)
      );
      const leavesSnapshot = await getDocs(leavesQuery);

      // Compter les contrats
      const contractsQuery = query(
        collection(db, 'work_contracts'),
        where('userId', '==', userId)
      );
      const contractsSnapshot = await getDocs(contractsQuery);

      return {
        projects: projectsSnapshot.size,
        tasks: tasksSnapshot.size,
        leaves: leavesSnapshot.size,
        contracts: contractsSnapshot.size
      };
    } catch (error) {
      console.error('Error getting user dependencies:', error);
      return {
        projects: 0,
        tasks: 0,
        leaves: 0,
        contracts: 0
      };
    }
  }

  async getUser(id: string): Promise<User | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as User;
    }
    return null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };
    
    await updateDoc(docRef, updatedData);
    
    const updatedUser = await this.getUser(id);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const users = querySnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          id: doc.id,
          ...userData,
          createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
          lastLoginAt: userData.lastLoginAt?.toDate?.() || userData.lastLoginAt,
          updatedAt: userData.updatedAt?.toDate?.() || userData.updatedAt
        } as User;
      });
      
      // Trier côté client avec protection contre displayName undefined
      return users.sort((a, b) => {
        const nameA = a.displayName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Sans nom';
        const nameB = b.displayName || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Sans nom';
        return nameA.localeCompare(nameB);
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Méthode optimisée pour le calendrier - utilisateurs actifs avec limite
  async getActiveUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        limit(100) // Limiter pour la performance
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          id: doc.id,
          ...userData,
          createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
          lastLoginAt: userData.lastLoginAt?.toDate?.() || userData.lastLoginAt,
          updatedAt: userData.updatedAt?.toDate?.() || userData.updatedAt
        } as User;
      });
    } catch (error) {
      console.error('Error fetching active users:', error);
      // Fallback vers getAllUsers
      return this.getAllUsers();
    }
  }

  /**
   * NOUVELLE FONCTION : Récupère tous les utilisateurs SAUF l'admin technique
   * Utilisée pour les vues ressources/RH pour exclure l'admin technique
   */
  async getAllUsersForResources(): Promise<User[]> {
    try {
      const allUsers = await this.getAllUsers();
      
      // EXCLURE l'admin technique (elegalex1980@gmail.com et rôle admin)
      return allUsers.filter(user => 
        user.email !== 'elegalex1980@gmail.com' && 
        user.role !== 'admin'
      );
    } catch (error) {
      console.error('Error fetching users for resources:', error);
      throw error;
    }
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('role', '==', role),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
    
    return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async getUsersByDepartment(department: string): Promise<User[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('department', '==', department),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
    
    return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async searchUsers(searchTerm: string, filters?: {
    role?: UserRole;
    department?: string;
    skills?: string[];
  }): Promise<User[]> {
    let constraints: QueryConstraint[] = [
      where('isActive', '==', true)
    ];

    if (filters?.role) {
      constraints.unshift(where('role', '==', filters.role));
    }
    
    if (filters?.department) {
      constraints.unshift(where('department', '==', filters.department));
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const querySnapshot = await getDocs(q);
    
    let users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));

    // Filtrage côté client pour la recherche textuelle
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      users = users.filter(user =>
        user.displayName.toLowerCase().includes(lowercaseSearch) ||
        user.email.toLowerCase().includes(lowercaseSearch) ||
        user.firstName.toLowerCase().includes(lowercaseSearch) ||
        user.lastName.toLowerCase().includes(lowercaseSearch)
      );
    }

    // Filtrage par compétences
    if (filters?.skills && filters.skills.length > 0) {
      users = users.filter(user =>
        user.skills && filters.skills!.some(skillName =>
          user.skills!.some(userSkill => userSkill.name === skillName)
        )
      );
    }

    return users;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    return await this.updateUser(userId, { role });
  }

  async updateUserAvailability(userId: string, availability: number): Promise<User> {
    return await this.updateUser(userId, { availability });
  }

  async addSkill(userId: string, skill: Skill): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingSkills = user.skills || [];
    const existingSkillIndex = existingSkills.findIndex(s => s.name === skill.name);

    let updatedSkills: Skill[];
    if (existingSkillIndex >= 0) {
      // Mettre à jour la compétence existante
      updatedSkills = [...existingSkills];
      updatedSkills[existingSkillIndex] = skill;
    } else {
      // Ajouter une nouvelle compétence
      updatedSkills = [...existingSkills, skill];
    }

    return await this.updateUser(userId, { skills: updatedSkills });
  }

  async removeSkill(userId: string, skillName: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedSkills = (user.skills || []).filter(skill => skill.name !== skillName);
    return await this.updateUser(userId, { skills: updatedSkills });
  }

  async updateUserProfile(userId: string, profileData: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    department?: string;
    avatarUrl?: string;
  }): Promise<User> {
    return await this.updateUser(userId, profileData);
  }

  async deactivateUser(userId: string): Promise<User> {
    return await this.updateUser(userId, { isActive: false });
  }

  async reactivateUser(userId: string): Promise<User> {
    return await this.updateUser(userId, { isActive: true });
  }

  async getUsersWithSkill(skillName: string, minLevel?: 1 | 2 | 3): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    
    return allUsers.filter(user => {
      if (!user.skills) return false;
      
      const userSkill = user.skills.find(skill => skill.name === skillName);
      if (!userSkill) return false;

      if (!minLevel) return true;

      // Support pour les nouveaux niveaux numériques
      if (typeof userSkill.level === 'number') {
        return userSkill.level >= minLevel;
      }

      // Support legacy pour les anciens niveaux
      const levels = ['beginner', 'intermediate', 'expert', 'reference'];
      const levelToNumber = { 'beginner': 1, 'intermediate': 2, 'expert': 3, 'reference': 3 };
      const userLevel = levelToNumber[userSkill.level as keyof typeof levelToNumber] || 1;

      return userLevel >= minLevel;
    });
  }

  async getUserStats(userId: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    completedTasks: number;
    averageTaskTime: number;
  }> {
    // Cette méthode nécessiterait des requêtes vers les collections projects et tasks
    // Pour l'instant, on retourne des valeurs par défaut
    return {
      totalProjects: 0,
      activeProjects: 0,
      completedTasks: 0,
      averageTaskTime: 0
    };
  }

  async getAvailableUsers(startDate: Date, endDate: Date, minAvailability = 0): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    
    // Pour l'instant, filtrer simplement par availability
    // Dans une implémentation complète, on vérifierait les congés et allocations
    return allUsers.filter(user => 
      (user.availability || 100) >= minAvailability
    );
  }
}

export const userService = new UserService();