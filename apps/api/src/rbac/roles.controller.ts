import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RequirePermissions } from './decorators/require-permissions.decorator';

/**
 * RolesController — V1 D de Spec 2.
 *
 * Endpoints CRUD pour les rôles applicatifs (table `roles`). Toutes les
 * mutations exigent `users:manage_roles` (alignement contract-04 §2.2).
 *
 * Lecture (GET) : protégée par `users:manage_roles` à ce stade. La galerie
 * UI Spec 3 utilisera `GET /roles/templates` pour afficher les 26 templates
 * sans accès DB. Si un usage public de `GET /roles` apparaît côté front,
 * un assouplissement (ex: `users:read`) sera arbitré.
 *
 * Note (V4) : seul controller RBAC restant. L'ancien `role-management` a été
 * supprimé et l'URL `/api/role-management/*` n'existe plus.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('templates')
  @RequirePermissions('users:manage_roles')
  @ApiOperation({
    summary:
      'Liste les 26 templates hardcodés (catégorie, perms, libellé par défaut).',
  })
  @ApiResponse({ status: 200, description: 'Liste des 26 templates' })
  listTemplates() {
    return this.rolesService.listTemplates();
  }

  @Get()
  @RequirePermissions('users:manage_roles')
  @ApiOperation({
    summary: 'Liste tous les rôles existants en DB (système + éditables).',
  })
  @ApiResponse({ status: 200, description: 'Liste des rôles avec stats' })
  list() {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  @RequirePermissions('users:manage_roles')
  @ApiOperation({ summary: "Détail d'un rôle" })
  @ApiResponse({ status: 200, description: 'Rôle' })
  @ApiResponse({ status: 404, description: 'Rôle introuvable' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Post()
  @RequirePermissions('users:manage_roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Crée un rôle (isSystem forcé à false). Les permissions sont strictement celles du template choisi.',
  })
  @ApiResponse({ status: 201, description: 'Rôle créé' })
  @ApiResponse({ status: 409, description: 'Code déjà existant' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:manage_roles')
  @ApiOperation({
    summary:
      'Édite un rôle (label, templateKey, description). Refus 403 si rôle système (D9 PO).',
  })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour' })
  @ApiResponse({ status: 403, description: 'Rôle système non modifiable' })
  @ApiResponse({ status: 404, description: 'Rôle introuvable' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:manage_roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprime un rôle. Refus 403 si système (D9 PO), 409 si users rattachés.',
  })
  @ApiResponse({ status: 204, description: 'Rôle supprimé' })
  @ApiResponse({ status: 403, description: 'Rôle système non supprimable' })
  @ApiResponse({
    status: 409,
    description: 'Rôle rattaché à des users — réassigner avant suppression',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.deleteRole(id);
  }
}
