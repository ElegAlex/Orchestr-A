import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto, DateRangeEnum } from './dto/analytics-query.dto';
import {
  AnalyticsResponseDto,
  MetricDto,
  ProjectProgressDataDto,
  TaskStatusDataDto,
  ProjectDetailDto,
  WorkloadUserDto,
  VelocityPeriodDto,
  BurndownPointDto,
} from './dto/analytics-response.dto';
import { subDays, startOfWeek, eachWeekOfInterval, endOfWeek } from 'date-fns';
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
      name: project.name,
      progress: project.progress || 0,
      status: project.status,
      tasks: tasks.filter((t) => t.projectId === project.id).length,
      endDate: project.endDate ? project.endDate.toISOString() : undefined,
    }));
  }

  private getTaskStatusData(tasks: Task[]): TaskStatusDataDto[] {
    // All tasks (no subtask concept in schema)
    const statusCounts = {
      'À faire': tasks.filter((t) => t.status === 'TODO').length,
      Débuté: tasks.filter((t) => t.status === 'STARTED').length,
      'En cours': tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      'En revue': tasks.filter((t) => t.status === 'IN_REVIEW').length,
      Terminé: tasks.filter((t) => t.status === 'DONE').length,
      Bloqué: tasks.filter((t) => t.status === 'BLOCKED').length,
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color:
        name === 'Terminé'
          ? '#4caf50'
          : name === 'En cours' || name === 'En revue'
            ? '#ff9800'
            : name === 'Débuté'
              ? '#64b5f6'
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

  /**
   * Workload: hours planned (time entries) vs capacity (40h/week) per active user
   * over the last 4 weeks.
   */
  async getWorkload(query: AnalyticsQueryDto): Promise<WorkloadUserDto[]> {
    const startDate = this.getStartDate(query.dateRange ?? DateRangeEnum.MONTH);

    const where: Prisma.TimeEntryWhereInput = {
      date: { gte: startDate },
    };
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Aggregate hours per user from time entries
    const timeEntries = await this.prisma.timeEntry.groupBy({
      by: ['userId'],
      where,
      _sum: { hours: true },
    });

    if (timeEntries.length === 0) {
      return [];
    }

    const userIds = timeEntries.map((e) => e.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const usersMap = users.reduce(
      (acc, u) => {
        acc[u.id] = u;
        return acc;
      },
      {} as Record<string, { id: string; firstName: string; lastName: string }>,
    );

    // Capacity = 40 hours per week for the selected period
    const now = new Date();
    const weeks = Math.max(
      1,
      Math.round(
        (now.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000),
      ),
    );
    const capacity = weeks * 40;

    return timeEntries
      .filter((e) => usersMap[e.userId])
      .map((entry) => {
        const user = usersMap[entry.userId];
        const planned = Math.round((entry._sum.hours ?? 0) * 10) / 10;
        const utilization =
          capacity > 0 ? Math.round((planned / capacity) * 100) : 0;
        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          planned,
          capacity,
          utilization,
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }

  /**
   * Velocity: completed vs created tasks per week over the last 6 weeks.
   */
  async getVelocity(query: AnalyticsQueryDto): Promise<VelocityPeriodDto[]> {
    const now = new Date();
    const sixWeeksAgo = subDays(now, 42);

    const where: Prisma.TaskWhereInput = {
      createdAt: { gte: sixWeeksAgo },
    };
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: { status: true, createdAt: true, updatedAt: true },
    });

    const weeks = eachWeekOfInterval({ start: sixWeeksAgo, end: now });

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);
      const label = `S${index + 1}`;

      const created = tasks.filter(
        (t) => t.createdAt >= weekStart && t.createdAt <= weekEnd,
      ).length;

      const completed = tasks.filter(
        (t) =>
          t.status === 'DONE' &&
          t.updatedAt >= weekStart &&
          t.updatedAt <= weekEnd,
      ).length;

      return { period: label, completed, planned: created };
    });
  }

  /**
   * Burndown: remaining tasks over time for a project or globally.
   * Returns weekly data points: ideal vs actual remaining tasks.
   */
  async getBurndown(query: AnalyticsQueryDto): Promise<BurndownPointDto[]> {
    const where: Prisma.TaskWhereInput = {};
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: { status: true, createdAt: true, updatedAt: true, endDate: true },
    });

    if (tasks.length === 0) {
      return [];
    }

    const total = tasks.length;
    const now = new Date();

    // Use project/query date range for burndown window
    const startDate = this.getStartDate(query.dateRange ?? DateRangeEnum.MONTH);
    const weeks = eachWeekOfInterval({ start: startDate, end: now });

    const idealStep = weeks.length > 1 ? 100 / (weeks.length - 1) : 0;

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);

      // Count tasks done UP TO end of this week
      const doneCount = tasks.filter(
        (t) => t.status === 'DONE' && t.updatedAt <= weekEnd,
      ).length;

      const remainingPct =
        total > 0 ? Math.round(((total - doneCount) / total) * 100) : 0;
      const idealPct = Math.max(0, Math.round(100 - idealStep * index));

      return {
        day: `S${index + 1}`,
        ideal: idealPct,
        actual: remainingPct,
      };
    });
  }
}
