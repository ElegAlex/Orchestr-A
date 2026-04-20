import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import {
  CurrentUser,
  CurrentUserRoleCode,
} from '../auth/decorators/current-user.decorator';

@ApiTags('comments')
@Controller('comments')
@ApiBearerAuth()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @RequirePermissions('comments:create')
  @ApiOperation({ summary: 'Créer un commentaire' })
  @ApiResponse({ status: 201, description: 'Commentaire créé' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.create(userId, createCommentDto);
  }

  @Get()
  @RequirePermissions('comments:read')
  @ApiOperation({ summary: 'Liste des commentaires' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'taskId', required: false, type: String })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('taskId') taskId?: string,
  ) {
    return this.commentsService.findAll(page, limit, taskId);
  }

  @Get(':id')
  @RequirePermissions('comments:read')
  @ApiOperation({ summary: "Détails d'un commentaire" })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('comments:update')
  @ApiOperation({ summary: 'Modifier son commentaire' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, userId, updateCommentDto);
  }

  @Delete(':id')
  @RequirePermissions('comments:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un commentaire (auteur ou admin)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoleCode() userRole: string | null,
  ) {
    return this.commentsService.remove(id, userId, userRole);
  }
}
