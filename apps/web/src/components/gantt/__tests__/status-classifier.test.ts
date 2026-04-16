import { classify, type ClassifiableRow } from '../status-classifier';

/** Helper to build a ClassifiableRow with sensible defaults. */
function makeRow(overrides: Partial<ClassifiableRow> = {}): ClassifiableRow {
  return {
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    progress: 50,
    ...overrides,
  };
}

describe('classify', () => {
  const today = new Date('2026-07-01');

  // ── Status-based classification ──────────────────────────────

  it('returns "done" for a completed project', () => {
    const row = makeRow({ status: 'completed' });
    expect(classify(row, today)).toBe('done');
  });

  it('returns "done" for a cancelled project', () => {
    const row = makeRow({ status: 'cancelled' });
    expect(classify(row, today)).toBe('done');
  });

  it('handles case-insensitive "COMPLETED"', () => {
    const row = makeRow({ status: 'COMPLETED' });
    expect(classify(row, today)).toBe('done');
  });

  it('handles case-insensitive "Cancelled"', () => {
    const row = makeRow({ status: 'Cancelled' });
    expect(classify(row, today)).toBe('done');
  });

  // ── Upcoming ─────────────────────────────────────────────────

  it('returns "upcoming" when startDate is in the future', () => {
    const row = makeRow({
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-12-31'),
    });
    expect(classify(row, today)).toBe('upcoming');
  });

  // ── Zero duration ────────────────────────────────────────────

  it('returns "on-track" when totalDuration is zero', () => {
    const row = makeRow({
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-01'),
      progress: 0,
    });
    expect(classify(row, today)).toBe('on-track');
  });

  it('returns "on-track" when endDate is before startDate (negative duration)', () => {
    const row = makeRow({
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-05-01'),
      progress: 0,
    });
    expect(classify(row, today)).toBe('on-track');
  });

  // ── On-track ─────────────────────────────────────────────────

  it('returns "on-track" when progress is close to elapsed time', () => {
    // ~50% elapsed, 45% progress -> gap = 5 < 10 -> on-track
    const row = makeRow({ progress: 45 });
    expect(classify(row, today)).toBe('on-track');
  });

  // ── At-risk ──────────────────────────────────────────────────

  it('returns "at-risk" when progress lags 10-25pp behind elapsed', () => {
    // ~50% elapsed, 30% progress -> gap = 20 -> at-risk
    const row = makeRow({ progress: 30 });
    expect(classify(row, today)).toBe('at-risk');
  });

  // ── Late ─────────────────────────────────────────────────────

  it('returns "late" when progress lags >25pp behind elapsed', () => {
    // ~50% elapsed, 10% progress -> gap = 40 -> late
    const row = makeRow({ progress: 10 });
    expect(classify(row, today)).toBe('late');
  });

  // ── Edge: exactly at the -10 boundary ────────────────────────

  it('returns "on-track" when progress is exactly at the -10 boundary', () => {
    // 100-day project, 50 days elapsed -> 50% elapsed
    // progress = 40 -> 40 >= 50 - 10 -> on-track
    const row = makeRow({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-04-11'), // 100 days
      progress: 40,
    });
    const mid = new Date('2026-02-20'); // 50 days elapsed -> 50%
    expect(classify(row, mid)).toBe('on-track');
  });

  // ── Edge: exactly at the -25 boundary ────────────────────────

  it('returns "at-risk" when progress is exactly at the -25 boundary', () => {
    // 100-day project, 50 days elapsed -> 50% elapsed
    // progress = 25 -> 25 >= 50 - 25 -> at-risk
    const row = makeRow({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-04-11'), // 100 days
      progress: 25,
    });
    const mid = new Date('2026-02-20'); // 50 days elapsed -> 50%
    expect(classify(row, mid)).toBe('at-risk');
  });

  // ── Edge: progress = 0, time 50% elapsed ─────────────────────

  it('returns "late" when progress is 0 and time is 50% elapsed', () => {
    const row = makeRow({ progress: 0 });
    expect(classify(row, today)).toBe('late');
  });

  // ── Edge: past due date ──────────────────────────────────────

  it('classifies correctly when endDate < today (past due)', () => {
    // Fully past due: elapsed capped at 100%, progress = 60 -> 60 >= 100 - 10? No -> 60 >= 100 - 25? No -> late
    const row = makeRow({
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      progress: 60,
    });
    expect(classify(row, today)).toBe('late');
  });

  it('returns "on-track" past due when progress is high enough', () => {
    // elapsed capped at 100%, progress = 95 -> 95 >= 100 - 10 -> on-track
    const row = makeRow({
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      progress: 95,
    });
    expect(classify(row, today)).toBe('on-track');
  });

  // ── No status provided ──────────────────────────────────────

  it('classifies by progress when no status is provided', () => {
    const row = makeRow({ status: undefined, progress: 45 });
    expect(classify(row, today)).toBe('on-track');
  });

  it('classifies by progress when status is a non-terminal value', () => {
    const row = makeRow({ status: 'in_progress', progress: 10 });
    expect(classify(row, today)).toBe('late');
  });

  // ── Custom today parameter ──────────────────────────────────

  it('uses custom today parameter instead of current date', () => {
    const row = makeRow({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      progress: 0,
    });

    // With today near the start -> barely elapsed -> on-track
    const earlyToday = new Date('2026-01-05');
    expect(classify(row, earlyToday)).toBe('on-track');

    // With today near the end -> very late
    const lateToday = new Date('2026-12-01');
    expect(classify(row, lateToday)).toBe('late');
  });

  // ── Default today (no parameter) ────────────────────────────

  it('defaults to current date when today is not provided', () => {
    // Far future row -> upcoming regardless of current date
    const row = makeRow({
      startDate: new Date('2099-01-01'),
      endDate: new Date('2099-12-31'),
      progress: 0,
    });
    expect(classify(row)).toBe('upcoming');
  });
});
