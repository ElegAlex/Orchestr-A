import { servicesService } from '../services.service';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('servicesService', () => {
  const mockService = {
    id: 'service-1',
    name: 'Development',
    description: 'Development team',
    departmentId: 'dept-1',
    managerId: 'user-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockServices = [mockService, { ...mockService, id: 'service-2', name: 'QA' }];

  const mockMembers = [
    { id: 'user-1', firstName: 'John', lastName: 'Doe' },
    { id: 'user-2', firstName: 'Jane', lastName: 'Smith' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all services from wrapped response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockServices } });

      const result = await servicesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/services');
      expect(result).toEqual(mockServices);
    });

    it('should handle direct array response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockServices });

      const result = await servicesService.getAll();

      expect(result).toEqual(mockServices);
    });

    it('should return empty array for invalid response', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await servicesService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should fetch service by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockService });

      const result = await servicesService.getById('service-1');

      expect(api.get).toHaveBeenCalledWith('/services/service-1');
      expect(result).toEqual(mockService);
    });
  });

  describe('getByDepartment', () => {
    it('should fetch services by department', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockServices });

      const result = await servicesService.getByDepartment('dept-1');

      expect(api.get).toHaveBeenCalledWith('/services/department/dept-1');
      expect(result).toEqual(mockServices);
    });
  });

  describe('create', () => {
    it('should create a new service', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockService });

      const createData = {
        name: 'New Service',
        description: 'New description',
        departmentId: 'dept-1',
      };

      const result = await servicesService.create(createData);

      expect(api.post).toHaveBeenCalledWith('/services', createData);
      expect(result).toEqual(mockService);
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      const updatedService = { ...mockService, name: 'Updated Service' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedService });

      const result = await servicesService.update('service-1', { name: 'Updated Service' });

      expect(api.patch).toHaveBeenCalledWith('/services/service-1', { name: 'Updated Service' });
      expect(result).toEqual(updatedService);
    });
  });

  describe('delete', () => {
    it('should delete a service', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await servicesService.delete('service-1');

      expect(api.delete).toHaveBeenCalledWith('/services/service-1');
    });
  });

  describe('getMembers', () => {
    it('should fetch service members', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockMembers });

      const result = await servicesService.getMembers('service-1');

      expect(api.get).toHaveBeenCalledWith('/services/service-1/members');
      expect(result).toEqual(mockMembers);
    });
  });
});
