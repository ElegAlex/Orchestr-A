import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsResponseDto,
  MetricDto,
  ProjectProgressDataDto,
  TaskStatusDataDto,
  ProjectDetailDto,
} from './dto/analytics-response.dto';
import { Prisma, Task, User, ProjectStatus } from '@prisma/client';
import {
  AccessScopeService,
  AccessUser,
} from '../common/services/access-scope.service';
import {
  ArchivedFilter,
  archivedWhere,
} from '../projects/dto/archived-filter.dto';
import { CacheService } from '../common/services/cache.service';

/** Projected task shape — only the fields consumed by analytics calculations. */
type AnalyticsTask = Pick<Task, 'id' | 'status' | 'endDate' | 'projectId'>;

/** TTL for analytics cache entries (seconds). Balances freshness vs. Prisma load. */
const ANALYTICS_CACHE_TTL = 60;

/** Maximum number of projects returned in projectDetails to cap payload size (PER-027). */
export const PROJECT_DETAILS_LIMIT = 50;

// Types for analytics data
interface ProjectWithDetails {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  budgetHours: number | null;
  progress: number;
  icon: string | null;
  projectManager: string | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string } | null;
  } | null;
  _count: { tasks: number };
  clients?: Array<{ client: { id: string; name: string } }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
    private readonly cache: CacheService,
  ) {}

  /** Build a stable, user-scoped cache key so user A's report is never served to user B. */
  private buildAnalyticsCacheKey(
    query: AnalyticsQueryDto,
    currentUser?: AccessUser,
  ): string {
    const userId = currentUser?.id ?? 'anonymous';
    const { projectId, dateRange, archived } = query;
    return `cache:analytics:${userId}:${projectId ?? ''}:${dateRange ?? ''}:${archived ?? ''}`;
  }

  async getAnalytics(
    query: AnalyticsQueryDto,
    currentUser?: AccessUser,
  ): Promise<AnalyticsResponseDto> {
    const cacheKey = this.buildAnalyticsCacheKey(query, currentUser);
    const cached = await this.cache.get<AnalyticsResponseDto>(cacheKey);
    if (cached) return cached;

    const { projectId } = query;
    const projectScope = await this.accessScope.projectScopeWhere(currentUser);

    // Reports surface the user's full project scope. dateRange is reserved
    // for future period-bound queries (e.g. time entries) — it must not
    // narrow project or task visibility, otherwise users miss projects they
    // own (see incident: 36 projects in scope, only 7 displayed).
    // Archived projects are excluded by default; pass archived=all to include them.
    const archivedClause = archivedWhere(
      query.archived ?? ArchivedFilter.ACTIVE,
    );
    const projectWhere: Prisma.ProjectWhereInput = {
      AND: [projectScope, archivedClause],
    };

    // SA-PERF-011 / COR-005: ONE groupBy powers both taskStatusData and project progress.
    // Uses the same uncapped where as getTasks so taskStatusData and calculateMetrics
    // are always consistent, even when projects exceed PROJECT_DETAILS_LIMIT (50).
    // The second identical groupBy that ran inside getProjects has been removed.
    const taskStatusWhere: Prisma.TaskWhereInput = { project: projectWhere };
    if (projectId) taskStatusWhere.projectId = projectId;
    const taskStatusGroupBy = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: taskStatusWhere,
      _count: { _all: true },
    });

    // Fetch projects (progress computed from the shared groupBy), tasks, and users in parallel.
    const [projects, tasks, users] = await Promise.all([
      this.getProjects(projectId, projectWhere, taskStatusGroupBy),
      this.getTasks(projectId, projectWhere),
      this.getActiveUsers(projectWhere),
    ]);

    // Calculate metrics
    const metrics = this.calculateMetrics(projects, tasks, users);
    const projectProgressData = this.getProjectProgressData(
      projects,
      taskStatusGroupBy,
    );
    const taskStatusData = this.getTaskStatusData(taskStatusGroupBy);
    const projectDetails = await this.getProjectDetails(projects, tasks);

    const result: AnalyticsResponseDto = {
      metrics,
      projectProgressData,
      taskStatusData,
      projectDetails,
    };

    await this.cache.set(cacheKey, result, ANALYTICS_CACHE_TTL);
    return result;
  }

  private async getProjects(
    projectId: string | undefined,
    projectWhere: Prisma.ProjectWhereInput,
    /** Pre-computed groupBy result (SA-PERF-011: caller owns the single query). */
    statusGroupBy: Array<{
      projectId: string | null;
      status: string;
      _count: { _all: number };
    }>,
  ) {
    const where: Prisma.ProjectWhereInput = {
      AND: [projectWhere],
    };

    if (projectId) {
      where.id = projectId;
    }

    // SA-PERF-012: members include removed — not consumed in any analytics
    // computation or response DTO. Use _count for member counts if needed.
    const projects = await this.prisma.project.findMany({
      where,
      take: PROJECT_DETAILS_LIMIT,
      include: {
        _count: {
          select: { tasks: true },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
          },
        },
        clients: {
          select: {
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Build per-project progress from the shared groupBy (SA-PERF-011: no second groupBy here).
    const totalMap: Record<string, number> = {};
    const doneMap: Record<string, number> = {};
    for (const row of statusGroupBy) {
      if (!row.projectId) continue;
      totalMap[row.projectId] =
        (totalMap[row.projectId] ?? 0) + row._count._all;
      if (row.status === 'DONE') {
        doneMap[row.projectId] =
          (doneMap[row.projectId] ?? 0) + row._count._all;
      }
    }

    return projects.map((project) => {
      const total = totalMap[project.id] ?? 0;
      const progress =
        total === 0
          ? 0
          : Math.round(((doneMap[project.id] ?? 0) / total) * 100);
      return {
        ...project,
        progress,
        projectManager: project.manager
          ? `${project.manager.firstName} ${project.manager.lastName}`
          : null,
      };
    });
  }

  private async getTasks(
    projectId: string | undefined,
    projectWhere: Prisma.ProjectWhereInput,
  ): Promise<AnalyticsTask[]> {
    const where: Prisma.TaskWhereInput = {
      project: projectWhere,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    // PER-001: select only the four fields consumed by analytics (status, endDate,
    // projectId for metrics/details; id for completeness). Avoids fetching
    // title, description, assignees, etc. on large task sets.
    return this.prisma.task.findMany({
      where,
      select: { id: true, status: true, endDate: true, projectId: true },
    });
  }

  private async getActiveUsers(
    projectWhere: Prisma.ProjectWhereInput,
  ): Promise<Pick<User, 'id' | 'isActive'>[]> {
    const hasProjectScope = Object.keys(projectWhere).length > 0;
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(hasProjectScope
          ? {
              OR: [
                { projectMembers: { some: { project: projectWhere } } },
                { managedProjects: { some: projectWhere } },
                { sponsoredProjects: { some: projectWhere } },
                { createdProjects: { some: projectWhere } },
              ],
            }
          : {}),
      },
      select: { id: true, isActive: true },
    });
  }

  private calculateMetrics(
    projects: ProjectWithDetails[],
    tasks: AnalyticsTask[],
    users: Pick<User, 'id' | 'isActive'>[],
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
    taskStatusGroupBy: Array<{
      projectId: string | null;
      status: string;
      _count: { _all: number };
    }>,
  ): ProjectProgressDataDto[] {
    // PER-025: build a per-project task count from the groupBy result instead
    // of filtering the full in-memory task array (was O(P×T)).
    const taskCountMap: Record<string, number> = {};
    for (const row of taskStatusGroupBy) {
      if (!row.projectId) continue;
      taskCountMap[row.projectId] =
        (taskCountMap[row.projectId] ?? 0) + row._count._all;
    }
    return projects.map((project) => ({
      name: project.name,
      progress: project.progress || 0,
      status: project.status,
      tasks: taskCountMap[project.id] ?? 0,
      endDate: project.endDate ? project.endDate.toISOString() : undefined,
    }));
  }

  private getTaskStatusData(
    taskStatusGroupBy: Array<{
      projectId: string | null;
      status: string;
      _count: { _all: number };
    }>,
  ): TaskStatusDataDto[] {
    // PER-025: aggregate counts from the shared groupBy instead of running
    // 5 separate filter passes over the full in-memory task array.
    const countByStatus: Record<string, number> = {};
    for (const row of taskStatusGroupBy) {
      countByStatus[row.status] =
        (countByStatus[row.status] ?? 0) + row._count._all;
    }
    const statusCounts = {
      'À faire': countByStatus['TODO'] ?? 0,
      'En cours': countByStatus['IN_PROGRESS'] ?? 0,
      'En revue': countByStatus['IN_REVIEW'] ?? 0,
      Terminé: countByStatus['DONE'] ?? 0,
      Bloqué: countByStatus['BLOCKED'] ?? 0,
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color:
        name === 'Terminé'
          ? '#4caf50'
          : name === 'En cours' || name === 'En revue'
            ? '#ff9800'
            : name === 'Bloqué'
              ? '#f44336'
              : '#2196f3',
    }));
  }

  private async getProjectDetails(
    projects: ProjectWithDetails[],
    tasks: AnalyticsTask[],
  ): Promise<ProjectDetailDto[]> {
    // Segregate user hours and third-party hours via two parallel groupBy
    // so that workload aggregations never mix them. loggedHours = user hours,
    // thirdPartyLoggedHours = third-party hours.
    const projectIds = projects.map((p) => p.id);
    const [userTimeEntries, thirdPartyTimeEntries] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          userId: { not: null },
          isDismissal: false,
        },
        _sum: { hours: true },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          thirdPartyId: { not: null },
          isDismissal: false,
        },
        _sum: { hours: true },
      }),
    ]);

    const userHoursMap = userTimeEntries.reduce(
      (acc, entry) => {
        if (entry.projectId) {
          acc[entry.projectId] = Number(entry._sum.hours ?? 0);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const thirdPartyHoursMap = thirdPartyTimeEntries.reduce(
      (acc, entry) => {
        if (entry.projectId) {
          acc[entry.projectId] = Number(entry._sum.hours ?? 0);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return projects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const completedTasks = projectTasks.filter((t) => t.status === 'DONE');
      const totalLoggedHours = userHoursMap[project.id] || 0;
      const totalThirdPartyLoggedHours = thirdPartyHoursMap[project.id] || 0;
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
        manager: project.manager
          ? {
              id: project.manager.id,
              firstName: project.manager.firstName,
              lastName: project.manager.lastName,
            }
          : null,
        icon: project.icon ?? null,
        loggedHours: totalLoggedHours,
        thirdPartyLoggedHours: totalThirdPartyLoggedHours,
        budgetHours: project.budgetHours || 0,
        startDate: project.startDate || project.createdAt,
        dueDate: project.endDate ?? undefined,
        isOverdue: !!isOverdue,
        priority: project.priority,
        managerId: project.manager?.id ?? undefined,
        managerDepartment: project.manager?.department?.name ?? undefined,
        clients: (project.clients ?? []).map((pc) => pc.client),
      };
    });
  }

  async exportAnalytics(query: AnalyticsQueryDto, currentUser?: AccessUser) {
    const analytics = await this.getAnalytics(query, currentUser);
    return {
      ...analytics,
      generatedAt: new Date().toISOString(),
      dateRange: query.dateRange,
      projectId: query.projectId,
    };
  }
}
