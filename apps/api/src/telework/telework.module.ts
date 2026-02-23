import { Module } from '@nestjs/common';
import { TeleworkService } from './telework.service';
import { TeleworkController } from './telework.controller';
import { RoleManagementModule } from '../role-management/role-management.module';

@Module({
  imports: [RoleManagementModule],
  controllers: [TeleworkController],
  providers: [TeleworkService],
  exports: [TeleworkService],
})
export class TeleworkModule {}
