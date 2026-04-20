import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  ROLE_TEMPLATES,
  type PermissionCode,
  type RoleTemplateKey,
} from 'rbac';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service RBAC central — RBAC V4.
 *
 * Résout `roleCode → permissions` :
 *   DB `roles.code` → `roles.templateKey` →
 *   `ROLE_TEMPLATES[templateKey].permissions` (in-memory, immutable).
 *
 * Cache Redis partagé : clé `role-permissions:<roleCode>` TTL 5min. Fail-soft
 * sur erreur Redis (warning + exécution continue).
 *
 * Convention : seule source de vérité pour les lookups RBAC. Aucun fallback
 * legacy — l'ancien `RoleManagementService` (table role_configs /
 * role_permissions) a été supprimé en V4.
 */
@Injectable()
export class PermissionsService {
  private readonly redis: Redis;
  private readonly CACHE_TTL = 300;
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      this.redis = new Redis({ host, port, password: password || undefined });
    }
  }

  /**
   * Résout les permissions d'un rôle par son code.
   *
   * Lookup ordre :
   *   1. Cache Redis `role-permissions:<roleCode>`.
   *   2. Table `roles` (templateKey → ROLE_TEMPLATES).
   *
   * Retourne tableau vide si rôle inconnu.
   */
  async getPermissionsForRole(
    roleCode: string | null | undefined,
  ): Promise<readonly PermissionCode[]> {
    if (!roleCode) return [];

    const cacheKey = `role-permissions:${roleCode}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as readonly PermissionCode[];
      }
    } catch (error) {
      console.warn('[PermissionsService] Redis read error:', error);
    }

    try {
      const role = await this.prisma.role.findUnique({
        where: { code: roleCode },
        select: { templateKey: true },
      });
      if (role) {
        const templateKey = role.templateKey as RoleTemplateKey;
        const tpl = ROLE_TEMPLATES[templateKey];
        if (tpl) {
          const perms = [...tpl.permissions];
          this.logger.debug(
            `[RBAC v4] ${roleCode} → ${templateKey}: ${perms.length} perms (template)`,
          );
          await this.cacheSet(cacheKey, perms);
          return perms;
        }
        this.logger.warn(
          `[RBAC v4] ${roleCode} a templateKey="${templateKey}" inconnu — retour []`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[RBAC v4] erreur lookup roles pour ${roleCode}: ${(error as Error).message}`,
      );
    }

    return [];
  }

  /**
   * Résout les permissions d'un user. Post-V4 la relation `user.role` est
   * l'objet `Role` Prisma (ou null).
   */
  async getPermissionsForUser(user: {
    role?: { code: string } | null;
  }): Promise<readonly PermissionCode[]> {
    const code = user.role?.code ?? null;
    if (!code) return [];
    return this.getPermissionsForRole(code);
  }

  /**
   * Vérifie si le rôle possède **toutes** les permissions demandées
   * (sémantique AND).
   */
  async roleHasAll(
    roleCode: string | null | undefined,
    required: readonly PermissionCode[],
  ): Promise<boolean> {
    if (required.length === 0) return true;
    const perms = await this.getPermissionsForRole(roleCode);
    const set = new Set<string>(perms);
    return required.every((p) => set.has(p));
  }

  /**
   * Vérifie si le rôle possède **au moins une** des permissions demandées
   * (sémantique OR).
   */
  async roleHasAny(
    roleCode: string | null | undefined,
    required: readonly PermissionCode[],
  ): Promise<boolean> {
    if (required.length === 0) return true;
    const perms = await this.getPermissionsForRole(roleCode);
    const set = new Set<string>(perms);
    return required.some((p) => set.has(p));
  }

  /**
   * Invalide le cache Redis d'un rôle. À appeler après mutation
   * (changement templateKey via `RolesService`, suppression rôle).
   */
  async invalidateRoleCache(roleCode: string): Promise<void> {
    try {
      await this.redis.del(`role-permissions:${roleCode}`);
    } catch (error) {
      console.warn('[PermissionsService] Redis del error:', error);
    }
  }

  private async cacheSet(
    key: string,
    perms: readonly PermissionCode[],
  ): Promise<void> {
    try {
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(perms));
    } catch (error) {
      console.warn('[PermissionsService] Redis write error:', error);
    }
  }
}
