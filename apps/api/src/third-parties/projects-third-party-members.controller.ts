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
import { AssignThirdPartyToProjectDto } from './dto/assign-third-party-to-project.dto';
import { ThirdPartiesService } from './third-parties.service';

@ApiTags('third-parties')
@ApiBearerAuth()
@Controller('projects/:projectId/third-party-members')
export class ProjectsThirdPartyMembersController {
  constructor(private readonly thirdPartiesService: ThirdPartiesService) {}

  @Get()
  @Permissions('third_parties:read')
  @ApiOperation({ summary: "Lister les tiers rattachés à un projet" })
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.thirdPartiesService.listProjectMembers(projectId);
  }

  @Post()
  @Permissions('third_parties:assign_to_project')
  @ApiOperation({ summary: 'Rattacher un tiers à un projet' })
  @ApiResponse({ status: 201, description: 'Tiers rattaché' })
  @ApiResponse({ status: 400, description: 'Tiers déjà rattaché' })
  @ApiResponse({ status: 404, description: 'Projet ou tiers introuvable' })
  attach(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AssignThirdPartyToProjectDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.thirdPartiesService.attachToProject(
      projectId,
      dto.thirdPartyId,
      user.id,
      dto.allocation,
    );
  }

  @Delete(':thirdPartyId')
  @Permissions('third_parties:assign_to_project')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Détacher un tiers d'un projet" })
  @ApiResponse({ status: 204, description: 'Rattachement supprimé' })
  @ApiResponse({ status: 404, description: 'Rattachement introuvable' })
  async detach(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('thirdPartyId', ParseUUIDPipe) thirdPartyId: string,
  ) {
    await this.thirdPartiesService.detachFromProject(projectId, thirdPartyId);
  }
}
