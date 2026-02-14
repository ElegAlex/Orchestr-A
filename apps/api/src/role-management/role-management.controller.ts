import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoleManagementService } from './role-management.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'database';

@ApiTags('role-management')
@Controller('role-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoleManagementController {
  constructor(
    private readonly roleManagementService: RoleManagementService,
  ) {}

  @Get('roles')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Liste tous les rôles avec leurs permissions' })
  @ApiResponse({
    status: 200,
    description: 'Liste des rôles',
  })
  findAllRoles() {
    return this.roleManagementService.findAllRoles();
  }

  @Post('roles')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un rôle custom' })
  @ApiResponse({
    status: 201,
    description: 'Rôle créé avec succès',
  })
  @ApiResponse({
    status: 409,
    description: 'Un rôle avec ce code existe déjà',
  })
  createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.roleManagementService.createRole(createRoleDto);
  }

  @Get('roles/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Détail rôle + permissions' })
  @ApiResponse({
    status: 200,
    description: 'Détails du rôle',
  })
  @ApiResponse({
    status: 404,
    description: 'Rôle introuvable',
  })
  findOneRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleManagementService.findOneRole(id);
  }

  @Patch('roles/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier nom/description' })
  @ApiResponse({
    status: 200,
    description: 'Rôle modifié avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Rôle introuvable',
  })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.roleManagementService.updateRole(id, updateRoleDto);
  }

  @Delete('roles/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer (interdit si isSystem: true)' })
  @ApiResponse({
    status: 200,
    description: 'Rôle supprimé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer un rôle système',
  })
  @ApiResponse({
    status: 404,
    description: 'Rôle introuvable',
  })
  removeRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleManagementService.removeRole(id);
  }

  @Get('permissions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Liste toutes les permissions (groupées par module)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des permissions groupées par module',
  })
  findAllPermissions() {
    return this.roleManagementService.findAllPermissions();
  }

  @Put('roles/:id/permissions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remplacer les permissions d\'un rôle' })
  @ApiResponse({
    status: 200,
    description: 'Permissions mises à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Une ou plusieurs permissions introuvables',
  })
  @ApiResponse({
    status: 404,
    description: 'Rôle introuvable',
  })
  replaceRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignPermissionDto: AssignPermissionDto,
  ) {
    return this.roleManagementService.replaceRolePermissions(
      id,
      assignPermissionDto.permissionIds,
    );
  }

  @Post('seed')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Seeder les permissions et rôles initiaux (admin only, idempotent)' })
  @ApiResponse({
    status: 201,
    description: 'Seed effectué avec succès',
  })
  seedPermissionsAndRoles() {
    return this.roleManagementService.seedPermissionsAndRoles();
  }
}
