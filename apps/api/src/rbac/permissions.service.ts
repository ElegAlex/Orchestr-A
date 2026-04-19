import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  ROLE_TEMPLATES,
  type PermissionCode,
  type RoleTemplateKey,
} from 'rbac';
import { PrismaService } from '../prisma/prisma.service';
import { RoleManagementService } from '../role-management/role-management.service';

/**
 * Service RBAC central — Spec 2 V1 C.
 *
 * Résout `roleCode → permissions` via deux paths :
 *
 *  (1) Path nouveau : DB `roles.code` → `roles.templateKey` →
 *      `ROLE_TEMPLATES[templateKey].permissions` (in-memory, immutable).
 *      C'est le path "post-refactor" — utilisé pour les rôles créés par
 *      la nouvelle table (les 26 templates système + custom).
 *
 *  (2) Path fallback : `RoleManagementService.getPermissionsForRole(roleCode)`
 *      — ancien système (table role_configs + role_permissions). Utilisé
 *      pendant la transition V1→V4 pour les codes legacy non encore migrés
 *      (CONTRIBUTEUR, RESPONSABLE, etc.) que le code applicatif lit depuis
 *      `User.role` enum.
 *
 * Cache Redis partagé : clé `role-permissions:<roleCode>` TTL 5min, identique
 * à l'ancien service pour préserver l'invalidation. Fail-soft sur erreur Redis
 * (warning console, exécution continue).
 *
 * Convention : ce service est la SEULE source à utiliser pour de nouveaux
 * appels RBAC. L'ancien `RoleManagementService.getPermissionsForRole` reste
 * appelé par les guards legacy (`PermissionsGuard` actuel) jusqu'à V2 où
 * tout bascule sur ce service.
 */
@Injectable()
export class PermissionsService {
  private readonly redis: Redis;
  private readonly CACHE_TTL = 300;
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly legacy: RoleManagementService,
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
   *   2. Table `roles` (path nouveau, templateKey → ROLE_TEMPLATES).
   *   3. Fallback `RoleManagementService.getPermissionsForRole` (legacy).
   *
   * Retourne tableau vide si rôle inconnu (compatible avec contrat actuel).
   */
  async getPermissionsForRole(
    roleCode: string,
  ): Promise<readonly PermissionCode[]> {
    const cacheKey = `role-permissions:${roleCode}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as readonly PermissionCode[];
      }
    } catch (error) {
      console.warn('[PermissionsService] Redis read error:', error);
    }

    // (2) Path nouveau : table roles
    try {
      const role = await this.prisma.roleEntity.findUnique({
        where: { code: roleCode },
        select: { templateKey: true },
      });
      if (role) {
        const templateKey = role.templateKey as RoleTemplateKey;
        const tpl = ROLE_TEMPLATES[templateKey];
        if (tpl) {
          const perms = [...tpl.permissions];
          this.logger.debug(
            `[RBAC v2] ${roleCode} → ${templateKey}: ${perms.length} perms (template)`,
          );
          await this.cacheSet(cacheKey, perms);
          return perms;
        }
        // templateKey orphelin (rare) : log warning + fallback
        this.logger.warn(
          `[RBAC v2] ${roleCode} a templateKey="${templateKey}" inconnu — fallback legacy`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[RBAC v2] erreur lookup roles pour ${roleCode}: ${(error as Error).message} — fallback legacy`,
      );
    }

    // (3) Fallback legacy
    const legacyPerms = await this.legacy.getPermissionsForRole(roleCode);
    return legacyPerms as readonly PermissionCode[];
  }

  /**
   * Résout les permissions d'un user. Préfère `user.roleEntity.code` si la
   * relation est chargée (post-refactor V0), sinon retombe sur l'enum legacy
   * `user.role`.
   */
  async getPermissionsForUser(user: {
    role?: string | null;
    roleEntity?: { code: string } | null;
  }): Promise<readonly PermissionCode[]> {
    const code = user.roleEntity?.code ?? user.role ?? null;
    if (!code) return [];
    return this.getPermissionsForRole(code);
  }

  /**
   * Vérifie si le rôle possède **toutes** les permissions demandées
   * (sémantique AND).
   */
  async roleHasAll(
    roleCode: string,
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
    roleCode: string,
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
