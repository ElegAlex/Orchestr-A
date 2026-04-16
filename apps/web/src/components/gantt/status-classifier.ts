import type { HealthStatus } from './types';

export interface ClassifiableRow {
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  status?: string; // optional project/task status
}

/**
 * Classifies a row's health status based on progress vs elapsed time.
 * Ported from the Portfolio Gantt `getRagStatus` logic.
 */
export function classify(row: ClassifiableRow, today?: Date): HealthStatus {
  const now = today ?? new Date();

  // 1. Completed or cancelled → done
  if (row.status && ['completed', 'cancelled'].includes(row.status.toLowerCase())) {
    return 'done';
  }

  // 2. Future start date → upcoming
  if (row.startDate > now) {
    return 'upcoming';
  }

  // 3. Zero or negative duration → on-track
  const totalDuration = row.endDate.getTime() - row.startDate.getTime();
  if (totalDuration <= 0) {
    return 'on-track';
  }

  // 4. Calculate time elapsed percentage (capped at 100)
  const elapsed = now.getTime() - row.startDate.getTime();
  const timeElapsedPct = Math.min((elapsed / totalDuration) * 100, 100);

  // 5. Classify by gap between progress and elapsed time
  if (row.progress >= timeElapsedPct - 10) {
    return 'on-track';
  }

  if (row.progress >= timeElapsedPct - 25) {
    return 'at-risk';
  }

  return 'late';
}
