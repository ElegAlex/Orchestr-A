import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

// COR-034: collapses the TOCTOU race between findFirst pre-check and create/update.
// The pre-check still catches the common case with a friendly message; this maps
// the racing 23505 (DAT-016 departments_name_key) to the same 409.
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau département
   */
  async create(createDepartmentDto: CreateDepartmentDto) {
    const { name, description, managerId } = createDepartmentDto;

    // Vérifier l'unicité du nom
    const existingName = await this.prisma.department.findFirst({
      where: { name },
    });

    if (existingName) {
      throw new ConflictException('Ce nom de département est déjà utilisé');
    }

    try {
      const department = await this.prisma.department.create({
        data: {
          name,
          description,
          managerId,
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              avatarPreset: true,
              role: true,
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

      return department;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ce nom de département est déjà utilisé');
      }
      throw err;
    }
  }

  /**
   * Récupérer tous les départements avec pagination
   */
  async findAll(page = 1, limit = 1000) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        skip,
        take: safeLimit,
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              avatarPreset: true,
              role: true,
            },
          },
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
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
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
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            avatarPreset: true,
            role: true,
          },
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
            avatarPreset: true,
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
                userServices: true,
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

    const { name, description, managerId } = updateDepartmentDto;

    // Vérifier l'unicité du nom si modifié
    if (name && name !== existingDepartment.name) {
      const existingName = await this.prisma.department.findFirst({
        where: { name },
      });

      if (existingName) {
        throw new ConflictException('Ce nom de département est déjà utilisé');
      }
    }

    try {
      const department = await this.prisma.department.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(managerId !== undefined && { managerId }),
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              avatarPreset: true,
              role: true,
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

      return department;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ce nom de département est déjà utilisé');
      }
      throw err;
    }
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
    if (department._count.users > 0 || department._count.services > 0) {
      throw new BadRequestException(
        "Impossible de supprimer un département qui contient des utilisateurs ou services. Veuillez d'abord les réaffecter.",
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
            role: { select: { code: true } },
            isActive: true,
          },
        },
        services: {
          select: {
            id: true,
            userServices: {
              select: {
                user: {
                  select: {
                    id: true,
                  },
                },
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
          const code = user.role?.code ?? 'UNASSIGNED';
          acc[code] = (acc[code] || 0) + 1;
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
