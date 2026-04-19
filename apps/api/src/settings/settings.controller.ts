import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpdateSettingDto,
  BulkUpdateSettingsDto,
} from './dto/update-setting.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Récupérer tous les paramètres' })
  @ApiBearerAuth()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Get('category/:category')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Récupérer les paramètres par catégorie' })
  @ApiBearerAuth()
  async findByCategory(@Param('category') category: string) {
    return this.settingsService.findByCategory(category);
  }

  @Get(':key')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Récupérer un paramètre par sa clé' })
  @ApiBearerAuth()
  async findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Put(':key')
  @RequirePermissions('settings:update')
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
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Mettre à jour plusieurs paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async bulkUpdate(@Body() bulkUpdateDto: BulkUpdateSettingsDto) {
    return this.settingsService.bulkUpdate(bulkUpdateDto.settings);
  }

  @Post(':key/reset')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary:
      'Réinitialiser un paramètre à sa valeur par défaut (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetToDefault(@Param('key') key: string) {
    return this.settingsService.resetToDefault(key);
  }

  @Post('reset-all')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Réinitialiser tous les paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetAllToDefaults() {
    return this.settingsService.resetAllToDefaults();
  }

  @Delete(':key')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Supprimer un paramètre personnalisé (Admin uniquement)',
  })
  @ApiBearerAuth()
  async remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
