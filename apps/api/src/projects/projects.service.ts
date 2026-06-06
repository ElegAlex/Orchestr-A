import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OwnershipService } from '../common/services/ownership.service';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';
import { ProjectStatus, TaskStatus } from 'database';
import { ArchivedFilter, archivedWhere } from './dto/archived-filter.dto';

/**
 * Caller shape accepted by mutation methods for ownership enforcement.
 * Mirrors what JwtStrategy puts on req.user.
 *
 * RBAC V4: `role` can be either a plain string code (from controllers that
 * already extract `user.role?.code`) or the raw Role object (from controllers
 * that pass `AuthenticatedUser` directly).  `assertProjectOwnershipOrBypass`
 * normalises the value before forwarding it to `PermissionsService`.
 */
export interface ProjectMutationUser {
  id: string;
  role?: string | { code: string } | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownershipService: OwnershipService,
    private readonly permissionsService: PermissionsService,
    private readonly accessScope: AccessScopeService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  /**
   * Defense-in-depth ownership enforcement for project mutations.
   * Throws ForbiddenException when the caller is neither a project owner
   * (createdById / managerId / sponsorId / ProjectMember leader role) nor
   * a holder of the `projects:manage_any` bypass permission.
   *
   * Paired with the OwnershipGuard decorator in the controller — duplication
   * is intentional (BUG-04 / BUG-08 SEC-06).
   */
  private async assertProjectOwnershipOrBypass(
    projectId: string,
    user: ProjectMutationUser | undefined,
  ): Promise<void> {
    if (!user || !user.id) {
      throw new ForbiddenException('Project ownership violation');
    }

    const isOwner = await this.ownershipService.isOwner(
      'project',
      projectId,
      user.id,
    );
    if (isOwner) return;

    if (user.role) {
      const roleCode =
        typeof user.role === 'string' ? user.role : user.role.code;
      const permissions =
        await this.permissionsService.getPermissionsForRole(roleCode);
      if (permissions.includes('projects:manage_any')) {
        return;
      }
    }

    throw new ForbiddenException('Project ownership violation');
  }

  /**
   * Créer un nouveau projet
   * Le créateur est automatiquement ajouté comme membre avec le rôle "Chef de projet"
   */
  async create(createProjectDto: CreateProjectDto, creatorId: string) {
    const { startDate, endDate, clientIds, ...projectData } = createProjectDto;

    // Vérifier que la date de fin est après la date de début
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }

    // Si des clients sont demandés, vérifier qu'ils existent et sont actifs
    if (clientIds && clientIds.length > 0) {
      const found = await this.prisma.client.findMany({
        where: { id: { in: clientIds }, isActive: true },
        select: { id: true },
      });
      if (found.length !== clientIds.length) {
        const foundIds = new Set(found.map((c) => c.id));
        const missing = clientIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Clients introuvables ou inactifs : ${missing.join(', ')}`,
        );
      }
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

      // Rattacher les clients si fournis
      if (clientIds && clientIds.length > 0) {
        await tx.projectClient.createMany({
          data: clientIds.map((clientId) => ({
            projectId: newProject.id,
            clientId,
          })),
          skipDuplicates: true,
        });
      }

      // OBS-010 — audit project creation. Emitted INSIDE this default-isolation
      // (READ COMMITTED) tx, passing `tx`, atomic with the create per the
      // archive/unarchive/hard-delete precedent. actor = the creator.
      await this.auditPersistence.log(
        {
          action: AuditAction.PROJECT_CREATED,
          entityType: 'Project',
          entityId: newProject.id,
          actorId: creatorId,
          payload: { projectId: newProject.id, name: newProject.name },
        },
        tx,
      );

      // Retourner le projet avec toutes les relations
      return tx.project.findUnique({
        where: { id: newProject.id },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          sponsor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  avatarPreset: true,
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
          clients: {
            select: {
              client: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    // Aplatir clients pour matcher le shape frontend
    if (project) {
      return {
        ...project,
        clients: project.clients.map((pc) => pc.client),
      };
    }
    return project;
  }

  /**
   * Récupérer tous les projets avec pagination.
   * - ADMIN, RESPONSABLE, MANAGER : voient TOUS les projets.
   * - REFERENT_TECHNIQUE, CONTRIBUTEUR, OBSERVATEUR (et inconnu) : filtrés par membership.
   * - clients (CSV d'UUIDs) : filtre OR — projets ayant au moins un des clients listés.
   */
  async findAll(
    page = 1,
    limit = 20,
    status?: ProjectStatus,
    userId?: string,
    userRole?: string,
    clients?: string,
    archived: ArchivedFilter = ArchivedFilter.ACTIVE,
  ) {
    // PER-017 / SA-PERF-001 — cap at 100 to prevent unbounded full-table scans
    const safeLimit = Math.min(limit || 20, 100);
    const skip = (page - 1) * safeLimit;

    // Filtre de base sur le statut
    const baseFilter = status ? { status } : {};

    // Visibilité totale sur la permission projects:manage_any (post-V4 :
    // plus de hardcode sur les codes de rôles, la règle passe par la
    // permission résolue dynamiquement via template).
    const permissions = userRole
      ? await this.permissionsService.getPermissionsForRole(userRole)
      : [];
    const hasFullVisibility = permissions.includes('projects:manage_any');
    const hasArchivePerm = permissions.includes('projects:archive');

    const membershipFilter =
      !hasFullVisibility && userId ? { members: { some: { userId } } } : {};

    // Filtre clients : parse CSV, valider UUIDs, filtrer OR sur ProjectClient
    let clientsFilter: { clients?: { some: { clientId: { in: string[] } } } } =
      {};
    if (clients) {
      const tokens = clients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (tokens.length > 0) {
        const invalidTokens = tokens.filter((t) => !isUUID(t));
        if (invalidTokens.length > 0) {
          throw new BadRequestException(
            `Valeurs UUID invalides dans le paramètre clients : ${invalidTokens.join(', ')}`,
          );
        }
        clientsFilter = {
          clients: { some: { clientId: { in: tokens } } },
        };
      }
    }

    const where = {
      ...baseFilter,
      ...membershipFilter,
      ...clientsFilter,
      ...archivedWhere(archived),
    };

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
              avatarUrl: true,
              avatarPreset: true,
              login: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          sponsor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          members: {
            take: 5,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  avatarPreset: true,
                  email: true,
                },
              },
            },
          },
          clients: {
            include: {
              client: {
                select: { id: true, name: true },
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

    // PER-005: single groupBy fan-out for all projects on the page — avoids N×tasks rows
    const projectIds = projects.map((p) => p.id);
    const taskGroups =
      projectIds.length > 0
        ? await this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: { projectId: { in: projectIds } },
            _count: { _all: true },
          })
        : [];

    // Build projectId → { done, total } map
    const progressMap = new Map<string, { done: number; total: number }>();
    for (const group of taskGroups) {
      // projectId is nullable in schema but we filtered by projectId:{in:[...]} so it is always set
      const pid = group.projectId;
      if (!pid) continue;
      const entry = progressMap.get(pid) ?? { done: 0, total: 0 };
      entry.total += group._count._all;
      if (group.status === 'DONE') {
        entry.done += group._count._all;
      }
      progressMap.set(pid, entry);
    }

    const projectsWithProgress = projects.map(
      ({ clients: projectClients, ...project }) => {
        const counts = progressMap.get(project.id);
        const progress =
          counts && counts.total > 0
            ? Math.round((counts.done / counts.total) * 100)
            : 0;
        return {
          ...project,
          clients: projectClients.map((pc) => pc.client),
          progress,
          canArchive: hasArchivePerm && project.archivedAt == null,
          canUnarchive: hasArchivePerm && project.archivedAt != null,
        };
      },
    );

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
  async findOne(id: string, currentUser?: AccessUser) {
    if (currentUser) {
      await this.accessScope.assertCanAccessProject(id, currentUser);
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
            login: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        sponsor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        archivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
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
                avatarPreset: true,
              },
            },
          },
        },
        clients: {
          include: {
            client: {
              select: { id: true, name: true },
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

    // Compute canArchive / canUnarchive: skip lookup when no user to avoid
    // unnecessary DB queries (and keep existing no-user tests passing).
    let canArchive = false;
    let canUnarchive = false;
    if (currentUser) {
      const roleCode =
        typeof currentUser.role === 'string'
          ? currentUser.role
          : (currentUser.role?.code ?? null);
      const perms =
        await this.permissionsService.getPermissionsForRole(roleCode);
      const hasArchivePerm = perms.includes('projects:archive');
      canArchive = hasArchivePerm && project.archivedAt == null;
      canUnarchive = hasArchivePerm && project.archivedAt != null;
    }

    const { clients: projectClients, ...rest } = project;
    return {
      ...rest,
      clients: projectClients.map((pc) => pc.client),
      canArchive,
      canUnarchive,
    };
  }

  /**
   * Mettre à jour un projet
   */
  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    user?: ProjectMutationUser,
  ) {
    // Defense-in-depth: enforce ownership even if guard is bypassed.
    if (user) {
      await this.assertProjectOwnershipOrBypass(id, user);
    }

    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundException('Projet introuvable');
    }

    // COR-016 — reject all mutations on CANCELLED projects; revival must go
    // through a dedicated restore/unarchive path, not a plain PATCH.
    if (existingProject.status === ProjectStatus.CANCELLED) {
      throw new ConflictException(
        'Ce projet est annulé. Utilisez le point de restauration dédié pour le réactiver.',
      );
    }

    const {
      startDate,
      endDate,
      hiddenStatuses,
      visibleStatuses,
      clientIds,
      ...projectData
    } = updateProjectDto;

    // COR-024 — validate partial date changes against existing dates.
    // When only one date is provided, compare against the persisted counterpart.
    const effectiveStart = startDate
      ? new Date(startDate)
      : existingProject.startDate;
    const effectiveEnd = endDate ? new Date(endDate) : existingProject.endDate;
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
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

    // Si clientIds fourni, valider existence + activité avant l'update
    if (clientIds !== undefined && clientIds.length > 0) {
      const found = await this.prisma.client.findMany({
        where: { id: { in: clientIds }, isActive: true },
        select: { id: true },
      });
      if (found.length !== clientIds.length) {
        const foundIds = new Set(found.map((c) => c.id));
        const missing = clientIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Clients introuvables ou inactifs : ${missing.join(', ')}`,
        );
      }
    }

    // COR-018 — wrap project.update + projectClient sync in a single
    // $transaction when clientIds is provided so a createMany failure cannot
    // leave the project with no clients while the response signals success.
    // When clientIds is undefined (no client change requested) the plain update
    // path is preserved to avoid any regression on the unrelated code paths.
    if (clientIds !== undefined) {
      const project = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.project.update({
          where: { id },
          data: {
            ...projectData,
            ...(startDate && { startDate: new Date(startDate) }),
            ...(endDate && { endDate: new Date(endDate) }),
            ...(hiddenStatuses !== undefined && { hiddenStatuses }),
            ...(visibleStatuses !== undefined && { visibleStatuses }),
          },
        });

        // Sync clients: full replace. `[]` = detach all.
        await tx.projectClient.deleteMany({ where: { projectId: id } });
        if (clientIds.length > 0) {
          await tx.projectClient.createMany({
            data: clientIds.map((clientId) => ({ projectId: id, clientId })),
            skipDuplicates: true,
          });
        }

        // OBS-010 — before/after audit row, emitted INSIDE the COR-018 tx.
        await this.auditPersistence.log(
          {
            action: AuditAction.PROJECT_UPDATED,
            entityType: 'Project',
            entityId: id,
            actorId: user?.id ?? null,
            payload: { before: existingProject, after: updated },
          },
          tx,
        );

        return updated;
      });

      return project;
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
    });

    // OBS-010 — before/after audit row (non-client-change path, no surrounding tx).
    await this.auditPersistence.log({
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'Project',
      entityId: id,
      actorId: user?.id ?? null,
      payload: { before: existingProject, after: project },
    });

    return project;
  }

  /**
   * Supprimer un projet (soft delete)
   */
  async remove(id: string, user?: ProjectMutationUser) {
    // Defense-in-depth: enforce ownership even if guard is bypassed.
    if (user) {
      await this.assertProjectOwnershipOrBypass(id, user);
    }

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

    // OBS-010 — the soft-delete (status→CANCELLED) is the dominant project
    // removal path and was unaudited; record it with the prior status.
    await this.auditPersistence.log({
      action: AuditAction.PROJECT_CANCELLED,
      entityType: 'Project',
      entityId: id,
      actorId: user?.id ?? null,
      payload: { projectId: id, previousStatus: project.status },
    });

    return { message: 'Projet annulé avec succès' };
  }

  /**
   * Archiver un projet (orthogonal au statut — ne modifie pas ProjectStatus).
   */
  async archive(id: string, user: ProjectMutationUser) {
    await this.assertProjectOwnershipOrBypass(id, user);

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }
    if (project.archivedAt) {
      throw new ConflictException('Projet déjà archivé');
    }

    // DAT-006 — wrap update + audit in a single transaction so an audit failure
    // rolls back the project mutation (atomicity guarantee).
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id },
        data: { archivedAt: new Date(), archivedById: user.id },
      });
      await this.auditPersistence.log(
        {
          action: AuditAction.PROJECT_ARCHIVED,
          entityType: 'Project',
          entityId: id,
          actorId: user.id,
          payload: { archivedAt: result.archivedAt },
        },
        tx,
      );
      return result;
    });

    return updated;
  }

  /**
   * Désarchiver un projet.
   */
  async unarchive(id: string, user: ProjectMutationUser) {
    await this.assertProjectOwnershipOrBypass(id, user);

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }
    if (!project.archivedAt) {
      throw new ConflictException("Projet n'est pas archivé");
    }

    // DAT-006 — wrap update + audit in a single transaction so an audit failure
    // rolls back the project mutation (atomicity guarantee).
    const previousArchivedAt = project.archivedAt;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id },
        data: { archivedAt: null, archivedById: null },
      });
      await this.auditPersistence.log(
        {
          action: AuditAction.PROJECT_UNARCHIVED,
          entityType: 'Project',
          entityId: id,
          actorId: user.id,
          payload: { previousArchivedAt },
        },
        tx,
      );
      return result;
    });

    return updated;
  }

  /**
   * Vérifie les dépendances qui bloquent une suppression définitive (DAT-007).
   *
   * Single source of truth for the hard-delete dependency list. Mirrors
   * `UsersService.checkDependencies`. The four counted relations are exactly the
   * FK edges promoted to ON DELETE RESTRICT in migration
   * 20260525200000_dat007_project_fk_restrict_preserve_history — so this
   * pre-check and the DB constraints block on the same set, and a blocking
   * Project surfaces as a typed ConflictException instead of a raw P2003.
   */
  async checkProjectDependencies(id: string): Promise<{
    projectId: string;
    canDelete: boolean;
    dependencies: { type: string; count: number; description: string }[];
  }> {
    const [tasks, snapshots, documents, timeEntries] = await Promise.all([
      this.prisma.task.count({ where: { projectId: id } }),
      this.prisma.projectSnapshot.count({ where: { projectId: id } }),
      this.prisma.document.count({ where: { projectId: id } }),
      this.prisma.timeEntry.count({ where: { projectId: id } }),
    ]);

    const dependencies: { type: string; count: number; description: string }[] =
      [];
    if (tasks > 0) {
      dependencies.push({
        type: 'TASKS',
        count: tasks,
        description: `${tasks} tâche(s) rattachée(s)`,
      });
    }
    if (snapshots > 0) {
      dependencies.push({
        type: 'SNAPSHOTS',
        count: snapshots,
        description: `${snapshots} instantané(s) de progression`,
      });
    }
    if (documents > 0) {
      dependencies.push({
        type: 'DOCUMENTS',
        count: documents,
        description: `${documents} document(s)`,
      });
    }
    if (timeEntries > 0) {
      dependencies.push({
        type: 'TIME_ENTRIES',
        count: timeEntries,
        description: `${timeEntries} saisie(s) de temps`,
      });
    }

    return {
      projectId: id,
      canDelete: dependencies.length === 0,
      dependencies,
    };
  }

  /**
   * Supprimer définitivement un projet (DAT-007).
   *
   * Refuse the delete if any history-bearing dependent exists (the RESTRICT FKs
   * would raise P2003 anyway — checkProjectDependencies turns that into a clean
   * ConflictException recommending archive). Before erasing the row, persist a
   * PROJECT_DELETED audit entry with a column snapshot of the project, so the
   * lifecycle event survives in the immutable audit trail (d6299cc chain).
   */
  async hardDelete(id: string, user: ProjectMutationUser) {
    // SEC-017 — defense-in-depth ownership enforcement, mirrors remove() / archive().
    await this.assertProjectOwnershipOrBypass(id, user);

    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const { canDelete, dependencies } = await this.checkProjectDependencies(id);
    if (!canDelete) {
      throw new ConflictException({
        message:
          'Impossible de supprimer définitivement ce projet : des données historiques y sont rattachées. Archivez-le plutôt.',
        dependencies,
      });
    }

    // COR-025 — capture snapshot BEFORE erasure but emit audit AFTER the delete
    // succeeds, so a delete failure leaves no spurious PROJECT_DELETED audit row.
    const snapshot = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      budgetHours: project.budgetHours,
      createdById: project.createdById,
      managerId: project.managerId,
      sponsorId: project.sponsorId,
      archivedAt: project.archivedAt,
      archivedById: project.archivedById,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    await this.prisma.project.delete({
      where: { id },
    });

    // Audit emitted AFTER successful delete — snapshot was captured above before
    // the row was erased so the lifecycle event survives in the immutable trail.
    await this.auditPersistence.log({
      action: AuditAction.PROJECT_DELETED,
      entityType: 'Project',
      entityId: id,
      actorId: user.id,
      payload: { snapshot },
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
            avatarPreset: true,
          },
        },
      },
    });

    return member;
  }

  /**
   * Modifier le rôle ou l'allocation d'un membre du projet
   */
  async updateMember(
    projectId: string,
    userId: string,
    dto: {
      role?: string;
      allocation?: number;
      startDate?: string;
      endDate?: string;
    },
    user?: ProjectMutationUser,
  ) {
    // Defense-in-depth: enforce ownership even if guard is bypassed.
    if (user) {
      await this.assertProjectOwnershipOrBypass(projectId, user);
    }

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
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Retirer un membre du projet
   */
  async removeMember(
    projectId: string,
    userId: string,
    user?: ProjectMutationUser,
  ) {
    // Defense-in-depth: enforce ownership even if guard is bypassed.
    if (user) {
      await this.assertProjectOwnershipOrBypass(projectId, user);
    }

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
  async getProjectsByUser(
    userId: string,
    currentUser?: AccessUser,
    archived: ArchivedFilter = ArchivedFilter.ACTIVE,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const where: any = {
      members: {
        some: {
          userId,
        },
      },
      ...archivedWhere(archived),
    };
    if (
      currentUser &&
      !(await this.accessScope.hasAny(currentUser, ['projects:manage_any']))
    ) {
      where.AND = [this.accessScope.projectAccessWhere(currentUser)];
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        sponsor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        members: {
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                avatarPreset: true,
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

    // PER-015 — single groupBy fan-out, same pattern as findAll (PER-005).
    // Avoids fetching all task rows for each project.
    const projectIds = projects.map((p) => p.id);
    const taskGroups =
      projectIds.length > 0
        ? await this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: { projectId: { in: projectIds } },
            _count: { _all: true },
          })
        : [];

    const progressMap = new Map<string, { done: number; total: number }>();
    for (const group of taskGroups) {
      const pid = group.projectId;
      if (!pid) continue;
      const entry = progressMap.get(pid) ?? { done: 0, total: 0 };
      entry.total += group._count._all;
      if (group.status === 'DONE') {
        entry.done += group._count._all;
      }
      progressMap.set(pid, entry);
    }

    return projects.map((project) => {
      const counts = progressMap.get(project.id);
      const progress =
        counts && counts.total > 0
          ? Math.round((counts.done / counts.total) * 100)
          : 0;
      return { ...project, progress };
    });
  }

  /**
   * Capture un snapshot de progression pour tous les projets actifs.
   * PER-003: batched — 2 DB queries regardless of project count.
   *   1. findMany: fetch project IDs that already have a snapshot today.
   *   2. createMany (skipDuplicates): insert only new snapshots.
   * The @@unique([projectId, date]) constraint (COR-014) is the DB-level race guard.
   */
  async captureSnapshots() {
    const projects = await this.prisma.project.findMany({
      where: { status: ProjectStatus.ACTIVE },
      include: {
        tasks: { select: { status: true } },
        milestones: { select: { status: true, dueDate: true } },
      },
    });

    if (projects.length === 0) {
      return { captured: 0 };
    }

    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Batch-fetch existing snapshots for today (1 query)
    const existingToday = await this.prisma.projectSnapshot.findMany({
      where: {
        projectId: { in: projects.map((p) => p.id) },
        date: startOfDay,
      },
      select: { projectId: true },
    });
    const alreadySnapshotted = new Set(existingToday.map((s) => s.projectId));

    // Build payload for projects that don't yet have today's snapshot
    const snapshotData = projects
      .filter((project) => !alreadySnapshotted.has(project.id))
      .map((project) => {
        const tasksTotal = project.tasks.length;
        const tasksDone = project.tasks.filter(
          (t) => t.status === 'DONE',
        ).length;
        const tasksInProgress = project.tasks.filter(
          (t) => t.status === 'IN_PROGRESS',
        ).length;
        const tasksBlocked = project.tasks.filter(
          (t) => t.status === 'BLOCKED',
        ).length;
        const progress =
          tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

        const milestonesReached = project.milestones.filter(
          (m) => m.status === 'COMPLETED',
        ).length;
        const milestonesOverdue = project.milestones.filter(
          (m) =>
            m.status !== 'COMPLETED' && m.dueDate != null && m.dueDate < now,
        ).length;
        const milestonesUpcoming = project.milestones.filter(
          (m) =>
            m.status !== 'COMPLETED' && m.dueDate != null && m.dueDate >= now,
        ).length;

        return {
          projectId: project.id,
          date: startOfDay,
          progress,
          tasksDone,
          tasksTotal,
          tasksInProgress,
          tasksBlocked,
          milestonesReached,
          milestonesOverdue,
          milestonesUpcoming,
        };
      });

    if (snapshotData.length === 0) {
      return { captured: 0 };
    }

    // Single batched insert — skipDuplicates guards against concurrent-tick races (COR-014)
    const { count } = await this.prisma.projectSnapshot.createMany({
      data: snapshotData,
      skipDuplicates: true,
    });

    return { captured: count };
  }

  /**
   * Récupérer les snapshots de progression d'un projet
   */
  async getSnapshots(
    projectId: string,
    from?: string,
    to?: string,
    currentUser?: AccessUser,
  ) {
    if (currentUser) {
      await this.accessScope.assertCanAccessProject(projectId, currentUser, [
        'projects:manage_any',
        'reports:view',
      ]);
    }

    // SEC-016 — reject invalid date strings before passing to new Date().
    if (from && isNaN(new Date(from).getTime())) {
      throw new BadRequestException(
        `Paramètre 'from' invalide : valeur de date attendue (ex: 2025-01-01)`,
      );
    }
    if (to && isNaN(new Date(to).getTime())) {
      throw new BadRequestException(
        `Paramètre 'to' invalide : valeur de date attendue (ex: 2025-12-31)`,
      );
    }

    const where: any = { projectId };

    // SA-PERF-017 — apply a default 90-day look-back window when no range is
    // given to avoid returning the full snapshot history of long-lived projects.
    // Also cap the result set to 365 rows.
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    } else {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 90);
      where.date = { gte: defaultFrom };
    }

    return this.prisma.projectSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
      take: 365,
    });
  }

  /**
   * Récupérer les statistiques d'un projet
   */
  async getProjectStats(id: string, currentUser?: AccessUser) {
    if (currentUser) {
      await this.accessScope.assertCanAccessProject(id, currentUser);
    }

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
        // PER-016 — use _count.members instead of fetching all member rows;
        // totalMembers is read from _count.members below.
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
        _count: {
          select: { members: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    // Capture a single consistent reference time for the upcoming-milestone
    // window so that both bounds of the filter are evaluated atomically.
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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
      (sum, t) => sum + Number(t.estimatedHours ?? 0),
      0,
    );

    // SA-PERF-018 — replace 2×findMany with 2×aggregate: one DB round-trip each
    // instead of fetching all hour rows into JS for a reduce. Semantics preserved:
    // userTE = isDismissal:false + userId:not-null; thirdPartyTE = isDismissal:false + thirdPartyId:not-null.
    const taskIds = project.tasks.map((t) => t.id);
    const [userAgg, thirdPartyAgg] = await Promise.all([
      this.prisma.timeEntry.aggregate({
        where: {
          taskId: { in: taskIds },
          userId: { not: null },
          isDismissal: false,
        },
        _sum: { hours: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          taskId: { in: taskIds },
          thirdPartyId: { not: null },
          isDismissal: false,
        },
        _sum: { hours: true },
      }),
    ]);
    const totalActualHours = Number(userAgg._sum.hours ?? 0);
    const totalThirdPartyHours = Number(thirdPartyAgg._sum.hours ?? 0);

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
        totalMembers: project._count.members,
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
            new Date(m.dueDate) > now &&
            new Date(m.dueDate) < sevenDaysLater,
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
