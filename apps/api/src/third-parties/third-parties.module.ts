import { Module } from '@nestjs/common';
import { ProjectsThirdPartyMembersController } from './projects-third-party-members.controller';
import { TasksThirdPartyAssigneesController } from './tasks-third-party-assignees.controller';
import { ThirdPartiesController } from './third-parties.controller';
import { ThirdPartiesService } from './third-parties.service';

@Module({
  controllers: [
    ThirdPartiesController,
    TasksThirdPartyAssigneesController,
    ProjectsThirdPartyMembersController,
  ],
  providers: [ThirdPartiesService],
  exports: [ThirdPartiesService],
})
export class ThirdPartiesModule {}
