import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OwnershipService } from './services/ownership.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleManagementModule } from '../role-management/role-management.module';

@Global()
@Module({
  imports: [RoleManagementModule],
  providers: [
    OwnershipService,
    OwnershipGuard,
    {
      provide: APP_GUARD,
      useClass: OwnershipGuard,
    },
  ],
  exports: [OwnershipService, OwnershipGuard, RoleManagementModule],
})
export class CommonModule {}
