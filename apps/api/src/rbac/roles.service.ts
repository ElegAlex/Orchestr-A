import {
  BadRequestException,
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
import { PermissionsService } from './permissions.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

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
 * (D9 PO) : tentative d'update/delete renvoie 403. Les rôles custom
 * (`isSystem=false`) sont éditables (label, templateKey, description,
 * isDefault).
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
  ) {}

  /**
   * Liste tous les rôles existants en DB (système + custom). Enrichi avec
   * `userCount`, `permissionsCount`, `category` (résolus depuis le template).
   */
  async listRoles(): Promise<RoleWithStats[]> {
    const rows = await this.prisma.roleEntity.findMany({
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
    const row = await this.prisma.roleEntity.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!row) throw new NotFoundException(`Role ${id} introuvable`);
    return this.toRoleWithStats(row);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleWithStats> {
    // Garde-fou : un code identique à un templateKey système → conflit avec
    // l'un des 26 rôles seedés (qui ont code = templateKey).
    const existing = await this.prisma.roleEntity.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Role avec le code "${dto.code}" existe déjà`);
    }

    if (dto.isDefault) {
      await this.unsetCurrentDefault();
    }

    const created = await this.prisma.roleEntity.create({
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
    return this.toRoleWithStats(created);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleWithStats> {
    const existing = await this.prisma.roleEntity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role ${id} introuvable`);
    if (existing.isSystem) {
      throw new ForbiddenException(
        `Le rôle système "${existing.code}" ne peut pas être modifié`,
      );
    }

    if (dto.isDefault === true && !existing.isDefault) {
      await this.unsetCurrentDefault();
    }

    const updated = await this.prisma.roleEntity.update({
      where: { id },
      data: {
        label: dto.label ?? existing.label,
        templateKey: dto.templateKey ?? existing.templateKey,
        description: dto.description ?? existing.description,
        isDefault: dto.isDefault ?? existing.isDefault,
      },
      include: { _count: { select: { users: true } } },
    });

    // Invalider cache si templateKey changé (les permissions effectives changent).
    if (dto.templateKey && dto.templateKey !== existing.templateKey) {
      await this.permissionsService.invalidateRoleCache(updated.code);
    }

    return this.toRoleWithStats(updated);
  }

  async deleteRole(id: string): Promise<void> {
    const existing = await this.prisma.roleEntity.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, firstName: true, lastName: true }, take: 50 } },
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
    await this.prisma.roleEntity.delete({ where: { id } });
    await this.permissionsService.invalidateRoleCache(existing.code);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async unsetCurrentDefault(): Promise<void> {
    await this.prisma.roleEntity.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
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
      category: tpl ? tpl.category : ('STANDARD_USER' as RoleTemplate['category']),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
