import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AssignThirdPartyToTaskDto } from './dto/assign-third-party-to-task.dto';
import { ThirdPartiesService } from './third-parties.service';

@ApiTags('third-parties')
@ApiBearerAuth()
@Controller('tasks/:taskId/third-party-assignees')
export class TasksThirdPartyAssigneesController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Get()
  @Permissions('third_parties:read')
  @ApiOperation({ summary: "Lister les tiers assignés à une tâche" })
  list(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.thirdPartiesService.listTaskAssignees(taskId);
  }

  @Post()
  @Permissions('third_parties:assign_to_task')
  @ApiOperation({ summary: 'Assigner un tiers à une tâche' })
  @ApiResponse({ status: 201, description: 'Tiers assigné' })
  @ApiResponse({ status: 400, description: 'Tiers déjà assigné' })
  @ApiResponse({ status: 404, description: 'Tâche ou tiers introuvable' })
  assign(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignThirdPartyToTaskDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.thirdPartiesService.assignToTask(
      taskId,
      dto.thirdPartyId,
      user.id,
    );
  }

  @Delete(':thirdPartyId')
  @Permissions('third_parties:assign_to_task')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Retirer un tiers d'une tâche" })
  @ApiResponse({ status: 204, description: 'Assignation supprimée' })
  @ApiResponse({ status: 404, description: 'Assignation introuvable' })
  async unassign(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('thirdPartyId', ParseUUIDPipe) thirdPartyId: string,
  ) {
    await this.thirdPartiesService.unassignFromTask(taskId, thirdPartyId);
  }
}
