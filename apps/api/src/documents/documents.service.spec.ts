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
import { AuditAction } from '../audit/audit.service';
import { validatePayloadForAction } from '../audit/payload-schemas';
import { Prisma } from 'database';

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

    // OBS-006 — document creation must leave a durable audit row.
    it('OBS-006: emits DOCUMENT_CREATED with a schema-conformant payload', async () => {
      const createDto = {
        name: 'Test Document',
        url: 'https://example.com/doc.pdf',
        type: 'PDF',
        size: 1024,
        projectId: 'project-1',
      };
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      await service.create('user-1', createDto);

      const call = mockAuditPersistence.log.mock.calls.find(
        (c) => c[0]?.action === AuditAction.DOCUMENT_CREATED,
      )?.[0];
      expect(call).toMatchObject({
        action: AuditAction.DOCUMENT_CREATED,
        entityType: 'Document',
        entityId: 'doc-1',
        actorId: 'user-1',
      });
      expect(() =>
        validatePayloadForAction(AuditAction.DOCUMENT_CREATED, call?.payload),
      ).not.toThrow();
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

    // PER-043: hard cap must be 100 regardless of caller-supplied limit
    it('PER-043 — caps safeLimit at 100 even when limit=500 is supplied', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([]);
      mockPrismaService.document.count.mockResolvedValue(0);

      const result = await service.findAll(1, 500);

      expect(result.meta.limit).toBeLessThanOrEqual(100);
      const call = mockPrismaService.document.findMany.mock.calls[0][0] as {
        take: number;
      };
      expect(call.take).toBeLessThanOrEqual(100);
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

    // OBS-006 — metadata edits must leave a durable before/after audit row.
    it('OBS-006: emits DOCUMENT_UPDATED with a before/after, schema-conformant payload', async () => {
      const updateDto = { name: 'Updated Document' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      await service.update('doc-1', updateDto, { id: 'editor-1', role: null });

      const call = mockAuditPersistence.log.mock.calls.find(
        (c) => c[0]?.action === AuditAction.DOCUMENT_UPDATED,
      )?.[0];
      expect(call).toMatchObject({
        action: AuditAction.DOCUMENT_UPDATED,
        entityType: 'Document',
        entityId: 'doc-1',
        actorId: 'editor-1',
      });
      expect(call?.payload).toMatchObject({
        before: expect.objectContaining({ name: 'Test Document' }),
        after: expect.objectContaining({ name: 'Updated Document' }),
      });
      expect(() =>
        validatePayloadForAction(AuditAction.DOCUMENT_UPDATED, call?.payload),
      ).not.toThrow();
    });
  });

  // COR-009 — update() must guard against race-window mutation of a soft-deleted
  // document. The prisma.document.update WHERE clause must include deletedAt: null
  // so a concurrent soft-delete between findOne and update does not resurrect the
  // tombstone. When Prisma returns P2025 (record-not-found with that compound WHERE),
  // the service must translate it to a NotFoundException.
  describe('update (COR-009: soft-delete race-window guard)', () => {
    it('COR-009 — update() returns NotFoundException when prisma.document.update does not match (P2025, deletedAt filter)', async () => {
      // Simulate: findOne passes (document not yet soft-deleted at read time),
      // but by the time update runs, the document has been soft-deleted and
      // Prisma returns P2025 because the WHERE id + deletedAt:null finds no row.
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      const p2025 = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        { code: 'P2025', clientVersion: 'test' },
      );
      mockPrismaService.document.update.mockRejectedValueOnce(p2025);

      await expect(service.update('doc-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('COR-009 — update() WHERE clause includes deletedAt: null to prevent mutating soft-deleted rows', async () => {
      const updateDto = { name: 'Updated' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      await service.update('doc-1', updateDto);

      // The WHERE clause must include deletedAt: null — not just { id }
      expect(mockPrismaService.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }) as object,
        }),
      );
    });
  });

  // COR-010 — update() must check caller access to the new projectId when the
  // payload includes a projectId that differs from the document's current one.
  // Without this check a document owner can move their document to any project,
  // bypassing the access scope enforced on create().
  describe('update (COR-010: projectId access check on reassignment)', () => {
    it('COR-010 — update() with a different projectId calls assertCanAccessProject for the new project', async () => {
      const caller = { id: 'user-1', role: 'CONTRIBUTEUR' };
      const updateDto = { projectId: 'project-2' }; // different from mockDocument.projectId = 'project-1'
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      await service.update('doc-1', updateDto, caller);

      expect(accessScope.assertCanAccessProject).toHaveBeenCalledWith(
        'project-2',
        caller,
        expect.any(Array),
      );
    });

    it('COR-010 — update() with the same projectId does NOT call assertCanAccessProject (no move)', async () => {
      const caller = { id: 'user-1', role: 'CONTRIBUTEUR' };
      // Same projectId as existing document
      const updateDto = { projectId: 'project-1', name: 'Renamed' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      await service.update('doc-1', updateDto, caller);

      expect(accessScope.assertCanAccessProject).not.toHaveBeenCalled();
    });

    it('COR-010 — update() without currentUser skips assertCanAccessProject even if projectId changes', async () => {
      const updateDto = { projectId: 'project-2' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ...updateDto,
      });

      // No currentUser supplied — backward-compat path (internal calls)
      await service.update('doc-1', updateDto);

      expect(accessScope.assertCanAccessProject).not.toHaveBeenCalled();
    });

    it('COR-010 — update() throws ForbiddenException when assertCanAccessProject rejects on new projectId', async () => {
      const caller = { id: 'user-1', role: 'CONTRIBUTEUR' };
      const updateDto = { projectId: 'project-restricted' };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      accessScope.assertCanAccessProject.mockRejectedValueOnce(
        new ForbiddenException('Accès projet non autorisé'),
      );

      await expect(service.update('doc-1', updateDto, caller)).rejects.toThrow(
        ForbiddenException,
      );

      // prisma.update must NOT have been called — check happens before the write
      expect(mockPrismaService.document.update).not.toHaveBeenCalled();
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

    // OBS-006 — the soft-delete must leave a durable audit row.
    it('OBS-006: emits DOCUMENT_DELETED with a schema-conformant payload', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      await service.remove('doc-1');

      const call = mockAuditPersistence.log.mock.calls.find(
        (c) => c[0]?.action === AuditAction.DOCUMENT_DELETED,
      )?.[0];
      expect(call).toMatchObject({
        action: AuditAction.DOCUMENT_DELETED,
        entityType: 'Document',
        entityId: 'doc-1',
      });
      expect(() =>
        validatePayloadForAction(AuditAction.DOCUMENT_DELETED, call?.payload),
      ).not.toThrow();
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
