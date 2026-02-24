import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('planning-export')
@Controller('planning-export')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  previewImport(@Body() body: { icsContent: string }) {
    return this.planningExportService.previewImport(body.icsContent);
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
    @Body() body: { icsContent: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.planningExportService.importIcs(body.icsContent, userId);
  }
}
