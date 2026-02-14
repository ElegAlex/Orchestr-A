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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Permissions('services:create')
  @ApiOperation({
    summary: 'Créer un nouveau service (Admin/Responsable uniquement)',
  })
  @ApiResponse({
    status: 201,
    description: 'Service créé avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  @ApiResponse({
    status: 409,
    description:
      'Code de service déjà utilisé ou nom déjà utilisé dans ce département',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit',
  })
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les services (avec pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Liste des services',
  })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.servicesService.findAll(page, limit, departmentId);
  }

  @Get('department/:departmentId')
  @ApiOperation({ summary: "Récupérer les services d'un département" })
  @ApiResponse({
    status: 200,
    description: 'Liste des services du département',
  })
  @ApiResponse({
    status: 404,
    description: 'Département introuvable',
  })
  getServicesByDepartment(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.servicesService.getServicesByDepartment(departmentId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un service par ID avec tous les détails',
  })
  @ApiResponse({
    status: 200,
    description: 'Détails complets du service',
  })
  @ApiResponse({
    status: 404,
    description: 'Service introuvable',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: "Récupérer les statistiques d'un service" })
  @ApiResponse({
    status: 200,
    description: 'Statistiques du service (utilisateurs par rôle)',
  })
  @ApiResponse({
    status: 404,
    description: 'Service introuvable',
  })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.getServiceStats(id);
  }

  @Patch(':id')
  @Permissions('services:update')
  @ApiOperation({
    summary: 'Mettre à jour un service (Admin/Responsable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service mis à jour',
  })
  @ApiResponse({
    status: 404,
    description: 'Service ou département introuvable',
  })
  @ApiResponse({
    status: 409,
    description:
      'Code de service déjà utilisé ou nom déjà utilisé dans ce département',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @Permissions('services:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer un service (Admin uniquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service supprimé',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de supprimer (contient des utilisateurs)',
  })
  @ApiResponse({
    status: 404,
    description: 'Service introuvable',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.remove(id);
  }
}
