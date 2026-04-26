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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { AssignRACIDto } from './dto/assign-raci.dto';
import {
  ImportTasksDto,
  ImportTasksResultDto,
  TasksValidationPreviewDto,
} from './dto/import-tasks.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { ReorderSubtasksDto } from './dto/reorder-subtasks.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { TaskStatus, RACIRole } from 'database';

@ApiTags('tasks')
@Controller('tasks')
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermissions('tasks:create')
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
    status: 403,
    description: 'Accès interdit (contributeur sur projet ou non-membre)',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet, epic, milestone ou utilisateur introuvable',
  })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.create(createTaskDto, {
      id: user.id,
      role: user.role?.code ?? null,
    });
  }

  @Get()
  @RequirePermissions('tasks:read')
  @ApiOperation({
    summary: 'Récupérer toutes les tâches (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'assigneeId', required: false, type: String })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (ISO 8601)',
  })
  @ApiQuery({
    name: 'overdue',
    required: false,
    type: String,
    description:
      'Filtrer les tâches en retard (endDate < maintenant ET status != DONE)',
  })
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
    @Query('overdue') overdue?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.tasksService.findAll(
      page,
      limit,
      status,
      projectId,
      assigneeId,
      startDate,
      endDate,
      overdue === 'true',
      currentUser
        ? { id: currentUser.id, role: currentUser.role?.code ?? null }
        : undefined,
    );
  }

  @Get('assignee/:userId')
  @RequirePermissions('tasks:read')
  @ApiOperation({
    summary: 'Récupérer toutes les tâches assignées à un utilisateur',
  })
  @ApiResponse({
    status: 200,
    description: "Liste des tâches assignées à l'utilisateur",
  })
  getTasksByAssignee(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.getTasksByAssignee(userId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Get('project/:projectId')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: "Récupérer toutes les tâches d'un projet" })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  getTasksByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.getTasksByProject(projectId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Get('project/:projectId/export')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: "Exporter les tâches d'un projet en CSV" })
  @ApiResponse({ status: 200, description: 'Fichier CSV des tâches' })
  @ApiResponse({ status: 404, description: 'Projet introuvable' })
  async exportProjectTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const { csv, filename } = await this.tasksService.exportProjectTasksCsv(
      projectId,
      {
        id: currentUser.id,
        role: currentUser.role?.code ?? null,
      },
    );
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  }

  @Get('orphans')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer les tâches orphelines (sans projet)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches orphelines',
  })
  findOrphans() {
    return this.tasksService.findOrphans();
  }

  @Get('my/done-undeclared')
  @RequirePermissions('tasks:read')
  @ApiOperation({
    summary: 'Tâches DONE assignées au user courant sans TimeEntry de sa part',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches DONE non déclarées par le user courant',
  })
  getMyDoneUndeclared(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.getMyDoneUndeclaredTasks(user.id);
  }

  @Get(':id')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer une tâche par ID avec tous les détails' })
  @ApiResponse({
    status: 200,
    description: 'Détails complets de la tâche',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.findOne(id, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Patch(':id')
  @RequirePermissions('tasks:update')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.update(
      id,
      updateTaskDto,
      user.id,
      user.role?.code ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermissions('tasks:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une tâche' })
  @ApiResponse({
    status: 200,
    description: 'Tâche supprimée',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer (dépendances)',
  })
  @ApiResponse({
    status: 403,
    description: 'Pas la permission de supprimer cette tâche',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.remove(id, {
      id: user.id,
      role: user.role?.code ?? null,
    });
  }

  @Post(':id/dependencies')
  @RequirePermissions('tasks:update')
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.addDependency(id, addDependencyDto, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Delete(':taskId/dependencies/:dependsOnId')
  @RequirePermissions('tasks:update')
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.removeDependency(taskId, dependsOnId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Post(':id/raci')
  @RequirePermissions('tasks:update')
  @ApiOperation({
    summary: 'Assigner un rôle RACI à un utilisateur pour une tâche',
  })
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.assignRACI(id, assignRACIDto, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Delete(':taskId/raci/:userId/:role')
  @RequirePermissions('tasks:update')
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
    @Param('role') role: RACIRole,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.removeRACI(taskId, userId, role, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Post('project/:projectId/import/validate')
  @RequirePermissions('tasks:create')
  @ApiOperation({ summary: 'Valider des tâches avant import (dry-run)' })
  @ApiResponse({
    status: 200,
    description: "Prévisualisation de l'import",
    type: TasksValidationPreviewDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  validateImport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importTasksDto: ImportTasksDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.validateImport(projectId, importTasksDto.tasks, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Post('project/:projectId/import')
  @RequirePermissions('tasks:create')
  @ApiOperation({ summary: 'Importer des tâches en masse via CSV' })
  @ApiResponse({
    status: 201,
    description: "Résultat de l'import",
    type: ImportTasksResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  importTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importTasksDto: ImportTasksDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.importTasks(projectId, importTasksDto.tasks, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Get('project/:projectId/import-template')
  @RequirePermissions('tasks:read')
  @ApiOperation({
    summary: "Télécharger le template CSV pour l'import de tâches",
  })
  @ApiResponse({
    status: 200,
    description: 'Template CSV',
  })
  getImportTemplate() {
    return { template: this.tasksService.getImportTemplate() };
  }

  @Post(':id/attach-project')
  @RequirePermissions('tasks:update')
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.attachToProject(id, projectId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Post(':id/detach-project')
  @RequirePermissions('tasks:update')
  @ApiOperation({
    summary: 'Détacher une tâche de son projet (rend la tâche orpheline)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tâche détachée du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche introuvable',
  })
  detachFromProject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.detachFromProject(id, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  // ========== SUBTASKS ==========

  @Post(':taskId/subtasks')
  @RequirePermissions('tasks:update')
  @ApiOperation({ summary: 'Ajouter une sous-tâche (checklist item)' })
  @ApiResponse({ status: 201, description: 'Sous-tâche créée' })
  createSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateSubtaskDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.createSubtask(taskId, dto, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Get(':taskId/subtasks')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: 'Lister les sous-tâches' })
  getSubtasks(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.getSubtasks(taskId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Patch(':taskId/subtasks/:subtaskId')
  @RequirePermissions('tasks:update')
  @ApiOperation({
    summary: 'Modifier une sous-tâche (cocher/décocher, renommer)',
  })
  updateSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('subtaskId', ParseUUIDPipe) subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.updateSubtask(taskId, subtaskId, dto, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Delete(':taskId/subtasks/:subtaskId')
  @RequirePermissions('tasks:update')
  @ApiOperation({ summary: 'Supprimer une sous-tâche' })
  deleteSubtask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('subtaskId', ParseUUIDPipe) subtaskId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.deleteSubtask(taskId, subtaskId, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }

  @Post(':taskId/subtasks/reorder')
  @RequirePermissions('tasks:update')
  @ApiOperation({ summary: 'Réordonner les sous-tâches' })
  reorderSubtasks(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ReorderSubtasksDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tasksService.reorderSubtasks(taskId, dto.subtaskIds, {
      id: currentUser.id,
      role: currentUser.role?.code ?? null,
    });
  }
}
