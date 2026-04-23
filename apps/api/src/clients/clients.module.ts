import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ProjectsClientsController } from './projects-clients.controller';

@Module({
  controllers: [ClientsController, ProjectsClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
