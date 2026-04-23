import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Client, Prisma, ProjectStatus } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

export interface ClientProjectsResult {
  projects: Array<{
    id: string;
    name: string;
    status: ProjectStatus;
    manager: { id: string; firstName: string; lastName: string } | null;
    startDate: Date | null;
    endDate: Date | null;
    budgetHours: number | null;
    hoursLogged: number;
  }>;
  summary: {
    projectsActive: number;
    projectsTotal: number;
    budgetHoursTotal: number;
    hoursLoggedTotal: number;
    varianceHours: number;
  };
}

export interface ClientDeletionImpact {
  projectsCount: number;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto): Promise<Client> {
    return this.prisma.client.create({
      data: {
        name: dto.name,
      },
    });
  }

  async findAll(query: QueryClientsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { projects: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async getClientProjects(id: string): Promise<ClientProjectsResult> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    // Fetch project links for this client
    const projectClients = await this.prisma.projectClient.findMany({
      where: { clientId: id },
      select: { projectId: true },
    });

    const projectIds = projectClients.map((pc) => pc.projectId);

    if (projectIds.length === 0) {
      return {
        projects: [],
        summary: {
          projectsActive: 0,
          projectsTotal: 0,
          budgetHoursTotal: 0,
          hoursLoggedTotal: 0,
          varianceHours: 0,
        },
      };
    }

    // Fetch projects + manager in one query
    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        budgetHours: true,
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Aggregate hours per project in a single groupBy (avoids N+1)
    const hoursGroupBy = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds } },
      _sum: { hours: true },
    });

    // Index groupBy result by projectId
    const hoursByProjectId = new Map<string, number>();
    for (const row of hoursGroupBy) {
      if (row.projectId) {
        hoursByProjectId.set(row.projectId, row._sum.hours ?? 0);
      }
    }

    // Build response rows
    const projectRows = projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      manager: p.manager ?? null,
      startDate: p.startDate ?? null,
      endDate: p.endDate ?? null,
      budgetHours: p.budgetHours ?? null,
      hoursLogged: hoursByProjectId.get(p.id) ?? 0,
    }));

    // Summary
    const projectsActive = projectRows.filter(
      (p) => p.status === ProjectStatus.ACTIVE,
    ).length;
    const projectsTotal = projectRows.length;
    const budgetHoursTotal = projectRows.reduce(
      (sum, p) => sum + (p.budgetHours ?? 0),
      0,
    );
    const hoursLoggedTotal = projectRows.reduce(
      (sum, p) => sum + p.hoursLogged,
      0,
    );
    const varianceHours = budgetHoursTotal - hoursLoggedTotal;

    return {
      projects: projectRows,
      summary: {
        projectsActive,
        projectsTotal,
        budgetHoursTotal,
        hoursLoggedTotal,
        varianceHours,
      },
    };
  }

  async getDeletionImpact(id: string): Promise<ClientDeletionImpact> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const projectsCount = await this.prisma.projectClient.count({
      where: { clientId: id },
    });

    return { projectsCount };
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
      },
    });
  }

  async hardDelete(id: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const projectsCount = await this.prisma.projectClient.count({
      where: { clientId: id },
    });
    if (projectsCount > 0) {
      throw new ConflictException(
        `Client ${id} cannot be deleted: it is linked to ${projectsCount} project(s). Remove the associations first or archive the client instead.`,
      );
    }

    await this.prisma.client.delete({ where: { id } });
  }

  async assertExistsAndActive(id: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    if (!client.isActive) {
      throw new BadRequestException(`Client ${id} is archived`);
    }
  }

  async listProjectClients(projectId: string) {
    return this.prisma.projectClient.findMany({
      where: { projectId },
      include: {
        client: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignClientToProject(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    await this.assertExistsAndActive(clientId);

    try {
      return await this.prisma.projectClient.create({
        data: { projectId, clientId },
        include: { client: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Client ${clientId} is already assigned to project ${projectId}`,
        );
      }
      throw e;
    }
  }

  async removeClientFromProject(
    projectId: string,
    clientId: string,
  ): Promise<void> {
    const existing = await this.prisma.projectClient.findUnique({
      where: { projectId_clientId: { projectId, clientId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Client ${clientId} is not assigned to project ${projectId}`,
      );
    }
    await this.prisma.projectClient.delete({
      where: { projectId_clientId: { projectId, clientId } },
    });
  }
}
