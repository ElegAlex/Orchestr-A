import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OWNERSHIP_METADATA,
  OwnershipCheckOptions,
} from '../decorators/ownership-check.decorator';
import { OwnershipService } from '../services/ownership.service';
import { PermissionsService } from '../../rbac/permissions.service';

/**
 * Opt-in guard that enforces per-resource ownership. Activates only for routes
 * decorated with @OwnershipCheck(...). Must run AFTER JwtAuthGuard so that
 * request.user is populated.
 *
 * Flow:
 *   1. Read @OwnershipCheck metadata; no metadata → allow (guard is opt-in).
 *   2. Require an authenticated user (else 401).
 *   3. Read the resource id from request.params[paramKey] (else 400).
 *   4. If bypassPermission is present on the user's role → allow.
 *   5. Delegate to OwnershipService.isOwner; on false → 403.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ownershipService: OwnershipService,
    // V1 C : bascule sur PermissionsService nouveau (template-based, fallback
    // legacy intégré). Inclut documents:manage_any (D6 #4).
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<
      OwnershipCheckOptions | undefined
    >(OWNERSHIP_METADATA, [context.getHandler(), context.getClass()]);

    if (!opts) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const paramKey = opts.paramKey ?? 'id';
    const resourceId: string | undefined = request.params?.[paramKey];
    if (!resourceId) {
      throw new BadRequestException(
        `Missing required route parameter "${paramKey}"`,
      );
    }

    if (opts.bypassPermission) {
      // PermissionsService accepte soit user.roleEntity.code (post-refactor),
      // soit user.role (enum legacy). Path nouveau utilisé pour les codes
      // qui matchent un templateKey (ADMIN, MANAGER, ...) ; fallback legacy
      // pour les autres (CONTRIBUTEUR, RESPONSABLE, etc.) jusqu'à V2.
      const permissions = await this.permissionsService.getPermissionsForUser(user);
      if ((permissions as readonly string[]).includes(opts.bypassPermission)) {
        return true;
      }
    }

    const isOwner = await this.ownershipService.isOwner(
      opts.resource,
      resourceId,
      user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('Resource ownership violation');
    }

    return true;
  }
}
