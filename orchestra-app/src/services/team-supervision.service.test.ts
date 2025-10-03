import { teamSupervisionService } from './team-supervision.service';
import { getDocs, query, where, collection } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore');
jest.mock('../config/firebase', () => ({
  db: {},
}));

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;

describe('TeamSupervisionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamMembers', () => {
    it('should return all users for admin role', async () => {
      const mockUsers = [
        { id: 'user1', data: () => ({ displayName: 'User 1', email: 'user1@test.com' }) },
        { id: 'user2', data: () => ({ displayName: 'User 2', email: 'user2@test.com' }) },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockUsers,
      } as any);

      const result = await teamSupervisionService.getTeamMembers('admin-id', 'admin');

      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('User 1');
    });

    it('should return department users for responsable role', async () => {
      const mockUsers = [
        { id: 'user1', data: () => ({ displayName: 'User 1', department: 'IT' }) },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockUsers,
      } as any);

      const result = await teamSupervisionService.getTeamMembers('resp-id', 'responsable', 'IT');

      expect(result).toHaveLength(1);
      expect(mockWhere).toHaveBeenCalledWith('department', '==', 'IT');
    });

    it('should return direct reports for manager role', async () => {
      const mockDirectReports = [
        { id: 'user1', data: () => ({ displayName: 'User 1', managerId: 'manager-id' }) },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockDirectReports } as any) // Direct reports
        .mockResolvedValueOnce({ docs: [] } as any); // Dept members

      const result = await teamSupervisionService.getTeamMembers('manager-id', 'manager', 'IT');

      expect(result).toHaveLength(1);
      expect(mockWhere).toHaveBeenCalledWith('managerId', '==', 'manager-id');
    });

    it('should throw error if responsable has no department', async () => {
      await expect(
        teamSupervisionService.getTeamMembers('resp-id', 'responsable')
      ).rejects.toThrow('Le responsable doit avoir un département assigné');
    });

    it('should return empty array for invalid role', async () => {
      const result = await teamSupervisionService.getTeamMembers('user-id', 'invalid-role');
      expect(result).toEqual([]);
    });

    it('should sort team members by display name', async () => {
      const mockUsers = [
        { id: 'user2', data: () => ({ displayName: 'Zoe', email: 'zoe@test.com' }) },
        { id: 'user1', data: () => ({ displayName: 'Alice', email: 'alice@test.com' }) },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockUsers,
      } as any);

      const result = await teamSupervisionService.getTeamMembers('admin-id', 'admin');

      expect(result[0].displayName).toBe('Alice');
      expect(result[1].displayName).toBe('Zoe');
    });
  });

  describe('getAgentTasksByProject', () => {
    it('should filter tasks by responsible agent', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            name: 'Project 1',
            status: 'active',
            dueDate: { toDate: () => new Date('2025-12-31') },
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any) // Tasks
        .mockResolvedValueOnce({ docs: mockProjects } as any) // Projects
        .mockResolvedValueOnce({ docs: [] } as any); // Milestones

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result).toHaveLength(1);
      expect(result[0].project.name).toBe('Project 1');
      expect(mockWhere).toHaveBeenCalledWith('responsible', 'array-contains', 'agent-id');
    });

    it('should exclude DONE tasks', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'DONE',
            projectId: 'project1',
          }),
        },
        {
          id: 'task2',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            status: 'active',
            dueDate: { toDate: () => new Date() },
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any)
        .mockResolvedValueOnce({ docs: mockProjects } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      // Should only have 1 milestone with the TODO task
      expect(result[0].milestones[0].tasks).toHaveLength(1);
      expect(result[0].milestones[0].tasks[0].id).toBe('task2');
    });

    it('should exclude BACKLOG tasks', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'BACKLOG',
            projectId: 'project1',
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: mockTasks } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result).toHaveLength(0);
    });

    it('should only include active projects', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
          }),
        },
        {
          id: 'task2',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project2',
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            status: 'active',
            dueDate: { toDate: () => new Date() },
          }),
        },
        {
          id: 'project2',
          data: () => ({
            status: 'completed',
            dueDate: { toDate: () => new Date() },
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any)
        .mockResolvedValueOnce({ docs: mockProjects } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result).toHaveLength(1);
      expect(result[0].project.id).toBe('project1');
    });

    it('should group tasks by milestone', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
            milestoneId: 'milestone1',
          }),
        },
        {
          id: 'task2',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
            milestoneId: 'milestone1',
          }),
        },
        {
          id: 'task3',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
            milestoneId: null,
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            status: 'active',
            dueDate: { toDate: () => new Date() },
          }),
        },
      ];

      const mockMilestones = [
        {
          id: 'milestone1',
          data: () => ({
            name: 'Milestone 1',
            code: 'M1',
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any)
        .mockResolvedValueOnce({ docs: mockProjects } as any)
        .mockResolvedValueOnce({ docs: mockMilestones } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result[0].milestones).toHaveLength(2); // milestone1 + no-milestone
      expect(result[0].milestones.find(m => m.milestoneId === 'milestone1')?.tasks).toHaveLength(2);
      expect(result[0].milestones.find(m => !m.milestoneId)?.tasks).toHaveLength(1);
    });

    it('should use real milestone names from Firestore', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
            milestoneId: 'milestone1',
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            status: 'active',
            dueDate: { toDate: () => new Date() },
          }),
        },
      ];

      const mockMilestones = [
        {
          id: 'milestone1',
          data: () => ({
            name: 'Livraison Finale',
            code: 'M3',
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any)
        .mockResolvedValueOnce({ docs: mockProjects } as any)
        .mockResolvedValueOnce({ docs: mockMilestones } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result[0].milestones[0].milestoneName).toBe('Livraison Finale');
    });

    it('should sort projects by due date', async () => {
      const mockTasks = [
        {
          id: 'task1',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project1',
          }),
        },
        {
          id: 'task2',
          data: () => ({
            responsible: ['agent-id'],
            status: 'TODO',
            projectId: 'project2',
          }),
        },
      ];

      const mockProjects = [
        {
          id: 'project1',
          data: () => ({
            name: 'Late Project',
            status: 'active',
            dueDate: { toDate: () => new Date('2026-12-31') },
          }),
        },
        {
          id: 'project2',
          data: () => ({
            name: 'Early Project',
            status: 'active',
            dueDate: { toDate: () => new Date('2025-06-30') },
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ docs: mockTasks } as any)
        .mockResolvedValueOnce({ docs: mockProjects } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const result = await teamSupervisionService.getAgentTasksByProject('agent-id');

      expect(result[0].project.name).toBe('Early Project');
      expect(result[1].project.name).toBe('Late Project');
    });

    it('should handle errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(
        teamSupervisionService.getAgentTasksByProject('agent-id')
      ).rejects.toThrow('Firestore error');
    });
  });
});
