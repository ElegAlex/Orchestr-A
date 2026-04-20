import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(userId: string, createCommentDto: CreateCommentDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: createCommentDto.taskId },
    });
    if (!task) throw new NotFoundException('Tâche introuvable');

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
          },
        },
        task: { select: { id: true, title: true } },
      },
    });
  }

  async findAll(page = 1, limit = 1000, taskId?: string) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where = taskId ? { taskId } : {};

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

  async findOne(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        task: true,
      },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    return comment;
  }

  async update(id: string, userId: string, updateCommentDto: UpdateCommentDto) {
    const comment = await this.findOne(id);

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
          },
        },
      },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const comment = await this.findOne(id);

    // Seul l'auteur ou un utilisateur avec la permission comments:delete_any peut supprimer
    if (comment.authorId !== userId) {
      const permissions = (await this.permissionsService.getPermissionsForRole(
        userRole,
      )) as readonly string[];
      const canDeleteAny = permissions.some(
        (p) => p === 'comments:delete_any',
      );
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
