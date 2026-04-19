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
import { EpicsService } from './epics.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('epics')
@Controller('epics')
@ApiBearerAuth()
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Post()
  @RequirePermissions('epics:create')
  @ApiOperation({ summary: 'Créer un epic' })
  @ApiResponse({ status: 201, description: 'Epic créé' })
  create(@Body() createEpicDto: CreateEpicDto) {
    return this.epicsService.create(createEpicDto);
  }

  @Get()
  @RequirePermissions('epics:read')
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
  @RequirePermissions('epics:read')
  @ApiOperation({ summary: "Détails d'un epic" })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.epicsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('epics:update')
  @ApiOperation({ summary: 'Modifier un epic' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEpicDto: UpdateEpicDto,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    return this.epicsService.update(id, updateEpicDto, currentUserId, currentUserRole);
  }

  @Delete(':id')
  @RequirePermissions('epics:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un epic' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    return this.epicsService.remove(id, currentUserId, currentUserRole);
  }
}
