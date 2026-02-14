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
import {
  ImportUsersDto,
  UsersValidationPreviewDto,
} from './dto/import-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from 'database';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users:create')
  @ApiOperation({
    summary: 'Créer un nouvel utilisateur (Admin/Responsable uniquement)',
  })
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

  @Post('import/validate')
  @Permissions('users:import')
  @ApiOperation({
    summary: 'Valider des utilisateurs avant import (dry-run)',
  })
  @ApiResponse({
    status: 200,
    description: "Prévisualisation de l'import",
    type: UsersValidationPreviewDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  validateImport(@Body() importUsersDto: ImportUsersDto) {
    return this.usersService.validateImport(importUsersDto.users);
  }

  @Post('import')
  @Permissions('users:import')
  @ApiOperation({
    summary: 'Importer des utilisateurs depuis un CSV (Admin/Responsable)',
  })
  @ApiResponse({
    status: 201,
    description: "Résultat de l'import",
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  importUsers(@Body() importUsersDto: ImportUsersDto) {
    return this.usersService.importUsers(importUsersDto.users);
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer tous les utilisateurs (avec pagination)',
  })
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

  @Get('import/template')
  @Permissions('users:import')
  @ApiOperation({
    summary: "Télécharger le template CSV pour l'import (Admin/Responsable)",
  })
  @ApiResponse({
    status: 200,
    description: 'Template CSV',
  })
  getImportTemplate() {
    return this.usersService.getImportTemplate();
  }

  @Get('presence')
  @ApiOperation({
    summary: 'Récupérer les statuts de présence des utilisateurs pour une date',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: "Date au format YYYY-MM-DD (défaut: aujourd'hui)",
  })
  @ApiResponse({
    status: 200,
    description: 'Statuts de présence (sur site, télétravail, absents)',
  })
  getUsersPresence(@Query('date') date?: string) {
    return this.usersService.getUsersPresence(date);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: "Récupérer les utilisateurs d'un département" })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs du département',
  })
  getUsersByDepartment(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.usersService.getUsersByDepartment(departmentId);
  }

  @Get('service/:serviceId')
  @ApiOperation({ summary: "Récupérer les utilisateurs d'un service" })
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
    description: "Détails de l'utilisateur",
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son propre mot de passe' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe modifié avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Ancien mot de passe incorrect',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Patch(':id')
  @Permissions('users:update')
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
  @Permissions('users:delete')
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

  @Get(':id/dependencies')
  @Permissions('users:delete')
  @ApiOperation({
    summary:
      "Vérifier les dépendances d'un utilisateur avant suppression (Admin uniquement)",
  })
  @ApiResponse({
    status: 200,
    description: "Liste des dépendances de l'utilisateur",
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  checkDependencies(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.checkDependencies(id);
  }

  @Delete(':id/hard')
  @Permissions('users:delete')
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
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer - dépendances actives',
  })
  hardDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') requestingUserId: string,
  ) {
    return this.usersService.hardDelete(id, requestingUserId);
  }

  @Post(':id/reset-password')
  @Permissions('users:manage_roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Réinitialiser le mot de passe d'un utilisateur (Admin/Responsable)",
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
