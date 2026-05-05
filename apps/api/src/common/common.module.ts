import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OwnershipService } from './services/ownership.service';
import { AccessScopeService } from './services/access-scope.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { RbacModule } from '../rbac/rbac.module';

@Global()
@Module({
  // RbacModule importé pour OwnershipGuard (PermissionsService).
  imports: [RbacModule],
  providers: [
    OwnershipService,
    AccessScopeService,
    RoleHierarchyService,
    OwnershipGuard,
    {
      provide: APP_GUARD,
      useClass: OwnershipGuard,
    },
  ],
  exports: [
    OwnershipService,
    AccessScopeService,
    RoleHierarchyService,
    OwnershipGuard,
    RbacModule,
  ],
})
export class CommonModule {}
