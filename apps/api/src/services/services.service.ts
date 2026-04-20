import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau service
   */
  async create(createServiceDto: CreateServiceDto) {
    const { name, description, departmentId, managerId, color } =
      createServiceDto;

    // Vérifier que le département existe
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Département introuvable');
    }

    // Vérifier l'unicité du nom dans le département
    const existingName = await this.prisma.service.findFirst({
      where: {
        name,
        departmentId,
      },
    });

    if (existingName) {
      throw new ConflictException(
        'Ce nom de service est déjà utilisé dans ce département',
      );
    }

    const service = await this.prisma.service.create({
      data: {
        name,
        description,
        departmentId,
        managerId,
        color,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            userServices: true,
          },
        },
      },
    });

    return service;
  }

  /**
   * Récupérer tous les services avec pagination
   */
  async findAll(page = 1, limit = 1000, departmentId?: string) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where = departmentId ? { departmentId } : {};

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              userServices: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data: services,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Récupérer un service par ID
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        userServices: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatarUrl: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            userServices: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service introuvable');
    }

    return service;
  }

  /**
   * Mettre à jour un service
   */
  async update(id: string, updateServiceDto: UpdateServiceDto) {
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new NotFoundException('Service introuvable');
    }

    const { name, description, departmentId, managerId, color } =
      updateServiceDto;

    // Vérifier le département si modifié
    if (departmentId && departmentId !== existingService.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        throw new NotFoundException('Département introuvable');
      }
    }

    // Vérifier l'unicité du nom dans le département si modifié
    if (name && name !== existingService.name) {
      const targetDepartmentId = departmentId || existingService.departmentId;

      const existingName = await this.prisma.service.findFirst({
        where: {
          name,
          departmentId: targetDepartmentId,
          NOT: {
            id,
          },
        },
      });

      if (existingName) {
        throw new ConflictException(
          'Ce nom de service est déjà utilisé dans ce département',
        );
      }
    }

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(departmentId && { departmentId }),
        ...(managerId !== undefined && { managerId }),
        ...(color !== undefined && { color }),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            userServices: true,
          },
        },
      },
    });

    return service;
  }

  /**
   * Supprimer un service
   */
  async remove(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userServices: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service introuvable');
    }

    // Détacher les utilisateurs liés avant suppression
    if (service._count.userServices > 0) {
      await this.prisma.userService.deleteMany({
        where: { serviceId: id },
      });
    }

    // Retirer le manager du service
    if (service.managerId) {
      await this.prisma.service.update({
        where: { id },
        data: { managerId: null },
      });
    }

    await this.prisma.service.delete({
      where: { id },
    });

    return { message: 'Service supprimé avec succès' };
  }

  /**
   * Récupérer les services d'un département
   */
  async getServicesByDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Département introuvable');
    }

    return this.prisma.service.findMany({
      where: { departmentId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            userServices: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Récupérer les statistiques d'un service
   */
  async getServiceStats(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        userServices: {
          select: {
            user: {
              select: {
                role: { select: { code: true } },
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service introuvable');
    }

    // Calculer les statistiques
    const users = service.userServices.map((us) => us.user);
    const activeUsers = users.filter((u) => u.isActive).length;
    const inactiveUsers = users.filter((u) => !u.isActive).length;

    const usersByRole = users
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
      serviceId: id,
      serviceName: service.name,
      department: {
        id: service.department.id,
        name: service.department.name,
      },
      users: {
        total: users.length,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
      },
    };
  }
}
