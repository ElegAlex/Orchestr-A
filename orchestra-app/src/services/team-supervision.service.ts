import {
  collection,
  query,
  where,
  getDocs,
  or
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
   */
  async getTeamMembers(userId: string, userRole: string, userDepartment?: string): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      let teamQuery;

      if (userRole === 'admin') {
        teamQuery = query(usersRef);
      } else if (userRole === 'responsable') {
        if (!userDepartment) throw new Error('Le responsable doit avoir un département assigné');
        teamQuery = query(usersRef, where('department', '==', userDepartment));
      } else if (userRole === 'manager') {
        // TODO: Utiliser la vraie relation manager-équipe quand elle sera définie
        if (!userDepartment) throw new Error('Le manager doit avoir un département assigné');
        teamQuery = query(usersRef, where('department', '==', userDepartment));
      } else {
        return [];
      }

      const snapshot = await getDocs(teamQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastLoginAt: data.lastLoginAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as User;
      });
    } catch (error) {
      console.error('Erreur récupération membres équipe:', error);
      throw error;
    }
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

      // 2. Récupérer les projets actifs associés
      const projectIds = [...new Set(tasks.map(t => t.projectId))];
      const projectsMap = new Map<string, Project>();

      for (const projectId of projectIds) {
        const projectsRef = collection(db, 'projects');
        const projectQuery = query(projectsRef, where('__name__', '==', projectId));
        const projectSnapshot = await getDocs(projectQuery);

        if (!projectSnapshot.empty) {
          const doc = projectSnapshot.docs[0];
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
            projectsMap.set(projectId, project);
          }
        }
      }

      // 3. Organiser par projet puis par jalon
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

        // Créer les groupes de jalons
        const milestones: MilestoneWithTasks[] = Array.from(milestonesMap.entries()).map(([key, tasks]) => ({
          milestoneId: key === 'no-milestone' ? undefined : key,
          milestoneName: key === 'no-milestone' ? 'Sans jalon' : key,
          tasks
        }));

        projectsWithMilestones.push({
          project,
          milestones
        });
      }

      // 4. Trier par date d'échéance projet (ordre chronologique)
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
