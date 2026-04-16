import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
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

@ApiTags('planning-export')
@Controller('planning-export')
@ApiBearerAuth()
export class PlanningExportController {
  constructor(private readonly planningExportService: PlanningExportService) {}

  @Get('ics')
  @ApiOperation({ summary: 'Exporter le planning au format ICS' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Fichier ICS genere' })
  async exportIcs(
    @CurrentUser('id') userId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Res() res?: FastifyReply,
  ) {
    const icsContent = await this.planningExportService.exportIcs(
      userId,
      start,
      end,
    );
    res!
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="planning.ics"')
      .send(icsContent);
  }

  @Post('ics/import/preview')
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
  @ApiOperation({ summary: 'Importer des evenements depuis un fichier ICS' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { icsContent: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: "Resultat de l'import" })
  importIcs(
    @Body() dto: ImportIcsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.planningExportService.importIcs(dto.icsContent, userId);
  }
}
