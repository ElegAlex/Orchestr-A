import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { CommonModule } from '../common/common.module';
import { RoleManagementModule } from '../role-management/role-management.module';

@Module({
  imports: [CommonModule, RoleManagementModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
