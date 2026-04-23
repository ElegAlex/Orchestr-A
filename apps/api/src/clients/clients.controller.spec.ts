import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

describe('ClientsController', () => {
  let controller: ClientsController;

  const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    getClientProjects: vi.fn(),
    getDeletionImpact: vi.fn(),
    update: vi.fn(),
    hardDelete: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: mockService }],
    }).compile();
    controller = module.get<ClientsController>(ClientsController);
  });

  it('POST / delegates to service.create', async () => {
    mockService.create.mockResolvedValue({ id: 'c-1', name: 'Mairie de Lyon' });
    const result = await controller.create({ name: 'Mairie de Lyon' });
    expect(mockService.create).toHaveBeenCalledWith({ name: 'Mairie de Lyon' });
    expect(result).toBeDefined();
  });

  it('GET / delegates to service.findAll with query', async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll({ page: 1, limit: 20 });
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('GET /:id delegates to service.findOne', async () => {
    mockService.findOne.mockResolvedValue({ id: 'c-1' });
    await controller.findOne('c-1');
    expect(mockService.findOne).toHaveBeenCalledWith('c-1');
  });

  it('GET /:id/projects delegates to service.getClientProjects', async () => {
    mockService.getClientProjects.mockResolvedValue({
      projects: [],
      summary: {
        projectsActive: 0,
        projectsTotal: 0,
        budgetHoursTotal: 0,
        hoursLoggedTotal: 0,
        varianceHours: 0,
      },
    });
    const result = await controller.getClientProjects('c-1');
    expect(mockService.getClientProjects).toHaveBeenCalledWith('c-1');
    expect(result.summary.projectsTotal).toBe(0);
  });

  it('GET /:id/deletion-impact delegates to service.getDeletionImpact', async () => {
    mockService.getDeletionImpact.mockResolvedValue({ projectsCount: 2 });
    const result = await controller.getDeletionImpact('c-1');
    expect(mockService.getDeletionImpact).toHaveBeenCalledWith('c-1');
    expect(result.projectsCount).toBe(2);
  });

  it('PATCH /:id delegates to service.update', async () => {
    mockService.update.mockResolvedValue({ id: 'c-1', isActive: false });
    await controller.update('c-1', { isActive: false });
    expect(mockService.update).toHaveBeenCalledWith('c-1', { isActive: false });
  });

  it('DELETE /:id delegates to service.hardDelete and returns void', async () => {
    mockService.hardDelete.mockResolvedValue(undefined);
    const result = await controller.remove('c-1');
    expect(mockService.hardDelete).toHaveBeenCalledWith('c-1');
    expect(result).toBeUndefined();
  });
});
