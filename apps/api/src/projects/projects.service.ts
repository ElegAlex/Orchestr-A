import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { ProjectStatus } from 'database';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau projet
   */
  async create(createProjectDto: CreateProjectDto) {
    const { startDate, endDate, ...projectData } = createProjectDto;

    // Vérifier que la date de fin est après la date de début
    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Créer le projet
    const project = await this.prisma.project.create({
      data: {
        ...projectData,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        status: createProjectDto.status || ProjectStatus.DRAFT,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        epics: {
          select: {
            id: true,
            name: true,
          },
        },
        milestones: {
          select: {
            id: true,
            name: true,
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return project;
  }

  /**
   * Récupérer tous les projets avec pagination
   */
  async findAll(page = 1, limit = 10, status?: ProjectStatus) {
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          members: {
            take: 5,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
              tasks: true,
              epics: true,
              milestones: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer un projet par ID
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        epics: {
          select: {
            id: true,
            name: true,
            description: true,
            progress: true,
          },
        },
        milestones: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            dueDate: true,
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            estimatedHours: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
            epics: true,
            milestones: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    return project;
  }

  /**
   * Mettre à jour un projet
   */
  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundException('Projet introuvable');
    }

    const { startDate, endDate, ...projectData } = updateProjectDto;

    // Vérifier les dates si fournies
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...projectData,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return project;
  }

  /**
   * Supprimer un projet (soft delete)
   */
  async remove(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.CANCELLED },
    });

    return { message: 'Projet annulé avec succès' };
  }

  /**
   * Supprimer définitivement un projet
   */
  async hardDelete(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    await this.prisma.project.delete({
      where: { id },
    });

    return { message: 'Projet supprimé définitivement' };
  }

  /**
   * Ajouter un membre au projet
   */
  async addMember(projectId: string, addMemberDto: AddMemberDto) {
    const { userId, role, allocation, startDate, endDate } = addMemberDto;

    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier que l'utilisateur n'est pas déjà membre
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('Cet utilisateur est déjà membre du projet');
    }

    // Ajouter le membre
    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: role || 'Membre',
        ...(allocation !== undefined && { allocation }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    return member;
  }

  /**
   * Retirer un membre du projet
   */
  async removeMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Membre introuvable dans ce projet');
    }

    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return { message: 'Membre retiré du projet avec succès' };
  }

  /**
   * Récupérer les projets dont un utilisateur est membre
   */
  async getProjectsByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.prisma.project.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Récupérer les statistiques d'un projet
   */
  async getProjectStats(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            estimatedHours: true,
            priority: true,
          },
        },
        members: true,
        epics: {
          select: {
            progress: true,
          },
        },
        milestones: {
          select: {
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    // Calculer les statistiques
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (t) => t.status === 'DONE',
    ).length;
    const inProgressTasks = project.tasks.filter(
      (t) => t.status === 'IN_PROGRESS',
    ).length;

    const totalEstimatedHours = project.tasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );

    // Calculer les heures réelles depuis les TimeEntry
    const taskIds = project.tasks.map((t) => t.id);
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { taskId: { in: taskIds } },
      select: { hours: true },
    });
    const totalActualHours = timeEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );

    const progress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      projectId: id,
      projectName: project.name,
      status: project.status,
      progress,
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        todo: totalTasks - completedTasks - inProgressTasks,
      },
      hours: {
        estimated: totalEstimatedHours,
        actual: totalActualHours,
        remaining: Math.max(0, totalEstimatedHours - totalActualHours),
      },
      team: {
        totalMembers: project.members.length,
      },
      epics: {
        total: project.epics.length,
        completed: project.epics.filter((e) => e.progress === 100).length,
      },
      milestones: {
        total: project.milestones.length,
        completed: project.milestones.filter((m) => m.status === 'COMPLETED')
          .length,
        upcoming: project.milestones.filter(
          (m) =>
            m.status !== 'COMPLETED' &&
            new Date(m.dueDate) > new Date() &&
            new Date(m.dueDate) <
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ).length,
      },
      budget: project.budgetHours
        ? {
            allocatedHours: project.budgetHours,
            actualHours: totalActualHours,
            remainingHours: Math.max(0, project.budgetHours - totalActualHours),
          }
        : null,
    };
  }
}
