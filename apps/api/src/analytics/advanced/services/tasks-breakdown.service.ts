import { Injectable } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AccessScopeService,
  AccessUser,
} from '../../../common/services/access-scope.service';
import {
  TasksBreakdownQueryDto,
  TasksBreakdownResponseDto,
} from '../dto/tasks-breakdown.dto';

@Injectable()
export class TasksBreakdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async getTasksBreakdown(
    query: TasksBreakdownQueryDto,
    currentUser?: AccessUser,
  ): Promise<TasksBreakdownResponseDto> {
    const projectScope = await this.accessScope.projectScopeWhere(currentUser);
    const projectIds =
      query.projectIds && query.projectIds.length > 0
        ? query.projectIds
        : undefined;

    const tasks = await this.prisma.task.findMany({
      select: { priority: true, status: true },
      where: {
        project: {
          status: 'ACTIVE',
          AND: [projectScope],
          ...(projectIds ? { id: { in: projectIds } } : {}),
        },
      },
    });

    const byPriority: TasksBreakdownResponseDto['byPriority'] = {
      CRITICAL: 0,
      HIGH: 0,
      NORMAL: 0,
      LOW: 0,
    };

    const byStatus: TasksBreakdownResponseDto['byStatus'] = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      BLOCKED: 0,
      DONE: 0,
    };

    for (const task of tasks) {
      if (task.priority === Priority.CRITICAL) byPriority.CRITICAL++;
      else if (task.priority === Priority.HIGH) byPriority.HIGH++;
      else if (task.priority === Priority.NORMAL) byPriority.NORMAL++;
      else if (task.priority === Priority.LOW) byPriority.LOW++;

      if (task.status === TaskStatus.TODO) byStatus.TODO++;
      else if (task.status === TaskStatus.IN_PROGRESS) byStatus.IN_PROGRESS++;
      else if (task.status === TaskStatus.IN_REVIEW) byStatus.IN_REVIEW++;
      else if (task.status === TaskStatus.BLOCKED) byStatus.BLOCKED++;
      else if (task.status === TaskStatus.DONE) byStatus.DONE++;
    }

    return { byPriority, byStatus };
  }
}
