import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * TST-017 — DB-reset endpoint for E2E test isolation.
 *
 * SECURITY: This module is only registered in AppModule when
 * NODE_ENV !== 'production' (conditional import in app.module.ts).
 * The endpoint also guards itself at the handler level as defense-in-depth.
 *
 * The route is @Public() because Playwright globalSetup runs before any
 * authentication state is established.
 */
@ApiTags('testing')
@Controller('testing')
export class TestingController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset E2E database — test environments only',
    description:
      'Truncates all tables and returns 204. Forbidden in production.',
  })
  async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    await this.prisma.cleanDatabase();
  }
}
