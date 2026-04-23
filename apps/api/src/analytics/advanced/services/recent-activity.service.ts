import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  RecentActivityQueryDto,
  RecentActivityResponseDto,
  ActivityPointDto,
} from '../dto/recent-activity.dto';

@Injectable()
export class RecentActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentActivity(
    query: RecentActivityQueryDto,
  ): Promise<RecentActivityResponseDto> {
    const days = query.days ?? 30;
    const now = new Date();

    // Single query — orphan tasks (null projectId) are implicitly excluded
    // because project: { status: 'ACTIVE' } only matches tasks with a project.
    const tasks = await this.prisma.task.findMany({
      where: {
        project: { status: 'ACTIVE' },
      },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        endDate: true,
      },
    });

    // Build `days` UTC-date buckets aligned to calendar days so today's
    // completions land in the last bucket. Bucket[0] = oldest, Bucket[days-1] = today.
    // "since" is anchored to the start of the oldest bucket day (not "now - days*24h")
    // so the sum(trend.completed) invariant holds exactly across partial days / DST.
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const oldestBucket = new Date(
      todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000,
    );
    // Use oldestBucket as the effective window start for completed/created counts
    const windowStart = oldestBucket;

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(oldestBucket.getTime() + i * 24 * 60 * 60 * 1000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    let completed = 0;
    let created = 0;
    let overdue = 0;

    for (const task of tasks) {
      // completed = DONE AND updatedAt in window
      // updatedAt is used as proxy for completedAt — no completedAt field exists (see spec §6)
      if (task.status === TaskStatus.DONE && task.updatedAt >= windowStart) {
        completed++;
        const bucketKey = task.updatedAt.toISOString().slice(0, 10);
        if (buckets.has(bucketKey)) {
          buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
        }
      }

      // created = createdAt in window
      if (task.createdAt >= windowStart) {
        created++;
      }

      // overdue = not DONE AND endDate in the past (null endDate excluded naturally by Prisma/JS)
      if (task.status !== TaskStatus.DONE && task.endDate !== null && task.endDate < now) {
        overdue++;
      }
    }

    // completionRatio: proxy for velocity — see spec §6, may evolve
    const completionRatio =
      completed + created > 0 ? completed / (completed + created) : 0;

    // Build trend array ordered from oldest to most recent
    const trend: ActivityPointDto[] = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, completed: count }));

    return { completed, created, overdue, completionRatio, trend };
  }
}
