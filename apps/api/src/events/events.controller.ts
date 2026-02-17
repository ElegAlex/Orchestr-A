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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Permissions('events:create')
  @ApiOperation({ summary: 'Créer un nouvel événement' })
  @ApiResponse({
    status: 201,
    description: 'Événement créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet ou participant introuvable',
  })
  create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.create(createEventDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer tous les événements (avec filtres optionnels)',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des événements',
  })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.eventsService.findAll(startDate, endDate, userId, projectId);
  }

  @Get('range')
  @ApiOperation({ summary: 'Récupérer les événements dans une plage de dates' })
  @ApiQuery({ name: 'start', required: true, type: String })
  @ApiQuery({ name: 'end', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des événements dans la plage',
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres manquants ou invalides',
  })
  getEventsByRange(@Query('start') start: string, @Query('end') end: string) {
    return this.eventsService.getEventsByRange(start, end);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Récupérer tous les événements d'un utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Liste des événements de l'utilisateur",
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getEventsByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.eventsService.getEventsByUser(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un événement par ID avec tous les détails',
  })
  @ApiResponse({
    status: 200,
    description: "Détails complets de l'événement",
  })
  @ApiResponse({
    status: 404,
    description: 'Événement introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('events:update')
  @ApiOperation({ summary: 'Mettre à jour un événement' })
  @ApiResponse({
    status: 200,
    description: 'Événement mis à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Événement introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @Permissions('events:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un événement' })
  @ApiResponse({
    status: 200,
    description: 'Événement supprimé',
  })
  @ApiResponse({
    status: 404,
    description: 'Événement introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/participants')
  @Permissions('events:update')
  @ApiOperation({ summary: 'Ajouter un participant à un événement' })
  @ApiResponse({
    status: 201,
    description: 'Participant ajouté avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Participant déjà existant',
  })
  @ApiResponse({
    status: 404,
    description: 'Événement ou utilisateur introuvable',
  })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.eventsService.addParticipant(id, userId);
  }

  @Delete(':eventId/participants/:userId')
  @Permissions('events:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retirer un participant d'un événement" })
  @ApiResponse({
    status: 200,
    description: 'Participant retiré',
  })
  @ApiResponse({
    status: 404,
    description: 'Participation introuvable',
  })
  removeParticipant(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.eventsService.removeParticipant(eventId, userId);
  }
}
