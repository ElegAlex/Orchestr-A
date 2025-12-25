import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonalTodoDto } from './dto/create-personal-todo.dto';
import { UpdatePersonalTodoDto } from './dto/update-personal-todo.dto';

const MAX_TODOS = 20;
const CLEANUP_DAYS = 7;

@Injectable()
export class PersonalTodosService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    // Auto-cleanup: supprimer les todos complétées depuis > 7 jours
    await this.cleanupOldCompleted(userId);

    return this.prisma.personalTodo.findMany({
      where: { userId },
      orderBy: [
        { completed: 'asc' }, // Non complétées d'abord
        { createdAt: 'desc' }, // Plus récentes en premier
      ],
    });
  }

  async create(userId: string, dto: CreatePersonalTodoDto) {
    // Vérifier la limite de 20 todos
    const count = await this.prisma.personalTodo.count({
      where: { userId },
    });

    if (count >= MAX_TODOS) {
      throw new BadRequestException(`Limite de ${MAX_TODOS} to-dos atteinte`);
    }

    return this.prisma.personalTodo.create({
      data: {
        userId,
        text: dto.text,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdatePersonalTodoDto) {
    const todo = await this.prisma.personalTodo.findUnique({
      where: { id },
    });

    if (!todo) {
      throw new NotFoundException('To-do non trouvée');
    }

    if (todo.userId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    const data: {
      text?: string;
      completed?: boolean;
      completedAt?: Date | null;
    } = {};

    if (dto.text !== undefined) {
      data.text = dto.text;
    }

    if (dto.completed !== undefined) {
      data.completed = dto.completed;
      // Mettre à jour completedAt
      data.completedAt = dto.completed ? new Date() : null;
    }

    return this.prisma.personalTodo.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string) {
    const todo = await this.prisma.personalTodo.findUnique({
      where: { id },
    });

    if (!todo) {
      throw new NotFoundException('To-do non trouvée');
    }

    if (todo.userId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    await this.prisma.personalTodo.delete({
      where: { id },
    });
  }

  private async cleanupOldCompleted(userId: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);

    await this.prisma.personalTodo.deleteMany({
      where: {
        userId,
        completed: true,
        completedAt: {
          lt: cutoffDate,
        },
      },
    });
  }
}
