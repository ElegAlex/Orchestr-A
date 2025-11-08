import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { AssignRACIDto } from './dto/assign-raci.dto';
import { TaskStatus } from 'database';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle tâche
   */
  async create(createTaskDto: CreateTaskDto) {
    const {
      projectId,
      epicId,
      milestoneId,
      assigneeId,
      startDate,
      dueDate,
      ...taskData
    } = createTaskDto;

    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    // Vérifier l'epic si fourni
    if (epicId) {
      const epic = await this.prisma.epic.findUnique({
        where: { id: epicId },
      });

      if (!epic) {
        throw new NotFoundException('Epic introuvable');
      }

      if (epic.projectId !== projectId) {
        throw new BadRequestException(
          'L\'epic n\'appartient pas au même projet',
        );
      }
    }

    // Vérifier le milestone si fourni
    if (milestoneId) {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
      });

      if (!milestone) {
        throw new NotFoundException('Milestone introuvable');
      }

      if (milestone.projectId !== projectId) {
        throw new BadRequestException(
          'Le milestone n\'appartient pas au même projet',
        );
      }
    }

    // Vérifier l'utilisateur assigné si fourni
    if (assigneeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });

      if (!user) {
        throw new NotFoundException('Utilisateur assigné introuvable');
      }
    }

    // Vérifier les dates si fournies
    if (
      startDate &&
      dueDate &&
      new Date(dueDate) <= new Date(startDate)
    ) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Créer la tâche
    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        projectId,
        epicId,
        milestoneId,
        assigneeId,
        status: createTaskDto.status || TaskStatus.TODO,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
          },
        },
        milestone: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return task;
  }

  /**
   * Récupérer toutes les tâches avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 10,
    status?: TaskStatus,
    projectId?: string,
    assigneeId?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              dependencies: true,
              dependents: true,
              raci: true,
              comments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer une tâche par ID avec tous les détails
   */
  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        milestone: {
          select: {
            id: true,
            name: true,
            dueDate: true,
            status: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        dependencies: {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        raci: {
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
          },
        },
        timeEntries: {
          select: {
            id: true,
            hours: true,
            date: true,
            description: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    return task;
  }

  /**
   * Mettre à jour une tâche
   */
  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new NotFoundException('Tâche introuvable');
    }

    const {
      projectId,
      epicId,
      milestoneId,
      assigneeId,
      startDate,
      dueDate,
      ...taskData
    } = updateTaskDto;

    // Vérifications similaires à create si les champs sont fournis
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }
    }

    if (epicId) {
      const epic = await this.prisma.epic.findUnique({
        where: { id: epicId },
      });
      if (!epic) {
        throw new NotFoundException('Epic introuvable');
      }
    }

    if (milestoneId) {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone introuvable');
      }
    }

    if (assigneeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!user) {
        throw new NotFoundException('Utilisateur assigné introuvable');
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...taskData,
        ...(projectId && { projectId }),
        ...(epicId && { epicId }),
        ...(milestoneId && { milestoneId }),
        ...(assigneeId && { assigneeId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return task;
  }

  /**
   * Supprimer une tâche
   */
  async remove(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        dependents: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    // Vérifier qu'aucune autre tâche ne dépend de celle-ci
    if (task.dependents.length > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une tâche dont d\'autres tâches dépendent',
      );
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Tâche supprimée avec succès' };
  }

  /**
   * Ajouter une dépendance à une tâche
   */
  async addDependency(taskId: string, addDependencyDto: AddDependencyDto) {
    const { dependsOnId: dependsOnTaskId } = addDependencyDto;

    // Vérifier que les deux tâches existent
    const [task, dependsOnTask] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: taskId } }),
      this.prisma.task.findUnique({ where: { id: dependsOnTaskId } }),
    ]);

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    if (!dependsOnTask) {
      throw new NotFoundException('Tâche dépendante introuvable');
    }

    // Vérifier qu'elles appartiennent au même projet
    if (task.projectId !== dependsOnTask.projectId) {
      throw new BadRequestException(
        'Les tâches doivent appartenir au même projet',
      );
    }

    // Vérifier qu'on ne crée pas une dépendance circulaire
    const hasCircularDependency = await this.checkCircularDependency(
      dependsOnTaskId,
      taskId,
    );

    if (hasCircularDependency) {
      throw new BadRequestException(
        'Cette dépendance créerait une dépendance circulaire',
      );
    }

    // Vérifier que la dépendance n'existe pas déjà
    const existingDependency = await this.prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId,
        },
      },
    });

    if (existingDependency) {
      throw new ConflictException('Cette dépendance existe déjà');
    }

    // Créer la dépendance
    const dependency = await this.prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnTaskId,
      },
      include: {
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return dependency;
  }

  /**
   * Retirer une dépendance
   */
  async removeDependency(taskId: string, dependsOnTaskId: string) {
    const dependency = await this.prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId,
        },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Dépendance introuvable');
    }

    await this.prisma.taskDependency.delete({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId,
        },
      },
    });

    return { message: 'Dépendance supprimée avec succès' };
  }

  /**
   * Assigner un rôle RACI à un utilisateur pour une tâche
   */
  async assignRACI(taskId: string, assignRACIDto: AssignRACIDto) {
    const { userId, role } = assignRACIDto;

    // Vérifier que la tâche existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier si l'utilisateur a déjà un rôle RACI pour cette tâche
    const existingAssignment = await this.prisma.taskRACI.findUnique({
      where: {
        taskId_userId_role: {
          taskId,
          userId,
          role,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        'Cet utilisateur a déjà ce rôle RACI pour cette tâche',
      );
    }

    // Créer l'assignation RACI
    const raciAssignment = await this.prisma.taskRACI.create({
      data: {
        taskId,
        userId,
        role,
      },
      select: {
        id: true,
        taskId: true,
        userId: true,
        role: true,
        createdAt: true,
      },
    });

    return raciAssignment;
  }

  /**
   * Retirer une assignation RACI
   */
  async removeRACI(taskId: string, userId: string, role: string) {
    const assignment = await this.prisma.taskRACI.findUnique({
      where: {
        taskId_userId_role: {
          taskId,
          userId,
          role: role as any,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignation RACI introuvable');
    }

    await this.prisma.taskRACI.delete({
      where: {
        taskId_userId_role: {
          taskId,
          userId,
          role: role as any,
        },
      },
    });

    return { message: 'Assignation RACI supprimée avec succès' };
  }

  /**
   * Récupérer les tâches d'un projet
   */
  async getTasksByProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            dependencies: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Vérifier les dépendances circulaires
   */
  private async checkCircularDependency(
    startTaskId: string,
    targetTaskId: string,
  ): Promise<boolean> {
    // Récupérer toutes les dépendances de startTask de manière récursive
    const visited = new Set<string>();
    const queue = [startTaskId];

    while (queue.length > 0) {
      const currentTaskId = queue.shift()!;

      if (visited.has(currentTaskId)) {
        continue;
      }

      visited.add(currentTaskId);

      if (currentTaskId === targetTaskId) {
        return true; // Dépendance circulaire détectée
      }

      const dependencies = await this.prisma.taskDependency.findMany({
        where: { taskId: currentTaskId },
        select: { dependsOnTaskId: true },
      });

      queue.push(...dependencies.map((d) => d.dependsOnTaskId));
    }

    return false;
  }
}
