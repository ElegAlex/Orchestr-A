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
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, LeaveStatus, LeaveType } from 'database';

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
    summary: 'Récupérer toutes les demandes de congé (avec pagination et filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiQuery({ name: 'type', required: false, enum: LeaveType })
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
  ) {
    return this.leavesService.findAll(page, limit, userId, status, type);
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

  @Get('balance/:userId')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Récupérer le solde de congés d\'un utilisateur (Admin/Responsable/Manager)',
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
  @ApiOperation({ summary: 'Mettre à jour une demande de congé (en attente uniquement)' })
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
    summary: 'Supprimer une demande de congé (en attente ou refusée uniquement)',
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approuver une demande de congé (Admin/Responsable/Manager)',
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
    status: 404,
    description: 'Demande de congé introuvable',
  })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavesService.approve(id);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refuser une demande de congé (Admin/Responsable/Manager)',
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
    status: 404,
    description: 'Demande de congé introuvable',
  })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.leavesService.reject(id, reason);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler une demande de congé approuvée (Admin/Responsable/Manager)',
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
}
