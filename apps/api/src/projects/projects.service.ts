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
import { ProjectStatus, TaskStatus } from 'database';

/**
 * Rôles qui voient tous les projets sans filtre de membership.
 * CONTRIBUTEUR et OBSERVATEUR sont filtrés par membership.
 */
const FULL_VISIBILITY_ROLES = ['ADMIN', 'RESPONSABLE', 'MANAGER'] as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer un nouveau projet
   * Le créateur est automatiquement ajouté comme membre avec le rôle "Chef de projet"
   */
  async create(createProjectDto: CreateProjectDto, creatorId: string) {
    const { startDate, endDate, ...projectData } = createProjectDto;

    // Vérifier que la date de fin est après la date de début
    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Créer le projet et ajouter le créateur comme membre dans une transaction
    const project = await this.prisma.$transaction(async (tx) => {
      // Créer le projet
      const newProject = await tx.project.create({
        data: {
          ...projectData,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          status: createProjectDto.status || ProjectStatus.DRAFT,
          createdById: creatorId,
          managerId: projectData.managerId || creatorId,
          ...(projectData.sponsorId && { sponsorId: projectData.sponsorId }),
        },
      });

      // Ajouter automatiquement le créateur comme membre du projet
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: creatorId,
          role: 'Chef de projet',
          allocation: 100,
        },
      });

      // Retourner le projet avec toutes les relations
      return tx.project.findUnique({
        where: { id: newProject.id },
        include: {
          manager: {
            select: { id: true, firstName: true, lastName: true },
          },
          sponsor: {
            select: { id: true, firstName: true, lastName: true },
          },
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
    });

    return project;
  }

  /**
   * Récupérer tous les projets avec pagination.
   * - ADMIN, RESPONSABLE, MANAGER : voient TOUS les projets.
   * - REFERENT_TECHNIQUE, CONTRIBUTEUR, OBSERVATEUR (et inconnu) : filtrés par membership.
   */
  async findAll(
    page = 1,
    limit = 1000,
    status?: ProjectStatus,
    userId?: string,
    userRole?: string,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    // Filtre de base sur le statut
    const baseFilter = status ? { status } : {};

    // Les rôles à visibilité totale voient tous les projets.
    // Les autres rôles sont filtrés par membership si un userId est fourni.
    const hasFullVisibility =
      userRole &&
      (FULL_VISIBILITY_ROLES as readonly string[]).includes(userRole);

    const membershipFilter =
      !hasFullVisibility && userId ? { members: { some: { userId } } } : {};

    const where = { ...baseFilter, ...membershipFilter };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              login: true,
            },
          },
          manager: {
            select: { id: true, firstName: true, lastName: true },
          },
          sponsor: {
            select: { id: true, firstName: true, lastName: true },
          },
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
          tasks: {
            select: {
              status: true,
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

    const projectsWithProgress = projects.map(({ tasks, ...project }) => ({
      ...project,
      progress:
        tasks.length > 0
          ? Math.round(
              (tasks.filter((t) => t.status === 'DONE').length / tasks.length) *
                100,
            )
          : 0,
    }));

    return {
      data: projectsWithProgress,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            login: true,
          },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
        sponsor: {
          select: { id: true, firstName: true, lastName: true },
        },
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

    const {
      startDate,
      endDate,
      hiddenStatuses,
      visibleStatuses,
      ...projectData
    } = updateProjectDto;

    // Vérifier les dates si fournies
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Rejeter TODO et DONE dans hiddenStatuses
    if (hiddenStatuses) {
      if (
        hiddenStatuses.includes(TaskStatus.TODO) ||
        hiddenStatuses.includes(TaskStatus.DONE)
      ) {
        throw new BadRequestException(
          'Les statuts TODO et DONE ne peuvent pas être masqués',
        );
      }
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...projectData,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(hiddenStatuses !== undefined && { hiddenStatuses }),
        ...(visibleStatuses !== undefined && { visibleStatuses }),
      },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
        sponsor: {
          select: { id: true, firstName: true, lastName: true },
        },
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
   * Modifier le rôle ou l'allocation d'un membre du projet
   */
  async updateMember(projectId: string, userId: string, dto: { role?: string; allocation?: number; startDate?: string; endDate?: string }) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!member) {
      throw new NotFoundException('Membre introuvable dans ce projet');
    }

    const data: Record<string, unknown> = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.allocation !== undefined) data.allocation = dto.allocation;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);

    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
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

    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
        sponsor: {
          select: { id: true, firstName: true, lastName: true },
        },
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
        tasks: {
          select: {
            status: true,
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

    return projects.map(({ tasks, ...project }) => ({
      ...project,
      progress:
        tasks.length > 0
          ? Math.round(
              (tasks.filter((t) => t.status === 'DONE').length / tasks.length) *
                100,
            )
          : 0,
    }));
  }

  /**
   * Capture un snapshot de progression pour tous les projets actifs
   */
  async captureSnapshots() {
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: { tasks: { select: { status: true } } },
    });

    const snapshots = await Promise.all(
      projects.map(async (project) => {
        const tasksTotal = project.tasks.length;
        const tasksDone = project.tasks.filter((t) => t.status === 'DONE').length;
        const progress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

        return this.prisma.projectSnapshot.create({
          data: {
            projectId: project.id,
            progress,
            tasksDone,
            tasksTotal,
          },
        });
      }),
    );

    return { captured: snapshots.length };
  }

  /**
   * Récupérer les snapshots de progression d'un projet
   */
  async getSnapshots(projectId: string, from?: string, to?: string) {
    const where: any = { projectId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    return this.prisma.projectSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
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
    const blockedTasks = project.tasks.filter(
      (t) => t.status === 'BLOCKED',
    ).length;

    const totalEstimatedHours = project.tasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );

    // Calculer les heures réelles depuis les TimeEntry, en ségrégeant
    // strictement les heures user et les heures tiers. totalActualHours
    // = heures déclarées par des users (jamais mélangé avec des heures
    // tiers), et totalThirdPartyHours est exposé en parallèle.
    const taskIds = project.tasks.map((t) => t.id);
    const [userTimeEntries, thirdPartyTimeEntries] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { taskId: { in: taskIds }, userId: { not: null } },
        select: { hours: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { taskId: { in: taskIds }, thirdPartyId: { not: null } },
        select: { hours: true },
      }),
    ]);
    const totalActualHours = userTimeEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const totalThirdPartyHours = thirdPartyTimeEntries.reduce(
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
        blocked: blockedTasks,
        todo: totalTasks - completedTasks - inProgressTasks - blockedTasks,
      },
      hours: {
        estimated: totalEstimatedHours,
        actual: totalActualHours,
        thirdPartyActual: totalThirdPartyHours,
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
