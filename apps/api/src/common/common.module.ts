import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OwnershipService } from './services/ownership.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleManagementModule } from '../role-management/role-management.module';

/**
 * Shared cross-cutting providers (ownership enforcement, etc.).
 * PrismaModule is @Global so it does not need to be imported here.
 *
 * OwnershipGuard is registered as a global APP_GUARD — it is opt-in (only
 * activates on routes decorated with @OwnershipCheck), so registering it
 * globally is safe and avoids per-controller @UseGuards boilerplate.
 */
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
  exports: [OwnershipService, OwnershipGuard],
})
export class CommonModule {}
