import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { DepartmentsModule } from './departments/departments.module';
import { ServicesModule } from './services/services.module';
import { LeavesModule } from './leaves/leaves.module';
import { LeaveTypesModule } from './leave-types/leave-types.module';
import { TeleworkModule } from './telework/telework.module';
import { SkillsModule } from './skills/skills.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { EpicsModule } from './epics/epics.module';
import { MilestonesModule } from './milestones/milestones.module';
import { DocumentsModule } from './documents/documents.module';
import { CommentsModule } from './comments/comments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PersonalTodosModule } from './personal-todos/personal-todos.module';
import { SettingsModule } from './settings/settings.module';
import { HolidaysModule } from './holidays/holidays.module';
import { EventsModule } from './events/events.module';
import { RoleManagementModule } from './role-management/role-management.module';
import { PlanningExportModule } from './planning-export/planning-export.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuditModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    DepartmentsModule,
    ServicesModule,
    LeavesModule,
    LeaveTypesModule,
    TeleworkModule,
    SkillsModule,
    TimeTrackingModule,
    EpicsModule,
    MilestonesModule,
    DocumentsModule,
    CommentsModule,
    AnalyticsModule,
    PersonalTodosModule,
    SettingsModule,
    HolidaysModule,
    EventsModule,
    RoleManagementModule,
    PlanningExportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
