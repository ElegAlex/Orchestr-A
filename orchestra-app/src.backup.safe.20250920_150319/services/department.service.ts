import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Department, CreateDepartmentRequest, User } from '../types';

export class DepartmentService {
  private readonly collectionName = 'departments';

  /**
   * Crée un nouveau département
   */
  async createDepartment(departmentData: CreateDepartmentRequest): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...departmentData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      
      throw new Error('Erreur lors de la création du département');
    }
  }

  /**
   * Met à jour un département
   */
  async updateDepartment(departmentData: Partial<Department> & { id: string }): Promise<void> {
    try {
      const { id, ...updateData } = departmentData;
      await updateDoc(doc(db, this.collectionName, id), {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      
      throw new Error('Erreur lors de la mise à jour du département');
    }
  }

  /**
   * Supprime un département (soft delete)
   */
  async deleteDepartment(departmentId: string): Promise<void> {
    try {
      // Vérifier s'il y a des utilisateurs assignés à ce département
      const usersInDepartment = await this.getUsersInDepartment(departmentId);
      if (usersInDepartment.length > 0) {
        throw new Error(
          `Impossible de supprimer le département : ${usersInDepartment.length} utilisateur(s) y sont encore assignés`
        );
      }

      await updateDoc(doc(db, this.collectionName, departmentId), {
        isActive: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Supprime définitivement un département
   */
  async permanentDeleteDepartment(departmentId: string): Promise<void> {
    try {
      // Vérifier s'il y a des utilisateurs assignés à ce département
      const usersInDepartment = await this.getUsersInDepartment(departmentId);
      if (usersInDepartment.length > 0) {
        throw new Error(
          `Impossible de supprimer définitivement le département : ${usersInDepartment.length} utilisateur(s) y sont encore assignés`
        );
      }

      await deleteDoc(doc(db, this.collectionName, departmentId));
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Récupère tous les départements actifs
   */
  async getAllDepartments(): Promise<Department[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const departments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Department[];

      // Tri par nom en JavaScript
      return departments.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      
      throw new Error('Erreur lors de la récupération des départements');
    }
  }

  /**
   * Récupère un département par son ID
   */
  async getDepartmentById(departmentId: string): Promise<Department | null> {
    try {
      const docRef = doc(db, this.collectionName, departmentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as Department;
      }
      
      return null;
    } catch (error) {
      
      throw new Error('Erreur lors de la récupération du département');
    }
  }

  /**
   * Récupère les utilisateurs d'un département
   */
  async getUsersInDepartment(departmentId: string): Promise<User[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('department', '==', departmentId),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      })) as User[];
      
      // EXCLURE l'admin technique des ressources RH
      return users.filter(user => 
        user.email !== 'elegalex1980@gmail.com' && 
        user.role !== 'admin'
      );
    } catch (error) {
      
      throw new Error('Erreur lors de la récupération des utilisateurs du département');
    }
  }

  /**
   * Assigne un utilisateur à un département
   */
  async assignUserToDepartment(userId: string, departmentId: string | null): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        department: departmentId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      
      throw new Error('Erreur lors de l\'assignation de l\'utilisateur au département');
    }
  }

  /**
   * Récupère les statistiques des départements
   */
  async getDepartmentStats(): Promise<{
    totalDepartments: number;
    activeDepartments: number;
    totalUsersAssigned: number;
    unassignedUsers: number;
    departmentBreakdown: Array<{
      departmentId: string;
      departmentName: string;
      userCount: number;
      users: User[];
    }>;
  }> {
    try {
      // Récupérer tous les départements actifs
      const departments = await this.getAllDepartments();
      
      // Récupérer tous les utilisateurs actifs
      const usersQuery = query(
        collection(db, 'users'),
        where('isActive', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      })) as User[];

      // EXCLURE l'admin technique des ressources RH
      const filteredUsers = allUsers.filter(user => 
        user.email !== 'elegalex1980@gmail.com' && 
        user.role !== 'admin'
      );

      // Compter les utilisateurs assignés et non assignés (sans l'admin technique)
      const usersWithDepartment = filteredUsers.filter(user => user.department);
      const unassignedUsers = filteredUsers.filter(user => !user.department);

      // Créer le breakdown par département (avec utilisateurs filtrés)
      const departmentBreakdown = departments.map(dept => {
        const deptUsers = filteredUsers.filter(user => user.department === dept.id);
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          userCount: deptUsers.length,
          users: deptUsers
        };
      });

      return {
        totalDepartments: departments.length,
        activeDepartments: departments.filter(d => d.isActive).length,
        totalUsersAssigned: usersWithDepartment.length,
        unassignedUsers: unassignedUsers.length,
        departmentBreakdown
      };
    } catch (error) {
      
      throw new Error('Erreur lors de la récupération des statistiques des départements');
    }
  }

  /**
   * Transfère tous les utilisateurs d'un département vers un autre
   */
  async transferUsersBetweenDepartments(
    fromDepartmentId: string, 
    toDepartmentId: string | null
  ): Promise<void> {
    try {
      const usersToTransfer = await this.getUsersInDepartment(fromDepartmentId);
      
      if (usersToTransfer.length === 0) {
        return;
      }

      const batch = writeBatch(db);
      
      usersToTransfer.forEach(user => {
        const userRef = doc(db, 'users', user.id);
        batch.update(userRef, {
          department: toDepartmentId,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error) {
      
      throw new Error('Erreur lors du transfert des utilisateurs entre départements');
    }
  }

  /**
   * Récupère les utilisateurs non assignés à un département
   */
  async getUnassignedUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('isActive', '==', true),
        where('department', '==', null)
      );
      const querySnapshot = await getDocs(q);
      
      const usersWithoutDept = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      })) as User[];

      // Également récupérer les utilisateurs avec department undefined ou vide
      const qUndefined = query(
        collection(db, 'users'),
        where('isActive', '==', true)
      );
      const undefinedSnapshot = await getDocs(qUndefined);
      
      const allUsers = undefinedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      })) as User[];

      const unassignedUsers = allUsers.filter(user => !user.department);
      
      // EXCLURE l'admin technique des ressources RH
      const filteredUsers = unassignedUsers.filter(user => 
        user.email !== 'elegalex1980@gmail.com' && 
        user.role !== 'admin'
      );
      
      return filteredUsers;
    } catch (error) {
      
      throw new Error('Erreur lors de la récupération des utilisateurs non assignés');
    }
  }
}

export const departmentService = new DepartmentService();