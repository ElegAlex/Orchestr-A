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
import { TeleworkService } from './telework.service';
import { CreateTeleworkDto } from './dto/create-telework.dto';
import { UpdateTeleworkDto } from './dto/update-telework.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from 'database';

@ApiTags('telework')
@Controller('telework')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TeleworkController {
  constructor(private readonly teleworkService: TeleworkService) {}

  @Post()
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
    @Body() createTeleworkDto: CreateTeleworkDto,
  ) {
    return this.teleworkService.create(userId, createTeleworkDto);
  }

  @Get()
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
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.teleworkService.findAll(
      page,
      limit,
      userId,
      startDate,
      endDate,
    );
  }

  @Get('me/week')
  @ApiOperation({ summary: 'Récupérer mon planning de télétravail pour une semaine' })
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
    description: 'Statistiques de télétravail (jours complets, demi-journées, par mois)',
  })
  getMyStats(
    @CurrentUser('id') userId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.teleworkService.getUserStats(userId, year);
  }

  @Get('team/:date')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Voir qui est en télétravail pour une date (Admin/Responsable/Manager)',
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Récupérer le planning de télétravail d\'un utilisateur (Admin/Responsable/Manager)',
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Récupérer les statistiques de télétravail d\'un utilisateur (Admin/Responsable/Manager)',
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
  @ApiOperation({ summary: 'Récupérer un télétravail par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails du télétravail',
  })
  @ApiResponse({
    status: 404,
    description: 'Télétravail introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teleworkService.findOne(id);
  }

  @Patch(':id')
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
    @Body() updateTeleworkDto: UpdateTeleworkDto,
  ) {
    return this.teleworkService.update(id, userId, updateTeleworkDto);
  }

  @Delete(':id')
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
  ) {
    return this.teleworkService.remove(id, userId);
  }
}
