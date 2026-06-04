/**
 * useTasks — TanStack Query hook for the tasks list.
 *
 * Replaces the raw useState+useEffect+tasksService.getAll() pattern.
 * Caches for 30s and deduplicates concurrent fetches.
 */
import { useQuery } from "@tanstack/react-query";
import { tasksService } from "@/services/tasks.service";
import type { Task, PaginatedResponse } from "@/types";

export const TASKS_QUERY_KEY = ["tasks"] as const;

/**
 * Fetch the paginated tasks list.
 * Returns the same `UseQueryResult` shape from TanStack Query v5.
 */
export function useTasks() {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: TASKS_QUERY_KEY,
    queryFn: () => tasksService.getAll(),
  });
}
