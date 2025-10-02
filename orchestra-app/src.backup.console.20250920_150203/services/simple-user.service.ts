import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Skill } from '../types';

export interface SimpleUser {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  isActive: boolean;
  skills: Skill[];
  workload?: number;
}

class SimpleUserService {
  async getAllUsers(): Promise<SimpleUser[]> {
    try {
      // Requête simplifiée sans orderBy pour éviter le besoin d'index
      const q = query(
        collection(db, 'users'),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Trier manuellement les résultats par displayName après la requête
      const users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Calculer la charge de travail réelle (0% par défaut sans tâches)
        const workload = 0;
        
        return {
          id: doc.id,
          displayName: data.displayName || `${data.firstName} ${data.lastName}`,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          role: data.role || 'contributor',
          department: data.department || 'Non spécifié',
          isActive: data.isActive !== false,
          skills: (data.skills || []).map((skill: any) => {
            // Si c'est déjà un objet Skill, le conserver tel quel
            if (skill && typeof skill === 'object' && skill.id) {
              return skill as Skill;
            }
            // Si c'est une string, créer un objet Skill minimal
            if (typeof skill === 'string') {
              return {
                id: `legacy_${Date.now()}_${Math.random()}`,
                name: skill,
                level: 1 as 1,
                category: 'technical' as const,
                lastUsed: new Date()
              } as Skill;
            }
            return skill;
          }),
          workload
        } as SimpleUser;
      });
      
      // Tri côté client pour éviter le besoin d'index composite
      return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      
      return [];
    }
  }

  getRoleLabel(role: string): string {
    const roleLabels: Record<string, string> = {
      'admin': 'Administrateur',
      'responsable': 'Responsable',
      'manager': 'Chef de projet',
      'teamLead': 'Référent technique',
      'developer': 'Développeur',
      'designer': 'Designer',
      'contributor': 'Contributeur',
      'viewer': 'Observateur',
    };
    return roleLabels[role] || role;
  }

  getRoleColor(role: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" {
    const roleColors: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
      'admin': 'error',
      'manager': 'warning',
      'developer': 'primary',
      'designer': 'secondary',
      'contributor': 'info',
      'viewer': 'default',
    };
    return roleColors[role] || 'default';
  }

  getWorkloadColor(workload: number): "success" | "warning" | "error" {
    if (workload <= 70) return 'success';
    if (workload <= 90) return 'warning';
    return 'error';
  }

  getAvailabilityStatus(workload: number): string {
    if (workload <= 50) return 'Très disponible';
    if (workload <= 70) return 'Disponible';
    if (workload <= 90) return 'Occupé';
    return 'Surchargé';
  }

  async updateUser(userId: string, updates: Partial<SimpleUser>): Promise<void> {
    try {
      const updateData = { ...updates };
      
      // Convertir les objets Skill en format compatible Firebase si nécessaire
      if (updates.skills) {
        updateData.skills = updates.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          level: skill.level,
          category: skill.category,
          lastUsed: skill.lastUsed
        }));
      }
      
      await updateDoc(doc(db, 'users', userId), updateData);
    } catch (error) {
      
      throw error;
    }
  }
}

export const simpleUserService = new SimpleUserService();