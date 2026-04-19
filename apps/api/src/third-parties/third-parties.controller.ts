import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { QueryThirdPartyDto } from './dto/query-third-party.dto';
import { UpdateThirdPartyDto } from './dto/update-third-party.dto';
import { ThirdPartiesService } from './third-parties.service';

@ApiTags('third-parties')
@ApiBearerAuth()
@Controller('third-parties')
export class ThirdPartiesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Post()
  @RequirePermissions('third_parties:create')
  @ApiOperation({ summary: 'Créer un tiers' })
  @ApiResponse({ status: 201, description: 'Tiers créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(
    @Body() dto: CreateThirdPartyDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.thirdPartiesService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions('third_parties:read')
  @ApiOperation({ summary: 'Lister les tiers (paginé)' })
  findAll(@Query() query: QueryThirdPartyDto) {
    return this.thirdPartiesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('third_parties:read')
  @ApiOperation({ summary: "Détail d'un tiers" })
  @ApiResponse({ status: 404, description: 'Tiers introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.thirdPartiesService.findOne(id);
  }

  @Get(':id/deletion-impact')
  @RequirePermissions('third_parties:delete')
  @ApiOperation({
    summary:
      "Compter les éléments qui seront supprimés en cascade si on hard delete ce tiers",
  })
  getDeletionImpact(@Param('id', ParseUUIDPipe) id: string) {
    return this.thirdPartiesService.getDeletionImpact(id);
  }

  @Patch(':id')
  @RequirePermissions('third_parties:update')
  @ApiOperation({ summary: 'Modifier un tiers' })
  @ApiResponse({ status: 404, description: 'Tiers introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThirdPartyDto,
  ) {
    return this.thirdPartiesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('third_parties:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer un tiers en hard delete (cascade sur time entries, assignations, rattachements)',
  })
  @ApiResponse({ status: 204, description: 'Tiers supprimé' })
  @ApiResponse({ status: 404, description: 'Tiers introuvable' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.thirdPartiesService.hardDelete(id);
  }
}
