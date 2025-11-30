import { leavesService } from '../leaves.service';
import { api } from '@/lib/api';
import { LeaveType, LeaveStatus } from '@/types';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('leavesService', () => {
  const mockLeave = {
    id: 'leave-1',
    userId: 'user-1',
    type: LeaveType.CP,
    startDate: '2025-06-01',
    endDate: '2025-06-05',
    days: 5,
    status: LeaveStatus.PENDING,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockLeaves = [mockLeave, { ...mockLeave, id: 'leave-2' }];

  const mockDelegation = {
    id: 'delegation-1',
    delegatorId: 'user-1',
    delegateId: 'user-2',
    startDate: '2025-06-01',
    endDate: '2025-06-10',
    isActive: true,
    createdAt: '2025-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all leaves with default pagination', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockLeaves } });

      await leavesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/leaves?page=1&limit=100');
    });

    it('should fetch leaves with custom pagination', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockLeaves } });

      await leavesService.getAll(2, 50);

      expect(api.get).toHaveBeenCalledWith('/leaves?page=2&limit=50');
    });

    it('should filter by userId', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockLeaves } });

      await leavesService.getAll(1, 100, 'user-1');

      expect(api.get).toHaveBeenCalledWith('/leaves?page=1&limit=100&userId=user-1');
    });

    it('should filter by status', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockLeaves } });

      await leavesService.getAll(1, 100, undefined, LeaveStatus.APPROVED);

      expect(api.get).toHaveBeenCalledWith('/leaves?page=1&limit=100&status=APPROVED');
    });

    it('should filter by type', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockLeaves } });

      await leavesService.getAll(1, 100, undefined, undefined, LeaveType.RTT);

      expect(api.get).toHaveBeenCalledWith('/leaves?page=1&limit=100&type=RTT');
    });
  });

  describe('getById', () => {
    it('should fetch leave by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeave });

      const result = await leavesService.getById('leave-1');

      expect(api.get).toHaveBeenCalledWith('/leaves/leave-1');
      expect(result).toEqual(mockLeave);
    });
  });

  describe('getByUser', () => {
    it('should fetch leaves by user', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getByUser('user-1');

      expect(api.get).toHaveBeenCalledWith('/leaves/user/user-1');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('getMyLeaves', () => {
    it('should fetch current user leaves', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getMyLeaves();

      expect(api.get).toHaveBeenCalledWith('/leaves/me');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('getPendingForValidation', () => {
    it('should fetch pending leaves for validation', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getPendingForValidation();

      expect(api.get).toHaveBeenCalledWith('/leaves/pending-validation');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('getByType', () => {
    it('should fetch leaves by type', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getByType(LeaveType.SICK_LEAVE);

      expect(api.get).toHaveBeenCalledWith('/leaves/type/SICK_LEAVE');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('getByStatus', () => {
    it('should fetch leaves by status', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getByStatus(LeaveStatus.REJECTED);

      expect(api.get).toHaveBeenCalledWith('/leaves/status/REJECTED');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('getByDateRange', () => {
    it('should fetch leaves by date range', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaves });

      const result = await leavesService.getByDateRange('2025-01-01', '2025-12-31');

      expect(api.get).toHaveBeenCalledWith('/leaves?startDate=2025-01-01&endDate=2025-12-31');
      expect(result).toEqual(mockLeaves);
    });
  });

  describe('create', () => {
    it('should create a new leave request', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockLeave });

      const createData = {
        leaveTypeId: 'leave-type-1',
        startDate: '2025-06-01',
        endDate: '2025-06-05',
      };

      const result = await leavesService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/leaves', createData);
      expect(result).toEqual(mockLeave);
    });
  });

  describe('update', () => {
    it('should update a leave request', async () => {
      const updatedLeave = { ...mockLeave, endDate: '2025-06-10' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedLeave });

      const result = await leavesService.update('leave-1', { endDate: '2025-06-10' });

      expect(api.patch).toHaveBeenCalledWith('/leaves/leave-1', { endDate: '2025-06-10' });
      expect(result).toEqual(updatedLeave);
    });
  });

  describe('updateStatus', () => {
    it('should update leave status', async () => {
      const updatedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedLeave });

      const result = await leavesService.updateStatus('leave-1', LeaveStatus.APPROVED);

      expect(api.patch).toHaveBeenCalledWith('/leaves/leave-1/status', { status: LeaveStatus.APPROVED });
      expect(result).toEqual(updatedLeave);
    });
  });

  describe('delete', () => {
    it('should delete a leave request', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await leavesService.delete('leave-1');

      expect(api.delete).toHaveBeenCalledWith('/leaves/leave-1');
    });
  });

  describe('getBalance', () => {
    it('should fetch leave balance for user', async () => {
      const mockBalance = { cp: 25, rtt: 10 };
      (api.get as jest.Mock).mockResolvedValue({ data: mockBalance });

      const result = await leavesService.getBalance('user-1');

      expect(api.get).toHaveBeenCalledWith('/leaves/balance/user-1');
      expect(result).toEqual(mockBalance);
    });
  });

  describe('getMyBalance', () => {
    it('should fetch current user leave balance', async () => {
      const mockBalance = { cp: 25, rtt: 10 };
      (api.get as jest.Mock).mockResolvedValue({ data: mockBalance });

      const result = await leavesService.getMyBalance();

      expect(api.get).toHaveBeenCalledWith('/leaves/me/balance');
      expect(result).toEqual(mockBalance);
    });
  });

  describe('approve', () => {
    it('should approve a leave request', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      (api.post as jest.Mock).mockResolvedValue({ data: approvedLeave });

      const result = await leavesService.approve('leave-1', 'Approved');

      expect(api.post).toHaveBeenCalledWith('/leaves/leave-1/approve', { comment: 'Approved' });
      expect(result).toEqual(approvedLeave);
    });

    it('should approve without comment', async () => {
      const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
      (api.post as jest.Mock).mockResolvedValue({ data: approvedLeave });

      await leavesService.approve('leave-1');

      expect(api.post).toHaveBeenCalledWith('/leaves/leave-1/approve', { comment: undefined });
    });
  });

  describe('reject', () => {
    it('should reject a leave request', async () => {
      const rejectedLeave = { ...mockLeave, status: LeaveStatus.REJECTED };
      (api.post as jest.Mock).mockResolvedValue({ data: rejectedLeave });

      const result = await leavesService.reject('leave-1', 'Not enough coverage');

      expect(api.post).toHaveBeenCalledWith('/leaves/leave-1/reject', { reason: 'Not enough coverage' });
      expect(result).toEqual(rejectedLeave);
    });
  });

  describe('cancel', () => {
    it('should cancel a leave request', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockLeave });

      const result = await leavesService.cancel('leave-1');

      expect(api.post).toHaveBeenCalledWith('/leaves/leave-1/cancel');
      expect(result).toEqual(mockLeave);
    });
  });

  describe('createDelegation', () => {
    it('should create a validation delegation', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockDelegation });

      const result = await leavesService.createDelegation('user-2', '2025-06-01', '2025-06-10');

      expect(api.post).toHaveBeenCalledWith('/leaves/delegations', {
        delegateId: 'user-2',
        startDate: '2025-06-01',
        endDate: '2025-06-10',
      });
      expect(result).toEqual(mockDelegation);
    });
  });

  describe('getMyDelegations', () => {
    it('should fetch current user delegations', async () => {
      const mockDelegations = { given: [mockDelegation], received: [] };
      (api.get as jest.Mock).mockResolvedValue({ data: mockDelegations });

      const result = await leavesService.getMyDelegations();

      expect(api.get).toHaveBeenCalledWith('/leaves/delegations/me');
      expect(result).toEqual(mockDelegations);
    });
  });

  describe('deactivateDelegation', () => {
    it('should deactivate a delegation', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await leavesService.deactivateDelegation('delegation-1');

      expect(api.delete).toHaveBeenCalledWith('/leaves/delegations/delegation-1');
    });
  });
});
