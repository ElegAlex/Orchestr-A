import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { AssignRACIDto } from './dto/assign-raci.dto';
import {
  ImportTaskDto,
  ImportTasksResultDto,
  TasksValidationPreviewDto,
  TaskPreviewItemDto,
  TaskPreviewStatus,
} from './dto/import-tasks.dto';
import { TaskStatus, Priority, RACIRole, Role } from 'database';
import { Prisma } from 'database';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle tâche
   * Le projectId est optionnel pour permettre les tâches orphelines (réunions, tâches transverses)
   */
  async create(
    createTaskDto: CreateTaskDto,
    user: { id: string; role: Role },
  ) {
    const {
      projectId,
      epicId,
      milestoneId,
      assigneeId,
      assigneeIds,
      startDate,
      endDate,
      ...taskData
    } = createTaskDto;

    // Vérification des permissions en fonction du rôle
    if (user.role === Role.CONTRIBUTEUR && projectId) {
      throw new ForbiddenException(
        'Les contributeurs ne peuvent créer que des tâches hors projet',
      );
    }

    // Vérifier que le projet existe si fourni
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }

      // Vérifier le membership pour REFERENT_TECHNIQUE et CHEF_DE_PROJET
      if (
        user.role === Role.REFERENT_TECHNIQUE ||
        user.role === Role.CHEF_DE_PROJET
      ) {
        const membership = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId: user.id,
            },
          },
        });

        if (!membership) {
          throw new ForbiddenException(
            'Vous devez être membre du projet pour créer des tâches',
          );
        }
      }
    }

    // Validation : epicId et milestoneId requièrent un projectId
    if ((epicId || milestoneId) && !projectId) {
      throw new BadRequestException(
        'Une tâche doit être liée à un projet pour être associée à une épopée ou un jalon',
      );
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
        throw new BadRequestException("L'epic n'appartient pas au même projet");
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
          "Le milestone n'appartient pas au même projet",
        );
      }
    }

    // Vérifier l'utilisateur assigné principal si fourni
    if (assigneeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });

      if (!user) {
        throw new NotFoundException('Utilisateur assigné introuvable');
      }
    }

    // Vérifier les utilisateurs assignés multiples si fournis
    if (assigneeIds && assigneeIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true },
      });

      if (users.length !== assigneeIds.length) {
        throw new NotFoundException(
          'Un ou plusieurs utilisateurs assignés introuvables',
        );
      }
    }

    // Vérifier les dates si fournies (dates égales autorisées pour les tâches d'une journée)
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin ne peut pas être antérieure à la date de début',
      );
    }

    // Créer la tâche (projectId peut être null pour les tâches orphelines)
    // Si assigneeIds est fourni, on utilise le premier comme assigneeId principal (rétrocompatibilité)
    const primaryAssigneeId =
      assigneeId ||
      (assigneeIds && assigneeIds.length > 0 ? assigneeIds[0] : null);

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        projectId: projectId || null,
        epicId,
        milestoneId,
        assigneeId: primaryAssigneeId,
        status: createTaskDto.status || TaskStatus.TODO,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        // Créer les assignations multiples
        ...(assigneeIds &&
          assigneeIds.length > 0 && {
            assignees: {
              create: assigneeIds.map((userId) => ({ userId })),
            },
          }),
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
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
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
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {};
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;

    // Filtrage par plage de dates : on récupère les tâches qui chevauchent la plage
    // Une tâche chevauche si : startDate <= finPlage ET endDate >= débutPlage
    const hasDateFilter = startDate || endDate;
    if (startDate && endDate) {
      // Tâches dont la plage [startDate, endDate] chevauche [startDate, endDate] du filtre
      where.AND = [
        {
          endDate: { gte: new Date(startDate) }, // La tâche finit après le début de la plage
        },
        {
          OR: [
            { startDate: { lte: new Date(endDate) } }, // La tâche commence avant la fin de la plage
            { startDate: null }, // Ou pas de startDate (on utilise endDate comme seul jour)
          ],
        },
      ];
    } else if (startDate) {
      where.endDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.OR = [
        { startDate: { lte: new Date(endDate) } },
        { startDate: null, endDate: { lte: new Date(endDate) } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        // Pas de pagination si filtre par date (pour le planning)
        ...(hasDateFilter ? {} : { skip, take: limit }),
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
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
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
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
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
      assigneeIds,
      startDate,
      endDate,
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

    // Vérifier les utilisateurs assignés multiples si fournis
    if (assigneeIds && assigneeIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true },
      });

      if (users.length !== assigneeIds.length) {
        throw new NotFoundException(
          'Un ou plusieurs utilisateurs assignés introuvables',
        );
      }
    }

    // Déterminer l'assigné principal
    // Si assigneeIds est fourni avec des valeurs, on utilise le premier comme assigneeId principal
    // Vérifier que assigneeIds est EXPLICITEMENT présent dans le DTO original
    const hasAssigneeIds =
      'assigneeIds' in updateTaskDto &&
      Array.isArray(assigneeIds) &&
      assigneeIds.length > 0;
    let primaryAssigneeId: string | undefined = assigneeId;
    if (hasAssigneeIds) {
      primaryAssigneeId = assigneeIds[0];
    }

    // Mise à jour de la tâche avec transaction pour gérer les assignations multiples
    const task = await this.prisma.$transaction(async (tx) => {
      // Si assigneeIds est EXPLICITEMENT fourni dans le body avec des valeurs non-vides,
      // mettre à jour les assignations. Sinon, on ne touche pas aux assignations existantes.
      if (hasAssigneeIds) {
        // Supprimer toutes les anciennes assignations
        await tx.taskAssignee.deleteMany({
          where: { taskId: id },
        });

        // Créer les nouvelles assignations
        await tx.taskAssignee.createMany({
          data: assigneeIds.map((userId) => ({ taskId: id, userId })),
        });
      }

      // Mettre à jour la tâche
      return tx.task.update({
        where: { id },
        data: {
          ...taskData,
          ...(projectId && { projectId }),
          ...(epicId && { epicId }),
          ...(milestoneId && { milestoneId }),
          ...(primaryAssigneeId !== undefined && {
            assigneeId: primaryAssigneeId,
          }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
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
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
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
        "Impossible de supprimer une tâche dont d'autres tâches dépendent",
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
  async removeRACI(taskId: string, userId: string, role: RACIRole) {
    const assignment = await this.prisma.taskRACI.findUnique({
      where: {
        taskId_userId_role: {
          taskId,
          userId,
          role,
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
          role,
        },
      },
    });

    return { message: 'Assignation RACI supprimée avec succès' };
  }

  /**
   * Récupérer toutes les tâches assignées à un utilisateur
   * (soit en tant qu'assigné principal, soit dans la liste des assignés multiples)
   */
  async getTasksByAssignee(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [{ assigneeId: userId }, { assignees: { some: { userId } } }],
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
            avatarUrl: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
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
    });

    return tasks;
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
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
          },
        },
        dependencies: {
          select: {
            id: true,
            dependsOnTaskId: true,
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                status: true,
                endDate: true,
              },
            },
          },
        },
        _count: {
          select: {
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

  /**
   * Importer des tâches en masse pour un projet
   */
  async importTasks(
    projectId: string,
    tasks: ImportTaskDto[],
  ): Promise<ImportTasksResultDto> {
    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const result: ImportTasksResultDto = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Récupérer les jalons du projet pour la résolution par nom
    const projectMilestones = await this.prisma.milestone.findMany({
      where: { projectId },
    });
    const milestonesByName = new Map(
      projectMilestones.map((m) => [m.name.toLowerCase(), m.id]),
    );

    // Récupérer tous les utilisateurs pour la résolution par email
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(
      users.map((u) => [u.email.toLowerCase(), u.id]),
    );

    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      try {
        // Vérifier que le titre n'existe pas déjà dans le projet
        const existingTask = await this.prisma.task.findFirst({
          where: {
            projectId,
            title: taskData.title,
          },
        });

        if (existingTask) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Tâche "${taskData.title}" existe déjà`,
          );
          continue;
        }

        // Résoudre l'assignee par email
        let assigneeId: string | undefined;
        if (taskData.assigneeEmail) {
          assigneeId = usersByEmail.get(taskData.assigneeEmail.toLowerCase());
          if (!assigneeId) {
            result.errors++;
            result.errorDetails.push(
              `Ligne ${lineNum}: Utilisateur "${taskData.assigneeEmail}" introuvable`,
            );
            continue;
          }
        }

        // Résoudre le milestone par nom
        let milestoneId: string | undefined;
        if (taskData.milestoneName) {
          milestoneId = milestonesByName.get(
            taskData.milestoneName.toLowerCase(),
          );
          if (!milestoneId) {
            result.errors++;
            result.errorDetails.push(
              `Ligne ${lineNum}: Jalon "${taskData.milestoneName}" introuvable`,
            );
            continue;
          }
        }

        // Parser le statut
        let status: TaskStatus = TaskStatus.TODO;
        if (taskData.status) {
          const statusUpper = taskData.status.toUpperCase();
          if (Object.values(TaskStatus).includes(statusUpper as TaskStatus)) {
            status = statusUpper as TaskStatus;
          }
        }

        // Parser la priorité
        let priority: Priority = Priority.NORMAL;
        if (taskData.priority) {
          const priorityUpper = taskData.priority.toUpperCase();
          if (Object.values(Priority).includes(priorityUpper as Priority)) {
            priority = priorityUpper as Priority;
          }
        }

        // Créer la tâche
        await this.prisma.task.create({
          data: {
            title: taskData.title,
            description: taskData.description || null,
            status,
            priority,
            projectId,
            assigneeId: assigneeId || null,
            milestoneId: milestoneId || null,
            estimatedHours: taskData.estimatedHours || null,
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            endDate: taskData.endDate ? new Date(taskData.endDate) : null,
          },
        });

        result.created++;
      } catch (err) {
        result.errors++;
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        result.errorDetails.push(`Ligne ${lineNum}: ${errorMessage}`);
      }
    }

    return result;
  }

  /**
   * Valider les tâches avant import (dry-run)
   */
  async validateImport(
    projectId: string,
    tasks: ImportTaskDto[],
  ): Promise<TasksValidationPreviewDto> {
    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const result: TasksValidationPreviewDto = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: tasks.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    // Récupérer les jalons du projet pour la résolution par nom
    const projectMilestones = await this.prisma.milestone.findMany({
      where: { projectId },
    });
    const milestonesByName = new Map(
      projectMilestones.map((m) => [
        m.name.toLowerCase(),
        { id: m.id, name: m.name },
      ]),
    );

    // Récupérer tous les utilisateurs pour la résolution par email
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(
      users.map((u) => [
        u.email.toLowerCase(),
        { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` },
      ]),
    );

    // Récupérer les tâches existantes du projet pour détecter les doublons
    const existingTasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { title: true },
    });
    const existingTitles = new Set(
      existingTasks.map((t) => t.title.toLowerCase()),
    );

    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      const previewItem: TaskPreviewItemDto = {
        lineNumber: lineNum,
        task: taskData,
        status: 'valid' as TaskPreviewStatus,
        messages: [],
      };

      // Vérifier les champs obligatoires
      if (!taskData.title || taskData.title.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le titre est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier les doublons
      if (existingTitles.has(taskData.title.toLowerCase())) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(`Une tâche avec ce titre existe déjà`);
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Résoudre l'assignee par email
      if (taskData.assigneeEmail) {
        const resolvedUser = usersByEmail.get(
          taskData.assigneeEmail.toLowerCase(),
        );
        if (!resolvedUser) {
          previewItem.status = 'error';
          previewItem.messages.push(
            `Utilisateur "${taskData.assigneeEmail}" introuvable`,
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
        previewItem.resolvedAssignee = resolvedUser;
      }

      // Résoudre le milestone par nom
      if (taskData.milestoneName) {
        const resolvedMilestone = milestonesByName.get(
          taskData.milestoneName.toLowerCase(),
        );
        if (!resolvedMilestone) {
          previewItem.status = 'error';
          previewItem.messages.push(
            `Jalon "${taskData.milestoneName}" introuvable`,
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
        previewItem.resolvedMilestone = resolvedMilestone;
      }

      // Valider le statut si fourni
      if (taskData.status) {
        const statusUpper = taskData.status.toUpperCase();
        if (!Object.values(TaskStatus).includes(statusUpper as TaskStatus)) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            `Statut "${taskData.status}" non reconnu, "TODO" sera utilisé`,
          );
        }
      }

      // Valider la priorité si fournie
      if (taskData.priority) {
        const priorityUpper = taskData.priority.toUpperCase();
        if (!Object.values(Priority).includes(priorityUpper as Priority)) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            `Priorité "${taskData.priority}" non reconnue, "NORMAL" sera utilisée`,
          );
        }
      }

      // Valider les dates
      if (taskData.startDate && taskData.endDate) {
        const start = new Date(taskData.startDate);
        const end = new Date(taskData.endDate);
        if (isNaN(start.getTime())) {
          previewItem.status = 'error';
          previewItem.messages.push(
            `Date de début invalide: ${taskData.startDate}`,
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
        if (isNaN(end.getTime())) {
          previewItem.status = 'error';
          previewItem.messages.push(
            `Date de fin invalide: ${taskData.endDate}`,
          );
          result.errors.push(previewItem);
          result.summary.errors++;
          continue;
        }
        if (end <= start) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            'La date de fin est antérieure ou égale à la date de début',
          );
        }
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

      // Ajouter le titre à l'ensemble pour éviter les doublons dans le même fichier
      existingTitles.add(taskData.title.toLowerCase());
    }

    return result;
  }

  /**
   * Générer le template CSV pour l'import de tâches
   */
  getImportTemplate(): string {
    const headers = [
      'title',
      'description',
      'status',
      'priority',
      'assigneeEmail',
      'milestoneName',
      'estimatedHours',
      'startDate',
      'endDate',
    ];
    // Template vide - pas de données d'exemple avec faux emails
    const exampleComment = [
      '# Exemple: Titre de ma tâche',
      '# Description optionnelle',
      '# TODO|IN_PROGRESS|IN_REVIEW|DONE',
      '# LOW|NORMAL|HIGH|CRITICAL',
      '# email@existant.com',
      '# Nom jalon existant',
      '# 8',
      '# 2025-01-15',
      '# 2025-01-20',
    ];
    return headers.join(';') + '\n' + exampleComment.join(';');
  }

  /**
   * Récupérer uniquement les tâches orphelines (sans projet)
   */
  async findOrphans() {
    return this.prisma.task.findMany({
      where: {
        projectId: null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            dependencies: true,
            dependents: true,
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
   * Rattache une tâche orpheline à un projet
   */
  async attachToProject(taskId: string, projectId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { projectId },
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
  }

  /**
   * Détache une tâche de son projet (la rend orpheline)
   */
  async detachFromProject(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    // Retirer également l'épopée et le jalon
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        projectId: null,
        epicId: null,
        milestoneId: null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
