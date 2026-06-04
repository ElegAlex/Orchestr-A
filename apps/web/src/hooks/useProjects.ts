/**
 * useProjects — TanStack Query hook for the projects list.
 *
 * Replaces the raw useState+useEffect+projectsService.getAll() pattern.
 * Caches for 30s and deduplicates concurrent fetches.
 */
import { useQuery } from "@tanstack/react-query";
import { projectsService } from "@/services/projects.service";
import type { Project } from "@/types";

export const PROJECTS_QUERY_KEY = ["projects"] as const;

/**
 * Fetch the full active projects list.
 * Returns the same `UseQueryResult` shape from TanStack Query v5.
 */
export function useProjects() {
  return useQuery<Project[]>({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const response = await projectsService.getAll();
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}
