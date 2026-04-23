import { Injectable } from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  MilestonesCompletionResponseDto,
  MilestoneByProjectDto,
} from '../dto/milestones-completion.dto';

@Injectable()
export class MilestonesCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMilestonesCompletion(): Promise<MilestonesCompletionResponseDto> {
    const now = new Date();

    const milestones = await this.prisma.milestone.findMany({
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    let completed = 0;
    let overdue = 0;
    let upcoming = 0;

    // Accumulate byProject data: projectId → { name, reached, total }
    const projectMap = new Map<
      string,
      { name: string; reached: number; total: number }
    >();

    for (const milestone of milestones) {
      const isCompleted = milestone.status === MilestoneStatus.COMPLETED;
      const isPastDue = milestone.dueDate < now;

      if (isCompleted) {
        completed++;
      } else if (isPastDue) {
        overdue++;
      } else {
        upcoming++;
      }

      // Accumulate byProject
      const projectId = milestone.project.id;
      const projectName = milestone.project.name;

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { name: projectName, reached: 0, total: 0 });
      }

      const entry = projectMap.get(projectId)!;
      entry.total++;
      if (isCompleted) {
        entry.reached++;
      }
    }

    // total (échus) = completed + overdue
    const total = completed + overdue;
    // onTime = completed (by convention — no completedAt field)
    const onTime = completed;
    const ratio = total > 0 ? onTime / total : 0;

    // byProject: exclude projects with 0 milestones (projectMap only contains
    // projects that have at least one milestone), sorted alphabetically by name
    const byProject: MilestoneByProjectDto[] = Array.from(
      projectMap.entries(),
    )
      .map(([projectId, { name, reached, total: projectTotal }]) => ({
        projectId,
        name,
        reached,
        total: projectTotal,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { onTime, total, ratio, completed, overdue, upcoming, byProject };
  }
}
