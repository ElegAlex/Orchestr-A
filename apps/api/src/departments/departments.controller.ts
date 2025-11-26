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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'database';

@ApiTags('departments')
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({
    summary: 'Créer un nouveau département (Admin/Responsable uniquement)',
  })
  @ApiResponse({
    status: 201,
    description: 'Département créé avec succès',
  })
  @ApiResponse({
    status: 409,
    description: 'Code ou nom de département déjà utilisé',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les départements (avec pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Liste des départements',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.departmentsService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un département par ID avec tous les détails',
  })
  @ApiResponse({
    status: 200,
    description: 'Détails complets du département',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Récupérer les statistiques d\'un département' })
  @ApiResponse({
    status: 200,
    description:
      'Statistiques du département (utilisateurs, projets, tâches, charge)',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.getDepartmentStats(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({
    summary: 'Mettre à jour un département (Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Département mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  @ApiResponse({
    status: 409,
    description: 'Code ou nom de département déjà utilisé',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer un département (Admin uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Département supprimé',
  })
  @ApiResponse({
    status: 400,
    description:
      'Impossible de supprimer (contient des utilisateurs, services ou projets)',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(id);
  }
}
