import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { UpsertLeaveBalanceDto } from './dto/upsert-leave-balance.dto';
import { LeaveStatus, LeaveType, Prisma } from 'database';
import {
  ROLE_TEMPLATES,
  type PermissionCode,
  type RoleTemplateKey,
} from 'rbac';
import { AuditService, AuditAction } from '../audit/audit.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { HolidaysService } from '../holidays/holidays.service';
import {
  calculateLeaveDays,
  parisDayKey,
  parisYearWindow,
  splitLeaveByYear,
  type DayKey,
} from './leave-year-window';

/**
 * Permission bypass donnant un accès complet aux congés sans restriction
 * de périmètre. Assignée à ADMIN et RESPONSABLE via le seed RBAC.
 */
const MANAGE_ANY_LEAVES = 'leaves:manage_any';
const APPROVE_LEAVES = 'leaves:approve';
const DELETE_LEAVES = 'leaves:delete';
const MANAGE_DELEGATIONS = 'leaves:manage_delegations';

/**
 * OBS-003 — caller context threaded from the controller for the audit actor
 * snapshot. `roleCode` / `templateKey` come from the JWT-loaded `req.user.role`
 * (no DB hit); `ip` / `ua` from `extractMeta(req)`. All optional so legacy
 * callers (and the no-op / backward-compat paths) still compile — a caller
 * that omits this degrades the actor detail, it never blocks the mutation.
 */
export interface LeaveActorMeta {
  roleCode?: string | null;
  templateKey?: string | null;
  ip?: string;
  ua?: string;
}

/**
 * OBS-003 — structured actor snapshot persisted in the audit payload so an
 * auditor can answer "who approved leave X, with which role/permissions AT THE
 * TIME". `permissions` is the RBAC compile-time resolution (the same source the
 * `RequirePermissions` guard consumes: `PermissionsService.getPermissionsForRole`)
 * captured at emit time, because `templateKey → permissions` can change between
 * deploys with no DB trace.
 */
interface LeaveActorSnapshot {
  id: string;
  roleCode: string | null;
  templateKey: string | null;
  permissions: readonly PermissionCode[];
}

@Injectable()
export class LeavesService {
  /**
   * Vérifier si un rôle a une permission donnée (via cache Redis + DB).
   */
  private async roleHasPermission(
    role: string | undefined,
    permissionCode: string,
  ): Promise<boolean> {
    if (!role) return false;
    const permissions = (await this.permissionsService.getPermissionsForRole(
      role,
    )) as readonly string[];
    return permissions.includes(permissionCode);
  }

  /**
   * Vérifier si le user courant peut gérer (edit/delete/approve) le congé
   * d'un autre user. Basé sur les permissions dynamiques :
   *  - `leaves:manage_any` → accès total (pas de restriction de périmètre)
   *  - `leaves:delete` ou `leaves:approve` → accès limité au périmètre services
   */
  private async canManageLeave(
    leaveUserId: string,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<boolean> {
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    if (permissions.includes(MANAGE_ANY_LEAVES)) {
      return true;
    }
    if (
      !permissions.includes(DELETE_LEAVES) &&
      !permissions.includes(APPROVE_LEAVES)
    ) {
      return false;
    }

    const managedUserIds = await this.getManagedUserIds(
      currentUserId,
      currentUserRole,
    );
    return managedUserIds === 'all' || managedUserIds.has(leaveUserId);
  }

  /**
   * Récupérer les IDs des utilisateurs dans le périmètre du user courant.
   *  - Permission `leaves:manage_any` → 'all' (aucune restriction)
   *  - Sinon : services managés (managerId) + appartenance (user_services)
   *
   * Historiquement, 'all' était retourné si le user n'avait aucun service,
   * ce qui posait problème pour un ADMIN inscrit dans des services : son
   * périmètre devenait restreint au lieu de rester global. Corrigé via la
   * permission `leaves:manage_any`.
   */
  private async getManagedUserIds(
    currentUserId: string,
    currentUserRole?: string,
  ): Promise<Set<string> | 'all'> {
    if (
      currentUserRole &&
      (await this.roleHasPermission(currentUserRole, MANAGE_ANY_LEAVES))
    ) {
      return 'all';
    }

    const managedServices = await this.prisma.service.findMany({
      where: { managerId: currentUserId },
      select: { id: true },
    });
    const userServices = await this.prisma.userService.findMany({
      where: { userId: currentUserId },
      select: { serviceId: true },
    });

    const serviceIds = [
      ...new Set([
        ...managedServices.map((s) => s.id),
        ...userServices.map((us) => us.serviceId),
      ]),
    ];

    if (serviceIds.length === 0) return new Set<string>();

    const usersInServices = await this.prisma.userService.findMany({
      where: { serviceId: { in: serviceIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return new Set(usersInServices.map((us) => us.userId));
  }

  /**
   * Lister les codes des rôles qui possèdent une permission donnée.
   * Utilisé pour construire des requêtes utilisateurs par périmètre RBAC
   * sans référencer de rôles en dur.
   */
  private async getRoleCodesWithPermission(
    permissionCode: PermissionCode | string,
  ): Promise<string[]> {
    // Identifier les templateKeys qui incluent la permission demandée
    // (source de vérité : ROLE_TEMPLATES in-memory du package `rbac`).
    const matchingTemplateKeys: RoleTemplateKey[] = [];
    for (const [key, tpl] of Object.entries(ROLE_TEMPLATES)) {
      if ((tpl.permissions as readonly string[]).includes(permissionCode)) {
        matchingTemplateKeys.push(key as RoleTemplateKey);
      }
    }
    if (matchingTemplateKeys.length === 0) return [];
    const roles = await this.prisma.role.findMany({
      where: { templateKey: { in: matchingTemplateKeys } },
      select: { code: true },
    });
    return roles.map((r) => r.code);
  }

  /**
   * Enrichir les congés avec canEdit/canDelete calculés selon :
   * - les permissions dynamiques du rôle (leaves:delete, leaves:approve)
   * - le périmètre services du user courant
   */
  private async enrichLeavesWithPermissions(
    leaves: any[],
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    if (!currentUserId || !currentUserRole) {
      return leaves.map((l) => ({ ...l, canEdit: false, canDelete: false }));
    }

    // Permissions dynamiques depuis le RBAC
    const permissions =
      await this.permissionsService.getPermissionsForRole(currentUserRole);
    const hasDeletePerm = permissions.includes('leaves:delete');
    const hasApprovePerm = permissions.includes('leaves:approve');

    // Si pas de permission de gestion, seul l'ownership compte
    if (!hasDeletePerm && !hasApprovePerm) {
      return leaves.map((leave) => {
        const isOwner = leave.userId === currentUserId;
        return {
          ...leave,
          canEdit: isOwner && leave.status === LeaveStatus.PENDING,
          canDelete:
            isOwner &&
            (leave.status === LeaveStatus.PENDING ||
              leave.status === LeaveStatus.REJECTED),
        };
      });
    }

    // Périmètre basé sur les services
    const managedUserIds = await this.getManagedUserIds(currentUserId);

    return leaves.map((leave) => {
      const isOwner = leave.userId === currentUserId;
      const isInPerimeter =
        managedUserIds === 'all' || managedUserIds.has(leave.userId);

      const canEdit =
        (isOwner && leave.status === LeaveStatus.PENDING) ||
        (hasDeletePerm &&
          isInPerimeter &&
          (leave.status === LeaveStatus.PENDING ||
            leave.status === LeaveStatus.APPROVED));

      const canDelete =
        (isOwner &&
          (leave.status === LeaveStatus.PENDING ||
            leave.status === LeaveStatus.REJECTED)) ||
        (hasDeletePerm &&
          isInPerimeter &&
          (leave.status === LeaveStatus.PENDING ||
            leave.status === LeaveStatus.REJECTED ||
            leave.status === LeaveStatus.APPROVED ||
            leave.status === LeaveStatus.CANCELLATION_REQUESTED));

      return { ...leave, canEdit, canDelete };
    });
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
    private readonly auditPersistence: AuditPersistenceService,
    private readonly holidaysService: HolidaysService,
  ) {}

  /**
   * COR-003 — Build the set of non-working public-holiday Paris day keys that
   * intersect `[start, end]`, so the day-counting helpers can exclude them
   * from charged leave days. Holidays are reference data (not transactional),
   * so this read deliberately uses the default Prisma connection even when the
   * balance gate runs inside a transaction. The fetch window is widened by one
   * day on each side to absorb host-TZ edge cases; extra holidays in the set
   * are harmless because the cursor only probes keys within `[start, end]`.
   * Holidays flagged `isWorkDay` (e.g. a worked bank holiday) are excluded.
   */
  private async getHolidayKeySet(
    start: Date,
    end: Date,
  ): Promise<Set<DayKey>> {
    const from = new Date(start);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(end);
    to.setUTCDate(to.getUTCDate() + 1);
    const holidays = await this.holidaysService.findByRange(
      from.toISOString(),
      to.toISOString(),
    );
    return new Set(
      holidays
        .filter((h) => !h.isWorkDay)
        .map((h) => parisDayKey(h.date)),
    );
  }

  /**
   * Créer une nouvelle demande de congé
   */
  async create(
    requestingUserId: string,
    createLeaveDto: CreateLeaveDto,
    requestingUserRole?: string,
  ) {
    const {
      leaveTypeId,
      type,
      startDate,
      endDate,
      halfDay,
      startHalfDay,
      endHalfDay,
      reason,
      targetUserId,
    } = createLeaveDto;
    const effectiveHalfDay = halfDay || startHalfDay;

    // Determine which user we are creating the leave for
    let userId = requestingUserId;
    let declaredByManager = false;

    if (targetUserId && targetUserId !== requestingUserId) {
      // Check permission leaves:declare_for_others via role permissions in DB
      const canDeclareForOthers = await this.roleHasPermission(
        requestingUserRole,
        'leaves:declare_for_others',
      );

      if (!canDeclareForOthers) {
        throw new ForbiddenException(
          "Vous n'avez pas la permission de déclarer un congé pour un autre collaborateur",
        );
      }

      // Sans permission leaves:manage_any, on restreint au périmètre services
      const hasManageAny = await this.roleHasPermission(
        requestingUserRole,
        MANAGE_ANY_LEAVES,
      );
      if (!hasManageAny) {
        // Verify target user exists and is active
        const targetUser = await this.prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, isActive: true },
        });

        if (!targetUser || !targetUser.isActive) {
          throw new NotFoundException(
            'Collaborateur cible introuvable ou inactif',
          );
        }

        // Find services where requesting user is member or manager
        const userServices = await this.prisma.userService.findMany({
          where: { userId: requestingUserId },
          select: { serviceId: true },
        });

        const managedServices = await this.prisma.service.findMany({
          where: { managerId: requestingUserId },
          select: { id: true },
        });

        const serviceIds = [
          ...userServices.map((us) => us.serviceId),
          ...managedServices.map((s) => s.id),
        ];

        if (serviceIds.length === 0) {
          throw new ForbiddenException(
            'Vous ne pouvez déclarer des congés que pour des collaborateurs de vos services',
          );
        }

        // Check if target user belongs to any of those services
        const targetInServices = await this.prisma.userService.findFirst({
          where: {
            userId: targetUserId,
            serviceId: { in: serviceIds },
          },
        });

        if (!targetInServices) {
          throw new ForbiddenException(
            'Vous ne pouvez déclarer des congés que pour des collaborateurs de vos services',
          );
        }
      }

      userId = targetUserId;
      declaredByManager = true;
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier que le type de congé existe et est actif
    const leaveTypeConfig = await this.prisma.leaveTypeConfig.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveTypeConfig) {
      throw new NotFoundException('Type de congé introuvable');
    }

    if (!leaveTypeConfig.isActive) {
      throw new BadRequestException("Ce type de congé n'est plus disponible");
    }

    // Vérifier que la date de fin est après la date de début
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }

    // COR-003 — jours fériés non travaillés à soustraire du décompte (et de
    // la gate de solde plus bas). Référentiel statique, lu hors transaction.
    const holidayKeys = await this.getHolidayKeySet(start, end);

    // Calculer le nombre de jours
    const days = calculateLeaveDays(
      start,
      end,
      effectiveHalfDay,
      endHalfDay,
      holidayKeys,
    );

    // Vérifier les chevauchements
    const hasOverlap = await this.checkOverlap(userId, start, end);

    if (hasOverlap) {
      throw new ConflictException(
        'Cette demande chevauche une demande de congé existante',
      );
    }

    // Auto-validation : un utilisateur ayant `leaves:self_approve` qui crée
    // un congé pour lui-même obtient directement APPROVED. La voie
    // "déclaration pour autrui" (declaredByManager) garde sa logique propre.
    const isForSelf = !declaredByManager;
    const canSelfApprove =
      isForSelf &&
      (await this.roleHasPermission(requestingUserRole, 'leaves:self_approve'));

    // Trouver le validateur approprié.
    //   - Auto-validation : l'utilisateur EST son propre validateur.
    //   - Déclaration par un manager (finding #12) : le manager EST le
    //     validateur de fait — la requête `SELECT "validatorId" FROM leaves`
    //     répond "qui a approuvé ?" dans tous les cas.
    //   - Sinon, lookup du validateur habituel (manager du département ou
    //     délégué actif).
    const requiresValidator =
      leaveTypeConfig.requiresApproval && !declaredByManager && !canSelfApprove;
    let validatorId: string | null = null;
    if (requiresValidator) {
      validatorId = await this.findValidatorForUser(userId);
    } else if (canSelfApprove || declaredByManager) {
      validatorId = requestingUserId;
    }

    // Statut initial : APPROVED si déclaré pour autrui par manager, si type
    // sans approbation requise, ou si auto-validation autorisée.
    const initialStatus =
      declaredByManager || !leaveTypeConfig.requiresApproval || canSelfApprove
        ? LeaveStatus.APPROVED
        : LeaveStatus.PENDING;

    // Finding #8 — `type` (enum) est dérivé exclusivement de
    // `leaveTypeConfig.code` côté serveur. Le champ DTO `type` est
    // marqué déprécié et délibérément IGNORÉ ici : sans ça, un appelant
    // pouvait poster `leaveTypeId='cp-uuid'` ET `type='RTT'`, le serveur
    // écrivait les deux tels quels, et la table contenait un row
    // `{ leaveTypeId → CP config, type: 'RTT' }`. Les dashboards qui
    // pivotent sur l'un voyaient CP, ceux qui pivotaient sur l'autre
    // voyaient RTT. La dérivation côté serveur ferme cette porte.
    // (DTO.type sera retiré à la prochaine release majeure.)
    const validEnumTypes = Object.values(LeaveType);
    const enumType = validEnumTypes.includes(leaveTypeConfig.code as LeaveType)
      ? (leaveTypeConfig.code as LeaveType)
      : LeaveType.OTHER;

    // Vérifier le solde par année calendaire Paris : un congé qui chevauche
    // 2026 et 2027 doit être validé contre chaque allocation séparément. Si
    // une année donnée n'a pas d'allocation configurée, elle est traitée
    // comme illimitée pour cette année (gate ignorée). Si toutes les années
    // sont sans allocation, aucune borne n'est appliquée.
    const yearBuckets = splitLeaveByYear(
      start,
      end,
      effectiveHalfDay,
      endHalfDay,
      holidayKeys,
    );

    // Finding #4 — la gate (hasConfiguredBalance + getAvailableDays) et la
    // création doivent partager une même connexion : sinon un admin qui
    // supprime/modifie une LeaveBalance entre les deux lectures renvoie un
    // "Solde insuffisant" trompeur, et la création prend effet contre un
    // état différent de celui validé. Isolation par défaut (ReadCommitted)
    // suffit ici uniquement parce qu'on RE-LIT chaque allocation juste
    // avant l'insert et qu'on abort en ConflictException si elle a bougé.
    // Une isolation Serializable serait plus stricte mais introduit des
    // retries non maîtrisés sur un endpoint très sollicité.
    const leave = await this.prisma.$transaction(async (tx) => {
      const allocationSnapshots = new Map<number, number>();
      for (const bucket of yearBuckets) {
        const hasBalance = await this.hasConfiguredBalance(
          userId,
          leaveTypeId,
          bucket.year,
          tx,
        );
        if (!hasBalance) continue;
        const allocated = await this.resolveAllocatedDays(
          userId,
          leaveTypeId,
          bucket.year,
          tx,
        );
        allocationSnapshots.set(bucket.year, allocated);
        const available = await this.getAvailableDays(
          userId,
          leaveTypeId,
          bucket.year,
          {},
          tx,
        );
        if (available < bucket.workDays) {
          const shortfall = bucket.workDays - available;
          throw new BadRequestException(
            `Solde insuffisant pour ${leaveTypeConfig.name} en ${bucket.year} : ` +
              `${bucket.workDays} jours demandés, ${available} jours disponibles, ` +
              `il manque ${shortfall} jours.`,
          );
        }
      }

      // Re-lecture : si une allocation captée pendant la gate a bougé
      // (delete, update concurrent), on refuse la demande au lieu de
      // l'écrire contre une réalité différente.
      for (const [year, snapshot] of allocationSnapshots) {
        const current = await this.resolveAllocatedDays(
          userId,
          leaveTypeId,
          year,
          tx,
        );
        if (current !== snapshot) {
          throw new ConflictException(
            `Le solde de ${leaveTypeConfig.name} pour ${year} a été modifié ` +
              `pendant le traitement. Veuillez réessayer.`,
          );
        }
      }

      // Finding #12 — pour qu'un auditeur lisant la table puisse répondre à
      // "qui a transformé ce PENDING en APPROVED ?", on remplit aussi les
      // colonnes validatedById/validatedAt quand un manager déclare un
      // congé pour autrui (`declaredByManager`). Sans ça, ces rows étaient
      // APPROVED avec validatorId/validatedById/At tous null — exactement
      // le même angle mort que celui de finding #6, juste sur un autre
      // chemin de code. `selfApproved` reste false (ce n'est pas
      // l'utilisateur qui s'auto-valide).
      const validatedByActor = canSelfApprove || declaredByManager;

      return tx.leave.create({
        data: {
          userId,
          leaveTypeId,
          type: enumType,
          startDate: start,
          endDate: end,
          halfDay: effectiveHalfDay || undefined,
          days,
          comment: reason,
          status: initialStatus,
          validatorId,
          validatedById: validatedByActor ? requestingUserId : null,
          validatedAt: validatedByActor ? new Date() : null,
          selfApproved: canSelfApprove,
        },
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
          leaveType: true,
          validator: {
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
    });

    // Trace d'audit séparée pour les auto-validations (finding #6). La
    // colonne `selfApproved` rend la distinction lisible dans la table,
    // l'entrée d'audit la rend visible dans le flux de logs sécurité.
    if (canSelfApprove) {
      this.auditService.log({
        action: AuditAction.LEAVE_APPROVED,
        userId: requestingUserId,
        targetId: leave.id,
        details: `Auto-validation par ${requestingUserId} (selfApproved=true)`,
        success: true,
      });
    }

    return leave;
  }

  /**
   * Trouver le validateur approprié pour un utilisateur
   */
  private async findValidatorForUser(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          include: {
            manager: true,
          },
        },
      },
    });

    if (!user) return null;

    // Chercher d'abord un délégué actif créé par un rôle autorisé à déléguer
    const today = new Date();
    const delegatorRoles =
      await this.getRoleCodesWithPermission(MANAGE_DELEGATIONS);
    const activeDelegate = await this.prisma.leaveValidationDelegate.findFirst({
      where: {
        ...(delegatorRoles.length > 0 && {
          delegator: { role: { code: { in: delegatorRoles } } },
        }),
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        delegate: true,
      },
    });

    if (activeDelegate) {
      return activeDelegate.delegateId;
    }

    // Sinon, utiliser le manager du département
    if (user.department?.managerId) {
      return user.department.managerId;
    }

    // En dernier recours, chercher un user avec accès complet aux congés
    const fallbackRoles =
      await this.getRoleCodesWithPermission(MANAGE_ANY_LEAVES);
    if (fallbackRoles.length === 0) return null;
    const validator = await this.prisma.user.findFirst({
      where: {
        role: { code: { in: fallbackRoles } },
        isActive: true,
        id: { not: userId }, // Ne pas s'auto-valider
      },
    });

    return validator?.id || null;
  }

  /**
   * Récupérer toutes les demandes de congé avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 1000,
    userId?: string,
    status?: LeaveStatus,
    type?: LeaveType,
    startDate?: string,
    endDate?: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    // Lecture globale : vérifier la permission dynamique leaves:readAll
    if (currentUserRole) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole);
      if (!permissions.includes('leaves:readAll')) {
        userId = currentUserId;
      }
    }
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.LeaveWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;

    // Filtrer par plage de dates (congés qui chevauchent la période demandée)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Un congé chevauche la période si: leave.startDate <= endDate ET leave.endDate >= startDate
      where.AND = [{ startDate: { lte: end } }, { endDate: { gte: start } }];
    } else if (startDate) {
      where.endDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.startDate = { lte: new Date(endDate) };
    }

    const [leaves, total] = await Promise.all([
      this.prisma.leave.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          leaveType: true,
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          validatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      }),
      this.prisma.leave.count({ where }),
    ]);

    // Calculer canEdit/canDelete pour chaque congé
    const enrichedLeaves = await this.enrichLeavesWithPermissions(
      leaves,
      currentUserId,
      currentUserRole,
    );

    // Si on filtre par dates, retourner directement un tableau pour la compatibilité avec le planning
    if (startDate || endDate) {
      return enrichedLeaves;
    }

    return {
      data: enrichedLeaves,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Récupérer les demandes de congé en attente de validation pour un validateur
   */
  async getPendingForValidator(validatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: validatorId },
      include: { role: { select: { code: true } } },
    });

    if (!user) {
      return [];
    }

    const permissions = await this.permissionsService.getPermissionsForRole(
      user.role?.code ?? null,
    );
    const hasManageAny = permissions.includes(MANAGE_ANY_LEAVES);
    const hasApprove = permissions.includes(APPROVE_LEAVES);

    // Accès global → toutes les demandes en attente
    if (hasManageAny) {
      return this.prisma.leave.findMany({
        where: {
          status: {
            in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          leaveType: true,
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    // Permission d'approbation → périmètre services
    if (hasApprove) {
      // 1. Find services the user belongs to via user_services
      const userServices = await this.prisma.userService.findMany({
        where: { userId: validatorId },
        select: { serviceId: true },
      });

      // 2. Find services where user is manager
      const managedServices = await this.prisma.service.findMany({
        where: { managerId: validatorId },
        select: { id: true },
      });

      // Combine service IDs
      const serviceIds = [
        ...userServices.map((us) => us.serviceId),
        ...managedServices.map((s) => s.id),
      ];

      // If no services, return empty array
      if (serviceIds.length === 0) {
        return [];
      }

      // 3. Find all users in those services
      const usersInServices = await this.prisma.userService.findMany({
        where: {
          serviceId: { in: serviceIds },
        },
        select: { userId: true },
      });

      const userIds = usersInServices.map((us) => us.userId);

      // 4. Query pending leaves for those users
      return this.prisma.leave.findMany({
        where: {
          status: {
            in: [LeaveStatus.PENDING, LeaveStatus.CANCELLATION_REQUESTED],
          },
          userId: { in: userIds },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          leaveType: true,
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    // Other roles → empty list
    return [];
  }

  /**
   * Récupérer les collaborateurs sous la responsabilité d'un manager/responsable
   * Utilise la même logique de périmètre que getPendingForValidator
   */
  async getSubordinates(managerId: string, managerRole: string | null) {
    const permissions =
      await this.permissionsService.getPermissionsForRole(managerRole);
    const hasManageAny = permissions.includes(MANAGE_ANY_LEAVES);
    const hasApprove = permissions.includes(APPROVE_LEAVES);

    // Accès global → tous les users actifs
    if (hasManageAny) {
      return this.prisma.user.findMany({
        where: { isActive: true, id: { not: managerId } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          avatarPreset: true,
          login: true,
          email: true,
        },
        orderBy: { lastName: 'asc' },
      });
    }

    // Permission d'approbation → users du même périmètre services
    if (hasApprove) {
      const userServices = await this.prisma.userService.findMany({
        where: { userId: managerId },
        select: { serviceId: true },
      });

      const managedServices = await this.prisma.service.findMany({
        where: { managerId },
        select: { id: true },
      });

      const serviceIds = [
        ...userServices.map((us) => us.serviceId),
        ...managedServices.map((s) => s.id),
      ];

      if (serviceIds.length === 0) {
        return [];
      }

      const usersInServices = await this.prisma.userService.findMany({
        where: {
          serviceId: { in: serviceIds },
          userId: { not: managerId },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const userIds = usersInServices.map((us) => us.userId);

      return this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          avatarPreset: true,
          login: true,
          email: true,
        },
        orderBy: { lastName: 'asc' },
      });
    }

    return [];
  }

  /**
   * Récupérer les demandes de congé d'un utilisateur
   */
  async getUserLeaves(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const leaves = await this.prisma.leave.findMany({
      where: { userId },
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
        leaveType: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Own leaves: canEdit/canDelete based on ownership rules
    return leaves.map((leave) => ({
      ...leave,
      canEdit: leave.status === LeaveStatus.PENDING,
      canDelete:
        leave.status === LeaveStatus.PENDING ||
        leave.status === LeaveStatus.REJECTED,
    }));
  }

  /**
   * Récupérer une demande de congé par ID
   */
  async findOne(id: string, currentUserId?: string, currentUserRole?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
            email: true,
            role: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            userServices: {
              select: {
                service: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        leaveType: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
            email: true,
          },
        },
        validatedBy: {
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

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // Ownership check : seuls le propriétaire et les rôles avec périmètre
    // leaves:manage_any / leaves:approve / leaves:delete + scope peuvent lire.
    if (currentUserRole && leave.userId !== currentUserId) {
      const canManage =
        currentUserId && currentUserRole
          ? await this.canManageLeave(
              leave.userId,
              currentUserId,
              currentUserRole,
            )
          : false;
      if (!canManage) {
        throw new ForbiddenException(
          'Accès non autorisé à cette demande de congé',
        );
      }
    }

    return leave;
  }

  /**
   * Mettre à jour une demande de congé
   */
  async update(
    id: string,
    updateLeaveDto: UpdateLeaveDto,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const existingLeave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!existingLeave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // Check if current user can manage this leave (ownership or perimeter)
    const isOwner = existingLeave.userId === currentUserId;
    const canManage =
      currentUserId && currentUserRole
        ? await this.canManageLeave(
            existingLeave.userId,
            currentUserId,
            currentUserRole,
          )
        : false;

    if (!isOwner && !canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres demandes de congé',
      );
    }

    // Management roles with perimeter access can update any status
    // Other users: only PENDING
    if (!canManage && existingLeave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être modifiées',
      );
    }

    const {
      type,
      startDate,
      endDate,
      halfDay,
      startHalfDay,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      endHalfDay,
      reason,
    } = updateLeaveDto;
    const effectiveHalfDay = halfDay || startHalfDay;

    // Recalculer les jours si les dates changent
    const start = startDate ? new Date(startDate) : existingLeave.startDate;
    const end = endDate ? new Date(endDate) : existingLeave.endDate;

    if (end < start) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début',
      );
    }

    // `gateHalfDay` est la valeur effective consommée par le moteur de
    // décompte ET par la gate de solde : il faut que les deux voient la
    // même demi-journée, sinon `days` (stockage) et `workDays` (gate)
    // peuvent diverger d'une demi-journée et bloquer un édit légitime.
    const gateHalfDay = effectiveHalfDay ?? existingLeave.halfDay;
    // COR-003 — même set de jours fériés pour le stockage et la gate.
    const holidayKeys = await this.getHolidayKeySet(start, end);
    const days = calculateLeaveDays(
      start,
      end,
      gateHalfDay,
      undefined,
      holidayKeys,
    );

    // Vérifier les chevauchements (exclure la demande actuelle)
    if (startDate || endDate) {
      const hasOverlap = await this.checkOverlap(
        existingLeave.userId,
        start,
        end,
        id,
      );

      if (hasOverlap) {
        throw new ConflictException(
          'Cette modification créerait un chevauchement avec une autre demande',
        );
      }
    }

    // Vérifier le solde par année calendaire Paris, en excluant la demande
    // elle-même via `excludeLeaveId` — cela remplace l'ancien correctif
    // `available + existingLeave.days` qui sur-créditait quand un congé
    // était déplacé d'une année à l'autre (existingLeave.days est compté
    // en totalité, indépendamment de l'année où il tombait).
    const yearBuckets = splitLeaveByYear(
      start,
      end,
      gateHalfDay,
      undefined,
      holidayKeys,
    );
    let leaveTypeConfigCache: { name: string } | null = null;
    const loadLeaveTypeName = async (
      db: Prisma.TransactionClient | PrismaService,
    ): Promise<string> => {
      if (!leaveTypeConfigCache) {
        leaveTypeConfigCache = await db.leaveTypeConfig.findUnique({
          where: { id: existingLeave.leaveTypeId },
          select: { name: true },
        });
      }
      return leaveTypeConfigCache?.name ?? 'ce type de congé';
    };

    // Finding #4 (cf. create) : gate + write doivent partager une tx pour
    // qu'une suppression concurrente de LeaveBalance ne fasse pas diverger
    // l'état validé de l'état écrit. ReadCommitted + re-lecture explicite
    // avant l'update.
    const leave = await this.prisma.$transaction(async (tx) => {
      const allocationSnapshots = new Map<number, number>();
      for (const bucket of yearBuckets) {
        const hasBalance = await this.hasConfiguredBalance(
          existingLeave.userId,
          existingLeave.leaveTypeId,
          bucket.year,
          tx,
        );
        if (!hasBalance) continue;
        const allocated = await this.resolveAllocatedDays(
          existingLeave.userId,
          existingLeave.leaveTypeId,
          bucket.year,
          tx,
        );
        allocationSnapshots.set(bucket.year, allocated);
        const available = await this.getAvailableDays(
          existingLeave.userId,
          existingLeave.leaveTypeId,
          bucket.year,
          { excludeLeaveId: id },
          tx,
        );
        if (available < bucket.workDays) {
          const typeName = await loadLeaveTypeName(tx);
          const shortfall = bucket.workDays - available;
          throw new BadRequestException(
            `Solde insuffisant pour ${typeName} en ${bucket.year} : ` +
              `${bucket.workDays} jours demandés, ${available} jours disponibles, ` +
              `il manque ${shortfall} jours.`,
          );
        }
      }

      for (const [year, snapshot] of allocationSnapshots) {
        const current = await this.resolveAllocatedDays(
          existingLeave.userId,
          existingLeave.leaveTypeId,
          year,
          tx,
        );
        if (current !== snapshot) {
          const typeName = await loadLeaveTypeName(tx);
          throw new ConflictException(
            `Le solde de ${typeName} pour ${year} a été modifié pendant ` +
              `le traitement. Veuillez réessayer.`,
          );
        }
      }

      return tx.leave.update({
        where: { id },
        data: {
          // Finding #8 — `type` (enum) n'est plus modifiable via update :
          // c'est `leaveTypeId` (FK) qui porte la vérité et `type` est
          // dérivé côté create depuis la config. Permettre l'update de
          // `type` autorisait `{type:'RTT', leaveTypeId:cp-uuid}` à
          // persister, créant un désaccord enum/FK. Le DTO accepte
          // encore le champ (rétrocompatibilité de surface) mais le
          // serveur l'ignore silencieusement.
          ...(startDate && { startDate: start }),
          ...(endDate && { endDate: end }),
          ...(effectiveHalfDay && { halfDay: effectiveHalfDay }),
          ...(reason !== undefined && { comment: reason }),
          days,
        },
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
          leaveType: true,
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
      });
    });

    return leave;
  }

  /**
   * Supprimer une demande de congé
   */
  async remove(id: string, currentUserId?: string, currentUserRole?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // Check if current user can manage this leave (ownership or perimeter)
    const isOwner = leave.userId === currentUserId;
    const canManage =
      currentUserId && currentUserRole
        ? await this.canManageLeave(
            leave.userId,
            currentUserId,
            currentUserRole,
          )
        : false;

    if (!isOwner && !canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres demandes de congé',
      );
    }

    // Management roles with perimeter access can delete any status
    // Other users: only PENDING or REJECTED
    if (!canManage) {
      if (
        leave.status !== LeaveStatus.PENDING &&
        leave.status !== LeaveStatus.REJECTED
      ) {
        throw new BadRequestException(
          'Seules les demandes en attente ou refusées peuvent être supprimées',
        );
      }
    }

    await this.prisma.leave.delete({
      where: { id },
    });

    return { message: 'Demande de congé supprimée avec succès' };
  }

  /**
   * Vérifier si l'utilisateur peut valider une demande
   */
  async canValidate(leaveId: string, validatorId: string): Promise<boolean> {
    const leave = await this.prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!leave) return false;

    const validator = await this.prisma.user.findUnique({
      where: { id: validatorId },
      include: { role: { select: { code: true } } },
    });

    if (!validator) return false;

    const validatorPerms = await this.permissionsService.getPermissionsForRole(
      validator.role?.code ?? null,
    );

    // Accès global → peut tout valider
    if (validatorPerms.includes(MANAGE_ANY_LEAVES)) {
      return true;
    }

    // Le validateur assigné peut valider
    if (leave.validatorId === validatorId) {
      return true;
    }

    // Permission d'approbation → uniquement dans le périmètre services
    if (validatorPerms.includes(APPROVE_LEAVES)) {
      const userServices = await this.prisma.userService.findMany({
        where: { userId: validatorId },
        select: { serviceId: true },
      });
      const managedServices = await this.prisma.service.findMany({
        where: { managerId: validatorId },
        select: { id: true },
      });
      const serviceIds = [
        ...new Set([
          ...userServices.map((us) => us.serviceId),
          ...managedServices.map((s) => s.id),
        ]),
      ];

      if (serviceIds.length > 0) {
        const leaveUserService = await this.prisma.userService.findFirst({
          where: {
            userId: leave.userId,
            serviceId: { in: serviceIds },
          },
        });
        if (leaveUserService) return true;
      }
    }

    // Vérifier les délégations actives
    const today = new Date();
    const activeDelegation =
      await this.prisma.leaveValidationDelegate.findFirst({
        where: {
          delegateId: validatorId,
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

    return activeDelegation !== null;
  }

  /**
   * OBS-003 — Build the structured actor snapshot for a leave audit event.
   * Resolved BEFORE the surrounding `$transaction` (the permission lookup hits
   * Redis / Prisma and must not sit inside a Postgres tx holding row locks).
   * `permissions` uses the same resolver the RBAC guard consumes, so the trail
   * records exactly what the actor was authorized to do at decision time even
   * though `templateKey → permissions` is compile-time and leaves no DB trace.
   * Shared by approve/reject (OBS-003) and the OBS-021 lifecycle emitters.
   */
  private async buildActorSnapshot(
    actorId: string,
    actor?: LeaveActorMeta,
  ): Promise<LeaveActorSnapshot> {
    const roleCode = actor?.roleCode ?? null;
    return {
      id: actorId,
      roleCode,
      templateKey: actor?.templateKey ?? null,
      permissions: await this.permissionsService.getPermissionsForRole(
        roleCode,
      ),
    };
  }

  /**
   * Approuver une demande de congé
   */
  async approve(
    id: string,
    validatorId: string,
    comment?: string,
    actor?: LeaveActorMeta,
  ) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.userId === validatorId) {
      throw new ForbiddenException('Cannot approve your own leave request');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être approuvées',
      );
    }

    // Vérifier les droits de validation
    const canValidateLeave = await this.canValidate(id, validatorId);
    if (!canValidateLeave) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à valider cette demande",
      );
    }

    // OBS-003 — actor snapshot resolved BEFORE the tx (Redis/Prisma read must
    // not sit inside the Postgres tx holding the leave row lock).
    const actorSnapshot = await this.buildActorSnapshot(validatorId, actor);

    // DAT-001 — état + écriture d'audit doivent partager une seule
    // transaction. Pré-fix : leave.update puis auditService.log (logger-only)
    // hors $transaction ; un crash entre les deux laissait un congé APPROVED
    // sans aucune trace persistée. Pattern aligné sur create()/update()
    // (Wave 3) : ReadCommitted + re-lecture explicite avant l'écriture pour
    // se protéger d'une transition concurrente PENDING → APPROVED/REJECTED.
    const updatedLeave = await this.prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Demande de congé introuvable');
      }
      if (current.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
          'La demande de congé a été modifiée pendant le traitement. Veuillez réessayer.',
        );
      }

      const beforeSnapshot = {
        status: current.status,
        validatedById: current.validatedById,
        validatedAt: current.validatedAt?.toISOString() ?? null,
        validationComment: current.validationComment,
      };

      const updated = await tx.leave.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          validatedById: validatorId,
          validatedAt: new Date(),
          validationComment: comment,
        },
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
          leaveType: true,
          validatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
      });

      await this.auditPersistence.log({
        action: AuditAction.LEAVE_APPROVED,
        entityType: 'Leave',
        entityId: id,
        actorId: validatorId,
        payload: {
          // OBS-003 — actor + subject snapshots so an auditor can answer "who
          // approved leave X, with which role/permissions at the time". ip/ua
          // conditional (mirrors OBS-006). requestId omitted: no request-id
          // propagation exists yet (OBS-009 open — not implemented inline).
          actor: actorSnapshot,
          subject: { leaveId: id, userId: current.userId },
          ...(actor?.ip !== undefined ? { ip: actor.ip } : {}),
          ...(actor?.ua !== undefined ? { ua: actor.ua } : {}),
          targetUserId: current.userId,
          validatorAssigned: current.validatorId,
          // Wave 3 : `selfApproved` est figé à la création (true seulement si
          // `leaves:self_approve` a écrit directement APPROVED). Sur la voie
          // approve() le gate PENDING garantit qu'il vaut false ici, mais on
          // remonte la valeur lue pour que l'audit reste honnête à 100% si
          // un import/seed inattendu changeait l'invariant.
          selfApproved: current.selfApproved,
          before: beforeSnapshot,
          after: {
            status: updated.status,
            validatedById: updated.validatedById,
            validatedAt: updated.validatedAt?.toISOString() ?? null,
            validationComment: updated.validationComment,
          },
        },
      });

      return updated;
    });

    return updatedLeave;
  }

  /**
   * Refuser une demande de congé
   */
  async reject(
    id: string,
    validatorId: string,
    reason?: string,
    actor?: LeaveActorMeta,
  ) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.userId === validatorId) {
      throw new ForbiddenException('Cannot reject your own leave request');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être refusées',
      );
    }

    // Vérifier les droits de validation
    const canValidateLeave = await this.canValidate(id, validatorId);
    if (!canValidateLeave) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à valider cette demande",
      );
    }

    // OBS-003 — actor snapshot resolved before the tx (see approve()).
    const actorSnapshot = await this.buildActorSnapshot(validatorId, actor);

    // DAT-001 — mêmes garanties que approve() : status + audit durables
    // doivent partager une transaction unique avec re-lecture du statut.
    const updatedLeave = await this.prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Demande de congé introuvable');
      }
      if (current.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
          'La demande de congé a été modifiée pendant le traitement. Veuillez réessayer.',
        );
      }

      const beforeSnapshot = {
        status: current.status,
        validatedById: current.validatedById,
        validatedAt: current.validatedAt?.toISOString() ?? null,
        validationComment: current.validationComment,
      };

      const updated = await tx.leave.update({
        where: { id },
        data: {
          status: LeaveStatus.REJECTED,
          validatedById: validatorId,
          validatedAt: new Date(),
          validationComment: reason,
        },
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
          leaveType: true,
          validatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
        },
      });

      await this.auditPersistence.log({
        action: AuditAction.LEAVE_REJECTED,
        entityType: 'Leave',
        entityId: id,
        actorId: validatorId,
        payload: {
          // OBS-003 — see approve() for the actor/subject snapshot rationale.
          actor: actorSnapshot,
          subject: { leaveId: id, userId: current.userId },
          ...(actor?.ip !== undefined ? { ip: actor.ip } : {}),
          ...(actor?.ua !== undefined ? { ua: actor.ua } : {}),
          targetUserId: current.userId,
          validatorAssigned: current.validatorId,
          selfApproved: current.selfApproved,
          before: beforeSnapshot,
          after: {
            status: updated.status,
            validatedById: updated.validatedById,
            validatedAt: updated.validatedAt?.toISOString() ?? null,
            validationComment: updated.validationComment,
          },
        },
      });

      return updated;
    });

    return updatedLeave;
  }

  /**
   * Annuler une demande de congé approuvée
   */
  async cancel(id: string, currentUserId?: string, currentUserRole?: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // SEC-06 — enforce manager-perimeter on cross-user cancellation.
    // The controller already gates on `leaves:delete`, but without this check
    // any MANAGER could cancel leaves of users outside their service scope.
    if (currentUserId && currentUserRole) {
      const isOwner = leave.userId === currentUserId;
      const canManage = await this.canManageLeave(
        leave.userId,
        currentUserId,
        currentUserRole,
      );
      if (!isOwner && !canManage) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à annuler cette demande",
        );
      }
    }

    if (
      leave.status !== LeaveStatus.APPROVED &&
      leave.status !== LeaveStatus.CANCELLATION_REQUESTED
    ) {
      throw new BadRequestException(
        "Seules les demandes approuvées ou en attente d'annulation peuvent être annulées",
      );
    }

    // DAT-001 — annulation = transition d'état audit-sensible. Même pattern
    // qu'approve()/reject() : re-lecture sous tx puis update + audit durable
    // dans la même transaction.
    const updatedLeave = await this.prisma.$transaction(async (tx) => {
      const current = await tx.leave.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Demande de congé introuvable');
      }
      if (
        current.status !== LeaveStatus.APPROVED &&
        current.status !== LeaveStatus.CANCELLATION_REQUESTED
      ) {
        throw new ConflictException(
          'La demande de congé a été modifiée pendant le traitement. Veuillez réessayer.',
        );
      }

      const beforeSnapshot = {
        status: current.status,
        validatedById: current.validatedById,
        validatedAt: current.validatedAt?.toISOString() ?? null,
      };

      const updated = await tx.leave.update({
        where: { id },
        data: { status: LeaveStatus.REJECTED },
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
          leaveType: true,
        },
      });

      await this.auditPersistence.log({
        action: 'LEAVE_CANCELLED',
        entityType: 'Leave',
        entityId: id,
        actorId: currentUserId ?? null,
        payload: {
          targetUserId: current.userId,
          validatorAssigned: current.validatorId,
          selfApproved: current.selfApproved,
          cancelledByOwner: currentUserId
            ? current.userId === currentUserId
            : null,
          before: beforeSnapshot,
          after: {
            status: updated.status,
          },
        },
      });

      return updated;
    });

    return updatedLeave;
  }

  /**
   * Demander l'annulation d'un congé approuvé (par le demandeur lui-même)
   * Le congé passe en CANCELLATION_REQUESTED et attend validation du manager/admin
   */
  async requestCancel(id: string, requestingUserId: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    if (leave.userId !== requestingUserId) {
      throw new ForbiddenException(
        "Vous ne pouvez demander l'annulation que de vos propres congés",
      );
    }

    if (leave.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException(
        "Seules les demandes approuvées peuvent faire l'objet d'une demande d'annulation",
      );
    }

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLATION_REQUESTED },
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
        leaveType: true,
      },
    });

    return updatedLeave;
  }

  /**
   * Refuser la demande d'annulation — le congé redevient APPROVED
   */
  async rejectCancellation(
    id: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Demande de congé introuvable');
    }

    // SEC-06 — enforce manager-perimeter. Without this, any user with
    // `leaves:approve` could keep a leave approved for users outside scope.
    if (currentUserId && currentUserRole) {
      const canManage = await this.canManageLeave(
        leave.userId,
        currentUserId,
        currentUserRole,
      );
      if (!canManage) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à refuser cette demande d'annulation",
        );
      }
    }

    if (leave.status !== LeaveStatus.CANCELLATION_REQUESTED) {
      throw new BadRequestException(
        "Ce congé n'est pas en attente d'annulation",
      );
    }

    return this.prisma.leave.update({
      where: { id },
      data: { status: LeaveStatus.APPROVED },
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
        leaveType: true,
      },
    });
  }

  // ===========================
  // GESTION DES DÉLÉGATIONS
  // ===========================

  /**
   * Créer une délégation de validation
   */
  async createDelegation(
    delegatorId: string,
    delegateId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Vérifier que le délégateur a le droit de déléguer
    const delegator = await this.prisma.user.findUnique({
      where: { id: delegatorId },
      include: { role: { select: { code: true } } },
    });

    if (!delegator) {
      throw new NotFoundException('Utilisateur délégateur introuvable');
    }

    const canDelegate = await this.roleHasPermission(
      delegator.role?.code ?? undefined,
      MANAGE_DELEGATIONS,
    );
    if (!canDelegate) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de déléguer la validation des congés",
      );
    }

    // Vérifier que le délégué existe
    const delegate = await this.prisma.user.findUnique({
      where: { id: delegateId },
    });

    if (!delegate) {
      throw new NotFoundException('Utilisateur délégué introuvable');
    }

    if (!delegate.isActive) {
      throw new BadRequestException("L'utilisateur délégué doit être actif");
    }

    // Vérifier les dates
    if (endDate < startDate) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    // Créer la délégation
    const delegation = await this.prisma.leaveValidationDelegate.create({
      data: {
        delegatorId,
        delegateId,
        startDate,
        endDate,
        isActive: true,
      },
      include: {
        delegator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
      },
    });

    return delegation;
  }

  /**
   * Récupérer les délégations d'un utilisateur
   */
  async getDelegations(userId: string) {
    const [given, received] = await Promise.all([
      this.prisma.leaveValidationDelegate.findMany({
        where: { delegatorId: userId },
        include: {
          delegate: {
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
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveValidationDelegate.findMany({
        where: { delegateId: userId },
        include: {
          delegator: {
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
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return { given, received };
  }

  /**
   * Désactiver une délégation
   */
  async deactivateDelegation(delegationId: string, userId: string) {
    const delegation = await this.prisma.leaveValidationDelegate.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) {
      throw new NotFoundException('Délégation introuvable');
    }

    // Seul le délégateur ou un admin peut désactiver
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { code: true } } },
    });

    const hasManageAny = await this.roleHasPermission(
      user?.role?.code,
      MANAGE_ANY_LEAVES,
    );
    if (delegation.delegatorId !== userId && !hasManageAny) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à désactiver cette délégation",
      );
    }

    const updated = await this.prisma.leaveValidationDelegate.update({
      where: { id: delegationId },
      data: { isActive: false },
    });

    return updated;
  }

  /**
   * Résoudre le solde total alloué pour un user + leaveType + year.
   * Cherche d'abord l'override individuel, puis le solde global (userId=null).
   *
   * `db` permet à un appelant transactionnel de partager sa connexion ; sans
   * argument, on retombe sur `this.prisma` (client racine).
   */
  async resolveAllocatedDays(
    userId: string,
    leaveTypeId: string,
    year: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    // 1. Override individuel
    const individualBalance = await db.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId, leaveTypeId, year },
      },
    });
    if (individualBalance) {
      return Number(individualBalance.totalDays);
    }

    // 2. Solde global (userId = null)
    const globalBalance = await db.leaveBalance.findFirst({
      where: {
        userId: null,
        leaveTypeId,
        year,
      },
    });
    if (globalBalance) {
      return Number(globalBalance.totalDays);
    }

    // 3. Aucun solde configuré → 0
    return 0;
  }

  /**
   * Indique si une allocation de congés est configurée pour ce user/type/year.
   * Retourne true s'il existe une ligne LeaveBalance individuelle OU globale.
   * Absence de ligne ⇒ type illimité pour ce user/year.
   */
  async hasConfiguredBalance(
    userId: string,
    leaveTypeId: string,
    year: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<boolean> {
    const individual = await db.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId, leaveTypeId, year },
      },
      select: { id: true },
    });
    if (individual) return true;

    const global = await db.leaveBalance.findFirst({
      where: { userId: null, leaveTypeId, year },
      select: { id: true },
    });
    return global !== null;
  }

  /**
   * Jours encore disponibles pour ce user/type/year (calendrier Paris) :
   *   total alloué (override individuel sinon global)
   *   − jours APPROVED, CANCELLATION_REQUESTED ou PENDING dont l'intervalle
   *     [startDate, endDate] intersecte l'année cible, pondérés au prorata
   *     des jours qui tombent effectivement dans cette année.
   *
   * `excludeLeaveId` permet à update() d'exclure la demande en cours
   * d'édition pour qu'elle ne se compte pas elle-même — c'est ce qui
   * remplace le hack historique `available + existingLeave.days`.
   *
   * Suppose qu'une allocation est configurée (à vérifier au préalable avec
   * hasConfiguredBalance).
   */
  async getAvailableDays(
    userId: string,
    leaveTypeId: string,
    year: number,
    options: { excludeLeaveId?: string } = {},
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const totalDays = await this.resolveAllocatedDays(
      userId,
      leaveTypeId,
      year,
      db,
    );
    const { start: yearStart, endExclusive: yearEnd } = parisYearWindow(year);

    // COR-003 — soustraire les jours fériés non travaillés du décompte
    // consommé, exactement comme la création/édition les soustrait du
    // stockage. Sans ça la gate sur-compterait la consommation (4 jours
    // stockés mais 5 recomptés ici) et bloquerait des demandes légitimes.
    const holidayKeys = await this.getHolidayKeySet(yearStart, yearEnd);

    const intersecting = await db.leave.findMany({
      where: {
        userId,
        leaveTypeId,
        status: {
          in: [
            LeaveStatus.APPROVED,
            LeaveStatus.CANCELLATION_REQUESTED,
            LeaveStatus.PENDING,
          ],
        },
        startDate: { lt: yearEnd },
        endDate: { gte: yearStart },
        ...(options.excludeLeaveId
          ? { id: { not: options.excludeLeaveId } }
          : {}),
      },
      select: { startDate: true, endDate: true, halfDay: true },
    });

    const usedThisYear = intersecting.reduce((sum, l) => {
      const buckets = splitLeaveByYear(
        l.startDate,
        l.endDate,
        l.halfDay ?? null,
        null,
        holidayKeys,
      );
      const bucket = buckets.find((b) => b.year === year);
      return sum + (bucket?.workDays ?? 0);
    }, 0);

    return Math.max(0, totalDays - usedThisYear);
  }

  /**
   * Récupérer le solde de congés d'un utilisateur par type de congé
   * (nouveau calcul utilisant la table LeaveBalance)
   */
  async getLeaveBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const currentYear = new Date().getFullYear();

    // Récupérer tous les types de congés actifs
    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Pour chaque type, calculer le solde
    const balancesByType = await Promise.all(
      leaveTypes.map(async (lt) => {
        const totalDays = await this.resolveAllocatedDays(
          userId,
          lt.id,
          currentYear,
        );

        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);

        const approvedLeaves = await this.prisma.leave.findMany({
          where: {
            userId,
            leaveTypeId: lt.id,
            status: {
              in: [LeaveStatus.APPROVED, LeaveStatus.CANCELLATION_REQUESTED],
            },
            startDate: { gte: yearStart, lte: yearEnd },
          },
        });
        const usedDays = approvedLeaves.reduce(
          (sum, l) => sum + Number(l.days),
          0,
        );

        const pendingLeaves = await this.prisma.leave.findMany({
          where: {
            userId,
            leaveTypeId: lt.id,
            status: LeaveStatus.PENDING,
            startDate: { gte: yearStart, lte: yearEnd },
          },
        });
        const pendingDays = pendingLeaves.reduce(
          (sum, l) => sum + Number(l.days),
          0,
        );

        return {
          leaveTypeId: lt.id,
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          leaveTypeColor: lt.color,
          leaveTypeIcon: lt.icon,
          year: currentYear,
          total: totalDays,
          used: usedDays,
          pending: pendingDays,
          available: Math.max(0, totalDays - usedDays - pendingDays),
        };
      }),
    );

    // Maintenir la compatibilité avec l'ancienne structure (CP summary)
    const cpBalance = balancesByType.find((b) => b.leaveTypeCode === 'CP');

    return {
      userId,
      year: currentYear,
      // Compatibilité ancienne API
      total: cpBalance?.total ?? 0,
      used: cpBalance?.used ?? 0,
      available: cpBalance?.available ?? 0,
      pending: cpBalance?.pending ?? 0,
      // Nouveau: détail par type
      byType: balancesByType,
    };
  }

  /**
   * Récupérer le nombre de jours en attente (CP) — conservé pour compatibilité interne
   */
  private async getPendingDays(userId: string): Promise<number> {
    const pendingLeaves = await this.prisma.leave.findMany({
      where: {
        userId,
        type: LeaveType.CP,
        status: LeaveStatus.PENDING,
      },
    });

    return pendingLeaves.reduce((sum, leave) => sum + Number(leave.days), 0);
  }

  // ===========================
  // GESTION DES SOLDES (BALANCES)
  // ===========================

  /**
   * Lister les soldes (filtrable par year, userId)
   */
  async getBalances(year?: number, userId?: string) {
    const where: Prisma.LeaveBalanceWhereInput = {};
    if (year) where.year = year;
    if (userId !== undefined) {
      // userId = 'null' string → chercher les globaux
      where.userId = userId === 'null' ? null : userId;
    }

    return this.prisma.leaveBalance.findMany({
      where,
      include: {
        leaveType: {
          select: { id: true, code: true, name: true, color: true, icon: true },
        },
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
      orderBy: [{ year: 'desc' }, { leaveTypeId: 'asc' }],
    });
  }

  /**
   * Lister les soldes globaux par défaut (userId = null)
   */
  async getDefaultBalances(year?: number) {
    return this.prisma.leaveBalance.findMany({
      where: {
        userId: null,
        ...(year ? { year } : {}),
      },
      include: {
        leaveType: {
          select: { id: true, code: true, name: true, color: true, icon: true },
        },
      },
      orderBy: [{ year: 'desc' }, { leaveTypeId: 'asc' }],
    });
  }

  /**
   * Créer ou mettre à jour un solde (upsert)
   */
  async upsertBalance(dto: UpsertLeaveBalanceDto) {
    const { userId, leaveTypeId, year, totalDays } = dto;

    // Vérifier que le type de congé existe
    const leaveType = await this.prisma.leaveTypeConfig.findUnique({
      where: { id: leaveTypeId },
    });
    if (!leaveType) {
      throw new NotFoundException('Type de congé introuvable');
    }

    // Vérifier que l'utilisateur existe (si userId fourni)
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable');
      }
    }

    const includeOpts = {
      leaveType: {
        select: { id: true, code: true, name: true, color: true, icon: true },
      },
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
    };

    if (userId) {
      // With a non-null userId, use Prisma upsert with compound key
      return this.prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: { userId, leaveTypeId, year },
        },
        create: { userId, leaveTypeId, year, totalDays },
        update: { totalDays },
        include: includeOpts,
      });
    }

    // userId = null (global default) — Prisma upsert ne gère pas correctement
    // les compound keys avec NULL. Wave 3 / finding #11 : la séquence
    // findFirst → create | update n'est pas atomique, et l'unique constraint
    // par défaut (`(userId, leaveTypeId, year)`) traite NULL comme distinct
    // donc deux globaux pouvaient cohabiter. L'index unique partiel
    // `leave_balances_global_unique` (migration 20260523171000) interdit ce
    // doublon au niveau base : le doublon est désormais IMPOSSIBLE.
    //
    // Retry simple à un coup, HORS transaction. Une P2002 dans un
    // $transaction Postgres abort la tx entière (état ERROR), tout
    // statement suivant échoue avec "current transaction is aborted" — le
    // try/catch en tx était cosmétique et masquait une 500 réelle. Hors
    // tx, on peut rejouer la séquence find → update pour gérer la course
    // proprement.
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await this.prisma.leaveBalance.findFirst({
        where: { userId: null, leaveTypeId, year },
      });
      if (existing) {
        return this.prisma.leaveBalance.update({
          where: { id: existing.id },
          data: { totalDays },
          include: includeOpts,
        });
      }
      try {
        return await this.prisma.leaveBalance.create({
          data: { userId: null, leaveTypeId, year, totalDays },
          include: includeOpts,
        });
      } catch (err) {
        if (
          attempt === 0 &&
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Race perdue : une autre transaction vient de créer le global.
          // On rejoue la boucle ; au second tour, le findFirst le verra.
          continue;
        }
        throw err;
      }
    }
    // Inatteignable : la boucle retourne toujours dans son premier tour
    // OU throw dans le second. Garde-fou typé.
    throw new Error('upsertBalance global: unreachable');
  }

  /**
   * Supprimer un solde individuel
   */
  async deleteBalance(id: string) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { id },
    });

    if (!balance) {
      throw new NotFoundException('Solde introuvable');
    }

    await this.prisma.leaveBalance.delete({ where: { id } });
    return { message: 'Solde supprimé avec succès' };
  }

  /**
   * Vérifier les chevauchements de congés
   */
  private async checkOverlap(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Prisma.LeaveWhereInput = {
      userId,
      status: {
        in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    };

    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const overlappingLeaves = await this.prisma.leave.findMany({ where });

    return overlappingLeaves.length > 0;
  }

  // ===========================
  // IMPORT CSV
  // ===========================

  /**
   * Récupérer le modèle CSV pour l'import de congés
   */
  getImportTemplate(): string {
    const headers = [
      'userEmail',
      'leaveTypeName',
      'startDate',
      'endDate',
      'halfDay',
      'comment',
    ];
    const exampleComment = [
      '# user@example.com',
      '# Congé Payé',
      '# 2026-03-01',
      '# 2026-03-05',
      '#',
      '# Vacances',
    ];
    const exampleHalfDay = [
      '# user@example.com',
      '# RTT',
      '# 2026-03-10',
      '# 2026-03-10',
      '# MORNING',
      '# Demi-journée matin',
    ];
    return (
      headers.join(';') +
      '\n' +
      exampleComment.join(';') +
      '\n' +
      exampleHalfDay.join(';')
    );
  }

  /**
   * Valider des congés avant import (dry-run)
   */
  async validateLeavesImport(
    leaves: Array<{
      userEmail: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      halfDay?: string;
      comment?: string;
    }>,
  ) {
    const result: {
      valid: any[];
      duplicates: any[];
      errors: any[];
      warnings: any[];
      summary: {
        total: number;
        valid: number;
        duplicates: number;
        errors: number;
        warnings: number;
      };
    } = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: leaves.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    // Récupérer tous les utilisateurs actifs
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(
      users.map((u) => [
        u.email.toLowerCase(),
        { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` },
      ]),
    );

    // Récupérer tous les types de congés actifs
    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
    });
    const leaveTypesByName = new Map(
      leaveTypes.map((lt) => [
        lt.name.toLowerCase(),
        { id: lt.id, name: lt.name, code: lt.code },
      ]),
    );

    // Récupérer les congés existants (PENDING/APPROVED) pour détection chevauchement
    const existingLeaves = await this.prisma.leave.findMany({
      where: {
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Map pour détecter les doublons dans le fichier
    const leavesInFile = new Map<string, Array<{ start: Date; end: Date }>>();

    for (let i = 0; i < leaves.length; i++) {
      const leaveData = leaves[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      const previewItem: {
        lineNumber: number;
        leave: any;
        status: 'valid' | 'duplicate' | 'error' | 'warning';
        messages: string[];
        resolvedUser?: { id: string; email: string; name: string };
        resolvedLeaveType?: { id: string; name: string; code: string };
      } = {
        lineNumber: lineNum,
        leave: leaveData,
        status: 'valid',
        messages: [],
        resolvedUser: undefined,
        resolvedLeaveType: undefined,
      };

      // Vérifier les champs obligatoires
      if (!leaveData.userEmail || leaveData.userEmail.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push("L'email utilisateur est obligatoire");
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.leaveTypeName || leaveData.leaveTypeName.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le type de congé est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.startDate || leaveData.startDate.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('La date de début est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!leaveData.endDate || leaveData.endDate.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('La date de fin est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Résoudre l'utilisateur par email
      const resolvedUser = usersByEmail.get(leaveData.userEmail.toLowerCase());
      if (!resolvedUser) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Utilisateur "${leaveData.userEmail}" introuvable ou inactif`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }
      previewItem.resolvedUser = resolvedUser;

      // Résoudre le type de congé par nom
      const resolvedLeaveType = leaveTypesByName.get(
        leaveData.leaveTypeName.toLowerCase(),
      );
      if (!resolvedLeaveType) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Type de congé "${leaveData.leaveTypeName}" introuvable ou inactif`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }
      previewItem.resolvedLeaveType = resolvedLeaveType;

      // Valider le format des dates
      const startDate = new Date(leaveData.startDate);
      const endDate = new Date(leaveData.endDate);

      if (isNaN(startDate.getTime())) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Date de début invalide: "${leaveData.startDate}" (format attendu: YYYY-MM-DD)`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (isNaN(endDate.getTime())) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Date de fin invalide: "${leaveData.endDate}" (format attendu: YYYY-MM-DD)`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier que endDate >= startDate
      if (endDate < startDate) {
        previewItem.status = 'error';
        previewItem.messages.push(
          'La date de fin doit être postérieure ou égale à la date de début',
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Valider halfDay uniquement sur une seule journée
      if (leaveData.halfDay) {
        if (startDate.getTime() !== endDate.getTime()) {
          previewItem.status = 'warning';
          previewItem.messages.push(
            'halfDay est ignoré pour les congés de plusieurs jours',
          );
        }
      }

      // Vérifier les chevauchements avec les congés existants
      const hasOverlap = existingLeaves.some(
        (existing) =>
          existing.userId === resolvedUser.id &&
          existing.startDate <= endDate &&
          existing.endDate >= startDate,
      );

      if (hasOverlap) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(
          'Chevauchement avec un congé existant pour cet utilisateur',
        );
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Vérifier les chevauchements dans le fichier
      const userLeavesInFile = leavesInFile.get(resolvedUser.id) || [];
      const hasOverlapInFile = userLeavesInFile.some(
        (leave) => leave.start <= endDate && leave.end >= startDate,
      );

      if (hasOverlapInFile) {
        previewItem.status = 'duplicate';
        previewItem.messages.push(
          'Chevauchement avec un autre congé dans le fichier pour cet utilisateur',
        );
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Ajouter à la map pour détection de doublons
      userLeavesInFile.push({ start: startDate, end: endDate });
      leavesInFile.set(resolvedUser.id, userLeavesInFile);

      // Si tout est OK
      if (previewItem.status === 'warning') {
        result.warnings.push(previewItem);
        result.summary.warnings++;
      } else {
        result.valid.push(previewItem);
        result.summary.valid++;
      }
    }

    return result;
  }

  /**
   * Importer des congés en masse
   */
  async importLeaves(
    leaves: Array<{
      userEmail: string;
      leaveTypeName: string;
      startDate: string;
      endDate: string;
      halfDay?: string;
      comment?: string;
    }>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentUserId: string,
  ) {
    const result: {
      created: number;
      skipped: number;
      errors: number;
      errorDetails: string[];
    } = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Récupérer tous les utilisateurs actifs
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
    });
    const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

    // Récupérer tous les types de congés actifs
    const leaveTypes = await this.prisma.leaveTypeConfig.findMany({
      where: { isActive: true },
    });
    const leaveTypesByName = new Map(
      leaveTypes.map((lt) => [lt.name.toLowerCase(), lt]),
    );

    // Récupérer les congés existants (PENDING/APPROVED) pour détection chevauchement
    const existingLeaves = await this.prisma.leave.findMany({
      where: {
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Map pour détecter les doublons dans le fichier
    const leavesInFile = new Map<string, Array<{ start: Date; end: Date }>>();

    for (let i = 0; i < leaves.length; i++) {
      const leaveData = leaves[i];
      const lineNum = i + 2;

      try {
        // Résoudre l'utilisateur
        const user = usersByEmail.get(leaveData.userEmail.toLowerCase());
        if (!user) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Utilisateur "${leaveData.userEmail}" introuvable`,
          );
          continue;
        }

        // Résoudre le type de congé
        const leaveType = leaveTypesByName.get(
          leaveData.leaveTypeName.toLowerCase(),
        );
        if (!leaveType) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Type de congé "${leaveData.leaveTypeName}" introuvable`,
          );
          continue;
        }

        // Valider les dates
        const startDate = new Date(leaveData.startDate);
        const endDate = new Date(leaveData.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          result.skipped++;
          result.errorDetails.push(`Ligne ${lineNum}: Dates invalides`);
          continue;
        }

        if (endDate < startDate) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Date de fin antérieure à la date de début`,
          );
          continue;
        }

        // Vérifier les chevauchements avec les congés existants
        const hasOverlap = existingLeaves.some(
          (existing) =>
            existing.userId === user.id &&
            existing.startDate <= endDate &&
            existing.endDate >= startDate,
        );

        if (hasOverlap) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Chevauchement avec un congé existant`,
          );
          continue;
        }

        // Vérifier les chevauchements dans le fichier
        const userLeavesInFile = leavesInFile.get(user.id) || [];
        const hasOverlapInFile = userLeavesInFile.some(
          (leave) => leave.start <= endDate && leave.end >= startDate,
        );

        if (hasOverlapInFile) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Chevauchement avec un autre congé dans le fichier`,
          );
          continue;
        }

        // Calculer le nombre de jours
        const halfDay =
          leaveData.halfDay &&
          startDate.getTime() === endDate.getTime() &&
          (leaveData.halfDay === 'MORNING' || leaveData.halfDay === 'AFTERNOON')
            ? leaveData.halfDay
            : null;

        // COR-003 — soustraire les jours fériés non travaillés, comme la
        // création standard. Lecture par ligne (volume d'import modéré).
        const importHolidayKeys = await this.getHolidayKeySet(
          startDate,
          endDate,
        );
        const days = calculateLeaveDays(
          startDate,
          endDate,
          halfDay,
          undefined,
          importHolidayKeys,
        );

        // Trouver le validateur approprié
        const validatorId = leaveType.requiresApproval
          ? await this.findValidatorForUser(user.id)
          : null;

        // Déterminer le statut initial
        const initialStatus = leaveType.requiresApproval
          ? LeaveStatus.PENDING
          : LeaveStatus.APPROVED;

        // Déterminer le type enum (pour rétrocompatibilité)
        const validEnumTypes = Object.values(LeaveType);
        const enumType = validEnumTypes.includes(leaveType.code as LeaveType)
          ? (leaveType.code as LeaveType)
          : LeaveType.OTHER;

        // Créer le congé
        await this.prisma.leave.create({
          data: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            type: enumType,
            startDate,
            endDate,
            halfDay: halfDay || undefined,
            days,
            comment: leaveData.comment || undefined,
            status: initialStatus,
            validatorId,
          },
        });

        // Ajouter à la map pour détection de doublons
        userLeavesInFile.push({ start: startDate, end: endDate });
        leavesInFile.set(user.id, userLeavesInFile);

        result.created++;
      } catch (error) {
        result.errors++;
        result.errorDetails.push(
          `Ligne ${lineNum}: ${error.message || 'Erreur inconnue'}`,
        );
      }
    }

    return result;
  }
}
