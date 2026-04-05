import { TaskStatus } from "@/types";

export function getTaskProgress(status: TaskStatus): number {
  switch (status) {
    case TaskStatus.TODO:
      return 0;
    case TaskStatus.IN_PROGRESS:
      return 50;
    case TaskStatus.IN_REVIEW:
      return 75;
    case TaskStatus.DONE:
      return 100;
    case TaskStatus.BLOCKED:
      return 25;
    default:
      return 0;
  }
}
