import { Module } from '@nestjs/common';
import { PredefinedTasksService } from './predefined-tasks.service';
import { PredefinedTasksController } from './predefined-tasks.controller';
import { AuditModule } from '../audit/audit.module';
import { PlanningBalancerService } from './planning-balancer.service';
import { LeavesModule } from '../leaves/leaves.module';

@Module({
  imports: [AuditModule, LeavesModule],
  controllers: [PredefinedTasksController],
  providers: [PredefinedTasksService, PlanningBalancerService],
  exports: [PredefinedTasksService],
})
export class PredefinedTasksModule {}
