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
import { TimeTrackingService } from './time-tracking.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from 'database';

@ApiTags('time-tracking')
@Controller('time-tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post()
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
    @CurrentUser('id') userId: string,
    @Body() createTimeEntryDto: CreateTimeEntryDto,
  ) {
    return this.timeTrackingService.create(userId, createTimeEntryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer toutes les entrées de temps (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'taskId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des entrées de temps',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeTrackingService.findAll(
      page,
      limit,
      userId,
      projectId,
      taskId,
      startDate,
      endDate,
    );
  }

  @Get('me/report')
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Récupérer le rapport de temps d\'un utilisateur (Admin/Responsable/Manager)',
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Récupérer le rapport de temps d\'un projet (Admin/Responsable/Manager)',
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
  @ApiOperation({ summary: 'Récupérer une entrée de temps par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails de l\'entrée de temps',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeTrackingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une entrée de temps' })
  @ApiResponse({
    status: 200,
    description: 'Entrée de temps mise à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
  ) {
    return this.timeTrackingService.update(id, updateTimeEntryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une entrée de temps' })
  @ApiResponse({
    status: 200,
    description: 'Entrée de temps supprimée',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée de temps introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeTrackingService.remove(id);
  }
}
