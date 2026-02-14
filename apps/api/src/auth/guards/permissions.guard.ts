import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleManagementService } from '../../role-management/role-management.service';

interface AuthenticatedRequest {
  user: User;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private roleManagementService: RoleManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si pas de @Permissions(), on ne bloque pas (le RolesGuard s'en charge)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    const userPermissions =
      await this.roleManagementService.getPermissionsForRole(user.role);

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
