import {
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Task, Project, User } from '../types';

export interface ProjectWithMilestones {
  project: Project;
  milestones: MilestoneWithTasks[];
}

export interface MilestoneWithTasks {
  milestoneId?: string;
  milestoneName: string;
  tasks: Task[];
}

class TeamSupervisionService {
  /**
   * Récupère les membres de l'équipe selon le rôle
   * - Admin : tous les utilisateurs
   * - Responsable : tous les utilisateurs du département
   * - Manager : utilisateurs avec managerId = userId OU même département si pas de managerId défini
   */
  async getTeamMembers(userId: string, userRole: string, userDepartment?: string): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      let teamMembers: User[] = [];

      if (userRole === 'admin') {
        // Admin voit tous les utilisateurs
        const snapshot = await getDocs(query(usersRef));
        teamMembers = snapshot.docs.map(doc => this.mapUserData(doc));
      } else if (userRole === 'responsable') {
        // Responsable voit tout son département
        if (!userDepartment) throw new Error('Le responsable doit avoir un département assigné');
        const snapshot = await getDocs(query(usersRef, where('department', '==', userDepartment)));
        teamMembers = snapshot.docs.map(doc => this.mapUserData(doc));
      } else if (userRole === 'manager') {
        // Manager voit :
        // 1. Les utilisateurs dont il est le manager (managerId === userId)
        // 2. Fallback : utilisateurs du même département si pas de managerId défini

        // Requête 1 : Utilisateurs avec ce manager
        const directReportsSnapshot = await getDocs(
          query(usersRef, where('managerId', '==', userId))
        );
        const directReports = directReportsSnapshot.docs.map(doc => this.mapUserData(doc));

        // Requête 2 : Utilisateurs du département sans manager assigné (fallback)
        if (userDepartment) {
          const deptSnapshot = await getDocs(
            query(usersRef, where('department', '==', userDepartment))
          );
          const deptMembers = deptSnapshot.docs
            .map(doc => this.mapUserData(doc))
            .filter(u =>
              u.id !== userId && // Exclure le manager lui-même
              (!u.managerId || u.managerId === '') // Sans manager assigné
            );

          // Combiner et dédupliquer
          const allMembers = [...directReports, ...deptMembers];
          const uniqueIds = new Set<string>();
          teamMembers = allMembers.filter(u => {
            if (uniqueIds.has(u.id)) return false;
            uniqueIds.add(u.id);
            return true;
          });
        } else {
          teamMembers = directReports;
        }
      } else {
        return [];
      }

      // Trier par nom pour faciliter la sélection
      return teamMembers.sort((a, b) =>
        (a.displayName || a.email).localeCompare(b.displayName || b.email)
      );
    } catch (error) {
      console.error('Erreur récupération membres équipe:', error);
      throw error;
    }
  }

  /**
   * Helper pour mapper les données utilisateur
   */
  private mapUserData(doc: any): User {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      lastLoginAt: data.lastLoginAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as User;
  }

  /**
   * Récupère les tâches d'un agent spécifique organisées par projet/jalon
   * - Uniquement tâches où l'agent est RESPONSIBLE
   * - Uniquement tâches NON terminées (pas DONE)
   * - Uniquement tâches de projets ACTIFS
   * - Pas de tâches BACKLOG
   * - Classement par date d'échéance projet (ordre chronologique)
   */
  async getAgentTasksByProject(agentId: string): Promise<ProjectWithMilestones[]> {
    try {
      // 1. Récupérer toutes les tâches où l'agent est responsible
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(
        tasksRef,
        where('responsible', 'array-contains', agentId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      const tasks: Task[] = tasksSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate?.toDate?.() || (data.startDate ? new Date(data.startDate) : undefined),
            dueDate: data.dueDate?.toDate?.() || (data.dueDate ? new Date(data.dueDate) : new Date()),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Task;
        })
        // Filtrer : pas DONE, pas BACKLOG
        .filter(t => t.status !== 'DONE' && t.status !== 'BACKLOG');

      // 2. Récupérer les projets actifs associés (optimisé - batch query)
      const projectIds = [...new Set(tasks.map(t => t.projectId))];
      const projectsMap = new Map<string, Project>();

      // Firestore limite 'in' à 10 éléments, on batch si nécessaire
      const BATCH_SIZE = 10;
      for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
        const batch = projectIds.slice(i, i + BATCH_SIZE);
        const projectsRef = collection(db, 'projects');
        const projectQuery = query(projectsRef, where('__name__', 'in', batch));
        const projectSnapshot = await getDocs(projectQuery);

        projectSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const project = {
            id: doc.id,
            ...data,
            startDate: data.startDate?.toDate?.() || new Date(),
            dueDate: data.dueDate?.toDate?.() || new Date(),
            actualDueDate: data.actualDueDate?.toDate?.(),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Project;

          // Filtrer uniquement projets actifs
          if (project.status === 'active') {
            projectsMap.set(doc.id, project);
          }
        });
      }

      // 3. Récupérer les jalons réels depuis Firestore pour avoir les vrais noms
      const milestoneIds = [...new Set(tasks.map(t => t.milestoneId).filter(Boolean))];
      const milestonesDataMap = new Map<string, { name: string; code: string }>();

      for (let i = 0; i < milestoneIds.length; i += BATCH_SIZE) {
        const batch = milestoneIds.slice(i, i + BATCH_SIZE) as string[];
        if (batch.length > 0) {
          const milestonesRef = collection(db, 'milestones');
          const milestonesQuery = query(milestonesRef, where('__name__', 'in', batch));
          const milestonesSnapshot = await getDocs(milestonesQuery);

          milestonesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            milestonesDataMap.set(doc.id, {
              name: data.name || data.code || doc.id,
              code: data.code || ''
            });
          });
        }
      }

      // 4. Organiser par projet puis par jalon
      const projectsWithMilestones: ProjectWithMilestones[] = [];

      for (const [projectId, project] of projectsMap.entries()) {
        const projectTasks = tasks.filter(t => t.projectId === projectId);

        // Grouper par jalon
        const milestonesMap = new Map<string, Task[]>();

        projectTasks.forEach(task => {
          const milestoneKey = task.milestoneId || 'no-milestone';
          if (!milestonesMap.has(milestoneKey)) {
            milestonesMap.set(milestoneKey, []);
          }
          milestonesMap.get(milestoneKey)!.push(task);
        });

        // Créer les groupes de jalons avec les vrais noms
        const milestones: MilestoneWithTasks[] = Array.from(milestonesMap.entries()).map(([key, tasks]) => {
          if (key === 'no-milestone') {
            return {
              milestoneId: undefined,
              milestoneName: 'Sans jalon',
              tasks
            };
          }

          const milestoneData = milestonesDataMap.get(key);
          return {
            milestoneId: key,
            milestoneName: milestoneData?.name || key,
            tasks
          };
        });

        projectsWithMilestones.push({
          project,
          milestones
        });
      }

      // 5. Trier par date d'échéance projet (ordre chronologique)
      projectsWithMilestones.sort((a, b) =>
        a.project.dueDate.getTime() - b.project.dueDate.getTime()
      );

      return projectsWithMilestones;
    } catch (error) {
      console.error('Erreur récupération tâches agent:', error);
      throw error;
    }
  }

}

export const teamSupervisionService = new TeamSupervisionService();
