import { Module } from '@nestjs/common';
import { RoleManagementModule } from '../role-management/role-management.module';
import { ThirdPartiesModule } from '../third-parties/third-parties.module';
import { CommonModule } from '../common/common.module';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';

@Module({
  imports: [ThirdPartiesModule, RoleManagementModule, CommonModule],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
