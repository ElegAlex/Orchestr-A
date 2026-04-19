import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlanningService } from './planning.service';
import { PlanningOverviewQueryDto } from './dto/planning-overview-query.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('Planning')
@ApiBearerAuth()
@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('overview')
  @RequirePermissions('users:read')
  @ApiOperation({
    summary:
      'Récupérer en un seul appel toutes les données nécessaires à la vue planning',
    description:
      'Agrège users, services, tasks, leaves, events, telework, holidays, schoolVacations et predefinedAssignments pour la fenêtre demandée. Les sous-résultats respectent le RBAC dynamique de chaque domaine.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payload planning consolidé',
  })
  async getOverview(
    @Query() query: PlanningOverviewQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.planningService.getOverview(query.startDate, query.endDate, {
      id: user.id,
      role: user.role,
    });
  }
}
