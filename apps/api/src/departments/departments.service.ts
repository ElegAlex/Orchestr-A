import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau département
   */
  async create(createDepartmentDto: CreateDepartmentDto) {
    const { name, description } = createDepartmentDto;

    // Vérifier l'unicité du nom
    const existingName = await this.prisma.department.findFirst({
      where: { name },
    });

    if (existingName) {
      throw new ConflictException('Ce nom de département est déjà utilisé');
    }

    const department = await this.prisma.department.create({
      data: {
        name,
        description,
      },
      include: {
        _count: {
          select: {
            users: true,
            services: true,
          },
        },
      },
    });

    return department;
  }

  /**
   * Récupérer tous les départements avec pagination
   */
  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              users: true,
              services: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.department.count(),
    ]);

    return {
      data: departments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer un département par ID
   */
  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
          where: {
            isActive: true,
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                users: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            services: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Département introuvable');
    }

    return department;
  }

  /**
   * Mettre à jour un département
   */
  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const existingDepartment = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      throw new NotFoundException('Département introuvable');
    }

    const { name, description } = updateDepartmentDto;

    // Vérifier l'unicité du nom si modifié
    if (name && name !== existingDepartment.name) {
      const existingName = await this.prisma.department.findFirst({
        where: { name },
      });

      if (existingName) {
        throw new ConflictException('Ce nom de département est déjà utilisé');
      }
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        _count: {
          select: {
            users: true,
            services: true,
          },
        },
      },
    });

    return department;
  }

  /**
   * Supprimer un département
   */
  async remove(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            services: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Département introuvable');
    }

    // Vérifier qu'il n'y a pas d'utilisateurs ou services liés
    if (
      department._count.users > 0 ||
      department._count.services > 0
    ) {
      throw new BadRequestException(
        'Impossible de supprimer un département qui contient des utilisateurs ou services. Veuillez d\'abord les réaffecter.',
      );
    }

    await this.prisma.department.delete({
      where: { id },
    });

    return { message: 'Département supprimé avec succès' };
  }

  /**
   * Récupérer les statistiques d'un département
   */
  async getDepartmentStats(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            role: true,
            isActive: true,
          },
        },
        services: {
          select: {
            id: true,
            users: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Département introuvable');
    }

    // Calculer les statistiques
    const activeUsers = department.users.filter((u) => u.isActive).length;
    const inactiveUsers = department.users.filter((u) => !u.isActive).length;

    const usersByRole = department.users
      .filter((u) => u.isActive)
      .reduce(
        (acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      departmentId: id,
      departmentName: department.name,
      users: {
        total: department.users.length,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
      },
      services: {
        total: department.services.length,
      },
    };
  }
}
