import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolVacationsService } from './school-vacations.service';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSchoolVacationDto } from './dto/create-school-vacation.dto';
import { UpdateSchoolVacationDto } from './dto/update-school-vacation.dto';
import { SchoolVacationRangeQueryDto } from './dto/school-vacation-range-query.dto';
import { ImportSchoolVacationDto } from './dto/import-school-vacation.dto';
import { SettingsService } from '../settings/settings.service';
import { SchoolVacationZone } from 'database';
import type { User } from '@prisma/client';

@ApiTags('School Vacations')
@ApiBearerAuth()
@Controller('school-vacations')
export class SchoolVacationsController {
  constructor(
    private readonly schoolVacationsService: SchoolVacationsService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @RequirePermissions('school_vacations:read')
  @ApiOperation({ summary: 'Récupérer toutes les vacances scolaires' })
  @ApiQuery({
    name: 'year',
    description: 'Filtrer par année',
    required: false,
    example: 2025,
  })
  @ApiResponse({ status: 200, description: 'Liste des vacances scolaires' })
  async findAll(@Query('year', new ParseIntPipe({ optional: true })) year?: number) {
    return this.schoolVacationsService.findAll(year);
  }

  @Get('range')
  @RequirePermissions('school_vacations:read')
  @ApiOperation({ summary: 'Récupérer les vacances scolaires sur une période' })
  @ApiResponse({
    status: 200,
    description: 'Liste des vacances scolaires de la période',
  })
  async findByRange(@Query() query: SchoolVacationRangeQueryDto) {
    return this.schoolVacationsService.findByRange(
      query.startDate,
      query.endDate,
    );
  }

  @Get(':id')
  @RequirePermissions('school_vacations:read')
  @ApiOperation({ summary: 'Récupérer des vacances scolaires par ID' })
  @ApiParam({ name: 'id', description: 'ID des vacances scolaires' })
  @ApiResponse({ status: 200, description: 'Détail des vacances scolaires' })
  @ApiResponse({ status: 404, description: 'Vacances scolaires non trouvées' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolVacationsService.findOne(id);
  }

  @Post()
  @RequirePermissions('school_vacations:create')
  @ApiOperation({ summary: 'Créer des vacances scolaires (Admin uniquement)' })
  @ApiResponse({ status: 201, description: 'Vacances scolaires créées' })
  @ApiResponse({
    status: 409,
    description: 'Des vacances scolaires avec ce nom, zone et année existent déjà',
  })
  async create(
    @Body() createDto: CreateSchoolVacationDto,
    @CurrentUser() user: User,
  ) {
    return this.schoolVacationsService.create(createDto, user.id);
  }

  @Post('import')
  @RequirePermissions('school_vacations:create')
  @ApiOperation({
    summary:
      "Importer les vacances scolaires depuis l'Open Data Éducation Nationale (Admin uniquement)",
  })
  @ApiResponse({
    status: 201,
    description: 'Vacances scolaires importées',
    schema: {
      type: 'object',
      properties: {
        created: {
          type: 'number',
          description: 'Nombre de vacances créées',
        },
        skipped: {
          type: 'number',
          description: 'Nombre de vacances ignorées (déjà existantes)',
        },
      },
    },
  })
  async importFromOpenData(
    @Body() dto: ImportSchoolVacationDto,
    @CurrentUser() user: User,
  ) {
    const zoneStr = await this.settingsService.getValue<string>(
      'planning.schoolVacationZone',
      'A',
    );
    const zone = zoneStr as SchoolVacationZone;
    return this.schoolVacationsService.importFromOpenData(dto.year, zone, user.id);
  }

  @Patch(':id')
  @RequirePermissions('school_vacations:update')
  @ApiOperation({
    summary: 'Modifier des vacances scolaires (Admin uniquement)',
  })
  @ApiParam({ name: 'id', description: 'ID des vacances scolaires' })
  @ApiResponse({ status: 200, description: 'Vacances scolaires mises à jour' })
  @ApiResponse({ status: 404, description: 'Vacances scolaires non trouvées' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSchoolVacationDto,
  ) {
    return this.schoolVacationsService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('school_vacations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer des vacances scolaires (Admin uniquement)',
  })
  @ApiParam({ name: 'id', description: 'ID des vacances scolaires' })
  @ApiResponse({ status: 204, description: 'Vacances scolaires supprimées' })
  @ApiResponse({ status: 404, description: 'Vacances scolaires non trouvées' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.schoolVacationsService.remove(id);
  }
}
