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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from 'database';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({ summary: 'Créer un nouvel utilisateur (Admin/Responsable uniquement)' })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
  })
  @ApiResponse({
    status: 409,
    description: 'Email ou login déjà utilisé',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les utilisateurs (avec pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('role') role?: Role,
  ) {
    return this.usersService.findAll(page, limit, role);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: 'Récupérer les utilisateurs d\'un département' })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs du département',
  })
  getUsersByDepartment(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.usersService.getUsersByDepartment(departmentId);
  }

  @Get('service/:serviceId')
  @ApiOperation({ summary: 'Récupérer les utilisateurs d\'un service' })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs du service',
  })
  getUsersByService(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.usersService.getUsersByService(serviceId);
  }

  @Get('role/:role')
  @ApiOperation({ summary: 'Récupérer les utilisateurs par rôle' })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs avec ce rôle',
  })
  getUsersByRole(@Param('role') role: Role) {
    return this.usersService.getUsersByRole(role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un utilisateur par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails de l\'utilisateur',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur (Admin/Responsable/Manager)',
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Email ou login déjà utilisé',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Désactiver un utilisateur (soft delete, Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur désactivé',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Delete(':id/hard')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer définitivement un utilisateur (Admin uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur supprimé définitivement',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.hardDelete(id);
  }

  @Patch('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son propre mot de passe' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe modifié avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Mot de passe actuel incorrect',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe d\'un utilisateur (Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.usersService.resetPassword(id, newPassword);
  }
}
