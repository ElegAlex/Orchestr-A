import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll(page = 1, limit = 10, taskId?: string) {
    const skip = (page - 1) * limit;
    const where = taskId ? { taskId } : {};

    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

    // Seul l'auteur ou un admin peut supprimer
    if (
      comment.authorId !== userId &&
      !['ADMIN', 'RESPONSABLE'].includes(userRole)
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres commentaires',
      );
    }

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Commentaire supprimé avec succès' };
  }
}
