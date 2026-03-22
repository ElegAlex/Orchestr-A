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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PredefinedTasksService } from './predefined-tasks.service';
import { CreatePredefinedTaskDto } from './dto/create-predefined-task.dto';
import { UpdatePredefinedTaskDto } from './dto/update-predefined-task.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { BulkAssignmentDto } from './dto/bulk-assignment.dto';
import {
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  GenerateFromRulesDto,
} from './dto/create-recurring-rule.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('predefined-tasks')
@Controller('predefined-tasks')
@ApiBearerAuth()
export class PredefinedTasksController {
  constructor(
    private readonly predefinedTasksService: PredefinedTasksService,
  ) {}

  // ===========================
  // CRUD Tâches Prédéfinies
  // ===========================

  @Get()
  @Permissions('predefined_tasks:view')
  @ApiOperation({ summary: 'Lister les tâches prédéfinies actives' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches prédéfinies actives',
  })
  findAll() {
    return this.predefinedTasksService.findAll();
  }

  @Post()
  @Permissions('predefined_tasks:create')
  @ApiOperation({ summary: 'Créer une tâche prédéfinie' })
  @ApiResponse({ status: 201, description: 'Tâche prédéfinie créée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createPredefinedTaskDto: CreatePredefinedTaskDto,
  ) {
    return this.predefinedTasksService.create(userId, createPredefinedTaskDto);
  }

  @Patch(':id')
  @Permissions('predefined_tasks:edit')
  @ApiOperation({ summary: 'Modifier une tâche prédéfinie' })
  @ApiResponse({ status: 200, description: 'Tâche prédéfinie mise à jour' })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePredefinedTaskDto: UpdatePredefinedTaskDto,
  ) {
    return this.predefinedTasksService.update(id, updatePredefinedTaskDto);
  }

  @Delete(':id')
  @Permissions('predefined_tasks:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver (soft delete) une tâche prédéfinie' })
  @ApiResponse({ status: 200, description: 'Tâche prédéfinie désactivée' })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.predefinedTasksService.remove(id);
  }

  // ===========================
  // Assignations
  // ===========================

  @Get('assignments')
  @Permissions('predefined_tasks:view')
  @ApiOperation({
    summary: 'Lister les assignations (avec filtres optionnels)',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (ISO)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (ISO)',
  })
  @ApiQuery({ name: 'predefinedTaskId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Liste des assignations' })
  findAssignments(
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('predefinedTaskId') predefinedTaskId?: string,
  ) {
    return this.predefinedTasksService.findAssignments({
      userId,
      startDate,
      endDate,
      predefinedTaskId,
    });
  }

  @Post('assignments')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({ summary: 'Assigner une tâche prédéfinie à un utilisateur' })
  @ApiResponse({ status: 201, description: 'Assignation créée' })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  @ApiResponse({ status: 409, description: 'Assignation déjà existante' })
  createAssignment(
    @CurrentUser('id') userId: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ) {
    return this.predefinedTasksService.createAssignment(
      userId,
      createAssignmentDto,
    );
  }

  @Post('assignments/bulk')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({
    summary: 'Assigner en masse (plusieurs utilisateurs × plusieurs dates)',
  })
  @ApiResponse({
    status: 201,
    description: 'Assignations créées (avec rapport created/skipped)',
  })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  createBulkAssignment(
    @CurrentUser('id') userId: string,
    @Body() bulkAssignmentDto: BulkAssignmentDto,
  ) {
    return this.predefinedTasksService.createBulkAssignment(
      userId,
      bulkAssignmentDto,
    );
  }

  @Delete('assignments/:id')
  @Permissions('predefined_tasks:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une assignation' })
  @ApiResponse({ status: 200, description: 'Assignation supprimée' })
  @ApiResponse({ status: 404, description: 'Assignation introuvable' })
  removeAssignment(@Param('id', ParseUUIDPipe) id: string) {
    return this.predefinedTasksService.removeAssignment(id);
  }

  // ===========================
  // Règles Récurrentes
  // ===========================

  @Get('recurring-rules')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({ summary: 'Lister les règles récurrentes actives' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'predefinedTaskId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Liste des règles récurrentes' })
  findRecurringRules(
    @Query('userId') userId?: string,
    @Query('predefinedTaskId') predefinedTaskId?: string,
  ) {
    return this.predefinedTasksService.findRecurringRules({
      userId,
      predefinedTaskId,
    });
  }

  @Post('recurring-rules')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({ summary: 'Créer une règle récurrente' })
  @ApiResponse({ status: 201, description: 'Règle récurrente créée' })
  @ApiResponse({ status: 404, description: 'Tâche prédéfinie introuvable' })
  createRecurringRule(
    @CurrentUser('id') userId: string,
    @Body() createRecurringRuleDto: CreateRecurringRuleDto,
  ) {
    return this.predefinedTasksService.createRecurringRule(
      userId,
      createRecurringRuleDto,
    );
  }

  @Patch('recurring-rules/:id')
  @Permissions('predefined_tasks:assign')
  @ApiOperation({ summary: 'Modifier une règle récurrente' })
  @ApiResponse({ status: 200, description: 'Règle récurrente mise à jour' })
  @ApiResponse({ status: 404, description: 'Règle récurrente introuvable' })
  updateRecurringRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRecurringRuleDto: UpdateRecurringRuleDto,
  ) {
    return this.predefinedTasksService.updateRecurringRule(
      id,
      updateRecurringRuleDto,
    );
  }

  @Delete('recurring-rules/:id')
  @Permissions('predefined_tasks:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une règle récurrente' })
  @ApiResponse({ status: 200, description: 'Règle récurrente supprimée' })
  @ApiResponse({ status: 404, description: 'Règle récurrente introuvable' })
  removeRecurringRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.predefinedTasksService.removeRecurringRule(id);
  }

  @Post('recurring-rules/generate')
  @Permissions('predefined_tasks:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Matérialiser les assignations depuis les règles récurrentes pour une plage de dates',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignations générées (created/skipped/rulesProcessed)',
  })
  generateFromRules(
    @CurrentUser('id') userId: string,
    @Body() generateFromRulesDto: GenerateFromRulesDto,
  ) {
    return this.predefinedTasksService.generateFromRules(
      userId,
      generateFromRulesDto,
    );
  }
}
