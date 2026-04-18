// ===========================
// GANTT TIMELINE — DATE ↔ PIXEL MATH
// ===========================

import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  addDays,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  getDaysInMonth,
  getISOWeek,
  getISOWeekYear,
  isAfter,
  isBefore,
} from 'date-fns';

import type { GanttView } from './types';

// ===========================
// PUBLIC TYPES
// ===========================

export interface TimelineBucket {
  label: string;
  sublabel?: string;
  start: Date;
  end: Date;
  /** Proportional width (0–1) relative to total range */
  widthFraction: number;
}

// ===========================
// DEFAULTS
// ===========================

const DEFAULT_PIXELS: Record<GanttView, number> = {
  day: 65,
  week: 250,
  month: 300,
  quarter: 400,
};

export function getDefaultPixelsPerUnit(view: GanttView): number {
  return DEFAULT_PIXELS[view];
}

// ===========================
// DATE → X
// ===========================

/**
 * Convert a date to an x-pixel position relative to `origin`.
 *
 * - day:     1 unit = 1 calendar day
 * - week:    1 unit = 7 days
 * - month:   1 unit = 1 calendar month (proportional within month)
 * - quarter: 1 unit = 1 quarter (3 months, proportional)
 */
export function dateToX(
  date: Date,
  view: GanttView,
  origin: Date,
  pixelsPerUnit: number,
): number {
  const units = dateToFractionalUnits(date, view, origin);
  return units * pixelsPerUnit;
}

// ===========================
// X → DATE
// ===========================

/**
 * Inverse of `dateToX`. Converts an x-pixel position back to a Date.
 */
export function xToDate(
  x: number,
  view: GanttView,
  origin: Date,
  pixelsPerUnit: number,
): Date {
  const units = x / pixelsPerUnit;
  return fractionalUnitsToDate(units, view, origin);
}

// ===========================
// BUCKETS
// ===========================

const FRENCH_WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

const FRENCH_MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/**
 * Returns an array of timeline buckets covering [start, end].
 */
export function bucketsForRange(
  start: Date,
  end: Date,
  view: GanttView,
): TimelineBucket[] {
  const s = startOfDay(start);
  const e = startOfDay(end);

  switch (view) {
    case 'day':
      return dayBuckets(s, e);
    case 'week':
      return weekBuckets(s, e);
    case 'month':
      return monthBuckets(s, e);
    case 'quarter':
      return quarterBuckets(s, e);
  }
}

// ===========================
// INTERNAL — fractional unit helpers
// ===========================

function dateToFractionalUnits(date: Date, view: GanttView, origin: Date): number {
  const d = startOfDay(date);
  const o = startOfDay(origin);

  switch (view) {
    case 'day': {
      return differenceInCalendarDays(d, o);
    }
    case 'week': {
      return differenceInCalendarDays(d, o) / 7;
    }
    case 'month': {
      // Whole months + fractional position within the current month
      const wholeMonths = differenceInCalendarMonths(
        startOfMonth(d),
        startOfMonth(o),
      );

      // Fraction within origin month (subtract)
      const originFraction = fractionOfMonth(o);
      // Fraction within target month (add)
      const targetFraction = fractionOfMonth(d);

      // If same month, simple subtraction
      if (wholeMonths === 0) {
        return targetFraction - originFraction;
      }

      // units = wholeMonths - originFraction + targetFraction
      // (originFraction is what's left in the origin month, we subtract it
      //  because we already counted the full month)
      return wholeMonths - originFraction + targetFraction;
    }
    case 'quarter': {
      // Reuse month calculation, divide by 3
      return dateToFractionalUnits(date, 'month', origin) / 3;
    }
  }
}

function fractionalUnitsToDate(units: number, view: GanttView, origin: Date): Date {
  const o = startOfDay(origin);

  switch (view) {
    case 'day': {
      return addDays(o, Math.round(units));
    }
    case 'week': {
      return addDays(o, Math.round(units * 7));
    }
    case 'month': {
      // Start from origin, advance by remaining fraction of origin month first
      const originFrac = fractionOfMonth(o);
      let currentDate: Date;
      let remainingUnits: number;

      if (units >= 0) {
        // How much of the origin month is left
        const originRemainder = 1 - originFrac;

        if (units <= originRemainder) {
          // Still within the origin month
          const daysInOriginMonth = getDaysInMonth(o);
          return addDays(o, Math.round(units * daysInOriginMonth));
        }

        remainingUnits = units - originRemainder;
        currentDate = startOfMonth(addMonths(o, 1));

        // Advance whole months
        const wholeMonthsToAdvance = Math.floor(remainingUnits);
        currentDate = addMonths(currentDate, wholeMonthsToAdvance);
        const frac = remainingUnits - wholeMonthsToAdvance;
        const daysInTargetMonth = getDaysInMonth(currentDate);
        return addDays(currentDate, Math.round(frac * daysInTargetMonth));
      } else {
        // Negative direction
        const absFrac = fractionOfMonth(o); // how far into origin month

        if (Math.abs(units) <= absFrac) {
          const daysInOriginMonth = getDaysInMonth(o);
          return addDays(o, Math.round(units * daysInOriginMonth));
        }

        remainingUnits = Math.abs(units) - absFrac;
        currentDate = startOfMonth(o);

        const wholeMonthsBack = Math.ceil(remainingUnits);
        currentDate = addMonths(currentDate, -wholeMonthsBack);
        const frac = wholeMonthsBack - remainingUnits;
        const daysInTargetMonth = getDaysInMonth(currentDate);
        return addDays(currentDate, Math.round(frac * daysInTargetMonth));
      }
    }
    case 'quarter': {
      return fractionalUnitsToDate(units * 3, 'month', origin);
    }
  }
}

/** Returns the fraction of the month elapsed at the given date (0 = 1st, ~1 = last day). */
function fractionOfMonth(date: Date): number {
  const d = startOfDay(date);
  const dayOfMonth = d.getDate() - 1; // 0-based
  const daysInMonth = getDaysInMonth(d);
  return dayOfMonth / daysInMonth;
}

// ===========================
// INTERNAL — bucket builders
// ===========================

function dayBuckets(start: Date, end: Date): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  let current = startOfDay(start);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  while (!isAfter(current, end)) {
    buckets.push({
      label: String(current.getDate()),
      sublabel: FRENCH_WEEKDAYS[current.getDay()],
      start: startOfDay(current),
      end: endOfDay(current),
      widthFraction: 1 / totalDays,
    });
    current = addDays(current, 1);
  }
  return buckets;
}

function weekBuckets(start: Date, end: Date): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  const rangeStart = startOfDay(start);
  const rangeEnd = startOfDay(end);
  const totalRangeDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;

  // Start from the Monday of the week containing `start`
  let weekStart = startOfWeek(rangeStart, { weekStartsOn: 1 });

  while (!isAfter(weekStart, rangeEnd)) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const isoWeek = getISOWeek(weekStart);
    const isoYear = getISOWeekYear(weekStart);

    // Clamp to the actual range for width calculation
    const clampedStart = isBefore(weekStart, rangeStart) ? rangeStart : startOfDay(weekStart);
    const clampedEnd = isAfter(startOfDay(weekEnd), rangeEnd) ? rangeEnd : startOfDay(weekEnd);
    const daysInBucket = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

    // Check if week crosses year boundary
    const weekEndYear = getISOWeekYear(weekEnd);
    const sublabel = isoYear !== weekEndYear ? `${isoYear}/${weekEndYear}` : undefined;

    buckets.push({
      label: `S${isoWeek}`,
      sublabel,
      start: startOfDay(weekStart),
      end: endOfDay(weekEnd),
      widthFraction: daysInBucket / totalRangeDays,
    });

    weekStart = addDays(weekStart, 7);
  }
  return buckets;
}

function monthBuckets(start: Date, end: Date): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  const rangeStart = startOfDay(start);
  const rangeEnd = startOfDay(end);
  const totalRangeDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;

  let monthStart = startOfMonth(rangeStart);

  while (!isAfter(monthStart, rangeEnd)) {
    const monthEnd = endOfMonth(monthStart);

    const clampedStart = isBefore(monthStart, rangeStart) ? rangeStart : startOfDay(monthStart);
    const clampedEnd = isAfter(startOfDay(monthEnd), rangeEnd) ? rangeEnd : startOfDay(monthEnd);
    const daysInBucket = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

    buckets.push({
      label: FRENCH_MONTHS[monthStart.getMonth()],
      sublabel: String(monthStart.getFullYear()),
      start: startOfDay(monthStart),
      end: endOfDay(monthEnd),
      widthFraction: daysInBucket / totalRangeDays,
    });

    monthStart = addMonths(monthStart, 1);
  }
  return buckets;
}

function quarterBuckets(start: Date, end: Date): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  const rangeStart = startOfDay(start);
  const rangeEnd = startOfDay(end);
  const totalRangeDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;

  let qStart = startOfQuarter(rangeStart);

  while (!isAfter(qStart, rangeEnd)) {
    const qEnd = endOfQuarter(qStart);
    const quarterNumber = Math.floor(qStart.getMonth() / 3) + 1;

    const clampedStart = isBefore(qStart, rangeStart) ? rangeStart : startOfDay(qStart);
    const clampedEnd = isAfter(startOfDay(qEnd), rangeEnd) ? rangeEnd : startOfDay(qEnd);
    const daysInBucket = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

    buckets.push({
      label: `T${quarterNumber}`,
      sublabel: String(qStart.getFullYear()),
      start: startOfDay(qStart),
      end: endOfDay(qEnd),
      widthFraction: daysInBucket / totalRangeDays,
    });

    qStart = addMonths(qStart, 3);
  }
  return buckets;
}
