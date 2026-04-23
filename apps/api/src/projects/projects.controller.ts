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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import {
  CurrentUser,
  CurrentUserRoleCode,
} from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { OwnershipCheck } from '../common/decorators/ownership-check.decorator';
import { ProjectStatus } from 'database';

@ApiTags('projects')
@Controller('projects')
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions('projects:create')
  @ApiOperation({
    summary:
      'Créer un nouveau projet (Admin/Responsable/Manager/Chef de projet/Référent Technique)',
  })
  @ApiResponse({
    status: 201,
    description: 'Projet créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  @ApiResponse({
    status: 404,
    description: 'Manager ou département introuvable',
  })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser('id') creatorId: string,
  ) {
    return this.projectsService.create(createProjectDto, creatorId);
  }

  @Get()
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Récupérer tous les projets (avec pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ProjectStatus })
  @ApiResponse({
    status: 200,
    description: 'Liste des projets',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('status') status?: ProjectStatus,
    @CurrentUser('id') userId?: string,
    @CurrentUserRoleCode() userRole?: string | null,
  ) {
    return this.projectsService.findAll(
      page,
      limit,
      status,
      userId,
      userRole ?? undefined,
    );
  }

  @Post('snapshots/capture')
  @RequirePermissions('reports:export')
  @ApiOperation({
    summary: 'Capture progress snapshot for all active projects',
  })
  async captureSnapshots() {
    return this.projectsService.captureSnapshots();
  }

  @Get('user/:userId')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: "Récupérer les projets d'un utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Liste des projets de l'utilisateur",
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getProjectsByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.projectsService.getProjectsByUser(userId);
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Récupérer un projet par ID avec tous les détails' })
  @ApiResponse({
    status: 200,
    description: 'Détails complets du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/stats')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: "Récupérer les statistiques d'un projet" })
  @ApiResponse({
    status: 200,
    description: 'Statistiques du projet (progression, heures, budget, etc.)',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getProjectStats(id);
  }

  @Get(':id/snapshots')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get progress snapshots for a project' })
  async getSnapshots(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.projectsService.getSnapshots(id, from, to);
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  @OwnershipCheck({
    resource: 'project',
    bypassPermission: 'projects:manage_any',
  })
  @ApiOperation({
    summary:
      'Mettre à jour un projet (Admin/Responsable/Manager/Chef de projet)',
  })
  @ApiResponse({
    status: 200,
    description: 'Projet mis à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, updateProjectDto, {
      id: user.id,
      role: user.role?.code ?? undefined,
    });
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  @OwnershipCheck({
    resource: 'project',
    bypassPermission: 'projects:manage_any',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler un projet (soft delete, Admin/Responsable uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Projet annulé (status = CANCELED)',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.remove(id, {
      id: user.id,
      role: user.role?.code ?? undefined,
    });
  }

  @Delete(':id/hard')
  @RequirePermissions('projects:delete')
  @OwnershipCheck({
    resource: 'project',
    bypassPermission: 'projects:manage_any',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer définitivement un projet (Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Projet supprimé définitivement',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet introuvable',
  })
  hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.hardDelete(id);
  }

  @Post(':id/members')
  @RequirePermissions('projects:manage_members')
  @OwnershipCheck({
    resource: 'project',
    paramKey: 'id',
    bypassPermission: 'projects:manage_any',
  })
  @ApiOperation({
    summary:
      'Ajouter un membre au projet (Admin/Responsable/Manager/Chef de projet)',
  })
  @ApiResponse({
    status: 201,
    description: 'Membre ajouté avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Projet ou utilisateur introuvable',
  })
  @ApiResponse({
    status: 409,
    description: "L'utilisateur est déjà membre du projet",
  })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.projectsService.addMember(id, addMemberDto);
  }

  @Patch(':projectId/members/:userId')
  @RequirePermissions('projects:manage_members')
  @OwnershipCheck({
    resource: 'project',
    paramKey: 'projectId',
    bypassPermission: 'projects:manage_any',
  })
  @ApiOperation({
    summary: "Modifier le rôle ou l'allocation d'un membre du projet",
  })
  @ApiResponse({ status: 200, description: 'Membre mis à jour' })
  @ApiResponse({
    status: 404,
    description: 'Membre introuvable dans ce projet',
  })
  updateMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updateMember(projectId, userId, dto, {
      id: user.id,
      role: user.role?.code ?? undefined,
    });
  }

  @Delete(':projectId/members/:userId')
  @RequirePermissions('projects:manage_members')
  @OwnershipCheck({
    resource: 'project',
    paramKey: 'projectId',
    bypassPermission: 'projects:manage_any',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Retirer un membre du projet (Admin/Responsable/Manager/Chef de projet)',
  })
  @ApiResponse({
    status: 200,
    description: 'Membre retiré du projet',
  })
  @ApiResponse({
    status: 404,
    description: 'Membre introuvable dans ce projet',
  })
  removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.removeMember(projectId, userId, {
      id: user.id,
      role: user.role?.code ?? undefined,
    });
  }
}
