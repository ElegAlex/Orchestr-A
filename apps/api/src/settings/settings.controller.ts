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
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

  // Authenticated, any role (no `settings:read`): the planning view + date
  // utils need the display config (formats, visible/special days) for EVERY
  // role. The full settings map stays gated (§NOTE 3); this returns only the
  // non-sensitive PUBLIC_SETTING_KEYS projection.
  @Get('public')
  @AllowSelfService()
  @ApiOperation({
    summary:
      'Récupérer la projection publique des paramètres (affichage + planning)',
  })
  @ApiBearerAuth()
  async findPublic() {
    return this.settingsService.findPublic();
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
    @CurrentUser('id') actorId: string,
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
      actorId,
    );
  }

  @Post('bulk')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Mettre à jour plusieurs paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateSettingsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.settingsService.bulkUpdate(bulkUpdateDto.settings, actorId);
  }

  @Post(':key/reset')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary:
      'Réinitialiser un paramètre à sa valeur par défaut (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetToDefault(
    @Param('key') key: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.settingsService.resetToDefault(key, actorId);
  }

  @Post('reset-all')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Réinitialiser tous les paramètres (Admin uniquement)',
  })
  @ApiBearerAuth()
  async resetAllToDefaults(@CurrentUser('id') actorId: string) {
    return this.settingsService.resetAllToDefaults(actorId);
  }

  @Delete(':key')
  @RequirePermissions('settings:update')
  @ApiOperation({
    summary: 'Supprimer un paramètre personnalisé (Admin uniquement)',
  })
  @ApiBearerAuth()
  async remove(@Param('key') key: string, @CurrentUser('id') actorId: string) {
    return this.settingsService.remove(key, actorId);
  }
}
