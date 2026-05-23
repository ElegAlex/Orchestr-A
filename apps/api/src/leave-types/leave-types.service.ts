import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau type de congé
   */
  async create(createLeaveTypeDto: CreateLeaveTypeDto) {
    // Vérifier que le code n'existe pas déjà
    const existing = await this.prisma.leaveTypeConfig.findUnique({
      where: { code: createLeaveTypeDto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Un type de congé avec le code "${createLeaveTypeDto.code}" existe déjà`,
      );
    }

    const leaveType = await this.prisma.leaveTypeConfig.create({
      data: {
        code: createLeaveTypeDto.code,
        name: createLeaveTypeDto.name,
        description: createLeaveTypeDto.description,
        color: createLeaveTypeDto.color || '#10B981',
        icon: createLeaveTypeDto.icon || '🌴',
        isPaid: createLeaveTypeDto.isPaid ?? true,
        requiresApproval: createLeaveTypeDto.requiresApproval ?? true,
        sortOrder: createLeaveTypeDto.sortOrder || 0,
        isSystem: false, // Les types créés manuellement ne sont jamais système
        isActive: true,
      },
    });

    return leaveType;
  }

  /**
   * Récupérer tous les types de congés
   */
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { leaves: true },
        },
      },
    });

    return leaveTypes;
  }

  /**
   * Récupérer un type de congé par ID
   */
  async findOne(id: string) {
    const leaveType = await this.prisma.leaveTypeConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leaves: true },
        },
      },
    });

    if (!leaveType) {
      throw new NotFoundException('Type de congé introuvable');
    }

    return leaveType;
  }

  /**
   * Récupérer un type de congé par code
   */
  async findByCode(code: string) {
    const leaveType = await this.prisma.leaveTypeConfig.findUnique({
      where: { code },
    });

    if (!leaveType) {
      throw new NotFoundException(
        `Type de congé avec le code "${code}" introuvable`,
      );
    }

    return leaveType;
  }

  /**
   * Mettre à jour un type de congé
   */
  async update(id: string, updateLeaveTypeDto: UpdateLeaveTypeDto) {
    const existing = await this.prisma.leaveTypeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Type de congé introuvable');
    }

    // Les types système ne peuvent pas être modifiés (sauf nom, description, couleur, icône)
    if (existing.isSystem) {
      const allowedFieldsForSystem = [
        'name',
        'description',
        'color',
        'icon',
        'sortOrder',
      ];
      const providedFields = Object.keys(updateLeaveTypeDto);
      const forbiddenFields = providedFields.filter(
        (f) => !allowedFieldsForSystem.includes(f),
      );

      if (forbiddenFields.length > 0) {
        throw new BadRequestException(
          `Les types système ne peuvent pas modifier: ${forbiddenFields.join(', ')}`,
        );
      }
    }

    const leaveType = await this.prisma.leaveTypeConfig.update({
      where: { id },
      data: updateLeaveTypeDto,
    });

    return leaveType;
  }

  /**
   * Supprimer un type de congé
   */
  async remove(id: string) {
    const existing = await this.prisma.leaveTypeConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leaves: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Type de congé introuvable');
    }

    // Les types système ne peuvent pas être supprimés
    if (existing.isSystem) {
      throw new BadRequestException(
        'Les types de congé système ne peuvent pas être supprimés',
      );
    }

    // Si des congés utilisent ce type, on le désactive plutôt que de le supprimer
    if (existing._count.leaves > 0) {
      await this.prisma.leaveTypeConfig.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        message: `Type de congé désactivé (${existing._count.leaves} congé(s) l'utilisent)`,
        deactivated: true,
      };
    }

    // Sinon, suppression définitive
    await this.prisma.leaveTypeConfig.delete({
      where: { id },
    });

    return { message: 'Type de congé supprimé avec succès', deleted: true };
  }

  /**
   * Réordonner les types de congés
   */
  async reorder(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.leaveTypeConfig.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll();
  }
}
