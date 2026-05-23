import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * All leave-balance accounting is anchored on this timezone. The host's local
 * TZ never participates: a leave declared on 2025-12-31 by a Paris employee
 * must consume Paris's 2025 allocation regardless of whether the API process
 * runs in UTC, Europe/Paris, or anywhere else.
 */
export const LEAVE_TIMEZONE = 'Europe/Paris';

type DayKey = string;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parisDayKey(d: Date): DayKey {
  return formatInTimeZone(d, LEAVE_TIMEZONE, 'yyyy-MM-dd');
}

function nextDayKey(key: DayKey): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

function dayKeyToYear(key: DayKey): number {
  return Number(key.slice(0, 4));
}

function isWeekend(key: DayKey): boolean {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Year window anchored on Paris midnight, returned as UTC Dates suitable for
 * Prisma comparisons. `endExclusive` is the first instant of January 1 of the
 * next year, also Paris midnight expressed in UTC. Callers must use `lt`
 * (strict less-than) against `endExclusive`, not `lte`.
 */
export function parisYearWindow(year: number): {
  start: Date;
  endExclusive: Date;
} {
  return {
    start: fromZonedTime(`${year}-01-01 00:00:00`, LEAVE_TIMEZONE),
    endExclusive: fromZonedTime(`${year + 1}-01-01 00:00:00`, LEAVE_TIMEZONE),
  };
}

/**
 * Work days (Mon–Fri Paris) between `start` and `end` inclusive, with the
 * legacy half-day semantics preserved:
 *   - same-instant leave (`start.getTime() === end.getTime()`): 0.5 if any
 *     half-day flag is set, else 1 (no weekend filter, matching the prior
 *     implementation);
 *   - multi-day leave: weekday count − 0.5 per active half-day flag, floored
 *     at 0.5 globally.
 */
export function calculateLeaveDays(
  start: Date,
  end: Date,
  startHalfDay?: string | null,
  endHalfDay?: string | null,
): number {
  if (start.getTime() === end.getTime()) {
    return startHalfDay || endHalfDay ? 0.5 : 1;
  }
  let workDays = 0;
  let cursor = parisDayKey(start);
  const endKey = parisDayKey(end);
  while (cursor <= endKey) {
    if (!isWeekend(cursor)) workDays++;
    cursor = nextDayKey(cursor);
  }
  let adjustment = 0;
  if (startHalfDay) adjustment -= 0.5;
  if (endHalfDay) adjustment -= 0.5;
  return Math.max(0.5, workDays + adjustment);
}

/**
 * Decompose a leave into per-year buckets of work days. Each bucket reports
 * the work-day count that falls inside its Paris calendar year. Buckets are
 * sorted ascending by year; zero-day buckets are dropped.
 *
 * Half-day adjustments are charged to the year holding their boundary:
 * `startHalfDay` deducts 0.5 from `start`'s year, `endHalfDay` deducts 0.5
 * from `end`'s year. Per-year buckets are floored at 0 after adjustment
 * (unlike `calculateLeaveDays`, which floors at 0.5 globally — a single
 * weekend day with a half-day flag still counts there but contributes
 * nothing here, because per-year accounting must not invent days).
 */
export function splitLeaveByYear(
  start: Date,
  end: Date,
  startHalfDay?: string | null,
  endHalfDay?: string | null,
): Array<{ year: number; workDays: number }> {
  const startYear = dayKeyToYear(parisDayKey(start));
  const endYear = dayKeyToYear(parisDayKey(end));

  if (start.getTime() === end.getTime()) {
    const workDays = startHalfDay || endHalfDay ? 0.5 : 1;
    return workDays > 0 ? [{ year: startYear, workDays }] : [];
  }

  const buckets = new Map<number, number>();
  let cursor = parisDayKey(start);
  const endKey = parisDayKey(end);
  while (cursor <= endKey) {
    if (!isWeekend(cursor)) {
      const y = dayKeyToYear(cursor);
      buckets.set(y, (buckets.get(y) ?? 0) + 1);
    }
    cursor = nextDayKey(cursor);
  }
  if (startHalfDay) {
    buckets.set(startYear, Math.max(0, (buckets.get(startYear) ?? 0) - 0.5));
  }
  if (endHalfDay) {
    buckets.set(endYear, Math.max(0, (buckets.get(endYear) ?? 0) - 0.5));
  }
  return Array.from(buckets.entries())
    .filter(([, d]) => d > 0)
    .sort(([a], [b]) => a - b)
    .map(([year, workDays]) => ({ year, workDays }));
}
