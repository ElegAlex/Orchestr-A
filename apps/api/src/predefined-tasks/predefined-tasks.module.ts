import { Module } from '@nestjs/common';
import { PredefinedTasksService } from './predefined-tasks.service';
import { PredefinedTasksController } from './predefined-tasks.controller';

@Module({
  controllers: [PredefinedTasksController],
  providers: [PredefinedTasksService],
  exports: [PredefinedTasksService],
})
export class PredefinedTasksModule {}
