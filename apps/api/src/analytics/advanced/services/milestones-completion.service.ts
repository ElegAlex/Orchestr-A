import { Injectable } from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AccessScopeService,
  AccessUser,
} from '../../../common/services/access-scope.service';
import {
  MilestonesCompletionResponseDto,
  MilestoneByProjectDto,
  MilestoneDetailDto,
  MilestoneDetailStatus,
} from '../dto/milestones-completion.dto';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class MilestonesCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async getMilestonesCompletion(
    currentUser?: AccessUser,
  ): Promise<MilestonesCompletionResponseDto> {
    const now = new Date();
    const projectScope = await this.accessScope.projectScopeWhere(currentUser);

    const milestones = await this.prisma.milestone.findMany({
      where: { project: projectScope },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    let completed = 0;
    let overdue = 0;
    let upcoming = 0;

    const projectMap = new Map<
      string,
      { name: string; reached: number; total: number }
    >();

    for (const milestone of milestones) {
      const isCompleted = milestone.status === MilestoneStatus.COMPLETED;
      const isPastDue = milestone.dueDate < now;

      if (isCompleted) completed++;
      else if (isPastDue) overdue++;
      else upcoming++;

      const projectId = milestone.project.id;
      const projectName = milestone.project.name;

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { name: projectName, reached: 0, total: 0 });
      }

      const entry = projectMap.get(projectId)!;
      entry.total++;
      if (isCompleted) entry.reached++;
    }

    const total = completed + overdue;
    const onTime = completed;
    const ratio = total > 0 ? onTime / total : 0;

    const byProject: MilestoneByProjectDto[] = Array.from(projectMap.entries())
      .map(([projectId, { name, reached, total: projectTotal }]) => ({
        projectId,
        name,
        reached,
        total: projectTotal,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Détails individuels — utiles côté UI pour grouper "en retard" vs "à venir"
    const details: MilestoneDetailDto[] = milestones.map((milestone) => {
      const isCompleted = milestone.status === MilestoneStatus.COMPLETED;
      const isPastDue = milestone.dueDate < now;
      let status: MilestoneDetailStatus;
      if (isCompleted) status = 'COMPLETED';
      else if (isPastDue) status = 'OVERDUE';
      else status = 'UPCOMING';

      const dayMs = milestone.dueDate.getTime() - now.getTime();
      const daysFromNow = Math.round(dayMs / MS_PER_DAY);

      const projectAgg = projectMap.get(milestone.project.id)!;

      return {
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        projectId: milestone.project.id,
        projectName: milestone.project.name,
        dueDate: milestone.dueDate.toISOString(),
        daysFromNow,
        status,
        reachedInProject: projectAgg.reached,
        totalInProject: projectAgg.total,
      };
    });

    return {
      onTime,
      total,
      ratio,
      completed,
      overdue,
      upcoming,
      byProject,
      details,
    };
  }
}
