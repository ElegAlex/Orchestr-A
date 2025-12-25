import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { AssignRACIDto } from './dto/assign-raci.dto';
import { ImportTasksDto, ImportTasksResultDto, TasksValidationPreviewDto } from './dto/import-tasks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, TaskStatus } from 'database';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CONTRIBUTEUR)
  @ApiOperation({ summary: 'Créer une nouvelle tâche' })
  @ApiResponse({
    status: 201,
    description: 'Tâche créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet, epic, milestone ou utilisateur introuvable',
  })
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les tâches (avec pagination et filtres)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'assigneeId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Date de début (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Date de fin (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('status') status?: TaskStatus,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tasksService.findAll(page, limit, status, projectId, assigneeId, startDate, endDate);
  }

  @Get('assignee/:userId')
  @ApiOperation({ summary: 'Récupérer toutes les tâches assignées à un utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches assignées à l\'utilisateur',
  })
  getTasksByAssignee(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.tasksService.getTasksByAssignee(userId);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Récupérer toutes les tâches d\'un projet' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  getTasksByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.tasksService.getTasksByProject(projectId);
  }

  @Get('orphans')
  @ApiOperation({ summary: 'Récupérer les tâches orphelines (sans projet)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches orphelines',
  })
  findOrphans() {
    return this.tasksService.findOrphans();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une tâche par ID avec tous les détails' })
  @ApiResponse({
    status: 200,
    description: 'Détails complets de la tâche',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CONTRIBUTEUR)
  @ApiOperation({ summary: 'Mettre à jour une tâche' })
  @ApiResponse({
    status: 200,
    description: 'Tâche mise à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une tâche (Admin/Responsable/Manager)' })
  @ApiResponse({
    status: 200,
    description: 'Tâche supprimée',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer (dépendances)',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/dependencies')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Ajouter une dépendance à une tâche' })
  @ApiResponse({
    status: 201,
    description: 'Dépendance ajoutée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Dépendance circulaire ou projet différent',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Dépendance déjà existante',
  })
  addDependency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addDependencyDto: AddDependencyDto,
  ) {
    return this.tasksService.addDependency(id, addDependencyDto);
  }

  @Delete(':taskId/dependencies/:dependsOnId')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une dépendance' })
  @ApiResponse({
    status: 200,
    description: 'Dépendance supprimée',
  })
  @ApiResponse({
    status: 404,
    description: 'Dépendance introuvable',
  })
  removeDependency(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('dependsOnId', ParseUUIDPipe) dependsOnId: string,
  ) {
    return this.tasksService.removeDependency(taskId, dependsOnId);
  }

  @Post(':id/raci')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Assigner un rôle RACI à un utilisateur pour une tâche' })
  @ApiResponse({
    status: 201,
    description: 'Rôle RACI assigné avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche ou utilisateur introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Assignation RACI déjà existante',
  })
  assignRACI(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRACIDto: AssignRACIDto,
  ) {
    return this.tasksService.assignRACI(id, assignRACIDto);
  }

  @Delete(':taskId/raci/:userId/:role')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une assignation RACI' })
  @ApiResponse({
    status: 200,
    description: 'Assignation RACI supprimée',
  })
  @ApiResponse({
    status: 404,
    description: 'Assignation RACI introuvable',
  })
  removeRACI(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: string,
  ) {
    return this.tasksService.removeRACI(taskId, userId, role);
  }

  @Post('project/:projectId/import/validate')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Valider des tâches avant import (dry-run)' })
  @ApiResponse({
    status: 200,
    description: 'Prévisualisation de l\'import',
    type: TasksValidationPreviewDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  validateImport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importTasksDto: ImportTasksDto,
  ) {
    return this.tasksService.validateImport(projectId, importTasksDto.tasks);
  }

  @Post('project/:projectId/import')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Importer des tâches en masse via CSV' })
  @ApiResponse({
    status: 201,
    description: 'Résultat de l\'import',
    type: ImportTasksResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  importTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importTasksDto: ImportTasksDto,
  ) {
    return this.tasksService.importTasks(projectId, importTasksDto.tasks);
  }

  @Get('project/:projectId/import-template')
  @ApiOperation({ summary: 'Télécharger le template CSV pour l\'import de tâches' })
  @ApiResponse({
    status: 200,
    description: 'Template CSV',
  })
  getImportTemplate() {
    return { template: this.tasksService.getImportTemplate() };
  }

  @Post(':id/attach-project')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.REFERENT_TECHNIQUE)
  @ApiOperation({ summary: 'Rattacher une tâche orpheline à un projet' })
  @ApiResponse({
    status: 200,
    description: 'Tâche rattachée au projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche ou projet introuvable',
  })
  attachToProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.tasksService.attachToProject(id, projectId);
  }

  @Post(':id/detach-project')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.REFERENT_TECHNIQUE)
  @ApiOperation({ summary: 'Détacher une tâche de son projet (rend la tâche orpheline)' })
  @ApiResponse({
    status: 200,
    description: 'Tâche détachée du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  detachFromProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.detachFromProject(id);
  }
}
