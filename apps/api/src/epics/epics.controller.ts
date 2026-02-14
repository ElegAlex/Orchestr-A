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
import { EpicsService } from './epics.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('epics')
@Controller('epics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Post()
  @Permissions('epics:create')
  @ApiOperation({ summary: 'Créer un epic' })
  @ApiResponse({ status: 201, description: 'Epic créé' })
  create(@Body() createEpicDto: CreateEpicDto) {
    return this.epicsService.create(createEpicDto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des epics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('projectId') projectId?: string,
  ) {
    return this.epicsService.findAll(page, limit, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un epic" })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.epicsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('epics:update')
  @ApiOperation({ summary: 'Modifier un epic' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEpicDto: UpdateEpicDto,
  ) {
    return this.epicsService.update(id, updateEpicDto);
  }

  @Delete(':id')
  @Permissions('epics:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un epic' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.epicsService.remove(id);
  }
}
