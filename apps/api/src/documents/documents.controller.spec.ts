import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { NotFoundException } from '@nestjs/common';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  const mockDocument = {
    id: 'doc-id-1',
    name: 'Requirements.pdf',
    description: 'Project requirements document',
    url: 'https://storage.example.com/docs/requirements.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    projectId: 'project-id-1',
    uploadedBy: 'user-id-1',
    createdAt: new Date(),
    project: {
      id: 'project-id-1',
      name: 'Main Project',
    },
  };

  const mockDocumentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createDocumentDto = {
      name: 'Requirements.pdf',
      description: 'Project requirements document',
      url: 'https://storage.example.com/docs/requirements.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      projectId: 'project-id-1',
    };

    it('should create a document successfully', async () => {
      mockDocumentsService.create.mockResolvedValue(mockDocument);

      const result = await controller.create('user-id-1', createDocumentDto);

      expect(result).toEqual(mockDocument);
      expect(mockDocumentsService.create).toHaveBeenCalledWith(
        'user-id-1',
        createDocumentDto,
      );
      expect(mockDocumentsService.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockDocumentsService.create.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(
        controller.create('user-id-1', createDocumentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const paginatedResult = {
        data: [mockDocument],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockDocumentsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockDocumentsService.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
      );
    });

    it('should filter by projectId', async () => {
      const projectDocuments = {
        data: [mockDocument],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockDocumentsService.findAll.mockResolvedValue(projectDocuments);

      await controller.findAll(1, 10, 'project-id-1');

      expect(mockDocumentsService.findAll).toHaveBeenCalledWith(
        1,
        10,
        'project-id-1',
      );
    });
  });

  describe('findOne', () => {
    it('should return a document by id', async () => {
      mockDocumentsService.findOne.mockResolvedValue(mockDocument);

      const result = await controller.findOne('doc-id-1');

      expect(result).toEqual(mockDocument);
      expect(mockDocumentsService.findOne).toHaveBeenCalledWith('doc-id-1');
    });

    it('should throw NotFoundException when document not found', async () => {
      mockDocumentsService.findOne.mockRejectedValue(
        new NotFoundException('Document introuvable'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDocumentDto = {
      name: 'Requirements_v2.pdf',
      description: 'Updated project requirements',
    };

    it('should update a document successfully', async () => {
      const updatedDocument = { ...mockDocument, ...updateDocumentDto };
      mockDocumentsService.update.mockResolvedValue(updatedDocument);

      const result = await controller.update('doc-id-1', updateDocumentDto);

      expect(result.name).toBe('Requirements_v2.pdf');
      expect(result.description).toBe('Updated project requirements');
      expect(mockDocumentsService.update).toHaveBeenCalledWith(
        'doc-id-1',
        updateDocumentDto,
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      mockDocumentsService.update.mockRejectedValue(
        new NotFoundException('Document introuvable'),
      );

      await expect(
        controller.update('nonexistent', updateDocumentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a document successfully', async () => {
      mockDocumentsService.remove.mockResolvedValue({
        message: 'Document supprimé',
      });

      const result = await controller.remove('doc-id-1');

      expect(result.message).toBe('Document supprimé');
      expect(mockDocumentsService.remove).toHaveBeenCalledWith('doc-id-1');
    });

    it('should throw NotFoundException when document not found', async () => {
      mockDocumentsService.remove.mockRejectedValue(
        new NotFoundException('Document introuvable'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
