import { Test, TestingModule } from '@nestjs/testing';
import { ThirdPartyType } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThirdPartiesController } from './third-parties.controller';
import { ThirdPartiesService } from './third-parties.service';

describe('ThirdPartiesController', () => {
  let controller: ThirdPartiesController;

  const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    hardDelete: vi.fn(),
    getDeletionImpact: vi.fn(),
  };

  const currentUser = { id: 'user-1' };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThirdPartiesController],
      providers: [{ provide: ThirdPartiesService, useValue: mockService }],
    }).compile();
    controller = module.get<ThirdPartiesController>(ThirdPartiesController);
  });

  it('POST / delegates to service.create with currentUser.id', async () => {
    mockService.create.mockResolvedValue({ id: 'tp-1' });
    await controller.create(
      {
        type: ThirdPartyType.EXTERNAL_PROVIDER,
        organizationName: 'Acme',
      },
      currentUser,
    );
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ThirdPartyType.EXTERNAL_PROVIDER,
        organizationName: 'Acme',
      }),
      'user-1',
    );
  });

  it('GET / delegates to service.findAll with query', async () => {
    mockService.findAll.mockResolvedValue({ data: [], pagination: {} });
    await controller.findAll({ page: 1, limit: 20 });
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('GET /:id delegates to service.findOne', async () => {
    mockService.findOne.mockResolvedValue({ id: 'tp-1' });
    await controller.findOne('tp-1');
    expect(mockService.findOne).toHaveBeenCalledWith('tp-1');
  });

  it('GET /:id/deletion-impact delegates to service.getDeletionImpact', async () => {
    mockService.getDeletionImpact.mockResolvedValue({
      timeEntriesCount: 3,
      taskAssignmentsCount: 1,
      projectMembershipsCount: 2,
    });
    const result = await controller.getDeletionImpact('tp-1');
    expect(mockService.getDeletionImpact).toHaveBeenCalledWith('tp-1');
    expect(result.timeEntriesCount).toBe(3);
  });

  it('PATCH /:id delegates to service.update', async () => {
    mockService.update.mockResolvedValue({ id: 'tp-1', isActive: false });
    await controller.update('tp-1', { isActive: false });
    expect(mockService.update).toHaveBeenCalledWith('tp-1', {
      isActive: false,
    });
  });

  it('DELETE /:id delegates to service.hardDelete and returns void', async () => {
    mockService.hardDelete.mockResolvedValue(undefined);
    const result = await controller.remove('tp-1');
    expect(mockService.hardDelete).toHaveBeenCalledWith('tp-1');
    expect(result).toBeUndefined();
  });
});
