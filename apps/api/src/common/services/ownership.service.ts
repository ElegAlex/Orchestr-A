import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type OwnedResource =
  | 'leave'
  | 'telework'
  | 'timeEntry'
  | 'project'
  | 'event'
  | 'document';

/**
 * ProjectMember.role is a free-form string in the schema (see
 * packages/database/prisma/schema.prisma, ProjectMember.role). The known
 * "leader" labels used in seeds and the UI are listed below. For the purposes
 * of ownership, a user is considered "project owner" when they are:
 *   - the Project.createdById, OR
 *   - the Project.managerId, OR
 *   - the Project.sponsorId, OR
 *   - a ProjectMember with one of the leader role labels below.
 * The bypassPermission mechanism (e.g. 'projects:manage_any') handles the
 * admin-level override at the guard layer.
 */
const PROJECT_LEADER_MEMBER_ROLES = ['Chef de projet', 'OWNER', 'LEAD'];

/**
 * Shared, low-level ownership checker used by OwnershipGuard.
 * Each branch performs a minimal Prisma lookup selecting only the
 * ownership-relevant fields. Returns `false` when the resource is not found —
 * callers (guards/services) decide whether to surface 403 or 404.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async isOwner(
    resource: OwnedResource,
    resourceId: string,
    userId: string,
  ): Promise<boolean> {
    if (!resourceId || !userId) {
      return false;
    }

    switch (resource) {
      case 'leave':
        return this.isLeaveOwner(resourceId, userId);
      case 'telework':
        return this.isTeleworkOwner(resourceId, userId);
      case 'timeEntry':
        return this.isTimeEntryOwner(resourceId, userId);
      case 'project':
        return this.isProjectOwner(resourceId, userId);
      case 'event':
        return this.isEventOwner(resourceId, userId);
      case 'document':
        return this.isDocumentOwner(resourceId, userId);
      default:
        return false;
    }
  }

  private async isLeaveOwner(id: string, userId: string): Promise<boolean> {
    const row = await this.prisma.leave.findUnique({
      where: { id },
      select: { userId: true },
    });
    return !!row && row.userId === userId;
  }

  private async isTeleworkOwner(id: string, userId: string): Promise<boolean> {
    // Telework is stored in TeleworkSchedule (see schema.prisma).
    const row = await this.prisma.teleworkSchedule.findUnique({
      where: { id },
      select: { userId: true },
    });
    return !!row && row.userId === userId;
  }

  private async isTimeEntryOwner(id: string, userId: string): Promise<boolean> {
    // TimeEntry.userId may be null (third-party entries). We also accept the
    // declaredById as ownership since the declarer is the legitimate author.
    const row = await this.prisma.timeEntry.findUnique({
      where: { id },
      select: { userId: true, declaredById: true },
    });
    if (!row) return false;
    return row.userId === userId || row.declaredById === userId;
  }

  private async isProjectOwner(id: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        createdById: true,
        managerId: true,
        sponsorId: true,
      },
    });
    if (!project) return false;
    if (
      project.createdById === userId ||
      project.managerId === userId ||
      project.sponsorId === userId
    ) {
      return true;
    }

    // Fall back to a membership lookup with a leader-role filter.
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId,
        role: { in: PROJECT_LEADER_MEMBER_ROLES },
      },
      select: { id: true },
    });
    return !!member;
  }

  private async isEventOwner(id: string, userId: string): Promise<boolean> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      select: { createdById: true },
    });
    return !!row && row.createdById === userId;
  }

  private async isDocumentOwner(id: string, userId: string): Promise<boolean> {
    const row = await this.prisma.document.findUnique({
      where: { id },
      select: { uploadedBy: true },
    });
    return !!row && row.uploadedBy === userId;
  }
}
