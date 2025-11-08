import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestoneStatus } from 'database';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMilestoneDto: CreateMilestoneDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createMilestoneDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const { dueDate, ...data } = createMilestoneDto;

    return this.prisma.milestone.create({
      data: {
        ...data,
        dueDate: new Date(dueDate),
        status: MilestoneStatus.PENDING,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async findAll(page = 1, limit = 10, projectId?: string, status?: MilestoneStatus) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.milestone.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.milestone.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone introuvable');
    return milestone;
  }

  async update(id: string, updateMilestoneDto: UpdateMilestoneDto) {
    await this.findOne(id);
    const { dueDate, ...data } = updateMilestoneDto;

    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...data,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.milestone.delete({ where: { id } });
    return { message: 'Milestone supprimé avec succès' };
  }

  async complete(id: string) {
    await this.findOne(id);
    return this.prisma.milestone.update({
      where: { id },
      data: { status: MilestoneStatus.COMPLETED },
    });
  }
}
