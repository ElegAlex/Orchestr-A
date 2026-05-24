import { describe, expect, it } from 'vitest';
import {
  calculateLeaveDays,
  LEAVE_TIMEZONE,
  parisYearWindow,
  splitLeaveByYear,
} from './leave-year-window';

// All Date instances in this suite are constructed with explicit UTC offsets
// or with the `Z` ISO suffix. We never rely on host TZ to interpret a string
// literal — that is the entire point of the helper. The forced
// process.env.TZ = 'Europe/Paris' from vitest.setup.ts is exercised by some
// cases here; UTC-host behavior is exercised by reading helper output that
// is host-TZ-independent by construction.

describe('leave-year-window', () => {
  describe('LEAVE_TIMEZONE', () => {
    it('is anchored on Europe/Paris', () => {
      expect(LEAVE_TIMEZONE).toBe('Europe/Paris');
    });
  });

  describe('parisYearWindow', () => {
    it('produces Paris-midnight Jan 1 / next-year Jan 1 (CET, UTC+1)', () => {
      const { start, endExclusive } = parisYearWindow(2026);
      expect(start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
      expect(endExclusive.toISOString()).toBe('2026-12-31T23:00:00.000Z');
    });

    it('endExclusive of year N equals start of year N+1', () => {
      expect(parisYearWindow(2025).endExclusive.toISOString()).toBe(
        parisYearWindow(2026).start.toISOString(),
      );
    });
  });

  describe('calculateLeaveDays — preserves legacy semantics', () => {
    it('single-instant leave, no half-day, returns 1', () => {
      const d = new Date('2026-01-15T00:00:00Z'); // Thu Paris
      expect(calculateLeaveDays(d, d)).toBe(1);
    });

    it('single-instant leave with half-day returns 0.5', () => {
      const d = new Date('2026-01-15T00:00:00Z');
      expect(calculateLeaveDays(d, d, 'MORNING')).toBe(0.5);
    });

    it('skips weekends in multi-day count', () => {
      // Fri 2026-01-16 → Mon 2026-01-19: weekdays = Fri + Mon = 2
      const start = new Date('2026-01-16T00:00:00Z');
      const end = new Date('2026-01-19T00:00:00Z');
      expect(calculateLeaveDays(start, end)).toBe(2);
    });

    it('applies start + end half-day adjustments together', () => {
      // Mon → Fri (5 weekdays), both half-days set → 5 - 1 = 4
      const start = new Date('2026-01-12T00:00:00Z');
      const end = new Date('2026-01-16T00:00:00Z');
      expect(calculateLeaveDays(start, end, 'AFTERNOON', 'MORNING')).toBe(4);
    });

    it('floors at 0.5 for all-weekend multi-day leaves', () => {
      // Sat → Sun: 0 weekdays; +half-day flag drives min-0.5 clamp
      const start = new Date('2026-01-17T00:00:00Z'); // Sat
      const end = new Date('2026-01-18T00:00:00Z'); // Sun
      expect(calculateLeaveDays(start, end, 'MORNING')).toBe(0.5);
    });
  });

  describe('splitLeaveByYear — year-window math', () => {
    it('returns one bucket for a leave entirely in year N', () => {
      // Mon 2026-03-02 → Fri 2026-03-06 = 5 weekdays
      const start = new Date('2026-03-02T00:00:00Z');
      const end = new Date('2026-03-06T00:00:00Z');
      const buckets = splitLeaveByYear(start, end);
      expect(buckets).toEqual([{ year: 2026, workDays: 5 }]);
    });

    it('returns one bucket for a leave entirely in year N+1', () => {
      // Mon 2027-01-04 → Fri 2027-01-08 = 5 weekdays
      const start = new Date('2027-01-04T00:00:00Z');
      const end = new Date('2027-01-08T00:00:00Z');
      const buckets = splitLeaveByYear(start, end);
      expect(buckets).toEqual([{ year: 2027, workDays: 5 }]);
    });

    it('splits Dec 28 2026 → Jan 8 2027 into both years', () => {
      // Dec 28 (Mon), 29 (Tue), 30 (Wed), 31 (Thu) → 4 in 2026
      //   (Jan 1 Fri 2027 is a public holiday in France but the helper does
      //   not consult a holiday calendar — it only filters weekends.)
      // Jan 1 (Fri), 4 (Mon), 5 (Tue), 6 (Wed), 7 (Thu), 8 (Fri) → 6 in 2027
      const start = new Date('2026-12-28T00:00:00Z');
      const end = new Date('2027-01-08T00:00:00Z');
      const buckets = splitLeaveByYear(start, end);
      expect(buckets).toEqual([
        { year: 2026, workDays: 4 },
        { year: 2027, workDays: 6 },
      ]);
    });

    it('charges the legacy floor (0.5) to start.year when all days are weekend', () => {
      // calculateLeaveDays floors at 0.5 for any multi-day leave; storage
      // records `days = 0.5` in this case. The split must report the same
      // figure or the gate would skip the check while storage consumes the
      // half-day off-the-books.
      const start = new Date('2026-12-26T00:00:00Z'); // Sat
      const end = new Date('2026-12-27T00:00:00Z'); // Sun
      expect(calculateLeaveDays(start, end)).toBe(0.5);
      expect(splitLeaveByYear(start, end)).toEqual([
        { year: 2026, workDays: 0.5 },
      ]);
    });

    it('charges startHalfDay to start.year, endHalfDay to end.year on cross-year leave', () => {
      // Cross-year Dec 31 2026 (Thu) → Jan 2 2027 (Sat)
      //   2026 weekdays: Thu Dec 31 = 1
      //   2027 weekdays: Fri Jan 1 = 1
      // startHalfDay → 2026 bucket = 0.5
      // endHalfDay → 2027 bucket = 0.5
      const start = new Date('2026-12-31T00:00:00Z');
      const end = new Date('2027-01-02T00:00:00Z');
      const buckets = splitLeaveByYear(start, end, 'AFTERNOON', 'MORNING');
      expect(buckets).toEqual([
        { year: 2026, workDays: 0.5 },
        { year: 2027, workDays: 0.5 },
      ]);
    });

    it('matches calculateLeaveDays exactly for any (start, end, halfDay) combination', () => {
      // Architectural invariant: storage.days === sum(bucket.workDays).
      // If this ever fails, the gate and storage disagree and the system
      // is back in the regime that produced findings #1–#3.
      const cases: Array<[string, string, string | null, string | null]> = [
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', null, null], // Mon-Fri
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', 'MORNING', null],
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', 'MORNING', 'AFTERNOON'],
        ['2026-12-28T00:00:00Z', '2027-01-08T00:00:00Z', null, null], // cross-year
        ['2026-12-28T00:00:00Z', '2027-01-08T00:00:00Z', 'MORNING', 'AFTERNOON'],
        ['2026-01-17T00:00:00Z', '2026-01-18T00:00:00Z', null, null], // weekend-only
        ['2026-01-17T00:00:00Z', '2026-01-18T00:00:00Z', 'MORNING', null], // weekend + half
      ];
      for (const [s, e, sh, eh] of cases) {
        const start = new Date(s);
        const end = new Date(e);
        const calc = calculateLeaveDays(start, end, sh, eh);
        const sum = splitLeaveByYear(start, end, sh, eh).reduce(
          (acc, b) => acc + b.workDays,
          0,
        );
        expect(sum).toBe(calc);
      }
    });

    it('single-instant leave returns one bucket in its Paris year', () => {
      const d = new Date('2026-07-15T00:00:00Z'); // Wed Paris
      expect(splitLeaveByYear(d, d)).toEqual([{ year: 2026, workDays: 1 }]);
      expect(splitLeaveByYear(d, d, 'MORNING')).toEqual([
        { year: 2026, workDays: 0.5 },
      ]);
    });

    it('sum of buckets matches a same-year calculateLeaveDays', () => {
      const start = new Date('2026-03-02T00:00:00Z');
      const end = new Date('2026-03-13T00:00:00Z');
      const sum = splitLeaveByYear(start, end).reduce(
        (acc, b) => acc + b.workDays,
        0,
      );
      expect(sum).toBe(calculateLeaveDays(start, end));
    });

    it('sum across years is monotonically additive for cross-year leaves', () => {
      // Verifies that a cross-year leave never duplicates a day in two buckets.
      const start = new Date('2026-12-21T00:00:00Z'); // Mon
      const end = new Date('2027-01-15T00:00:00Z'); // Fri
      const buckets = splitLeaveByYear(start, end);
      const sum = buckets.reduce((acc, b) => acc + b.workDays, 0);
      // Manually counted: 2026 weekdays Mon Dec 21 → Thu Dec 31 = 9
      //                  2027 weekdays Fri Jan 1 → Fri Jan 15 = 11
      expect(sum).toBe(20);
      expect(buckets).toEqual([
        { year: 2026, workDays: 9 },
        { year: 2027, workDays: 11 },
      ]);
    });
  });

  describe('host-TZ independence', () => {
    // These cases construct Dates from instants known to live on different
    // calendar days in UTC vs Paris. The helper output must be the same
    // regardless of the host TZ — that is the architectural guarantee. We
    // assert against the Paris-anchored expectation.

    it('treats 2025-12-31T23:30:00Z as Paris-2026-01-01', () => {
      // 23:30 UTC on Dec 31 = 00:30 Paris on Jan 1 (CET, UTC+1)
      const d = new Date('2025-12-31T23:30:00Z');
      const buckets = splitLeaveByYear(d, d);
      expect(buckets).toEqual([{ year: 2026, workDays: 1 }]);
    });

    it('treats 2026-01-01T00:30:00Z as Paris-2026-01-01 (same day)', () => {
      // 00:30 UTC on Jan 1 = 01:30 Paris on Jan 1
      const d = new Date('2026-01-01T00:30:00Z');
      const buckets = splitLeaveByYear(d, d);
      expect(buckets).toEqual([{ year: 2026, workDays: 1 }]);
    });

    it('treats 2025-12-31T22:30:00Z as Paris-2025-12-31', () => {
      // 22:30 UTC on Dec 31 = 23:30 Paris on Dec 31 — still 2025 in Paris
      const d = new Date('2025-12-31T22:30:00Z');
      const buckets = splitLeaveByYear(d, d);
      expect(buckets).toEqual([{ year: 2025, workDays: 1 }]);
    });

    it('DST-spanning leave (March 2026 transition) counts weekdays correctly', () => {
      // CET → CEST transition: 2026-03-29 (Sun) at 02:00 Paris.
      // Leave Fri 2026-03-27 → Tue 2026-03-31: weekdays = Fri + Mon + Tue = 3
      const start = new Date('2026-03-27T00:00:00Z');
      const end = new Date('2026-03-31T00:00:00Z');
      expect(calculateLeaveDays(start, end)).toBe(3);
      expect(splitLeaveByYear(start, end)).toEqual([
        { year: 2026, workDays: 3 },
      ]);
    });
  });

  describe('per-year zero-allocation scenario contract', () => {
    it('produces a bucket per year touched even when target year has no allocation', () => {
      // This is the case Wave 2 will use to reject the leave with a named
      // year. The helper itself does not know about allocations — it only
      // tells the caller "the 2027 bucket exists with N days" so the gate
      // can independently look up that year's allocation.
      const start = new Date('2026-12-28T00:00:00Z');
      const end = new Date('2027-01-08T00:00:00Z');
      const buckets = splitLeaveByYear(start, end);
      const years = buckets.map((b) => b.year);
      expect(years).toContain(2026);
      expect(years).toContain(2027);
    });
  });

  describe('COR-003 — public-holiday exclusion', () => {
    // Witness: Apr 27 (Mon) → May 1 (Fri) 2026 — five consecutive weekdays,
    // May 1 (Fête du Travail) is a non-working public holiday. The user's
    // illustrative range (Apr 28 → May 2) lands on a Sat at the end in 2026's
    // calendar (4 weekdays); Apr 27 → May 1 is the faithful 5→4 witness.
    const witnessStart = new Date('2026-04-27T00:00:00Z'); // Mon
    const witnessEnd = new Date('2026-05-01T00:00:00Z'); // Fri (holiday)
    const mayDay = new Set<string>(['2026-05-01']);

    it('calculateLeaveDays charges 5 without the holiday set (legacy/no-fix)', () => {
      // FAIL-pre / PASS-post anchor: this is the buggy figure the fix removes.
      expect(calculateLeaveDays(witnessStart, witnessEnd)).toBe(5);
    });

    it('calculateLeaveDays charges 4 when May 1 is a known holiday', () => {
      // The witness assertion: passes only when the helper consults the set.
      expect(
        calculateLeaveDays(witnessStart, witnessEnd, null, null, mayDay),
      ).toBe(4);
    });

    it('splitLeaveByYear drops the holiday from its year bucket', () => {
      expect(splitLeaveByYear(witnessStart, witnessEnd)).toEqual([
        { year: 2026, workDays: 5 },
      ]);
      expect(
        splitLeaveByYear(witnessStart, witnessEnd, null, null, mayDay),
      ).toEqual([{ year: 2026, workDays: 4 }]);
    });

    it('does not double-count a holiday that falls on a weekend', () => {
      // May 2 2026 is a Saturday: already excluded as a weekend. Including it
      // in the holiday set must not subtract a second time.
      const start = new Date('2026-04-27T00:00:00Z'); // Mon
      const end = new Date('2026-05-02T00:00:00Z'); // Sat
      const weekendHoliday = new Set<string>(['2026-05-02']);
      // Mon–Fri = 5 weekdays (Sat excluded), regardless of the set.
      expect(calculateLeaveDays(start, end)).toBe(5);
      expect(
        calculateLeaveDays(start, end, null, null, weekendHoliday),
      ).toBe(5);
    });

    it('subtracts a holiday independently in each year of a cross-year leave', () => {
      // Dec 28 2026 (Mon) → Jan 8 2027 (Fri). Inject one synthetic holiday in
      // each Paris year: Dec 30 2026 (Wed) and Jan 1 2027 (Fri).
      const start = new Date('2026-12-28T00:00:00Z');
      const end = new Date('2027-01-08T00:00:00Z');
      const set = new Set<string>(['2026-12-30', '2027-01-01']);
      // Without set: 2026 = Mon28,Tue29,Wed30,Thu31 = 4 ; 2027 = 6.
      expect(splitLeaveByYear(start, end)).toEqual([
        { year: 2026, workDays: 4 },
        { year: 2027, workDays: 6 },
      ]);
      // With set: each year loses exactly its own holiday.
      expect(splitLeaveByYear(start, end, null, null, set)).toEqual([
        { year: 2026, workDays: 3 },
        { year: 2027, workDays: 5 },
      ]);
    });

    it('floors at 0.5 and credits start.year when every day is a holiday', () => {
      // Mirror of the all-weekend floor case (line ~101) but driven by
      // holidays: Mon 2026-01-12 + Tue 2026-01-13, both in the holiday set.
      const start = new Date('2026-01-12T00:00:00Z'); // Mon
      const end = new Date('2026-01-13T00:00:00Z'); // Tue
      const set = new Set<string>(['2026-01-12', '2026-01-13']);
      expect(calculateLeaveDays(start, end, null, null, set)).toBe(0.5);
      expect(splitLeaveByYear(start, end, null, null, set)).toEqual([
        { year: 2026, workDays: 0.5 },
      ]);
    });

    it('keeps sum(buckets) === calculateLeaveDays when holidays are subtracted', () => {
      // Same architectural invariant as the weekend-only parameterized test,
      // now exercised WITH a holiday set: if these ever drift, the balance
      // gate and storage diverge again (the Wave 1 regression vector).
      const set = new Set<string>(['2026-01-14', '2027-01-01']);
      const cases: Array<[string, string, string | null, string | null]> = [
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', null, null],
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', 'MORNING', null],
        ['2026-01-12T00:00:00Z', '2026-01-16T00:00:00Z', 'MORNING', 'AFTERNOON'],
        ['2026-12-28T00:00:00Z', '2027-01-08T00:00:00Z', null, null],
        ['2026-12-28T00:00:00Z', '2027-01-08T00:00:00Z', 'MORNING', 'AFTERNOON'],
      ];
      for (const [s, e, sh, eh] of cases) {
        const start = new Date(s);
        const end = new Date(e);
        const calc = calculateLeaveDays(start, end, sh, eh, set);
        const sum = splitLeaveByYear(start, end, sh, eh, set).reduce(
          (acc, b) => acc + b.workDays,
          0,
        );
        expect(sum).toBe(calc);
      }
    });

    it('reproduces legacy behavior when holidayKeys is omitted (additive)', () => {
      // Existing callers that pass no set must see the exact prior figures.
      const start = new Date('2026-04-27T00:00:00Z');
      const end = new Date('2026-05-01T00:00:00Z');
      expect(calculateLeaveDays(start, end, null, null, undefined)).toBe(
        calculateLeaveDays(start, end),
      );
      expect(
        splitLeaveByYear(start, end, null, null, undefined),
      ).toEqual(splitLeaveByYear(start, end));
    });
  });
});
