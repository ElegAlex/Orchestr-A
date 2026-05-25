import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
  type PermissionCode,
  type RoleTemplate,
  type RoleTemplateKey,
} from 'rbac';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';
import { PermissionsService } from './permissions.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

/**
 * Actor performing a role mutation. The audit trail stamps `actorId` from this.
 * Optional: internal / seed / test paths pass no caller and emit nothing
 * (OBS-004 / SEC-002 caller-optional precedent).
 */
export type RoleMutationActor = { id: string };

export interface RoleWithStats {
  id: string;
  code: string;
  label: string;
  templateKey: RoleTemplateKey;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
  permissionsCount: number;
  category: RoleTemplate['category'];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateView {
  key: RoleTemplateKey;
  defaultLabel: string;
  category: RoleTemplate['category'];
  description: string;
  permissions: readonly PermissionCode[];
}

export interface DependentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * RolesService — V1 D de Spec 2.
 *
 * CRUD des rôles applicatifs (table `roles`). Les rôles `isSystem=true`
 * (les 26 templates seedés en V0) sont **verrouillés** sur les mutations
 * (D9 PO) : tentative d'update/delete renvoie 403. Les rôles
 * `isSystem=false` sont éditables sur `label`, `description`, `isDefault`
 * uniquement — le `templateKey` d'un rôle est **immuable** après création
 * (un rôle créé sur un template y reste à vie).
 *
 * Le set de permissions effectif d'un rôle est **toujours** calculé via
 * `ROLE_TEMPLATES[templateKey].permissions` — aucune modification de
 * permissions à la pièce, par design.
 *
 * Suppression : refusée si des users sont rattachés (409 + liste).
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  /**
   * Liste tous les rôles existants en DB (système + custom). Enrichi avec
   * `userCount`, `permissionsCount`, `category` (résolus depuis le template).
   */
  async listRoles(): Promise<RoleWithStats[]> {
    const rows = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { templateKey: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    return rows.map((r) => this.toRoleWithStats(r));
  }

  /**
   * Liste les 26 templates hardcodés (vue de la galerie UI admin).
   * Pas de lecture DB — données 100% in-memory depuis le package `rbac`.
   */
  listTemplates(): TemplateView[] {
    return ROLE_TEMPLATE_KEYS.map((key) => {
      const tpl = ROLE_TEMPLATES[key];
      return {
        key: tpl.key,
        defaultLabel: tpl.defaultLabel,
        category: tpl.category,
        description: tpl.description,
        permissions: tpl.permissions,
      };
    });
  }

  async getRoleById(id: string): Promise<RoleWithStats> {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!row) throw new NotFoundException(`Role ${id} introuvable`);
    return this.toRoleWithStats(row);
  }

  async createRole(
    dto: CreateRoleDto,
    caller?: RoleMutationActor,
  ): Promise<RoleWithStats> {
    // Garde-fou : un code identique à un templateKey système → conflit avec
    // l'un des 26 rôles seedés (qui ont code = templateKey).
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Role avec le code "${dto.code}" existe déjà`,
      );
    }

    // OBS-005 — capture the prior default before the singleton shifts, but only
    // when we will actually emit (caller present). +1 findFirst on the
    // default-setting path only; no extra roundtrip otherwise.
    let prevDefaultRoleId: string | null = null;
    if (dto.isDefault) {
      if (caller) {
        prevDefaultRoleId = await this.captureCurrentDefaultId();
      }
      await this.unsetCurrentDefault();
    }

    const created = await this.prisma.role.create({
      data: {
        code: dto.code,
        label: dto.label,
        templateKey: dto.templateKey,
        description: dto.description ?? null,
        isSystem: false, // Force false — la création de rôles système est
        // exclusivement faite par le seed.
        isDefault: dto.isDefault ?? false,
      },
      include: { _count: { select: { users: true } } },
    });

    // OBS-005 — durable audit trail. Caller-undefined (seed/internal/test
    // paths) emits nothing, mirroring the OBS-004 / SEC-002 precedent.
    if (caller) {
      await this.auditPersistence.log({
        action: AuditAction.ROLE_CREATED,
        entityType: 'Role',
        entityId: created.id,
        actorId: caller.id,
        payload: {
          after: {
            code: created.code,
            label: created.label,
            templateKey: created.templateKey,
            description: created.description,
            isDefault: created.isDefault,
            isSystem: created.isSystem,
          },
        },
      });
      if (created.isDefault) {
        await this.emitDefaultChanged(caller, prevDefaultRoleId, created.id);
      }
    }

    return this.toRoleWithStats(created);
  }

  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    caller?: RoleMutationActor,
  ): Promise<RoleWithStats> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role ${id} introuvable`);
    if (existing.isSystem) {
      throw new ForbiddenException(
        `Le rôle système "${existing.code}" ne peut pas être modifié`,
      );
    }

    const defaultGoingTrue = dto.isDefault === true && !existing.isDefault;
    const defaultGoingFalse = dto.isDefault === false && existing.isDefault;

    // OBS-005 — read the prior default before unsetting it (only on the
    // false→true transition, where the singleton holder is some *other* row).
    let prevDefaultRoleId: string | null = null;
    if (defaultGoingTrue) {
      if (caller) {
        prevDefaultRoleId = await this.captureCurrentDefaultId();
      }
      await this.unsetCurrentDefault();
    }

    // templateKey est immuable après création (cf. TSDoc classe) — on ne
    // le touche jamais, même si le DTO en contenait un (validation DTO le
    // refuse déjà, ce chemin est purement défensif).
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        label: dto.label ?? existing.label,
        description: dto.description ?? existing.description,
        isDefault: dto.isDefault ?? existing.isDefault,
      },
      include: { _count: { select: { users: true } } },
    });

    // OBS-005 — ROLE_UPDATED tracks the free-text descriptive scalars
    // (label, description). `isDefault` is intentionally NOT in this set: its
    // transition is a system-wide singleton shift owned by ROLE_DEFAULT_CHANGED
    // (mirrors OBS-004's dedicated SERVICE_MEMBERSHIP_CHANGED carve-out). No-op
    // DTOs (nothing in the monitored set changed) emit nothing.
    if (caller) {
      const before = { label: existing.label, description: existing.description };
      const after = { label: updated.label, description: updated.description };
      const changed = (['label', 'description'] as const).filter(
        (k) => before[k] !== after[k],
      );
      if (changed.length > 0) {
        await this.auditPersistence.log({
          action: AuditAction.ROLE_UPDATED,
          entityType: 'Role',
          entityId: id,
          actorId: caller.id,
          payload: { before, after, changed },
        });
      }

      if (defaultGoingTrue) {
        await this.emitDefaultChanged(caller, prevDefaultRoleId, id);
      } else if (defaultGoingFalse) {
        // Default removed with no replacement → the system pointer goes to null.
        await this.emitDefaultChanged(caller, id, null);
      }
    }

    return this.toRoleWithStats(updated);
  }

  async deleteRole(id: string, caller?: RoleMutationActor): Promise<void> {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, email: true, firstName: true, lastName: true },
          take: 50,
        },
      },
    });
    if (!existing) throw new NotFoundException(`Role ${id} introuvable`);
    if (existing.isSystem) {
      throw new ForbiddenException(
        `Le rôle système "${existing.code}" ne peut pas être supprimé`,
      );
    }
    if (existing.users.length > 0) {
      const dependents: DependentUser[] = existing.users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
      }));
      throw new ConflictException({
        message: `Le rôle "${existing.code}" est rattaché à ${dependents.length} utilisateur(s) — réassignez-les avant suppression.`,
        users: dependents,
      });
    }

    // OBS-005 — final snapshot to the immutable trail BEFORE the row is erased
    // (DAT-007 PROJECT_DELETED precedent). Plain await, not transactional with
    // the delete, matching the existing emission pattern; the audit pipeline is
    // out of scope. Caller-undefined emits nothing.
    if (caller) {
      await this.auditPersistence.log({
        action: AuditAction.ROLE_DELETED,
        entityType: 'Role',
        entityId: existing.id,
        actorId: caller.id,
        payload: {
          snapshot: {
            id: existing.id,
            code: existing.code,
            label: existing.label,
            templateKey: existing.templateKey,
            description: existing.description,
            isSystem: existing.isSystem,
            isDefault: existing.isDefault,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
          },
        },
      });
    }

    await this.prisma.role.delete({ where: { id } });
    await this.permissionsService.invalidateRoleCache(existing.code);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async unsetCurrentDefault(): Promise<void> {
    await this.prisma.role.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  /**
   * OBS-005 — id of the role currently flagged default (or null). Read before
   * `unsetCurrentDefault` so ROLE_DEFAULT_CHANGED can name the prior holder.
   */
  private async captureCurrentDefaultId(): Promise<string | null> {
    const current = await this.prisma.role.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    return current?.id ?? null;
  }

  /**
   * OBS-005 — emit the system-wide default-role singleton shift. `before`/
   * `after` carry the prior and new default role ids (either may be null: no
   * prior default, or default removed without replacement).
   */
  private async emitDefaultChanged(
    caller: RoleMutationActor,
    fromRoleId: string | null,
    toRoleId: string | null,
  ): Promise<void> {
    await this.auditPersistence.log({
      action: AuditAction.ROLE_DEFAULT_CHANGED,
      entityType: 'Role',
      entityId: toRoleId ?? fromRoleId ?? 'unknown',
      actorId: caller.id,
      payload: {
        before: { defaultRoleId: fromRoleId },
        after: { defaultRoleId: toRoleId },
      },
    });
  }

  private toRoleWithStats(row: {
    id: string;
    code: string;
    label: string;
    templateKey: string;
    description: string | null;
    isSystem: boolean;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { users: number };
  }): RoleWithStats {
    const tpl = ROLE_TEMPLATES[row.templateKey as RoleTemplateKey];
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      templateKey: row.templateKey as RoleTemplateKey,
      description: row.description,
      isSystem: row.isSystem,
      isDefault: row.isDefault,
      userCount: row._count.users,
      permissionsCount: tpl ? tpl.permissions.length : 0,
      category: tpl
        ? tpl.category
        : ('STANDARD_USER' as RoleTemplate['category']),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
