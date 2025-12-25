import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidayRangeQueryDto } from './dto/holiday-range-query.dto';
import { Role } from 'database';

@ApiTags('Holidays')
@ApiBearerAuth()
@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les jours fériés' })
  @ApiResponse({ status: 200, description: 'Liste des jours fériés' })
  async findAll() {
    return this.holidaysService.findAll();
  }

  @Get('year/:year')
  @ApiOperation({ summary: "Récupérer les jours fériés d'une année" })
  @ApiParam({ name: 'year', description: 'Année', example: 2025 })
  @ApiResponse({
    status: 200,
    description: "Liste des jours fériés de l'année",
  })
  async findByYear(@Param('year', ParseIntPipe) year: number) {
    return this.holidaysService.findByYear(year);
  }

  @Get('range')
  @ApiOperation({ summary: 'Récupérer les jours fériés sur une période' })
  @ApiQuery({
    name: 'startDate',
    description: 'Date de début',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Date de fin',
    example: '2025-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des jours fériés de la période',
  })
  async findByRange(@Query() query: HolidayRangeQueryDto) {
    return this.holidaysService.findByRange(query.startDate, query.endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un jour férié par ID' })
  @ApiParam({ name: 'id', description: 'ID du jour férié' })
  @ApiResponse({ status: 200, description: 'Détail du jour férié' })
  @ApiResponse({ status: 404, description: 'Jour férié non trouvé' })
  async findOne(@Param('id') id: string) {
    return this.holidaysService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un nouveau jour férié (Admin uniquement)' })
  @ApiResponse({ status: 201, description: 'Jour férié créé' })
  @ApiResponse({
    status: 409,
    description: 'Un jour férié existe déjà à cette date',
  })
  async create(
    @Body() createHolidayDto: CreateHolidayDto,
    @CurrentUser() user: any,
  ) {
    return this.holidaysService.create(createHolidayDto, user.id);
  }

  @Post('import-french')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Importer les jours fériés français (Admin uniquement)',
  })
  @ApiQuery({ name: 'year', description: 'Année à importer', required: false })
  @ApiResponse({
    status: 201,
    description: 'Jours fériés importés',
    schema: {
      type: 'object',
      properties: {
        created: {
          type: 'number',
          description: 'Nombre de jours fériés créés',
        },
        skipped: {
          type: 'number',
          description: 'Nombre de jours fériés ignorés (déjà existants)',
        },
      },
    },
  })
  async importFrenchHolidays(
    @Query('year') year: string,
    @CurrentUser() user: any,
  ) {
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.holidaysService.importFrenchHolidays(targetYear, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un jour férié (Admin uniquement)' })
  @ApiParam({ name: 'id', description: 'ID du jour férié' })
  @ApiResponse({ status: 200, description: 'Jour férié mis à jour' })
  @ApiResponse({ status: 404, description: 'Jour férié non trouvé' })
  @ApiResponse({
    status: 409,
    description: 'Un jour férié existe déjà à cette date',
  })
  async update(
    @Param('id') id: string,
    @Body() updateHolidayDto: UpdateHolidayDto,
  ) {
    return this.holidaysService.update(id, updateHolidayDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un jour férié (Admin uniquement)' })
  @ApiParam({ name: 'id', description: 'ID du jour férié' })
  @ApiResponse({ status: 204, description: 'Jour férié supprimé' })
  @ApiResponse({ status: 404, description: 'Jour férié non trouvé' })
  async remove(@Param('id') id: string) {
    await this.holidaysService.remove(id);
  }

  @Get('working-days/count')
  @ApiOperation({ summary: 'Compter les jours ouvrés entre deux dates' })
  @ApiQuery({
    name: 'startDate',
    description: 'Date de début',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Date de fin',
    example: '2025-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Nombre de jours ouvrés',
    schema: {
      type: 'object',
      properties: {
        workingDays: { type: 'number', description: 'Nombre de jours ouvrés' },
      },
    },
  })
  async countWorkingDays(@Query() query: HolidayRangeQueryDto) {
    const count = await this.holidaysService.countWorkingDays(
      new Date(query.startDate),
      new Date(query.endDate),
    );
    return { workingDays: count };
  }
}
