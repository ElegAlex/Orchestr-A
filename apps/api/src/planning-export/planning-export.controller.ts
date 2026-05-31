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
import { clientIp } from '../common/fastify/trust-proxy.config';

/**
 * OBS-007 — extract request IP / User-Agent for the data-export audit trail.
 * Mirrors the documents/leaves controller precedent (UA capped at 512, real
 * client IP via clientIp() — req.ip, the leftmost untrusted hop).
 */
function extractMeta(req?: {
  headers?: Record<string, unknown>;
  ip?: string;
}): { ip?: string; ua?: string } {
  const uaRaw = req?.headers?.['user-agent'];
  const ua = typeof uaRaw === 'string' ? uaRaw.slice(0, 512) : undefined;
  // SEC-013: real client IP (req.ip = leftmost untrusted hop under
  // Fastify+trustProxy), not req.ips[0] (the nginx socket).
  const ip = clientIp(req);
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
