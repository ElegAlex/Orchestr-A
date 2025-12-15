import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ImportMilestonesDto, ImportMilestonesResultDto, MilestonesValidationPreviewDto } from './dto/import-milestones.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, MilestoneStatus } from 'database';

@ApiTags('milestones')
@Controller('milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Créer un milestone' })
  @ApiResponse({ status: 201, description: 'Milestone créé' })
  create(@Body() createMilestoneDto: CreateMilestoneDto) {
    return this.milestonesService.create(createMilestoneDto);
  }

  @Get()
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
  @ApiOperation({ summary: 'Détails d\'un milestone' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Modifier un milestone' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMilestoneDto: UpdateMilestoneDto) {
    return this.milestonesService.update(id, updateMilestoneDto);
  }

  @Post(':id/complete')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer un milestone comme complété' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.complete(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un milestone' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.remove(id);
  }

  @Post('project/:projectId/import/validate')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Valider des jalons avant import (dry-run)' })
  @ApiResponse({
    status: 200,
    description: 'Prévisualisation de l\'import',
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
    return this.milestonesService.validateImport(projectId, importMilestonesDto.milestones);
  }

  @Post('project/:projectId/import')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Importer des jalons en masse via CSV' })
  @ApiResponse({
    status: 201,
    description: 'Résultat de l\'import',
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
    return this.milestonesService.importMilestones(projectId, importMilestonesDto.milestones);
  }

  @Get('project/:projectId/import-template')
  @ApiOperation({ summary: 'Télécharger le template CSV pour l\'import de jalons' })
  @ApiResponse({
    status: 200,
    description: 'Template CSV',
  })
  getImportTemplate() {
    return { template: this.milestonesService.getImportTemplate() };
  }
}
