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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, ProjectStatus } from 'database';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CHEF_DE_PROJET, Role.REFERENT_TECHNIQUE)
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
  ) {
    return this.projectsService.findAll(page, limit, status);
  }

  @Get('user/:userId')
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

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CHEF_DE_PROJET)
  @ApiOperation({
    summary: 'Mettre à jour un projet (Admin/Responsable/Manager/Chef de projet)',
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
  @Roles(Role.ADMIN, Role.RESPONSABLE)
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
  @Roles(Role.ADMIN, Role.RESPONSABLE)
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
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CHEF_DE_PROJET)
  @ApiOperation({
    summary: 'Ajouter un membre au projet (Admin/Responsable/Manager/Chef de projet)',
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

  @Delete(':projectId/members/:userId')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER, Role.CHEF_DE_PROJET)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retirer un membre du projet (Admin/Responsable/Manager/Chef de projet)',
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
