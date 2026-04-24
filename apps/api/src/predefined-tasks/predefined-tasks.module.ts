import { Module } from '@nestjs/common';
import { PredefinedTasksService } from './predefined-tasks.service';
import { PredefinedTasksController } from './predefined-tasks.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PredefinedTasksController],
  providers: [PredefinedTasksService],
  exports: [PredefinedTasksService],
})
export class PredefinedTasksModule {}
