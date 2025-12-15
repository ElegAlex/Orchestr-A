import { teleworkService } from '../telework.service';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('teleworkService', () => {
  const mockTelework = {
    id: 'tw-1',
    userId: 'user-1',
    date: '2025-06-15',
    isTelework: true,
    isException: false,
    createdAt: '2025-01-01',
  };

  const mockTeleworks = [mockTelework, { ...mockTelework, id: 'tw-2', date: '2025-06-16' }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all telework entries from wrapped response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockTeleworks } });

      const result = await teleworkService.getAll();

      expect(api.get).toHaveBeenCalledWith('/telework');
      expect(result).toEqual(mockTeleworks);
    });

    it('should handle direct array response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTeleworks });

      const result = await teleworkService.getAll();

      expect(result).toEqual(mockTeleworks);
    });

    it('should return empty array for invalid response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await teleworkService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByUser', () => {
    it('should fetch telework entries by user', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTeleworks });

      const result = await teleworkService.getByUser('user-1');

      expect(api.get).toHaveBeenCalledWith('/telework/user/user-1');
      expect(result).toEqual(mockTeleworks);
    });
  });

  describe('getByDateRange', () => {
    it('should fetch telework entries by date range', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockTeleworks } });

      const result = await teleworkService.getByDateRange('2025-06-01', '2025-06-30');

      expect(api.get).toHaveBeenCalledWith('/telework?startDate=2025-06-01&endDate=2025-06-30');
      expect(result).toEqual(mockTeleworks);
    });

    it('should handle direct array response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTeleworks });

      const result = await teleworkService.getByDateRange('2025-06-01', '2025-06-30');

      expect(result).toEqual(mockTeleworks);
    });
  });

  describe('create', () => {
    it('should create a new telework entry', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockTelework });

      const createData = {
        date: '2025-06-15',
        isTelework: true,
        isException: false,
      };

      const result = await teleworkService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/telework', createData);
      expect(result).toEqual(mockTelework);
    });
  });

  describe('update', () => {
    it('should update a telework entry', async () => {
      const updatedTelework = { ...mockTelework, isTelework: false };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedTelework });

      const result = await teleworkService.update('tw-1', { isTelework: false });

      expect(api.patch).toHaveBeenCalledWith('/telework/tw-1', { isTelework: false });
      expect(result).toEqual(updatedTelework);
    });
  });

  describe('delete', () => {
    it('should delete a telework entry', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await teleworkService.delete('tw-1');

      expect(api.delete).toHaveBeenCalledWith('/telework/tw-1');
    });
  });
});
