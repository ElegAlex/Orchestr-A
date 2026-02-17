import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto, DateRangeEnum } from './dto/analytics-query.dto';
import {
  AnalyticsResponseDto,
  MetricDto,
  ProjectProgressDataDto,
  TaskStatusDataDto,
  ProjectDetailDto,
} from './dto/analytics-response.dto';
import { subDays, startOfWeek } from 'date-fns';
import { Prisma, Task, User, ProjectStatus } from '@prisma/client';

// Types for analytics data
interface ProjectMember {
  role: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface ProjectWithDetails {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  budgetHours: number | null;
  progress: number;
  projectManager: string | null;
  _count: { tasks: number };
  members: ProjectMember[];
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics(query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
    const { dateRange = DateRangeEnum.MONTH, projectId } = query;
    const startDate = this.getStartDate(dateRange);

    // Fetch data
    const [projects, tasks, users] = await Promise.all([
      this.getProjects(startDate, projectId),
      this.getTasks(startDate, projectId),
      this.getActiveUsers(),
    ]);

    // Calculate metrics
    const metrics = this.calculateMetrics(projects, tasks, users);
    const projectProgressData = this.getProjectProgressData(projects, tasks);
    const taskStatusData = this.getTaskStatusData(tasks);
    const projectDetails = await this.getProjectDetails(projects, tasks);

    return {
      metrics,
      projectProgressData,
      taskStatusData,
      projectDetails,
    };
  }

  private getStartDate(dateRange: DateRangeEnum): Date {
    const now = new Date();
    switch (dateRange) {
      case DateRangeEnum.WEEK:
        return startOfWeek(now);
      case DateRangeEnum.MONTH:
        return subDays(now, 30);
      case DateRangeEnum.QUARTER:
        return subDays(now, 90);
      case DateRangeEnum.YEAR:
        return subDays(now, 365);
      default:
        return subDays(now, 30);
    }
  }

  private async getProjects(startDate: Date, projectId?: string) {
    const where: Prisma.ProjectWhereInput = {
      createdAt: { gte: startDate },
    };

    if (projectId) {
      where.id = projectId;
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        _count: {
          select: { tasks: true },
        },
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    // Recalculate progress for each project
    return Promise.all(
      projects.map(async (project) => {
        const progress = await this.calculateProjectProgress(project.id);
        const projectManager = project.members.find(
          (m) => m.role === 'Chef de projet' || m.role === 'MANAGER',
        );
        return {
          ...project,
          progress,
          projectManager: projectManager
            ? `${projectManager.user.firstName} ${projectManager.user.lastName}`
            : null,
        };
      }),
    );
  }

  private async calculateProjectProgress(projectId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { status: true },
    });

    if (tasks.length === 0) return 0;

    const doneCount = tasks.filter((t) => t.status === 'DONE').length;
    return Math.round((doneCount / tasks.length) * 100);
  }

  private async getTasks(startDate: Date, projectId?: string): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = {
      createdAt: { gte: startDate },
    };

    if (projectId) {
      where.projectId = projectId;
    }

    return this.prisma.task.findMany({ where });
  }

  private async getActiveUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
    });
  }

  private calculateMetrics(
    projects: ProjectWithDetails[],
    tasks: Task[],
    users: User[],
  ): MetricDto[] {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const completedProjects = projects.filter(
      (p) => p.status === 'COMPLETED',
    ).length;

    // All tasks (no subtask concept in schema)
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.endDate && new Date(t.endDate) < new Date() && t.status !== 'DONE',
    ).length;

    const activeUsers = users.length;
    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return [
      {
        title: 'Projets Actifs',
        value: activeProjects,
        change: totalProjects > 0 ? `${totalProjects} total` : '',
        trend: activeProjects > completedProjects ? 'up' : 'stable',
        color: 'primary',
      },
      {
        title: 'Taux de Completion',
        value: `${Math.round(completionRate)}%`,
        change: `${completedTasks}/${totalTasks} tâches`,
        trend:
          completionRate >= 75
            ? 'up'
            : completionRate >= 50
              ? 'stable'
              : 'down',
        color:
          completionRate >= 75
            ? 'success'
            : completionRate >= 50
              ? 'warning'
              : 'error',
      },
      {
        title: 'Tâches en Retard',
        value: overdueTasks,
        change: overdueTasks > 0 ? 'Attention requise' : 'Tout va bien',
        trend: overdueTasks > 0 ? 'down' : 'up',
        color: overdueTasks > 0 ? 'error' : 'success',
      },
      {
        title: 'Équipe Active',
        value: activeUsers,
        change: `${users.length} total`,
        trend: 'stable',
        color: 'info',
      },
    ];
  }

  private getProjectProgressData(
    projects: ProjectWithDetails[],
    tasks: Task[],
  ): ProjectProgressDataDto[] {
    return projects.map((project) => ({
      name:
        project.name.length > 15
          ? `${project.name.substring(0, 15)}...`
          : project.name,
      progress: project.progress || 0,
      status: project.status,
      tasks: tasks.filter((t) => t.projectId === project.id).length,
    }));
  }

  private getTaskStatusData(tasks: Task[]): TaskStatusDataDto[] {
    // All tasks (no subtask concept in schema)
    const statusCounts = {
      'À faire': tasks.filter((t) => t.status === 'TODO').length,
      'En cours': tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      Terminé: tasks.filter((t) => t.status === 'DONE').length,
      Bloqué: tasks.filter((t) => t.status === 'BLOCKED').length,
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color:
        name === 'Terminé'
          ? '#4caf50'
          : name === 'En cours'
            ? '#ff9800'
            : name === 'Bloqué'
              ? '#f44336'
              : '#2196f3',
    }));
  }

  private async getProjectDetails(
    projects: ProjectWithDetails[],
    tasks: Task[],
  ): Promise<ProjectDetailDto[]> {
    // Fetch all time entries for these projects
    const projectIds = projects.map((p) => p.id);
    const timeEntries = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
      },
      _sum: {
        hours: true,
      },
    });

    const timeEntriesMap = timeEntries.reduce(
      (acc, entry) => {
        if (entry.projectId) {
          acc[entry.projectId] = entry._sum.hours || 0;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return projects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const completedTasks = projectTasks.filter((t) => t.status === 'DONE');
      const totalLoggedHours = timeEntriesMap[project.id] || 0;
      const isOverdue =
        project.endDate &&
        new Date(project.endDate) < new Date() &&
        project.status !== 'COMPLETED';

      return {
        id: project.id,
        name: project.name,
        code: project.id.substring(0, 8).toUpperCase(), // Generate code from ID
        status: project.status,
        progress: project.progress || 0,
        totalTasks: projectTasks.length,
        completedTasks: completedTasks.length,
        projectManager: project.projectManager ?? undefined,
        loggedHours: totalLoggedHours,
        budgetHours: project.budgetHours || 0,
        startDate: project.startDate || project.createdAt,
        dueDate: project.endDate ?? undefined,
        isOverdue: !!isOverdue,
      };
    });
  }

  async exportAnalytics(query: AnalyticsQueryDto) {
    const analytics = await this.getAnalytics(query);
    return {
      ...analytics,
      generatedAt: new Date().toISOString(),
      dateRange: query.dateRange,
      projectId: query.projectId,
    };
  }
}
