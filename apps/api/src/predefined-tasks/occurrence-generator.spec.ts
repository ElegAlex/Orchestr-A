import { describe, it, expect } from 'vitest';
import {
  generateOccurrences,
  InvalidRuleError,
  RuleLike,
} from './occurrence-generator';

// Helper: create a base rule with sensible defaults
function makeRule(overrides: Partial<RuleLike>): RuleLike {
  return {
    id: 'rule-test',
    recurrenceType: 'WEEKLY',
    dayOfWeek: 0, // Lundi
    weekInterval: 1,
    monthlyOrdinal: null,
    monthlyDayOfMonth: null,
    startDate: new Date(Date.UTC(2026, 0, 1)), // 2026-01-01
    endDate: null,
    isActive: true,
    ...overrides,
  };
}

// Helper: parse a UTC-midnight Date and return ISO string
function iso(date: Date): string {
  return date.toISOString();
}

describe('generateOccurrences', () => {
  // =====================
  // WEEKLY tests
  // =====================

  it('1. WEEKLY lundi (dayOfWeek=0) weekInterval=1, plage 2 semaines → 2 dates (lundi 5 et 12 jan)', () => {
    const rule = makeRule({
      recurrenceType: 'WEEKLY',
      dayOfWeek: 0, // Lundi
      weekInterval: 1,
      startDate: new Date(Date.UTC(2026, 0, 5)), // 5 jan = lundi
    });
    const rangeStart = new Date(Date.UTC(2026, 0, 5));
    const rangeEnd = new Date(Date.UTC(2026, 0, 18));

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(2);
    expect(iso(result[0])).toBe('2026-01-05T00:00:00.000Z');
    expect(iso(result[1])).toBe('2026-01-12T00:00:00.000Z');
  });

  it('2. WEEKLY mardi (dayOfWeek=1) weekInterval=2, plage 4 semaines → 2 dates (W1, W3)', () => {
    // Anchor: 2026-01-06 (mardi)
    const rule = makeRule({
      recurrenceType: 'WEEKLY',
      dayOfWeek: 1, // Mardi
      weekInterval: 2,
      startDate: new Date(Date.UTC(2026, 0, 6)), // 6 jan = mardi
    });
    const rangeStart = new Date(Date.UTC(2026, 0, 6));
    const rangeEnd = new Date(Date.UTC(2026, 0, 31));

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    // Tuesdays: Jan 6, 13, 20, 27 — biweekly from Jan 6 → Jan 6, 20
    expect(result).toHaveLength(2);
    expect(iso(result[0])).toBe('2026-01-06T00:00:00.000Z');
    expect(iso(result[1])).toBe('2026-01-20T00:00:00.000Z');
  });

  // =====================
  // MONTHLY_DAY tests
  // =====================

  it('3. MONTHLY_DAY jour=15, plage fév→avr 2026 → 3 dates (15 fév, 15 mars, 15 avr)', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_DAY',
      dayOfWeek: null,
      monthlyDayOfMonth: 15,
      startDate: new Date(Date.UTC(2026, 0, 1)), // 1er jan
    });
    const rangeStart = new Date(Date.UTC(2026, 1, 1)); // 1er fév
    const rangeEnd = new Date(Date.UTC(2026, 3, 30)); // 30 avr

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(3);
    expect(iso(result[0])).toBe('2026-02-15T00:00:00.000Z');
    expect(iso(result[1])).toBe('2026-03-15T00:00:00.000Z');
    expect(iso(result[2])).toBe('2026-04-15T00:00:00.000Z');
  });

  it('4. MONTHLY_DAY jour=31, plage fév 2026 (28j, non bissextile) → clampé au 28 fév', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_DAY',
      dayOfWeek: null,
      monthlyDayOfMonth: 31,
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    const rangeStart = new Date(Date.UTC(2026, 1, 1)); // 1er fév
    const rangeEnd = new Date(Date.UTC(2026, 1, 28)); // 28 fév

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(1);
    expect(iso(result[0])).toBe('2026-02-28T00:00:00.000Z');
  });

  it('5. MONTHLY_DAY jour=31, plage avr 2026 (30j) → clampé au 30 avr', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_DAY',
      dayOfWeek: null,
      monthlyDayOfMonth: 31,
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    const rangeStart = new Date(Date.UTC(2026, 3, 1)); // 1er avr
    const rangeEnd = new Date(Date.UTC(2026, 3, 30)); // 30 avr

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(1);
    expect(iso(result[0])).toBe('2026-04-30T00:00:00.000Z');
  });

  // =====================
  // MONTHLY_ORDINAL tests
  // =====================

  it('6. MONTHLY_ORDINAL ordinal=3 dayOfWeek=1 (mardi), plage 2 mois → 3e mardi de chaque mois', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_ORDINAL',
      dayOfWeek: 1, // Mardi
      monthlyOrdinal: 3,
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    const rangeStart = new Date(Date.UTC(2026, 0, 1)); // 1er jan
    const rangeEnd = new Date(Date.UTC(2026, 1, 28)); // 28 fév

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    // 3e mardi jan 2026: Jan 6, 13, 20 → Jan 20
    // 3e mardi fév 2026: Fév 3, 10, 17 → Fév 17
    expect(result).toHaveLength(2);
    expect(iso(result[0])).toBe('2026-01-20T00:00:00.000Z');
    expect(iso(result[1])).toBe('2026-02-17T00:00:00.000Z');
  });

  it('7. MONTHLY_ORDINAL ordinal=5 dayOfWeek=3 (jeudi), plage mai 2026 → dernier jeudi = 28 mai', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_ORDINAL',
      dayOfWeek: 3, // Jeudi
      monthlyOrdinal: 5, // dernier
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    const rangeStart = new Date(Date.UTC(2026, 4, 1)); // 1er mai
    const rangeEnd = new Date(Date.UTC(2026, 4, 31)); // 31 mai

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(1);
    expect(iso(result[0])).toBe('2026-05-28T00:00:00.000Z');
  });

  it('8. MONTHLY_ORDINAL ordinal=5 dayOfWeek=0 (lundi), plage fév 2026 → dernier lundi = 23 fév', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_ORDINAL',
      dayOfWeek: 0, // Lundi
      monthlyOrdinal: 5,
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    const rangeStart = new Date(Date.UTC(2026, 1, 1)); // 1er fév
    const rangeEnd = new Date(Date.UTC(2026, 1, 28)); // 28 fév

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(1);
    expect(iso(result[0])).toBe('2026-02-23T00:00:00.000Z');
  });

  // =====================
  // Boundary / clipping tests
  // =====================

  it('9. endDate null + rangeEnd → borne correcte (pas de dépassement)', () => {
    const rule = makeRule({
      recurrenceType: 'WEEKLY',
      dayOfWeek: 0,
      weekInterval: 1,
      startDate: new Date(Date.UTC(2026, 0, 5)),
      endDate: null,
    });
    const rangeStart = new Date(Date.UTC(2026, 0, 5));
    const rangeEnd = new Date(Date.UTC(2026, 0, 11)); // dimanche → 1 seul lundi (5 jan)

    const result = generateOccurrences(rule, rangeStart, rangeEnd);

    expect(result).toHaveLength(1);
    expect(iso(result[0])).toBe('2026-01-05T00:00:00.000Z');
  });

  it('10. rule.isActive=false → []', () => {
    const rule = makeRule({
      isActive: false,
      recurrenceType: 'WEEKLY',
      dayOfWeek: 0,
    });
    const result = generateOccurrences(
      rule,
      new Date(Date.UTC(2026, 0, 5)),
      new Date(Date.UTC(2026, 0, 31)),
    );
    expect(result).toHaveLength(0);
  });

  it('11. startDate > rangeEnd → []', () => {
    const rule = makeRule({
      recurrenceType: 'WEEKLY',
      dayOfWeek: 0,
      startDate: new Date(Date.UTC(2026, 5, 1)), // juin 2026
    });
    const result = generateOccurrences(
      rule,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 31)), // jan 2026
    );
    expect(result).toHaveLength(0);
  });

  // =====================
  // InvalidRuleError tests
  // =====================

  it('12. WEEKLY dayOfWeek=null → throw InvalidRuleError', () => {
    const rule = makeRule({
      recurrenceType: 'WEEKLY',
      dayOfWeek: null,
    });
    expect(() =>
      generateOccurrences(
        rule,
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(InvalidRuleError);
  });

  it('13. MONTHLY_DAY monthlyDayOfMonth=null → throw InvalidRuleError', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_DAY',
      dayOfWeek: null,
      monthlyDayOfMonth: null,
    });
    expect(() =>
      generateOccurrences(
        rule,
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(InvalidRuleError);
  });

  it('14. MONTHLY_ORDINAL monthlyOrdinal=null → throw InvalidRuleError', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_ORDINAL',
      dayOfWeek: 0,
      monthlyOrdinal: null,
    });
    expect(() =>
      generateOccurrences(
        rule,
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(InvalidRuleError);
  });

  it('15. MONTHLY_ORDINAL dayOfWeek=null → throw InvalidRuleError', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_ORDINAL',
      dayOfWeek: null,
      monthlyOrdinal: 3,
    });
    expect(() =>
      generateOccurrences(
        rule,
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(InvalidRuleError);
  });

  it('16. MONTHLY_DAY avec dayOfWeek non null → throw InvalidRuleError', () => {
    const rule = makeRule({
      recurrenceType: 'MONTHLY_DAY',
      dayOfWeek: 2, // interdit pour MONTHLY_DAY
      monthlyDayOfMonth: 15,
    });
    expect(() =>
      generateOccurrences(
        rule,
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(InvalidRuleError);
  });
});
