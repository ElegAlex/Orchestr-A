import { Module } from '@nestjs/common';
import { OwnershipService } from './services/ownership.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleManagementModule } from '../role-management/role-management.module';

/**
 * Shared cross-cutting providers (ownership enforcement, etc.).
 * PrismaModule is @Global so it does not need to be imported here.
 */
@Module({
  imports: [RoleManagementModule],
  providers: [OwnershipService, OwnershipGuard],
  exports: [OwnershipService, OwnershipGuard],
})
export class CommonModule {}
