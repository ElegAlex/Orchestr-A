import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AccessScopeService } from '../common/services/access-scope.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let accessScope: {
    documentReadWhere: ReturnType<typeof vi.fn>;
    assertCanReadDocument: ReturnType<typeof vi.fn>;
    assertCanAccessProject: ReturnType<typeof vi.fn>;
  };

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

  const mockAuditPersistence = {
    log: vi.fn().mockResolvedValue(undefined),
  };

  const mockDocument = {
    id: 'doc-1',
    name: 'Test Document',
    url: 'https://example.com/doc.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    projectId: 'project-1',
    uploadedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    accessScope = {
      documentReadWhere: vi.fn().mockResolvedValue({}),
      assertCanReadDocument: vi.fn().mockResolvedValue(undefined),
      assertCanAccessProject: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AccessScopeService,
          useValue: accessScope,
        },
        {
          provide: AuditPersistenceService,
          useValue: mockAuditPersistence,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
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
          where: expect.objectContaining({ projectId: 'project-1' }) as object,
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

  // OBS-006 — document access must leave an audit trail (RGPD Art. 30 /
  // Cour des Comptes: "who read what when"). DOCUMENT_READ is emitted on the
  // explicit fetch-by-id path (findOne) with the caller as actor; entityType
  // 'Document', entityId the document id, payload carries the request metadata.
  describe('audit emission (OBS-006)', () => {
    const caller = { id: 'user-1', role: 'ADMIN' };
    const meta = { ip: '203.0.113.5', ua: 'test-agent/1.0' };

    it('emits DOCUMENT_READ with caller-as-actor on findOne by id', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      await service.findOne('doc-1', caller, meta);

      expect(mockAuditPersistence.log).toHaveBeenCalledTimes(1);
      expect(mockAuditPersistence.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_READ',
          entityType: 'Document',
          entityId: 'doc-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            documentId: 'doc-1',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            ip: '203.0.113.5',
            ua: 'test-agent/1.0',
          }),
        }),
      );
    });

    it('does NOT fail the read when audit persistence rejects (fire-and-forget)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockAuditPersistence.log.mockRejectedValueOnce(new Error('chain down'));

      // The read must still resolve with the document even if the audit
      // emission fails — a read path must not 500 on an audit hiccup.
      await expect(
        service.findOne('doc-1', caller, meta),
      ).resolves.toMatchObject({ id: 'doc-1' });
    });

    it('does NOT emit when caller is undefined (internal findOne / backward-compat)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      await service.findOne('doc-1');

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('does NOT emit when access is denied (assertCanReadDocument rejects)', async () => {
      accessScope.assertCanReadDocument.mockRejectedValueOnce(
        new Error('forbidden'),
      );

      await expect(service.findOne('doc-1', caller, meta)).rejects.toThrow();

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('does NOT emit when the document does not exist (404 before emit)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', caller, meta),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
    });

    it('does NOT emit on the list endpoint (findAll) — high-volume, skipped', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.document.count.mockResolvedValue(1);

      await service.findAll(1, 10, undefined, caller);

      expect(mockAuditPersistence.log).not.toHaveBeenCalled();
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
    it('should soft-delete a document (DAT-025: sets deletedAt, does NOT hard-delete)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      await service.remove('doc-1');

      // After DAT-025 fix: soft-delete via update, not hard-delete
      expect(mockPrismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }) as object,
        }),
      );
      expect(mockPrismaService.document.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll (DAT-025: excludes soft-deleted)', () => {
    it('filters out soft-deleted documents (deletedAt: null in where clause)', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.document.count.mockResolvedValue(1);

      await service.findAll(1, 10);

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }) as object,
        }),
      );
    });
  });

  describe('findOne (DAT-025: soft-deleted document treated as not found)', () => {
    it('throws NotFoundException for a soft-deleted document', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      await expect(service.findOne('doc-1')).rejects.toThrow(NotFoundException);
    });
  });

  // TST-016 — security-relevant negative tests missing from original spec

  describe('create (TST-016: size cap)', () => {
    it('throws BadRequestException when size exceeds MAX_DOCUMENT_SIZE_BYTES', async () => {
      const oversizeDto = {
        name: 'Huge File',
        url: 'https://example.com/huge.pdf',
        mimeType: 'application/pdf',
        size: 200_000_001, // > 200 MB cap
        projectId: 'project-1',
      };
      await expect(service.create('user-1', oversizeDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.document.create).not.toHaveBeenCalled();
    });

    it('accepts a file at the size limit boundary (exactly MAX_DOCUMENT_SIZE_BYTES)', async () => {
      const atLimitDto = {
        name: 'Edge File',
        url: 'https://example.com/edge.pdf',
        mimeType: 'application/pdf',
        size: 200_000_000, // exactly 200 MB — should pass
        projectId: 'project-1',
      };
      mockPrismaService.document.create.mockResolvedValue(mockDocument);
      await expect(service.create('user-1', atLimitDto)).resolves.toBeDefined();
    });
  });

  describe('remove (TST-016: cross-user delete Forbidden)', () => {
    it('throws ForbiddenException when a non-owner without manage_any tries to delete', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument); // uploadedBy: 'user-1'

      const nonOwner = { id: 'user-2', role: 'CONTRIBUTEUR' };
      // Simulate a scoped (non-empty) documentReadWhere result, meaning the user
      // does NOT have documents:manage_any — they only see their own documents.
      accessScope.documentReadWhere.mockResolvedValueOnce({
        uploadedBy: 'user-2',
      });

      await expect(
        (
          service as unknown as {
            remove(id: string, user: unknown): Promise<unknown>;
          }
        ).remove('doc-1', nonOwner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows delete by the document owner (uploadedBy matches currentUser.id)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument); // uploadedBy: 'user-1'
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      const owner = { id: 'user-1', role: 'CONTRIBUTEUR' };
      // documentReadWhere returns scoped (non-empty) — owner bypasses via uploadedBy match
      accessScope.documentReadWhere.mockResolvedValueOnce({
        uploadedBy: 'user-1',
      });
      await expect(
        (
          service as unknown as {
            remove(id: string, user: unknown): Promise<unknown>;
          }
        ).remove('doc-1', owner),
      ).resolves.toBeDefined();
    });

    it('allows delete by a user with documents:manage_any bypass (empty documentReadWhere)', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument); // uploadedBy: 'user-1'
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      // documentReadWhere returns {} (empty) = full-access, simulating manage_any bypass
      const adminUser = { id: 'user-admin', role: 'ADMIN' };
      accessScope.documentReadWhere.mockResolvedValueOnce({});
      await expect(
        (
          service as unknown as {
            remove(id: string, user: unknown): Promise<unknown>;
          }
        ).remove('doc-1', adminUser),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll (TST-016: documentReadWhere scoping applied with currentUser)', () => {
    it('applies documentReadWhere scope filter when currentUser is provided', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.document.count.mockResolvedValue(1);

      const scopeWhere = { uploadedBy: 'user-1' };
      accessScope.documentReadWhere.mockResolvedValueOnce(scopeWhere);

      const currentUser = { id: 'user-1', role: 'CONTRIBUTEUR' };
      await service.findAll(1, 10, undefined, currentUser);

      expect(accessScope.documentReadWhere).toHaveBeenCalledWith(currentUser);
      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [scopeWhere],
          }) as object,
        }),
      );
    });

    it('does NOT apply documentReadWhere when currentUser is absent', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.document.count.mockResolvedValue(1);

      await service.findAll(1, 10);

      expect(accessScope.documentReadWhere).not.toHaveBeenCalled();
    });
  });
});
