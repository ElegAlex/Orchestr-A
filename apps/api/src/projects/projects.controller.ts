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
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectStatus } from 'database';

@ApiTags('projects')
@Controller('projects')
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Permissions('projects:create')
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
  @Permissions('projects:read')
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
    @CurrentUser('role') userRole?: string,
  ) {
    return this.projectsService.findAll(page, limit, status, userId, userRole);
  }

  @Post('snapshots/capture')
  @Permissions('admin:access')
  @ApiOperation({ summary: 'Capture progress snapshot for all active projects' })
  async captureSnapshots() {
    return this.projectsService.captureSnapshots();
  }

  @Get('user/:userId')
  @Permissions('projects:read')
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
  @Permissions('projects:read')
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
  @Permissions('projects:read')
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
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get progress snapshots for a project' })
  async getSnapshots(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.projectsService.getSnapshots(id, from, to);
  }

  @Patch(':id')
  @Permissions('projects:update')
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
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @Permissions('projects:delete')
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
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id);
  }

  @Delete(':id/hard')
  @Permissions('projects:delete')
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
  @Permissions('projects:manage_members')
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
  @Permissions('projects:manage_members')
  @ApiOperation({
    summary: 'Modifier le rôle ou l\'allocation d\'un membre du projet',
  })
  @ApiResponse({ status: 200, description: 'Membre mis à jour' })
  @ApiResponse({ status: 404, description: 'Membre introuvable dans ce projet' })
  updateMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.projectsService.updateMember(projectId, userId, dto);
  }

  @Delete(':projectId/members/:userId')
  @Permissions('projects:manage_members')
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
  ) {
    return this.projectsService.removeMember(projectId, userId);
  }
}
