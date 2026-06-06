import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import {
  emitDataExported,
  type ExportMeta,
} from '../audit/export-audit.helper';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import {
  ImportMilestoneDto,
  ImportMilestonesResultDto,
  MilestonesValidationPreviewDto,
  MilestonePreviewItemDto,
  MilestonePreviewStatus,
} from './dto/import-milestones.dto';
import { MilestoneStatus, Prisma } from 'database';

// helper — centralises P2025 → NotFoundException translation
function rethrowP2025(err: unknown, message: string): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2025'
  ) {
    throw new NotFoundException(message);
  }
  throw err;
}

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  async create(createMilestoneDto: CreateMilestoneDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createMilestoneDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const { dueDate, ...data } = createMilestoneDto;

    return this.prisma.milestone.create({
      data: {
        ...data,
        dueDate: new Date(dueDate),
        status: MilestoneStatus.PENDING,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async findAll(
    page = 1,
    limit = 1000,
    projectId?: string,
    status?: MilestoneStatus,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where: Prisma.MilestoneWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.milestone.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.milestone.count({ where }),
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

  async findOne(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone introuvable');
    return milestone;
  }

  async update(
    id: string,
    updateMilestoneDto: UpdateMilestoneDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    const { dueDate, ...data } = updateMilestoneDto;

    try {
      return await this.prisma.milestone.update({
        where: { id },
        data: {
          ...data,
          ...(dueDate && { dueDate: new Date(dueDate) }),
        },
        include: { project: { select: { id: true, name: true } } },
      });
    } catch (err) {
      rethrowP2025(err, 'Milestone introuvable');
    }
  }

  async remove(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    try {
      await this.prisma.milestone.delete({ where: { id } });
    } catch (err) {
      rethrowP2025(err, 'Milestone introuvable');
    }
    return { message: 'Milestone supprimé avec succès' };
  }

  /**
   * Verify the current user is a member of the milestone's parent project.
   * Holders of the `projects:manage_any` bypass permission skip this check.
   */
  private async assertProjectMembership(
    milestoneId: string,
    userId: string,
    userRole?: string | null,
  ): Promise<void> {
    const permissions =
      await this.permissionsService.getPermissionsForRole(userRole);
    if (permissions.includes('projects:manage_any')) return;

    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: { include: { members: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone introuvable');

    const isMember = milestone.project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this project');
    }
  }

  async complete(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    return this.prisma.milestone.update({
      where: { id },
      data: { status: MilestoneStatus.COMPLETED },
    });
  }

  /**
   * Importer des jalons en masse pour un projet
   */
  async importMilestones(
    projectId: string,
    milestones: ImportMilestoneDto[],
  ): Promise<ImportMilestonesResultDto> {
    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const result: ImportMilestonesResultDto = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Pre-fetch all existing names for the project in a single query (mirrors
    // validateImport) to avoid N per-row findFirst + create round-trips and to
    // eliminate the TOCTOU race between check and insert [COR-018, PER-010].
    const existingMilestones = await this.prisma.milestone.findMany({
      where: { projectId },
      select: { name: true },
    });
    const existingNames = new Set(existingMilestones.map((m) => m.name));

    // Separate new milestones from duplicates using the in-memory Set
    const toCreate: Array<{
      name: string;
      description: string | null;
      dueDate: Date;
      status: MilestoneStatus;
      projectId: string;
    }> = [];

    for (let i = 0; i < milestones.length; i++) {
      const milestoneData = milestones[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      if (existingNames.has(milestoneData.name)) {
        result.skipped++;
        result.errorDetails.push(
          `Ligne ${lineNum}: Jalon "${milestoneData.name}" existe déjà`,
        );
        continue;
      }

      // Track names added in this batch to avoid intra-batch duplicates
      existingNames.add(milestoneData.name);
      toCreate.push({
        name: milestoneData.name,
        description: milestoneData.description || null,
        dueDate: new Date(milestoneData.dueDate),
        status: MilestoneStatus.PENDING,
        projectId,
      });
    }

    // Batch-insert all new milestones in a single createMany call
    if (toCreate.length > 0) {
      try {
        await this.prisma.milestone.createMany({ data: toCreate });
        result.created = toCreate.length;
      } catch (err) {
        result.errors = toCreate.length;
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        result.errorDetails.push(errorMessage);
      }
    }

    return result;
  }

  /**
   * Valider les jalons avant import (dry-run)
   */
  async validateImport(
    projectId: string,
    milestones: ImportMilestoneDto[],
  ): Promise<MilestonesValidationPreviewDto> {
    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const result: MilestonesValidationPreviewDto = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: milestones.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    // Récupérer les jalons existants du projet pour détecter les doublons
    const existingMilestones = await this.prisma.milestone.findMany({
      where: { projectId },
      select: { name: true },
    });
    const existingNames = new Set(
      existingMilestones.map((m) => m.name.toLowerCase()),
    );

    for (let i = 0; i < milestones.length; i++) {
      const milestoneData = milestones[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      const previewItem: MilestonePreviewItemDto = {
        lineNumber: lineNum,
        milestone: milestoneData,
        status: 'valid' as MilestonePreviewStatus,
        messages: [],
      };

      // Vérifier les champs obligatoires
      if (!milestoneData.name || milestoneData.name.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le nom est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!milestoneData.dueDate || milestoneData.dueDate.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push("La date d'échéance est obligatoire");
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier les doublons
      if (existingNames.has(milestoneData.name.toLowerCase())) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(`Un jalon avec ce nom existe déjà`);
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Valider le format de la date
      const dueDate = new Date(milestoneData.dueDate);
      if (isNaN(dueDate.getTime())) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Date d'échéance invalide: ${milestoneData.dueDate}`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Avertissement si la date est dans le passé
      if (dueDate < new Date()) {
        previewItem.status = 'warning';
        previewItem.messages.push("La date d'échéance est dans le passé");
      }

      // Ajouter aux résultats selon le statut
      if (previewItem.status === 'warning') {
        result.warnings.push(previewItem);
        result.summary.warnings++;
      } else {
        previewItem.messages.push('Prêt à être importé');
        result.valid.push(previewItem);
        result.summary.valid++;
      }

      // Ajouter le nom à l'ensemble pour éviter les doublons dans le même fichier
      existingNames.add(milestoneData.name.toLowerCase());
    }

    return result;
  }

  /**
   * Exporter les jalons d'un projet en CSV
   */
  async exportProjectMilestonesCsv(
    projectId: string,
    currentUser?: { id: string },
    meta?: ExportMeta,
  ): Promise<{ csv: string; filename: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    });

    const headers = ['name', 'description', 'dueDate'];
    const rows = milestones.map((m) => [
      m.name,
      m.description || '',
      m.dueDate.toISOString().split('T')[0],
    ]);

    const escapeField = (field: string) => {
      if (field.includes(';') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    };

    const csv = [
      headers.join(';'),
      ...rows.map((row) => row.map(escapeField).join(';')),
    ].join('\n');

    const sanitizedName = project.name.replace(/[^a-zA-Z0-9-_]/g, '_');

    // OBS-026 — RGPD personal-data egress: record who exported which project's
    // milestones and the exact materialized row count. caller-as-actor; a
    // non-HTTP / unidentified caller skips emission.
    if (currentUser) {
      emitDataExported(this.auditPersistence, this.logger, {
        actorId: currentUser.id,
        format: 'csv',
        scope: 'milestones',
        recordCount: milestones.length,
        subject: { projectId },
        meta,
      });
    }

    return { csv, filename: `milestones-export-${sanitizedName}.csv` };
  }

  /**
   * Générer le template CSV pour l'import de jalons
   */
  getImportTemplate(): string {
    const headers = ['name', 'description', 'dueDate'];
    // Template sans données d'exemple - juste les commentaires explicatifs
    const exampleComment = [
      '# Nom du jalon',
      '# Description optionnelle',
      '# YYYY-MM-DD',
    ];
    return headers.join(';') + '\n' + exampleComment.join(';');
  }
}
