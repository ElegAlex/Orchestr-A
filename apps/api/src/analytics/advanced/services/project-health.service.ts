import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  HealthStatus,
  ProjectHealthRowDto,
} from '../dto/project-health.dto';

const ACTIVE_TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
] as const;

function computeHealth(
  overdueMilestones: number,
  endDate: Date | null,
): HealthStatus {
  const now = new Date();
  const endDateExpired = endDate != null && endDate < now;
  if (endDateExpired || overdueMilestones >= 3) return 'red';
  if (overdueMilestones >= 1) return 'orange';
  return 'green';
}

@Injectable()
export class ProjectHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectHealth(): Promise<ProjectHealthRowDto[]> {
    const now = new Date();

    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: {
        milestones: {
          select: { status: true, dueDate: true },
        },
        tasks: {
          where: { status: { in: [...ACTIVE_TASK_STATUSES] } },
          select: { id: true },
        },
        members: {
          select: { id: true },
        },
        snapshots: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { progress: true },
        },
      },
    });

    return projects.map((project) => {
      const progressPct =
        project.snapshots.length > 0 ? project.snapshots[0].progress : 0;

      const reached = project.milestones.filter(
        (m) => m.status === 'COMPLETED',
      ).length;

      const overdue = project.milestones.filter(
        (m) => m.status !== 'COMPLETED' && m.dueDate < now,
      ).length;

      const upcoming = project.milestones.filter(
        (m) => m.status !== 'COMPLETED' && m.dueDate >= now,
      ).length;

      const activeTasks = project.tasks.length;
      const teamSize = project.members.length;
      const health = computeHealth(overdue, project.endDate);

      return {
        projectId: project.id,
        name: project.name,
        progressPct,
        milestones: { reached, overdue, upcoming },
        activeTasks,
        teamSize,
        health,
      } satisfies ProjectHealthRowDto;
    });
  }
}
