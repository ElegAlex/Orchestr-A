import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import {
  ImportMilestoneDto,
  ImportMilestonesResultDto,
  MilestonesValidationPreviewDto,
  MilestonePreviewItemDto,
  MilestonePreviewStatus,
} from './dto/import-milestones.dto';
import { MilestoneStatus } from 'database';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

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
    limit = 10,
    projectId?: string,
    status?: MilestoneStatus,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.milestone.findMany({
        where,
        skip,
        take: limit,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

  async update(id: string, updateMilestoneDto: UpdateMilestoneDto) {
    await this.findOne(id);
    const { dueDate, ...data } = updateMilestoneDto;

    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...data,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.milestone.delete({ where: { id } });
    return { message: 'Milestone supprimé avec succès' };
  }

  async complete(id: string) {
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

    for (let i = 0; i < milestones.length; i++) {
      const milestoneData = milestones[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      try {
        // Vérifier que le nom n'existe pas déjà dans le projet
        const existingMilestone = await this.prisma.milestone.findFirst({
          where: {
            projectId,
            name: milestoneData.name,
          },
        });

        if (existingMilestone) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Jalon "${milestoneData.name}" existe déjà`,
          );
          continue;
        }

        // Créer le jalon
        await this.prisma.milestone.create({
          data: {
            name: milestoneData.name,
            description: milestoneData.description || null,
            dueDate: new Date(milestoneData.dueDate),
            status: MilestoneStatus.PENDING,
            projectId,
          },
        });

        result.created++;
      } catch (error: any) {
        result.errors++;
        result.errorDetails.push(
          `Ligne ${lineNum}: ${error.message || 'Erreur inconnue'}`,
        );
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
