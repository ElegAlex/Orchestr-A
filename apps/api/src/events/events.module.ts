import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { RoleManagementModule } from '../role-management/role-management.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [RoleManagementModule, CommonModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
