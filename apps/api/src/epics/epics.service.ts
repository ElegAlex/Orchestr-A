import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findAll(page = 1, limit = 10, projectId?: string) {
    const skip = (page - 1) * limit;
    const where = projectId ? { projectId } : {};

    const [data, total] = await Promise.all([
      this.prisma.epic.findMany({
        where,
        skip,
        take: limit,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

  async update(id: string, updateEpicDto: UpdateEpicDto) {
    await this.findOne(id);
    return this.prisma.epic.update({
      where: { id },
      data: updateEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.epic.delete({ where: { id } });
    return { message: 'Epic supprimé avec succès' };
  }
}
