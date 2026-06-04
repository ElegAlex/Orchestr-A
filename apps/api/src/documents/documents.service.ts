import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Prisma } from 'database';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';

/** Request metadata threaded from the controller for audit emission (OBS-006). */
export type DocumentAccessMeta = { ip?: string; ua?: string };

/**
 * TST-016 — self-reported size cap for the metadata-only document store.
 * Documents are stored as URL + metadata (no binary upload pipeline), so
 * this cap guards the `size` integer field against absurd values. Aligned
 * with typical government document portals (200 MB covers any realistic
 * office/PDF artefact; nginx client_max_body_size handles the actual upload
 * to the storage backend if one is added later).
 */
export const MAX_DOCUMENT_SIZE_BYTES = 200_000_000; // 200 MB

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  async create(
    userId: string,
    createDocumentDto: CreateDocumentDto,
    currentUser?: AccessUser,
  ) {
    // TST-016: service-layer size guard. The `size` field is self-reported by
    // the client (URL-based storage, no binary upload pipeline). Reject values
    // that exceed the cap to block metadata pollution / storage quota gaming.
    if (createDocumentDto.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed (${MAX_DOCUMENT_SIZE_BYTES} bytes)`,
      );
    }

    if (currentUser) {
      await this.accessScope.assertCanAccessProject(
        createDocumentDto.projectId,
        currentUser,
        ['documents:manage_any', 'projects:manage_any'],
      );
    }

    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        uploadedBy: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(
    page = 1,
    limit = 1000,
    projectId?: string,
    currentUser?: AccessUser,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where: Prisma.DocumentWhereInput = { deletedAt: null }; // DAT-025: exclude soft-deleted
    if (projectId) where.projectId = projectId;
    if (currentUser) {
      where.AND = [await this.accessScope.documentReadWhere(currentUser)];
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(
    id: string,
    currentUser?: AccessUser,
    meta?: DocumentAccessMeta,
  ) {
    if (currentUser) {
      await this.accessScope.assertCanReadDocument(id, currentUser);
    }

    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });
    if (!document || document.deletedAt) throw new NotFoundException('Document introuvable'); // DAT-025: treat soft-deleted as not found

    // OBS-006 — emit DOCUMENT_READ only on a caller-driven fetch-by-id, AFTER
    // the access check and existence check pass (no trail for denied/missing
    // reads). Internal callers (update/remove call findOne(id) with no
    // currentUser) skip emission — backward-compat + avoids spurious reads.
    //
    // Fire-and-forget (NOT awaited): this is a READ path, higher-frequency than
    // the mutation emitters (OBS-005/DAT-007) that could afford a plain await.
    // A transient audit-chain hiccup must NOT turn a successful read into a 500,
    // and the read must not block on the audit advisory lock — mirrors the
    // AuditService floor pattern (`void …log().catch()`) for high-frequency
    // events. findUnique above already proved the DB reachable, so the realistic
    // loss window is tiny; the `.catch` surfaces any dropped row as an error log.
    if (currentUser) {
      void this.auditPersistence
        .log({
          action: AuditAction.DOCUMENT_READ,
          entityType: 'Document',
          entityId: document.id,
          actorId: currentUser.id,
          payload: {
            documentId: document.id,
            mimeType: document.mimeType,
            // sizeBytes from the Document.size column (bytes) — cheaper and
            // consistent; the API never streams the binary (see Document.url).
            sizeBytes: document.size,
            ...(meta?.ip !== undefined ? { ip: meta.ip } : {}),
            ...(meta?.ua !== undefined ? { ua: meta.ua } : {}),
          },
        })
        .catch((err) => {
          this.logger.error(
            `Failed to persist DOCUMENT_READ for document ${document.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }

    return document;
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, currentUser?: AccessUser) {
    const document = await this.findOne(id);

    // TST-016: service-layer ownership assertion — defense-in-depth below the
    // OwnershipGuard at the controller layer. If a currentUser is provided,
    // only the uploader OR a user with documents:manage_any may delete.
    // This catches programmatic service calls that bypass the HTTP guard.
    if (currentUser) {
      const scopeWhere = await this.accessScope.documentReadWhere(currentUser);
      const isFullAccess =
        !scopeWhere ||
        (typeof scopeWhere === 'object' && Object.keys(scopeWhere).length === 0);
      const isOwner = document.uploadedBy === currentUser.id;
      if (!isFullAccess && !isOwner) {
        throw new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres documents',
        );
      }
    }

    // DAT-025: soft-delete — set deletedAt instead of hard-delete; preserves FK audit trail
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Document supprimé avec succès' };
  }
}
