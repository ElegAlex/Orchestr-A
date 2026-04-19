import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OwnershipService } from './services/ownership.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleManagementModule } from '../role-management/role-management.module';
import { RbacModule } from '../rbac/rbac.module';

@Global()
@Module({
  // V1 C : RbacModule importé pour OwnershipGuard (PermissionsService).
  // RoleManagementModule conservé : utilisé par PermissionsGuard legacy +
  // fallback du nouveau PermissionsService.
  imports: [RoleManagementModule, RbacModule],
  providers: [
    OwnershipService,
    OwnershipGuard,
    {
      provide: APP_GUARD,
      useClass: OwnershipGuard,
    },
  ],
  exports: [OwnershipService, OwnershipGuard, RoleManagementModule, RbacModule],
})
export class CommonModule {}
