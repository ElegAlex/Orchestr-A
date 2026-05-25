import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { AuditAction } from '../audit/audit.service';
import ical, { ICalCalendar } from 'ical-generator';
import * as nodeIcal from 'node-ical';

/**
 * OBS-007 — request metadata for the data-export audit trail. `ip`/`ua` are
 * threaded from the controller (extractMeta); optional so non-HTTP callers
 * (none today) degrade gracefully.
 */
export interface ExportMeta {
  ip?: string;
  ua?: string;
}

export interface IcsPreviewEvent {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

type ParameterValue = string | { val: string; params: Record<string, string> };

function stripHtml(str: string | undefined | null): string {
  return str?.replace(/<[^>]*>/g, '') ?? '';
}

function strVal(v: ParameterValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  return v.val;
}

@Injectable()
export class PlanningExportService {
  private readonly logger = new Logger(PlanningExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPersistence: AuditPersistenceService,
  ) {}

  async exportIcs(
    userId: string,
    start?: string,
    end?: string,
    meta?: ExportMeta,
  ): Promise<string> {
    const calendar: ICalCalendar = ical({ name: "Planning ORCHESTR'A" });

    const dateFilter: Record<string, unknown> = {};
    if (start) dateFilter['gte'] = new Date(start);
    if (end) dateFilter['lte'] = new Date(end);

    // Events where user is creator or participant
    const events = await this.prisma.event.findMany({
      where: {
        ...(start || end ? { date: dateFilter } : {}),
        OR: [{ createdById: userId }, { participants: { some: { userId } } }],
      },
    });

    for (const event of events) {
      const eventDate = new Date(event.date);
      let startDt: Date;
      let endDt: Date;

      if (event.isAllDay || !event.startTime) {
        startDt = eventDate;
        endDt = eventDate;
      } else {
        const [sh, sm] = event.startTime.split(':').map(Number);
        startDt = new Date(eventDate);
        startDt.setHours(sh, sm, 0, 0);

        if (event.endTime) {
          const [eh, em] = event.endTime.split(':').map(Number);
          endDt = new Date(eventDate);
          endDt.setHours(eh, em, 0, 0);
        } else {
          endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
        }
      }

      calendar.createEvent({
        id: event.id,
        summary: event.title,
        description: event.description ?? undefined,
        start: startDt,
        end: endDt,
        allDay: event.isAllDay,
      });
    }

    // Approved leaves for user
    const leaves = await this.prisma.leave.findMany({
      where: {
        userId,
        status: 'APPROVED',
        ...(start || end
          ? { OR: [{ startDate: dateFilter }, { endDate: dateFilter }] }
          : {}),
      },
      include: { leaveType: true },
    });

    for (const leave of leaves) {
      calendar.createEvent({
        id: `leave-${leave.id}`,
        summary: `Conge - ${leave.leaveType.name}`,
        start: new Date(leave.startDate),
        end: new Date(leave.endDate),
        allDay: true,
      });
    }

    // Telework days for user
    const teleworkDays = await this.prisma.teleworkSchedule.findMany({
      where: {
        userId,
        isTelework: true,
        ...(start || end ? { date: dateFilter } : {}),
      },
    });

    for (const tw of teleworkDays) {
      calendar.createEvent({
        id: `telework-${tw.id}`,
        summary: 'Teletravail',
        start: new Date(tw.date),
        end: new Date(tw.date),
        allDay: true,
      });
    }

    // OBS-007 — RGPD personal-data egress: record who exported which planning
    // range and how many rows. recordCount is the exact materialized row count
    // (events + leaves + telework), computed at egress time, not estimated.
    // Fire-and-forget: an export is a read path (GET), so a transient audit
    // hiccup must not 500 a successful export (OBS-006 read-path nuance).
    const recordCount = events.length + leaves.length + teleworkDays.length;
    void this.auditPersistence
      .log({
        action: AuditAction.DATA_EXPORTED,
        entityType: 'Export',
        entityId: userId,
        actorId: userId,
        payload: {
          format: 'ics',
          scope: 'planning',
          dateRange: { start: start ?? null, end: end ?? null },
          recordCount,
          ...(meta?.ip !== undefined ? { ip: meta.ip } : {}),
          ...(meta?.ua !== undefined ? { ua: meta.ua } : {}),
        },
      })
      .catch((err) => {
        this.logger.error(
          `Failed to persist DATA_EXPORTED audit event: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

    return calendar.toString();
  }

  async previewImport(icsContent: string): Promise<IcsPreviewEvent[]> {
    const parsed = nodeIcal.sync.parseICS(icsContent);
    const results: IcsPreviewEvent[] = [];

    for (const key of Object.keys(parsed)) {
      const component = parsed[key];
      if (!component || component.type !== 'VEVENT') continue;

      const vevent = component;
      const start = vevent.start;
      const end = vevent.end;

      const date = start
        ? start.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      let startTime: string | undefined;
      let endTime: string | undefined;

      if (start && !(start as unknown as { dateOnly?: boolean }).dateOnly) {
        startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
      }

      if (end && !(end as unknown as { dateOnly?: boolean }).dateOnly) {
        endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
      }

      results.push({
        title: stripHtml(strVal(vevent.summary)) || 'Sans titre',
        date,
        startTime,
        endTime,
        description: stripHtml(strVal(vevent.description)),
      });
    }

    return results;
  }

  async importIcs(
    icsContent: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number }> {
    const parsed = nodeIcal.sync.parseICS(icsContent);
    let imported = 0;
    let skipped = 0;

    for (const key of Object.keys(parsed)) {
      const component = parsed[key];
      if (!component || component.type !== 'VEVENT') continue;

      const vevent = component;
      const start = vevent.start;
      if (!start) {
        skipped++;
        continue;
      }

      try {
        const end = vevent.end;
        const isDateOnly = !!(start as unknown as { dateOnly?: boolean })
          .dateOnly;

        const isAllDay =
          isDateOnly ||
          (start.getHours() === 0 &&
            start.getMinutes() === 0 &&
            (!end || (end.getHours() === 0 && end.getMinutes() === 0)));

        let startTime: string | undefined;
        let endTime: string | undefined;

        if (!isAllDay) {
          startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
          if (end) {
            endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
          }
        }

        await this.prisma.event.create({
          data: {
            title: stripHtml(strVal(vevent.summary)) || 'Evenement importe',
            description: stripHtml(strVal(vevent.description)) || null,
            date: start,
            startTime: startTime ?? null,
            endTime: endTime ?? null,
            isAllDay,
            createdById: userId,
          },
        });

        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }
}
