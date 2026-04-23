import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode } from 'rbac';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ALLOW_SELF_SERVICE_KEY } from './decorators/allow-self-service.decorator';
import {
  REQUIRE_PERMISSIONS_KEY,
  REQUIRE_ANY_PERMISSION_KEY,
} from './decorators/require-permissions.decorator';
import { PermissionsService } from './permissions.service';

/**
 * Mode opératoire du PermissionsGuard zero-trust (arbitrage D2 PO).
 *
 *  - 'permissive' : ne refuse rien — log les routes qui DEVRAIENT être
 *    refusées (utilisé pendant la phase de migration V2 (a) avant le
 *    hard-fail).
 *  - 'enforce' : refuse les routes non couvertes par `@Public()`,
 *    `@RequirePermissions(...)`, `@RequireAnyPermission(...)` ou
 *    `@AllowSelfService()`. Mode cible post-V2.
 *
 * Configuration via env `RBAC_GUARD_MODE` (default: 'permissive' tant que
 * V2 n'est pas finalisé).
 */
export type RbacGuardMode = 'permissive' | 'enforce';

interface RequestUser {
  id?: string;
  role?: { code: string; templateKey: string } | null;
}

/**
 * PermissionsGuardV2 — guard RBAC zero-trust de Spec 2 (V1 C, activé V2 i).
 *
 * Logique :
 *   1. `@Public()` → allow.
 *   2. `@AllowSelfService()` → allow (allowlist routes /me/* etc., contrôle
 *      d'accès par périmètre délégué au service).
 *   3. `@RequirePermissions(...)` (AND) → checke que toutes les perms sont
 *      dans le set du rôle.
 *   4. `@RequireAnyPermission(...)` (OR) → checke qu'au moins une perm matche.
 *   5. Aucune des trois → en mode 'enforce' refuse, en mode 'permissive' log
 *      et autorise.
 *
 * Préserve les contrats SEC-03 (S1-S5) et P1-P8 du contract-04 §1 :
 *   - Source unique de rôle : `request.user.role.code` (relation Prisma,
 *     jamais body/headers).
 *   - User absent / role absent → false.
 *   - `@RequirePermissions([])` (vide) → allow (P2).
 *   - Cache Redis transparent (délégué à PermissionsService) (P6).
 *
 * Statut V1 : créé, non enregistré comme APP_GUARD. Activation V2.
 */
@Injectable()
export class PermissionsGuardV2 implements CanActivate {
  private readonly logger = new Logger(PermissionsGuardV2.name);
  private readonly mode: RbacGuardMode;

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {
    const envMode = process.env.RBAC_GUARD_MODE;
    this.mode = envMode === 'enforce' ? 'enforce' : 'permissive';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const klass = context.getClass();

    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, klass])
    ) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(ALLOW_SELF_SERVICE_KEY, [
        handler,
        klass,
      ])
    ) {
      return true;
    }

    const requireAll = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRE_PERMISSIONS_KEY,
      [handler, klass],
    );
    const requireAny = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRE_ANY_PERMISSION_KEY,
      [handler, klass],
    );

    const hasAll = requireAll && requireAll.length > 0;
    const hasAny = requireAny && requireAny.length > 0;

    if (!hasAll && !hasAny) {
      // Route non couverte par décorateur RBAC.
      const routeId = `${klass?.name ?? '?'}.${(handler as unknown as { name: string })?.name ?? '?'}`;
      if (this.mode === 'enforce') {
        this.logger.warn(
          `[RBAC enforce] route refusée (sans @RequirePermissions ni @AllowSelfService) : ${routeId}`,
        );
        return false;
      }
      this.logger.warn(
        `[RBAC permissive] route SERAIT refusée en enforce (manque décorateur RBAC) : ${routeId}`,
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request?.user;
    if (!user || !user.role) {
      return false;
    }

    const perms = await this.permissionsService.getPermissionsForUser(user);
    const set = new Set<string>(perms);

    if (hasAll) {
      for (const p of requireAll) {
        if (!set.has(p)) return false;
      }
    }
    if (hasAny) {
      let matched = false;
      for (const p of requireAny) {
        if (set.has(p)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }
}
