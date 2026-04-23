import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ClientsService } from './clients.service';

class AssignClientToProjectDto {
  @ApiProperty({ description: 'UUID du client à rattacher' })
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;
}

@ApiTags('clients')
@ApiBearerAuth()
@Controller('projects/:projectId/clients')
export class ProjectsClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients:read')
  @ApiOperation({ summary: 'Lister les clients rattachés à un projet' })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.clientsService.listProjectClients(projectId);
  }

  @Post()
  @RequirePermissions('clients:assign_to_project')
  @ApiOperation({ summary: 'Rattacher un client à un projet' })
  @ApiResponse({ status: 201, description: 'Client rattaché' })
  @ApiResponse({ status: 400, description: 'Client déjà rattaché ou archivé' })
  @ApiResponse({ status: 404, description: 'Projet ou client introuvable' })
  assign(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AssignClientToProjectDto,
  ) {
    return this.clientsService.assignClientToProject(projectId, dto.clientId);
  }

  @Delete(':clientId')
  @RequirePermissions('clients:assign_to_project')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Détacher un client d'un projet" })
  @ApiResponse({ status: 204, description: 'Rattachement supprimé' })
  @ApiResponse({ status: 404, description: 'Rattachement introuvable' })
  async detach(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    await this.clientsService.removeClientFromProject(projectId, clientId);
  }
}
