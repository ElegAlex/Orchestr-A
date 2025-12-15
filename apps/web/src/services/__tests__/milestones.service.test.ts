import { milestonesService } from '../milestones.service';
import { api } from '@/lib/api';
import { MilestoneStatus } from '@/types';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('milestonesService', () => {
  const mockMilestone = {
    id: 'milestone-1',
    name: 'Phase 1 Complete',
    description: 'First phase delivery',
    projectId: 'project-1',
    dueDate: '2025-06-30',
    status: MilestoneStatus.PENDING,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockMilestones = [mockMilestone, { ...mockMilestone, id: 'milestone-2', name: 'Phase 2' }];

  const mockPaginatedResponse = {
    data: mockMilestones,
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all milestones', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      const result = await milestonesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/milestones');
      expect(result).toEqual(mockPaginatedResponse);
    });
  });

  describe('getById', () => {
    it('should fetch milestone by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockMilestone });

      const result = await milestonesService.getById('milestone-1');

      expect(api.get).toHaveBeenCalledWith('/milestones/milestone-1');
      expect(result).toEqual(mockMilestone);
    });
  });

  describe('getByProject', () => {
    it('should fetch milestones by project', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockMilestones });

      const result = await milestonesService.getByProject('project-1');

      expect(api.get).toHaveBeenCalledWith('/milestones/project/project-1');
      expect(result).toEqual(mockMilestones);
    });
  });

  describe('create', () => {
    it('should create a new milestone', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockMilestone });

      const createData = {
        name: 'Phase 1 Complete',
        description: 'First phase delivery',
        dueDate: '2025-06-30',
        projectId: 'project-1',
      };

      const result = await milestonesService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/milestones', createData);
      expect(result).toEqual(mockMilestone);
    });
  });

  describe('update', () => {
    it('should update a milestone', async () => {
      const updatedMilestone = { ...mockMilestone, name: 'Updated Milestone' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedMilestone });

      const result = await milestonesService.update('milestone-1', { name: 'Updated Milestone' });

      expect(api.patch).toHaveBeenCalledWith('/milestones/milestone-1', { name: 'Updated Milestone' });
      expect(result).toEqual(updatedMilestone);
    });

    it('should update milestone status', async () => {
      const updatedMilestone = { ...mockMilestone, status: MilestoneStatus.COMPLETED };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedMilestone });

      const result = await milestonesService.update('milestone-1', { status: 'COMPLETED' });

      expect(api.patch).toHaveBeenCalledWith('/milestones/milestone-1', { status: 'COMPLETED' });
      expect(result).toEqual(updatedMilestone);
    });
  });

  describe('delete', () => {
    it('should delete a milestone', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await milestonesService.delete('milestone-1');

      expect(api.delete).toHaveBeenCalledWith('/milestones/milestone-1');
    });
  });
});
