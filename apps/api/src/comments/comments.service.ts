import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async create(
    userId: string,
    createCommentDto: CreateCommentDto,
    currentUser?: AccessUser,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: createCommentDto.taskId },
    });
    if (!task) throw new NotFoundException('Tâche introuvable');
    if (currentUser) {
      await this.accessScope.assertCanReadTask(
        createCommentDto.taskId,
        currentUser,
      );
    }

    return this.prisma.comment.create({
      data: {
        ...createCommentDto,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        task: { select: { id: true, title: true } },
      },
    });
  }

  async findAll(
    page = 1,
    limit = 1000,
    taskId?: string,
    currentUser?: AccessUser,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where: any = taskId ? { taskId } : {};
    if (currentUser) {
      where.task = await this.accessScope.taskReadWhere(currentUser);
    }

    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              avatarPreset: true,
            },
          },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string, currentUser?: AccessUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        task: true,
      },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    if (currentUser) {
      await this.accessScope.assertCanReadTask(comment.taskId, currentUser);
    }
    return comment;
  }

  async update(
    id: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
    currentUser?: AccessUser,
  ) {
    const comment = await this.findOne(id, currentUser);

    // Seul l'auteur peut modifier son commentaire
    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres commentaires',
      );
    }

    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string, currentUser?: AccessUser) {
    const comment = await this.findOne(id, currentUser);

    // Seul l'auteur ou un rôle de gestion globale peut supprimer le commentaire d'autrui.
    if (comment.authorId !== userId) {
      const permissions = (await this.permissionsService.getPermissionsForRole(
        currentUser?.role
          ? typeof currentUser.role === 'string'
            ? currentUser.role
            : currentUser.role.code
          : null,
      )) as readonly string[];
      const canDeleteAny =
        permissions.includes('comments:delete_any') ||
        permissions.includes('projects:manage_any') ||
        permissions.includes('tasks:manage_any');
      if (!canDeleteAny) {
        throw new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres commentaires',
        );
      }
    }

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Commentaire supprimé avec succès' };
  }
}
