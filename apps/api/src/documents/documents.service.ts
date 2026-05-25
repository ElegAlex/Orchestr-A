import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    const where: Prisma.DocumentWhereInput = {};
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
    if (!document) throw new NotFoundException('Document introuvable');

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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document supprimé avec succès' };
  }
}
