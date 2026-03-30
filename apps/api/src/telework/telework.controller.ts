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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TeleworkService } from './telework.service';
import { CreateTeleworkDto } from './dto/create-telework.dto';
import { UpdateTeleworkDto } from './dto/update-telework.dto';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('telework')
@Controller('telework')
@ApiBearerAuth()
export class TeleworkController {
  constructor(private readonly teleworkService: TeleworkService) {}

  @Post()
  @Permissions('telework:create')
  @ApiOperation({ summary: 'Déclarer une journée de télétravail' })
  @ApiResponse({
    status: 201,
    description: 'Télétravail créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Date invalide ou données incohérentes',
  })
  @ApiResponse({
    status: 409,
    description: 'Un télétravail existe déjà pour cette date',
  })
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() createTeleworkDto: CreateTeleworkDto,
  ) {
    return this.teleworkService.create(userId, userRole, createTeleworkDto);
  }

  @Get()
  @Permissions('telework:read')
  @ApiOperation({
    summary: 'Récupérer tous les télétravails (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des télétravails',
  })
  findAll(
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.teleworkService.findAll(
      currentUserId,
      currentUserRole,
      page,
      limit,
      userId,
      startDate,
      endDate,
    );
  }

  @Get('me/week')
  @ApiOperation({
    summary: 'Récupérer mon planning de télétravail pour une semaine',
  })
  @ApiQuery({ name: 'weekStart', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Planning hebdomadaire de télétravail',
  })
  getMyWeeklySchedule(
    @CurrentUser('id') userId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.teleworkService.getWeeklySchedule(userId, weekStart);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Récupérer mes statistiques de télétravail' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description:
      'Statistiques de télétravail (jours complets, demi-journées, par mois)',
  })
  getMyStats(
    @CurrentUser('id') userId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.teleworkService.getUserStats(userId, year);
  }

  @Get('team/:date')
  @Permissions('telework:read_team')
  @ApiOperation({
    summary:
      'Voir qui est en télétravail pour une date (Admin/Responsable/Manager)',
  })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des personnes en télétravail pour cette date',
  })
  getTeamTelework(
    @Param('date') date: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.teleworkService.getTeamSchedule(date, departmentId);
  }

  @Get('user/:userId/week')
  @Permissions('telework:read_team')
  @ApiOperation({
    summary:
      "Récupérer le planning de télétravail d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiQuery({ name: 'weekStart', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Planning hebdomadaire de télétravail',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getUserWeeklySchedule(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.teleworkService.getWeeklySchedule(userId, weekStart);
  }

  @Get('user/:userId/stats')
  @Permissions('telework:read_team')
  @ApiOperation({
    summary:
      "Récupérer les statistiques de télétravail d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de télétravail',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getUserStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.teleworkService.getUserStats(userId, year);
  }

  @Get(':id')
  @Permissions('telework:read')
  @ApiOperation({ summary: 'Récupérer un télétravail par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails du télétravail',
  })
  @ApiResponse({
    status: 404,
    description: 'Télétravail introuvable',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    return this.teleworkService.findOne(id, currentUserId, currentUserRole);
  }

  @Patch(':id')
  @Permissions('telework:update')
  @ApiOperation({ summary: 'Mettre à jour un télétravail' })
  @ApiResponse({
    status: 200,
    description: 'Télétravail mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Télétravail introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflit avec un télétravail existant',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() updateTeleworkDto: UpdateTeleworkDto,
  ) {
    return this.teleworkService.update(id, userId, userRole, updateTeleworkDto);
  }

  @Delete(':id')
  @Permissions('telework:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un télétravail' })
  @ApiResponse({
    status: 200,
    description: 'Télétravail supprimé',
  })
  @ApiResponse({
    status: 404,
    description: 'Télétravail introuvable',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.teleworkService.remove(id, userId, userRole);
  }

  // ─────────────────────────────────────────────
  // RECURRING RULES
  // ─────────────────────────────────────────────

  @Get('recurring-rules')
  @Permissions('telework:read')
  @ApiOperation({
    summary:
      'Lister les règles de télétravail récurrent (filtrable par userId)',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Liste des règles récurrentes' })
  findAllRecurringRules(
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
    @Query('userId') userId?: string,
  ) {
    return this.teleworkService.findAllRecurringRules(
      currentUserId,
      currentUserRole,
      userId,
    );
  }

  @Post('recurring-rules')
  @Permissions('telework:create')
  @ApiOperation({ summary: 'Créer une règle de télétravail récurrent' })
  @ApiResponse({ status: 201, description: 'Règle créée avec succès' })
  @ApiResponse({
    status: 409,
    description:
      'Une règle récurrente existe déjà pour ce jour et cette date de début',
  })
  createRecurringRule(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateRecurringRuleDto,
  ) {
    return this.teleworkService.createRecurringRule(userId, userRole, dto);
  }

  @Patch('recurring-rules/:id')
  @Permissions('telework:update')
  @ApiOperation({ summary: 'Modifier une règle de télétravail récurrent' })
  @ApiResponse({ status: 200, description: 'Règle mise à jour' })
  @ApiResponse({ status: 404, description: 'Règle introuvable' })
  updateRecurringRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: UpdateRecurringRuleDto,
  ) {
    return this.teleworkService.updateRecurringRule(id, userId, userRole, dto);
  }

  @Delete('recurring-rules/:id')
  @Permissions('telework:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une règle de télétravail récurrent' })
  @ApiResponse({ status: 200, description: 'Règle supprimée' })
  @ApiResponse({ status: 404, description: 'Règle introuvable' })
  removeRecurringRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.teleworkService.removeRecurringRule(id, userId, userRole);
  }

  @Post('recurring-rules/generate')
  @Permissions('telework:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Matérialiser les TeleworkSchedules depuis les règles actives pour une plage de dates',
  })
  @ApiResponse({
    status: 200,
    description: 'Génération effectuée (créés + ignorés)',
  })
  generateSchedules(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: GenerateSchedulesDto,
  ) {
    return this.teleworkService.generateSchedulesFromRules(
      userId,
      userRole,
      dto,
    );
  }
}
