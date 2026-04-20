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
  ForbiddenException,
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
import { PermissionsService } from '../rbac/permissions.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { UpsertLeaveBalanceDto } from './dto/upsert-leave-balance.dto';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import {
  ImportLeavesDto,
  ImportLeavesResultDto,
  LeavesValidationPreviewDto,
} from './dto/import-leaves.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';
import { CurrentUser, CurrentUserRoleCode } from '../auth/decorators/current-user.decorator';
import { LeaveStatus, LeaveType } from 'database';

@ApiTags('leaves')
@Controller('leaves')
@ApiBearerAuth()
export class LeavesController {
  constructor(
    private readonly leavesService: LeavesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post()
  @RequirePermissions('leaves:create')
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
    status: 403,
    description:
      'Permission insuffisante pour déclarer pour un autre collaborateur',
  })
  @ApiResponse({
    status: 409,
    description: 'Chevauchement avec une demande existante',
  })
  create(
    @CurrentUser('id') userId: string,
    @CurrentUserRoleCode() userRole: string | null,
    @Body() createLeaveDto: CreateLeaveDto,
  ) {
    return this.leavesService.create(userId, createLeaveDto, userRole ?? undefined);
  }

  // ===========================
  // ENDPOINTS DE GESTION DES SOLDES
  // ===========================

  @Get('balances')
  @RequirePermissions('leaves:manage')
  @ApiOperation({
    summary: 'Lister les soldes de congés (filtrable par year, userId)',
  })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Liste des soldes' })
  getBalances(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('userId') userId?: string,
  ) {
    return this.leavesService.getBalances(year, userId);
  }

  @Get('balances/defaults')
  @RequirePermissions('leaves:manage')
  @ApiOperation({
    summary: 'Lister les soldes globaux par défaut (userId=null)',
  })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Soldes globaux par défaut' })
  getDefaultBalances(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.leavesService.getDefaultBalances(year);
  }

  @Post('balances')
  @RequirePermissions('leaves:manage')
  @ApiOperation({ summary: 'Créer ou modifier un solde (upsert)' })
  @ApiResponse({ status: 201, description: 'Solde créé ou mis à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({
    status: 404,
    description: 'Type de congé ou utilisateur introuvable',
  })
  upsertBalance(@Body() dto: UpsertLeaveBalanceDto) {
    return this.leavesService.upsertBalance(dto);
  }

  @Delete('balances/:id')
  @RequirePermissions('leaves:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un override de solde individuel' })
  @ApiResponse({ status: 200, description: 'Solde supprimé' })
  @ApiResponse({ status: 404, description: 'Solde introuvable' })
  deleteBalance(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavesService.deleteBalance(id);
  }

  @Get()
  @RequirePermissions('leaves:read')
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
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
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
      currentUserId,
      currentUserRole ?? undefined,
    );
  }

  @Get('me')
  @AllowSelfService()
  @ApiOperation({ summary: 'Récupérer mes demandes de congé' })
  @ApiResponse({
    status: 200,
    description: 'Liste de mes demandes de congé',
  })
  getMyLeaves(@CurrentUser('id') userId: string) {
    return this.leavesService.getUserLeaves(userId);
  }

  @Get('me/balance')
  @AllowSelfService()
  @ApiOperation({ summary: 'Récupérer son solde de congés' })
  @ApiResponse({
    status: 200,
    description: 'Solde de congés (total, utilisé, disponible, en attente)',
  })
  getMyBalance(@CurrentUser('id') userId: string) {
    return this.leavesService.getLeaveBalance(userId);
  }

  @Get('pending-validation')
  @RequirePermissions('leaves:approve')
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

  @Get('import-template')
  @RequirePermissions('leaves:read')
  @ApiOperation({ summary: 'Télécharger le modèle CSV pour import de congés' })
  @ApiResponse({
    status: 200,
    description: 'Modèle CSV',
    schema: {
      type: 'object',
      properties: {
        template: { type: 'string' },
      },
    },
  })
  getImportTemplate() {
    return { template: this.leavesService.getImportTemplate() };
  }

  @Post('import/validate')
  @RequirePermissions('leaves:create')
  @ApiOperation({ summary: 'Valider des congés avant import (dry-run)' })
  @ApiResponse({
    status: 200,
    description: "Prévisualisation de l'import",
    type: LeavesValidationPreviewDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  validateImport(@Body() importLeavesDto: ImportLeavesDto) {
    return this.leavesService.validateLeavesImport(importLeavesDto.leaves);
  }

  @Post('import')
  @RequirePermissions('leaves:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Importer des congés en masse via CSV' })
  @ApiResponse({
    status: 200,
    description: "Résultat de l'import",
    type: ImportLeavesResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  importLeaves(
    @Body() importLeavesDto: ImportLeavesDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.leavesService.importLeaves(
      importLeavesDto.leaves,
      currentUserId,
    );
  }

  @Get('balance/:userId')
  @RequirePermissions('leaves:read')
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
  async getUserBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    if (userId !== currentUserId) {
      const permissions =
        await this.permissionsService.getPermissionsForRole(currentUserRole ?? '');
      // D6 #2 PO : `leaves:validate` n'existe pas au catalogue ; le check
      // historique était cassé (toujours faux). La permission métier
      // équivalente est `leaves:approve`.
      if (!permissions.includes('leaves:approve')) {
        throw new ForbiddenException(
          'Permission leaves:approve requise pour consulter le solde d\'un autre utilisateur',
        );
      }
    }
    return this.leavesService.getLeaveBalance(userId);
  }

  @Get('subordinates')
  @RequirePermissions('leaves:read')
  @ApiOperation({
    summary:
      'Récupérer les collaborateurs sous la responsabilité du manager (pour déclaration de congés)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des collaborateurs',
  })
  getSubordinates(
    @CurrentUser('id') userId: string,
    @CurrentUserRoleCode() userRole: string | null,
  ) {
    return this.leavesService.getSubordinates(userId, userRole);
  }

  @Get(':id')
  @RequirePermissions('leaves:read')
  @ApiOperation({ summary: 'Récupérer une demande de congé par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails de la demande de congé',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    return this.leavesService.findOne(id, currentUserId, currentUserRole ?? undefined);
  }

  @Patch(':id')
  @RequirePermissions('leaves:update')
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
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    return this.leavesService.update(
      id,
      updateLeaveDto,
      currentUserId,
      currentUserRole ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermissions('leaves:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Supprimer une demande de congé (tous statuts pour les rôles de management)',
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
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    return this.leavesService.remove(id, currentUserId, currentUserRole ?? undefined);
  }

  @Post(':id/approve')
  @RequirePermissions('leaves:approve')
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
  @RequirePermissions('leaves:approve')
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

  @Post(':id/request-cancel')
  @AllowSelfService()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Demander l'annulation d'un congé approuvé (par le demandeur)",
  })
  @ApiResponse({
    status: 200,
    description: "Demande d'annulation enregistrée",
  })
  @ApiResponse({
    status: 400,
    description: 'Seules les demandes approuvées peuvent être annulées',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez annuler que vos propres congés',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande de congé introuvable',
  })
  requestCancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leavesService.requestCancel(id, userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('leaves:delete')
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
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    return this.leavesService.cancel(id, currentUserId, currentUserRole ?? undefined);
  }

  @Post(':id/reject-cancellation')
  @RequirePermissions('leaves:approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Refuser la demande d'annulation — le congé reste approuvé",
  })
  @ApiResponse({ status: 200, description: "Demande d'annulation refusée" })
  @ApiResponse({
    status: 400,
    description: "Ce congé n'est pas en attente d'annulation",
  })
  rejectCancellation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUserRoleCode() currentUserRole: string | null,
  ) {
    return this.leavesService.rejectCancellation(
      id,
      currentUserId,
      currentUserRole ?? undefined,
    );
  }

  // ===========================
  // ENDPOINTS DE DÉLÉGATION
  // ===========================

  @Post('delegations')
  @RequirePermissions('leaves:manage_delegations')
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
    @Body() dto: CreateDelegationDto,
  ) {
    return this.leavesService.createDelegation(
      delegatorId,
      dto.delegateId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Get('delegations/me')
  @AllowSelfService()
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
  @RequirePermissions('leaves:manage_delegations')
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
