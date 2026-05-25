import { Controller, Get, Post, Body, Query, Req, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { PlanningExportService } from './planning-export.service';
import { ImportIcsDto } from './dto/import-ics.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';

/**
 * OBS-007 — extract request IP / User-Agent for the data-export audit trail.
 * Mirrors the documents/leaves controller precedent (UA capped at 512, IP from
 * the proxy-forwarded chain head).
 */
function extractMeta(req?: {
  headers?: Record<string, unknown>;
  ip?: string;
  ips?: string[];
}): { ip?: string; ua?: string } {
  const uaRaw = req?.headers?.['user-agent'];
  const ua = typeof uaRaw === 'string' ? uaRaw.slice(0, 512) : undefined;
  const ip = req?.ips?.length ? req.ips[0] : (req?.ip ?? undefined);
  return { ip, ua };
}

@ApiTags('planning-export')
@Controller('planning-export')
@ApiBearerAuth()
export class PlanningExportController {
  constructor(private readonly planningExportService: PlanningExportService) {}

  @Get('ics')
  @AllowSelfService()
  @ApiOperation({ summary: 'Exporter le planning au format ICS' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Fichier ICS genere' })
  async exportIcs(
    @CurrentUser('id') userId: string,
    @Req() req: { headers?: Record<string, unknown>; ip?: string; ips?: string[] },
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Res() res?: FastifyReply,
  ) {
    const icsContent = await this.planningExportService.exportIcs(
      userId,
      start,
      end,
      extractMeta(req),
    );
    res!
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="planning.ics"')
      .send(icsContent);
  }

  @Post('ics/import/preview')
  @RequirePermissions('leaves:create')
  @ApiOperation({ summary: "Previsualiser l'import ICS" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { icsContent: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Liste des evenements parses' })
  previewImport(@Body() dto: ImportIcsDto) {
    return this.planningExportService.previewImport(dto.icsContent);
  }

  @Post('ics/import')
  @RequirePermissions('leaves:create')
  @ApiOperation({ summary: 'Importer des evenements depuis un fichier ICS' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { icsContent: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: "Resultat de l'import" })
  importIcs(@Body() dto: ImportIcsDto, @CurrentUser('id') userId: string) {
    return this.planningExportService.importIcs(dto.icsContent, userId);
  }
}
