import {
  dateToX,
  xToDate,
  bucketsForRange,
  getDefaultPixelsPerUnit,
  type TimelineBucket,
} from '../timeline-math';

// ===========================
// HELPERS
// ===========================

/** Create a date at midnight UTC-like local time */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ===========================
// getDefaultPixelsPerUnit
// ===========================

describe('getDefaultPixelsPerUnit', () => {
  it('returns 65 for day view', () => {
    expect(getDefaultPixelsPerUnit('day')).toBe(65);
  });

  it('returns 250 for week view', () => {
    expect(getDefaultPixelsPerUnit('week')).toBe(250);
  });

  it('returns 300 for month view', () => {
    expect(getDefaultPixelsPerUnit('month')).toBe(300);
  });

  it('returns 400 for quarter view', () => {
    expect(getDefaultPixelsPerUnit('quarter')).toBe(400);
  });
});

// ===========================
// dateToX
// ===========================

describe('dateToX', () => {
  const ppu = 100; // pixels per unit, easy math

  describe('day view', () => {
    it('returns 0 when date equals origin', () => {
      const origin = d(2026, 4, 1);
      expect(dateToX(origin, 'day', origin, ppu)).toBe(0);
    });

    it('returns positive x for dates after origin', () => {
      const origin = d(2026, 4, 1);
      const date = d(2026, 4, 11);
      expect(dateToX(date, 'day', origin, ppu)).toBe(10 * ppu);
    });

    it('returns negative x for dates before origin', () => {
      const origin = d(2026, 4, 10);
      const date = d(2026, 4, 5);
      expect(dateToX(date, 'day', origin, ppu)).toBe(-5 * ppu);
    });

    it('handles year boundaries', () => {
      const origin = d(2025, 12, 30);
      const date = d(2026, 1, 2);
      expect(dateToX(date, 'day', origin, ppu)).toBe(3 * ppu);
    });
  });

  describe('week view', () => {
    it('returns 0 when date equals origin', () => {
      const origin = d(2026, 4, 6); // Monday
      expect(dateToX(origin, 'week', origin, ppu)).toBe(0);
    });

    it('returns ppu for exactly 7 days later', () => {
      const origin = d(2026, 4, 6);
      const date = d(2026, 4, 13);
      expect(dateToX(date, 'week', origin, ppu)).toBe(ppu);
    });

    it('returns fractional value for mid-week', () => {
      const origin = d(2026, 4, 6);
      const date = d(2026, 4, 9); // 3 days later
      expect(dateToX(date, 'week', origin, ppu)).toBeCloseTo((3 / 7) * ppu, 5);
    });
  });

  describe('month view', () => {
    it('returns 0 when date equals origin', () => {
      const origin = d(2026, 4, 1);
      expect(dateToX(origin, 'month', origin, ppu)).toBe(0);
    });

    it('returns ppu for exactly one month later (1st to 1st)', () => {
      const origin = d(2026, 4, 1);
      const date = d(2026, 5, 1);
      expect(dateToX(date, 'month', origin, ppu)).toBeCloseTo(ppu, 1);
    });

    it('returns proportional value within a month', () => {
      const origin = d(2026, 4, 1);
      // April has 30 days; 15th = day index 14 => fraction = 14/30
      const date = d(2026, 4, 15);
      const expected = (14 / 30) * ppu;
      expect(dateToX(date, 'month', origin, ppu)).toBeCloseTo(expected, 1);
    });

    it('handles months with different lengths', () => {
      // Feb has 28 days in 2026, March has 31
      const origin = d(2026, 2, 1);
      const date = d(2026, 4, 1); // 2 months later
      expect(dateToX(date, 'month', origin, ppu)).toBeCloseTo(2 * ppu, 1);
    });

    it('handles leap year (Feb 2028 has 29 days)', () => {
      const origin = d(2028, 2, 1);
      const date = d(2028, 2, 15);
      // Feb 2028: 29 days, day index 14 => fraction = 14/29
      const expected = (14 / 29) * ppu;
      expect(dateToX(date, 'month', origin, ppu)).toBeCloseTo(expected, 1);
    });

    it('returns negative for dates before origin', () => {
      const origin = d(2026, 4, 1);
      const date = d(2026, 3, 1);
      expect(dateToX(date, 'month', origin, ppu)).toBeCloseTo(-ppu, 1);
    });
  });

  describe('quarter view', () => {
    it('returns 0 when date equals origin', () => {
      const origin = d(2026, 1, 1);
      expect(dateToX(origin, 'quarter', origin, ppu)).toBe(0);
    });

    it('returns ppu for exactly one quarter later', () => {
      const origin = d(2026, 1, 1);
      const date = d(2026, 4, 1);
      expect(dateToX(date, 'quarter', origin, ppu)).toBeCloseTo(ppu, 1);
    });

    it('returns proportional value within a quarter', () => {
      const origin = d(2026, 1, 1);
      // 1 month into Q1 = 1/3 of a quarter
      const date = d(2026, 2, 1);
      expect(dateToX(date, 'quarter', origin, ppu)).toBeCloseTo(ppu / 3, 1);
    });
  });
});

// ===========================
// xToDate
// ===========================

describe('xToDate', () => {
  const ppu = 100;

  describe('day view', () => {
    it('returns the origin for x=0', () => {
      const origin = d(2026, 4, 1);
      const result = xToDate(0, 'day', origin, ppu);
      expect(result.getTime()).toBe(origin.getTime());
    });

    it('returns correct date for positive x', () => {
      const origin = d(2026, 4, 1);
      const result = xToDate(5 * ppu, 'day', origin, ppu);
      expect(result.getTime()).toBe(d(2026, 4, 6).getTime());
    });

    it('returns correct date for negative x', () => {
      const origin = d(2026, 4, 10);
      const result = xToDate(-3 * ppu, 'day', origin, ppu);
      expect(result.getTime()).toBe(d(2026, 4, 7).getTime());
    });
  });

  describe('week view', () => {
    it('returns the origin for x=0', () => {
      const origin = d(2026, 4, 6);
      const result = xToDate(0, 'week', origin, ppu);
      expect(result.getTime()).toBe(origin.getTime());
    });

    it('returns date 7 days later for x=ppu', () => {
      const origin = d(2026, 4, 6);
      const result = xToDate(ppu, 'week', origin, ppu);
      expect(result.getTime()).toBe(d(2026, 4, 13).getTime());
    });
  });

  describe('month view', () => {
    it('returns the origin for x=0', () => {
      const origin = d(2026, 4, 1);
      const result = xToDate(0, 'month', origin, ppu);
      expect(result.getTime()).toBe(origin.getTime());
    });

    it('returns roughly one month later for x=ppu', () => {
      const origin = d(2026, 4, 1);
      const result = xToDate(ppu, 'month', origin, ppu);
      // Should be May 1st (within 1 day tolerance)
      const diff = Math.abs(daysBetween(result, d(2026, 5, 1)));
      expect(diff).toBeLessThanOrEqual(1);
    });

    it('handles small negative x from mid-month origin', () => {
      // Origin is April 15; go back a few days (still within April)
      const origin = d(2026, 4, 15);
      // dateToX for April 10 from origin April 15 in month view
      const x = dateToX(d(2026, 4, 10), 'month', origin, ppu);
      expect(x).toBeLessThan(0);
      const result = xToDate(x, 'month', origin, ppu);
      const diff = Math.abs(daysBetween(result, d(2026, 4, 10)));
      expect(diff).toBeLessThanOrEqual(1);
    });
  });

  describe('quarter view', () => {
    it('returns the origin for x=0', () => {
      const origin = d(2026, 1, 1);
      const result = xToDate(0, 'quarter', origin, ppu);
      expect(result.getTime()).toBe(origin.getTime());
    });

    it('returns roughly one quarter later for x=ppu', () => {
      const origin = d(2026, 1, 1);
      const result = xToDate(ppu, 'quarter', origin, ppu);
      const diff = Math.abs(daysBetween(result, d(2026, 4, 1)));
      expect(diff).toBeLessThanOrEqual(1);
    });
  });
});

// ===========================
// ROUND-TRIP: dateToX → xToDate
// ===========================

describe('round-trip dateToX → xToDate', () => {
  const ppu = 100;
  const origin = d(2026, 1, 1);

  const testDates = [
    d(2026, 1, 1),
    d(2026, 1, 15),
    d(2026, 3, 1),
    d(2026, 6, 15),
    d(2026, 12, 31),
    d(2025, 6, 15), // before origin
  ];

  describe.each(['day', 'week'] as const)('%s view (exact)', (view) => {
    it.each(testDates)('round-trips %s', (date) => {
      const x = dateToX(date, view, origin, ppu);
      const result = xToDate(x, view, origin, ppu);
      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe.each(['month', 'quarter'] as const)('%s view (1-day tolerance)', (view) => {
    it.each(testDates)('round-trips %s', (date) => {
      const x = dateToX(date, view, origin, ppu);
      const result = xToDate(x, view, origin, ppu);
      const diff = Math.abs(daysBetween(result, date));
      expect(diff).toBeLessThanOrEqual(1);
    });
  });
});

// ===========================
// bucketsForRange
// ===========================

describe('bucketsForRange', () => {
  describe('day view', () => {
    it('returns one bucket per day', () => {
      const start = d(2026, 4, 13); // Monday
      const end = d(2026, 4, 17);   // Friday
      const buckets = bucketsForRange(start, end, 'day');

      expect(buckets).toHaveLength(5);
    });

    it('labels are day numbers', () => {
      const start = d(2026, 4, 13);
      const end = d(2026, 4, 15);
      const buckets = bucketsForRange(start, end, 'day');

      expect(buckets[0].label).toBe('13');
      expect(buckets[1].label).toBe('14');
      expect(buckets[2].label).toBe('15');
    });

    it('sublabels are French weekday abbreviations', () => {
      const start = d(2026, 4, 13); // Monday
      const end = d(2026, 4, 17);   // Friday
      const buckets = bucketsForRange(start, end, 'day');

      expect(buckets[0].sublabel).toBe('lun.');
      expect(buckets[1].sublabel).toBe('mar.');
      expect(buckets[2].sublabel).toBe('mer.');
      expect(buckets[3].sublabel).toBe('jeu.');
      expect(buckets[4].sublabel).toBe('ven.');
    });

    it('widthFractions sum to 1', () => {
      const buckets = bucketsForRange(d(2026, 4, 1), d(2026, 4, 30), 'day');
      const sum = buckets.reduce((acc, b) => acc + b.widthFraction, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('handles single day', () => {
      const date = d(2026, 4, 15);
      const buckets = bucketsForRange(date, date, 'day');
      expect(buckets).toHaveLength(1);
      expect(buckets[0].widthFraction).toBe(1);
    });
  });

  describe('week view', () => {
    it('returns correct number of week buckets', () => {
      // 2026-04-06 (Mon) to 2026-04-19 (Sun) = 2 full weeks
      const start = d(2026, 4, 6);
      const end = d(2026, 4, 19);
      const buckets = bucketsForRange(start, end, 'week');

      expect(buckets).toHaveLength(2);
    });

    it('labels are S{weekNumber}', () => {
      const start = d(2026, 4, 6);
      const end = d(2026, 4, 12);
      const buckets = bucketsForRange(start, end, 'week');

      expect(buckets[0].label).toMatch(/^S\d+$/);
    });

    it('includes partial weeks at boundaries', () => {
      // Start on Wednesday, end on Tuesday next week → spans 2 ISO weeks
      const start = d(2026, 4, 8);  // Wednesday
      const end = d(2026, 4, 14);   // Tuesday
      const buckets = bucketsForRange(start, end, 'week');

      expect(buckets).toHaveLength(2);
    });

    it('widthFractions sum to approximately 1', () => {
      const buckets = bucketsForRange(d(2026, 4, 6), d(2026, 5, 3), 'week');
      const sum = buckets.reduce((acc, b) => acc + b.widthFraction, 0);
      expect(sum).toBeCloseTo(1, 1);
    });
  });

  describe('month view', () => {
    it('returns one bucket per month', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 3, 31);
      const buckets = bucketsForRange(start, end, 'month');

      expect(buckets).toHaveLength(3);
    });

    it('labels are French month abbreviations', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 3, 31);
      const buckets = bucketsForRange(start, end, 'month');

      expect(buckets[0].label).toBe('janv.');
      expect(buckets[1].label).toBe('févr.');
      expect(buckets[2].label).toBe('mars');
    });

    it('sublabels are years', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 1, 31);
      const buckets = bucketsForRange(start, end, 'month');

      expect(buckets[0].sublabel).toBe('2026');
    });

    it('handles year boundaries', () => {
      const start = d(2025, 11, 1);
      const end = d(2026, 2, 28);
      const buckets = bucketsForRange(start, end, 'month');

      expect(buckets).toHaveLength(4);
      expect(buckets[0].sublabel).toBe('2025');
      expect(buckets[1].sublabel).toBe('2025');
      expect(buckets[2].sublabel).toBe('2026');
      expect(buckets[3].sublabel).toBe('2026');
    });

    it('widthFractions sum to approximately 1', () => {
      const buckets = bucketsForRange(d(2026, 1, 1), d(2026, 12, 31), 'month');
      const sum = buckets.reduce((acc, b) => acc + b.widthFraction, 0);
      expect(sum).toBeCloseTo(1, 1);
    });

    it('handles partial months at boundaries', () => {
      const start = d(2026, 1, 15);
      const end = d(2026, 3, 15);
      const buckets = bucketsForRange(start, end, 'month');

      // Jan (partial), Feb (full), Mar (partial)
      expect(buckets).toHaveLength(3);
      // Jan partial should be smaller than Feb full
      expect(buckets[0].widthFraction).toBeLessThan(buckets[1].widthFraction);
    });
  });

  describe('quarter view', () => {
    it('returns one bucket per quarter', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 12, 31);
      const buckets = bucketsForRange(start, end, 'quarter');

      expect(buckets).toHaveLength(4);
    });

    it('labels are T1/T2/T3/T4', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 12, 31);
      const buckets = bucketsForRange(start, end, 'quarter');

      expect(buckets[0].label).toBe('T1');
      expect(buckets[1].label).toBe('T2');
      expect(buckets[2].label).toBe('T3');
      expect(buckets[3].label).toBe('T4');
    });

    it('sublabels are years', () => {
      const start = d(2026, 1, 1);
      const end = d(2026, 6, 30);
      const buckets = bucketsForRange(start, end, 'quarter');

      expect(buckets[0].sublabel).toBe('2026');
      expect(buckets[1].sublabel).toBe('2026');
    });

    it('handles year boundaries', () => {
      const start = d(2025, 10, 1);
      const end = d(2026, 3, 31);
      const buckets = bucketsForRange(start, end, 'quarter');

      expect(buckets).toHaveLength(2);
      expect(buckets[0].label).toBe('T4');
      expect(buckets[0].sublabel).toBe('2025');
      expect(buckets[1].label).toBe('T1');
      expect(buckets[1].sublabel).toBe('2026');
    });

    it('widthFractions sum to approximately 1', () => {
      const buckets = bucketsForRange(d(2026, 1, 1), d(2026, 12, 31), 'quarter');
      const sum = buckets.reduce((acc, b) => acc + b.widthFraction, 0);
      expect(sum).toBeCloseTo(1, 1);
    });
  });

  describe('edge cases', () => {
    it('leap year February in month view', () => {
      const start = d(2028, 2, 1);
      const end = d(2028, 2, 29);
      const buckets = bucketsForRange(start, end, 'month');

      expect(buckets).toHaveLength(1);
      expect(buckets[0].label).toBe('févr.');
    });

    it('all bucket start dates are before or equal to end dates', () => {
      const buckets = bucketsForRange(d(2026, 1, 1), d(2026, 12, 31), 'month');
      for (const b of buckets) {
        expect(b.start.getTime()).toBeLessThanOrEqual(b.end.getTime());
      }
    });
  });
});
