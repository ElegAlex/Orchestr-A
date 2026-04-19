import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import {
  ImportMilestonesDto,
  ImportMilestonesResultDto,
  MilestonesValidationPreviewDto,
} from './dto/import-milestones.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MilestoneStatus } from 'database';

@ApiTags('milestones')
@Controller('milestones')
@ApiBearerAuth()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @RequirePermissions('milestones:create')
  @ApiOperation({ summary: 'Créer un milestone' })
  @ApiResponse({ status: 201, description: 'Milestone créé' })
  create(@Body() createMilestoneDto: CreateMilestoneDto) {
    return this.milestonesService.create(createMilestoneDto);
  }

  @Get()
  @RequirePermissions('milestones:read')
  @ApiOperation({ summary: 'Liste des milestones' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: MilestoneStatus })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('projectId') projectId?: string,
    @Query('status') status?: MilestoneStatus,
  ) {
    return this.milestonesService.findAll(page, limit, projectId, status);
  }

  @Get(':id')
  @RequirePermissions('milestones:read')
  @ApiOperation({ summary: "Détails d'un milestone" })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('milestones:update')
  @ApiOperation({ summary: 'Modifier un milestone' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    return this.milestonesService.update(id, updateMilestoneDto, currentUserId, currentUserRole);
  }

  @Post(':id/complete')
  @RequirePermissions('milestones:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer un milestone comme complété' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.complete(id);
  }

  @Delete(':id')
  @RequirePermissions('milestones:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un milestone' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    return this.milestonesService.remove(id, currentUserId, currentUserRole);
  }

  @Post('project/:projectId/import/validate')
  @RequirePermissions('milestones:create')
  @ApiOperation({ summary: 'Valider des jalons avant import (dry-run)' })
  @ApiResponse({
    status: 200,
    description: "Prévisualisation de l'import",
    type: MilestonesValidationPreviewDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  validateImport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importMilestonesDto: ImportMilestonesDto,
  ) {
    return this.milestonesService.validateImport(
      projectId,
      importMilestonesDto.milestones,
    );
  }

  @Post('project/:projectId/import')
  @RequirePermissions('milestones:create')
  @ApiOperation({ summary: 'Importer des jalons en masse via CSV' })
  @ApiResponse({
    status: 201,
    description: "Résultat de l'import",
    type: ImportMilestonesResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  importMilestones(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importMilestonesDto: ImportMilestonesDto,
  ) {
    return this.milestonesService.importMilestones(
      projectId,
      importMilestonesDto.milestones,
    );
  }

  @Get('project/:projectId/export')
  @RequirePermissions('milestones:read')
  @ApiOperation({ summary: "Exporter les jalons d'un projet en CSV" })
  @ApiResponse({ status: 200, description: 'Fichier CSV des jalons' })
  @ApiResponse({ status: 404, description: 'Projet introuvable' })
  async exportProjectMilestones(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() reply: FastifyReply,
  ) {
    const { csv, filename } =
      await this.milestonesService.exportProjectMilestonesCsv(projectId);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  }

  @Get('project/:projectId/import-template')
  @RequirePermissions('milestones:read')
  @ApiOperation({
    summary: "Télécharger le template CSV pour l'import de jalons",
  })
  @ApiResponse({
    status: 200,
    description: 'Template CSV',
  })
  getImportTemplate() {
    return { template: this.milestonesService.getImportTemplate() };
  }
}
