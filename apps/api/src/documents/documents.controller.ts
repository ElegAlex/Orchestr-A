import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnershipCheck } from '../common/decorators/ownership-check.decorator';

/**
 * Extract request IP / User-Agent for the OBS-006 audit trail. Mirrors the
 * auth.controller precedent (AUD-EMIT-001 / OBS-008): UA capped at 512 chars,
 * IP preferring the proxy-forwarded chain head.
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

@ApiTags('documents')
@Controller('documents')
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @RequirePermissions('documents:create')
  @ApiOperation({ summary: 'Uploader un document' })
  @ApiResponse({ status: 201, description: 'Document créé' })
  create(
    @CurrentUser() user: { id: string; role?: { code: string } | null },
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.create(user.id, createDocumentDto, {
      id: user.id,
      role: user.role?.code ?? null,
    });
  }

  @Get()
  @RequirePermissions('documents:read')
  @ApiOperation({ summary: 'Liste des documents' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('projectId') projectId?: string,
    @CurrentUser() user?: { id: string; role?: { code: string } | null },
  ) {
    return this.documentsService.findAll(
      page,
      limit,
      projectId,
      user ? { id: user.id, role: user.role?.code ?? null } : undefined,
    );
  }

  @Get(':id')
  @RequirePermissions('documents:read')
  @ApiOperation({ summary: "Détails d'un document" })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role?: { code: string } | null },
    @Req() req: any,
  ) {
    return this.documentsService.findOne(
      id,
      { id: user.id, role: user.role?.code ?? null },
      extractMeta(req),
    );
  }

  @Patch(':id')
  @RequirePermissions('documents:update')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @OwnershipCheck({
    resource: 'document',
    bypassPermission: 'documents:manage_any',
  })
  @ApiOperation({ summary: 'Modifier un document' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  @RequirePermissions('documents:delete')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @OwnershipCheck({
    resource: 'document',
    bypassPermission: 'documents:manage_any',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un document' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.remove(id);
  }
}
