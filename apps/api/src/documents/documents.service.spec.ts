import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  };

  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    url: 'https://example.com/doc.pdf',
    type: 'PDF',
    size: 1024,
    projectId: 'project-1',
    uploadedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a document successfully', async () => {
      const createDto = {
        name: 'Test Document',
        url: 'https://example.com/doc.pdf',
        type: 'PDF',
        size: 1024,
        projectId: 'project-1',
      };
      const userId = 'user-1';

      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.create(userId, createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.document.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const mockDocuments = [mockDocument];
      mockPrismaService.document.findMany.mockResolvedValue(mockDocuments);
      mockPrismaService.document.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter documents by project', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.document.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'project-1');

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a document by id', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      const result = await service.findOne('doc-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('doc-1');
    });

    it('should throw error when document not found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a document successfully', async () => {
      const updateDto = { name: 'Updated Document' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      const result = await service.update('doc-1', updateDto);

      expect(result.name).toBe('Updated Document');
    });
  });

  describe('remove', () => {
    it('should delete a document', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.delete.mockResolvedValue(mockDocument);

      await service.remove('doc-1');

      expect(mockPrismaService.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });
  });
});
