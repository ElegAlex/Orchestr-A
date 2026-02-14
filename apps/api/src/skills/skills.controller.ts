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
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { AssignSkillDto } from './dto/assign-skill.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkillCategory, SkillLevel } from 'database';

@ApiTags('skills')
@Controller('skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @Permissions('skills:create')
  @ApiOperation({
    summary: 'Créer une nouvelle compétence (Admin/Responsable uniquement)',
  })
  @ApiResponse({
    status: 201,
    description: 'Compétence créée avec succès',
  })
  @ApiResponse({
    status: 409,
    description: 'Une compétence avec ce nom existe déjà',
  })
  create(@Body() createSkillDto: CreateSkillDto) {
    return this.skillsService.create(createSkillDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer toutes les compétences (avec pagination)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, enum: SkillCategory })
  @ApiResponse({
    status: 200,
    description: 'Liste des compétences',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('category') category?: SkillCategory,
  ) {
    return this.skillsService.findAll(page, limit, category);
  }

  @Get('matrix')
  @Permissions('skills:manage_matrix')
  @ApiOperation({
    summary: 'Récupérer la matrice de compétences (Admin/Responsable/Manager)',
  })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, enum: SkillCategory })
  @ApiResponse({
    status: 200,
    description: 'Matrice de compétences (utilisateurs × compétences)',
  })
  getMatrix(
    @Query('departmentId') departmentId?: string,
    @Query('category') category?: SkillCategory,
  ) {
    return this.skillsService.getSkillsMatrix(departmentId, category);
  }

  @Get('search/:skillId')
  @Permissions('skills:read')
  @ApiOperation({
    summary:
      'Rechercher des utilisateurs par compétence (Admin/Responsable/Manager)',
  })
  @ApiQuery({ name: 'minLevel', required: false, enum: SkillLevel })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs ayant cette compétence',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence introuvable',
  })
  findUsersBySkill(
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Query('minLevel') minLevel?: SkillLevel,
  ) {
    return this.skillsService.findUsersBySkill(skillId, minLevel);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une compétence par ID avec ses utilisateurs',
  })
  @ApiResponse({
    status: 200,
    description: 'Détails de la compétence',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('skills:update')
  @ApiOperation({
    summary: 'Mettre à jour une compétence (Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Compétence mise à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Une compétence avec ce nom existe déjà',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSkillDto: UpdateSkillDto,
  ) {
    return this.skillsService.update(id, updateSkillDto);
  }

  @Delete(':id')
  @Permissions('skills:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer une compétence (Admin uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Compétence supprimée',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer (assignée à des utilisateurs)',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.remove(id);
  }

  @Post('me/assign')
  @ApiOperation({ summary: 'Assigner une compétence à soi-même' })
  @ApiResponse({
    status: 201,
    description: 'Compétence assignée ou niveau mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence introuvable',
  })
  assignToMe(
    @CurrentUser('id') userId: string,
    @Body() assignSkillDto: AssignSkillDto,
  ) {
    return this.skillsService.assignSkillToUser(userId, assignSkillDto);
  }

  @Post('user/:userId/assign')
  @Permissions('skills:manage_matrix')
  @ApiOperation({
    summary:
      'Assigner une compétence à un utilisateur (Admin/Responsable/Manager)',
  })
  @ApiResponse({
    status: 201,
    description: 'Compétence assignée ou niveau mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur ou compétence introuvable',
  })
  assignToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() assignSkillDto: AssignSkillDto,
  ) {
    return this.skillsService.assignSkillToUser(userId, assignSkillDto);
  }

  @Delete('me/remove/:skillId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une compétence de soi-même' })
  @ApiResponse({
    status: 200,
    description: 'Compétence retirée',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence non trouvée pour cet utilisateur',
  })
  removeFromMe(
    @CurrentUser('id') userId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.skillsService.removeSkillFromUser(userId, skillId);
  }

  @Delete('user/:userId/remove/:skillId')
  @Permissions('skills:manage_matrix')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Retirer une compétence d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiResponse({
    status: 200,
    description: 'Compétence retirée',
  })
  @ApiResponse({
    status: 404,
    description: 'Compétence non trouvée pour cet utilisateur',
  })
  removeFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.skillsService.removeSkillFromUser(userId, skillId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Récupérer les compétences d'un utilisateur" })
  @ApiResponse({
    status: 200,
    description:
      "Liste des compétences de l'utilisateur groupées par catégorie",
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur introuvable',
  })
  getUserSkills(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.skillsService.getUserSkills(userId);
  }

  @Get('me/my-skills')
  @ApiOperation({ summary: 'Récupérer mes compétences' })
  @ApiResponse({
    status: 200,
    description: 'Liste de mes compétences groupées par catégorie',
  })
  getMySkills(@CurrentUser('id') userId: string) {
    return this.skillsService.getUserSkills(userId);
  }

  @Patch('user/:userId/skill/:skillId')
  @Permissions('skills:manage_matrix')
  @ApiOperation({
    summary:
      "Mettre à jour le niveau d'une compétence d'un utilisateur (Admin/Responsable/Manager)",
  })
  @ApiResponse({
    status: 200,
    description: 'Niveau de la compétence mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur ou compétence introuvable',
  })
  updateUserSkill(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Body() data: { level: SkillLevel },
  ) {
    return this.skillsService.assignSkillToUser(userId, {
      skillId,
      level: data.level,
    });
  }
}
