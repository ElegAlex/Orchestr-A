import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEpicDto: CreateEpicDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createEpicDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    return this.prisma.epic.create({
      data: createEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async findAll(page = 1, limit = 1000, projectId?: string) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where = projectId ? { projectId } : {};

    const [data, total] = await Promise.all([
      this.prisma.epic.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.epic.count({ where }),
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
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');
    return epic;
  }

  async update(
    id: string,
    updateEpicDto: UpdateEpicDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    return this.prisma.epic.update({
      where: { id },
      data: updateEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async remove(
    id: string,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    await this.prisma.epic.delete({ where: { id } });
    return { message: 'Epic supprimé avec succès' };
  }

  /**
   * Verify the current user is a member of the epic's parent project.
   * Users with the ADMIN role bypass this check.
   */
  private async assertProjectMembership(
    epicId: string,
    userId: string,
    userRole?: string | null,
  ): Promise<void> {
    if (userRole === 'ADMIN') return;

    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      include: { project: { include: { members: true } } },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');

    const isMember = epic.project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this project');
    }
  }
}
