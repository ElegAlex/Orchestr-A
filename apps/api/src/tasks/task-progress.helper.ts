import { TaskStatus } from 'database';

const PROGRESS_MAP: Record<string, number> = {
  TODO: 0,
  IN_PROGRESS: 50,
  IN_REVIEW: 75,
  DONE: 100,
  BLOCKED: 25,
};

export function getTaskProgress(status: TaskStatus): number {
  return PROGRESS_MAP[status as string] ?? 0;
}
