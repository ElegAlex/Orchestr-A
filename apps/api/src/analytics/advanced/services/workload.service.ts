import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkloadQueryDto, WorkloadUserDto } from '../dto/workload.dto';

const ACTIVE_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
] as const;

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(query: WorkloadQueryDto): Promise<WorkloadUserDto[]> {
    const limit = query.limit ?? 15;

    // Single query: fetch all active users with their tasks via both relations.
    // Filter active statuses at DB level to avoid pulling DONE tasks into memory.
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        tasks: {
          where: { status: { in: [...ACTIVE_STATUSES] } },
          select: { id: true, status: true },
        },
        taskAssignments: {
          where: { task: { status: { in: [...ACTIVE_STATUSES] } } },
          select: { task: { select: { id: true, status: true } } },
        },
      },
    });

    const result: WorkloadUserDto[] = [];

    for (const user of users) {
      // UNION DISTINCT: use Map<taskId, status> to deduplicate tasks that appear
      // in both Task.assigneeId and TaskAssignee.userId for the same user.
      // Only insert active statuses (defensive guard in case a DONE task leaked
      // through a future query change; the DB filter already prevents this in prod).
      const taskMap = new Map<string, TaskStatus>();

      for (const t of user.tasks) {
        const status = t.status as TaskStatus;
        if ((ACTIVE_STATUSES as readonly TaskStatus[]).includes(status)) {
          taskMap.set(t.id, status);
        }
      }
      for (const ta of user.taskAssignments) {
        if (!taskMap.has(ta.task.id)) {
          const status = ta.task.status as TaskStatus;
          if ((ACTIVE_STATUSES as readonly TaskStatus[]).includes(status)) {
            taskMap.set(ta.task.id, status);
          }
        }
      }

      // Exclude users with no active tasks (total=0) to avoid noise in results.
      if (taskMap.size === 0) continue;

      const counts = {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        BLOCKED: 0,
      };

      for (const status of taskMap.values()) {
        counts[status as keyof typeof counts]++;
      }

      result.push({
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        counts,
        total: taskMap.size,
      });
    }

    // Sort by total descending, then name ascending as stable tiebreaker.
    result.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return result.slice(0, limit);
  }
}
