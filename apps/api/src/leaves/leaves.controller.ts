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
  ApiBody,
} from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LeaveStatus, LeaveType } from 'database';

@ApiTags('leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une demande de congé' })
  @ApiResponse({
    status: 201,
    description: 'Demande de congé créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou solde insuffisant',
  })
  @ApiResponse({
    status: 409,
    description: 'Chevauchement avec une demande existante',
  })
  create(
    @CurrentUser('id') userId: string,
    @Body() createLeaveDto: CreateLeaveDto,
  ) {
    return this.leavesService.create(userId, createLeaveDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Récupérer toutes les demandes de congé (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiQuery({ name: 'type', required: false, enum: LeaveType })
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
  @ApiResponse({
    status: 200,
    description: 'Liste des demandes de congé',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('userId') userId?: string,
    @Query('status') status?: LeaveStatus,
    @Query('type') type?: LeaveType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.leavesService.findAll(
      page,
      limit,
      userId,
      status,
      type,
      startDate,
      endDate,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Récupérer mes demandes de congé' })
  @ApiResponse({
    status: 200,
    description: 'Liste de mes demandes de congé',
  })
  getMyLeaves(@CurrentUser('id') userId: string) {
    return this.leavesService.getUserLeaves(userId);
  }

  @Get('me/balance')
  @ApiOperation({ summary: 'Récupérer son solde de congés' })
  @ApiResponse({
    status: 200,
    description: 'Solde de congés (total, utilisé, disponible, en attente)',
  })
  getMyBalance(@CurrentUser('id') userId: string) {
    return this.leavesService.getLeaveBalance(userId);
  }

  @Get('pending-validation')
  @ApiOperation({
    summary: 'Récupérer les demandes en attente de ma validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des demandes en attente de validation',
  })
  getPendingForValidation(@CurrentUser('id') userId: string) {
    return this.leavesService.getPendingForValidator(userId);
  }

  @Get('balance/:userId')
  @Permissions('leaves:read')
  @ApiOperation({
    summary:
      "Récupérer le solde de congés d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiResponse({
    status: 200,
    description: 'Solde de congés',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getUserBalance(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.leavesService.getLeaveBalance(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une demande de congé par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails de la demande de congé',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour une demande de congé (en attente uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Demande de congé mise à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Seules les demandes en attente peuvent être modifiées',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLeaveDto: UpdateLeaveDto,
  ) {
    return this.leavesService.update(id, updateLeaveDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Supprimer une demande de congé (en attente ou refusée uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Demande de congé supprimée',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer cette demande',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavesService.remove(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approuver une demande de congé (validateur assigné, délégué ou Admin/Responsable)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        comment: { type: 'string', description: 'Commentaire optionnel' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Demande de congé approuvée',
  })
  @ApiResponse({
    status: 400,
    description: 'Seules les demandes en attente peuvent être approuvées',
  })
  @ApiResponse({
    status: 403,
    description: "Vous n'êtes pas autorisé à valider cette demande",
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') validatorId: string,
    @Body('comment') comment?: string,
  ) {
    return this.leavesService.approve(id, validatorId, comment);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Refuser une demande de congé (validateur assigné, délégué ou Admin/Responsable)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motif du refus' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Demande de congé refusée',
  })
  @ApiResponse({
    status: 400,
    description: 'Seules les demandes en attente peuvent être refusées',
  })
  @ApiResponse({
    status: 403,
    description: "Vous n'êtes pas autorisé à valider cette demande",
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') validatorId: string,
    @Body('reason') reason?: string,
  ) {
    return this.leavesService.reject(id, validatorId, reason);
  }

  @Post(':id/cancel')
  @Permissions('leaves:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Annuler une demande de congé approuvée (Admin/Responsable/Manager)',
  })
  @ApiResponse({
    status: 200,
    description: 'Demande de congé annulée',
  })
  @ApiResponse({
    status: 400,
    description: 'Seules les demandes approuvées peuvent être annulées',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavesService.cancel(id);
  }

  // ===========================
  // ENDPOINTS DE DÉLÉGATION
  // ===========================

  @Post('delegations')
  @Permissions('leaves:manage_delegations')
  @ApiOperation({
    summary: 'Créer une délégation de validation (Admin/Responsable/Manager)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['delegateId', 'startDate', 'endDate'],
      properties: {
        delegateId: {
          type: 'string',
          description: "ID de l'utilisateur délégué",
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Date de début',
        },
        endDate: { type: 'string', format: 'date', description: 'Date de fin' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Délégation créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 403,
    description: 'Seuls les Admin, Responsables et Managers peuvent déléguer',
  })
  createDelegation(
    @CurrentUser('id') delegatorId: string,
    @Body('delegateId') delegateId: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    return this.leavesService.createDelegation(
      delegatorId,
      delegateId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('delegations/me')
  @ApiOperation({
    summary: 'Récupérer mes délégations (données et reçues)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des délégations',
  })
  getMyDelegations(@CurrentUser('id') userId: string) {
    return this.leavesService.getDelegations(userId);
  }

  @Delete('delegations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Désactiver une délégation',
  })
  @ApiResponse({
    status: 200,
    description: 'Délégation désactivée',
  })
  @ApiResponse({
    status: 403,
    description: "Vous n'êtes pas autorisé à désactiver cette délégation",
  })
  @ApiResponse({
    status: 404,
    description: 'Délégation introuvable',
  })
  deactivateDelegation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leavesService.deactivateDelegation(id, userId);
  }
}
