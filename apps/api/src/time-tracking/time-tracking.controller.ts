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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TimeTrackingService } from './time-tracking.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnershipCheck } from '../common/decorators/ownership-check.decorator';

function toActor(user: AuthenticatedUser): { id: string; role: string | null } {
  return { id: user.id, role: user.role?.code ?? null };
}

@ApiTags('time-tracking')
@Controller('time-tracking')
@ApiBearerAuth()
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post()
  @RequirePermissions('time_tracking:create')
  @ApiOperation({ summary: 'Créer une entrée de temps' })
  @ApiResponse({
    status: 201,
    description: 'Entrée de temps créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Une tâche ou un projet doit être spécifié',
  })
  @ApiResponse({
    status: 404,
    description: 'Tâche ou projet introuvable',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createTimeEntryDto: CreateTimeEntryDto,
  ) {
    return this.timeTrackingService.create(toActor(user), createTimeEntryDto);
  }

  @Get()
  @AllowSelfService()
  @ApiOperation({
    summary:
      'Récupérer toutes les entrées de temps (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'thirdPartyId', required: false, type: String })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'taskId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'includeDismissals', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Liste des entrées de temps',
  })
  @ApiResponse({
    status: 403,
    description:
      "Filtre userId d'un autre utilisateur sans permission time_tracking:view_any",
  })
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('thirdPartyId') thirdPartyId?: string,
    @Query('includeDismissals') includeDismissals?: string,
  ) {
    return this.timeTrackingService.findAll(
      toActor(currentUser),
      page,
      limit,
      userId,
      projectId,
      taskId,
      startDate,
      endDate,
      thirdPartyId,
      includeDismissals === 'true',
    );
  }

  @Get('me')
  @AllowSelfService()
  @ApiOperation({ summary: 'Récupérer mes entrées de temps' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste de mes entrées de temps',
  })
  getMyEntries(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeTrackingService.getUserEntries(userId, startDate, endDate);
  }

  @Get('me/report')
  @AllowSelfService()
  @ApiOperation({ summary: 'Récupérer mon rapport de temps pour une période' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Rapport de temps (total, par type, par projet, par date)',
  })
  getMyReport(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.timeTrackingService.getUserReport(userId, startDate, endDate);
  }

  @Get('user/:userId/report')
  @RequirePermissions('time_tracking:read_reports')
  @ApiOperation({
    summary:
      "Récupérer le rapport de temps d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Rapport de temps',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getUserReport(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.timeTrackingService.getUserReport(userId, startDate, endDate);
  }

  @Get('project/:projectId/report')
  @RequirePermissions('time_tracking:read_reports')
  @ApiOperation({
    summary:
      "Récupérer le rapport de temps d'un projet (Admin/Responsable/Manager)",
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Rapport de temps du projet (par utilisateur, par type)',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  getProjectReport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeTrackingService.getProjectReport(
      projectId,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  @AllowSelfService()
  @ApiOperation({ summary: 'Récupérer une entrée de temps par ID' })
  @ApiResponse({
    status: 200,
    description: "Détails de l'entrée de temps",
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timeTrackingService.findOne(id, toActor(currentUser));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @OwnershipCheck({
    resource: 'timeEntry',
    bypassPermission: 'time_tracking:manage_any',
  })
  @RequirePermissions('time_tracking:update')
  @ApiOperation({ summary: 'Mettre à jour une entrée de temps' })
  @ApiResponse({
    status: 200,
    description: 'Entrée de temps mise à jour',
  })
  @ApiResponse({
    status: 403,
    description:
      'Non propriétaire et sans permission time_tracking:manage_any',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timeTrackingService.update(
      id,
      updateTimeEntryDto,
      toActor(currentUser),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @OwnershipCheck({
    resource: 'timeEntry',
    bypassPermission: 'time_tracking:manage_any',
  })
  @RequirePermissions('time_tracking:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une entrée de temps' })
  @ApiResponse({
    status: 200,
    description: 'Entrée de temps supprimée',
  })
  @ApiResponse({
    status: 403,
    description:
      'Non propriétaire et sans permission time_tracking:manage_any',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timeTrackingService.remove(id, toActor(currentUser));
  }
}
