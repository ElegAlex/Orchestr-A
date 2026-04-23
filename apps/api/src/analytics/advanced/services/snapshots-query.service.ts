import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SnapshotsQueryDto,
  SnapshotsResponseDto,
  ProjectSeriesDto,
  SnapshotPoint,
} from '../dto/snapshots-query.dto';

/**
 * Resolves multi-series progress snapshots for blocs 1 & 2 of the
 * Advanced Analytics tab.
 *
 * Calendar-day grouping uses UTC (`date.toISOString().slice(0,10)`) for
 * determinism and to avoid DST edge-cases with the Europe/Paris scheduler.
 *
 * Per-project dedup: when two snapshots share a UTC calendar day, the one
 * with the latest `date` timestamp wins (spec W1.F). The `progress` kept is
 * the value from that latest snapshot — not an average.
 *
 * portfolioAverage: arithmetic mean over ALL snapshots on a given UTC day,
 * across all resolved projects (not a mean-of-means).
 *
 * Projects with no snapshots in the requested range are included in
 * `perProject` with `points: []` so the UI can still show the project label.
 */
@Injectable()
export class SnapshotsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshots(query: SnapshotsQueryDto): Promise<SnapshotsResponseDto> {
    // ── 1. Resolve active projects ─────────────────────────────────────────
    const projects = await this.prisma.project.findMany({
      where: {
        status: 'ACTIVE',
        ...(query.projectIds?.length
          ? { id: { in: query.projectIds } }
          : {}),
      },
      select: { id: true, name: true },
    });

    if (projects.length === 0) {
      return { perProject: [], portfolioAverage: [] };
    }

    const projectIds = projects.map((p) => p.id);

    // ── 2. Fetch all matching snapshots in a single query (no N+1) ─────────
    const snapshots = await this.prisma.projectSnapshot.findMany({
      where: {
        projectId: { in: projectIds },
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      select: { projectId: true, progress: true, date: true },
      orderBy: { date: 'asc' },
    });

    // ── 3. Build perProject series ─────────────────────────────────────────
    // Group snapshots by projectId, then deduplicate within each day by
    // keeping the latest timestamp (MAX date per calendar day).
    const snapshotsByProject = new Map<
      string,
      Array<{ progress: number; date: Date }>
    >();

    for (const projectId of projectIds) {
      snapshotsByProject.set(projectId, []);
    }

    for (const snap of snapshots) {
      snapshotsByProject.get(snap.projectId)?.push({
        progress: snap.progress,
        date: snap.date,
      });
    }

    const perProject: ProjectSeriesDto[] = projects.map((project) => {
      const raw = snapshotsByProject.get(project.id) ?? [];

      // Dedup by UTC calendar day: keep the latest-timestamp entry per day.
      const latestByDay = new Map<string, { progress: number; date: Date }>();
      for (const snap of raw) {
        const dayKey = snap.date.toISOString().slice(0, 10);
        const existing = latestByDay.get(dayKey);
        if (!existing || snap.date > existing.date) {
          latestByDay.set(dayKey, snap);
        }
      }

      // Emit day-level ISO so series align on charts regardless of source TZ.
      const points: SnapshotPoint[] = Array.from(latestByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dayKey, snap]) => ({
          date: `${dayKey}T00:00:00.000Z`,
          progress: snap.progress,
        }));

      return { projectId: project.id, name: project.name, points };
    });

    // ── 4. Build portfolioAverage ──────────────────────────────────────────
    // Mean over ALL snapshots on a UTC calendar day (not a mean-of-means).
    const dayBuckets = new Map<string, { sum: number; count: number }>();

    for (const snap of snapshots) {
      const dayKey = snap.date.toISOString().slice(0, 10);
      const bucket = dayBuckets.get(dayKey) ?? { sum: 0, count: 0 };
      bucket.sum += snap.progress;
      bucket.count += 1;
      dayBuckets.set(dayKey, bucket);
    }

    const portfolioAverage: SnapshotPoint[] = Array.from(dayBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, { sum, count }]) => ({
        date: `${dayKey}T00:00:00.000Z`,
        progress: sum / count,
      }));

    return { perProject, portfolioAverage };
  }
}
