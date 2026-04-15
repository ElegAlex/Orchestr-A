import { Module } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { TasksModule } from '../tasks/tasks.module';
import { LeavesModule } from '../leaves/leaves.module';
import { EventsModule } from '../events/events.module';
import { TeleworkModule } from '../telework/telework.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { SchoolVacationsModule } from '../school-vacations/school-vacations.module';
import { PredefinedTasksModule } from '../predefined-tasks/predefined-tasks.module';
import { RoleManagementModule } from '../role-management/role-management.module';

@Module({
  imports: [
    UsersModule,
    ServicesModule,
    TasksModule,
    LeavesModule,
    EventsModule,
    TeleworkModule,
    HolidaysModule,
    SchoolVacationsModule,
    PredefinedTasksModule,
    RoleManagementModule,
  ],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
