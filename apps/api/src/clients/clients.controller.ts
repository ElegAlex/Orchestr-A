import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequirePermissions('clients:create')
  @ApiOperation({ summary: 'Créer un client commanditaire' })
  @ApiResponse({ status: 201, description: 'Client créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  @RequirePermissions('clients:read')
  @ApiOperation({ summary: 'Lister les clients (paginé)' })
  findAll(@Query() query: QueryClientsDto) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('clients:read')
  @ApiOperation({ summary: "Détail d'un client" })
  @ApiResponse({ status: 404, description: 'Client introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Get(':id/projects')
  @RequirePermissions('clients:read', 'projects:read')
  @ApiOperation({ summary: 'Projets du client + synthèse heures' })
  @ApiResponse({ status: 404, description: 'Client introuvable' })
  getClientProjects(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getClientProjects(id);
  }

  @Get(':id/deletion-impact')
  @RequirePermissions('clients:delete')
  @ApiOperation({
    summary: 'Compter les projets rattachés au client (pre-delete check)',
  })
  @ApiResponse({ status: 404, description: 'Client introuvable' })
  getDeletionImpact(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getDeletionImpact(id);
  }

  @Patch(':id')
  @RequirePermissions('clients:update')
  @ApiOperation({ summary: 'Modifier un client (nom, isActive)' })
  @ApiResponse({ status: 404, description: 'Client introuvable' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer un client en hard delete (refuse si des projets sont rattachés — 409)',
  })
  @ApiResponse({ status: 204, description: 'Client supprimé' })
  @ApiResponse({ status: 404, description: 'Client introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Client lié à un ou plusieurs projets',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.hardDelete(id);
  }
}
