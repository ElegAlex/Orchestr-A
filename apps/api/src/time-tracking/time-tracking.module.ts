import { Module } from '@nestjs/common';
import { RoleManagementModule } from '../role-management/role-management.module';
import { ThirdPartiesModule } from '../third-parties/third-parties.module';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';

@Module({
  imports: [ThirdPartiesModule, RoleManagementModule],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
