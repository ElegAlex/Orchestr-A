import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpdateSettingDto,
  BulkUpdateSettingsDto,
} from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'database';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les paramètres' })
  @ApiBearerAuth()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Récupérer les paramètres par catégorie' })
  @ApiBearerAuth()
  async findByCategory(@Param('category') category: string) {
    return this.settingsService.findByCategory(category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Récupérer un paramètre par sa clé' })
  @ApiBearerAuth()
  async findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Put(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un paramètre (Admin uniquement)' })
  @ApiBearerAuth()
  async update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    // Parse la valeur si c'est du JSON
    let value: unknown;
    try {
      value = JSON.parse(updateSettingDto.value) as unknown;
    } catch {
      value = updateSettingDto.value;
    }

    return this.settingsService.update(
      key,
      value,
      updateSettingDto.description,
    );
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Mettre à jour plusieurs paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async bulkUpdate(@Body() bulkUpdateDto: BulkUpdateSettingsDto) {
    return this.settingsService.bulkUpdate(bulkUpdateDto.settings);
  }

  @Post(':key/reset')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Réinitialiser un paramètre à sa valeur par défaut (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetToDefault(@Param('key') key: string) {
    return this.settingsService.resetToDefault(key);
  }

  @Post('reset-all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Réinitialiser tous les paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetAllToDefaults() {
    return this.settingsService.resetAllToDefaults();
  }

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer un paramètre personnalisé (Admin uniquement)',
  })
  @ApiBearerAuth()
  async remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
