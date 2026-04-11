import { Module } from '@nestjs/common';
import { RoleManagementModule } from '../role-management/role-management.module';
import { ProjectsThirdPartyMembersController } from './projects-third-party-members.controller';
import { TasksThirdPartyAssigneesController } from './tasks-third-party-assignees.controller';
import { ThirdPartiesController } from './third-parties.controller';
import { ThirdPartiesService } from './third-parties.service';

@Module({
  imports: [RoleManagementModule],
  controllers: [
    ThirdPartiesController,
    TasksThirdPartyAssigneesController,
    ProjectsThirdPartyMembersController,
  ],
  providers: [ThirdPartiesService],
  exports: [ThirdPartiesService],
})
export class ThirdPartiesModule {}
