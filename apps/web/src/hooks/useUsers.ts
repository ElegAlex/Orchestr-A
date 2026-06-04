/**
 * useUsers — TanStack Query hook for the users list.
 *
 * Replaces the raw useState+useEffect+usersService.getAll() pattern
 * used across multiple pages. Caches the result for 30s (global default)
 * and deduplicates concurrent fetches sharing the same QueryClient.
 */
import { useQuery } from "@tanstack/react-query";
import { usersService } from "@/services/users.service";
import type { User } from "@/types";

export const USERS_QUERY_KEY = ["users"] as const;

/**
 * Fetch the full users list.
 * Returns the same `UseQueryResult` shape from TanStack Query v5.
 */
export function useUsers() {
  return useQuery<User[]>({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const data = await usersService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });
}
